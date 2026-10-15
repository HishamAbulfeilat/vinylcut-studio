import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import './ContourCutWizard.css'

export default function ContourCutWizard({ onClose }) {
  const { state, actions } = useApp()
  const [step, setStep] = useState(1)
  const [settings, setSettings] = useState({
    cutType: 'contour',
    offset: 1.0,
    cornerStyle: 'rounded',
    cutLineColor: '#FF0000',
    cutLineWidth: 0.25,
    addRegistrationMarks: true,
    markSize: 5,
    markOffset: 2,
    cutOrder: 'insideOut',
    skipInnerCuts: false,
  })

  const totalSteps = 4

  const apply = () => {
    actions.applyContourCut({
      cutType: settings.cutType,
      offset: settings.offset,
      cornerStyle: settings.cornerStyle,
      cutLineColor: settings.cutLineColor,
      cutLineWidth: settings.cutLineWidth,
      cutOrder: settings.cutOrder,
      skipInnerCuts: settings.skipInnerCuts,
      addRegistrationMarks: settings.addRegistrationMarks,
      markSize: settings.markSize,
      markOffset: settings.markOffset,
    })
    onClose()
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog contour-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Contour Cut Wizard</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="dialog-body">
          <div className="wizard-steps">
            {['Setup', 'Offset', 'Registration', 'Output'].map((s, i) => (
              <div key={i} className={`wizard-step ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'complete' : ''}`}>
                <div className="step-number">{step > i + 1 ? '✓' : i + 1}</div>
                <div className="step-label">{s}</div>
              </div>
            ))}
          </div>

          <div className="wizard-content">
            {step === 1 && (
              <div className="step-content">
                <h4>Cut Type</h4>
                <div className="option-group">
                  <label className="radio-label">
                    <input type="radio" checked={settings.cutType === 'contour'} onChange={() => setSettings({...settings, cutType: 'contour'})} />
                    Contour Cut (follow object outline)
                  </label>
                  <label className="radio-label">
                    <input type="radio" checked={settings.cutType === 'crop'} onChange={() => setSettings({...settings, cutType: 'crop'})} />
                    Crop Marks (rectangle around object)
                  </label>
                  <label className="radio-label">
                    <input type="radio" checked={settings.cutType === 'both'} onChange={() => setSettings({...settings, cutType: 'both'})} />
                    Both
                  </label>
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="step-content">
                <h4>Offset Settings</h4>
                <div className="setting-row">
                  <label>Offset Distance:</label>
                  <input type="number" step="0.1" min="0" value={settings.offset} onChange={e => setSettings({...settings, offset: parseFloat(e.target.value)})} />
                  <span>mm</span>
                </div>
                <div className="setting-row">
                  <label>Corner Style:</label>
                  <select value={settings.cornerStyle} onChange={e => setSettings({...settings, cornerStyle: e.target.value})}>
                    <option value="rounded">Rounded</option>
                    <option value="mitered">Mitered</option>
                    <option value="beveled">Beveled</option>
                  </select>
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="step-content">
                <h4>Registration Marks</h4>
                <label className="checkbox-label">
                  <input type="checkbox" checked={settings.addRegistrationMarks} onChange={e => setSettings({...settings, addRegistrationMarks: e.target.checked})} />
                  Add Registration Marks
                </label>
                {settings.addRegistrationMarks && (
                  <>
                    <div className="setting-row">
                      <label>Mark Size:</label>
                      <input type="number" value={settings.markSize} onChange={e => setSettings({...settings, markSize: parseInt(e.target.value)})} />
                      <span>mm</span>
                    </div>
                    <div className="setting-row">
                      <label>Mark Offset:</label>
                      <input type="number" step="0.5" value={settings.markOffset} onChange={e => setSettings({...settings, markOffset: parseFloat(e.target.value)})} />
                      <span>mm</span>
                    </div>
                  </>
                )}
              </div>
            )}
            {step === 4 && (
              <div className="step-content">
                <h4>Output Settings</h4>
                <div className="setting-row">
                  <label>Cut Line Color:</label>
                  <input type="color" value={settings.cutLineColor} onChange={e => setSettings({...settings, cutLineColor: e.target.value})} />
                  <span>{settings.cutLineColor}</span>
                </div>
                <div className="setting-row">
                  <label>Cut Line Width:</label>
                  <input type="number" step="0.05" value={settings.cutLineWidth} onChange={e => setSettings({...settings, cutLineWidth: parseFloat(e.target.value)})} />
                  <span>mm</span>
                </div>
                <label className="checkbox-label">
                  <input type="checkbox" checked={settings.cutOrder === 'insideOut'} onChange={() => setSettings({...settings, cutOrder: settings.cutOrder === 'insideOut' ? 'outsideIn' : 'insideOut'})} />
                  Cut Inside First
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={settings.skipInnerCuts} onChange={e => setSettings({...settings, skipInnerCuts: e.target.checked})} />
                  Skip Inner Cuts
                </label>
              </div>
            )}
          </div>
        </div>
        <div className="dialog-footer">
          {step > 1 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
          {step < totalSteps ? (
            <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Next</button>
          ) : (
            <button className="btn btn-primary" onClick={apply}>Apply &amp; Close</button>
          )}
        </div>
      </div>
    </div>
  )
}
