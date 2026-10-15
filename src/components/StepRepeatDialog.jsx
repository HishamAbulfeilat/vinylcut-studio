import React, { useState } from 'react'
import './StepRepeatDialog.css'

export default function StepRepeatDialog({ onClose, onApply }) {
  const [settings, setSettings] = useState({
    rows: 2,
    cols: 2,
    spacingX: 10,
    spacingY: 10,
    method: 'grid',
    alternate: false,
    alternateOffset: 5,
  })

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog step-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Step and Repeat</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="dialog-body">
          <div className="setting-row">
            <label>Method:</label>
            <select value={settings.method} onChange={e => setSettings({...settings, method: e.target.value})}>
              <option value="grid">Grid</option>
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
              <option value="radial">Radial</option>
            </select>
          </div>
          {settings.method === 'grid' && (
            <>
              <div className="setting-row">
                <label>Rows:</label>
                <input type="number" min="1" max="20" value={settings.rows} onChange={e => setSettings({...settings, rows: parseInt(e.target.value)})} />
              </div>
              <div className="setting-row">
                <label>Columns:</label>
                <input type="number" min="1" max="20" value={settings.cols} onChange={e => setSettings({...settings, cols: parseInt(e.target.value)})} />
              </div>
            </>
          )}
          <div className="setting-row">
            <label>Spacing X:</label>
            <input type="number" step="0.5" value={settings.spacingX} onChange={e => setSettings({...settings, spacingX: parseFloat(e.target.value)})} />
            <span>mm</span>
          </div>
          <div className="setting-row">
            <label>Spacing Y:</label>
            <input type="number" step="0.5" value={settings.spacingY} onChange={e => setSettings({...settings, spacingY: parseFloat(e.target.value)})} />
            <span>mm</span>
          </div>
          <label className="checkbox-label">
            <input type="checkbox" checked={settings.alternate} onChange={e => setSettings({...settings, alternate: e.target.checked})} />
            Alternate Rows
          </label>
          {settings.alternate && (
            <div className="setting-row">
              <label>Offset:</label>
              <input type="number" step="0.5" value={settings.alternateOffset} onChange={e => setSettings({...settings, alternateOffset: parseFloat(e.target.value)})} />
              <span>mm</span>
            </div>
          )}
        </div>
        <div className="dialog-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { onApply(settings); onClose() }}>Apply</button>
        </div>
      </div>
    </div>
  )
}
