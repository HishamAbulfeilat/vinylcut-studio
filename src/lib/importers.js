/* ------------------------------------------------------------------ *
 * Importers: turn real files into document objects.
 *
 *   Raster  : PNG / JPEG / GIF / BMP / WEBP  -> image object (dataURL)
 *   SVG     : real path extraction (rect/circle/ellipse/line/polyline/
 *             polygon/path) with translate/scale/rotate/matrix support
 *   PDF     : real PDF reader (objects, FlateDecode, content-stream
 *             operators, text) - see lib/pdf.js
 *   EPS/AI  : real PostScript interpreter for the drawing subset - see
 *             lib/postscript.js. PDF-compatible .ai files go to the PDF
 *             reader instead.
 *   DXF     : R12 ASCII (LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, TEXT)
 *   HPGL    : PLT (PU/PD/PA) -> path objects
 * ------------------------------------------------------------------ */

import { multiPolygonToShape, parsePathData } from './geometry'
import { importPdfBytes, isPdfBytes } from './pdf'
import { importPostScriptText } from './postscript'

export function readArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(new Uint8Array(r.result))
    r.onerror = () => reject(new Error('read failed'))
    r.readAsArrayBuffer(file)
  })
}

export const IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'avif']

export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('read failed'))
    r.readAsText(file)
  })
}

export function readDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('read failed'))
    r.readAsDataURL(file)
  })
}

export function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image decode failed'))
    img.src = src
  })
}

export function extOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || '')
  return m ? m[1].toLowerCase() : ''
}

/* ------------------------------ raster ----------------------------- */

export async function importRaster(file, page) {
  const src = await readDataUrl(file)
  const img = await loadImageElement(src)
  const maxW = Math.min(page.width * 0.9, 200)
  const ratio = img.naturalHeight / img.naturalWidth
  const w = Math.min(maxW, img.naturalWidth)
  return [{
    type: 'image',
    src,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    x: (page.width - w) / 2,
    y: (page.height - w * ratio) / 2,
    width: w,
    height: w * ratio,
    preserveAspectRatio: 'none',
    fill: { type: 'none' },
    stroke: { width: 0 },
  }]
}

/* -------------------------------- SVG ------------------------------ */

function parseTransform(str) {
  let m = [1, 0, 0, 1, 0, 0]
  if (!str) return m
  const mul = (a, b) => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ]
  const re = /(matrix|translate|scale|rotate)\(([^)]*)\)/g
  let t
  while ((t = re.exec(str))) {
    const v = t[2].split(/[\s,]+/).filter(Boolean).map(Number)
    if (t[1] === 'matrix') m = mul(m, v)
    else if (t[1] === 'translate') m = mul(m, [1, 0, 0, 1, v[0] || 0, v[1] || 0])
    else if (t[1] === 'scale') m = mul(m, [v[0] == null ? 1 : v[0], 0, 0, v[1] == null ? (v[0] == null ? 1 : v[0]) : v[1], 0, 0])
    else if (t[1] === 'rotate') {
      const a = ((v[0] || 0) * Math.PI) / 180
      const cx = v[1] || 0
      const cy = v[2] || 0
      m = mul(m, [1, 0, 0, 1, cx, cy])
      m = mul(m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0])
      m = mul(m, [1, 0, 0, 1, -cx, -cy])
    }
  }
  return m
}

const applyM = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

function bboxOfPoints(pts) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, width: 1, height: 1 }
  return { minX, minY, width: Math.max(maxX - minX, 0.01), height: Math.max(maxY - minY, 0.01) }
}

