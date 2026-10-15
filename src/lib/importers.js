/* ------------------------------------------------------------------ *
 * Importers: turn real files into document objects.
 *
 *   Raster  : PNG / JPEG / GIF / BMP / WEBP  -> image object (dataURL)
 *   SVG     : real path extraction (rect/circle/ellipse/line/polyline/
 *             polygon/path) with translate/scale/rotate/matrix support
 *   DXF     : R12 ASCII (LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC)
 *   HPGL    : PLT (PU/PD/PA) -> path objects
 * ------------------------------------------------------------------ */

import { multiPolygonToShape, parsePathData } from './geometry'

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
  const objects = []
  let i = 0
  let entity = null
  const pair = () => [lines[i], lines[i + 1]]

  while (i < lines.length - 1) {
    const [code, value] = pair()
    if (code === '0') {
      if (entity) objects.push(...dxfEntityToObjects(entity, page))
      entity = value === 'SECTION' || value === 'ENDSEC' || value === 'EOF' ? null : { type: value, pairs: [] }
      i += 2
      continue
    }
    if (entity) entity.pairs.push([code, value])
    i += 2
  }
  if (entity) objects.push(...dxfEntityToObjects(entity, page))
  return objects
}

function dxfEntityToObjects(entity, page) {
  const get = (code) => {
    const p = entity.pairs.find(([c]) => c === String(code))
    return p ? parseFloat(p[1]) : NaN
  }
  const all = (code) => entity.pairs.filter(([c]) => c === String(code)).map(p => parseFloat(p[1]))
  const ptsFrom = (xs, ys) => xs.map((x, i) => [x, Number.isFinite(ys[i]) ? ys[i] : ys[0]])

  const emit = (pts, closed) => {
    if (!pts.length) return []
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const [x, y] of pts) {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
    const w = Math.max(maxX - minX, 0.01)
    const h = Math.max(maxY - minY, 0.01)
    const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${(x - minX).toFixed(3)},${(y - minY).toFixed(3)}`).join(' ')
    return [{
      type: 'path',
      pathData: closed ? `${d} Z` : d,
      pathWidth: w,
      pathHeight: h,
      x: minX,
      y: minY,
      width: w,
      height: h,
      rings: [[pts.map(([x, y]) => [x, y])]],
      fill: { type: 'none' },
      stroke: { color: '#000000', width: 1, style: 'solid' },
    }]
  }

  const t = (entity.type || '').toUpperCase()
  if (t === 'LWPOLYLINE' || t === 'POLYLINE') {
    const xs = all(10)
    const ys = all(20)
    const flags = get(70)
    return emit(ptsFrom(xs, ys), (flags & 1) === 1 || t === 'LWPOLYLINE')
  }
  if (t === 'LINE') {
    return emit([[get(10), get(20)], [get(11), get(21)]], false)
  }
  if (t === 'CIRCLE' || t === 'ARC') {
    const cx = get(10)
    const cy = get(20)
    const r = get(40)
    const a0 = t === 'ARC' ? (get(50) * Math.PI) / 180 : 0
    const a1 = t === 'ARC' ? (get(51) * Math.PI) / 180 : Math.PI * 2
    const span = a1 > a0 ? a1 - a0 : a1 + Math.PI * 2 - a0
    const n = 48
    const pts = []
    for (let k = 0; k <= n; k++) {
      const a = a0 + (span * k) / n
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
    }
    return emit(pts, t === 'CIRCLE')
  }
  return []
}

/* ------------------------------- HPGL ------------------------------ */

export async function importHpgl(file, page) {
  const text = await readTextFile(file)
  const commands = text.match(/[A-Z]{2}[^;]*;?/gi) || []
  let penX = 0
  let penY = 0
  let penDown = false
  const rings = []
  let current = []

  const scale = 1 / 40 // HPGL units are ~1/40 mm
  const inPos = (x, y) => [x * scale, y * scale]

  for (const raw of commands) {
    const cmd = raw.slice(0, 2).toUpperCase()
    const nums = (raw.slice(2).match(/-?\d+/g) || []).map(Number)
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
        if (!penDown && !current.length) current.push(inPos(penX, penY))
        penDown = true
        for (const [x, y] of pairs) current.push(inPos(x, y))
        const last = pairs[pairs.length - 1]
        penX = last[0]
        penY = last[1]
      }
    }
  }
  if (current.length > 1) rings.push(current)

  const objects = []
  for (const ring of rings) {
    const b = ring.reduce(
      (acc, [x, y]) => ({
        minX: Math.min(acc.minX, x),
        minY: Math.min(acc.minY, y),
        maxX: Math.max(acc.maxX, x),
        maxY: Math.max(acc.maxY, y),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    )
    const w = Math.max(b.maxX - b.minX, 0.01)
    const h = Math.max(b.maxY - b.minY, 0.01)
    const fit = Math.min(1, (page.width * 0.9) / w, (page.height * 0.9) / h)
    const scaled = ring.map(([x, y]) => [(x - b.minX) * fit + (page.width - w * fit) / 2, (y - b.minY) * fit + (page.height - h * fit) / 2])
    const mp = [[scaled]]
    const shape = multiPolygonToShape(mp, { fill: { type: 'none' }, stroke: { color: '#000000', width: 1, style: 'solid' } })
    if (shape) objects.push(shape)
  }
  return objects
}

/* --------------------------- entry point --------------------------- */

export async function importFile(file, page) {
  const ext = extOf(file.name)
  if (IMAGE_TYPES.includes(ext)) return { objects: await importRaster(file, page), kind: 'image' }
  if (ext === 'svg') return { objects: await importSvg(file, page), kind: 'vector' }
  if (ext === 'dxf') return { objects: await importDxf(file, page), kind: 'vector' }
  if (ext === 'plt' || ext === 'hpgl' || ext === 'hgl') return { objects: await importHpgl(file, page), kind: 'vector' }
  if (ext === 'json' || ext === 'vcs') {
    const text = await readTextFile(file)
    return { document: JSON.parse(text) }
  }
  throw new Error(`Unsupported format: .${ext} (PDF, AI and EPS need a PostScript parser this build does not ship)`)
}
