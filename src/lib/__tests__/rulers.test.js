import { describe, it, expect } from 'vitest'
import { rulerTicks } from '../rulers'

describe('rulerTicks', () => {
  it('generates the requested number of ticks', () => {
    expect(rulerTicks({ count: 5 })).toHaveLength(5)
    expect(rulerTicks({ count: 1 })).toHaveLength(1)
  })

  it('starts at pageOrigin - offset', () => {
    const ticks = rulerTicks({ pageOrigin: 100, offset: 20 })
    expect(ticks[0].pos).toBe(80)
  })

  it('spaces ticks by step * zoom', () => {
    const ticks = rulerTicks({ zoom: 2, step: 50, count: 3 })
    expect(ticks[0].pos).toBe(-20)
    expect(ticks[1].pos).toBe(80)
    expect(ticks[2].pos).toBe(180)
  })

  it('labels ticks in document units, unaffected by zoom', () => {
    const ticks = rulerTicks({ zoom: 2, step: 50, count: 4 })
    expect(ticks.map(t => t.label)).toEqual([0, 50, 100, 150])
  })

  it('defaults to 100 ticks at step 50 with zoom 1', () => {
    const ticks = rulerTicks()
    expect(ticks).toHaveLength(100)
    expect(ticks[0]).toEqual({ pos: -20, label: 0 })
    expect(ticks[99]).toEqual({ pos: -20 + 99 * 50, label: 4950 })
  })

  it('handles a fractional zoom', () => {
    const ticks = rulerTicks({ zoom: 0.5, step: 50, count: 3 })
    expect(ticks[1].pos).toBe(-20 + 25)
    expect(ticks[2].pos).toBe(-20 + 50)
  })

  it('honours a custom step and offset', () => {
    const ticks = rulerTicks({ step: 10, offset: 5, count: 3 })
    expect(ticks[0]).toEqual({ pos: -5, label: 0 })
    expect(ticks[1]).toEqual({ pos: 5, label: 10 })
    expect(ticks[2]).toEqual({ pos: 15, label: 20 })
  })
})
