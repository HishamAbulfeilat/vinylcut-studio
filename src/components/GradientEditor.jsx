import React, { useState } from 'react'
import './GradientEditor.css'

export default function GradientEditor({ onClose, onApply }) {
  const [gradient, setGradient] = useState({
    type: 'linear',
    angle: 90,
    stops: [
      { position: 0, color: '#ff0000' },
      { position: 100, color: '#0000ff' },
    ],
  })

  const addStop = () => {
    const newPos = Math.round((gradient.stops[gradient.stops.length - 1].position + 100) / 2)
    const newStops = [...gradient.stops, { position: newPos, color: '#ffff00' }].sort((a, b) => a.position - b.position)
    setGradient({ ...gradient, stops: newStops })
  }

  const removeStop = (index) => {
    if (gradient.stops.length <= 2) return
    const newStops = gradient.stops.filter((_, i) => i !== index)
    setGradient({ ...gradient, stops: newStops })
  }

  const updateStop = (index, field, value) => {
    const newStops = gradient.stops.map((s, i) => i === index ? { ...s, [field]: value } : s)
    setGradient({ ...gradient, stops: newStops.sort((a, b) => a.position - b.position) })
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog gradient-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Gradient Editor</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="dialog-body">
          <div className="gradient-preview" style={{
            background: gradient.type === 'linear'
              ? `linear-gradient(${gradient.angle}deg, ${gradient.stops.map(s => `${s.color} ${s.position}%`).join(', ')})`
              : `radial-gradient(circle, ${gradient.stops.map(s => `${s.color} ${s.position}%`).join(', ')})`
          }} />
          <div className="gradient-controls">
            <div className="setting-row">
              <label>Type:</label>
              <select value={gradient.type} onChange={e => setGradient({...gradient, type: e.target.value})}>
                <option value="linear">Linear</option>
                <option value="radial">Radial</option>
              </select>
            </div>
            {gradient.type === 'linear' && (
              <div className="setting-row">
                <label>Angle:</label>
                <input type="range" min="0" max="360" value={gradient.angle} onChange={e => setGradient({...gradient, angle: parseInt(e.target.value)})} />
                <span>{gradient.angle}°</span>
              </div>
            )}
          </div>
          <div className="gradient-stops">
            <h4>Color Stops</h4>
            {gradient.stops.map((stop, i) => (
              <div key={i} className="stop-row">
                <input type="color" value={stop.color} onChange={e => updateStop(i, 'color', e.target.value)} />
                <input type="number" min="0" max="100" value={stop.position} onChange={e => updateStop(i, 'position', parseInt(e.target.value))} />
                <span>%</span>
                <button className="btn btn-sm" onClick={() => removeStop(i)} disabled={gradient.stops.length <= 2}>×</button>
              </div>
            ))}
            <button className="btn btn-sm" onClick={addStop}>+ Add Stop</button>
          </div>
        </div>
        <div className="dialog-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { onApply(gradient); onClose() }}>Apply</button>
        </div>
      </div>
    </div>
  )
}
