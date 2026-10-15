/* ------------------------------------------------------------------ *
 * Continuous warp / envelope deformation for VinylCut Studio.
 *
 * Every warp is expressed as a smooth analytic map
 *
 *     f : (u, v) -> (u', v')      with u, v normalised to [0, 1]
 *
 * over the object's bounding box. Nothing here is discrete: the map is
 * evaluated per geometry vertex (vector art) or per output pixel (text
 * and bitmaps), so the deformation is genuinely continuous.
 *
 * Vector objects are warped exactly by pushing their own outline through
 * f, which keeps curves crisp. Text and raster art are warped with a
 * per-pixel inverse-sampled bilinear resample, so any content can be
 * deformed without slicing it into strips.
 * ------------------------------------------------------------------ */

import { flattenCubic, parsePathSegments, transformSubpaths } from './geometry.js'

export const WARP_TYPES = [
  'circle',
  'coons',
  'flag',
  'perspective',
  'skirt',
  'trapezoid',
  'wave',
  'arch',
  'bulge',
  'twist',
  'squeeze',
  'fisheye',
  'ripple',
]

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t)

/**
 * The forward warp map. `k` is the intensity in the range 0..1.
 * Unknown types return the identity map.
 */
export function warpPoint(type, u, v, k) {
  if (!(k > 0)) return [u, v]
  switch (type) {
    case 'wave': {
      return [u, v + k * 0.18 * Math.sin(u * Math.PI * 3)]
    }
    case 'ripple': {
      const r = Math.hypot(u - 0.5, v - 0.5) / 0.7071
      const s = 1 + k * 0.12 * Math.sin(r * Math.PI * 3)
      return [0.5 + (u - 0.5) * s, 0.5 + (v - 0.5) * s]
    }
    case 'flag': {
      const amp = 0.4 + 0.6 * v
      return [u + k * 0.05 * Math.sin(v * Math.PI), v + k * 0.28 * Math.sin(u * Math.PI * 3) * amp]
    }
    case 'circle': {
      // smooth radial bulge: unit scale at the rim, largest at the centre
      const x = u - 0.5
      const y = v - 0.5
      const r = Math.hypot(x, y) / 0.7071
      const s = 1 + k * 0.6 * (1 - r * r)
      return [0.5 + x * s, 0.5 + y * s]
    }
    case 'fisheye': {
      const x = u - 0.5
      const y = v - 0.5
      const r = Math.hypot(x, y) / 0.7071
      const s = 1 - k * 0.55 * r * r
      return [0.5 + x * s, 0.5 + y * s]
    }
    case 'bulge': {
      const s = 1 + k * 0.55 * Math.sin(Math.PI * clamp01(u))
      return [u, 0.5 + (v - 0.5) * s]
    }
    case 'arch': {
      return [u, v - k * 0.5 * Math.sin(Math.PI * u) * (1 - v)]
    }
    case 'coons': {
      // Coons patch: sineperturbed top and bottom edges, bilinear blend
      const top = -k * 0.18 * Math.sin(Math.PI * u)
      const bottom = k * 0.18 * Math.sin(Math.PI * u)
      return [u, v + (1 - v) * top + v * bottom]
    }
    case 'trapezoid': {
      const s = 1 + k * (2 * v - 1) * 0.85
      return [0.5 + (u - 0.5) * s, v]
    }
    case 'skirt': {
      const d = (u - 0.5) * 2
      return [0.5 + (u - 0.5) * (1 + k * 0.4 * d * d), v + k * 0.3 * d * d]
    }
    case 'perspective': {
      // bilinear map of the unit square onto a keystone quad
      const TL = [k * 0.45, 0]
      const TR = [1 - k * 0.45, k * 0.18]
      const BL = [0, 1]
      const BR = [1, 1]
      const mu = 1 - u
      const mv = 1 - v
      const x = mv * (mu * TL[0] + u * TR[0]) + v * (mu * BL[0] + u * BR[0])
      const y = mv * (mu * TL[1] + u * TR[1]) + v * (mu * BL[1] + u * BR[1])
      return [x, y]
    }
    case 'twist': {
      const a = k * Math.PI * (v - 0.5)
      const x = u - 0.5
      const y = v - 0.5
      const c = Math.cos(a)
      const s = Math.sin(a)
      return [0.5 + x * c - y * s, 0.5 + x * s + y * c]
    }
    case 'squeeze': {
      const s = 1 - k * 0.55 * Math.sin(Math.PI * clamp01(v))
      return [0.5 + (u - 0.5) * s, v]
    }
    default:
      return [u, v]
  }
}

