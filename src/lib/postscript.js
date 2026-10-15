/* ------------------------------------------------------------------ *
 * PostScript / EPS / AI importer.
 *
 * A partial but genuine PostScript interpreter for the drawing subset
 * that vector-art EPS files actually use: path construction, painting,
 * the graphics state stack, the CTM, colour and line operators, text, and
 * the language machinery those rely on (`def`, procedures, `if`,
 * `ifelse`, `repeat`, `for`, and the arithmetic/stack operators used to
 * compute coordinates).
 *
 * Unsupported PostScript (images, shadings, patterns, `dict` sandboxing)
 * is skipped rather than guessed at.
 * ------------------------------------------------------------------ */

import { measureText } from './exporters'

/* ---------------------------- tokenizer ---------------------------- */

/** Map a PostScript font name onto a web font + width table selection. */
function fontFromPS(name) {
  const n = String(name || 'Helvetica')
  const bold = /bold|black|heavy|semibold/i.test(n)
  const italic = /italic|oblique/i.test(n)
  let fontFamily = 'Arial'
  if (/times|serif|roman/i.test(n)) fontFamily = 'Times New Roman'
  else if (/courier|mono/i.test(n)) fontFamily = 'Courier New'
  else if (/symbol/i.test(n)) fontFamily = 'Symbol'
  return { fontFamily, bold, italic }
}

function tokenize(src) {
  const tokens = []
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === '%') {
      while (i < n && src[i] !== '\n') i++
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
      tokens.push({ t: 'str', v: out })
      i = j
      continue
    }
    if (c === '<') {
      // hex string, or the "<<" dict markers (treated as harmless)
      if (src[i + 1] === '<') {
        i += 2
        continue
      }
      const end = src.indexOf('>', i)
      const hex = src.slice(i + 1, end < 0 ? n : end).replace(/[^0-9a-fA-F]/g, '')
      let out = ''
      for (let k = 0; k + 1 < hex.length; k += 2) out += String.fromCharCode(parseInt(hex.substr(k, 2), 16))
      tokens.push({ t: 'str', v: out })
      i = end < 0 ? n : end + 1
      continue
    }
    if (c === '>') {
      i++
      continue
    }
    if (c === '{' || c === '}' || c === '[' || c === ']') {
      tokens.push({ t: c })
      i++
      continue
    }
    if (c === '/') {
      let j = i + 1
      let name = ''
      while (j < n && !/[\s()<>\[\]{}/%]/.test(src[j])) name += src[j++]
      tokens.push({ t: 'lit', v: name })
      i = j
      continue
    }
    if (/[-+.\d]/.test(c) && !(c === '-' && /[A-Za-z]/.test(src[i + 1] || ''))) {
      let j = i
      let num = ''
      while (j < n && /[-+.\deE]/.test(src[j])) {
        // stop if we hit a stray '-' that starts an operator like -1-2
        num += src[j++]
      }
      const v = parseFloat(num)
      if (Number.isFinite(v)) tokens.push({ t: 'num', v })
      i = j
      continue
    }
    let j = i
    let word = ''
    while (j < n && !/[\s()<>\[\]{}/%]/.test(src[j])) word += src[j++]
    if (word) tokens.push({ t: 'name', v: word })
    i = j
  }

  // Group `{ ... }` into procedure arrays.
  const stack = []
  const out = []
  for (const tk of tokens) {
    if (tk.t === '{') stack.push(out.length)
    else if (tk.t === '}') {
      const start = stack.pop()
      if (start == null) continue
      const body = out.splice(start, out.length - start)
      out.push({ t: 'proc', v: body })
    } else out.push(tk)
  }
  return out
}

/* --------------------------- interpreter --------------------------- */

const BBOX_RE = /%%(HiRes)?BoundingBox:\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/

