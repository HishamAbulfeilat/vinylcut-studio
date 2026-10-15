import React from 'react'
import './Dialog.css'

export default function Dialog({ type, title, message, onConfirm, onCancel }) {
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>{title}</h3>
        </div>
        <div className="dialog-body">
          <p>{message}</p>
        </div>
        <div className="dialog-footer">
          {type === 'confirm' && (
            <button className="dialog-btn dialog-btn-cancel" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button className="dialog-btn dialog-btn-confirm" onClick={onConfirm}>
            {type === 'confirm' ? 'OK' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
