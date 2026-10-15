import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import './FontManager.css'

const systemFonts = [
  'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS', 'Consolas',
  'Courier New', 'Georgia', 'Helvetica', 'Impact', 'Lucida Console',
  'Palatino Linotype', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS',
  'Verdana', 'Webdings', 'Wingdings',
]

export default function FontManager({ onClose }) {
  const { state, dispatch, actions } = useApp()
  const [previewText, setPreviewText] = useState('The quick brown fox')
  const [selectedFont, setSelectedFont] = useState(state.textSettings.font)
  const [fontSize, setFontSize] = useState(state.textSettings.size)

  const handleApply = () => {
    actions.setTextSettings({ font: selectedFont, size: fontSize })
    if (state.selectedObject?.type === 'text') {
      dispatch({ type: 'UPDATE_PROPERTY', payload: { property: 'fontFamily', value: selectedFont } })
      dispatch({ type: 'UPDATE_PROPERTY', payload: { property: 'fontSize', value: fontSize } })
    }
    onClose()
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog font-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Font Manager</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="dialog-body">
          <div className="font-search">
            <input type="text" placeholder="Search fonts..." id="font-search-input" />
          </div>
          <div className="font-list">
            {systemFonts.map(font => (
              <div
                key={font}
                className={`font-item ${selectedFont === font ? 'selected' : ''}`}
                onClick={() => setSelectedFont(font)}
              >
                <span className="font-name" style={{ fontFamily: font }}>{font}</span>
                <span className="font-preview" style={{ fontFamily: font }}>{previewText}</span>
              </div>
            ))}
          </div>
          <div className="font-preview-area">
            <h4>Preview</h4>
            <div className="preview-box" style={{ fontFamily: selectedFont }}>
              <input
                type="text"
                value={previewText}
                onChange={e => setPreviewText(e.target.value)}
                className="preview-input"
              />
              <div style={{ fontSize: fontSize * 2 }}>{previewText}</div>
              <div style={{ fontSize: fontSize }}>{previewText}</div>
              <div style={{ fontSize: fontSize * 0.75 }}>{previewText}</div>
            </div>
            <div className="setting-row">
              <label>Size:</label>
              <input type="number" min="6" max="200" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} />
              <span>pt</span>
            </div>
          </div>
        </div>
        <div className="dialog-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleApply}>Apply</button>
        </div>
      </div>
    </div>
  )
}
