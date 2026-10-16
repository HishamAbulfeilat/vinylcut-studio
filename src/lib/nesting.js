/* ------------------------------------------------------------------ *
 * Nesting.
 *
 * Packs axis-aligned bounding boxes into a media strip using a shelf
 * (skyline-row) algorithm: items are sorted tallest-first, laid out
 * left-to-right along the current shelf, and wrapped onto a new shelf
 * below once the strip runs out of width. Gaps are applied between
 * neighbouring items and between shelves.
 *
 * Sizes are plain media units (mm); the caller owns the geometry.
 * ------------------------------------------------------------------ */

/**
 * Pack rectangles into a strip of `width`.
 *
 * @param {Array<{id?: any, width: number, height: number}>} items
 * @param {{width?: number, gap?: number}} [options]
 * @returns {{
 *   placements: Array<{id: any, x: number, y: number, width: number, height: number}>,
 *   width: number,   // strip width actually used
 *   height: number,  // total height used
 *   overflow: Array<any>, // ids wider than the strip (left unplaced)
 * }}
 */
export function nestRects(items, options = {}) {
  const gap = Math.max(0, options.gap || 0)
  const stripWidth = options.width > 0 ? options.width : Infinity

  const list = (items || []).map((it, i) => ({
    id: it && it.id != null ? it.id : i,
    width: Math.max(0, (it && it.width) || 0),
    height: Math.max(0, (it && it.height) || 0),
    order: i,
  }))

  // Tallest-first keeps shelves tight; index keeps equal heights stable.
  list.sort((a, b) => (b.height - a.height) || (a.order - b.order))

  const placements = []
  const overflow = []
  let cursorX = 0
  let cursorY = 0
  let shelfHeight = 0
  let usedWidth = 0

  for (const it of list) {
    if (it.width > stripWidth) {
      overflow.push(it.id)
      continue
    }
    // Wrap only when the current shelf already holds something.
    if (cursorX > 0 && cursorX + it.width > stripWidth) {
      cursorY += shelfHeight + gap
      cursorX = 0
      shelfHeight = 0
    }
    placements.push({ id: it.id, x: cursorX, y: cursorY, width: it.width, height: it.height })
    cursorX += it.width + gap
    if (it.height > shelfHeight) shelfHeight = it.height
    if (cursorX - gap > usedWidth) usedWidth = cursorX - gap
  }

  const height = placements.length ? cursorY + shelfHeight : 0
  return { placements, width: usedWidth, height, overflow }
}
