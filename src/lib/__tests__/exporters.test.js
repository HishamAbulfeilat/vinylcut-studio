import { describe, it, expect } from 'vitest'
import { buildHpgl, buildDxf, buildSvg, buildPdf, buildPostScript, vectorObjects } from '../exporters'
import { multiPolygonToHPGL } from '../geometry'

const rect = (id, x, y, width, height, extra = {}) => ({
  id, type: 'rectangle', x, y, width, height,
  fill: { type: 'solid', color: '#ff0000' }, stroke: { color: '#000000', width: 1 }, ...extra,
})
const page = { width: 100, height: 50 }
const text = (s) => (typeof s === 'string' ? s : String.fromCharCode(...s))

describe('multiPolygonToHPGL', () => {
  it('emits IN/SP header, pen moves in plotter units, and lifts the pen', () => {
    const out = multiPolygonToHPGL([[[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]], { unitsPerMm: 40 })
    const lines = out.split('\n')
    expect(lines[0]).toBe('IN;')
    expect(lines[1]).toBe('SP1;')
    expect(lines).toContain('PU0,0;')
    expect(out).toContain('PA400,0')
    expect(out).toContain('PA400,400')
    expect(lines[lines.length - 1]).toBe('PU;')
  })

  it('closes an open ring back to its start', () => {
    const out = multiPolygonToHPGL([[[[0, 0], [10, 0], [10, 10]]]], { unitsPerMm: 1 })
    expect(out).toContain('PA0,0;')
  })
})

describe('buildHpgl', () => {
  it('starts with init/speed/force/pen and ends with pen up + deselect', () => {
    const out = buildHpgl([rect('r', 0, 0, 10, 10)], { pageHeight: 50, speed: 30, force: 12, pen: 2 })
    const lines = out.split('\n')
    expect(lines.slice(0, 4)).toEqual(['IN;', 'VS30;', 'FS12;', 'SP2;'])
    expect(lines.slice(-2)).toEqual(['PU0,0;', 'SP0;'])
  })

  it('flips Y against the page height (HPGL origin is lower-left)', () => {
    const out = buildHpgl([rect('r', 0, 0, 10, 10)], { pageHeight: 50, unitsPerMm: 40 })
    // rectangle corner (0,0) -> (0, 50mm) = 2000 units; (10,10) -> (400, 1600)
    expect(out).toContain('PU0,2000;')
    expect(out).toContain('PA400,1600')
  })

  it('skips clone placeholder objects', () => {
    const only = buildHpgl([rect('r', 0, 0, 10, 10)], { pageHeight: 50 })
    const withClone = buildHpgl([rect('r', 0, 0, 10, 10), { id: 'c', type: 'clone', x: 5, y: 5 }], { pageHeight: 50 })
    expect(withClone).toBe(only)
  })

  it('writes text as a label terminated by ETX, with semicolons escaped', () => {
    const out = buildHpgl([{ id: 't', type: 'text', x: 0, y: 0, width: 50, height: 10, text: 'Hi;', fontSize: 10 }], { pageHeight: 50 })
    expect(out).toContain('LBHi,' + String.fromCharCode(3))
  })

  it('respects unitsPerMm', () => {
    const out = buildHpgl([rect('r', 0, 0, 10, 10)], { pageHeight: 10, unitsPerMm: 10 })
    expect(out).toContain('PA100,')
  })
})

describe('buildDxf', () => {
  it('produces a well-formed ENTITIES section ending in EOF', () => {
    const out = buildDxf([rect('r', 0, 0, 10, 10)], { pageHeight: 50 })
    const lines = out.split('\r\n')
    expect(lines.slice(0, 10)).toEqual(['0', 'SECTION', '2', 'HEADER', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES'])
    expect(lines.slice(-4)).toEqual(['0', 'ENDSEC', '0', 'EOF'])
    // group codes alternate with values: even line count
    expect(lines.length % 2).toBe(0)
  })

  it('flips Y against the page height', () => {
    const out = buildDxf([rect('r', 0, 0, 10, 10)], { pageHeight: 50 })
    const lines = out.split('\r\n')
    const ys = []
    lines.forEach((l, i) => { if (l === '20') ys.push(parseFloat(lines[i + 1])) })
    expect(ys.length).toBeGreaterThanOrEqual(4)
    expect(Math.max(...ys)).toBeCloseTo(50, 3)
    expect(Math.min(...ys)).toBeCloseTo(40, 3)
  })

  it('emits nothing for clones and still ends validly', () => {
    const out = buildDxf([{ id: 'c', type: 'cloneArray' }], { pageHeight: 10 })
    expect(out).not.toContain('POLYLINE')
    expect(out.endsWith('EOF')).toBe(true)
  })

  it('emits a TEXT entity for text objects', () => {
    const out = buildDxf([{ id: 't', type: 'text', x: 0, y: 0, width: 50, height: 10, text: 'Hello', fontSize: 10 }], { pageHeight: 50 })
    expect(out).toContain('TEXT')
    expect(out).toContain('Hello')
  })
})

describe('buildSvg', () => {
  it('declares page size in mm and a matching viewBox', () => {
    const svg = buildSvg([rect('r', 1, 2, 10, 10)], page)
    expect(svg).toContain('width="100mm"')
    expect(svg).toContain('height="50mm"')
    expect(svg).toContain('viewBox="0 0 100 50"')
    expect(svg.trim().endsWith('</svg>')).toBe(true)
  })

  it('uses a transparent background when asked', () => {
    expect(buildSvg([], page, { transparentBg: true })).toContain('fill="none"')
    expect(buildSvg([], page)).toContain('fill="#ffffff"')
  })

  it('escapes text content', () => {
    const svg = buildSvg([{ id: 't', type: 'text', x: 0, y: 0, width: 50, height: 10, text: 'a<b&c', fontSize: 10, fill: { type: 'solid', color: '#000' } }], page)
    expect(svg).toContain('a&lt;b&amp;c')
    expect(svg).not.toContain('a<b&c')
  })
})

describe('buildPdf / buildPostScript', () => {
  it('buildPdf returns a PDF with header and EOF marker', () => {
    const pdf = text(buildPdf([rect('r', 0, 0, 10, 10)], page))
    expect(pdf.startsWith('%PDF-1.')).toBe(true)
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true)
  })

  it('buildPdf MediaBox keeps the page aspect ratio', () => {
    const pdf = text(buildPdf([], { width: 210, height: 297 }))
    const m = pdf.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/)
    expect(m).not.toBeNull()
    expect(parseFloat(m[1]) / parseFloat(m[2])).toBeCloseTo(210 / 297, 4)
  })

  it('buildPostScript is a PostScript document', () => {
    const ps = text(buildPostScript([rect('r', 0, 0, 10, 10)], page))
    expect(ps.startsWith('%!PS')).toBe(true)
  })
})

describe('vectorObjects', () => {
  it('drops clone types only', () => {
    const objs = [rect('a', 0, 0, 1, 1), { id: 'b', type: 'clone' }, { id: 'c', type: 'cloneArray' }, { id: 'd', type: 'cloneCircle' }]
    expect(vectorObjects(objs).map(o => o.id)).toEqual(['a'])
  })
})
