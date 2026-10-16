/* ------------------------------------------------------------------ *
 * Parametric "Power Shapes" geometry for VinylCut Studio.
 *
 * Pure, framework-free math: every generator is deterministic and
 * returns an array of [x, y] points in the 0..100 local design space
 * used by the canvas shape renderers, centred on (cx, cy) and sized by
 * the (rx, ry) radii.
 *
 * Shapes start at the top (-90deg); the spiral starts at its centre.
 * Rotation is applied by the caller (CSS/SVG transform), never here.
 * ------------------------------------------------------------------ */

const TAU = Math.PI * 2
const TOP = -Math.PI / 2 // 12 o'clock, first vertex for stars/polygons

/** Hash any seed value into a stable unsigned 32-bit integer. */
export function normaliseSeed(seed) {
  if (seed == null) return 0
  const str = String(seed)
  let h = 2166136261 >>> 0 // FNV-1a offset basis
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Small, fast, seedable PRNG (Mulberry32). Same seed -> same stream, so
 * a "chaos" shape can be reproduced exactly from its stored seed.
 */
export function mulberry32(seed) {
  let a = normaliseSeed(seed)
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0))

/** Regular polygon. `sides` vertices evenly spaced, first at the top. */
export function polygonPoints({ sides = 5, cx = 50, cy = 50, rx = 50, ry = 50 } = {}) {
  const n = Math.max(3, Math.round(sides) || 3)
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = TOP + (i / n) * TAU
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry])
  }
  return pts
}

/**
 * Parametric star: `points` outer vertices with alternating outer/inner
 * radii. `innerRadius` is a percentage (0..100) of the outer radius.
 * The first vertex is the outer tip at the top.
 */
export function starPoints({ points = 5, innerRadius = 50, cx = 50, cy = 50, rx = 50, ry = 50 } = {}) {
  const n = Math.max(2, Math.round(points) || 5)
  const inner = clamp01(Number(innerRadius) / 100)
  const pts = []
  for (let i = 0; i < n * 2; i++) {
    const a = TOP + (i / (n * 2)) * TAU
    const r = i % 2 === 0 ? 1 : inner
    pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r])
  }
  return pts
}

/**
 * Chaos star: a star whose vertex radii are randomly jittered around
 * their base values. Deterministic for a given seed, and identical to
 * `starPoints` when `jitter` is 0. `jitter` is a 0..1 fraction.
 */
export function chaosStarPoints({ points = 5, innerRadius = 50, seed = 0, jitter = 0, cx = 50, cy = 50, rx = 50, ry = 50 } = {}) {
  const n = Math.max(2, Math.round(points) || 5)
  const inner = clamp01(Number(innerRadius) / 100)
  const j = clamp01(jitter)
  const rand = mulberry32(seed)
  const pts = []
  for (let i = 0; i < n * 2; i++) {
    const a = TOP + (i / (n * 2)) * TAU
    const base = i % 2 === 0 ? 1 : inner
    const noise = j === 0 ? 0 : (rand() * 2 - 1) * j
    const r = Math.max(0, base * (1 + noise))
    pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r])
  }
  return pts
}

/**
 * Archimedean spiral: radius grows by a constant amount per turn, so the
 * gaps between successive windings are equal.
 *
 * `spacing` is the radial growth per turn as a fraction of the outer
 * radius and defaults to `1 / turns`, which makes the spiral reach the
 * outer edge exactly. The spiral starts at its centre.
 */
export function archimedeanSpiralPoints({ turns = 5, spacing, cx = 50, cy = 50, rx = 50, ry = 50, samplesPerTurn = 24 } = {}) {
  const T = Math.max(0.01, Number(turns) || 5)
  const step = spacing == null || !Number.isFinite(Number(spacing)) ? 1 / T : Math.max(0, Number(spacing))
  const perTurn = Math.max(1, Math.round(samplesPerTurn) || 24)
  const n = Math.max(1, Math.round(T * perTurn))
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = i / perTurn // completed turns
    const a = t * TAU
    const r = t * step
    pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r])
  }
  return pts
}
