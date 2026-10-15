import React, { useState } from 'react'
import './TextureLibrary.css'

const textures = [
  { id: 1, name: 'Brushed Metal', category: 'Metal', color: '#888' },
  { id: 2, name: 'Chrome', category: 'Metal', color: '#ccc' },
  { id: 3, name: 'Gold Leaf', category: 'Metal', color: '#daa520' },
  { id: 4, name: 'Wood Grain', category: 'Natural', color: '#8b4513' },
  { id: 5, name: 'Marble', category: 'Natural', color: '#f0e6d3' },
  { id: 6, name: 'Granite', category: 'Natural', color: '#696969' },
  { id: 7, name: 'Leather', category: 'Fabric', color: '#8b4513' },
  { id: 8, name: 'Carbon Fiber', category: 'Synthetic', color: '#333' },
  { id: 9, name: 'Camouflage', category: 'Pattern', color: '#4a5d23' },
  { id: 10, name: 'Animal Print', category: 'Pattern', color: '#daa520' },
  { id: 11, name: 'Stripes', category: 'Pattern', color: '#ff0000' },
  { id: 12, name: 'Dots', category: 'Pattern', color: '#0000ff' },
]

export default function TextureLibrary({ onClose, onSelect }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const categories = ['all', ...new Set(textures.map(t => t.category))]

  const filtered = textures.filter(t => {
    const matchCat = filter === 'all' || t.category === filter
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog texture-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Texture Library</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="dialog-body">
          <div className="texture-filters">
            <input
              type="text"
              placeholder="Search textures..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="texture-search"
            />
            <div className="category-tabs">
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`category-tab ${filter === cat ? 'active' : ''}`}
                  onClick={() => setFilter(cat)}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="texture-grid">
            {filtered.map(tex => (
              <div
                key={tex.id}
                className="texture-item"
                onClick={() => { onSelect(tex); onClose() }}
              >
                <div className="texture-preview" style={{ background: tex.color }} />
                <span className="texture-name">{tex.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
