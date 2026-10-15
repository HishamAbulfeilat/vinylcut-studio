import React from 'react'
import { useApp } from '../context/AppContext'
import './CropMarks.css'

export default function CropMarks() {
  const { state } = useApp()
  if (!state.registrationMarks?.enabled) return null

  const page = state.pages[state.activePage]
  if (!page) return null

  const scale = state.zoom
  const margin = state.registrationMarks.offset * scale
  const size = state.registrationMarks.size * scale
  const color = state.registrationMarks.color

  return (
    <div className="crop-marks">
      {/* Top-left */}
      <div className="crop-mark crop-mark-tl" style={{
        left: margin,
        top: margin,
        borderColor: color,
      }}>
        <div className="crop-line crop-line-h" style={{ width: size, background: color }} />
        <div className="crop-line crop-line-v" style={{ height: size, background: color }} />
      </div>
      {/* Top-right */}
      <div className="crop-mark crop-mark-tr" style={{
        right: margin,
        top: margin,
        borderColor: color,
      }}>
        <div className="crop-line crop-line-h" style={{ width: size, background: color }} />
        <div className="crop-line crop-line-v" style={{ height: size, background: color }} />
      </div>
      {/* Bottom-left */}
      <div className="crop-mark crop-mark-bl" style={{
        left: margin,
        bottom: margin,
        borderColor: color,
      }}>
        <div className="crop-line crop-line-h" style={{ width: size, background: color }} />
        <div className="crop-line crop-line-v" style={{ height: size, background: color }} />
      </div>
      {/* Bottom-right */}
      <div className="crop-mark crop-mark-br" style={{
        right: margin,
        bottom: margin,
        borderColor: color,
      }}>
        <div className="crop-line crop-line-h" style={{ width: size, background: color }} />
        <div className="crop-line crop-line-v" style={{ height: size, background: color }} />
      </div>
    </div>
  )
}
