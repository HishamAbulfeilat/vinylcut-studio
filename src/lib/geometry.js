/* ------------------------------------------------------------------ *
 * Shared 2D geometry for VinylCut Studio.
 *
 * Geometry is expressed as a MultiPolygon:
 *   [ [ ring, hole, ... ], ... ]
 * where each ring is [ [x, y], ... ] in absolute page coordinates.
 *
 * Everything the app needs for real vector work lives here: shape ->
 * polygon conversion, boolean ops, polygon offsetting (contour /
 * inline / outline), knife splitting, curve flattening, simplification
 * and HPGL generation.
 * ------------------------------------------------------------------ */

import polygonClippingNS from 'polygon-clipping'

const pc = polygonClippingNS.default || polygonClippingNS

export const POINT_EPS = 1e-6

/* ----------------------------- vectors ---------------------------- */

export function rotatePoint(px, py, cx, cy, deg) {
  const r = ((deg || 0) * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  const dx = px - cx
  const dy = py - cy
  return [cx + dx * c - dy * s, cy + dx * s + dy * c]
}

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function signedArea(ring) {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1])
  }
  return a / 2
}

/** Absolute area of a ring (positive for both windings). */
export function ringArea(ring) {
  return Math.abs(signedArea(ring))
}

/* --------------------------- curve flattening ---------------------- */

/**
 * Segment count for a circular arc of the given radius so the maximum
 * chord-to-arc error stays inside `tolerance` (same units as radius).
 */
export function arcSegments(radius, tolerance = 0.05) {
  const r = Math.abs(radius)
  if (!(r > 0)) return 16
  if (!(tolerance > 0)) return 512
  const ratio = 1 - Math.min(0.999, tolerance / r)
  const step = Math.acos(ratio)
  if (!(step > 0)) return 512
  return Math.max(6, Math.min(1024, Math.ceil(Math.PI / step)))
}

/**
 * Adaptive subdivision of a cubic Bezier. Uses the distance of the
 * control points from the chord, so the flattened polyline never deviates
 * from the true curve by more than `tolerance`.
 */
export function flattenCubic(x0, y0, x1, y1, x2, y2, x3, y3, tolerance, out, depth = 0) {
  const dx = x3 - x0
  const dy = y3 - y0
  const dd = dx * dx + dy * dy
  const d1 = Math.abs((x1 - x3) * dy - (y1 - y3) * dx)
  const d2 = Math.abs((x2 - x3) * dy - (y2 - y3) * dx)
  const d = Math.max(d1, d2)

  let flat
  if (dd < 1e-12) {
    flat = Math.max(Math.hypot(x1 - x0, y1 - y0), Math.hypot(x2 - x0, y2 - y0)) <= tolerance
  } else {
    flat = d * d <= tolerance * tolerance * dd
  }
  if (flat || depth >= 20) {
    out.push([x3, y3])
    return out
  }

  const x01 = (x0 + x1) / 2
  const y01 = (y0 + y1) / 2
  const x12 = (x1 + x2) / 2
  const y12 = (y1 + y2) / 2
  const x23 = (x2 + x3) / 2
  const y23 = (y2 + y3) / 2
  const x012 = (x01 + x12) / 2
  const y012 = (y01 + y12) / 2
  const x123 = (x12 + x23) / 2
  const y123 = (y12 + y23) / 2
  const xm = (x012 + x123) / 2
  const ym = (y012 + y123) / 2

  flattenCubic(x0, y0, x01, y01, x012, y012, xm, ym, tolerance, out, depth + 1)
  flattenCubic(xm, ym, x123, y123, x23, y23, x3, y3, tolerance, out, depth + 1)
  return out
}

/** Adaptive subdivision of a quadratic Bezier (elevated to a cubic). */
export function flattenQuad(x0, y0, qx, qy, x1, y1, tolerance, out, depth = 0) {
  const c1x = x0 + (2 / 3) * (qx - x0)
  const c1y = y0 + (2 / 3) * (qy - y0)
  const c2x = x1 + (2 / 3) * (qx - x1)
  const c2y = y1 + (2 / 3) * (qy - y1)
  return flattenCubic(x0, y0, c1x, c1y, c2x, c2y, x1, y1, tolerance, out, depth)
}

/* --------------------------- path parsing -------------------------- */

