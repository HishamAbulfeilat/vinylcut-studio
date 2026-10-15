import React from 'react'
import './TabBar.css'

const tabs = [
  { id: 'design', label: 'Design' },
  { id: 'cut', label: 'Cut' },
  { id: 'print', label: 'Print' },
  { id: 'layout', label: 'Layout' },
  { id: 'effects', label: 'Effects' },
]

export default function TabBar({ activeTab, onTabChange }) {
  return (
    <div className="tabbar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