function elementToPath(el, matrix) {
  const num = (a, d = 0) => {
    const v = parseFloat(el.getAttribute(a))
    return Number.isFinite(v) ? v : d
  }
  switch (el.tagName.toLowerCase()) {
    case 'rect': {
      const x = num('x')
      const y = num('y')
      const w = num('width')
      const h = num('height')
      const p = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) => applyM(matrix, px, py))
      return p
    }
    case 'circle': {
      const cx = num('cx')
      const cy = num('cy')
      const r = num('r')
      const p = []
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2
        p.push(applyM(matrix, cx + Math.cos(a) * r, cy + Math.sin(a) * r))
      }
      return p
    }
    case 'ellipse': {
      const cx = num('cx')
      const cy = num('cy')
      const rx = num('rx')
      const ry = num('ry')
      const p = []
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2
        p.push(applyM(matrix, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry))
      }
      return p
    }
    case 'line':
      return [applyM(matrix, num('x1'), num('y1')), applyM(matrix, num('x2'), num('y2'))]
    case 'polyline':
    case 'polygon': {
      const raw = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number).filter(n => Number.isFinite(n))
      const p = []
      for (let i = 0; i + 1 < raw.length; i += 2) p.push(applyM(matrix, raw[i], raw[i + 1]))
      return p
    }
    case 'path': {
      const subpaths = parsePathData(el.getAttribute('d') || '')
      const all = []
      for (const sp of subpaths) for (const pt of sp) all.push(applyM(matrix, pt[0], pt[1]))
      return all
    }
    default:
      return null
  }
}

function styleOf(el) {
  const fillAttr = el.getAttribute('fill')
  const strokeAttr = el.getAttribute('stroke')
  const sw = parseFloat(el.getAttribute('stroke-width'))
  const styleAttr = el.getAttribute('style') || ''
  const pick = (name) => {
    const m = new RegExp(`${name}\\s*:\\s*([^;]+)`).exec(styleAttr)
    return m ? m[1].trim() : null
  }
  const fill = fillAttr || pick('fill') || '#000000'
  const stroke = strokeAttr || pick('stroke')
  const strokeWidth = Number.isFinite(sw) ? sw : parseFloat(pick('stroke-width')) || 0
  const opacity = parseFloat(el.getAttribute('opacity') || pick('opacity'))
  return {
    fill: fill === 'none' ? { type: 'none' } : { type: 'solid', color: fill },
    stroke: stroke && stroke !== 'none' ? { color: stroke, width: strokeWidth || 1, style: 'solid' } : { width: 0 },
    opacity: Number.isFinite(opacity) ? Math.round(opacity * 100) : 100,
  }
}