/**
 * Parse SVG path data into curve-preserving subpaths.
 *
 * Returns [{ start, closed, segs: [ {type:'line', to} |
 *            {type:'cubic', c1, c2, to} ] }].
 * Nothing is flattened here, so exporters can re-emit true curves.
 */
export function parsePathSegments(d) {
  if (!d || typeof d !== 'string') return []
  const tokens = d.match(/[MmLlHhVvQqTtCcSsZzAa]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi)
  if (!tokens) return []

  const subs = []
  let segs = []
  let start = null
  let cx = 0
  let cy = 0
  let startX = 0
  let startY = 0
  let prevCtrlX = null
  let prevCtrlY = null
  let prevQ = false
  let cmd = null
  let i = 0

  const num = () => parseFloat(tokens[i++])
  const open = (x, y) => {
    start = [x, y]
    segs = []
  }
  const flush = () => {
    if (start && segs.length) subs.push({ start, closed: false, segs })
    start = null
    segs = []
  }

  while (i < tokens.length) {
    const tok = tokens[i]
    if (/[a-z]/i.test(tok)) {
      cmd = tok
      i++
    } else if (cmd === null) {
      break
    } else if (cmd === 'M') {
      cmd = 'L'
    } else if (cmd === 'm') {
      cmd = 'l'
    }

    const rel = cmd === cmd.toLowerCase()
    switch (cmd.toUpperCase()) {
      case 'M': {
        flush()
        cx = num() + (rel ? cx : 0)
        cy = num() + (rel ? cy : 0)
        startX = cx
        startY = cy
        open(cx, cy)
        prevCtrlX = prevCtrlY = null
        break
      }
      case 'L': {
        const x1 = num() + (rel ? cx : 0)
        const y1 = num() + (rel ? cy : 0)
        segs.push({ type: 'line', to: [x1, y1] })
        cx = x1
        cy = y1
        prevCtrlX = prevCtrlY = null
        break
      }
      case 'H': {
        const x1 = num() + (rel ? cx : 0)
        segs.push({ type: 'line', to: [x1, cy] })
        cx = x1
        prevCtrlX = prevCtrlY = null
        break
      }
      case 'V': {
        const y1 = num() + (rel ? cy : 0)
        segs.push({ type: 'line', to: [cx, y1] })
        cy = y1
        prevCtrlX = prevCtrlY = null
        break
      }
      case 'Q': {
        const qx = num() + (rel ? cx : 0)
        const qy = num() + (rel ? cy : 0)
        const x1 = num() + (rel ? cx : 0)
        const y1 = num() + (rel ? cy : 0)
        segs.push({ type: 'cubic', c1: [cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy)], c2: [x1 + (2 / 3) * (qx - x1), y1 + (2 / 3) * (qy - y1)], to: [x1, y1] })
        prevCtrlX = qx
        prevCtrlY = qy
        prevQ = true
        cx = x1
        cy = y1
        break
      }
      case 'T': {
        const x1 = num() + (rel ? cx : 0)
        const y1 = num() + (rel ? cy : 0)
        const qx = prevCtrlX === null || !prevQ ? cx : 2 * cx - prevCtrlX
        const qy = prevCtrlY === null || !prevQ ? cy : 2 * cy - prevCtrlY
        segs.push({ type: 'cubic', c1: [cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy)], c2: [x1 + (2 / 3) * (qx - x1), y1 + (2 / 3) * (qy - y1)], to: [x1, y1] })
        prevCtrlX = qx
        prevCtrlY = qy
        prevQ = true
        cx = x1
        cy = y1
        break
      }
      case 'C': {
        const a1x = num() + (rel ? cx : 0)
        const a1y = num() + (rel ? cy : 0)
        const a2x = num() + (rel ? cx : 0)
        const a2y = num() + (rel ? cy : 0)
        const x1 = num() + (rel ? cx : 0)
        const y1 = num() + (rel ? cy : 0)
        segs.push({ type: 'cubic', c1: [a1x, a1y], c2: [a2x, a2y], to: [x1, y1] })
        prevCtrlX = a2x
        prevCtrlY = a2y
        prevQ = false
        cx = x1
        cy = y1
        break
      }
      case 'S': {
        const a2x = num() + (rel ? cx : 0)
        const a2y = num() + (rel ? cy : 0)
        const x1 = num() + (rel ? cx : 0)
        const y1 = num() + (rel ? cy : 0)
        const a1x = prevCtrlX === null || prevQ ? cx : 2 * cx - prevCtrlX
        const a1y = prevCtrlY === null || prevQ ? cy : 2 * cy - prevCtrlY
        segs.push({ type: 'cubic', c1: [a1x, a1y], c2: [a2x, a2y], to: [x1, y1] })
        prevCtrlX = a2x
        prevCtrlY = a2y
        prevQ = false
        cx = x1
        cy = y1
        break
      }
      case 'A': {
        // Elliptical arc -> one or more cubic segments.
        const rx = Math.abs(num())
        const ry = Math.abs(num())
        const xAxis = num()
        const largeArc = num() ? 1 : 0
        const sweep = num() ? 1 : 0
        const x1 = num() + (rel ? cx : 0)
        const y1 = num() + (rel ? cy : 0)
        for (const seg of arcToCubics(cx, cy, rx, ry, xAxis, largeArc, sweep, x1, y1)) segs.push(seg)
        cx = x1
        cy = y1
        prevCtrlX = prevCtrlY = null
        break
      }
      case 'Z': {
        if (start) {
          const dxs = cx - start[0]
          const dys = cy - start[1]
          if (Math.abs(dxs) > 1e-9 || Math.abs(dys) > 1e-9) {
            segs.push({ type: 'line', to: [start[0], start[1]] })
          }
          if (segs.length) subs.push({ start, closed: true, segs })
        }
        cx = startX
        cy = startY
        start = null
        segs = []
        prevCtrlX = prevCtrlY = null
        break
      }
      default:
        i++
    }
  }
  flush()
  return subs
}

