import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import './ExportDialog.css'

export default function ExportDialog({ onClose }) {
  const { state, actions } = useApp()
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

  const [busy, setBusy] = useState(false)

  const handleExport = async () => {
    setBusy(true)
    try {
      await actions.exportAs(format, options)
    } finally {
      setBusy(false)
      onClose()
    }
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
          <button className="btn btn-primary" onClick={handleExport} disabled={busy}>{busy ? 'Exporting…' : 'Export'}</button>
        </div>
      </div>
    </div>
  )
}
