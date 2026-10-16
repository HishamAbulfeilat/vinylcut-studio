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

// The shell's tool strip is stage-dependent (docs/SHELL-SPEC.md §1): each stage
// tab offers the tools that belong to that task, while the Design stage keeps
// the full drawing surface. `null` means "the whole catalog".
export const STAGE_TOOLS = {
  design: null,
  cut: ['select', 'node', 'pan', 'zoom', 'line', 'curve', 'knife', 'contour', 'dimension'],
  print: ['select', 'pan', 'zoom', 'image', 'dimension'],
  layout: ['select', 'pan', 'zoom', 'clone', 'cloneArray', 'cloneCircle', 'dimension'],
  effects: ['select', 'pan', 'zoom', 'fill', 'eraser', 'outline', 'shadow', 'glow', '3d', 'warpCircle', 'warpFlag', 'warpWave'],
}

export function toolsForStage(stage, tools) {
  const ids = STAGE_TOOLS[stage]
  if (!ids) return tools
  const byId = new Map(tools.map((tool) => [tool.id, tool]))
  return ids.map((id) => byId.get(id)).filter(Boolean)
}

export default function Toolbar({ tools = [], activeTool, onToolChange, activeTab = 'design' }) {
  const merged = React.useMemo(() => {
    const scoped = toolsForStage(activeTab, tools)
    const present = new Set(scoped.map((tool) => tool.id))
    const extras = activeTab === 'design'
      ? POWER_SHAPE_TOOLS.filter((tool) => !present.has(tool.id))
      : []
    return [...scoped, ...extras]
  }, [tools, activeTab])

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