/** SVG endpoint-parameterised elliptical arc -> cubic Bezier segments. */
export function arcToCubics(x0, y0, rx, ry, xAxisRotation, largeArc, sweep, x1, y1) {
  if (rx === 0 || ry === 0) return [{ type: 'line', to: [x1, y1] }]
  const phi = ((xAxisRotation || 0) * Math.PI) / 180
  const cosPhi = Math.cos(phi)
  const sinPhi = Math.sin(phi)
  const dx2 = (x0 - x1) / 2
  const dy2 = (y0 - y1) / 2
  const x1p = cosPhi * dx2 + sinPhi * dy2
  const y1p = -sinPhi * dx2 + cosPhi * dy2

  let rxs = rx * rx
  let rys = ry * ry
  const lambda = (x1p * x1p) / rxs + (y1p * y1p) / rys
  if (lambda > 1) {
    const s = Math.sqrt(lambda)
    rx *= s
    ry *= s
    rxs = rx * rx
    rys = ry * ry
  }

  let sign = largeArc === sweep ? -1 : 1
  const num = rxs * rys - rxs * y1p * y1p - rys * x1p * x1p
  const den = rxs * y1p * y1p + rys * x1p * x1p
  const co = sign * Math.sqrt(Math.max(0, num / den))
  const cxp = (co * rx * y1p) / ry
  const cyp = (-co * ry * x1p) / rx
  const cx = cosPhi * cxp - sinPhi * cyp + (x0 + x1) / 2
  const cy = sinPhi * cxp + cosPhi * cyp + (y0 + y1) / 2

  const angle = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy)
    let a = Math.acos(Math.max(-1, Math.min(1, dot / (len || 1))))
    if (ux * vy - uy * vx < 0) a = -a
    return a
  }
  const ux = (x1p - cxp) / rx
  const uy = (y1p - cyp) / ry
  const vx = (-x1p - cxp) / rx
  const vy = (-y1p - cyp) / ry
  const theta1 = angle(1, 0, ux, uy)
  let dTheta = angle(ux, uy, vx, vy)
  if (!sweep && dTheta > 0) dTheta -= Math.PI * 2
  if (sweep && dTheta < 0) dTheta += Math.PI * 2

  const n = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2)))
  const delta = dTheta / n
  const t = ((4 / 3) * Math.tan(delta / 4))
  const out = []
  let px = x0
  let py = y0
  let th = theta1
  for (let s = 0; s < n; s++) {
    const cosT1 = Math.cos(th)
    const sinT1 = Math.sin(th)
    const th2 = th + delta
    const cosT2 = Math.cos(th2)
    const sinT2 = Math.sin(th2)

    const ex = cosPhi * rx * cosT2 - sinPhi * ry * sinT2 + cx
    const ey = sinPhi * rx * cosT2 + cosPhi * ry * sinT2 + cy

    const d1x = -rx * sinT1
    const d1y = ry * cosT1
    const d2x = -rx * sinT2
    const d2y = ry * cosT2

    const c1x = px + t * (cosPhi * d1x - sinPhi * d1y)
    const c1y = py + t * (sinPhi * d1x + cosPhi * d1y)
    const c2x = ex - t * (cosPhi * d2x - sinPhi * d2y)
    const c2y = ey - t * (sinPhi * d2x + cosPhi * d2y)

    out.push({ type: 'cubic', c1: [c1x, c1y], c2: [c2x, c2y], to: [ex, ey] })
    px = ex
    py = ey
    th = th2
  }
  return out
}