/**
 * Map an absolute page point through a warp defined over `bounds`.
 */
export function warpPagePoint(type, k, bounds, px, py) {
  const w = bounds.width || 1
  const h = bounds.height || 1
  const u = (px - bounds.minX) / w
  const v = (py - bounds.minY) / h
  const [wu, wv] = warpPoint(type, u, v, k)
  return [bounds.minX + wu * w, bounds.minY + wv * h]
}

/**
 * Warp curve-preserving subpaths into polyline rings.
 *
 * Curves are adaptively flattened first, then *every* edge - including
 * originally straight ones - is recursively subdivided until the warped
 * result deviates from a straight line by no more than `tolerance`. That
 * last step is what makes the deformation genuinely continuous: a warped
 * rectangle edge follows the wave instead of collapsing to one chord.
 */
export function warpSubpaths(subs, bounds, type, intensity, tolerance = 0.05) {
  const k = Math.max(0, Math.min(2, (intensity || 0) / 100))
  const tol = Math.max(0.005, tolerance || 0.05)
  const map = (px, py) => warpPagePoint(type, k, bounds, px, py)

  const out = []
  for (const sp of subs) {
    // 1. flatten any curves into source-space points
    const src = [sp.start.slice()]
    let cx = sp.start[0]
    let cy = sp.start[1]
    for (const sg of sp.segs) {
      if (sg.type === 'line') src.push(sg.to.slice())
      else flattenCubic(cx, cy, sg.c1[0], sg.c1[1], sg.c2[0], sg.c2[1], sg.to[0], sg.to[1], tol * 0.5, src)
      cx = sg.to[0]
      cy = sg.to[1]
    }
    if (src.length < 2) continue

    // 2. warp, subdividing each edge while the warp bends it
    const pts = [map(src[0][0], src[0][1])]
    const emit = (ax, ay, bx, by, depth) => {
      const wa = map(ax, ay)
      const wb = map(bx, by)
      const mx = (ax + bx) / 2
      const my = (ay + by) / 2
      const wm = map(mx, my)
      const lx = (wa[0] + wb[0]) / 2
      const ly = (wa[1] + wb[1]) / 2
      const dev = Math.hypot(wm[0] - lx, wm[1] - ly)
      if (dev > tol && depth < 16) {
        emit(ax, ay, mx, my, depth + 1)
        emit(mx, my, bx, by, depth + 1)
      } else {
        pts.push(wb)
      }
    }
    for (let i = 1; i < src.length; i++) emit(src[i - 1][0], src[i - 1][1], src[i][0], src[i][1], 0)

    if (pts.length > 1) out.push({ points: pts, closed: !!sp.closed })
  }
  return out
}

