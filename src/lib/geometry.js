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

/* --------------------------- path parsing -------------------------- */

/**
 * Flatten SVG path data into an array of subpaths (each an array of
 * [x, y] points). Supports M m L l H h V v Q q T t C c S s Z z.
 * Curves are sampled, which is all we need for cutting and offsetting.
 */
export function parsePathData(d, curveSteps = 16) {
  if (!d || typeof d !== 'string') return []
  const tokens = d.match(/[MmLlHhVvQqTtCcSsZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi)
  if (!tokens) return []

  const subpaths = []
  let cur = []
  let cx = 0
  let cy = 0
  let startX = 0
  let startY = 0
  let prevCtrlX = null
  let prevCtrlY = null
  let cmd = null
  let i = 0

  const num = () => parseFloat(tokens[i++])
  const push = (x, y) => cur.push([x, y])
  const flush = () => {
    if (cur.length > 1) subpaths.push(cur)
    cur = []
  }
  const sampleQuad = (x0, y0, qx, qy, x1, y1) => {
    for (let s = 1; s <= curveSteps; s++) {
      const t = s / curveSteps
      const mt = 1 - t
      push(
        mt * mt * x0 + 2 * mt * t * qx + t * t * x1,
        mt * mt * y0 + 2 * mt * t * qy + t * t * y1,
      )
    }
  }
  const sampleCubic = (x0, y0, a1x, a1y, a2x, a2y, x1, y1) => {
    for (let s = 1; s <= curveSteps; s++) {
      const t = s / curveSteps
      const mt = 1 - t
      push(
        mt * mt * mt * x0 + 3 * mt * mt * t * a1x + 3 * mt * t * t * a2x + t * t * t * x1,
        mt * mt * mt * y0 + 3 * mt * mt * t * a1y + 3 * mt * t * t * a2y + t * t * t * y1,
      )
    }
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
        push(cx, cy)
        prevCtrlX = prevCtrlY = null
        break
      }
      case 'L': {
        cx = num() + (rel ? cx : 0)
        cy = num() + (rel ? cy : 0)
        push(cx, cy)
        prevCtrlX = prevCtrlY = null
        break
      }
      case 'H': {
        cx = num() + (rel ? cx : 0)
        push(cx, cy)
        prevCtrlX = prevCtrlY = null
        break
      }
      case 'V': {
        cy = num() + (rel ? cy : 0)
        push(cx, cy)
        prevCtrlX = prevCtrlY = null
        break
      }
      case 'Q': {
        const qx = num() + (rel ? cx : 0)
        const qy = num() + (rel ? cy : 0)
        const x1 = num() + (rel ? cx : 0)
        const y1 = num() + (rel ? cy : 0)
        sampleQuad(cx, cy, qx, qy, x1, y1)
        prevCtrlX = qx
        prevCtrlY = qy
        cx = x1
        cy = y1
        break
      }
      case 'T': {
        const x1 = num() + (rel ? cx : 0)
        const y1 = num() + (rel ? cy : 0)
        const qx = prevCtrlX === null ? cx : 2 * cx - prevCtrlX
        const qy = prevCtrlY === null ? cy : 2 * cy - prevCtrlY
        sampleQuad(cx, cy, qx, qy, x1, y1)
        prevCtrlX = qx
        prevCtrlY = qy
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
        sampleCubic(cx, cy, a1x, a1y, a2x, a2y, x1, y1)
        prevCtrlX = a2x
        prevCtrlY = a2y
        cx = x1
        cy = y1
        break
      }
      case 'S': {
        const a2x = num() + (rel ? cx : 0)
        const a2y = num() + (rel ? cy : 0)
        const x1 = num() + (rel ? cx : 0)
        const y1 = num() + (rel ? cy : 0)
        const a1x = prevCtrlX === null ? cx : 2 * cx - prevCtrlX
        const a1y = prevCtrlY === null ? cy : 2 * cy - prevCtrlY
        sampleCubic(cx, cy, a1x, a1y, a2x, a2y, x1, y1)
        prevCtrlX = a2x
        prevCtrlY = a2y
        cx = x1
        cy = y1
        break
      }
      case 'Z': {
        cx = startX
        cy = startY
        flush()
        prevCtrlX = prevCtrlY = null
        break
      }
      default:
        i++
    }
  }
  flush()
  return subpaths
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
export function objectToRings(obj) {
  // Objects carrying `rings` without own path data reuse them as-is. Path
  // objects always rebuild from `pathData` so that rings stay correct after
  // the object is moved, scaled or rotated.
  if (obj.rings && obj.rings.length && !(obj.type === 'path' && obj.pathData)) {
    const out = []
    for (const poly of obj.rings) for (const ring of poly) out.push(ring)
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
    return [arcPoints(cx, cy, rx, ry, 64, 0, rot)]
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
