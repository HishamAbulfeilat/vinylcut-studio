/* ------------------------------------------------------------------ *
 * Shape operations (Weld / Punch Out / Trim / Cookie Cut) as pure
 * functions over a document's object list. Each returns the next
 * `{ objects, selectedIds }` or null when the operation does not apply
 * (too few objects, empty result, or a clipping failure).
 * ------------------------------------------------------------------ */

import { objectToMultiPolygon, multiPolygonToShape, union, difference, intersection } from './geometry'

function pathFrom(shape, src, ctx) {
  return {
    id: ctx.generateId(),
    type: 'path',
    ...shape,
    fill: { ...(src.fill || ctx.currentFill) },
    stroke: { ...(src.stroke || ctx.currentStroke) },
    opacity: src.opacity || 100,
  }
}

function finish(objects, selectedIds, results) {
  const next = objects.filter(o => !selectedIds.includes(o.id))
  next.push(...results)
  return { objects: next, selectedIds: results.map(o => o.id) }
}

/** ctx: { generateId, currentFill, currentStroke } */
export function weld(objects, selectedIds, ctx) {
  const sel = objects.filter(o => selectedIds.includes(o.id))
  if (sel.length < 2) return null
  try {
    const geoms = sel.map(objectToMultiPolygon)
    const shape = multiPolygonToShape(union(geoms[0], ...geoms.slice(1)))
    if (!shape) return null
    return finish(objects, selectedIds, [pathFrom(shape, sel[0], ctx)])
  } catch {
    return null
  }
}

/** The topmost selected object is subtracted from the union of the rest. */
export function punchOut(objects, selectedIds, ctx) {
  const sel = objects.filter(o => selectedIds.includes(o.id))
  if (sel.length < 2) return null
  const front = sel[sel.length - 1]
  const behind = sel.slice(0, -1)
  try {
    let base = objectToMultiPolygon(behind[0])
    for (const o of behind.slice(1)) base = union(base, objectToMultiPolygon(o))
    const shape = multiPolygonToShape(difference(base, objectToMultiPolygon(front)))
    if (!shape) return null
    return finish(objects, selectedIds, [pathFrom(shape, behind[0], ctx)])
  } catch {
    return null
  }
}

/** Subtract the topmost object from each of the others, keeping each piece. */
export function trim(objects, selectedIds, ctx) {
  const sel = objects.filter(o => selectedIds.includes(o.id))
  if (sel.length < 2) return null
  const front = sel[sel.length - 1]
  const rest = sel.slice(0, -1)
  try {
    const frontGeo = objectToMultiPolygon(front)
    const pieces = []
    for (const o of rest) {
      const shape = multiPolygonToShape(difference(objectToMultiPolygon(o), frontGeo))
      if (shape) pieces.push(pathFrom(shape, o, ctx))
    }
    if (!pieces.length) return null
    return finish(objects, selectedIds, pieces)
  } catch {
    return null
  }
}

/** Keep only the area common to every selected object. */
export function cookieCut(objects, selectedIds, ctx) {
  const sel = objects.filter(o => selectedIds.includes(o.id))
  if (sel.length < 2) return null
  try {
    let acc = objectToMultiPolygon(sel[0])
    for (const o of sel.slice(1)) acc = intersection(acc, objectToMultiPolygon(o))
    const shape = multiPolygonToShape(acc)
    if (!shape) return null
    return finish(objects, selectedIds, [pathFrom(shape, sel[0], ctx)])
  } catch {
    return null
  }
}
