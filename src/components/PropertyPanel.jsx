import React from 'react'
import { useApp } from '../context/AppContext'
import './PropertyPanel.css'

export default function PropertyPanel({ selectedObject, onPropertyChange }) {
  const { state, actions } = useApp()

  const handleChange = (property, value) => {
    if (property.startsWith('fill.')) {
      const fillProp = property.split('.')[1]
      actions.setFill({ ...state.currentFill, [fillProp]: value })
    } else if (property.startsWith('stroke.')) {
      const strokeProp = property.split('.')[1]
      actions.setStroke({ ...state.currentStroke, [strokeProp]: value })
    } else {
      onPropertyChange(property, value)
    }
  }

  return (
    <div className="property-panel">
      <div className="panel-header">
        <h3>Properties</h3>
      </div>

      <div className="panel-section">
        <h4>Position & Size</h4>
        <div className="property-row">
          <label>X:</label>
          <input
            type="number"
            value={Math.round(selectedObject?.x || 0)}
            onChange={(e) => handleChange('x', parseFloat(e.target.value) || 0)}
          />
          <label>Y:</label>
          <input
            type="number"
            value={Math.round(selectedObject?.y || 0)}
            onChange={(e) => handleChange('y', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="property-row">
          <label>W:</label>
          <input
            type="number"
            value={Math.round(selectedObject?.width || 0)}
            onChange={(e) => handleChange('width', parseFloat(e.target.value) || 0)}
          />
          <label>H:</label>
          <input
            type="number"
            value={Math.round(selectedObject?.height || 0)}
            onChange={(e) => handleChange('height', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="property-row">
          <label>Rotation:</label>
          <input
            type="number"
            value={Math.round(selectedObject?.rotation || 0)}
            onChange={(e) => handleChange('rotation', parseFloat(e.target.value) || 0)}
          />
          <span>°</span>
        </div>
      </div>

      <div className="panel-section">
        <h4>Fill</h4>
        <div className="property-row">
          <label>Type:</label>
          <select
            value={state.currentFill.type}
            onChange={(e) => handleChange('fill.type', e.target.value)}
          >
            <option value="none">No Fill</option>
            <option value="solid">Solid Color</option>
            <option value="gradient">Gradient</option>
            <option value="texture">Texture</option>
          </select>
        </div>
        <div className="property-row">
          <label>Color:</label>
          <input
            type="color"
            value={state.currentFill.color}
            onChange={(e) => handleChange('fill.color', e.target.value)}
          />
          <span className="color-value">{state.currentFill.color}</span>
        </div>
        <div className="property-row">
          <label>Opacity:</label>
          <input
            type="range"
            min="0"
            max="100"
            value={state.currentFill.opacity}
            onChange={(e) => handleChange('fill.opacity', parseInt(e.target.value))}
          />
          <span>{state.currentFill.opacity}%</span>
        </div>
      </div>

      <div className="panel-section">
        <h4>Stroke</h4>
        <div className="property-row">
          <label>Color:</label>
          <input
            type="color"
            value={state.currentStroke.color}
            onChange={(e) => handleChange('stroke.color', e.target.value)}
          />
          <span className="color-value">{state.currentStroke.color}</span>
        </div>
        <div className="property-row">
          <label>Width:</label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={state.currentStroke.width}
            onChange={(e) => handleChange('stroke.width', parseFloat(e.target.value) || 0)}
          />
          <span>pt</span>
        </div>
      </div>

      {selectedObject?.type === 'text' && (
        <div className="panel-section">
          <h4>Text</h4>
          <div className="property-row">
            <label>Text:</label>
            <input
              type="text"
              value={selectedObject.text || ''}
              onChange={(e) => handleChange('text', e.target.value)}
            />
          </div>
          <div className="property-row">
            <label>Font:</label>
            <select
              value={selectedObject.fontFamily || 'Arial'}
              onChange={(e) => handleChange('fontFamily', e.target.value)}
            >
              <option value="Arial">Arial</option>
              <option value="Helvetica">Helvetica</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
              <option value="Georgia">Georgia</option>
              <option value="Verdana">Verdana</option>
              <option value="Impact">Impact</option>
            </select>
          </div>
          <div className="property-row">
            <label>Size:</label>
            <input
              type="number"
              min="6"
              value={selectedObject.fontSize || 16}
              onChange={(e) => handleChange('fontSize', parseInt(e.target.value) || 16)}
            />
            <span>pt</span>
          </div>
        </div>
      )}

      <div className="panel-section">
        <h4>Effects</h4>
        <div className="property-row">
          <label>Opacity:</label>
          <input
            type="range"
            min="0"
            max="100"
            value={selectedObject?.opacity || 100}
            onChange={(e) => handleChange('opacity', parseInt(e.target.value))}
          />
          <span>{selectedObject?.opacity || 100}%</span>
        </div>
        <div className="property-row">
          <label>Blur:</label>
          <input
            type="range"
            min="0"
            max="20"
            value={selectedObject?.blur || 0}
            onChange={(e) => handleChange('blur', parseInt(e.target.value))}
          />
          <span>{selectedObject?.blur || 0}px</span>
        </div>
      </div>

      <div className="panel-section">
        <h4>Actions</h4>
        <div className="action-buttons">
          <button onClick={actions.bringToFront}>Bring to Front</button>
          <button onClick={actions.sendToBack}>Send to Back</button>
          <button onClick={actions.bringForward}>Bring Forward</button>
          <button onClick={actions.sendBackward}>Send Backward</button>
          <button onClick={actions.mirrorX}>Mirror H</button>
          <button onClick={actions.mirrorY}>Mirror V</button>
          <button onClick={() => actions.rotate(90)}>Rotate 90°</button>
          <button onClick={() => actions.rotate(180)}>Rotate 180°</button>
        </div>
      </div>
    </div>
  )
}