export async function importSvg(file, page) {
  const text = await readTextFile(file)
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const svg = doc.querySelector('svg')
  if (!svg) throw new Error('Not an SVG document')

  const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
  const wAttr = parseFloat(svg.getAttribute('width'))
  const hAttr = parseFloat(svg.getAttribute('height'))
  let vbX = 0
  let vbY = 0
  let vbW = Number.isFinite(vb[2]) ? vb[2] : (Number.isFinite(wAttr) ? wAttr : 300)
  let vbH = Number.isFinite(vb[3]) ? vb[3] : (Number.isFinite(hAttr) ? hAttr : 300)
  if (Number.isFinite(vb[0])) vbX = vb[0]
  if (Number.isFinite(vb[1])) vbY = vb[1]

  // Fit the viewBox into the page
  const scale = Math.min(page.width / vbW, page.height / vbH) * 0.9
  const offX = (page.width - vbW * scale) / 2
  const offY = (page.height - vbH * scale) / 2
  const root = [scale, 0, 0, scale, offX - vbX * scale, offY - vbY * scale]

  const objects = []
  const walk = (el, matrix) => {
    const tag = el.tagName.toLowerCase()
    const local = parseTransform(el.getAttribute('transform'))
    const m = [
      matrix[0] * local[0] + matrix[2] * local[1],
      matrix[1] * local[0] + matrix[3] * local[1],
      matrix[0] * local[2] + matrix[2] * local[3],
      matrix[1] * local[2] + matrix[3] * local[3],
      matrix[0] * local[4] + matrix[2] * local[5] + matrix[4],
      matrix[1] * local[4] + matrix[3] * local[5] + matrix[5],
    ]
    if (tag === 'g' || tag === 'svg') {
      for (const child of Array.from(el.children)) walk(child, m)
      return
    }
    if (tag === 'defs' || tag === 'title' || tag === 'desc' || tag === 'metadata') return
    if (tag === 'image') {
      const href = el.getAttribute('href') || el.getAttribute('xlink:href')
      const x = parseFloat(el.getAttribute('x')) || 0
      const y = parseFloat(el.getAttribute('y')) || 0
      const w = parseFloat(el.getAttribute('width')) || 100
      const h = parseFloat(el.getAttribute('height')) || 100
      const [ax, ay] = applyM(m, x, y)
      const [bx, by] = applyM(m, x + w, y + h)
      if (href) objects.push({ type: 'image', src: href, x: ax, y: ay, width: Math.abs(bx - ax), height: Math.abs(by - ay), fill: { type: 'none' }, stroke: { width: 0 } })
      return
    }
    if (tag === 'text') {
      const [tx, ty] = applyM(m, parseFloat(el.getAttribute('x')) || 0, parseFloat(el.getAttribute('y')) || 0)
      const size = parseFloat(el.getAttribute('font-size')) || 16
      const st = styleOf(el)
      objects.push({
        type: 'text',
        x: tx,
        y: ty - size,
        width: Math.max(20, (el.textContent || '').length * size * 0.6),
        height: size * 1.3,
        text: el.textContent || '',
        fontSize: size,
        fontFamily: el.getAttribute('font-family') || 'Arial',
        fill: { type: 'solid', color: (st.fill.color) || '#000000' },
        stroke: { width: 0 },
      })
      return
    }

    const pts = elementToPath(el, m)
    if (pts && pts.length > 1) {
      const st = styleOf(el)
      const b = bboxOfPoints(pts)
      const rel = pts.map(([x, y]) => [x - b.minX, y - b.minY])
      const d = rel.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(3)},${y.toFixed(3)}`).join(' ')
      objects.push({
        type: 'path',
        pathData: `${d} Z`,
        pathWidth: b.width,
        pathHeight: b.height,
        x: b.minX,
        y: b.minY,
        width: b.width,
        height: b.height,
        rings: [[pts]],
        fill: st.fill,
        stroke: st.stroke,
        opacity: st.opacity,
      })
    }
    for (const child of Array.from(el.children)) walk(child, m)
  }

  walk(svg, root)
  return objects
}

/* -------------------------------- DXF ------------------------------ */

export async function importDxf(file, page) {
  const text = await readTextFile(file)
  const lines = text.split(/\r?\n/).map(l => l.trim())
  const raw = []
  let i = 0
  let entity = null
  const pair = () => [lines[i], lines[i + 1]]

  while (i < lines.length - 1) {
    const [code, value] = pair()
    if (code === '0') {
      if (entity) raw.push(...dxfEntityToRaw(entity))
      entity = value === 'SECTION' || value === 'ENDSEC' || value === 'EOF' ? null : { type: value, pairs: [] }
      i += 2
      continue
    }
    if (entity) entity.pairs.push([code, value])
    i += 2
  }
  if (entity) raw.push(...dxfEntityToRaw(entity))
  if (!raw.length) return []

  // DXF is Y-up CAD space; the document is Y-down. Fit the whole drawing
  // into the page so both our own files and third-party files land sensibly.
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const note = (x, y) => {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  for (const r of raw) {
    if (r.kind === 'text') {
      // Include the estimated advance width so wide labels stay on the page.
      note(r.x, r.y)
      note(r.x + String(r.text || '').length * r.size * 0.55, r.y)
    } else {
      for (const [x, y] of r.pts) note(x, y)
    }
  }
  if (!isFinite(minX)) return []
  const w = Math.max(maxX - minX, 0.01)
  const h = Math.max(maxY - minY, 0.01)
  const fit = Math.min(page.width / w, page.height / h) * 0.92
  const mapX = (x) => (x - minX) * fit + (page.width - w * fit) / 2
  const mapY = (y) => (maxY - y) * fit + (page.height - h * fit) / 2

  const objects = []
  for (const r of raw) {
    if (r.kind === 'text') {
      const size = Math.max(1, r.size * fit)
      objects.push({
        type: 'text',
        x: mapX(r.x),
        y: mapY(r.y) - size,
        width: Math.max(4, String(r.text).length * size * 0.55),
        height: size * 1.3,
        text: r.text,
        fontSize: size,
        fontFamily: 'Arial',
        align: r.hjust === 1 ? 'center' : r.hjust === 2 ? 'right' : 'left',
        rotation: r.rot || 0,
        fill: { type: 'solid', color: r.color || '#000000' },
        stroke: { width: 0 },
        opacity: 100,
      })
      continue
    }
    const pts = r.pts.map(([x, y]) => [mapX(x), mapY(y)])
    if (pts.length < 2) continue
    let pMinX = Infinity
    let pMinY = Infinity
    let pMaxX = -Infinity
    let pMaxY = -Infinity
    for (const [x, y] of pts) {
      pMinX = Math.min(pMinX, x)
      pMinY = Math.min(pMinY, y)
      pMaxX = Math.max(pMaxX, x)
      pMaxY = Math.max(pMaxY, y)
    }
    const pw = Math.max(pMaxX - pMinX, 0.01)
    const ph = Math.max(pMaxY - pMinY, 0.01)
    const d = pts.map(([x, y], k) => `${k === 0 ? 'M' : 'L'}${(x - pMinX).toFixed(3)},${(y - pMinY).toFixed(3)}`).join(' ')
    objects.push({
      type: 'path',
      pathData: r.closed ? `${d} Z` : d,
      pathWidth: pw,
      pathHeight: ph,
      x: pMinX,
      y: pMinY,
      width: pw,
      height: ph,
      rings: [[pts]],
      fill: r.closed && r.fill ? { type: 'solid', color: r.color || '#000000' } : { type: 'none' },
      stroke: { color: r.color || '#000000', width: r.closed && r.fill ? 0 : 1, style: 'solid' },
      opacity: 100,
    })
  }
  return objects
}

function dxfEntityToRaw(entity) {
  const get = (code) => {
    const p = entity.pairs.find(([c]) => c === String(code))
    return p ? parseFloat(p[1]) : NaN
  }
  const str = (code) => {
    const p = entity.pairs.find(([c]) => c === String(code))
    return p ? p[1] : ''
  }
  const all = (code) => entity.pairs.filter(([c]) => c === String(code)).map(p => parseFloat(p[1]))
  const ptsFrom = (xs, ys) => xs.map((x, i) => [x, Number.isFinite(ys[i]) ? ys[i] : ys[0]])
  const colorOf = () => {
    const c = get(420)
    if (Number.isFinite(c)) {
      const n = Math.round(c)
      return `#${((n >> 16) & 255).toString(16).padStart(2, '0')}${((n >> 8) & 255).toString(16).padStart(2, '0')}${(n & 255).toString(16).padStart(2, '0')}`
    }
    return '#000000'
  }

  const t = (entity.type || '').toUpperCase()
  if (t === 'TEXT' || t === 'MTEXT') {
    const size = get(40)
    return [{
      kind: 'text',
      x: get(10),
      y: get(20),
      size: Number.isFinite(size) ? size : 10,
      text: str(1),
      hjust: Number.isFinite(get(72)) ? get(72) : 0,
      rot: Number.isFinite(get(50)) ? get(50) : 0,
      color: colorOf(),
    }]
  }
  if (t === 'LWPOLYLINE' || t === 'POLYLINE') {
    const flags = get(70)
    return [{ kind: 'poly', pts: ptsFrom(all(10), all(20)), closed: ((flags | 0) & 1) === 1, fill: true, color: colorOf() }]
  }
  if (t === 'SOLID' || t === 'TRACE' || t === '3DFACE') {
    const xs = [get(10), get(11), get(13), get(12)].filter(Number.isFinite)
    const ys = [get(20), get(21), get(23), get(22)].filter(Number.isFinite)
    return [{ kind: 'poly', pts: ptsFrom(xs, ys), closed: true, fill: true, color: colorOf() }]
  }
  if (t === 'LINE') {
    return [{ kind: 'poly', pts: [[get(10), get(20)], [get(11), get(21)]], closed: false, fill: false, color: colorOf() }]
  }
  if (t === 'CIRCLE' || t === 'ARC') {
    const cx = get(10)
    const cy = get(20)
    const r = get(40)
    const a0 = t === 'ARC' ? (get(50) * Math.PI) / 180 : 0
    const a1 = t === 'ARC' ? (get(51) * Math.PI) / 180 : Math.PI * 2
    const span = a1 > a0 ? a1 - a0 : a1 + Math.PI * 2 - a0
    const n = 64
    const pts = []
    for (let k = 0; k <= n; k++) {
      const a = a0 + (span * k) / n
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
    }
    return [{ kind: 'poly', pts, closed: t === 'CIRCLE', fill: t === 'CIRCLE', color: colorOf() }]
  }
  return []
}

