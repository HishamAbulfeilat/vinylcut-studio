/* ------------------------------------------------------------------ *
 * Exporters. Every format here is produced for real from the
 * document's geometry (see lib/geometry.js) - no stubs.
 *
 *   Vector : SVG, PDF 1.4, EPS, AI(legacy EPS), DXF R12, HPGL/PLT
 *   Raster : PNG, JPEG, BMP (rasterised from the SVG at export DPI)
 * ------------------------------------------------------------------ */

import {
  objectToRings,
  multiPolygonToShape,
  multiPolygonToHPGL,
  parsePathData,
} from './geometry'

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

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
    const text = esc(obj.text)
    const chars = String(obj.text || '').split('')
    const spanAng = ((obj.arcAngle || 180) / chars.length) * Math.PI / 180
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
    const text = esc(obj.text)
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
  return lines
    .map(
      (line, i) =>
        `<text x="${tx}" y="${obj.y + size + i * spacing}" font-family="${fam}" font-size="${size}" font-weight="${weight}" font-style="${style}" fill="${esc(colour)}" text-anchor="${anchor}"${obj.underline ? ' text-decoration="underline"' : ''}>${esc(line)}</text>`,
    )
    .join('')
}

function objectSvg(obj, index) {
  const id = `fill-${index}-${String(obj.id || '').replace(/[^a-zA-Z0-9]/g, '')}`
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
        return `<image x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" preserveAspectRatio="${obj.preserveAspectRatio || 'none'}" href="${esc(obj.src)}"${rot}/>`
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

function pdfPathOps(rings) {
  const ops = []
  for (const ring of rings) {
    if (ring.length < 3) continue
    ring.forEach(([x, y], i) => {
      // PDF origin is bottom-left
      ops.push(`${i === 0 ? '' : ''}${x.toFixed(2)} ${y.toFixed(2)} ${i === 0 ? 'm' : 'l'}`)
    })
    ops.push('h')
  }
  return ops.join('\n')
}

function hexToRgb01(hex) {
  if (!hex || hex[0] !== '#') return [0, 0, 0]
  let h = hex.slice(1)
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export function buildPdf(objects, page, opts = {}) {
  const H = page.height
  const content = []
  for (const obj of objects) {
    const rings = objectToRings(obj)
    const ops = pdfPathOps(rings.map(r => r.map(([x, y]) => [x, H - y])))
    if (!ops) continue
    const f = obj.fill || {}
    const solid = f.type === 'solid' || f.type === 'spot'
    const colour = f.type === 'spot' ? f.spotColor : f.color
    const [r, g, b] = hexToRgb01(colour || '#000000')
    if (solid) {
      content.push(`q ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)} rg`)
      content.push(ops)
      content.push('f')
    }
    if (obj.stroke && obj.stroke.width > 0) {
      const [sr, sg, sb] = hexToRgb01(obj.stroke.color || '#000000')
      content.push(`q ${sr.toFixed(4)} ${sg.toFixed(4)} ${sb.toFixed(4)} RG ${(obj.stroke.width * 0.35).toFixed(3)} w`)
      content.push(ops)
      content.push('S')
    }
    content.push('Q')
  }

  const stream = content.join('\n')
  const objectsPdf = []
  objectsPdf.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  objectsPdf.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')
  objectsPdf.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Contents 4 0 R /Resources << >> >>\nendobj\n`,
  )
  objectsPdf.push(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`)

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const o of objectsPdf) {
    offsets.push(pdf.length)
    pdf += o
  }
  const xrefPos = pdf.length
  pdf += `xref\n0 ${objectsPdf.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objectsPdf.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objectsPdf.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`
  return pdf
}

/* ------------------------------- EPS / AI -------------------------- */

export function buildPostScript(objects, page, opts = {}) {
  const H = page.height
  const lines = [
    '%!PS-Adobe-3.0 EPSF-3.0',
    `%%BoundingBox: 0 0 ${Math.ceil(page.width)} ${Math.ceil(page.height)}`,
    '%%Creator: VinylCut Studio',
    '%%EndComments',
    'gsave',
  ]
  for (const obj of objects) {
    const rings = objectToRings(obj)
    const f = obj.fill || {}
    const colour = f.type === 'spot' ? f.spotColor : f.color
    const [r, g, b] = hexToRgb01(colour || '#000000')
    const hasFill = f.type === 'solid' || f.type === 'spot'
    if (hasFill) lines.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} setrgbcolor newpath`)
    else lines.push('newpath')
    rings.forEach(ring => {
      ring.forEach(([x, y], i) => {
        lines.push(`${x.toFixed(2)} ${(H - y).toFixed(2)} ${i === 0 ? 'moveto' : 'lineto'}`)
      })
      lines.push('closepath')
    })
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

export function buildDxf(objects) {
  const out = ['0', 'SECTION', '2', 'HEADER', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES']
  for (const obj of objects) {
    const rings = objectToRings(obj)
    const f = obj.fill || {}
    const colour = f.type === 'spot' ? f.spotColor : f.color || '#000000'
    const [r, g, b] = hexToRgb01(colour)
    const aci = 256 // ByLayer fallback; true colour written below
    for (const ring of rings) {
      if (ring.length < 2) continue
      const closed = ring.length > 2
      out.push('0', 'LWPOLYLINE', '8', 'CUT', '100', 'AcDbEntity', '62', String(aci), '420', String((Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255)), '100', 'AcDbPolyline', '90', String(ring.length), '70', closed ? '1' : '0')
      for (const [x, y] of ring) {
        out.push('10', x.toFixed(4), '20', (-y).toFixed(4))
      }
    }
  }
  out.push('0', 'ENDSEC', '0', 'EOF')
  return out.join('\r\n')
}

/* -------------------------------- HPGL ----------------------------- */

export function buildHpgl(objects, opts = {}) {
  const parts = ['IN;', `VS${opts.speed || 20};`, `FS${opts.force || 10};`]
  for (const obj of objects) {
    // Cut every ring of the object, holes included.
    const perObject = multiPolygonToHPGL([objectToRings(obj)], { unitsPerMm: opts.unitsPerMm || 40, pen: opts.pen || 1, tolerance: opts.tolerance || 0.05 })
    // multiPolygonToHPGL emits its own IN;/SPn; header - keep only the geometry
    parts.push(perObject.split('\n').filter(l => l && !l.startsWith('IN')).join('\n'))
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
  const blob = typeof data === 'string' && !data.startsWith('data:')
    ? new Blob([data], { type: mime || 'text/plain' })
    : null
  const a = document.createElement('a')
  if (blob) {
    a.href = URL.createObjectURL(blob)
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  } else {
    a.href = data
  }
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Objects that survive to vector formats (text becomes its outline box). */
export function vectorObjects(objects) {
  return objects.filter(o => !['image', 'clone', 'cloneArray', 'cloneCircle'].includes(o.type))
}

export { multiPolygonToShape }
