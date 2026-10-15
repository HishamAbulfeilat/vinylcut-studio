import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import './PropertyPanel.css'

export default function PropertyPanel({ selectedObject, onPropertyChange }) {
  const { state, actions } = useApp()
  const [activeSection, setActiveSection] = useState('position')
  // Effects live on the selected object; fall back to the pending defaults.
  const eff = (selectedObject && selectedObject.effect) || state.currentEffect

  const handleChange = (property, value) => {
    if (property.startsWith('fill.')) {
      const fillProp = property.split('.')[1]
      actions.setFill({ ...state.currentFill, [fillProp]: value })
    } else if (property.startsWith('stroke.')) {
      const strokeProp = property.split('.')[1]
      actions.setStroke({ ...state.currentStroke, [strokeProp]: value })
    } else if (property.startsWith('text.')) {
      const textProp = property.split('.')[1]
      actions.setTextSettings({ [textProp]: value })
    } else if (property.startsWith('paragraph.')) {
      const paraProp = property.split('.')[1]
      actions.setParagraphSettings({ [paraProp]: value })
    } else {
      onPropertyChange(property, value)
    }
  }

  const sections = [
    { id: 'position', label: 'Position & Size' },
    { id: 'fill', label: 'Fill' },
    { id: 'stroke', label: 'Stroke' },
    { id: 'text', label: 'Text' },
    { id: 'paragraph', label: 'Paragraph' },
    { id: 'effects', label: 'Effects' },
    { id: '3d', label: '3D' },
    { id: 'shadow', label: 'Shadows' },
    { id: 'clone', label: 'Clone' },
    { id: 'stepRepeat', label: 'Step & Repeat' },
    { id: 'warp', label: 'Warp' },
    { id: 'dimension', label: 'Dimension' },
    { id: 'pen', label: 'Pen Style' },
    { id: 'trace', label: 'Vectorize' },
    { id: 'page', label: 'Page Setup' },
  ]

  return (
    <div className="property-panel">
      <div className="panel-header">
        <h3>Properties</h3>
      </div>

      <div className="panel-tabs">
        {sections.map(s => (
          <button
            key={s.id}
            className={`panel-tab ${activeSection === s.id ? 'active' : ''}`}
            onClick={() => setActiveSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="panel-content">
        {activeSection === 'position' && (
          <div className="panel-section">
            <h4>Position & Size</h4>
            <div className="property-row">
              <label>X:</label>
              <input type="number" value={Math.round(selectedObject?.x || 0)} onChange={(e) => handleChange('x', parseFloat(e.target.value) || 0)} />
              <label>Y:</label>
              <input type="number" value={Math.round(selectedObject?.y || 0)} onChange={(e) => handleChange('y', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="property-row">
              <label>W:</label>
              <input type="number" value={Math.round(selectedObject?.width || 0)} onChange={(e) => handleChange('width', parseFloat(e.target.value) || 0)} />
              <label>H:</label>
              <input type="number" value={Math.round(selectedObject?.height || 0)} onChange={(e) => handleChange('height', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="property-row">
              <label>Rotation:</label>
              <input type="number" value={Math.round(selectedObject?.rotation || 0)} onChange={(e) => handleChange('rotation', parseFloat(e.target.value) || 0)} />
              <span>°</span>
            </div>
            <div className="property-row">
              <label>Skew X:</label>
              <input type="number" value={Math.round(selectedObject?.skewX || 0)} onChange={(e) => handleChange('skewX', parseFloat(e.target.value) || 0)} />
              <span>°</span>
            </div>
            <div className="property-row">
              <label>Skew Y:</label>
              <input type="number" value={Math.round(selectedObject?.skewY || 0)} onChange={(e) => handleChange('skewY', parseFloat(e.target.value) || 0)} />
              <span>°</span>
            </div>
            <div className="property-row">
              <label>Opacity:</label>
              <input type="range" min="0" max="100" value={selectedObject?.opacity || 100} onChange={(e) => handleChange('opacity', parseInt(e.target.value))} />
              <span>{selectedObject?.opacity || 100}%</span>
            </div>
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
        )}

        {activeSection === 'fill' && (
          <div className="panel-section">
            <h4>Fill</h4>
            <div className="property-row">
              <label>Type:</label>
              <select value={state.currentFill.type} onChange={(e) => handleChange('fill.type', e.target.value)}>
                <option value="none">No Fill</option>
                <option value="solid">Solid Color (RGB)</option>
                <option value="spot">Spot Color</option>
                <option value="gradient">Gradient</option>
                <option value="texture">Texture</option>
                <option value="logo">Logo</option>
                <option value="mask">Mask</option>
                <option value="parent">Parent Fill</option>
              </select>
            </div>
            {(state.currentFill.type === 'solid' || state.currentFill.type === 'gradient') && (
              <div className="property-row">
                <label>Color:</label>
                <input type="color" value={state.currentFill.color} onChange={(e) => handleChange('fill.color', e.target.value)} />
                <span className="color-value">{state.currentFill.color}</span>
              </div>
            )}
            {state.currentFill.type === 'spot' && (
              <div className="property-row">
                <label>Spot Color:</label>
                <input type="color" value={state.currentFill.spotColor || '#ff0000'} onChange={(e) => handleChange('fill.spotColor', e.target.value)} />
                <select onChange={(e) => handleChange('fill.spotColor', e.target.value)}>
                  <option value="#ff0000">Red</option>
                  <option value="#00ff00">Green</option>
                  <option value="#0000ff">Blue</option>
                  <option value="#ffff00">Yellow</option>
                  <option value="#ff00ff">Magenta</option>
                  <option value="#00ffff">Cyan</option>
                  <option value="#000000">Black</option>
                  <option value="#ffffff">White</option>
                </select>
              </div>
            )}
            <div className="property-row">
              <label>Opacity:</label>
              <input type="range" min="0" max="100" value={state.currentFill.opacity} onChange={(e) => handleChange('fill.opacity', parseInt(e.target.value))} />
              <span>{state.currentFill.opacity}%</span>
            </div>
            <div className="action-buttons">
              <button onClick={() => actions.setFill({ ...state.currentFill, type: 'solid' })}>Solid</button>
              <button onClick={() => actions.setFill({ ...state.currentFill, type: 'gradient' })}>Gradient</button>
              <button onClick={() => actions.setFill({ ...state.currentFill, type: 'texture' })}>Texture</button>
              <button onClick={() => actions.setFill({ ...state.currentFill, type: 'logo' })}>Logo</button>
              <button onClick={() => actions.setFill({ ...state.currentFill, type: 'spot' })}>Spot Color</button>
              <button onClick={() => actions.setFill({ ...state.currentFill, type: 'mask' })}>Mask</button>
              <button onClick={() => actions.setFill({ ...state.currentFill, type: 'parent' })}>Parent</button>
              <button onClick={() => actions.setFill({ ...state.currentFill, type: 'none' })}>No Fill</button>
            </div>
          </div>
        )}

        {activeSection === 'stroke' && (
          <div className="panel-section">
            <h4>Stroke</h4>
            <div className="property-row">
              <label>Color:</label>
              <input type="color" value={state.currentStroke.color} onChange={(e) => handleChange('stroke.color', e.target.value)} />
              <span className="color-value">{state.currentStroke.color}</span>
            </div>
            <div className="property-row">
              <label>Width:</label>
              <input type="number" min="0" step="0.5" value={state.currentStroke.width} onChange={(e) => handleChange('stroke.width', parseFloat(e.target.value) || 0)} />
              <span>pt</span>
            </div>
            <div className="property-row">
              <label>Style:</label>
              <select value={state.currentStroke.style} onChange={(e) => handleChange('stroke.style', e.target.value)}>
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
                <option value="dash-dot">Dash-Dot</option>
              </select>
            </div>
          </div>
        )}

        {activeSection === 'text' && (
          <div className="panel-section">
            <h4>Text Settings</h4>
            <div className="property-row">
              <label>Text:</label>
              <input type="text" value={selectedObject?.text || ''} onChange={(e) => handleChange('text', e.target.value)} />
            </div>
            <div className="property-row">
              <label>Font:</label>
              <select value={state.textSettings.font} onChange={(e) => handleChange('text.font', e.target.value)}>
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
                <option value="Georgia">Georgia</option>
                <option value="Verdana">Verdana</option>
                <option value="Impact">Impact</option>
                <option value="Comic Sans MS">Comic Sans MS</option>
                <option value="Trebuchet MS">Trebuchet MS</option>
              </select>
            </div>
            <div className="property-row">
              <label>Size:</label>
              <input type="number" min="6" value={state.textSettings.size} onChange={(e) => handleChange('text.size', parseInt(e.target.value) || 16)} />
              <span>pt</span>
            </div>
            <div className="property-row">
              <label>Line Spacing:</label>
              <input type="number" step="0.1" value={state.textSettings.lineSpacing} onChange={(e) => handleChange('text.lineSpacing', parseFloat(e.target.value))} />
            </div>
            <div className="property-row">
              <label>Char Spacing:</label>
              <input type="number" step="0.5" value={state.textSettings.charSpacing} onChange={(e) => handleChange('text.charSpacing', parseFloat(e.target.value))} />
            </div>
            <div className="property-row">
              <label>Alignment:</label>
              <select value={state.textSettings.align} onChange={(e) => handleChange('text.align', e.target.value)}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
                <option value="justify">Justify</option>
              </select>
            </div>
            <div className="action-buttons">
              <button onClick={() => actions.setTextSettings({ bold: !state.textSettings.bold })} style={{ fontWeight: state.textSettings.bold ? 'bold' : 'normal' }}>B</button>
              <button onClick={() => actions.setTextSettings({ italic: !state.textSettings.italic })} style={{ fontStyle: state.textSettings.italic ? 'italic' : 'normal' }}>I</button>
              <button onClick={() => actions.setTextSettings({ underline: !state.textSettings.underline })} style={{ textDecoration: state.textSettings.underline ? 'underline' : 'none' }}>U</button>
              <button onClick={() => actions.applyVerticalText()}>Vertical</button>
              <button onClick={() => actions.applyTextToPath()}>On Path</button>
              <button onClick={() => actions.applyTextToArc()}>On Arc</button>
              <button onClick={() => actions.applyParagraphText()}>Paragraph</button>
            </div>
          </div>
        )}

        {activeSection === 'paragraph' && (
          <div className="panel-section">
            <h4>Paragraph Settings</h4>
            <div className="property-row">
              <label>Columns:</label>
              <input type="number" min="1" max="5" value={state.paragraphSettings.columns} onChange={(e) => handleChange('paragraph.columns', parseInt(e.target.value))} />
            </div>
            <div className="property-row">
              <label>Gutter:</label>
              <input type="number" step="0.5" value={state.paragraphSettings.gutter} onChange={(e) => handleChange('paragraph.gutter', parseFloat(e.target.value))} />
              <span>mm</span>
            </div>
            <div className="property-row">
              <label>Composing:</label>
              <select value={state.paragraphSettings.composingMethod} onChange={(e) => handleChange('paragraph.composingMethod', parseInt(e.target.value))}>
                <option value="0">Single Line</option>
                <option value="1">Multi Line</option>
                <option value="2">Circular</option>
              </select>
            </div>
            <div className="property-row">
              <label>Char/Word:</label>
              <input type="number" step="0.1" value={state.paragraphSettings.charToWordRatio} onChange={(e) => handleChange('paragraph.charToWordRatio', parseFloat(e.target.value))} />
            </div>
            <div className="property-row">
              <label>Elasticity:</label>
              <input type="range" min="0" max="100" value={state.paragraphSettings.elasticity} onChange={(e) => handleChange('paragraph.elasticity', parseInt(e.target.value))} />
              <span>{state.paragraphSettings.elasticity}%</span>
            </div>
            <div className="property-row">
              <label>Indent:</label>
              <input type="number" step="0.5" value={state.paragraphSettings.indent} onChange={(e) => handleChange('paragraph.indent', parseFloat(e.target.value))} />
              <span>mm</span>
            </div>
            <div className="property-row">
              <label>
                <input type="checkbox" checked={state.paragraphSettings.hyphenation} onChange={(e) => handleChange('paragraph.hyphenation', e.target.checked)} />
                Hyphenation
              </label>
            </div>
          </div>
        )}

        {activeSection === 'effects' && (
          <div className="panel-section">
            <h4>Effects</h4>
            <div className="property-row">
              <label>Effect:</label>
              <select value={eff.type || 'none'} onChange={(e) => {
                const map = {
                  none: () => actions.clearEffect(),
                  outline: () => actions.applyOutline(),
                  multiOutline: () => actions.applyMultiOutline(),
                  multiInline: () => actions.applyMultiInline(),
                  innerOutline: () => actions.applyInnerOutline(),
                  tintMap: () => actions.applyTintMap(),
                  fire: () => actions.applyFireEffect(),
                  reflect: () => actions.applyReflectEffect(),
                  logo3D: () => actions.applyLogo3D(),
                }
                const fn = map[e.target.value]
                if (fn) fn()
              }}>
                <option value="none">None</option>
                <option value="outline">Outline</option>
                <option value="multiOutline">Multi-Outline</option>
                <option value="multiInline">Multi-Inline</option>
                <option value="innerOutline">Inner Outline</option>
                <option value="tintMap">Tint Map</option>
                <option value="fire">Fire</option>
                <option value="reflect">Reflect</option>
                <option value="logo3D">Logo 3D</option>
              </select>
            </div>
            <div className="action-buttons">
              <button onClick={() => actions.applyOutline()}>Outline</button>
              <button onClick={() => actions.applyMultiOutline()}>Multi-Outline</button>
              <button onClick={() => actions.applyMultiInline()}>Multi-Inline</button>
              <button onClick={() => actions.applyInnerOutline()}>Inner Outline</button>
              <button onClick={() => actions.applyTintMap()}>Tint Map</button>
              <button onClick={() => actions.applyFireEffect()}>Fire</button>
              <button onClick={() => actions.applyReflectEffect()}>Reflect</button>
              <button onClick={() => actions.applyLogo3D()}>Logo 3D</button>
            </div>
          </div>
        )}

        {activeSection === '3d' && (
          <div className="panel-section">
            <h4>3D Effect</h4>
            <div className="property-row">
              <label>Depth:</label>
              <input type="range" min="1" max="100" value={eff.threeD?.depth || 20} onChange={(e) => actions.setEffect({ threeD: { ...eff.threeD, depth: parseInt(e.target.value) } })} />
              <span>{eff.threeD?.depth || 20}px</span>
            </div>
            <div className="property-row">
              <label>Angle:</label>
              <input type="range" min="0" max="360" value={eff.threeD?.angle || 45} onChange={(e) => actions.setEffect({ threeD: { ...eff.threeD, angle: parseInt(e.target.value) } })} />
              <span>{eff.threeD?.angle || 45}°</span>
            </div>
            <div className="property-row">
              <label>Bevel:</label>
              <input type="range" min="0" max="20" value={eff.threeD?.bevel || 5} onChange={(e) => actions.setEffect({ threeD: { ...eff.threeD, bevel: parseInt(e.target.value) } })} />
              <span>{eff.threeD?.bevel || 5}px</span>
            </div>
            <div className="property-row">
              <label>Lighting:</label>
              <select value={eff.threeD?.lighting || 'top-left'} onChange={(e) => actions.setEffect({ threeD: { ...eff.threeD, lighting: e.target.value } })}>
                <option value="top-left">Top Left</option>
                <option value="top-right">Top Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="center">Center</option>
              </select>
            </div>
            <div className="action-buttons">
              <button onClick={() => actions.apply3D()}>Apply 3D</button>
            </div>
          </div>
        )}

        {activeSection === 'shadow' && (
          <div className="panel-section">
            <h4>Shadows</h4>
            <div className="property-row">
              <label>Type:</label>
              <select onChange={(e) => {
                const type = e.target.value
                if (type === 'block') actions.applyBlockShadow()
                else if (type === 'drop') actions.applyDropShadow()
                else if (type === 'soft') actions.applySoftShadow()
                else if (type === 'glow') actions.applyGlow()
              }}>
                <option value="">Select Shadow Type</option>
                <option value="block">Block Shadow</option>
                <option value="drop">Drop Shadow</option>
                <option value="soft">Soft Shadow</option>
                <option value="glow">Glow Shadow</option>
              </select>
            </div>
            <div className="property-row">
              <label>Offset X:</label>
              <input type="number" value={eff.blockShadow?.offsetX || 3} onChange={(e) => actions.setEffect({ blockShadow: { ...eff.blockShadow, offsetX: parseInt(e.target.value) } })} />
              <span>px</span>
            </div>
            <div className="property-row">
              <label>Offset Y:</label>
              <input type="number" value={eff.blockShadow?.offsetY || 3} onChange={(e) => actions.setEffect({ blockShadow: { ...eff.blockShadow, offsetY: parseInt(e.target.value) } })} />
              <span>px</span>
            </div>
            <div className="property-row">
              <label>Blur:</label>
              <input type="range" min="0" max="30" value={eff.dropShadow?.blur || 5} onChange={(e) => actions.setEffect({ dropShadow: { ...eff.dropShadow, blur: parseInt(e.target.value) } })} />
              <span>{eff.dropShadow?.blur || 5}px</span>
            </div>
            <div className="property-row">
              <label>Color:</label>
              <input type="color" value={eff.dropShadow?.color || '#000000'} onChange={(e) => actions.setEffect({ dropShadow: { ...eff.dropShadow, color: e.target.value } })} />
            </div>
            <div className="action-buttons">
              <button onClick={() => actions.applyBlockShadow()}>Block Shadow</button>
              <button onClick={() => actions.applyDropShadow()}>Drop Shadow</button>
              <button onClick={() => actions.applySoftShadow()}>Soft Shadow</button>
              <button onClick={() => actions.applyGlow()}>Glow</button>
            </div>
          </div>
        )}

        {activeSection === 'clone' && (
          <div className="panel-section">
            <h4>Clone Settings</h4>
            <div className="property-row">
              <label>Type:</label>
              <select value={state.cloneSettings.type} onChange={(e) => actions.setCloneSettings({ type: e.target.value })}>
                <option value="single">Single Clone</option>
                <option value="array">Matrix Array</option>
                <option value="circle">Circle Array</option>
              </select>
            </div>
            {state.cloneSettings.type === 'array' && (
              <>
                <div className="property-row">
                  <label>Rows:</label>
                  <input type="number" min="1" max="20" value={state.cloneSettings.rows} onChange={(e) => actions.setCloneSettings({ rows: parseInt(e.target.value) })} />
                </div>
                <div className="property-row">
                  <label>Columns:</label>
                  <input type="number" min="1" max="20" value={state.cloneSettings.cols} onChange={(e) => actions.setCloneSettings({ cols: parseInt(e.target.value) })} />
                </div>
              </>
            )}
            {state.cloneSettings.type === 'circle' && (
              <>
                <div className="property-row">
                  <label>Radius:</label>
                  <input type="number" value={state.cloneSettings.circleRadius} onChange={(e) => actions.setCloneSettings({ circleRadius: parseInt(e.target.value) })} />
                  <span>mm</span>
                </div>
                <div className="property-row">
                  <label>Count:</label>
                  <input type="number" min="2" max="36" value={state.cloneSettings.circleCount} onChange={(e) => actions.setCloneSettings({ circleCount: parseInt(e.target.value) })} />
                </div>
              </>
            )}
            <div className="property-row">
              <label>Spacing X:</label>
              <input type="number" step="0.5" value={state.cloneSettings.spacingX} onChange={(e) => actions.setCloneSettings({ spacingX: parseFloat(e.target.value) })} />
              <span>mm</span>
            </div>
            <div className="property-row">
              <label>Spacing Y:</label>
              <input type="number" step="0.5" value={state.cloneSettings.spacingY} onChange={(e) => actions.setCloneSettings({ spacingY: parseFloat(e.target.value) })} />
              <span>mm</span>
            </div>
            <div className="action-buttons">
              <button onClick={() => actions.applyClone()}>Apply Clone</button>
            </div>
          </div>
        )}

        {activeSection === 'stepRepeat' && (
          <div className="panel-section">
            <h4>Step & Repeat</h4>
            <div className="property-row">
              <label>Method:</label>
              <select value={state.stepRepeatSettings.method} onChange={(e) => actions.setStepRepeatSettings({ method: e.target.value })}>
                <option value="grid">Grid</option>
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
                <option value="radial">Radial</option>
              </select>
            </div>
            {state.stepRepeatSettings.method === 'grid' && (
              <>
                <div className="property-row">
                  <label>Rows:</label>
                  <input type="number" min="1" max="20" value={state.stepRepeatSettings.rows} onChange={(e) => actions.setStepRepeatSettings({ rows: parseInt(e.target.value) })} />
                </div>
                <div className="property-row">
                  <label>Columns:</label>
                  <input type="number" min="1" max="20" value={state.stepRepeatSettings.cols} onChange={(e) => actions.setStepRepeatSettings({ cols: parseInt(e.target.value) })} />
                </div>
              </>
            )}
            <div className="property-row">
              <label>Spacing X:</label>
              <input type="number" step="0.5" value={state.stepRepeatSettings.spacingX} onChange={(e) => actions.setStepRepeatSettings({ spacingX: parseFloat(e.target.value) })} />
              <span>mm</span>
            </div>
            <div className="property-row">
              <label>Spacing Y:</label>
              <input type="number" step="0.5" value={state.stepRepeatSettings.spacingY} onChange={(e) => actions.setStepRepeatSettings({ spacingY: parseFloat(e.target.value) })} />
              <span>mm</span>
            </div>
            <div className="property-row">
              <label>
                <input type="checkbox" checked={state.stepRepeatSettings.alternate} onChange={(e) => actions.setStepRepeatSettings({ alternate: e.target.checked })} />
                Alternate Rows
              </label>
            </div>
            <div className="action-buttons">
              <button onClick={() => actions.applyStepRepeat()}>Apply Step & Repeat</button>
            </div>
          </div>
        )}

        {activeSection === 'warp' && (
          <div className="panel-section">
            <h4>Warp</h4>
            <div className="property-row">
              <label>Type:</label>
              <select value={state.warpSettings.type} onChange={(e) => actions.setWarpSettings({ type: e.target.value })}>
                <option value="circle">Circle</option>
                <option value="coons">Coons</option>
                <option value="flag">Flag</option>
                <option value="perspective">Perspective</option>
                <option value="skirt">Skirt</option>
                <option value="trapezoid">Trapezoid</option>
                <option value="wave">Wave</option>
              </select>
            </div>
            <div className="property-row">
              <label>Intensity:</label>
              <input type="range" min="0" max="100" value={state.warpSettings.intensity} onChange={(e) => actions.setWarpSettings({ intensity: parseInt(e.target.value) })} />
              <span>{state.warpSettings.intensity}%</span>
            </div>
            <div className="action-buttons">
              <button onClick={() => actions.applyWarpCircle()}>Circle</button>
              <button onClick={() => actions.applyWarpCoons()}>Coons</button>
              <button onClick={() => actions.applyWarpFlag()}>Flag</button>
              <button onClick={() => actions.applyWarpPerspective()}>Perspective</button>
              <button onClick={() => actions.applyWarpSkirt()}>Skirt</button>
              <button onClick={() => actions.applyWarpTrapezoid()}>Trapezoid</button>
              <button onClick={() => actions.applyWarpWave()}>Wave</button>
            </div>
          </div>
        )}

        {activeSection === 'dimension' && (
          <div className="panel-section">
            <h4>Dimension</h4>
            <div className="property-row">
              <label>Type:</label>
              <select value={state.dimensionSettings.type} onChange={(e) => actions.setDimensionSettings({ type: e.target.value })}>
                <option value="affine">Affine</option>
                <option value="active">Active</option>
                <option value="guide">Guide</option>
              </select>
            </div>
            <div className="property-row">
              <label>Units:</label>
              <select value={state.dimensionSettings.units} onChange={(e) => actions.setDimensionSettings({ units: e.target.value })}>
                <option value="mm">Millimeters</option>
                <option value="cm">Centimeters</option>
                <option value="in">Inches</option>
                <option value="pt">Points</option>
              </select>
            </div>
            <div className="property-row">
              <label>Precision:</label>
              <input type="number" min="0" max="3" value={state.dimensionSettings.precision} onChange={(e) => actions.setDimensionSettings({ precision: parseInt(e.target.value) })} />
              <span>decimals</span>
            </div>
            <div className="action-buttons">
              <button onClick={() => actions.applyDimension({ x: 100, y: 100, width: 100, height: 50, dimType: 'linear', value: 100 })}>Add Dimension</button>
            </div>
          </div>
        )}

        {activeSection === 'pen' && (
          <div className="panel-section">
            <h4>Pen Style</h4>
            <div className="property-row">
              <label>Style:</label>
              <select value={state.penSettings.style} onChange={(e) => actions.setPenSettings({ style: parseInt(e.target.value) })}>
                <option value="1">Solid</option>
                <option value="2">Dashed</option>
                <option value="3">Dotted</option>
                <option value="4">Calligraphy</option>
                <option value="5">Brush</option>
              </select>
            </div>
            <div className="property-row">
              <label>Width:</label>
              <input type="number" step="0.1" min="0.1" value={state.penSettings.width} onChange={(e) => actions.setPenSettings({ width: parseFloat(e.target.value) })} />
              <span>pt</span>
            </div>
            <div className="property-row">
              <label>End Cap:</label>
              <select value={state.penSettings.endCap} onChange={(e) => actions.setPenSettings({ endCap: e.target.value })}>
                <option value="round">Round</option>
                <option value="square">Square</option>
                <option value="butt">Butt</option>
              </select>
            </div>
            <div className="property-row">
              <label>Line Join:</label>
              <select value={state.penSettings.lineJoin} onChange={(e) => actions.setPenSettings({ lineJoin: e.target.value })}>
                <option value="miter">Miter</option>
                <option value="round">Round</option>
                <option value="bevel">Bevel</option>
              </select>
            </div>
            <div className="property-row">
              <label>Miter Limit:</label>
              <input type="number" min="1" max="10" value={state.penSettings.miterLimit} onChange={(e) => actions.setPenSettings({ miterLimit: parseFloat(e.target.value) })} />
            </div>
            <div className="action-buttons">
              <button onClick={() => actions.applyPenStyle()}>Apply Pen Style</button>
            </div>
          </div>
        )}

        {activeSection === 'trace' && (
          <div className="panel-section">
            <h4>Vectorize (Trace)</h4>
            <div className="property-row">
              <label>Mode:</label>
              <select value={state.traceSettings.mode} onChange={(e) => actions.setTraceSettings({ mode: e.target.value })}>
                <option value="color">Color Trace</option>
                <option value="outline">Outline Trace</option>
                <option value="centerline">Centerline Trace</option>
              </select>
            </div>
            <div className="property-row">
              <label>Threshold:</label>
              <input type="range" min="0" max="255" value={state.traceSettings.threshold} onChange={(e) => actions.setTraceSettings({ threshold: parseInt(e.target.value) })} />
              <span>{state.traceSettings.threshold}</span>
            </div>
            <div className="property-row">
              <label>Smoothing:</label>
              <input type="range" min="0" max="10" value={state.traceSettings.smoothing} onChange={(e) => actions.setTraceSettings({ smoothing: parseInt(e.target.value) })} />
              <span>{state.traceSettings.smoothing}</span>
            </div>
            <div className="property-row">
              <label>Corner Threshold:</label>
              <input type="range" min="0" max="180" value={state.traceSettings.cornerThreshold} onChange={(e) => actions.setTraceSettings({ cornerThreshold: parseInt(e.target.value) })} />
              <span>{state.traceSettings.cornerThreshold}°</span>
            </div>
            <div className="property-row">
              <label>Noise Reduction:</label>
              <input type="range" min="0" max="5" value={state.traceSettings.noiseReduction} onChange={(e) => actions.setTraceSettings({ noiseReduction: parseInt(e.target.value) })} />
              <span>{state.traceSettings.noiseReduction}</span>
            </div>
            <div className="property-row">
              <label>Colors:</label>
              <input type="number" min="2" max="256" value={state.traceSettings.colorCount} onChange={(e) => actions.setTraceSettings({ colorCount: parseInt(e.target.value) })} />
            </div>
            <div className="action-buttons">
              <button onClick={() => actions.applyVectorize()}>Vectorize Image</button>
            </div>
          </div>
        )}

        {activeSection === 'page' && (
          <div className="panel-section">
            <h4>Page Setup</h4>
            <div className="property-row">
              <label>Preset:</label>
              <select onChange={(e) => {
                const preset = state.pageSizes.find(p => p.name === e.target.value)
                if (preset) actions.setPageSize(preset.width, preset.height)
              }}>
                {state.pageSizes.map(p => (
                  <option key={p.name} value={p.name}>{p.name} ({p.width}x{p.height}mm)</option>
                ))}
              </select>
            </div>
            <div className="property-row">
              <label>Width:</label>
              <input type="number" value={state.pages[state.activePage]?.width || 210} onChange={(e) => actions.setPageSize(parseFloat(e.target.value), state.pages[state.activePage]?.height || 297)} />
              <span>mm</span>
            </div>
            <div className="property-row">
              <label>Height:</label>
              <input type="number" value={state.pages[state.activePage]?.height || 297} onChange={(e) => actions.setPageSize(state.pages[state.activePage]?.width || 210, parseFloat(e.target.value))} />
              <span>mm</span>
            </div>
            <div className="action-buttons">
              <button onClick={() => actions.setPageOrientation()}>Swap Orientation</button>
              <button onClick={() => actions.addPage()}>Add Page</button>
              <button onClick={() => actions.deletePage()}>Delete Page</button>
              <button onClick={() => actions.addMasterPage()}>Add Master Page</button>
            </div>
            <h4>Registration Marks</h4>
            <div className="property-row">
              <label>
                <input type="checkbox" checked={state.registrationMarks.enabled} onChange={(e) => actions.setRegistrationMarks({ enabled: e.target.checked })} />
                Enable
              </label>
            </div>
            <div className="property-row">
              <label>Size:</label>
              <input type="number" value={state.registrationMarks.size} onChange={(e) => actions.setRegistrationMarks({ size: parseInt(e.target.value) })} />
              <span>mm</span>
            </div>
            <div className="property-row">
              <label>Offset:</label>
              <input type="number" step="0.5" value={state.registrationMarks.offset} onChange={(e) => actions.setRegistrationMarks({ offset: parseFloat(e.target.value) })} />
              <span>mm</span>
            </div>
            <div className="property-row">
              <label>Style:</label>
              <select value={state.registrationMarks.style} onChange={(e) => actions.setRegistrationMarks({ style: e.target.value })}>
                <option value="L-shape">L-Shape</option>
                <option value="cross">Cross</option>
                <option value="circle">Circle</option>
                <option value="square">Square</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
