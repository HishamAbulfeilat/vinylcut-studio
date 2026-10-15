/* ------------------------------------------------------------------ *
 * PDF importer.
 *
 * This is a real (if deliberately partial) PDF reader: it locates the
 * indirect objects, inflates FlateDecode streams with the browser's own
 * zlib, finds the first page, resolves its /Resources, and interprets the
 * content stream - path construction, painting operators, the graphics
 * state stack, colour operators and text-showing operators.
 *
 * It is not a full PDF renderer: transparency groups, soft masks, shading
 * patterns, Type3 fonts and inline images are not rasterised, and text is
 * re-created as editable text rather than glyph outlines (no font file is
 * needed for that). Geometry, colours, line widths, clips-free paths and
 * text positions all come through for real.
 * ------------------------------------------------------------------ */

import { advanceWidth } from './exporters'

/* --------------------------- byte helpers -------------------------- */

export function latin1(bytes) {
  let s = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return s
}

export function isPdfBytes(bytes) {
  if (!bytes || bytes.length < 5) return false
  const head = latin1(bytes.subarray(0, 8))
  return head.startsWith('%PDF-')
}

/** zlib inflate via the platform DecompressionStream. */
export async function inflate(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot inflate PDF streams (no DecompressionStream)')
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

/** Undo a PNG predictor (used by some FlateDecode streams). */
function unpredict(bytes, colors, bpc, columns) {
  const bpp = Math.ceil((colors * bpc) / 8)
  const rowLen = Math.ceil((colors * bpc * columns) / 8)
  const rows = Math.floor(bytes.length / (rowLen + 1))
  const out = new Uint8Array(rows * rowLen)
  let prev = new Uint8Array(rowLen)
  for (let r = 0; r < rows; r++) {
    const ft = bytes[r * (rowLen + 1)]
    const row = bytes.subarray(r * (rowLen + 1) + 1, (r + 1) * (rowLen + 1))
    const cur = new Uint8Array(rowLen)
    for (let i = 0; i < rowLen; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      let v = row[i]
      if (ft === 1) v += a
      else if (ft === 2) v += b
      else if (ft === 3) v += (a + b) >> 1
      else if (ft === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      cur[i] = v & 0xff
    }
    out.set(cur, r * rowLen)
    prev = cur
  }
  return out
}

/* --------------------------- object model -------------------------- */

/** Tokenize a PDF dictionary / content stream into a flat token list. */
function tokenize(src) {
  const tokens = []
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === '%') {
      while (i < n && src[i] !== '\n' && src[i] !== '\r') i++
      continue
    }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '\f' || c === '\0') {
      i++
      continue
    }
    if (c === '(') {
      let depth = 1
      let j = i + 1
      let out = ''
      while (j < n && depth > 0) {
        const ch = src[j]
        if (ch === '\\') {
          const nx = src[j + 1]
          const map = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' }
          if (nx in map) {
            out += map[nx]
            j += 2
          } else if (nx >= '0' && nx <= '7') {
            let oct = ''
            let k = j + 1
            while (k < n && oct.length < 3 && src[k] >= '0' && src[k] <= '7') oct += src[k++]
            out += String.fromCharCode(parseInt(oct, 8))
            j = k
          } else {
            out += nx
            j += 2
          }
          continue
        }
        if (ch === '(') depth++
        else if (ch === ')') {
          depth--
          if (depth === 0) {
            j++
            break
          }
        }
        out += ch
        j++
      }
      tokens.push({ type: 'string', value: out })
      i = j
      continue
    }
    if (c === '<' && src[i + 1] !== '<') {
      const end = src.indexOf('>', i)
      const hex = src.slice(i + 1, end < 0 ? n : end).replace(/[^0-9a-fA-F]/g, '')
      let out = ''
      for (let k = 0; k + 1 < hex.length; k += 2) out += String.fromCharCode(parseInt(hex.substr(k, 2), 16))
      if (hex.length % 2) out += String.fromCharCode(parseInt(hex[hex.length - 1] + '0', 16))
      tokens.push({ type: 'string', value: out })
      i = end < 0 ? n : end + 1
      continue
    }
    if (c === '<' && src[i + 1] === '<') {
      tokens.push({ type: 'op', value: '<<' })
      i += 2
      continue
    }
    if (c === '>' && src[i + 1] === '>') {
      tokens.push({ type: 'op', value: '>>' })
      i += 2
      continue
    }
    if (c === '[') {
      tokens.push({ type: 'op', value: '[' })
      i++
      continue
    }
    if (c === ']') {
      tokens.push({ type: 'op', value: ']' })
      i++
      continue
    }
    if (c === '/') {
      let j = i + 1
      let name = ''
      while (j < n && !/[\s()<>\[\]{}/%]/.test(src[j])) name += src[j++]
      tokens.push({ type: 'name', value: name })
      i = j
      continue
    }
    if (/[-+.\d]/.test(c)) {
      let j = i
      let num = ''
      while (j < n && /[-+.\deE]/.test(src[j])) num += src[j++]
      const v = parseFloat(num)
      if (Number.isFinite(v)) tokens.push({ type: 'number', value: v })
      i = j
      continue
    }
    let j = i
    let word = ''
    while (j < n && !/[\s()<>\[\]{}/%]/.test(src[j])) word += src[j++]
    if (word) tokens.push({ type: 'op', value: word })
    i = j
  }
  return tokens
}

