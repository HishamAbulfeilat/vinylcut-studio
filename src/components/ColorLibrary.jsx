import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import './ColorLibrary.css'

const spotColors = [
  { name: 'Pantone 185 C', hex: '#E4002B', type: 'spot' },
  { name: 'Pantone 300 C', hex: '#005EB8', type: 'spot' },
  { name: 'Pantone 355 C', hex: '#009A44', type: 'spot' },
  { name: 'Pantone 123 C', hex: '#FFB81C', type: 'spot' },
  { name: 'Pantone 268 C', hex: '#5F259F', type: 'spot' },
  { name: 'Pantone 1235 C', hex: '#FFCD00', type: 'spot' },
  { name: 'Pantone 485 C', hex: '#DA291C', type: 'spot' },
  { name: 'Pantone 280 C', hex: '#00205B', type: 'spot' },
]

const cmykColors = [
  { name: 'CMYK Red', c: 0, m: 100, y: 100, k: 0, hex: '#FF0000' },
  { name: 'CMYK Green', c: 100, m: 0, y: 100, k: 0, hex: '#00FF00' },
  { name: 'CMYK Blue', c: 100, m: 100, y: 0, k: 0, hex: '#0000FF' },
  { name: 'CMYK Cyan', c: 100, m: 0, y: 0, k: 0, hex: '#00FFFF' },
  { name: 'CMYK Magenta', c: 0, m: 100, y: 0, k: 0, hex: '#FF00FF' },
  { name: 'CMYK Yellow', c: 0, m: 0, y: 100, k: 0, hex: '#FFFF00' },
  { name: 'CMYK Black', c: 0, m: 0, y: 0, k: 100, hex: '#000000' },
  { name: 'CMYK White', c: 0, m: 0, y: 0, k: 0, hex: '#FFFFFF' },
]

const rgbColors = [
  { name: 'RGB Red', r: 255, g: 0, b: 0, hex: '#FF0000' },
  { name: 'RGB Green', r: 0, g: 255, b: 0, hex: '#00FF00' },
  { name: 'RGB Blue', r: 0, g: 0, b: 255, hex: '#0000FF' },
  { name: 'RGB Cyan', r: 0, g: 255, b: 255, hex: '#00FFFF' },
  { name: 'RGB Magenta', r: 255, g: 0, b: 255, hex: '#FF00FF' },
  { name: 'RGB Yellow', r: 255, g: 255, b: 0, hex: '#FFFF00' },
  { name: 'RGB Black', r: 0, g: 0, b: 0, hex: '#000000' },
  { name: 'RGB White', r: 255, g: 255, b: 255, hex: '#FFFFFF' },
]

export default function ColorLibrary({ onClose, onSelect }) {
  const { state, actions } = useApp()
  const [tab, setTab] = useState('spot')
  const [customColor, setCustomColor] = useState('#ff8000')

  const tabs = [
    { id: 'spot', label: 'Spot Colors', colors: spotColors },
    { id: 'cmyk', label: 'CMYK', colors: cmykColors },
    { id: 'rgb', label: 'RGB', colors: rgbColors },
  ]

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog color-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Color Library</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="dialog-body">
          <div className="color-tabs">
            {tabs.map(t => (
              <button
                key={t.id}
                className={`color-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="color-grid">
            {tabs.find(t => t.id === tab)?.colors.map((color, i) => (
              <button
                key={i}
                className="color-swatch"
                style={{ background: color.hex }}
                onClick={() => { onSelect(color.hex); onClose() }}
                title={color.name}
              >
                <span className="color-label">{color.name}</span>
              </button>
            ))}
          </div>
          <div className="custom-color">
            <h4>Custom Color</h4>
            <div className="setting-row">
              <input type="color" value={customColor} onChange={e => setCustomColor(e.target.value)} />
              <span>{customColor}</span>
              <button className="btn btn-sm" onClick={() => { onSelect(customColor); onClose() }}>Apply</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
