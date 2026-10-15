import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import './VectorizeDialog.css'

export default function VectorizeDialog({ selectedObject, onClose }) {
  const { state, actions } = useApp()
  const [mode, setMode] = useState('outline')
  const [threshold, setThreshold] = useState(128)
  const [colors, setColors] = useState(8)
  const [smoothing, setSmoothing] = useState(0.8)
  const [noise, setNoise] = useState(3)
  const [replaceSource, setReplaceSource] = useState(true)
  const [busy, setBusy] = useState(false)

  const images = state.objects.filter(o => o.type === 'image')
  const target = (selectedObject && selectedObject.type === 'image') ? selectedObject : images[0]
  const total = state.objects.filter(o => o.isVectorized).length

  const run = async () => {
    setBusy(true)
    try {
      await actions.vectorizeSelected({ mode, threshold, colors, smoothing, noise, replaceSource })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog vectorize-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Vectorize (Trace Bitmap)</h3>
          <button className="dialog-close" onClick={onClose}>×</button>
        </div>

        <div className="dialog-body">
          {!target && (
            <p className="vectorize-hint">
              No imported image to trace. Use <strong>File &gt; Import</strong> (or the Image tool) to bring in a PNG
              or JPEG first. {total > 0 ? `${total} traced shape${total === 1 ? '' : 's'} already on the page.` : ''}
            </p>
          )}

          {target && (
            <div className="vectorize-preview">
              <img src={target.src} alt="source" />
              <div className="vectorize-meta">
                {target.naturalWidth || Math.round(target.width)} × {target.naturalHeight || Math.round(target.height)}
              </div>
            </div>
          )}

          <div className="vectorize-row">
            <label>Method</label>
            <div className="vectorize-seg">
              <button className={mode === 'outline' ? 'active' : ''} onClick={() => setMode('outline')}>Outline (B/W)</button>
              <button className={mode === 'color' ? 'active' : ''} onClick={() => setMode('color')}>Colour Layers</button>
            </div>
          </div>

          {mode === 'outline' ? (
            <div className="vectorize-row">
              <label>Threshold</label>
              <input type="range" min="1" max="254" value={threshold} onChange={(e) => setThreshold(parseInt(e.target.value, 10))} />
              <span className="vectorize-value">{threshold}</span>
            </div>
          ) : (
            <div className="vectorize-row">
              <label>Colours</label>
              <input type="range" min="2" max="16" value={colors} onChange={(e) => setColors(parseInt(e.target.value, 10))} />
              <span className="vectorize-value">{colors}</span>
            </div>
          )}

          <div className="vectorize-row">
            <label>Smoothing</label>
            <input type="range" min="0" max="4" step="0.1" value={smoothing} onChange={(e) => setSmoothing(parseFloat(e.target.value))} />
            <span className="vectorize-value">{smoothing.toFixed(1)}px</span>
          </div>

          <div className="vectorize-row">
            <label>Noise filter</label>
            <input type="range" min="0" max="40" value={noise} onChange={(e) => setNoise(parseInt(e.target.value, 10))} />
            <span className="vectorize-value">{noise}px²</span>
          </div>

          <label className="vectorize-check">
            <input type="checkbox" checked={replaceSource} onChange={(e) => setReplaceSource(e.target.checked)} />
            Replace the source bitmap with the traced paths
          </label>
        </div>

        <div className="dialog-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!target || busy} onClick={run}>
            {busy ? 'Tracing…' : 'Vectorize'}
          </button>
        </div>
      </div>
    </div>
  )
}