/** Parse a dictionary source string into a JS object. */
function parseDict(src) {
  const tokens = tokenize(src)
  let pos = 0
  const peek = () => tokens[pos]
  const next = () => tokens[pos++]

  const parseValue = () => {
    const t = next()
    if (!t) return null
    if (t.type === 'number') {
      // Look ahead for "R" (indirect reference)
      if (peek() && peek().type === 'number' && tokens[pos + 1] && tokens[pos + 1].type === 'op' && tokens[pos + 1].value === 'R') {
        const gen = next().value
        next()
        return { ref: [t.value, gen] }
      }
      return t.value
    }
    if (t.type === 'name') return `/${t.value}`
    if (t.type === 'string') return t.value
    if (t.type === 'op' && t.value === '<<') {
      const obj = {}
      for (;;) {
        const k = next()
        if (!k) break
        if (k.type === 'op' && k.value === '>>') break
        if (k.type !== 'name') continue
        obj[k.value] = parseValue()
      }
      return obj
    }
    if (t.type === 'op' && t.value === '[') {
      const arr = []
      for (;;) {
        const p = peek()
        if (!p) break
        if (p.type === 'op' && p.value === ']') {
          next()
          break
        }
        arr.push(parseValue())
      }
      return arr
    }
    if (t.type === 'op' && (t.value === 'true' || t.value === 'false')) return t.value === 'true'
    if (t.type === 'op' && t.value === 'null') return null
    return t.value
  }

  const out = {}
  // Skip until the first dict open marker.
  while (pos < tokens.length && !(tokens[pos].type === 'op' && tokens[pos].value === '<<')) pos++
  if (pos < tokens.length) return parseValue()
  return out
}

/**
 * Scan the whole file for "N G obj ... endobj" blocks. This is slower than
 * following the xref but survives the broken/missing xref tables that are
 * common in files produced by drawing apps - including PDF-compatible .ai.
 */
export function scanObjects(src) {
  const map = new Map()
  const re = /(\d+)\s+(\d+)\s+obj\b/g
  let m
  while ((m = re.exec(src))) {
    const num = parseInt(m[1], 10)
    const start = m.index + m[0].length
    const end = src.indexOf('endobj', start)
    const body = src.slice(start, end < 0 ? src.length : end)
    const sIdx = body.indexOf('stream')
    let dictStr = body
    let streamRange = null
    if (sIdx >= 0) {
      dictStr = body.slice(0, sIdx)
      let sStart = sIdx + 'stream'.length
      if (body[sStart] === '\r') sStart++
      if (body[sStart] === '\n') sStart++
      let sEnd = body.lastIndexOf('endstream')
      if (sEnd < 0) sEnd = body.length
      streamRange = [m.index + m[0].length + sStart, m.index + m[0].length + sEnd]
    }
    map.set(num, { num, dict: parseDict(dictStr), dictStr, streamRange })
  }
  return map
}