/**
 * Flatten SVG path data into subpaths of [x, y] points.
 *
 * `opts` may be a number (legacy fixed step count) or an object with a
 * `tolerance` in coordinate units. The default is adaptive flattening
 * scaled to the path's own size, so curves stay smooth at any zoom.
 */
export function parsePathData(d, opts = {}) {
  const subs = parsePathSegments(d)
  if (!subs.length) return []

  let tolerance
  if (typeof opts === 'number') tolerance = null
  else tolerance = opts.tolerance == null ? null : opts.tolerance

  // size of the path, used to derive a sensible default tolerance
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
  for (const sp of subs) {
    note(sp.start[0], sp.start[1])
    for (const sg of sp.segs) {
      if (sg.c1) note(sg.c1[0], sg.c1[1])
      if (sg.c2) note(sg.c2[0], sg.c2[1])
      note(sg.to[0], sg.to[1])
    }
  }
  const diag = Math.hypot(maxX - minX, maxY - minY)
  const tol = tolerance != null ? tolerance : Math.max(0.01, diag * 0.0015)
  const steps = typeof opts === 'number' ? Math.max(1, opts) : null

  const out = []
  for (const sp of subs) {
    const pts = [sp.start.slice()]
    let cx = sp.start[0]
    let cy = sp.start[1]
    for (const sg of sp.segs) {
      if (sg.type === 'line') {
        pts.push(sg.to.slice())
      } else if (steps != null) {
        for (let s = 1; s <= steps; s++) {
          const t = s / steps
          const mt = 1 - t
          pts.push([
            mt * mt * mt * cx + 3 * mt * mt * t * sg.c1[0] + 3 * mt * t * t * sg.c2[0] + t * t * t * sg.to[0],
            mt * mt * mt * cy + 3 * mt * mt * t * sg.c1[1] + 3 * mt * t * t * sg.c2[1] + t * t * t * sg.to[1],
          ])
        }
      } else {
        flattenCubic(cx, cy, sg.c1[0], sg.c1[1], sg.c2[0], sg.c2[1], sg.to[0], sg.to[1], tol, pts)
      }
      cx = sg.to[0]
      cy = sg.to[1]
    }
    if (pts.length > 1) out.push(pts)
  }
  return out
}

/* --------------------------- shape sampling ------------------------ */

function arcPoints(cx, cy, rx, ry, n, startAngle, rot) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = startAngle + (i / n) * Math.PI * 2
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry])
  }
  if (rot) return pts.map(([px, py]) => rotatePoint(px, py, cx, cy, rot))
  return pts
}

/**
 * Sample any object into a list of closed rings (absolute coords).
 * Open shapes (lines, curves, text) fall back to their bounding box so
 * that boolean/contour operations still behave sensibly.
 */
/**
 * Accept `rings` in any of the three nesting depths and return the canonical
 * multiPolygon form [polygon][ring][point]. Importers already write that
 * form; this keeps hand-built or third-party objects from silently
 * degrading into rings-of-points.
 */
export function normaliseRings(rings) {
  if (!Array.isArray(rings) || !rings.length) return []
  const first = rings[0]
  if (!Array.isArray(first)) return []
  if (typeof first[0] === 'number') return [[rings]] // single ring [pt,pt]
  if (first[0] && typeof first[0][0] === 'number') return rings.map((r) => [r]) // [ring,...]
  return rings
}