function parseBoundingBox(text) {
  let m = BBOX_RE.exec(text)
  if (!m) return null
  const [x0, y0, x1, y1] = [m[2], m[3], m[4], m[5]].map(Number)
  if (![x0, y0, x1, y1].every(Number.isFinite)) return null
  if (x1 <= x0 || y1 <= y0) return null
  return { x0, y0, x1, y1, width: x1 - x0, height: y1 - y0 }
}

function mul(a, b) {
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

/**
 * Interpret PostScript source and collect shapes.
 * Coordinates come out in PostScript user space (y up).
 */
export function interpretPostScript(text, limits = {}) {
  const tokens = tokenize(text)
  const dict = new Map()
  let stack = []
  let gs = { ctm: [1, 0, 0, 1, 0, 0], lineWidth: 1, color: [0, 0, 0], fontSize: 12, fontName: 'Helvetica' }
  let gstack = []
  let path = []
  let cur = null
  let cx = 0
  let cy = 0
  let startX = 0
  let startY = 0
  const shapes = []
  let steps = 0
  const maxSteps = limits.maxSteps || 4_000_000

  const pop = () => stack.pop()
  const popNum = () => {
    const v = pop()
    return typeof v === 'number' ? v : 0
  }

  const moveTo = (x, y) => {
    cur = { start: [x, y], segs: [], closed: false }
    path.push(cur)
    cx = x
    cy = y
    startX = x
    startY = y
  }
  const lineTo = (x, y) => {
    if (!cur) moveTo(x, y)
    else cur.segs.push({ type: 'line', to: [x, y] })
    cx = x
    cy = y
  }
  const curveTo = (c1x, c1y, c2x, c2y, x, y) => {
    if (!cur) moveTo(c1x, c1y)
    cur.segs.push({ type: 'cubic', c1: [c1x, c1y], c2: [c2x, c2y], to: [x, y] })
    cx = x
    cy = y
  }

  const emit = (mode) => {
    if (!path.length) return
    const subs = path.map(sp => ({
      start: applyM(gs.ctm, sp.start[0], sp.start[1]),
      closed: !!sp.closed,
      segs: sp.segs.map(sg => {
        if (sg.type === 'line') return { type: 'line', to: applyM(gs.ctm, sg.to[0], sg.to[1]) }
        return {
          type: 'cubic',
          c1: applyM(gs.ctm, sg.c1[0], sg.c1[1]),
          c2: applyM(gs.ctm, sg.c2[0], sg.c2[1]),
          to: applyM(gs.ctm, sg.to[0], sg.to[1]),
        }
      }),
    }))
    shapes.push({ subs, mode, color: gs.color.slice(), lineWidth: gs.lineWidth })
    path = []
    cur = null
  }

  const SIZE = Math.hypot(gs.ctm[0], gs.ctm[1]) || 1

  const ops = {
    // --- stack / arithmetic -------------------------------------------
    dup: () => stack.push(stack[stack.length - 1]),
    exch: () => {
      const a = pop()
      const b = pop()
      stack.push(a, b)
    },
    pop: () => pop(),
    copy: () => {
      const n = popNum()
      const vals = stack.slice(-n)
      for (const v of vals) stack.push(v)
    },
    index: () => {
      const n = popNum()
      stack.push(stack[stack.length - 1 - n])
    },
    roll: () => {
      const j = popNum()
      const n = popNum()
      if (n <= 1) return
      const seg = stack.splice(stack.length - n, n)
      const k = ((j % n) + n) % n
      stack.push(...seg.slice(n - k), ...seg.slice(0, n - k))
    },
    clear: () => {
      stack = []
    },
    count: () => stack.push(stack.length),
    add: () => stack.push(popNum() + popNum()),
    sub: () => {
      const b = popNum()
      const a = popNum()
      stack.push(a - b)
    },
    mul: () => stack.push(popNum() * popNum()),
    div: () => {
      const b = popNum()
      const a = popNum()
      stack.push(b === 0 ? 0 : a / b)
    },
    idiv: () => {
      const b = popNum()
      const a = popNum()
      stack.push(b === 0 ? 0 : Math.trunc(a / b))
    },
    mod: () => {
      const b = popNum()
      const a = popNum()
      stack.push(b === 0 ? 0 : a % b)
    },
    neg: () => stack.push(-popNum()),
    abs: () => stack.push(Math.abs(popNum())),
    sqrt: () => stack.push(Math.sqrt(Math.max(0, popNum()))),
    sin: () => stack.push(Math.sin((popNum() * Math.PI) / 180)),
    cos: () => stack.push(Math.cos((popNum() * Math.PI) / 180)),
    atan: () => {
      const b = popNum()
      const a = popNum()
      stack.push((Math.atan2(a, b) * 180) / Math.PI)
    },
    floor: () => stack.push(Math.floor(popNum())),
    ceiling: () => stack.push(Math.ceil(popNum())),
    round: () => stack.push(Math.round(popNum())),
    truncate: () => stack.push(Math.trunc(popNum())),
    min: () => stack.push(Math.min(popNum(), popNum())),
    max: () => stack.push(Math.max(popNum(), popNum())),
    eq: () => {
      const b = pop()
      const a = pop()
      stack.push(a === b)
    },
    ne: () => {
      const b = pop()
      const a = pop()
      stack.push(a !== b)
    },
    lt: () => {
      const b = popNum()
      const a = popNum()
      stack.push(a < b)
    },
    gt: () => {
      const b = popNum()
      const a = popNum()
      stack.push(a > b)
    },
    le: () => {
      const b = popNum()
      const a = popNum()
      stack.push(a <= b)
    },
    ge: () => {
      const b = popNum()
      const a = popNum()
      stack.push(a >= b)
    },
    and: () => {
      const b = pop()
      const a = pop()
      stack.push(a && b)
    },
    or: () => {
      const b = pop()
      const a = pop()
      stack.push(a || b)
    },
    not: () => stack.push(!pop()),

    // --- dictionary / control -----------------------------------------
    def: () => {
      const v = pop()
      const k = pop()
      if (typeof k === 'string') dict.set(k, v)
    },
    bind: () => {},
    load: () => {
      const k = pop()
      if (typeof k === 'string' && dict.has(k)) stack.push(dict.get(k))
    },
    where: () => {
      pop()
      stack.push(false)
    },
    known: () => {
      const k = pop()
      stack.push(typeof k === 'string' && dict.has(k))
    },
    begin: () => {},
    end: () => {},
    dict: () => {
      pop()
      stack.push({ __dict: true })
    },
    currentdict: () => stack.push({ __dict: true }),
    error: () => {},
    stop: () => {
      throw new Error('__stop__')
    },
    exec: () => {
      const p = pop()
      if (Array.isArray(p)) runSeq(p)
    },
    if: () => {
      const p = pop()
      const b = pop()
      if (b && Array.isArray(p)) runSeq(p)
    },
    ifelse: () => {
      const p2 = pop()
      const p1 = pop()
      const b = pop()
      runSeq(b ? p1 : p2)
    },
    repeat: () => {
      const p = pop()
      const n = popNum()
      if (Array.isArray(p)) for (let r = 0; r < Math.min(100000, n); r++) runSeq(p)
    },
    for: () => {
      const p = pop()
      const limit = popNum()
      const inc = popNum()
      let from = popNum()
      if (!Array.isArray(p) || inc === 0) return
      let guard = 0
      if (inc > 0) for (; from <= limit + 1e-9 && guard++ < 100000; from += inc) {
        stack.push(from)
        runSeq(p)
      }
      else for (; from >= limit - 1e-9 && guard++ < 100000; from += inc) {
        stack.push(from)
        runSeq(p)
      }
    },
    forall: () => {
      const p = pop()
      const arr = pop()
      if (Array.isArray(p) && Array.isArray(arr)) {
        for (const item of arr) {
          stack.push(item)
          runSeq(p)
        }
      }
    },

    // --- graphics state ----------------------------------------------
    gsave: () => gstack.push({ ...gs, ctm: gs.ctm.slice() }),
    grestore: () => {
      const s = gstack.pop()
      if (s) gs = s
    },
    translate: () => {
      const ty = popNum()
      const tx = popNum()
      gs = { ...gs, ctm: mul(gs.ctm, [1, 0, 0, 1, tx, ty]) }
    },
    scale: () => {
      const sy = popNum()
      const sx = popNum()
      gs = { ...gs, ctm: mul(gs.ctm, [sx, 0, 0, sy, 0, 0]) }
    },
    rotate: () => {
      const a = (popNum() * Math.PI) / 180
      const c = Math.cos(a)
      const s = Math.sin(a)
      gs = { ...gs, ctm: mul(gs.ctm, [c, s, -s, c, 0, 0]) }
    },
    concat: () => {
      const m = pop()
      if (Array.isArray(m) && m.length === 6) gs = { ...gs, ctm: mul(gs.ctm, m) }
    },
    setmatrix: () => {
      pop()
      gs = { ...gs, ctm: [1, 0, 0, 1, 0, 0] }
    },
    matrix: () => stack.push([1, 0, 0, 1, 0, 0]),
    transform: () => {
      const y = popNum()
      const x = popNum()
      const [tx, ty] = applyM(gs.ctm, x, y)
      stack.push(tx, ty)
    },
    itransform: () => {
      const y = popNum()
      const x = popNum()
      stack.push(x, y)
    },
    setlinewidth: () => {
      gs = { ...gs, lineWidth: popNum() }
    },
    setlinejoin: () => pop(),
    setlinecap: () => pop(),
    setmiterlimit: () => pop(),
    setdash: () => {
      pop()
      pop()
    },
    setrgbcolor: () => {
      const b = popNum()
      const g = popNum()
      const r = popNum()
      gs = { ...gs, color: [r, g, b] }
    },
    setgray: () => {
      const v = popNum()
      gs = { ...gs, color: [v, v, v] }
    },
    setcmykcolor: () => {
      const k = popNum()
      const y = popNum()
      const m = popNum()
      const c = popNum()
      gs = { ...gs, color: [(1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)] }
    },
    sethsbcolor: () => {
      const b = popNum()
      const s = popNum()
      const h = popNum()
      // convert HSB to RGB
      const i = Math.floor(h * 6)
      const f = h * 6 - i
      const p = b * (1 - s)
      const q = b * (1 - f * s)
      const t = b * (1 - (1 - f) * s)
      const table = [[b, t, p], [q, b, p], [p, b, t], [p, q, b], [t, p, b], [b, p, q]]
      gs = { ...gs, color: table[((i % 6) + 6) % 6] }
    },

    // --- path construction -------------------------------------------
    newpath: () => {
      path = []
      cur = null
    },
    moveto: () => {
      const y = popNum()
      const x = popNum()
      moveTo(x, y)
    },
    lineto: () => {
      const y = popNum()
      const x = popNum()
      lineTo(x, y)
    },
    rmoveto: () => {
      const dy = popNum()
      const dx = popNum()
      moveTo(cx + dx, cy + dy)
    },
    rlineto: () => {
      const dy = popNum()
      const dx = popNum()
      lineTo(cx + dx, cy + dy)
    },
    curveto: () => {
      const y3 = popNum()
      const x3 = popNum()
      const y2 = popNum()
      const x2 = popNum()
      const y1 = popNum()
      const x1 = popNum()
      curveTo(x1, y1, x2, y2, x3, y3)
    },
    rcurveto: () => {
      const y3 = popNum()
      const x3 = popNum()
      const y2 = popNum()
      const x2 = popNum()
      const y1 = popNum()
      const x1 = popNum()
      curveTo(cx + x1, cy + y1, cx + x2, cy + y2, cx + x3, cy + y3)
    },
    closepath: () => {
      if (cur) {
        cur.closed = true
        cur.segs.push({ type: 'line', to: cur.start.slice() })
        cx = cur.start[0]
        cy = cur.start[1]
      }
    },
    rectclip: () => {
      pop()
      pop()
      pop()
      pop()
    },
    clip: () => {},

    // --- painting -----------------------------------------------------
    stroke: () => emit('stroke'),
    fill: () => emit('fill'),
    eofill: () => emit('fill'),
    fillstroke: () => emit('both'),
    rectfill: () => {
      const h = popNum()
      const w = popNum()
      const y = popNum()
      const x = popNum()
      moveTo(x, y)
      lineTo(x + w, y)
      lineTo(x + w, y + h)
      lineTo(x, y + h)
      cur.closed = true
      emit('fill')
    },
    rectstroke: () => {
      const h = popNum()
      const w = popNum()
      const y = popNum()
      const x = popNum()
      moveTo(x, y)
      lineTo(x + w, y)
      lineTo(x + w, y + h)
      lineTo(x, y + h)
      cur.closed = true
      emit('stroke')
    },
    arc: () => {
      const a2 = popNum()
      const a1 = popNum()
      const r = popNum()
      const y = popNum()
      const x = popNum()
      const steps = 32
      const dir = a2 >= a1 ? 1 : -1
      const span = Math.abs(a2 - a1)
      for (let k = 0; k <= steps; k++) {
        const a = ((a1 + (dir * span * k) / steps) * Math.PI) / 180
        lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
      }
    },
    arcn: () => {
      const a2 = popNum()
      const a1 = popNum()
      const r = popNum()
      const y = popNum()
      const x = popNum()
      const steps = 32
      const span = Math.abs(a2 - a1)
      for (let k = 0; k <= steps; k++) {
        const a = ((a1 - (span * k) / steps) * Math.PI) / 180
        lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
      }
    },

    // --- text ---------------------------------------------------------
    findfont: () => {
      const name = pop()
      stack.push({ __font: String(name) })
    },
    scalefont: () => {
      const size = popNum()
      const f = pop()
      stack.push({ __font: (f && f.__font) || 'Helvetica', size })
    },
    setfont: () => {
      const f = pop()
      if (f && f.__font) gs = { ...gs, fontSize: (f.size || 12), fontName: f.__font }
    },
    show: () => {
      const s = pop()
      if (typeof s !== 'string' || !s) return
      const [px, py] = applyM(gs.ctm, cx, cy)
      const size = gs.fontSize * SIZE
      const fo = fontFromPS(gs.fontName)
      const w = measureText(s, size, fo)
      shapes.push({
        type: 'text',
        x: px,
        y: py - size,
        width: Math.max(4, w),
        height: size * 1.2,
        text: s,
        fontSize: size,
        fontFamily: fo.fontFamily,
        bold: fo.bold,
        italic: fo.italic,
        fill: { type: 'solid', color: rgbHexOf(gs.color) },
        stroke: { width: 0 },
        __ps: true,
      })
      cx += w / SIZE
    },
    ashow: () => {
      const s = pop()
      popNum()
      const [px, py] = applyM(gs.ctm, cx, cy)
      const size = gs.fontSize * SIZE
      const fo = fontFromPS(gs.fontName)
      const w = measureText(s, size, fo)
      shapes.push({
        type: 'text', x: px, y: py - size, width: Math.max(4, w), height: size * 1.2,
        text: s, fontSize: size, fontFamily: fo.fontFamily, bold: fo.bold, italic: fo.italic,
        fill: { type: 'solid', color: rgbHexOf(gs.color) }, stroke: { width: 0 }, __ps: true,
      })
      cx += w / SIZE
    },
  }

  function rgbHexOf(c) {
    const h = (v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0')
    return `#${h(c[0])}${h(c[1])}${h(c[2])}`
  }

  function runSeq(seq) {
    for (const tk of seq) {
      if (++steps > maxSteps) throw new Error('__stop__')
      execToken(tk)
    }
  }

  function execToken(tk) {
    if (tk.t === 'num') {
      stack.push(tk.v)
      return
    }
    if (tk.t === 'str') {
      stack.push(tk.v)
      return
    }
    if (tk.t === 'proc') {
      stack.push(tk.v)
      return
    }
    if (tk.t === 'lit') {
      stack.push(tk.v)
      return
    }
    if (tk.t === 'name') {
      const user = dict.get(tk.v)
      if (Array.isArray(user)) {
        runSeq(user)
        return
      }
      if (user && typeof user === 'object' && user.__value !== undefined) {
        stack.push(user.__value)
        return
      }
      const op = ops[tk.v]
      if (op) op()
      // Unknown operator: ignored. A partial interpreter must not guess.
    }
  }

  try {
    runSeq(tokens)
  } catch (err) {
    if (!/__stop__/.test(String(err && err.message))) throw err
  }

  return shapes
}

/* --------------------------- conversion ---------------------------- */

function subpathsToDocRings(subs, H) {
  const rings = []
  for (const sp of subs) {
    const pts = [sp.start.slice()]
    let cx = sp.start[0]
    let cy = sp.start[1]
    for (const sg of sp.segs) {
      if (sg.type === 'line') {
        pts.push(sg.to.slice())
      } else {
        const steps = 10
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
    if (pts.length > 1) rings.push(pts.map(([x, y]) => [x, H - y]))
  }
  return rings
}

/**
 * Import PostScript / EPS / AI source into document objects, fitted to the
 * supplied page.
 */
export function importPostScriptText(text, page) {
  const bb = parseBoundingBox(text) || { x0: 0, y0: 0, x1: page.width, y1: page.height, width: page.width, height: page.height }
  const H = bb.y1
  const shapes = interpretPostScript(text)

  const scale = Math.min(page.width / bb.width, page.height / bb.height) * 0.95
  const offX = (page.width - bb.width * scale) / 2 - bb.x0 * scale
  const offY = (page.height - bb.height * scale) / 2

  const objects = []
  for (const s of shapes) {
    if (s.type === 'text') {
      objects.push({
        ...s,
        x: s.x * scale + offX,
        y: s.y * scale + offY,
        width: Math.max(0.01, s.width * scale),
        height: Math.max(0.01, s.height * scale),
        fontSize: Math.max(2, s.fontSize * scale),
      })
      continue
    }
    const rings = subpathsToDocRings(s.subs, H)
    if (!rings.length) continue
    const allPts = rings.flat()
    if (!allPts.length) continue
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

    // Geometry is already in doc space (flipped). Map it onto the page.
    const px = minX * scale + offX
    const py = minY * scale + offY
    const w = Math.max((maxX - minX) * scale, 0.01)
    const h = Math.max((maxY - minY) * scale, 0.01)

    const fill = s.mode === 'stroke' ? { type: 'none' } : { type: 'solid', color: rgbHexOf(s.color) }
    const stroke = (s.mode === 'stroke' || s.mode === 'both')
      ? { color: rgbHexOf(s.color), width: Math.max(0.1, s.lineWidth * scale), style: 'solid' }
      : { width: 0 }

    objects.push({
      type: 'path',
      name: 'Imported PostScript path',
      pathWidth: Math.max(maxX - minX, 0.01),
      pathHeight: Math.max(maxY - minY, 0.01),
      x: px,
      y: py,
      width: w,
      height: h,
      pathData: rings
        .map(r => r.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${(x - minX).toFixed(3)},${(y - minY).toFixed(3)}`).join(' ') + ' Z')
        .join(' '),
      rings: [rings],
      fill,
      stroke,
      opacity: 100,
    })
  }
  return objects
}

function rgbHexOf(c) {
  const h = (v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0')
  return `#${h(c[0])}${h(c[1])}${h(c[2])}`
}
