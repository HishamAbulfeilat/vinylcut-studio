import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import './ExportDialog.css'

export default function ExportDialog({ onClose }) {
  const { state } = useApp()
  const [format, setFormat] = useState('svg')
  const [options, setOptions] = useState({
    width: 300,
    height: 300,
    dpi: 300,
    transparentBg: true,
    includeCropMarks: true,
    includeRegistrationMarks: true,
    colorSpace: 'CMYK',
    cutLineColor: '#FF0000',
  })

  const formats = [
    { id: 'svg', name: 'SVG', desc: 'Scalable Vector Graphics' },
    { id: 'png', name: 'PNG', desc: 'Portable Network Graphics' },
    { id: 'jpg', name: 'JPEG', desc: 'Joint Photographic Experts Group' },
    { id: 'bmp', name: 'BMP', desc: 'Bitmap Image' },
    { id: 'pdf', name: 'PDF', desc: 'Portable Document Format' },
    { id: 'eps', name: 'EPS', desc: 'Encapsulated PostScript' },
    { id: 'ai', name: 'Adobe Illustrator', desc: 'AI Format' },
    { id: 'dxf', name: 'DXF', desc: 'Drawing Exchange Format' },
    { id: 'plt', name: 'HPGL', desc: 'HP Graphics Language' },
  ]

  const handleExport = () => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = options.width
    canvas.height = options.height

    ctx.fillStyle = options.transparentBg ? 'transparent' : '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const scale = options.width / ((state.pages[state.activePage]?.width || 210) * state.zoom)
    state.objects.forEach(obj => {
      ctx.save()
      ctx.translate((obj.x || 0) * scale, (obj.y || 0) * scale)
      ctx.rotate((obj.rotation || 0) * Math.PI / 180)

      const fillColor = obj.fill?.type === 'solid' ? obj.fill.color : 'transparent'
      ctx.fillStyle = fillColor
      ctx.strokeStyle = obj.stroke?.color || '#000'
      ctx.lineWidth = (obj.stroke?.width || 1) * scale

      if (obj.type === 'rect') {
        ctx.fillRect(0, 0, (obj.width || 0) * scale, (obj.height || 0) * scale)
        if (obj.stroke?.width > 0) ctx.strokeRect(0, 0, (obj.width || 0) * scale, (obj.height || 0) * scale)
      } else if (obj.type === 'ellipse') {
        ctx.beginPath()
        ctx.ellipse((obj.width || 0) * scale / 2, (obj.height || 0) * scale / 2, (obj.width || 0) * scale / 2, (obj.height || 0) * scale / 2, 0, 0, Math.PI * 2)
        if (fillColor !== 'transparent') ctx.fill()
        if (obj.stroke?.width > 0) ctx.stroke()
      } else if (obj.type === 'text') {
        ctx.font = `${obj.fontSize || 16}px ${obj.fontFamily || 'Arial'}`
        ctx.fillStyle = obj.fill?.color || '#000'
        ctx.fillText(obj.text || '', 0, (obj.fontSize || 16) * scale)
      }
      ctx.restore()
    })

    if (format === 'svg') {
      const svgData = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${options.width}" height="${options.height}" viewBox="0 0 ${options.width} ${options.height}">
  ${state.objects.map(obj => {
    const x = (obj.x || 0) * scale
    const y = (obj.y || 0) * scale
    const w = (obj.width || 0) * scale
    const h = (obj.height || 0) * scale
    if (obj.type === 'rect') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${obj.fill?.type === 'solid' ? obj.fill.color : 'none'}" stroke="${obj.stroke?.color || 'none'}" stroke-width="${obj.stroke?.width || 0}" transform="rotate(${obj.rotation || 0} ${x + w / 2} ${y + h / 2})"/>`
    if (obj.type === 'ellipse') return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${obj.fill?.type === 'solid' ? obj.fill.color : 'none'}" stroke="${obj.stroke?.color || 'none'}" stroke-width="${obj.stroke?.width || 0}" transform="rotate(${obj.rotation || 0} ${x + w / 2} ${y + h / 2})"/>`
    if (obj.type === 'text') return `<text x="${x}" y="${y + (obj.fontSize || 16) * scale}" font-family="${obj.fontFamily || 'Arial'}" font-size="${(obj.fontSize || 16) * scale}" fill="${obj.fill?.color || '#000'}" transform="rotate(${obj.rotation || 0} ${x} ${y})">${obj.text || ''}</text>`
    return ''
  }).join('\n  ')}
</svg>`
      const blob = new Blob([svgData], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${state.documentName}.svg`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const mimeType = format === 'jpg' ? 'image/jpeg' : format === 'png' ? 'image/png' : 'image/bmp'
      const dataUrl = canvas.toDataURL(mimeType, 0.95)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${state.documentName}.${format}`
      a.click()
    }
    onClose()
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog export-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Export</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="dialog-body">
          <div className="export-formats">
            {formats.map(f => (
              <button
                key={f.id}
                className={`format-btn ${format === f.id ? 'active' : ''}`}
                onClick={() => setFormat(f.id)}
              >
                <span className="format-name">{f.name}</span>
                <span className="format-desc">{f.desc}</span>
              </button>
            ))}
          </div>
          <div className="export-options">
            <h4>Options</h4>
            <div className="setting-row">
              <label>Width:</label>
              <input type="number" value={options.width} onChange={e => setOptions({...options, width: parseInt(e.target.value)})} />
              <span>px</span>
            </div>
            <div className="setting-row">
              <label>Height:</label>
              <input type="number" value={options.height} onChange={e => setOptions({...options, height: parseInt(e.target.value)})} />
              <span>px</span>
            </div>
            <div className="setting-row">
              <label>DPI:</label>
              <select value={options.dpi} onChange={e => setOptions({...options, dpi: parseInt(e.target.value)})}>
                <option value="72">72</option>
                <option value="150">150</option>
                <option value="300">300</option>
                <option value="600">600</option>
              </select>
            </div>
            <div className="setting-row">
              <label>
                <input type="checkbox" checked={options.transparentBg} onChange={e => setOptions({...options, transparentBg: e.target.checked})} />
                Transparent Background
              </label>
            </div>
            <div className="setting-row">
              <label>
                <input type="checkbox" checked={options.includeCropMarks} onChange={e => setOptions({...options, includeCropMarks: e.target.checked})} />
                Include Crop Marks
              </label>
            </div>
            <div className="setting-row">
              <label>
                <input type="checkbox" checked={options.includeRegistrationMarks} onChange={e => setOptions({...options, includeRegistrationMarks: e.target.checked})} />
                Include Registration Marks
              </label>
            </div>
          </div>
        </div>
        <div className="dialog-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleExport}>Export</button>
        </div>
      </div>
    </div>
  )
}
