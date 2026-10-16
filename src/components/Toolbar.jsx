import React from 'react'
import './Toolbar.css'

// Power Shapes are part of the core tool surface. Declaring them here keeps
// the toolbar self-sufficient: if a host omits them from `tools`, they are
// still offered, and any host-provided entry wins so metadata is never
// duplicated.
export const POWER_SHAPE_TOOLS = [
  { id: 'powerRect', name: 'Power Rect', icon: '▣' },
  { id: 'powerCircle', name: 'Power Circle', icon: '◉' },
  { id: 'powerStar', name: 'Power Star', icon: '★' },
  { id: 'powerPolygon', name: 'Power Poly', icon: '⬠' },
]

export default function Toolbar({ tools = [], activeTool, onToolChange }) {
  const merged = React.useMemo(() => {
    const present = new Set(tools.map((tool) => tool.id))
    return [...tools, ...POWER_SHAPE_TOOLS.filter((tool) => !present.has(tool.id))]
  }, [tools])

  return (
    <div className="toolbar">
      <div className="toolbar-scroll">
        {merged.map((tool) => (
          <button
            key={tool.id}
            className={`tool-button ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => onToolChange(tool.id)}
            title={`${tool.name}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
          >
            <span className="tool-icon">{tool.icon}</span>
            <span className="tool-name">{tool.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
