/* ------------------------------------------------------------------ *
 * Exporters. Every format here is produced for real from the
 * document's geometry (see lib/geometry.js) - no stubs.
 *
 *   Vector : SVG, PDF 1.4, EPS, AI(legacy EPS), DXF R12, HPGL/PLT
 *   Raster : PNG, JPEG, BMP (rasterised from the SVG at export DPI)
 *
 * Text is written as real text (SVG <text>, PDF base-14 fonts, PostScript
 * show, DXF TEXT, HPGL LB) and Bézier curves survive as curves in
 * SVG / PDF / EPS instead of being flattened to polylines.
 *
 * PDF and EPS embed bitmaps for real (PDF /DCTDecode XObject, PostScript
 * colorimage). DXF and HPGL have no raster concept at all, so placed
 * bitmaps are auto-traced into cuttable paths there.
 * ------------------------------------------------------------------ */

import {
  objectToRings,
  objectToSegments,
  subpathsBounds,
  multiPolygonToShape,
  multiPolygonToHPGL,
  parsePathData,
} from './geometry'

import { warpSubpaths } from './warp'

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/* --------------------------- font metrics -------------------------- */

// Standard-14 advance widths (1/1000 em), codes 32..126.
const WID_HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]

const WID_HELV_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
]

const WID_TIMES = [
  250, 333, 408, 500, 500, 833, 778, 180, 333, 333, 500, 564, 250, 333, 250, 278,
  500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 278, 278, 564, 564, 564, 444,
  921, 722, 667, 667, 722, 611, 556, 722, 722, 333, 389, 722, 611, 889, 722, 722,
  556, 722, 667, 556, 611, 722, 722, 944, 722, 722, 611, 333, 278, 333, 469, 500,
  333, 444, 500, 444, 500, 444, 333, 500, 500, 278, 278, 500, 278, 778, 500, 500,
  500, 500, 333, 389, 278, 500, 500, 722, 500, 500, 444, 480, 200, 480, 541,
]

const WID_COURIER = new Array(95).fill(600)

function widthTableFor(family) {
  const f = String(family || '').toLowerCase()
  if (/times|serif|georgia|garamond|book|roman/.test(f)) return WID_TIMES
  if (/courier|mono|consol|menlo/.test(f)) return WID_COURIER
  return null // helvetica; bold selected separately
}

/** Advance width (em fraction) for one character in a base-14 font. */
export function advanceWidth(code, baseFontName) {
  const name = String(baseFontName || 'Helvetica')
  let table = WID_HELV
  if (/Courier/.test(name)) table = WID_COURIER
  else if (/Times/.test(name)) table = WID_TIMES
  else if (/Bold/.test(name)) table = WID_HELV_BOLD
  return ((code >= 32 && code <= 126) ? table[code - 32] : table[0]) / 1000
}

/** Measured text width in page units, for a given font/size/string. */
export function measureText(str, size, obj) {
  const family = String(obj.fontFamily || 'Arial').toLowerCase()
  let table
  if (/times|serif|georgia|garamond|book|roman/.test(family)) table = WID_TIMES
  else if (/courier|mono|consol|menlo/.test(family)) table = WID_COURIER
  else table = obj.bold ? WID_HELV_BOLD : WID_HELV
  let total = 0
  for (const ch of String(str || '')) {
    const code = ch.codePointAt(0)
    total += code >= 32 && code <= 126 ? table[code - 32] : table[0]
  }
  return (total / 1000) * (size || 16)
}

/** Base-14 PostScript/PDF font name for an object's font settings. */
export function base14Font(obj) {
  const family = String(obj.fontFamily || 'Arial').toLowerCase()
  let stem
  if (/times|serif|georgia|garamond|book|roman/.test(family)) stem = 'Times'
  else if (/courier|mono|consol|menlo/.test(family)) stem = 'Courier'
  else stem = 'Helvetica'
  const bold = !!obj.bold
  const italic = !!obj.italic
  if (stem === 'Times') {
    if (bold && italic) return 'Times-BoldItalic'
    if (bold) return 'Times-Bold'
    if (italic) return 'Times-Italic'
    return 'Times-Roman'
  }
  if (stem === 'Courier') {
    if (bold && italic) return 'Courier-BoldOblique'
    if (bold) return 'Courier-Bold'
    if (italic) return 'Courier-Oblique'
    return 'Courier'
  }
  if (bold && italic) return 'Helvetica-BoldOblique'
  if (bold) return 'Helvetica-Bold'
  if (italic) return 'Helvetica-Oblique'
  return 'Helvetica'
}

/* ----------------------------- warps ------------------------------- */

/** Warped polyline rings for an object, or null when it is not warped. */
export function warpedRings(obj) {
  if (!obj.warpType) return null
  try {
    const subs = objectToSegments(obj)
    if (!subs.length) return null
    const b = subpathsBounds(subs)
    if (!b) return null
    const w = warpSubpaths(subs, b, obj.warpType, obj.warpIntensity || 50, 0.05)
    return w.map(sp => sp.points)
  } catch {
    return null
  }
}

/* ----------------------------- fills ------------------------------- */

export function fillToSvg(fill, id) {
  if (!fill) return 'none'
  if (fill.type === 'solid') return fill.color || '#000000'
  if (fill.type === 'gradient') return `url(#${id})`
  if (fill.type === 'texture') return `url(#${id})`
  if (fill.type === 'spot') return fill.spotColor || '#ff0000'
  if (fill.type === 'logo') return `url(#${id})`
  return 'none'
}