function resolve(value, map) {
  if (value && typeof value === 'object' && Array.isArray(value.ref)) {
    const o = map.get(value.ref[0])
    return o ? o.dict : null
  }
  return value
}

async function streamBytes(obj, bytes, map, depth = 0) {
  if (!obj || !obj.streamRange) return null
  const raw = bytes.subarray(obj.streamRange[0], obj.streamRange[1])
  const filters = [].concat(obj.dict.Filter || [])
  const parms = [].concat(obj.dict.DecodeParms || [])
  let out = raw
  for (let i = 0; i < filters.length; i++) {
    const f = String(filters[i]).replace('/', '')
    if (f === 'FlateDecode' || f === 'Fl') {
      out = await inflate(out)
      const p = resolve(parms[i], map)
      const pred = p && typeof p === 'object' ? p.Predictor : 0
      if (pred && pred >= 10) {
        out = unpredict(out, (p.Colors | 0) || 1, (p.BitsPerComponent | 0) || 8, (p.Columns | 0) || 1)
      }
    } else if (f === 'ASCIIHexDecode') {
      const hex = latin1(out).replace(/[^0-9a-fA-F]/g, '')
      const res = new Uint8Array(hex.length >> 1)
      for (let k = 0; k + 1 < hex.length; k += 2) res[k >> 1] = parseInt(hex.substr(k, 2), 16)
      out = res
    } else if (f === 'DCTDecode') {
      return { jpeg: out }
    } else if (f === 'Filter') {
      // no-op
    } else {
      // Unknown filter: return nothing rather than garbage.
      return null
    }
    if (depth > 8) break
  }
  return { text: latin1(out) }
}

function findPage(map) {
  for (const obj of map.values()) {
    const t = obj.dict && obj.dict.Type
    if (t === '/Page') return obj
  }
  return null
}

/* ----------------------- content stream interpreter ---------------- */

function matMul(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ]
}

const applyM = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

const IDENTITY = [1, 0, 0, 1, 0, 0]

/** Shape a PDF path (in user space, y-up) into document objects. */
function paint(stack) {
  const { ctm, path, fillColor, strokeColor, lineWidth, fillRule } = stack
  if (!path.length) return null

  // Transform every segment into page space (y stays up here; the caller
  // flips at the end).
  const subs = path.map(sp => {
    const start = applyM(ctm, sp.start[0], sp.start[1])
    return {
      start,
      closed: !!sp.closed,
      segs: sp.segs.map(sg => {
        if (sg.type === 'line') return { type: 'line', to: applyM(ctm, sg.to[0], sg.to[1]) }
        return {
          type: 'cubic',
          c1: applyM(ctm, sg.c1[0], sg.c1[1]),
          c2: applyM(ctm, sg.c2[0], sg.c2[1]),
          to: applyM(ctm, sg.to[0], sg.to[1]),
        }
      }),
    }
  })
  return { subs, fillColor, strokeColor, lineWidth, fillRule }
}

