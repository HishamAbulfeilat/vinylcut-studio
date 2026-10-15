import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import './MasterPages.css'

export default function MasterPages({ onClose }) {
  const { state, dispatch, actions } = useApp()
  const [activeMaster, setActiveMaster] = useState(0)

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog master-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Master Pages</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="dialog-body">
          <div className="master-list">
            <div className="master-list-header">
              <h4>Master Pages</h4>
              <button className="btn btn-sm" onClick={() => actions.addMasterPage()}>+ Add Master</button>
            </div>
            <div className="masters">
              {state.masterPages.length === 0 ? (
                <div className="empty-state">No master pages yet. Click "+ Add Master" to create one.</div>
              ) : (
                state.masterPages.map((master, idx) => (
                  <div
                    key={master.id}
                    className={`master-item ${activeMaster === idx ? 'active' : ''}`}
                    onClick={() => setActiveMaster(idx)}
                  >
                    <div className="master-info">
                      <span className="master-name">{master.name}</span>
                      <span className="master-details">{master.width}x{master.height}mm - {master.objects.length} objects</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="master-preview">
            <h4>Preview</h4>
            <div className="master-canvas" style={{
              width: (state.masterPages[activeMaster]?.width || 210) * 1.5,
              height: (state.masterPages[activeMaster]?.height || 297) * 1.5,
            }}>
              <div className="master-content">
                {state.masterPages[activeMaster]?.objects?.length > 0 ? (
                  <span>{state.masterPages[activeMaster].objects.length} objects</span>
                ) : (
                  <span className="empty-text">Empty Master Page</span>
                )}
              </div>
            </div>
          </div>
          <div className="master-settings">
            <h4>Settings</h4>
            <div className="setting-row">
              <label>Name:</label>
              <input
                type="text"
                value={state.masterPages[activeMaster]?.name || ''}
                onChange={(e) => {
                  const newMasters = [...state.masterPages]
                  if (newMasters[activeMaster]) {
                    newMasters[activeMaster] = { ...newMasters[activeMaster], name: e.target.value }
                    dispatch({ type: 'SET_MASTER_PAGES', payload: newMasters })
                  }
                }}
              />
            </div>
            <div className="setting-row">
              <label>Width:</label>
              <input
                type="number"
                value={state.masterPages[activeMaster]?.width || 210}
                onChange={(e) => {
                  const newMasters = [...state.masterPages]
                  if (newMasters[activeMaster]) {
                    newMasters[activeMaster] = { ...newMasters[activeMaster], width: parseFloat(e.target.value) }
                    dispatch({ type: 'SET_MASTER_PAGES', payload: newMasters })
                  }
                }}
              />
              <span>mm</span>
            </div>
            <div className="setting-row">
              <label>Height:</label>
              <input
                type="number"
                value={state.masterPages[activeMaster]?.height || 297}
                onChange={(e) => {
                  const newMasters = [...state.masterPages]
                  if (newMasters[activeMaster]) {
                    newMasters[activeMaster] = { ...newMasters[activeMaster], height: parseFloat(e.target.value) }
                    dispatch({ type: 'SET_MASTER_PAGES', payload: newMasters })
                  }
                }}
              />
              <span>mm</span>
            </div>
          </div>
        </div>
        <div className="dialog-footer">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => { actions.applyMasterToPage(); onClose() }}>Apply to Current Page</button>
        </div>
      </div>
    </div>
  )
}
