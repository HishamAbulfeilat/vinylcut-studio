import React from 'react'
import './StatusBar.css'

export default function StatusBar({
  zoom,
  cursorPos,
  objectCount,
  selectedCount,
  selectionSize,
  pageCount,
  activePage,
  tool
}) {
  return (
    <div className="statusbar">
      <div className="status-left">
        <span className="status-item">
          <span className="status-label">Tool:</span> {tool}
        </span>
        <span className="status-item">
          <span className="status-label">Objects:</span> {objectCount}
        </span>
        <span className="status-item">
          <span className="status-label">Selected:</span> {selectedCount}
          {selectionSize && (
            <span className="status-size">
              ({Math.round(selectionSize.width)} × {Math.round(selectionSize.height)} mm)
            </span>
          )}
        </span>
        <span className="status-item">
          <span className="status-label">Page:</span> {activePage + 1} of {pageCount}
        </span>
      </div>
      <div className="status-center">
        <span className="status-item">
          <span className="status-label">X:</span> {Math.round(cursorPos.x)}
        </span>
        <span className="status-item">
          <span className="status-label">Y:</span> {Math.round(cursorPos.y)}
        </span>
      </div>
      <div className="status-right">
        <span className="status-item">
          <span className="status-label">Zoom:</span> {Math.round(zoom * 100)}%
        </span>
      </div>
    </div>
  )
}