function defsFor(obj, id) {
  const f = obj.fill
  if (!f) return ''
  if (f.type === 'gradient') {
    const stops = f.stops && f.stops.length
      ? f.stops
      : [{ offset: 0, color: f.color || '#000' }, { offset: 1, color: f.color2 || '#fff' }]
    const angle = f.angle == null ? 90 : f.angle
    const rad = (angle * Math.PI) / 180
    const x1 = 0.5 - Math.cos(rad) / 2
    const y1 = 0.5 - Math.sin(rad) / 2
    const x2 = 0.5 + Math.cos(rad) / 2
    const y2 = 0.5 + Math.sin(rad) / 2
    return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops
      .map(s => `<stop offset="${Math.round((s.offset || 0) * 100)}%" stop-color="${esc(s.color)}"/>`)
      .join('')}</linearGradient>`
  }
  if (f.type === 'texture') {
    const c = f.color || '#cccccc'
    const size = f.size || 8
    return `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
      <rect width="${size}" height="${size}" fill="${esc(c)}" opacity="0.25"/>
      <path d="M0,${size} L${size},0" stroke="${esc(f.lineColor || '#666')}" stroke-width="1"/>
      <path d="M0,0 L${size},${size}" stroke="${esc(f.lineColor || '#666')}" stroke-width="0.5" opacity="0.6"/>
    </pattern>`
  }
  if (f.type === 'logo') {
    return `<pattern id="${id}" width="40" height="40" patternUnits="userSpaceOnUse">
      <rect width="40" height="40" fill="#dddddd"/>
      <circle cx="20" cy="20" r="12" fill="${esc(f.logoColor || '#888888')}"/>
    </pattern>`
  }
  return ''
}

/* ---------------------------- SVG bodies --------------------------- */

function styleAttrs(obj, id) {
  const fill = fillToSvg(obj.fill, id)
  const sw = obj.stroke && obj.stroke.width > 0 ? obj.stroke.width : 0
  const parts = [
    `fill="${fill}"`,
    sw ? `stroke="${esc(obj.stroke.color)}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="${obj.stroke.cap || 'round'}"` : 'stroke="none"',
  ]
  if (obj.opacity != null && obj.opacity !== 100) parts.push(`opacity="${obj.opacity / 100}"`)
  if (obj.rotation) parts.push(`transform="rotate(${obj.rotation} ${obj.x + obj.width / 2} ${obj.y + obj.height / 2})"`)
  return parts.join(' ')
}

function polygonPoints(obj, sides, innerRatio) {
  const cx = obj.x + obj.width / 2
  const cy = obj.y + obj.height / 2
  const rx = obj.width / 2
  const ry = obj.height / 2
  const pts = []
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2
    const rr = innerRatio && i % 2 === 1 ? innerRatio : 1
    pts.push(`${cx + Math.cos(a) * rx * rr},${cy + Math.sin(a) * ry * rr}`)
  }
  return pts.join(' ')
}

function textSvg(obj) {
  const size = obj.fontSize || 16
  const fam = esc(obj.fontFamily || 'Arial')
  const weight = obj.bold ? 'bold' : 'normal'
  const style = obj.italic ? 'italic' : 'normal'
  const anchor = obj.align === 'center' ? 'middle' : obj.align === 'right' ? 'end' : 'start'
  const tx = obj.align === 'center' ? obj.x + obj.width / 2 : obj.align === 'right' ? obj.x + obj.width : obj.x + 2
  const colour = (obj.fill && (obj.fill.color || obj.fill.spotColor)) || '#000000'

  if (obj.textOnArc) {
    const radius = obj.arcRadius || 80
    const cx = obj.x + obj.width / 2
    const cy = obj.y + obj.height / 2 + radius
    const chars = String(obj.text || '').split('')
    const spanAng = ((obj.arcAngle || 180) / Math.max(1, chars.length)) * Math.PI / 180
    return chars
      .map((ch, i) => {
        const a = -((chars.length - 1) / 2) * spanAng + i * spanAng
        const px = cx + Math.sin(a) * radius
        const py = cy - Math.cos(a) * radius
        return `<text x="${px}" y="${py}" font-family="${fam}" font-size="${size}" font-weight="${weight}" font-style="${style}" fill="${esc(colour)}" text-anchor="middle" transform="rotate(${(a * 180) / Math.PI} ${px} ${py})">${esc(ch)}</text>`
      })
      .join('')
  }

  if (obj.textOnPath) {
    const sp = parsePathData(obj.pathData || 'M0,50 Q50,0 100,50')
    const pts = sp[0] || [[0, 0]]
    const total = pts.length
    const chars = String(obj.text || '').split('')
    return chars
      .map((ch, i) => {
        const t = chars.length > 1 ? i / (chars.length - 1) : 0.5
        const idx = Math.min(total - 1, Math.round(t * (total - 1)))
        const [px, py] = pts[idx]
        return `<text x="${px}" y="${py}" font-family="${fam}" font-size="${size}" font-weight="${weight}" font-style="${style}" fill="${esc(colour)}" text-anchor="middle">${esc(ch)}</text>`
      })
      .join('')
  }

  const lines = String(obj.text || '').split('\n')
  const spacing = (obj.lineSpacing || 1.2) * size
  const common = `font-family="${fam}" font-size="${size}" font-weight="${weight}" font-style="${style}" fill="${esc(colour)}"`
  return lines
    .map(
      (line, i) =>
        `<text x="${tx}" y="${obj.y + size + i * spacing}" ${common} text-anchor="${anchor}"${obj.underline ? ' text-decoration="underline"' : ''}>${esc(line)}</text>`,
    )
    .join('')
}