export function objectToRings(obj, tolerance) {
  const tol = tolerance > 0 ? tolerance : 0.05
  // Objects carrying `rings` without own path data reuse them as-is. Path
  // objects always rebuild from `pathData` so that rings stay correct after
  // the object is moved, scaled or rotated.
  if (obj.rings && obj.rings.length && !(obj.type === 'path' && obj.pathData)) {
    const out = []
    for (const poly of normaliseRings(obj.rings)) for (const ring of poly) out.push(ring)
    return out
  }

  const x = obj.x || 0
  const y = obj.y || 0
  const w = obj.width || 0
  const h = obj.height || 0
  const cx = x + w / 2
  const cy = y + h / 2
  const rx = w / 2
  const ry = h / 2
  const rot = obj.rotation || 0

  if (obj.type === 'ellipse' || obj.type === 'powerCircle') {
    // Round to the flattening tolerance of the largest radius so a circle
    // stays smooth whether it is 2 mm or 2 m across.
    return [arcPoints(cx, cy, rx, ry, arcSegments(Math.max(Math.abs(rx), Math.abs(ry)), tol), 0, rot)]
  }
  if (obj.type === 'polygon' || obj.type === 'powerPolygon') {
    return [arcPoints(cx, cy, rx, ry, Math.max(3, obj.points || 5), -Math.PI / 2, rot)]
  }
  if (obj.type === 'star' || obj.type === 'powerStar') {
    const n = Math.max(2, obj.points || 5)
    const inner = (obj.innerRadius || 50) / 100
    const pts = []
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2
      const rr = i % 2 === 0 ? 1 : inner
      pts.push([cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr])
    }
    return [rot ? pts.map(([px, py]) => rotatePoint(px, py, cx, cy, rot)) : pts]
  }
  if (obj.type === 'spiral') {
    const turns = obj.turns || 5
    const n = turns * 24
    const pts = []
    for (let i = 0; i <= n; i++) {
      const a = (i / 24) * Math.PI * 2
      const r = (i / n) * 0.92
      pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r])
    }
    return [pts]
  }
  if (obj.type === 'path' && obj.pathData) {
    // pathData is stored relative to the object's top-left; scale it to
    // the object's on-page size so geometry matches what is drawn.
    const subpaths = parsePathData(obj.pathData)
    const scaleX = obj.width && obj.pathWidth ? obj.width / obj.pathWidth : 1
    const scaleY = obj.height && obj.pathHeight ? obj.height / obj.pathHeight : 1
    const rings = []
    for (const sp of subpaths) {
      let pts = sp.map(([px, py]) => [x + px * scaleX, y + py * scaleY])
      if (pts.length > 2 && dist(pts[0], pts[pts.length - 1]) > POINT_EPS) {
        // leave open subpaths open; ring() below closes them
      }
      if (rot) pts = pts.map(([px, py]) => rotatePoint(px, py, cx, cy, rot))
      rings.push(pts)
    }
    return rings
  }
  if (obj.type === 'line' || obj.type === 'curve' || obj.type === 'freehand' || obj.type === 'pen') {
    const pts = [
      [x, y + h / 2],
      [x + w * 0.25, y + h * 0.15],
      [x + w * 0.5, y + h * 0.6],
      [x + w * 0.75, y + h * 0.1],
      [x + w, y + h / 2],
    ]
    if (rot) return [pts.map(([px, py]) => rotatePoint(px, py, cx, cy, rot))]
    return [pts]
  }

  const box = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
  return [rot ? box.map(([px, py]) => rotatePoint(px, py, cx, cy, rot)) : box]
}

/** Bounding box of curve-preserving subpaths. */
export function subpathsBounds(subs) {
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
  for (const sp of subs) {
    note(sp.start[0], sp.start[1])
    for (const sg of sp.segs) {
      if (sg.c1) note(sg.c1[0], sg.c1[1])
      if (sg.c2) note(sg.c2[0], sg.c2[1])
      note(sg.to[0], sg.to[1])
    }
  }
  if (!isFinite(minX)) return null
  return { minX, minY, maxX, maxY, width: maxX - minX || 1, height: maxY - minY || 1 }
}

