import { describe, it, expect } from 'vitest'
import { weld, punchOut, trim, cookieCut } from '../shapeops'
import { objectToMultiPolygon, objectToRings, multiPolygonBounds, ringArea } from '../geometry'

const rect = (id, x, y, width, height, extra = {}) => ({
  id, type: 'rectangle', x, y, width, height,
  fill: { color: '#ff0000' }, stroke: { color: '#000000' }, ...extra,
})

let n = 0
const ctx = () => ({
  generateId: () => `new-${++n}`,
  currentFill: { color: '#cccccc' },
  currentStroke: { color: '#111111' },
})

// Net area of an object's geometry: outer rings minus holes.
const area = (obj) => {
  let a = 0
  for (const poly of objectToMultiPolygon(obj)) {
    poly.forEach((ring, i) => { a += (i === 0 ? 1 : -1) * Math.abs(ringArea(ring)) })
  }
  return a
}

// A: 0..20 square, B: 10..30 square -> 10x10 overlap
const A = rect('a', 0, 0, 20, 20)
const B = rect('b', 10, 10, 20, 20)
const C = rect('c', 100, 100, 5, 5)

describe('weld', () => {
  it('merges overlapping shapes into one path with the union area', () => {
    const res = weld([A, B], ['a', 'b'], ctx())
    expect(res.objects).toHaveLength(1)
    expect(res.selectedIds).toEqual([res.objects[0].id])
    expect(res.objects[0].type).toBe('path')
    expect(area(res.objects[0])).toBeCloseTo(400 + 400 - 100, 3)
    const b = multiPolygonBounds(objectToMultiPolygon(res.objects[0]))
    expect([b.minX, b.minY, b.maxX, b.maxY]).toEqual([0, 0, 30, 30])
  })

  it('takes fill/stroke from the first selected object and keeps unselected ones', () => {
    const res = weld([A, B, C], ['a', 'b'], ctx())
    expect(res.objects.map(o => o.id)).toContain('c')
    const welded = res.objects.find(o => o.type === 'path')
    expect(welded.fill).toEqual(A.fill)
    expect(welded.stroke).toEqual(A.stroke)
  })

  it('falls back to current fill when the source has none', () => {
    const bare = rect('a', 0, 0, 20, 20, { fill: undefined, stroke: undefined })
    const res = weld([bare, B], ['a', 'b'], ctx())
    expect(res.objects[0].fill).toEqual({ color: '#cccccc' })
    expect(res.objects[0].stroke).toEqual({ color: '#111111' })
  })

  it('keeps disjoint shapes as sub-paths of a single path', () => {
    const res = weld([A, C], ['a', 'c'], ctx())
    expect(res.objects).toHaveLength(1)
    const rings = objectToRings(res.objects[0])
    expect(rings).toHaveLength(2)
    expect(rings.map(r => Math.abs(ringArea(r))).sort((x, y) => x - y)).toEqual([25, 400])
  })

  it('does nothing with fewer than two selected objects', () => {
    expect(weld([A, B], ['a'], ctx())).toBeNull()
    expect(weld([A, B], [], ctx())).toBeNull()
  })
})

describe('punchOut', () => {
  it('subtracts the topmost selected object from the one behind', () => {
    const res = punchOut([A, B], ['a', 'b'], ctx())
    expect(res.objects).toHaveLength(1)
    expect(area(res.objects[0])).toBeCloseTo(400 - 100, 3)
  })

  it('subtracts from the union of everything behind', () => {
    const D = rect('d', 5, 0, 20, 20)
    const front = rect('f', 0, 0, 30, 5)
    const res = punchOut([A, D, front], ['a', 'd', 'f'], ctx())
    // union of A and D is 25x20 = 500, minus the 25x5 strip = 375
    expect(area(res.objects[0])).toBeCloseTo(375, 3)
  })

  it('returns null when the front fully covers the rest', () => {
    const big = rect('big', -5, -5, 100, 100)
    expect(punchOut([A, big], ['a', 'big'], ctx())).toBeNull()
  })

  it('returns null with fewer than two objects', () => {
    expect(punchOut([A], ['a'], ctx())).toBeNull()
  })
})

describe('trim', () => {
  it('cuts the front object out of the others but keeps each piece', () => {
    const res = trim([A, C, B], ['a', 'c', 'b'], ctx())
    // front is B; A loses the overlap, C is untouched; B itself is consumed
    expect(res.objects).toHaveLength(2)
    expect(res.selectedIds).toHaveLength(2)
    const areas = res.objects.map(area).sort((x, y) => x - y)
    expect(areas[0]).toBeCloseTo(25, 3)
    expect(areas[1]).toBeCloseTo(300, 3)
  })

  it('returns null when nothing remains', () => {
    const big = rect('big', -5, -5, 100, 100)
    expect(trim([A, big], ['a', 'big'], ctx())).toBeNull()
  })
})

describe('cookieCut', () => {
  it('keeps only the common area', () => {
    const res = cookieCut([A, B], ['a', 'b'], ctx())
    expect(res.objects).toHaveLength(1)
    expect(area(res.objects[0])).toBeCloseTo(100, 3)
    const b = multiPolygonBounds(objectToMultiPolygon(res.objects[0]))
    expect([b.minX, b.minY, b.maxX, b.maxY]).toEqual([10, 10, 20, 20])
  })

  it('returns null for disjoint shapes', () => {
    expect(cookieCut([A, C], ['a', 'c'], ctx())).toBeNull()
  })

  it('intersects across three objects', () => {
    const E = rect('e', 15, 15, 20, 20)
    const res = cookieCut([A, B, E], ['a', 'b', 'e'], ctx())
    expect(area(res.objects[0])).toBeCloseTo(25, 3)
  })
})