/* ------------------------------- HPGL ------------------------------ */

export async function importHpgl(file, page) {
  const text = await readTextFile(file)
  // One tokenizer for the whole dialect: two-letter command, arguments up to
  // ';' - or up to the ET (0x03) terminator for LB labels, which is how
  // plotters terminate text.
  const token = /([A-Z]{2})([^;\x03\x1b]*)([\x03\x1b])?/gi
  const NUM = /-?\d+(?:\.\d+)?/g
  let penX = 0
  let penY = 0
  let penDown = false
  let labelMm = 5
  const rings = []
  const labels = []
  let current = []
  let m

  while ((m = token.exec(text)) !== null) {
    const cmd = m[1].toUpperCase()
    const body = m[2] || ''
    const nums = (body.match(NUM) || []).map(Number)
    if (cmd === 'PU') {
      const pairs = []
      for (let i = 0; i + 1 < nums.length; i += 2) pairs.push([nums[i], nums[i + 1]])
      if (penDown && current.length > 1) rings.push(current)
      current = []
      penDown = false
      if (pairs.length) [penX, penY] = pairs[pairs.length - 1]
    } else if (cmd === 'PD') {
      const pairs = []
      for (let i = 0; i + 1 < nums.length; i += 2) pairs.push([nums[i], nums[i + 1]])
      if (pairs.length) {
        if (!penDown && !current.length) current.push([penX, penY])
        penDown = true
        for (const [x, y] of pairs) current.push([x, y])
        const last = pairs[pairs.length - 1]
        penX = last[0]
        penY = last[1]
      }
    } else if (cmd === 'PA') {
      const pairs = []
      for (let i = 0; i + 1 < nums.length; i += 2) pairs.push([nums[i], nums[i + 1]])
      if (pairs.length) [penX, penY] = pairs[pairs.length - 1]
    } else if (cmd === 'SI') {
      // Label box size, in centimetres.
      if (nums.length >= 2 && nums[1] > 0) labelMm = nums[1] * 10
      else if (nums.length === 1 && nums[0] > 0) labelMm = nums[0] * 10
    } else if (cmd === 'LB') {
      // Label text runs to the ET terminator; the tokenizer already stripped it.
      const label = body.trim()
      if (label) labels.push({ text: label, x: penX, y: penY, mm: labelMm })
    }
  }
  if (current.length > 1) rings.push(current)

  // Fit the whole job - geometry *and* labels - once, flipping Y because HPGL
  // plots in a Y-up space. Fitting each ring on its own would stack every
  // part on top of the others.
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const note = (x, y) => {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  for (const ring of rings) for (const [x, y] of ring) note(x, y)
  for (const l of labels) {
    // A label occupies its advance width and its cap height; fold both into
    // the fit so wide text does not run off the page.
    const sizeUnits = l.mm * 40
    note(l.x, l.y)
    note(l.x + l.text.length * sizeUnits * 0.6, l.y)
    note(l.x, l.y + sizeUnits)
  }

  const objects = []
  if (!isFinite(minX)) return objects
  const w = Math.max(maxX - minX, 1)
  const h = Math.max(maxY - minY, 1)
  const fit = Math.min((page.width * 0.9) / w, (page.height * 0.9) / h)
  const ox = (page.width - w * fit) / 2
  const oy = (page.height - h * fit) / 2
  const mapX = (x) => (x - minX) * fit + ox
  const mapY = (y) => (maxY - y) * fit + oy

  for (const ring of rings) {
    const scaled = ring.map(([x, y]) => [mapX(x), mapY(y)])
    const shape = multiPolygonToShape([[scaled]], { fill: { type: 'none' }, stroke: { color: '#000000', width: 1, style: 'solid' } })
    if (shape) objects.push(shape)
  }
  for (const l of labels) {
    // HPGL plotter units are 1/40 mm, so the label size scales with the fit.
    const size = Math.max(2, l.mm * 40 * fit)
    objects.push({
      type: 'text',
      x: mapX(l.x),
      y: mapY(l.y) - size,
      width: Math.max(8, l.text.length * size * 0.6),
      height: size * 1.3,
      text: l.text,
      fontSize: size,
      fontFamily: 'Arial',
      align: 'left',
      fill: { type: 'solid', color: '#000000' },
      stroke: { width: 0 },
      opacity: 100,
    })
  }
  return objects
}

/* ------------------------------- PDF ------------------------------- */

export async function importPdf(file, page) {
  const bytes = await readArrayBuffer(file)
  return importPdfBytes(bytes, page)
}

/* --------------------------- EPS / AI / PS ------------------------- */

export async function importPostScript(file, page) {
  const bytes = await readArrayBuffer(file)
  // Modern .ai files are PDF under the hood; only treat them as PostScript
  // when they actually start with a PostScript header.
  if (isPdfBytes(bytes)) return importPdfBytes(bytes, page)
  const text = await readTextFile(file)
  return importPostScriptText(text, page)
}

/* --------------------------- entry point --------------------------- */

export async function importFile(file, page) {
  const ext = extOf(file.name)
  if (IMAGE_TYPES.includes(ext)) return { objects: await importRaster(file, page), kind: 'image' }
  if (ext === 'svg') return { objects: await importSvg(file, page), kind: 'vector' }
  if (ext === 'dxf') return { objects: await importDxf(file, page), kind: 'vector' }
  if (ext === 'plt' || ext === 'hpgl' || ext === 'hgl') return { objects: await importHpgl(file, page), kind: 'vector' }
  if (ext === 'pdf') return { objects: await importPdf(file, page), kind: 'vector' }
  if (ext === 'ai' || ext === 'eps' || ext === 'ps') return { objects: await importPostScript(file, page), kind: 'vector' }
  if (ext === 'json' || ext === 'vcs') {
    const text = await readTextFile(file)
    return { document: JSON.parse(text) }
  }

  // Unknown extension: sniff the bytes rather than refusing outright.
  const bytes = await readArrayBuffer(file)
  if (isPdfBytes(bytes)) return { objects: await importPdfBytes(bytes, page), kind: 'vector' }
  const head = String.fromCharCode.apply(null, bytes.subarray(0, 24))
  if (head.startsWith('%!PS')) {
    const text = await readTextFile(file)
    return { objects: importPostScriptText(text, page), kind: 'vector' }
  }
  throw new Error(`Unsupported format: .${ext}`)
}

