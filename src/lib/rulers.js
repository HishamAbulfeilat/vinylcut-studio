// Ruler geometry for the Design Center (SHELL-SPEC §1: rulers on top and
// left). Pure functions so the canvas, tests and any future overlay share
// one implementation.

// Compute the tick marks for one ruler axis.
//   zoom       — current zoom factor (document units -> screen px)
//   pageOrigin — screen px where the page's document origin sits on this axis
//   step       — document units between ticks (default 50)
//   count      — how many ticks to generate (default 100)
//   offset     — screen px the ruler starts before the page origin (default 20)
// Returns [{ pos, label }] with pos in screen px and label in document units.
export function rulerTicks({ zoom = 1, pageOrigin = 0, step = 50, count = 100, offset = 20 } = {}) {
  const ticks = []
  for (let i = 0; i < count; i++) {
    ticks.push({ pos: pageOrigin - offset + i * step * zoom, label: i * step })
  }
  return ticks
}