/** Apply an affine/point transform to curve-preserving subpaths. */
export function transformSubpaths(subs, fn) {
  const out = []
  for (const sp of subs) {
    const nsp = { start: fn(sp.start[0], sp.start[1]), closed: !!sp.closed, segs: [] }
    for (const sg of sp.segs) {
      if (sg.type === 'line') nsp.segs.push({ type: 'line', to: fn(sg.to[0], sg.to[1]) })
      else nsp.segs.push({ type: 'cubic', c1: fn(sg.c1[0], sg.c1[1]), c2: fn(sg.c2[0], sg.c2[1]), to: fn(sg.to[0], sg.to[1]) })
    }
    out.push(nsp)
  }
  return out
}

const KAPPA = 0.5522847498307936

function ellipseSubpaths(cx, cy, rx, ry) {
  const kx = rx * KAPPA
  const ky = ry * KAPPA
  return [
    {
      start: [cx + rx, cy],
      closed: true,
      segs: [
        { type: 'cubic', c1: [cx + rx, cy + ky], c2: [cx + kx, cy + ry], to: [cx, cy + ry] },
        { type: 'cubic', c1: [cx - kx, cy + ry], c2: [cx - rx, cy + ky], to: [cx - rx, cy] },
        { type: 'cubic', c1: [cx - rx, cy - ky], c2: [cx - kx, cy - ry], to: [cx, cy - ry] },
        { type: 'cubic', c1: [cx + kx, cy - ry], c2: [cx + rx, cy - ky], to: [cx + rx, cy] },
      ],
    },
  ]
}

function polygonSubpaths(pts, closed = true) {
  if (pts.length < 2) return []
  const segs = []
  for (let i = 1; i < pts.length; i++) segs.push({ type: 'line', to: pts[i] })
  if (closed) segs.push({ type: 'line', to: pts[0] })
  return [{ start: pts[0], closed, segs }]
}

/**
 * Curve-preserving subpaths (absolute page coordinates) for any object.
 * Exporters use this so Bézier curves survive to SVG/PDF/EPS instead of
 * being written out as polylines.
 */
export function objectToSegments(obj) {
  const x = obj.x || 0
  const y = obj.y || 0
  const w = obj.width || 0
  const h = obj.height || 0
  const cx = x + w / 2
  const cy = y + h / 2
  const rx = w / 2
  const ry = h / 2
  const rot = obj.rotation || 0
  const tf = (px, py) => (rot ? rotatePoint(px, py, cx, cy, rot) : [px, py])

  let subs = null

  if (obj.type === 'rect' || obj.type === 'image' || obj.type === 'text') {
    subs = polygonSubpaths([[x, y], [x + w, y], [x + w, y + h], [x, y + h]])
  } else if (obj.type === 'ellipse' || obj.type === 'powerCircle') {
    subs = ellipseSubpaths(cx, cy, rx, ry)
  } else if (obj.type === 'polygon' || obj.type === 'powerPolygon') {
    const n = Math.max(3, obj.points || 5)
    const pts = []
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry])
    }
    subs = polygonSubpaths(pts)
  } else if (obj.type === 'star' || obj.type === 'powerStar') {
    const n = Math.max(2, obj.points || 5)
    const inner = (obj.innerRadius || 50) / 100
    const pts = []
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2
      const rr = i % 2 === 0 ? 1 : inner
      pts.push([cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr])
    }
    subs = polygonSubpaths(pts)
  } else if (obj.type === 'path' && obj.pathData) {
    const scaleX = obj.width && obj.pathWidth ? obj.width / obj.pathWidth : 1
    const scaleY = obj.height && obj.pathHeight ? obj.height / obj.pathHeight : 1
    subs = transformSubpaths(parsePathSegments(obj.pathData), (px, py) => tf(x + px * scaleX, y + py * scaleY))
  } else {
    // Everything else (spiral, freehand, line, curve, unknown): polyline.
    subs = objectToRings(obj).map((ring) => polygonSubpaths(ring, true)[0]).filter(Boolean)
    return subs
  }

  return transformSubpaths(subs, tf)
}

export function objectToMultiPolygon(obj) {
  const rings = objectToRings(obj)
  if (!rings.length) return [[[]]]
  return [[rings[0], ...rings.slice(1)]]
}

export function multiPolygonToRings(mp) {
  const out = []
  for (const poly of mp) for (const ring of poly) out.push(ring)
  return out
}

