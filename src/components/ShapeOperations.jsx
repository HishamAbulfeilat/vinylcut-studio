import React from 'react'
import { useApp } from '../context/AppContext'
import './ShapeOperations.css'

export default function ShapeOperations({ onClose }) {
  const { actions } = useApp()

  const operations = [
    { id: 'weld', name: 'Weld / Combine', icon: '∪', desc: 'Combine overlapping shapes into one', action: () => actions.applyWeld() },
    { id: 'punch', name: 'Punch Out', icon: '⊖', desc: 'Remove front shape from back shape', action: () => actions.applyPunchOut() },
    { id: 'trim', name: 'Trim', icon: '✂', desc: 'Remove overlap but keep both objects', action: () => actions.applyTrim() },
    { id: 'cookie', name: 'Cookie Cut', icon: '◉', desc: 'Keep only overlapping areas', action: () => actions.applyCookieCut() },
    { id: 'outline', name: 'Create Outline', icon: '○', desc: 'Create outline around selection', action: () => actions.applyOutline() },
    { id: 'innerOutline', name: 'Inner Outline', icon: '◎', desc: 'Create inner outline', action: () => actions.applyInnerOutline() },
  ]

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog shape-ops-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Shape Operations</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="dialog-body">
          <div className="ops-grid">
            {operations.map(op => (
              <button key={op.id} className="op-btn" onClick={() => { op.action(); onClose() }}>
                <span className="op-icon">{op.icon}</span>
                <span className="op-name">{op.name}</span>
                <span className="op-desc">{op.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
