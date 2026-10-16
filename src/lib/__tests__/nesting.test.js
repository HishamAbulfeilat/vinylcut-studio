import { describe, it, expect } from 'vitest'
import { nestRects } from '../nesting'

const rect = (id, width, height) => ({ id, width, height })

// Map an id -> placement for readable assertions.
const byId = (res) => Object.fromEntries(res.placements.map(p => [p.id, p]))

describe('nestRects', () => {
  it('returns nothing for an empty list', () => {
    const res = nestRects([], { width: 100 })
    expect(res.placements).toEqual([])
    expect(res.width).toBe(0)
    expect(res.height).toBe(0)
    expect(res.overflow).toEqual([])
  })

  it('places a single item at the origin', () => {
    const res = nestRects([rect('a', 20, 10)], { width: 100 })
    expect(res.placements).toEqual([{ id: 'a', x: 0, y: 0, width: 20, height: 10 }])
    expect(res.width).toBe(20)
    expect(res.height).toBe(10)
  })

  it('lays fitting items along one shelf with horizontal gaps', () => {
    const res = nestRects([rect('a', 10, 10), rect('b', 10, 10)], { width: 100, gap: 5 })
    const p = byId(res)
    expect(p.a).toMatchObject({ x: 0, y: 0 })
    expect(p.b).toMatchObject({ x: 15, y: 0 })
    expect(res.width).toBe(25) // trailing gap not counted
    expect(res.height).toBe(10)
  })

  it('wraps onto a new shelf and applies the vertical gap', () => {
    const res = nestRects(
      [rect('a', 10, 10), rect('b', 10, 10), rect('c', 10, 10)],
      { width: 25, gap: 5 },
    )
    const p = byId(res)
    expect(p.a).toMatchObject({ x: 0, y: 0 })
    expect(p.b).toMatchObject({ x: 15, y: 0 })
    expect(p.c).toMatchObject({ x: 0, y: 15 }) // 10 tall shelf + 5 gap
    expect(res.width).toBe(25)
    expect(res.height).toBe(25)
  })

  it('sorts tallest-first so shelves waste less height', () => {
    const res = nestRects(
      [rect('short1', 10, 10), rect('tall', 10, 30), rect('short2', 10, 10)],
      { width: 25, gap: 0 },
    )
    const p = byId(res)
    // tall (30) and one short share shelf 0; the remaining short wraps.
    expect(p.tall).toMatchObject({ x: 0, y: 0 })
    expect(p.short1).toMatchObject({ x: 10, y: 0 })
    expect(p.short2).toMatchObject({ x: 0, y: 30 })
    expect(res.height).toBe(40)
  })

  it('reports items wider than the strip as overflow and places the rest', () => {
    const res = nestRects([rect('big', 50, 10), rect('small', 20, 10)], { width: 40 })
    expect(res.overflow).toEqual(['big'])
    expect(res.placements.map(p => p.id)).toEqual(['small'])
    expect(byId(res).small).toMatchObject({ x: 0, y: 0 })
  })

  it('treats a missing width as an unbounded strip', () => {
    const res = nestRects([rect('a', 10, 10), rect('b', 10, 10)], { gap: 5 })
    const p = byId(res)
    expect(p.a.y).toBe(0)
    expect(p.b.y).toBe(0) // never wraps
    expect(res.height).toBe(10)
  })

  it('does not mutate the input list', () => {
    const items = [rect('a', 10, 20), rect('b', 10, 10)]
    nestRects(items, { width: 100 })
    expect(items.map(i => i.id)).toEqual(['a', 'b'])
  })
})