/** Bounding box of a MultiPolygon. */
export function multiPolygonBounds(mp) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const poly of mp) {
    for (const ring of poly) {
      for (const [px, py] of ring) {
        if (px < minX) minX = px
        if (px > maxX) maxX = px
        if (py < minY) minY = py
        if (py > maxY) maxY = py
      }
    }
  }
  if (!isFinite(minX)) return null
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

/** MultiPolygon -> relocatable object piece (pathData relative to its box). */
export function multiPolygonToShape(mp, base) {
  const b = multiPolygonBounds(mp)
  if (!b) return null

  const parts = []
  for (const poly of mp) {
    for (const ring of poly) {
      // Drop an explicit closing vertex - the Z already closes the ring.
      const pts = ring.length > 2 && Math.abs(ring[0][0] - ring[ring.length - 1][0]) < POINT_EPS && Math.abs(ring[0][1] - ring[ring.length - 1][1]) < POINT_EPS
        ? ring.slice(0, -1)
        : ring
      pts.forEach(([px, py], i) => {
        parts.push(`${i === 0 ? 'M' : 'L'}${+(px - b.minX).toFixed(3)},${+(py - b.minY).toFixed(3)}`)
      })
      parts.push('Z')
    }
  }

  return {
    ...(base || {}),
    type: 'path',
    pathData: parts.join(' '),
    pathWidth: Math.max(b.width, 0.01),
    pathHeight: Math.max(b.height, 0.01),
    rings: mp,
    x: b.minX,
    y: b.minY,
    width: Math.max(b.width, 0.01),
    height: Math.max(b.height, 0.01),
  }
}

/* ---------------------------- boolean ops -------------------------- */

export function union(...geoms) {
  return pc.union(...geoms)
}

export function intersection(a, b) {
  return pc.intersection(a, b)
}

export function difference(a, b) {
  return pc.difference(a, b)
}

export function xor(a, b) {
  return pc.xor(a, b)
}

/* --------------------------- simplification ------------------------ */

/** Douglas-Peucker polyline simplification. */
export function simplify(points, tolerance) {
  if (!points || points.length < 3 || tolerance <= 0) return points || []
  const tol2 = tolerance * tolerance

  const segDistSq = (p, a, b) => {
    let x = a[0]
    let y = a[1]
    let dx = b[0] - x
    let dy = b[1] - y
    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)
      if (t > 1) {
        x = b[0]
        y = b[1]
      } else if (t > 0) {
        x += dx * t
        y += dy * t
      }
    }
    dx = p[0] - x
    dy = p[1] - y
    return dx * dx + dy * dy
  }

  const out = []
  const stack = [[0, points.length - 1]]
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1

  while (stack.length) {
    const [first, last] = stack.pop()
    let maxD = 0
    let index = -1
    for (let i = first + 1; i < last; i++) {
      const d = segDistSq(points[i], points[first], points[last])
      if (d > maxD) {
        maxD = d
        index = i
      }
    }
    if (maxD > tol2 && index !== -1) {
      keep[index] = 1
      stack.push([first, index], [index, last])
    }
  }

  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i])
  return out
}

/* ------------------------------ offsetting ------------------------- */

/**
 * Offset a closed ring by `delta`. Positive grows the ring outward,
 * negative shrinks it inward. Uses mitred angle bisectors followed by a
 * self-union cleanup, which removes the loops mitring produces on
 * concave corners.
 */