/** Flatten curve subpaths into polyline rings for boolean-free storage. */
function subpathsToRings(subs, tolerance = 0.15) {
  const rings = []
  for (const sp of subs) {
    const pts = [sp.start.slice()]
    let cx = sp.start[0]
    let cy = sp.start[1]
    for (const sg of sp.segs) {
      if (sg.type === 'line') {
        pts.push(sg.to.slice())
      } else {
        const steps = 12
        for (let i = 1; i <= steps; i++) {
          const t = i / steps
          const mt = 1 - t
          pts.push([
            mt * mt * mt * cx + 3 * mt * mt * t * sg.c1[0] + 3 * mt * t * t * sg.c2[0] + t * t * t * sg.to[0],
            mt * mt * mt * cy + 3 * mt * mt * t * sg.c1[1] + 3 * mt * t * t * sg.c2[1] + t * t * t * sg.to[1],
          ])
        }
      }
      cx = sg.to[0]
      cy = sg.to[1]
    }
    if (pts.length > 1) rings.push(pts)
  }
  return rings
}

function rgbToHex(r, g, b) {
  const h = (v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

/**
 * Interpret a content stream into shapes.
 * `flip` converts PDF user space (y up, origin bottom-left) into the
 * document space (y down, origin top-left) using the page height.
 */
async function interpret(content, resources, map, bytes, mediaBox) {
  const tokens = tokenize(content)
  const shapes = []
  const pageH = mediaBox.height

  const base = {
    ctm: IDENTITY.slice(),
    lineWidth: 1,
    fillColor: [0, 0, 0],
    strokeColor: [0, 0, 0],
    fillRule: 'nonzero',
  }
  let stack = { ...base, path: [] }
  const gstack = []
  let cur = null
  let pendingClip = false

  const fonts = {}
  if (resources && resources.Font && typeof resources.Font === 'object') {
    for (const [k, v] of Object.entries(resources.Font)) {
      const fo = resolve(v, map)
      if (fo) fonts[k] = { base: String(fo.BaseFont || '/Helvetica').replace('/', ''), widths: fo.Widths || null, first: fo.FirstChar != null ? fo.FirstChar : 0, size: 1 }
    }
  }

  let ctmText = IDENTITY.slice()
  let curFont = 'Helvetica'
  let fontSize = 12
  let leading = 0

  const stackVals = []
  const push = (v) => stackVals.push(v)
  const pop = () => stackVals.pop()
  const num = (i = 0) => {
    const v = stackVals[stackVals.length - 1 - i]
    return typeof v === 'number' ? v : 0
  }

  const newSubpath = (x, y) => {
    cur = { start: [x, y], closed: false, segs: [] }
    stack.path.push(cur)
  }
  const lineTo = (x, y) => {
    if (!cur) newSubpath(x, y)
    else cur.segs.push({ type: 'line', to: [x, y] })
  }
  const curveTo = (c1x, c1y, c2x, c2y, x, y) => {
    if (!cur) newSubpath(c1x, c1y)
    cur.segs.push({ type: 'cubic', c1: [c1x, c1y], c2: [c2x, c2y], to: [x, y] })
  }

  const emitText = (str) => {
    if (!str) return
    const m = matMul(stack.ctm, ctmText)
    const [x, y] = applyM(m, 0, 0)
    const scale = Math.hypot(m[0], m[1]) || 1
    const size = fontSize * scale
    const f = fonts[curFont] || { base: 'Helvetica', widths: null, first: 0 }
    // Real advance: the font's own /Widths array when the PDF embeds one,
    // otherwise the base-14 metric tables.
    let adv = 0
    for (const ch of str) {
      const code = ch.charCodeAt(0)
      if (f.widths && code >= f.first && code - f.first < f.widths.length) {
        adv += (parseFloat(f.widths[code - f.first]) || 0) / 1000
      } else {
        adv += advanceWidth(code, f.base)
      }
    }
    shapes.push({
      type: 'text',
      x,
      y: pageH - y - size,
      width: Math.max(8, adv * size),
      height: size * 1.2,
      text: str,
      fontSize: size,
      fontFamily: /Times/i.test(f.base) ? 'Times New Roman' : /Courier/i.test(f.base) ? 'Courier New' : 'Arial',
      bold: /bold|black|heavy|semibold/i.test(f.base),
      italic: /italic|oblique/i.test(f.base),
      fill: { type: 'solid', color: rgbToHex(...stack.fillColor) },
      stroke: { width: 0 },
      opacity: 100,
    })
    ctmText = matMul(ctmText, [1, 0, 0, 1, adv * fontSize, 0])
  }

  const i = { v: 0 }
  const nextTok = () => tokens[i.v++]

  while (i.v < tokens.length) {
    const t = nextTok()
    if (!t) break
    if (t.type === 'number') {
      push(t.value)
      continue
    }
    if (t.type === 'string') {
      push(t.value)
      continue
    }
    if (t.type === 'name') {
      push(`/${t.value}`)
      continue
    }
    if (t.type === 'op') {
      const op = t.value
      if (op === '[') {
        const arr = []
        let depth = 1
        while (i.v < tokens.length && depth > 0) {
          const tk = nextTok()
          if (!tk) break
          if (tk.type === 'op' && tk.value === '[') depth++
          else if (tk.type === 'op' && tk.value === ']') {
            depth--
            if (depth === 0) break
          }
          arr.push(tk.type === 'number' ? tk.value : tk.type === 'string' ? tk.value : tk.value)
        }
        push(arr)
        continue
      }

      switch (op) {
        case 'q':
          gstack.push({ ...stack, ctm: stack.ctm.slice(), path: stack.path })
          stack = { ...stack, ctm: stack.ctm.slice(), path: [] }
          stackVals.length = 0
          break
        case 'Q': {
          const s = gstack.pop()
          if (s) stack = { ...s, path: [] }
          stackVals.length = 0
          break
        }
        case 'cm': {
          if (stackVals.length >= 6) {
            const m = stackVals.splice(stackVals.length - 6, 6)
            stack.ctm = matMul(stack.ctm, m)
          }
          break
        }
        case 'w':
          stack.lineWidth = num(0)
          stackVals.length = 0
          break
        case 'J':
        case 'j':
        case 'M':
        case 'i':
        case 'd':
          stackVals.length = 0
          break
        case 'rg':
          stack.fillColor = [num(2), num(1), num(0)]
          stackVals.length = 0
          break
        case 'g':
          stack.fillColor = [num(0), num(0), num(0)]
          stackVals.length = 0
          break
        case 'k': {
          const c = num(3) || 0
          const m = num(2) || 0
          const yv = num(1) || 0
          const kk = num(0) || 0
          stack.fillColor = [(1 - c) * (1 - kk), (1 - m) * (1 - kk), (1 - yv) * (1 - kk)]
          stackVals.length = 0
          break
        }
        case 'RG':
          stack.strokeColor = [num(2), num(1), num(0)]
          stackVals.length = 0
          break
        case 'G':
          stack.strokeColor = [num(0), num(0), num(0)]
          stackVals.length = 0
          break
        case 'K': {
          const c = num(3) || 0
          const m = num(2) || 0
          const yv = num(1) || 0
          const kk = num(0) || 0
          stack.strokeColor = [(1 - c) * (1 - kk), (1 - m) * (1 - kk), (1 - yv) * (1 - kk)]
          stackVals.length = 0
          break
        }
        case 'sc':
        case 'scn': {
          if (stackVals.length >= 3) stack.fillColor = [num(2), num(1), num(0)]
          else if (stackVals.length === 1) stack.fillColor = [num(0), num(0), num(0)]
          stackVals.length = 0
          break
        }
        case 'SC':
        case 'SCN': {
          if (stackVals.length >= 3) stack.strokeColor = [num(2), num(1), num(0)]
          else if (stackVals.length === 1) stack.strokeColor = [num(0), num(0), num(0)]
          stackVals.length = 0
          break
        }
        case 'cs':
        case 'CS':
          stackVals.length = 0
          break
        case 'm':
          newSubpath(num(1), num(0))
          stackVals.length = 0
          break
        case 'l':
          lineTo(num(1), num(0))
          stackVals.length = 0
          break
        case 'c':
          curveTo(num(5), num(4), num(3), num(2), num(1), num(0))
          stackVals.length = 0
          break
        case 'v':
          curveTo(num(3), num(2), num(3), num(2), num(1), num(0))
          stackVals.length = 0
          break
        case 'y':
          curveTo(num(3), num(2), num(1), num(0), num(1), num(0))
          stackVals.length = 0
          break
        case 'h':
          if (cur) {
            cur.closed = true
            cur.segs.push({ type: 'line', to: cur.start.slice() })
          }
          stackVals.length = 0
          break
        case 're': {
          const y0 = num(3)
          const x0 = num(2)
          const w = num(1)
          const h = num(0)
          newSubpath(x0, y0)
          lineTo(x0 + w, y0)
          lineTo(x0 + w, y0 + h)
          lineTo(x0, y0 + h)
          cur.closed = true
          cur.segs.push({ type: 'line', to: [x0, y0] })
          stackVals.length = 0
          break
        }
        case 'W':
        case 'W*':
          pendingClip = true
          stackVals.length = 0
          break
        case 'n':
          stack.path = []
          cur = null
          pendingClip = false
          stackVals.length = 0
          break
        case 'S':
        case 's':
        case 'f':
        case 'F':
        case 'f*':
        case 'B':
        case 'B*':
        case 'b':
        case 'b*': {
          const shape = paint(stack)
          if (shape && !pendingClip) {
            const wantsStroke = /[SsBb]/.test(op) && shape.strokeColor
            const wantsFill = /[fF]/.test(op) || /[Bb]/.test(op)
            const rings = subpathsToRings(shape.subs)
            const allPts = rings.flat()
            if (allPts.length) {
              let minX = Infinity
              let minY = Infinity
              let maxX = -Infinity
              let maxY = -Infinity
              for (const [x, y] of allPts) {
                minX = Math.min(minX, x)
                minY = Math.min(minY, y)
                maxX = Math.max(maxX, x)
                maxY = Math.max(maxY, y)
              }
              const w = Math.max(maxX - minX, 0.01)
              const h = Math.max(maxY - minY, 0.01)
              const d = rings
                .map(r => r.map(([x, y], k) => `${k === 0 ? 'M' : 'L'}${(x - minX).toFixed(3)},${(maxY - y).toFixed(3)}`).join(' ') + ' Z')
                .join(' ')
              shapes.push({
                type: 'path',
                pathData: d,
                pathWidth: w,
                pathHeight: h,
                x: minX,
                y: pageH - maxY,
                width: w,
                height: h,
                rings: [rings.map(r => r.map(([x, y]) => [x, pageH - y]))],
                fill: wantsFill ? { type: 'solid', color: rgbToHex(...shape.fillColor) } : { type: 'none' },
                stroke: wantsStroke ? { color: rgbToHex(...shape.strokeColor), width: Math.abs(shape.lineWidth * (Math.hypot(stack.ctm[0], stack.ctm[1]) || 1)) || 1, style: 'solid' } : { width: 0 },
                opacity: 100,
              })
            }
          }
          stack.path = []
          cur = null
          pendingClip = false
          stackVals.length = 0
          break
        }
        case 'BT':
          ctmText = IDENTITY.slice()
          stackVals.length = 0
          break
        case 'ET':
          stackVals.length = 0
          break
        case 'Tf': {
          // `/Name size Tf` - the name is the operand *before* the size.
          const sz = stackVals[stackVals.length - 1]
          const nm = stackVals[stackVals.length - 2]
          fontSize = typeof sz === 'number' ? sz : 12
          curFont = String(nm == null ? '' : nm).replace('/', '')
          stackVals.length = 0
          break
        }
        case 'Td': {
          const ty = num(0)
          const tx = num(1)
          ctmText = matMul(ctmText, [1, 0, 0, 1, tx, ty])
          stackVals.length = 0
          break
        }
        case 'TD': {
          const ty = num(0)
          const tx = num(1)
          leading = -ty
          ctmText = matMul(ctmText, [1, 0, 0, 1, tx, ty])
          stackVals.length = 0
          break
        }
        case 'Tm': {
          const m = stackVals.splice(stackVals.length - 6, 6)
          if (m.length === 6) ctmText = m
          break
        }
        case 'T*':
          ctmText = matMul(ctmText, [1, 0, 0, 1, 0, -leading])
          stackVals.length = 0
          break
        case 'Tj':
          emitText(typeof stackVals[stackVals.length - 1] === 'string' ? stackVals[stackVals.length - 1] : '')
          stackVals.length = 0
          break
        case 'TJ': {
          const arr = stackVals[stackVals.length - 1]
          if (Array.isArray(arr)) {
            let buf = ''
            for (const item of arr) {
              if (typeof item === 'number') {
                emitText(buf)
                buf = ''
                ctmText = matMul(ctmText, [1, 0, 0, 1, (-item / 1000) * fontSize, 0])
              } else if (typeof item === 'string') {
                buf += item
              }
            }
            emitText(buf)
          }
          stackVals.length = 0
          break
        }
        case "'": {
          ctmText = matMul(ctmText, [1, 0, 0, 1, 0, -leading])
          emitText(typeof stackVals[stackVals.length - 1] === 'string' ? stackVals[stackVals.length - 1] : '')
          stackVals.length = 0
          break
        }
        case '"': {
          stackVals.length = 0
          break
        }
        case 'Do':
          stackVals.length = 0
          break
        case 'BI':
        case 'EI':
          stackVals.length = 0
          break
        default:
          stackVals.length = 0
          break
      }
    }
  }
  return shapes
}

/* ------------------------------ entry ------------------------------ */

/**
 * Import a PDF (or a PDF-compatible .ai) into document objects.
 * `bytes` is a Uint8Array.
 */
export async function importPdfBytes(bytes, page) {
  const src = latin1(bytes)
  const map = scanObjects(src)
  const pageObj = findPage(map)
  if (!pageObj) throw new Error('No page found in the PDF')

  const mediaBoxArr = pageObj.dict.MediaBox || [0, 0, page.width, page.height]
  const mb = mediaBoxArr.map(Number)
  let mediaBox = { x0: mb[0] || 0, y0: mb[1] || 0, x1: mb[2] || page.width, y1: mb[3] || page.height }
  mediaBox.width = Math.abs(mediaBox.x1 - mediaBox.x0)
  mediaBox.height = Math.abs(mediaBox.y1 - mediaBox.y0)

  const contentRefs = [].concat(pageObj.dict.Contents || [])
  let content = ''
  for (const ref of contentRefs) {
    const entry = ref && typeof ref === 'object' && Array.isArray(ref.ref) ? map.get(ref.ref[0]) : null
    if (entry) {
      const res = await streamBytes(entry, bytes, map)
      if (res && res.text) content += res.text + '\n'
    } else if (typeof ref === 'string') {
      content += ref + '\n'
    }
  }

  const resources = resolve(pageObj.dict.Resources, map) || {}
  const shapes = await interpret(content, resources, map, bytes, mediaBox)

  // Fit the PDF page into the document page.
  const scale = Math.min(page.width / mediaBox.width, page.height / mediaBox.height) * 0.95
  const offX = (page.width - mediaBox.width * scale) / 2 - mediaBox.x0 * scale
  const offY = (page.height - mediaBox.height * scale) / 2 - mediaBox.y0 * scale
  for (const s of shapes) {
    s.x = s.x * scale + offX
    s.y = s.y * scale + offY
    s.width = Math.max(0.01, s.width * scale)
    s.height = Math.max(0.01, s.height * scale)
    if (s.type === 'text') s.fontSize = Math.max(2, s.fontSize * scale)
    if (s.stroke && s.stroke.width) s.stroke.width = Math.max(0.1, s.stroke.width * scale)
  }
  return shapes
}