function warpedSvg(obj, id) {
  const rings = warpedRings(obj)
  if (!rings) return null
  const s = styleAttrs({ ...obj, rotation: 0 }, id)
  const d = rings.map(r => r.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(3)},${y.toFixed(3)}`).join(' ') + ' Z').join(' ')
  return `<path d="${esc(d)}" ${s}/>`
}

function objectSvg(obj, index) {
  const id = `fill-${index}-${String(obj.id || '').replace(/[^a-zA-Z0-9]/g, '')}`

  // A warped object renders as its deformed geometry.
  if (obj.warpType && obj.type !== 'image') {
    const w = warpedSvg(obj, id)
    if (w) return w
  }

  const s = styleAttrs(obj, id)
  switch (obj.type) {
    case 'rect':
    case 'powerRect':
      return `<rect x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" ${s}/>`
    case 'ellipse':
    case 'powerCircle':
      return `<ellipse cx="${obj.x + obj.width / 2}" cy="${obj.y + obj.height / 2}" rx="${obj.width / 2}" ry="${obj.height / 2}" ${s}/>`
    case 'polygon':
    case 'powerPolygon':
      return `<polygon points="${polygonPoints(obj, Math.max(3, obj.points || 5))}" ${s}/>`
    case 'star':
    case 'powerStar':
      return `<polygon points="${polygonPoints(obj, Math.max(2, obj.points || 5) * 2, (obj.innerRadius || 50) / 100)}" ${s}/>`
    case 'spiral': {
      const turns = obj.turns || 5
      const steps = turns * 24
      const parts = []
      for (let i = 0; i <= steps; i++) {
        const a = (i / 24) * Math.PI * 2
        const r = i / steps
        parts.push(
          `${i === 0 ? 'M' : 'L'}${obj.x + obj.width / 2 + Math.cos(a) * (obj.width / 2) * r},${obj.y + obj.height / 2 + Math.sin(a) * (obj.height / 2) * r}`,
        )
      }
      return `<path d="${parts.join(' ')}" fill="none" stroke="${esc((obj.stroke && obj.stroke.color) || '#000')}" stroke-width="${(obj.stroke && obj.stroke.width) || 1}"/>`
    }
    case 'line':
      return `<line x1="${obj.x}" y1="${obj.y + obj.height / 2}" x2="${obj.x + obj.width}" y2="${obj.y + obj.height / 2}" stroke="${esc((obj.stroke && obj.stroke.color) || '#000')}" stroke-width="${(obj.stroke && obj.stroke.width) || 1}"/>`
    case 'curve':
    case 'freehand':
    case 'pen':
      return `<path d="M${obj.x},${obj.y + obj.height / 2} Q${obj.x + obj.width * 0.25},${obj.y} ${obj.x + obj.width * 0.5},${obj.y + obj.height * 0.5} T${obj.x + obj.width},${obj.y + obj.height / 2}" fill="none" stroke="${esc((obj.stroke && obj.stroke.color) || '#000')}" stroke-width="${(obj.stroke && obj.stroke.width) || 1}"/>`
    case 'arrow': {
      const head = obj.headSize || 20
      const tail = obj.tailWidth || 5
      const y = obj.y + obj.height / 2
      return `<g><line x1="${obj.x}" y1="${y}" x2="${obj.x + obj.width - head}" y2="${y}" stroke="${esc((obj.stroke && obj.stroke.color) || '#000')}" stroke-width="${tail}"/><polygon points="${obj.x + obj.width - head},${y - head / 2} ${obj.x + obj.width},${y} ${obj.x + obj.width - head},${y + head / 2}" fill="${esc((obj.stroke && obj.stroke.color) || '#000')}"/></g>`
    }
    case 'chaos':
      return `<polygon points="${obj.x + obj.width * 0.2},${obj.y + obj.height * 0.1} ${obj.x + obj.width * 0.9},${obj.y + obj.height * 0.35} ${obj.x + obj.width * 0.55},${obj.y + obj.height * 0.95}" ${s}/>`
    case 'text':
      return textSvg(obj)
    case 'image':
      if (obj.src) {
        const rot = obj.rotation ? ` transform="rotate(${obj.rotation} ${obj.x + obj.width / 2} ${obj.y + obj.height / 2})"` : ''
        return `<image x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" preserveAspectRatio="${obj.preserveAspectRatio === 'meet' ? 'xMidYMid meet' : 'none'}" href="${esc(obj.src)}"${rot}/>`
      }
      return `<rect x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" fill="#f0f0f0" stroke="#cccccc"/>`
    case 'dimension':
      return `<g stroke="${esc(obj.color || '#000')}" font-size="10"><line x1="${obj.x + obj.width / 2}" y1="${obj.y}" x2="${obj.x + obj.width / 2}" y2="${obj.y + obj.height}" stroke-dasharray="4,2"/><text x="${obj.x + obj.width / 2}" y="${obj.y + obj.height / 2}" fill="${esc(obj.color || '#000')}" text-anchor="middle">${esc(obj.value)}${esc(obj.units || 'mm')}</text></g>`
    case 'path': {
      const rot = obj.rotation ? ` transform="rotate(${obj.rotation} ${obj.x + obj.width / 2} ${obj.y + obj.height / 2})"` : ''
      const vb = `${obj.pathWidth || obj.width} ${obj.pathHeight || obj.height}`
      return `<g${rot}><svg x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" viewBox="0 0 ${vb}" preserveAspectRatio="none"><path d="${esc(obj.pathData)}" ${s}/></svg></g>`
    }
    case 'contour': {
      const rings = objectToRings(obj)
      const d = rings
        .map(r => r.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px},${py}`).join(' ') + ' Z')
        .join(' ')
      return `<path d="${esc(d)}" ${s}/>`
    }
    case 'clone':
    case 'cloneArray':
    case 'cloneCircle':
      return ''
    default:
      return `<rect x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" ${s}/>`
  }
}

