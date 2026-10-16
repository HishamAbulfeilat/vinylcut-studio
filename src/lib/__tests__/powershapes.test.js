import { describe, it, expect } from 'vitest'
import {
  normaliseSeed,
  mulberry32,
  polygonPoints,
  starPoints,
  chaosStarPoints,
  archimedeanSpiralPoints,
} from '../powershapes'

const centre = [50, 50]
const dist = ([x, y], [cx, cy] = centre) => Math.hypot(x - cx, y - cy)

describe('normaliseSeed', () => {
  it('is deterministic for the same input', () => {
    expect(normaliseSeed(42)).toBe(normaliseSeed(42))
    expect(normaliseSeed('chaos')).toBe(normaliseSeed('chaos'))
  })

  it('differs for different inputs and handles nullish', () => {
    expect(normaliseSeed('a')).not.toBe(normaliseSeed('b'))
    expect(normaliseSeed(null)).toBe(0)
    expect(normaliseSeed(undefined)).toBe(0)
  })
})

describe('mulberry32', () => {
  it('produces the same stream for the same seed', () => {
    const a = mulberry32(7)
    const b = mulberry32(7)
    for (let i = 0; i < 5; i++) expect(a()).toBe(b())
  })

  it('stays within [0, 1)', () => {
    const r = mulberry32('x')
    for (let i = 0; i < 50; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('polygonPoints', () => {
  it('returns one vertex per side, first at the top, all on the radius', () => {
    const pts = polygonPoints({ sides: 5 })
    expect(pts).toHaveLength(5)
    expect(dist(pts[0])).toBeCloseTo(50, 6)
    expect(pts[0][0]).toBeCloseTo(50, 6)
    expect(pts[0][1]).toBeCloseTo(0, 6)
    for (const p of pts) expect(dist(p)).toBeCloseTo(50, 6)
  })

  it('never drops below a triangle', () => {
    expect(polygonPoints({ sides: 1 })).toHaveLength(3)
    expect(polygonPoints({ sides: 0 })).toHaveLength(3)
  })
})

describe('starPoints', () => {
  it('alternates outer and inner radii over 2 * points vertices', () => {
    const pts = starPoints({ points: 5, innerRadius: 50 })
    expect(pts).toHaveLength(10)
    expect(dist(pts[0])).toBeCloseTo(50, 6)
    pts.forEach((p, i) => {
      expect(dist(p)).toBeCloseTo(i % 2 === 0 ? 50 : 25, 6)
    })
  })

  it('honours an explicit inner radius percentage', () => {
    const pts = starPoints({ points: 4, innerRadius: 20 })
    expect(dist(pts[1])).toBeCloseTo(10, 6)
  })

  it('always needs at least two points', () => {
    expect(starPoints({ points: 1 })).toHaveLength(4)
  })
})

describe('chaosStarPoints', () => {
  it('matches starPoints exactly when jitter is 0', () => {
    const chaos = chaosStarPoints({ points: 5, innerRadius: 50, seed: 99, jitter: 0 })
    const star = starPoints({ points: 5, innerRadius: 50 })
    expect(chaos).toEqual(star)
  })

  it('is reproducible for a given seed', () => {
    const a = chaosStarPoints({ points: 7, seed: 'abc', jitter: 0.6 })
    const b = chaosStarPoints({ points: 7, seed: 'abc', jitter: 0.6 })
    expect(a).toEqual(b)
  })

  it('varies the radii when jitter is applied', () => {
    const jittered = chaosStarPoints({ points: 5, seed: 3, jitter: 0.5 })
    const plain = starPoints({ points: 5 })
    expect(jittered).not.toEqual(plain)
  })

  it('keeps every vertex radius non-negative', () => {
    const pts = chaosStarPoints({ points: 12, innerRadius: 10, seed: 5, jitter: 1 })
    for (const p of pts) expect(dist(p)).toBeGreaterThanOrEqual(0)
  })
})

describe('archimedeanSpiralPoints', () => {
  it('starts at the centre and samples turns * samplesPerTurn + 1 points', () => {
    const pts = archimedeanSpiralPoints({ turns: 3, samplesPerTurn: 4 })
    expect(pts).toHaveLength(13)
    expect(pts[0]).toEqual([50, 50])
  })

  it('grows the radius monotonically', () => {
    const pts = archimedeanSpiralPoints({ turns: 4, samplesPerTurn: 8 })
    for (let i = 1; i < pts.length; i++) {
      expect(dist(pts[i])).toBeGreaterThanOrEqual(dist(pts[i - 1]) - 1e-9)
    }
  })

  it('reaches the outer edge with the default spacing', () => {
    const pts = archimedeanSpiralPoints({ turns: 3, samplesPerTurn: 4 })
    expect(dist(pts[pts.length - 1])).toBeCloseTo(50, 6)
  })

  it('applies an explicit spacing as a fraction per turn', () => {
    const pts = archimedeanSpiralPoints({ turns: 2, spacing: 0.25, samplesPerTurn: 6 })
    expect(dist(pts[pts.length - 1])).toBeCloseTo(25, 6)
  })
})
