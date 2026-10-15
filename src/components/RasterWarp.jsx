import React, { useEffect, useState } from 'react'
import { makeCanvas, warpRasterToCanvas } from '../lib/warp'

/* ------------------------------------------------------------------ *
 * Raster warp surface for text and bitmap objects.
 *
 * Text and bitmaps cannot be deformed by moving vertices, so they are
 * rasterised once and then resampled per output pixel through the
 * continuous warp map (inverse-mapped, bilinear). This replaces the old
 * fixed 24-vertical-strip approximation with a genuine continuous warp.
 * ------------------------------------------------------------------ */

export default function RasterWarp({ obj, scale, panX, panY, pad = 0.4, fallback }) {
  const [url, setUrl] = useState(null)
  const colorKey = obj.fill?.color || ''

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    const build = (src) => {
      const res = warpRasterToCanvas(src, obj.warpType, obj.warpIntensity || 50, { pad })
      if (!cancelled && res) setUrl(res.toDataURL('image/png'))
    }

    if (obj.type === 'image' && obj.src) {
      const img = new window.Image()
      img.onload = () => {
        if (cancelled) return
        const src = makeCanvas(img.naturalWidth || 512, img.naturalHeight || 512)
        if (!src) return
        const c = src.getContext('2d')
        // Match objectFit: 'fill' stretches, 'meet' letterboxes.
        if (obj.preserveAspectRatio === 'meet') {
          const ir = (img.naturalWidth || 1) / (img.naturalHeight || 1)
          const br = src.width / src.height
          let dw = src.width
          let dh = src.height
          if (ir > br) dh = src.width / ir
          else dw = src.height * ir
          c.drawImage(img, (src.width - dw) / 2, (src.height - dh) / 2, dw, dh)
        } else {
          c.drawImage(img, 0, 0, src.width, src.height)
        }
        build(src)
      }
      img.onerror = () => {}
      img.src = obj.src
      return () => { cancelled = true }
    }

    if (obj.type === 'text') {
      const target = 6 // raster resolution multiplier, keeps text legible
      const w = Math.max(16, Math.min(2400, Math.round((obj.width || 100) * target)))
      const h = Math.max(16, Math.min(2400, Math.round((obj.height || 30) * target)))
      const src = makeCanvas(w, h)
      if (!src) return undefined
      const c = src.getContext('2d')
      const fs = Math.max(4, (obj.fontSize || 16) * (w / Math.max(1, obj.width || 100)))
      c.fillStyle = obj.fill?.color || '#000000'
      c.font = `${obj.italic ? 'italic ' : ''}${obj.bold ? 'bold ' : ''}${fs}px ${obj.fontFamily || 'Arial'}`
      c.textAlign = obj.align === 'center' ? 'center' : obj.align === 'right' ? 'right' : 'left'
      c.textBaseline = 'middle'
      const tx = c.textAlign === 'center' ? w / 2 : c.textAlign === 'right' ? w - 4 : 4
      const lines = String(obj.text || '').split('\n')
      const lh = fs * (obj.lineSpacing || 1.2)
      const y0 = h / 2 - ((lines.length - 1) * lh) / 2
      lines.forEach((ln, i) => c.fillText(ln, tx, y0 + i * lh))
      if (obj.stroke?.width > 0 && obj.stroke?.color) {
        c.lineWidth = obj.stroke.width * (w / Math.max(1, obj.width || 100))
        c.strokeStyle = obj.stroke.color
        lines.forEach((ln, i) => c.strokeText(ln, tx, y0 + i * lh))
      }
      build(src)
      return () => { cancelled = true }
    }

    return () => { cancelled = true }
  }, [obj.warpType, obj.warpIntensity, obj.src, obj.text, obj.width, obj.height, obj.fontSize, obj.fontFamily, obj.bold, obj.italic, obj.align, obj.lineSpacing, obj.preserveAspectRatio, colorKey, obj.stroke?.width, obj.stroke?.color, pad])

  if (!url) return fallback ? fallback() : null
  const p = pad
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      style={{
        position: 'absolute',
        left: (obj.x - p * obj.width) * scale + panX * scale,
        top: (obj.y - p * obj.height) * scale + panY * scale,
        width: obj.width * (1 + 2 * p) * scale,
        height: obj.height * (1 + 2 * p) * scale,
        opacity: (obj.opacity || 100) / 100,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    />
  )
}