export function offsetRing(ring, delta) {
  const pts = ring.slice()
  if (pts.length > 2 && dist(pts[0], pts[pts.length - 1]) < POINT_EPS) pts.pop()
  const n = pts.length
  if (n < 3) return ring

  const ccw = signedArea(pts) > 0
  // In this project's screen space (y down) a positive `delta` must grow the
  // ring, so the outward direction is the opposite of the mathematical one.
  const dir = ccw ? -1 : 1
  const out = []

  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]
    const cur = pts[i]
    const next = pts[(i + 1) % n]

    let e1x = cur[0] - prev[0]
    let e1y = cur[1] - prev[1]
    let e2x = next[0] - cur[0]
    let e2y = next[1] - cur[1]
    const l1 = Math.hypot(e1x, e1y) || 1
    const l2 = Math.hypot(e2x, e2y) || 1
    e1x /= l1
    e1y /= l1
    e2x /= l2
    e2y /= l2

    // outward normals for a counter-clockwise ring
    const n1x = e1y * dir
    const n1y = -e1x * dir
    const n2x = e2y * dir
    const n2y = -e2x * dir

    let bx = n1x + n2x
    let by = n1y + n2y
    const bl = Math.hypot(bx, by)
    if (bl < 1e-9) {
      out.push([cur[0] + n1x * delta, cur[1] + n1y * delta])
      continue
    }
    bx /= bl
    by /= bl
    // mitre length
    const cosHalf = bx * n1x + by * n1y
    const scale = Math.abs(cosHalf) < 1e-6 ? 1 : 1 / cosHalf
    const m = Math.max(-4, Math.min(4, scale))
    out.push([cur[0] + bx * delta * m, cur[1] + by * delta * m])
  }
  return out
}

/** Offset a whole MultiPolygon (cleaned up with a self-union). */
export function offsetMultiPolygon(mp, delta) {
  if (!delta) return mp
  const offset = []
  for (const poly of mp) {
    const newPoly = []
    for (let r = 0; r < poly.length; r++) {
      const isHole = r > 0
      const ring = offsetRing(poly[r], isHole ? -delta : delta)
      newPoly.push(ring)
    }
    offset.push(newPoly)
  }
  try {
    return pc.union(offset)
  } catch (e) {
    return offset
  }
}

/* ------------------------------- knife ----------------------------- */

/**
 * Split a MultiPolygon with the infinite line through p1 -> p2.
 * Returns [leftGeom, rightGeom] (each may be empty).
 */
export function splitByLine(mp, p1, p2) {
  const b = multiPolygonBounds(mp)
  if (!b) return [mp, null]

  const span = Math.max(b.width, b.height) * 10 + 1000
  const dx = p2[0] - p1[0]
  const dy = p2[1] - p1[1]
  const len = Math.hypot(dx, dy)
  if (len < POINT_EPS) return [mp, null]
  const ux = dx / len
  const uy = dy / len
  // perpendicular
  const nx = -uy
  const ny = ux

  // a very large quad on each side of the line
  const mk = (side) => {
    const far = span
    const a = [p1[0] - ux * far, p1[1] - uy * far]
    const c = [p2[0] + ux * far, p2[1] + uy * far]
    return [[[
      a,
      c,
      [c[0] + nx * side * far, c[1] + ny * side * far],
      [a[0] + nx * side * far, a[1] + ny * side * far],
    ]]]
  }

  let left = null
  let right = null
  try {
    left = pc.intersection(mp, mk(1))
  } catch (e) {
    left = null
  }
  try {
    right = pc.intersection(mp, mk(-1))
  } catch (e) {
    right = null
  }
  return [left, right]
}

/* -------------------------------- HPGL ----------------------------- */

/** Convert geometry to HPGL (PLT) pen commands, in millimetres. */
export function multiPolygonToHPGL(mp, opts = {}) {
  const pen = opts.pen || 1
  const scale = opts.unitsPerMm || 40 // 1016 units/inch ~= 40/mm
  const lines = [`IN;`, `SP${pen};`]
  for (const poly of mp) {
    for (const ring of poly) {
      if (ring.length < 2) continue
      const pts = simplify(ring, opts.tolerance || 0.05)
      const [fx, fy] = pts[0]
      lines.push(`PU${Math.round(fx * scale)},${Math.round(fy * scale)};`)
      // draw the ring with bounded chunks (HPGL line limits)
      let chunk = []
      for (let i = 1; i < pts.length; i++) {
        chunk.push(`PA${Math.round(pts[i][0] * scale)},${Math.round(pts[i][1] * scale)}`)
        if (chunk.length >= 8) {
          lines.push(`PD${chunk.join(',')};`)
          chunk = []
        }
      }
      if (chunk.length) lines.push(`PD${chunk.join(',')};`)
      const [lx, ly] = pts[pts.length - 1]
      if (Math.abs(lx - fx) > 1e-6 || Math.abs(ly - fy) > 1e-6) {
        lines.push(`PA${Math.round(fx * scale)},${Math.round(fy * scale)};`)
      }
    }
  }
  lines.push('PU;')
  return lines.join('\n')
}
