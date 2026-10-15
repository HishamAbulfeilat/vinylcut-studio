/* ------------------------------------------------------------------ *
 * Raster asset preparation for vector export.
 *
 * Vector formats (PDF, EPS, DXF, HPGL) cannot just reference a bitmap URL
 * the way SVG can. This module turns every placed bitmap into real bytes:
 *
 *   - raw RGB for PostScript `colorimage`
 *   - a JPEG bitstream for PDF `/DCTDecode` XObjects
 *   - an RGBA buffer for auto-tracing (DXF / HPGL, which have no raster)
 * ------------------------------------------------------------------ */

import { tracePixels } from './tracer'
import { multiPolygonToShape } from './geometry'

/** Load an image from a URL / data URL. */
export function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image for export'))
    img.src = src
  })
}

function toBase64Bytes(dataUrl) {
  const comma = dataUrl.indexOf(',')
  const b64 = dataUrl.slice(comma + 1)
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/**
 * Build export-ready assets for every bitmap object in the list.
 * Returns a map keyed by object id.
 */
export async function prepareImageAssets(objects, opts = {}) {
  const max = opts.maxSize || 1400
  const map = {}
  for (const obj of objects) {
    if (obj.type !== 'image' || !obj.src) continue
    try {
      const img = await loadImageElement(obj.src)
      const nw = img.naturalWidth || 512
      const nh = img.naturalHeight || 512
      const s = Math.min(1, max / Math.max(nw, nh))
      const w = Math.max(1, Math.round(nw * s))
      const h = Math.max(1, Math.round(nh * s))

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      // Composite onto white: RGB formats (PostScript colorimage) have no alpha.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      if (obj.preserveAspectRatio === 'meet') {
        const ir = nw / nh
        const br = w / h
        let dw = w
        let dh = h
        if (ir > br) dh = w / ir
        else dw = h * ir
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
      } else {
        ctx.drawImage(img, 0, 0, w, h)
      }

      const data = ctx.getImageData(0, 0, w, h).data
      const rgb = new Uint8Array(w * h * 3)
      for (let i = 0, j = 0; i < data.length; i += 4) {
        rgb[j++] = data[i]
        rgb[j++] = data[i + 1]
        rgb[j++] = data[i + 2]
      }
      const jpeg = toBase64Bytes(canvas.toDataURL('image/jpeg', 0.92))
      map[obj.id] = { width: w, height: h, data, rgb, jpeg }
    } catch {
      // A failed bitmap must not abort the whole export.
    }
  }
  return map
}

/**
 * Auto-trace a prepared bitmap into a real path object so DXF / HPGL
 * exports keep image content as cuttable geometry.
 */
export function traceAssetToShape(asset, rect, options = {}) {
  const traced = tracePixels({ data: asset.data, width: asset.width, height: asset.height }, {
    mode: 'outline',
    threshold: options.threshold == null ? 128 : options.threshold,
    smoothing: options.smoothing == null ? 1 : options.smoothing,
    noise: options.noise == null ? 2 : options.noise,
  })
  if (!traced.length) return null
  const sx = rect.width / asset.width
  const sy = rect.height / asset.height
  const mp = traced.flatMap(region =>
    region.rings.map(poly => poly.map(ring => ring.map(([px, py]) => [rect.x + px * sx, rect.y + py * sy]))),
  )
  return multiPolygonToShape(mp, {
    fill: { type: 'solid', color: options.color || '#000000' },
    stroke: { color: options.color || '#000000', width: 0, style: 'solid' },
    opacity: 100,
    isTraced: true,
  })
}