/** Warp a single SVG path string, returning a new path string. */
export function warpPathData(pathData, bounds, type, intensity) {
  const subs = warpSubpaths(parsePathSegments(pathData), bounds, type, intensity)
  return subs
    .map((sp) => {
      const body = sp.points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(3)},${y.toFixed(3)}`).join(' ')
      return body + (sp.closed ? ' Z' : '')
    })
    .join(' ')
}

/* ---------------------- raster (bitmap / text) --------------------- */

function makeCanvas(w, h) {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

/**
 * Continuous inverse-sampled warp of a raster.
 *
 * For every pixel of the output we solve f(u, v) = (U, V) with a few
 * Newton steps on the analytic map and sample the source bilinearly.
 * That is a real resample of the continuous deformation - no strips, no
 * visible banding seams.
 */
export function warpRaster(src, type, intensity, opts = {}) {
  const out = warpRasterToCanvas(src, type, intensity, opts)
  if (!out) return null
  return out.toDataURL('image/png')
}

export function warpRasterToCanvas(src, type, intensity, opts = {}) {
  if (!src || !src.width || !src.height) return null
  const k = Math.max(0, Math.min(2, (intensity || 0) / 100))
  if (!(k > 0) || typeof document === 'undefined') return null

  const pad = opts.pad != null ? opts.pad : 0.4
  const scale = opts.scale || 1
  const srcW = src.width
  const srcH = src.height
  const outW = Math.round(srcW * (1 + 2 * pad))
  const outH = Math.round(srcH * (1 + 2 * pad))

  const out = makeCanvas(outW * scale, outH * scale)
  if (!out) return null
  const octx = out.getContext('2d')
  if (!octx) return null

  const read = makeCanvas(srcW, srcH)
  if (!read) return null
  const rctx = read.getContext('2d', { willReadFrequently: true })
  rctx.clearRect(0, 0, srcW, srcH)
  rctx.drawImage(src, 0, 0, srcW, srcH)
  let sdata
  try {
    sdata = rctx.getImageData(0, 0, srcW, srcH).data
  } catch {
    return null
  }

  const odata = octx.createImageData(out.width, out.height)

  // Newton inversion of the forward map with a numeric Jacobian.
  const invert = (U, V) => {
    let u = U
    let v = V
    const e = 1e-4
    for (let it = 0; it < 6; it++) {
      const [fu, fv] = warpPoint(type, u, v, k)
      const ru = fu - U
      const rv = fv - V
      if (ru * ru + rv * rv < 1e-12) break
      const [a1, b1] = warpPoint(type, u + e, v, k)
      const [a2, b2] = warpPoint(type, u, v + e, k)
      const j11 = (a1 - fu) / e
      const j21 = (b1 - fv) / e
      const j12 = (a2 - fu) / e
      const j22 = (b2 - fv) / e
      const det = j11 * j22 - j12 * j21
      if (Math.abs(det) < 1e-9) break
      const du = (ru * j22 - rv * j12) / det
      const dv = (rv * j11 - ru * j21) / det
      u -= du
      v -= dv
    }
    return [u, v]
  }

  const invScale = 1 / scale
  for (let py = 0; py < out.height; py++) {
    const V = (py + 0.5) * invScale / srcH - pad
    for (let px = 0; px < out.width; px++) {
      const U = (px + 0.5) * invScale / srcW - pad
      if (U < -0.02 || U > 1.02 || V < -0.02 || V > 1.02) continue
      const [u, v] = invert(U, V)
      if (u < 0 || u > 1 || v < 0 || v > 1) continue

      const fx = u * srcW - 0.5
      const fy = v * srcH - 0.5
      const x0 = Math.floor(fx)
      const y0 = Math.floor(fy)
      const tx = fx - x0
      const ty = fy - y0
      const cx0 = x0 < 0 ? 0 : x0 >= srcW ? srcW - 1 : x0
      const cy0 = y0 < 0 ? 0 : y0 >= srcH ? srcH - 1 : y0
      const cx1 = x0 + 1 < 0 ? 0 : x0 + 1 >= srcW ? srcW - 1 : x0 + 1
      const cy1 = y0 + 1 < 0 ? 0 : y0 + 1 >= srcH ? srcH - 1 : y0 + 1

      const i00 = (cy0 * srcW + cx0) * 4
      const i10 = (cy0 * srcW + cx1) * 4
      const i01 = (cy1 * srcW + cx0) * 4
      const i11 = (cy1 * srcW + cx1) * 4
      const w00 = (1 - tx) * (1 - ty)
      const w10 = tx * (1 - ty)
      const w01 = (1 - tx) * ty
      const w11 = tx * ty
      const di = (py * out.width + px) * 4
      const a = w00 * sdata[i00 + 3] + w10 * sdata[i10 + 3] + w01 * sdata[i01 + 3] + w11 * sdata[i11 + 3]
      if (a < 0.5) continue
      odata.data[di] = w00 * sdata[i00] + w10 * sdata[i10] + w01 * sdata[i01] + w11 * sdata[i11]
      odata.data[di + 1] = w00 * sdata[i00 + 1] + w10 * sdata[i10 + 1] + w01 * sdata[i01 + 1] + w11 * sdata[i11 + 1]
      odata.data[di + 2] = w00 * sdata[i00 + 2] + w10 * sdata[i10 + 2] + w01 * sdata[i01 + 2] + w11 * sdata[i11 + 2]
      odata.data[di + 3] = a
    }
  }

  octx.putImageData(odata, 0, 0)
  return out
}

export { makeCanvas, transformSubpaths }