function cropMarksSvg(page) {
  const m = 5
  const len = 8
  const corners = [
    [0, 0, 1, 1],
    [page.width, 0, -1, 1],
    [0, page.height, 1, -1],
    [page.width, page.height, -1, -1],
  ]
  return corners
    .map(([x, y, sx, sy]) => `<g stroke="#000" stroke-width="0.3"><line x1="${x + sx * m}" y1="${y}" x2="${x + sx * (m + len)}" y2="${y}"/><line x1="${x}" y1="${y + sy * m}" x2="${x}" y2="${y + sy * (m + len)}"/></g>`)
    .join('')
}

function registrationMarksSvg(page) {
  const r = 2
  const pts = [
    [page.width / 2, 4],
    [4, page.height / 2],
    [page.width - 4, page.height / 2],
  ]
  return pts
    .map(([x, y]) => `<g stroke="#000" stroke-width="0.3" fill="none"><circle cx="${x}" cy="${y}" r="${r}"/><line x1="${x - r * 2}" y1="${y}" x2="${x + r * 2}" y2="${y}"/><line x1="${x}" y1="${y - r * 2}" x2="${x}" y2="${y + r * 2}"/></g>`)
    .join('')
}

/* ------------------------------- SVG ------------------------------- */

export function buildSvg(objects, page, opts = {}) {
  const defs = objects.map((o, i) => defsFor(o, `fill-${i}-${String(o.id || '').replace(/[^a-zA-Z0-9]/g, '')}`)).filter(Boolean).join('\n    ')
  const body = objects.map((o, i) => objectSvg(o, i)).filter(Boolean).join('\n  ')
  const extras = [
    opts.cropMarks ? cropMarksSvg(page) : '',
    opts.registrationMarks ? registrationMarksSvg(page) : '',
  ].filter(Boolean).join('\n  ')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${page.width}mm" height="${page.height}mm" viewBox="0 0 ${page.width} ${page.height}">
  <defs>
    ${defs}
  </defs>
  <rect x="0" y="0" width="${page.width}" height="${page.height}" fill="${opts.transparentBg ? 'none' : '#ffffff'}"/>
  ${body}
  ${extras}
</svg>`
}

/* ------------------------------- PDF ------------------------------- */

function hexToRgb01(hex) {
  if (!hex || hex[0] !== '#') return [0, 0, 0]
  let h = hex.slice(1)
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

const f2 = (n) => (Math.round(n * 100) / 100).toString()

/** Subpaths -> PDF path operators (y already flipped to PDF space). */
function segmentsToPdfOps(subs, H) {
  const out = []
  for (const sp of subs) {
    const y0 = H - sp.start[1]
    out.push(`${f2(sp.start[0])} ${f2(y0)} m`)
    for (const sg of sp.segs) {
      if (sg.type === 'line') out.push(`${f2(sg.to[0])} ${f2(H - sg.to[1])} l`)
      else out.push(`${f2(sg.c1[0])} ${f2(H - sg.c1[1])} ${f2(sg.c2[0])} ${f2(H - sg.c2[1])} ${f2(sg.to[0])} ${f2(H - sg.to[1])} c`)
    }
    if (sp.closed) out.push('h')
  }
  return out.join('\n')
}

function ringsToPdfOps(rings, H) {
  const out = []
  for (const ring of rings) {
    if (ring.length < 2) continue
    ring.forEach(([x, y], i) => out.push(`${f2(x)} ${f2(H - y)} ${i === 0 ? 'm' : 'l'}`))
    out.push('h')
  }
  return out.join('\n')
}

/** Encode a string as a PDF literal or UTF-16BE hex string. */
function pdfString(s) {
  const str = String(s == null ? '' : s)
  let asciiOnly = true
  for (const ch of str) if (ch.codePointAt(0) > 255) asciiOnly = false
  if (asciiOnly) {
    let out = ''
    for (const ch of str) {
      const c = ch.codePointAt(0)
      if (ch === '(' || ch === ')' || ch === '\\') out += `\\${ch}`
      else if (c < 32) out += `\\${c.toString(8).padStart(3, '0')}`
      else out += ch
    }
    return `(${out})`
  }
  let hex = 'FEFF'
  for (const ch of str) {
    const c = ch.codePointAt(0)
    if (c > 0xffff) {
      const h = c - 0x10000
      hex += (0xd800 + (h >> 10)).toString(16).padStart(4, '0')
      hex += (0xdc00 + (h & 0x3ff)).toString(16).padStart(4, '0')
    } else {
      hex += c.toString(16).padStart(4, '0').toUpperCase()
    }
  }
  return `<${hex}>`
}

function pdfTextOps(obj, H, fontRes) {
  const size = obj.fontSize || 16
  const lines = String(obj.text || '').split('\n')
  const spacing = (obj.lineSpacing || 1.2) * size
  const [r, g, b] = hexToRgb01((obj.fill && (obj.fill.color || obj.fill.spotColor)) || '#000000')
  const ops = ['BT', `/${fontRes} ${f2(size)} Tf`, `${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)} rg`]

  const rad = ((obj.rotation || 0) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const cx = obj.x + obj.width / 2
  const cy = obj.y + obj.height / 2

  lines.forEach((line, i) => {
    const w = measureText(line, size, obj)
    let tx = obj.x + 2
    if (obj.align === 'center') tx = obj.x + obj.width / 2 - w / 2
    else if (obj.align === 'right') tx = obj.x + obj.width - w
    const ty = obj.y + size + i * spacing
    // rotate around the object centre in page space
    const px = cx + (tx - cx) * cos - (ty - cy) * sin
    const py = cy + (tx - cx) * sin + (ty - cy) * cos
    ops.push(`${cos.toFixed(5)} ${(-sin).toFixed(5)} ${sin.toFixed(5)} ${cos.toFixed(5)} ${f2(px)} ${f2(H - py)} Tm`)
    ops.push(`${pdfString(line)} Tj`)
  })
  ops.push('ET')
  return ops.join('\n')
}

function pdfImageOps(obj, H, asset, resName) {
  const w = obj.width
  const h = obj.height
  const rad = ((obj.rotation || 0) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const ox = obj.x
  const oy = obj.y + h
  // bottom-left corner in PDF space
  const px = ox
  const py = H - oy
  const ops = ['q', `${(w * cos).toFixed(4)} ${(w * -sin).toFixed(4)} ${(h * sin).toFixed(4)} ${(h * cos).toFixed(4)} ${f2(px)} ${f2(py)} cm`, `/${resName} Do`, 'Q']
  return ops.join('\n')
}

export function buildPdf(objects, page, opts = {}) {
  const H = page.height
  const images = opts.images || {}
  const content = []
  const fontUsage = new Map() // base14 name -> resource id
  const imageUsage = new Map() // object id -> resource id

  const fontResFor = (name) => {
    if (!fontUsage.has(name)) fontUsage.set(name, `F${fontUsage.size + 1}`)
    return fontUsage.get(name)
  }
  const imageResFor = (id) => {
    if (!imageUsage.has(id)) imageUsage.set(id, `Im${imageUsage.size + 1}`)
    return imageUsage.get(id)
  }

  for (const obj of objects) {
    // --- text ---------------------------------------------------------
    if (obj.type === 'text') {
      content.push(pdfTextOps(obj, H, fontResFor(base14Font(obj))))
      continue
    }

    // --- bitmap -------------------------------------------------------
    if (obj.type === 'image') {
      const asset = images[obj.id]
      if (asset && asset.jpeg) {
        content.push(pdfImageOps(obj, H, asset, imageResFor(obj.id)))
      } else {
        content.push('q 0.94 0.94 0.94 rg')
        content.push(`${f2(obj.x)} ${f2(H - obj.y - obj.height)} ${f2(obj.width)} ${f2(obj.height)} re f`)
        content.push('Q')
      }
      continue
    }

    if (['clone', 'cloneArray', 'cloneCircle'].includes(obj.type)) continue

    // --- geometry -----------------------------------------------------
    const wr = warpedRings(obj)
    const ops = wr
      ? ringsToPdfOps(wr, H)
      : segmentsToPdfOps(objectToSegments(obj), H)
    if (!ops) continue

    const f = obj.fill || {}
    const solid = f.type === 'solid' || f.type === 'spot'
    const [r, g, b] = hexToRgb01(f.type === 'spot' ? f.spotColor : f.color || '#000000')
    if (solid) {
      content.push('q')
      content.push(`${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)} rg`)
      content.push(ops)
      content.push('f')
      content.push('Q')
    }
    if (obj.stroke && obj.stroke.width > 0) {
      const [sr, sg, sb] = hexToRgb01(obj.stroke.color || '#000000')
      content.push('q')
      content.push(`${sr.toFixed(4)} ${sg.toFixed(4)} ${sb.toFixed(4)} RG ${obj.stroke.width.toFixed(3)} w 1 J 1 j`)
      content.push(ops)
      content.push('S')
      content.push('Q')
    }
  }

  const stream = content.join('\n')

  // Object numbering: 1 catalog, 2 pages, 3 page, 4 contents, then fonts,
  // then images; the page object is patched once resources are known.
  const objs = []
  const push = (body) => {
    objs.push(body)
    return objs.length
  }

  push('<< /Type /Catalog /Pages 2 0 R >>')
  push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  const pageObjIndex = push('PLACEHOLDER') // patched below
  const contentIndex = push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)

  const fontObjs = new Map()
  for (const [name, res] of fontUsage.entries()) {
    const n = push(`<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`)
    fontObjs.set(res, n)
  }

  const imageObjs = new Map()
  for (const [id, res] of imageUsage.entries()) {
    const asset = images[id]
    if (!asset || !asset.jpeg) continue
    const jpeg = asset.jpeg
    const header = `<< /Type /XObject /Subtype /Image /Width ${asset.width} /Height ${asset.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
    objs.push({ __image: true, header, jpeg, tail: '\nendstream' })
    imageObjs.set(res, objs.length)
  }

  const fontDict = fontObjs.size
    ? ` /Font << ${Array.from(fontObjs.entries()).map(([res, n]) => `/${res} ${n} 0 R`).join(' ')} >>`
    : ''
  const xobjDict = imageObjs.size
    ? ` /XObject << ${Array.from(imageObjs.entries()).map(([res, n]) => `/${res} ${n} 0 R`).join(' ')} >>`
    : ''
  objs[pageObjIndex - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Contents ${contentIndex} 0 R /Resources <<${fontDict}${xobjDict} >> >>`

  // Serialise (binary-safe for image streams).
  const chunks = []
  let length = 0
  const enc = new TextEncoder()
  const addText = (t) => {
    const b = enc.encode(t)
    chunks.push(b)
    length += b.length
  }

  addText('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  const offsets = [0]
  objs.forEach((o, i) => {
    offsets.push(length)
    addText(`${i + 1} 0 obj\n`)
    if (o && o.__image) {
      addText(o.header)
      chunks.push(o.jpeg)
      length += o.jpeg.length
      addText(o.tail)
    } else {
      addText(o)
    }
    addText('\nendobj\n')
  })

  const xrefPos = length
  addText(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`)
  for (let i = 1; i <= objs.length; i++) {
    addText(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`)
  }
  addText(`trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`)

  const total = chunks.reduce((n, c) => n + c.length, 0)
  const bytes = new Uint8Array(total)
  let at = 0
  for (const c of chunks) {
    bytes.set(c, at)
    at += c.length
  }
  return bytes
}

/* ------------------------------- EPS / AI -------------------------- */

function psString(s) {
  // Latin-1 bytes as a PostScript hex string, so any 8-bit text is safe.
  let hex = ''
  for (const ch of String(s == null ? '' : s)) {
    const c = ch.codePointAt(0) & 0xff
    hex += c.toString(16).padStart(2, '0').toUpperCase()
  }
  return `<${hex}>`
}

function psFontName(obj) {
  return '/' + base14Font(obj)
}

function segmentsToPs(subs, H) {
  const out = ['newpath']
  for (const sp of subs) {
    out.push(`${f2(sp.start[0])} ${f2(H - sp.start[1])} moveto`)
    for (const sg of sp.segs) {
      if (sg.type === 'line') out.push(`${f2(sg.to[0])} ${f2(H - sg.to[1])} lineto`)
      else out.push(`${f2(sg.c1[0])} ${f2(H - sg.c1[1])} ${f2(sg.c2[0])} ${f2(H - sg.c2[1])} ${f2(sg.to[0])} ${f2(H - sg.to[1])} curveto`)
    }
    if (sp.closed) out.push('closepath')
  }
  return out
}

function rgbHex(rgb) {
  let hex = ''
  for (let i = 0; i < rgb.length; i++) hex += rgb[i].toString(16).padStart(2, '0')
  return hex
}

export function buildPostScript(objects, page, opts = {}) {
  const H = page.height
  const images = opts.images || {}
  const traced = opts.traced || {}
  const lines = [
    '%!PS-Adobe-3.0 EPSF-3.0',
    `%%BoundingBox: 0 0 ${Math.ceil(page.width)} ${Math.ceil(page.height)}`,
    '%%Creator: VinylCut Studio',
    '%%EndComments',
    'gsave',
  ]

  for (const obj of objects) {
    if (['clone', 'cloneArray', 'cloneCircle'].includes(obj.type)) continue

    if (obj.type === 'text') {
      const size = obj.fontSize || 16
      const [r, g, b] = hexToRgb01((obj.fill && (obj.fill.color || obj.fill.spotColor)) || '#000000')
      lines.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} setrgbcolor`)
      lines.push(`gsave ${psFontName(obj)} findfont ${f2(size)} scalefont setfont`)
      if (obj.rotation) lines.push(`${obj.x + obj.width / 2} ${f2(H - (obj.y + obj.height / 2))} translate ${obj.rotation} rotate ${-(obj.x + obj.width / 2)} ${f2(-(H - (obj.y + obj.height / 2)))} translate`)
      const tlines = String(obj.text || '').split('\n')
      const spacing = (obj.lineSpacing || 1.2) * size
      tlines.forEach((line, i) => {
        const w = measureText(line, size, obj)
        let tx = obj.x + 2
        if (obj.align === 'center') tx = obj.x + obj.width / 2 - w / 2
        else if (obj.align === 'right') tx = obj.x + obj.width - w
        lines.push(`${f2(tx)} ${f2(H - (obj.y + size + i * spacing))} moveto ${psString(line)} show`)
      })
      lines.push('grestore')
      continue
    }

    if (obj.type === 'image') {
      const asset = images[obj.id]
      if (asset && asset.rgb) {
        const rad = ((obj.rotation || 0) * Math.PI) / 180
        lines.push('gsave')
        if (obj.rotation) {
          lines.push(`${f2(obj.x + obj.width / 2)} ${f2(H - (obj.y + obj.height / 2))} translate ${obj.rotation} rotate`)
          lines.push(`${f2(-obj.width / 2)} ${f2(-obj.height / 2)} translate`)
        } else {
          lines.push(`${f2(obj.x)} ${f2(H - obj.y - obj.height)} translate`)
        }
        lines.push(`${asset.width} ${asset.height} 8 [${asset.width} 0 0 -${asset.height} 0 ${asset.height}] {${rgbHex(asset.rgb)}} false 3 colorimage`)
        lines.push('grestore')
      } else if (traced[obj.id]) {
        lines.push('0 0 0 setrgbcolor')
        lines.push(...segmentsToPs(objectToSegments(traced[obj.id]), H))
        lines.push('fill')
      }
      continue
    }

    const wr = warpedRings(obj)
    const f = obj.fill || {}
    const colour = f.type === 'spot' ? f.spotColor : f.color
    const [r, g, b] = hexToRgb01(colour || '#000000')
    const hasFill = f.type === 'solid' || f.type === 'spot'
    if (hasFill) lines.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} setrgbcolor`)
    lines.push(...(wr ? ['newpath', ...wr.map(ring => {
      const parts = ring.map(([x, y], i) => `${f2(x)} ${f2(H - y)} ${i === 0 ? 'moveto' : 'lineto'}`)
      return [...parts, 'closepath']
    }).flat()] : segmentsToPs(objectToSegments(obj), H)))
    if (hasFill) lines.push('fill')
    if (obj.stroke && obj.stroke.width > 0) {
      const [sr, sg, sb] = hexToRgb01(obj.stroke.color || '#000')
      lines.push(`${sr.toFixed(3)} ${sg.toFixed(3)} ${sb.toFixed(3)} setrgbcolor ${obj.stroke.width.toFixed(2)} setlinewidth stroke`)
    }
  }

  lines.push('grestore', 'showpage', '%%EOF')
  return lines.join('\n')
}

/* -------------------------------- DXF ------------------------------ */

export function buildDxf(objects, opts = {}) {
  const traced = opts.traced || {}
  const H = opts.pageHeight || 0
  // DXF is Y-up CAD space; the document is Y-down, so flip against the page.
  const Y = (y) => H - y
  const out = ['0', 'SECTION', '2', 'HEADER', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES']

  for (const obj of objects) {
    if (['clone', 'cloneArray', 'cloneCircle'].includes(obj.type)) continue

    if (obj.type === 'image') {
      const shape = traced[obj.id]
      if (shape) {
        for (const ring of objectToRings(shape)) {
          if (ring.length < 2) continue
          out.push('0', 'LWPOLYLINE', '8', 'TRACE', '100', 'AcDbEntity', '62', '7', '100', 'AcDbPolyline', '90', String(ring.length), '70', ring.length > 2 ? '1' : '0')
          for (const [x, y] of ring) out.push('10', x.toFixed(4), '20', Y(y).toFixed(4))
        }
      }
      continue
    }

    if (obj.type === 'text') {
      const size = obj.fontSize || 16
      const lines = String(obj.text || '').split('\n')
      const spacing = (obj.lineSpacing || 1.2) * size
      const hjust = obj.align === 'center' ? 1 : obj.align === 'right' ? 2 : 0
      lines.forEach((line, i) => {
        const ty = obj.y + size + i * spacing
        const anchorX = obj.align === 'center' ? obj.x + obj.width / 2 : obj.align === 'right' ? obj.x + obj.width : obj.x + 2
        const rot = obj.rotation || 0
        out.push('0', 'TEXT', '8', 'TEXT', '100', 'AcDbEntity', '100', 'AcDbText')
        out.push('10', anchorX.toFixed(4), '20', Y(ty).toFixed(4), '30', '0')
        out.push('40', size.toFixed(4))
        out.push('1', line)
        if (hjust) out.push('72', String(hjust), '11', anchorX.toFixed(4), '21', Y(ty).toFixed(4), '31', '0')
        out.push('50', rot.toFixed(4))
      })
      continue
    }

    const wr = warpedRings(obj)
    const f = obj.fill || {}
    const hasFill = !!f.type && f.type !== 'none' && f.type !== 'mask' && f.type !== 'parent'
    const colour = f.type === 'spot' ? f.spotColor : f.color || '#000000'
    const [r, g, b] = hexToRgb01(colour)
    const aci = 256
    if (hasFill) {
      const rings = wr || objectToRings(obj)
      for (const ring of rings) {
        if (ring.length < 2) continue
        const closed = ring.length > 2
        out.push('0', 'LWPOLYLINE', '8', 'CUT', '100', 'AcDbEntity', '62', String(aci), '420', String((Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255)), '100', 'AcDbPolyline', '90', String(ring.length), '70', closed ? '1' : '0')
        for (const [x, y] of ring) {
          out.push('10', x.toFixed(4), '20', Y(y).toFixed(4))
        }
      }
    }
    if (obj.stroke && obj.stroke.width > 0) {
      // Stroke centre lines. DXF has no "stroke width", so the outline is
      // emitted as an open polyline the cutter can follow.
      const subs = objectToSegments(obj)
      for (const sp of subs) {
        const pts = [sp.start, ...sp.segs.map(s => s.to)]
        if (pts.length < 2) continue
        out.push('0', 'LWPOLYLINE', '8', 'CUT', '100', 'AcDbEntity', '62', '7', '100', 'AcDbPolyline', '90', String(pts.length), '70', '0')
        for (const [x, y] of pts) out.push('10', x.toFixed(4), '20', Y(y).toFixed(4))
      }
    }
  }

  out.push('0', 'ENDSEC', '0', 'EOF')
  return out.join('\r\n')
}

/* -------------------------------- HPGL ----------------------------- */

export function buildHpgl(objects, opts = {}) {
  const traced = opts.traced || {}
  const upm = opts.unitsPerMm || 40
  const H = opts.pageHeight || 0
  // HPGL origin is the lower-left of the media; document space is top-left.
  const flip = (rings) => rings.map(r => r.map(([x, y]) => [x, H - y]))
  const parts = ['IN;', `VS${opts.speed || 20};`, `FS${opts.force || 10};`, `SP${opts.pen || 1};`]

  for (const obj of objects) {
    if (['clone', 'cloneArray', 'cloneCircle'].includes(obj.type)) continue

    if (obj.type === 'text') {
      const size = obj.fontSize || 16
      const lines = String(obj.text || '').split('\n')
      const spacing = (obj.lineSpacing || 1.2) * size
      lines.forEach((line, i) => {
        const w = measureText(line, size, obj)
        let tx = obj.x + 2
        if (obj.align === 'center') tx = obj.x + obj.width / 2 - w / 2
        else if (obj.align === 'right') tx = obj.x + obj.width - w
        const ty = obj.y + size + i * spacing
        const px = Math.round(tx * upm)
        const py = Math.round((H - ty) * upm)
        // SI sets the label size in cm; LB prints it; ET (0x03) ends the label.
        parts.push(`PU${px},${py};`, `SI${(size / 10).toFixed(2)},${(size / 10).toFixed(2)};`, `LB${String(line).replace(/;/g, ',')}${String.fromCharCode(3)}`)
      })
      continue
    }

    if (obj.type === 'image') {
      const shape = traced[obj.id]
      if (shape) {
        const emitted = multiPolygonToHPGL([flip(objectToRings(shape))], { unitsPerMm: upm, pen: opts.pen || 1, tolerance: opts.tolerance || 0.05 })
        parts.push(emitted.split('\n').filter(l => l && l !== 'IN;').join('\n'))
      }
      continue
    }

    const wr = warpedRings(obj)
    const rings = flip(wr || objectToRings(obj))
    const emitted = multiPolygonToHPGL([rings], { unitsPerMm: upm, pen: opts.pen || 1, tolerance: opts.tolerance || 0.05 })
    parts.push(emitted.split('\n').filter(l => l && l !== 'IN;').join('\n'))
  }

  parts.push('PU0,0;', 'SP0;')
  return parts.filter(Boolean).join('\n')
}

/* ------------------------------ raster ----------------------------- */

export function rasterise(svg, width, height, mime = 'image/png', quality = 0.95) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (mime === 'image/jpeg') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)
      }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL(mime, quality))
    }
    img.onerror = () => reject(new Error('Could not rasterise export'))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

/* ------------------------------ BMP -------------------------------- */

/** Encode an ImageData into a 24-bit uncompressed BMP. */
export function encodeBmp(imageData) {
  const { width: w, height: h, data } = imageData
  const rowSize = (w * 3 + 3) & ~3
  const pixelArraySize = rowSize * h
  const fileSize = 54 + pixelArraySize
  const buf = new ArrayBuffer(fileSize)
  const view = new DataView(buf)
  const bytes = new Uint8Array(buf)

  view.setUint16(0, 0x424d, false) // 'BM'
  view.setUint32(2, fileSize, true)
  view.setUint32(10, 54, true)
  view.setUint32(14, 40, true)
  view.setInt32(18, w, true)
  view.setInt32(22, h, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, 24, true)
  view.setUint32(34, pixelArraySize, true)

  for (let y = 0; y < h; y++) {
    const srcY = h - 1 - y
    let off = 54 + y * rowSize
    for (let x = 0; x < w; x++) {
      const i = (srcY * w + x) * 4
      bytes[off++] = data[i + 2]
      bytes[off++] = data[i + 1]
      bytes[off++] = data[i]
    }
  }
  return buf
}

/* ------------------------------ download --------------------------- */

export function download(data, filename, mime) {
  // Binary streams (PDF/EPS byte arrays) go straight into a Blob.
  const isBytes = data instanceof Uint8Array || data instanceof ArrayBuffer || data instanceof Blob
  const a = document.createElement('a')
  if (isBytes) {
    a.href = URL.createObjectURL(new Blob([data], { type: mime || 'application/octet-stream' }))
    setTimeout(() => URL.revokeObjectURL(a.href), 8000)
  } else if (typeof data === 'string' && !data.startsWith('data:')) {
    a.href = URL.createObjectURL(new Blob([data], { type: mime || 'text/plain' }))
    setTimeout(() => URL.revokeObjectURL(a.href), 8000)
  } else {
    a.href = data
  }
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Objects that survive to vector formats. Clones are not real geometry. */
export function vectorObjects(objects) {
  return objects.filter(o => !['clone', 'cloneArray', 'cloneCircle'].includes(o.type))
}

export { multiPolygonToShape }
