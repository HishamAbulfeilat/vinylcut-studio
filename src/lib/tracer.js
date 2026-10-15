/* ------------------------------------------------------------------ *
 * Raster -> vector tracer.
 *
 * Not a port of any existing tracer: it thresholds (or colour-quantises)
 * the bitmap, extracts the pixel-boundary loops of each region with a
 * directed-edge walk, then simplifies them with Douglas-Peucker.
 * ------------------------------------------------------------------ */

import { simplify, multiPolygonToShape } from './geometry'

/** Downscale so the longest side is at most `max`. */
export function fitSize(w, h, max) {
  const s = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)), scale: s }
}

/** Read an image source into {data, width, height} at a bounded size. */
export function readPixels(source, max = 320) {
  const naturalW = source.naturalWidth || source.width
  const naturalH = source.naturalHeight || source.height
  const { w, h, scale } = fitSize(naturalW, naturalH, max)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(source, 0, 0, w, h)
  return { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h, scale }
}

/** k-means colour quantisation. Returns [[r,g,b], ...]. */
export function quantizePalette(data, count) {
  const pixels = []
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 16) continue
    pixels.push([data[i], data[i + 1], data[i + 2]])
  }
  if (!pixels.length) return [[0, 0, 0]]

  // seed with an evenly spaced sample
  const k = Math.max(2, Math.min(16, count || 8))
  let centroids = []
  for (let i = 0; i < k; i++) {
    centroids.push(pixels[Math.floor((i / k) * (pixels.length - 1))].slice())
  }

  for (let iter = 0; iter < 8; iter++) {
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0])
    for (const p of pixels) {
      let best = 0
      let bestD = Infinity
      for (let c = 0; c < k; c++) {
        const dr = p[0] - centroids[c][0]
        const dg = p[1] - centroids[c][1]
        const db = p[2] - centroids[c][2]
        const d = dr * dr + dg * dg + db * db
        if (d < bestD) {
          bestD = d
          best = c
        }
      }
      sums[best][0] += p[0]
      sums[best][1] += p[1]
      sums[best][2] += p[2]
      sums[best][3] += 1
    }
    for (let c = 0; c < k; c++) {
      if (sums[c][3] > 0) {
        centroids[c] = [
          Math.round(sums[c][0] / sums[c][3]),
          Math.round(sums[c][1] / sums[c][3]),
          Math.round(sums[c][2] / sums[c][3]),
        ]
      }
    }
  }
  return centroids
}

/**
 * Extract the closed boundary loops of a binary mask by walking the
 * pixel-boundary edges. Returns rings as pixel-corner coordinates.
 */
export function maskToRings(mask, w, h) {
  const filled = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x]
  const nextMap = new Map()
  const key = (x, y) => y * (w + 2) + x
  const addEdge = (x1, y1, x2, y2) => {
    const k = key(x1, y1)
    if (!nextMap.has(k)) nextMap.set(k, [])
    nextMap.get(k).push([x2, y2])
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!filled(x, y)) continue
      if (!filled(x, y - 1)) addEdge(x, y, x + 1, y)
      if (!filled(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1)
      if (!filled(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1)
      if (!filled(x - 1, y)) addEdge(x, y + 1, x, y)
    }
  }

  const rings = []
  for (const [startKey, dests] of Array.from(nextMap.entries())) {
    while (dests.length) {
      const ring = []
      let ck = startKey
      let cx = ck % (w + 2)
      let cy = Math.floor(ck / (w + 2))
      let guard = 0
      const limit = (w + 2) * (h + 2) * 4
      while (guard++ < limit) {
        ring.push([cx, cy])
        const list = nextMap.get(key(cx, cy))
        if (!list || !list.length) break
        const [nx, ny] = list.pop()
        cx = nx
        cy = ny
        if (cx === startKey % (w + 2) && cy === Math.floor(startKey / (w + 2))) break
      }
      if (ring.length > 3) rings.push(ring)
    }
  }
  return rings
}

function ringsToMultiPolygon(rings) {
  const mp = []
  for (const ring of rings) {
    mp.push([ring])
  }
  return mp
}

/**
 * Trace a pixel buffer.
 *
 * options:
 *   mode      'outline' (black & white) | 'color' (quantised layers)
 *   threshold 0..255 luminance cut for outline mode
 *   colors    palette size for colour mode
 *   smoothing simplification tolerance in pixels
 *   noise     minimum ring area in pixels
 */
