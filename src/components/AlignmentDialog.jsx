import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import './AlignmentDialog.css'

export default function AlignmentDialog({ onClose }) {
  const { actions } = useApp()
  const [alignSettings, setAlignSettings] = useState({
    distributeH: true,
    distributeV: false,
    spacing: 5,
    reference: 'selection',
  })

  const alignButtons = [
    { id: 'left', label: 'Left', icon: '⯇' },
    { id: 'centerH', label: 'Center H', icon: '⯅' },
    { id: 'right', label: 'Right', icon: '⯈' },
    { id: 'top', label: 'Top', icon: '⯆' },
    { id: 'centerV', label: 'Center V', icon: '⯄' },
    { id: 'bottom', label: 'Bottom', icon: '⯅' },
  ]

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog align-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Alignment & Distribution</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="dialog-body">
          <h4>Align Objects</h4>
          <div className="align-grid">
            {alignButtons.map(btn => (
              <button
                key={btn.id}
                className="align-btn"
                onClick={() => { actions.align(btn.id); onClose() }}
                title={btn.label}
              >
                <span className="align-icon">{btn.icon}</span>
                <span className="align-label">{btn.label}</span>
              </button>
            ))}
          </div>
          <h4>Distribute</h4>
          <div className="distribute-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={alignSettings.distributeH}
                onChange={e => setAlignSettings({...alignSettings, distributeH: e.target.checked})}
              />
              Distribute Horizontally
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={alignSettings.distributeV}
                onChange={e => setAlignSettings({...alignSettings, distributeV: e.target.checked})}
              />
              Distribute Vertically
            </label>
            <div className="setting-row">
              <label>Spacing:</label>
              <input
                type="number"
                value={alignSettings.spacing}
                onChange={e => setAlignSettings({...alignSettings, spacing: parseFloat(e.target.value)})}
              />
              <span>mm</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
