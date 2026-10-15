import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import './VinylSpooler.css'

export default function VinylSpooler({ onClose }) {
  const { state, actions } = useApp()
  const [jobs, setJobs] = useState([])
  const [selectedJob, setSelectedJob] = useState(null)
  const [settings, setSettings] = useState({
    speed: 50,
    force: 80,
    offset: 0.25,
    overcut: 0,
    bidirectional: true,
    mediaSupplies: 'roll',
    cutterModel: 'Summa D60',
  })

  const addJob = () => {
    const page = state.pages[state.activePage] || { width: 210, height: 297 }
    const paths = state.objects.length
    if (!paths) {
      actions.notify('Nothing to cut - the page is empty', 'warn')
      return
    }
    const newJob = {
      id: Date.now(),
      name: (state.documentName || 'Untitled-1').replace(/\.[^.]*$/, ''),
      status: 'ready',
      progress: 0,
      paths,
      material: settings.mediaSupplies === 'roll' ? 'Roll vinyl' : 'Sheet vinyl',
      size: `${Math.round(page.width)}x${Math.round(page.height)}mm`,
    }
    setJobs(list => [...list, newJob])
    setSelectedJob(newJob.id)
  }

  // Real output: stream HPGL to the cutter over WebSerial when the browser
  // supports it, otherwise save a .plt file the cutter software can load.
  const startCut = async (jobId) => {
    setJobs(list => list.map(j => (j.id === jobId ? { ...j, status: 'cutting', progress: 0 } : j)))
    const result = await actions.sendToCutter({
      speed: Math.round(settings.speed / 5),
      force: Math.round(settings.force / 10),
      baudRate: 9600,
    })
    if (!result) {
      setJobs(list => list.map(j => (j.id === jobId ? { ...j, status: 'stopped', progress: 0 } : j)))
      return
    }
    const interval = setInterval(() => {
      setJobs(prev => prev.map(j => {
        if (j.id === jobId && j.status === 'cutting') {
          const newProgress = j.progress + 10
          if (newProgress >= 100) {
            clearInterval(interval)
            return { ...j, status: 'complete', progress: 100 }
          }
          return { ...j, progress: newProgress }
        }
        return j
      }))
    }, 250)
  }

  const pauseJob = (jobId) => {
    setJobs(jobs.map(j => j.id === jobId ? { ...j, status: 'paused' } : j))
  }

  const stopJob = (jobId) => {
    setJobs(jobs.map(j => j.id === jobId ? { ...j, status: 'stopped', progress: 0 } : j))
  }

  const removeJob = (jobId) => {
    setJobs(jobs.filter(j => j.id !== jobId))
    if (selectedJob === jobId) setSelectedJob(null)
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog spooler-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Vinyl Spooler</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="dialog-body">
          <div className="spooler-main">
            <div className="job-list">
              <div className="job-list-header">
                <h4>Cut Jobs</h4>
                <button className="btn btn-sm" onClick={addJob}>+ Add Job</button>
              </div>
              <div className="jobs">
                {jobs.map(job => (
                  <div
                    key={job.id}
                    className={`job-item ${selectedJob === job.id ? 'selected' : ''}`}
                    onClick={() => setSelectedJob(job.id)}
                  >
                    <div className="job-info">
                      <span className="job-name">{job.name}</span>
                      <span className="job-details">{job.material} - {job.size}</span>
                    </div>
                    <div className="job-status">
                      <span className={`status-badge ${job.status}`}>{job.status}</span>
                      {job.status === 'cutting' && (
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${job.progress}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="job-settings">
              <h4>Cutter Settings</h4>
              <div className="settings-form">
                <div className="setting-row">
                  <label>Cutter Model:</label>
                  <select value={settings.cutterModel} onChange={e => setSettings({...settings, cutterModel: e.target.value})}>
                    <option>Summa D60</option>
                    <option>Graphtec CE6000</option>
                    <option>Roland GX-24</option>
                    <option>Mimaki CG-130</option>
                  </select>
                </div>
                <div className="setting-row">
                  <label>Speed:</label>
                  <input type="range" min="1" max="100" value={settings.speed} onChange={e => setSettings({...settings, speed: parseInt(e.target.value)})} />
                  <span>{settings.speed} cm/s</span>
                </div>
                <div className="setting-row">
                  <label>Force:</label>
                  <input type="range" min="1" max="200" value={settings.force} onChange={e => setSettings({...settings, force: parseInt(e.target.value)})} />
                  <span>{settings.force} g</span>
                </div>
                <div className="setting-row">
                  <label>Offset:</label>
                  <input type="number" step="0.01" value={settings.offset} onChange={e => setSettings({...settings, offset: parseFloat(e.target.value)})} />
                  <span>mm</span>
                </div>
                <div className="setting-row">
                  <label>Overcut:</label>
                  <input type="number" step="0.1" value={settings.overcut} onChange={e => setSettings({...settings, overcut: parseFloat(e.target.value)})} />
                  <span>mm</span>
                </div>
                <div className="setting-row">
                  <label>
                    <input type="checkbox" checked={settings.bidirectional} onChange={e => setSettings({...settings, bidirectional: e.target.checked})} />
                    Bidirectional
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div className="spooler-actions">
            <button className="btn btn-primary" onClick={() => selectedJob && startCut(selectedJob)}>Start Cut</button>
            <button className="btn" onClick={() => selectedJob && pauseJob(selectedJob)}>Pause</button>
            <button className="btn" onClick={() => selectedJob && stopJob(selectedJob)}>Stop</button>
            <button className="btn btn-danger" onClick={() => selectedJob && removeJob(selectedJob)}>Remove</button>
          </div>
        </div>
      </div>
    </div>
  )
}