export function tracePixels(pixels, options = {}) {
  const { data, width: w, height: h } = pixels
  const mode = options.mode || 'outline'
  const smoothing = options.smoothing == null ? 1 : options.smoothing
  const noise = options.noise == null ? 2 : options.noise
  const results = []

  const luminance = (i) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]

  const buildMask = (test) => {
    const mask = new Uint8Array(w * h)
    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      mask[p] = data[i + 3] > 16 && test(i) ? 1 : 0
    }
    return mask
  }

  const emit = (mask, color) => {
    const rings = maskToRings(mask, w, h)

    // Group rings into polygons: a ring inside an odd number of other rings
    // is a hole of the smallest ring that contains it.
    const cleaned = []
    for (const ring of rings) {
      const s = simplify(ring, Math.max(0.2, smoothing) * 0.75)
      if (s.length > 3 && Math.abs(ringArea(s)) >= noise) cleaned.push(s)
    }
    if (!cleaned.length) return []

    const depth = cleaned.map((ring, i) => {
      let d = 0
      const [px, py] = ring[0]
      for (let j = 0; j < cleaned.length; j++) {
        if (i === j) continue
        if (pointInRing(px, py, cleaned[j])) d += 1
      }
      return d
    })

    const polys = []
    const parentOf = new Map()
    cleaned.forEach((ring, i) => {
      if (depth[i] % 2 === 0) {
        polys.push([ring])
      } else {
        // attach as a hole of the smallest enclosing even-depth ring
        let best = -1
        let bestArea = Infinity
        for (let j = 0; j < cleaned.length; j++) {
          if (j === i || depth[j] % 2 !== 0) continue
          if (!pointInRing(ring[0][0], ring[0][1], cleaned[j])) continue
          const a = Math.abs(ringArea(cleaned[j]))
          if (a < bestArea) {
            bestArea = a
            best = j
          }
        }
        if (best >= 0) parentOf.set(i, best)
      }
    })

    parentOf.forEach((parentIdx, i) => {
      const poly = polys.find(p => p[0] === cleaned[parentIdx])
      if (poly) poly.push(cleaned[i])
      else polys.push([cleaned[i]])
    })

    return polys.length ? [{ rings: polys, color }] : []
  }

  if (mode === 'color') {
    const palette = quantizePalette(data, options.colors || 8)
    // Reject near-identical palette entries that k-means sometimes keeps
    const kept = []
    for (const c of palette) {
      if (!kept.some(k => Math.abs(k[0] - c[0]) + Math.abs(k[1] - c[1]) + Math.abs(k[2] - c[2]) < 12)) kept.push(c)
    }
    for (const c of kept) {
      const mask = buildMask((i) => {
        const dr = data[i] - c[0]
        const dg = data[i + 1] - c[1]
        const db = data[i + 2] - c[2]
        return dr * dr + dg * dg + db * db < 3000
      })
      results.push(...emit(mask, `rgb(${c[0]},${c[1]},${c[2]})`))
    }
  } else {
    const t = options.threshold == null ? 128 : options.threshold
    const mask = buildMask((i) => luminance(i) < t)
    results.push(...emit(mask, options.color || '#000000'))
  }

  return results
}

function ringArea(ring) {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1])
  }
  return a / 2
}

/** Even-odd point-in-ring test. */
function pointInRing(x, y, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/**
 * Full pipeline: image element -> array of shape objects placed inside
 * the given page rectangle.
 */
export function vectorizeImage(source, rect, options = {}) {
  const pixels = readPixels(source, options.maxSize || 320)
  const traced = tracePixels(pixels, options)
  const sx = rect.width / pixels.width
  const sy = rect.height / pixels.height

  const shapes = []
  for (const region of traced) {
    // region.rings is a list of polygons, each [outer, hole, ...]
    const mp = region.rings.map(poly =>
      poly.map(ring => ring.map(([px, py]) => [rect.x + px * sx, rect.y + py * sy])),
    )
    const shape = multiPolygonToShape(mp, {
      fill: { type: 'solid', color: region.color },
      stroke: { color: region.color, width: 0, style: 'solid' },
      opacity: 100,
      isVectorized: true,
    })
    if (shape) shapes.push(shape)
  }
  return shapes
}
