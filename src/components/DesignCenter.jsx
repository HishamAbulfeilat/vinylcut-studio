import React from 'react'
import Canvas from './Canvas'
import './DesignCenter.css'

// The Design Center: the design-stage workspace (SHELL-SPEC §1). Hosts
// the canvas with its rulers and the centered white page.
export default function DesignCenter({ canvasRef }) {
  return (
    <div className="design-center">
      <Canvas ref={canvasRef} />
    </div>
  )
}
