import React, { useState, useCallback, useRef } from 'react'
import MenuBar from './components/MenuBar'
import Toolbar from './components/Toolbar'
import Canvas from './components/Canvas'
import PropertyPanel from './components/PropertyPanel'
import StatusBar from './components/StatusBar'
import TabBar from './components/TabBar'
import Dialog from './components/Dialog'
import VinylSpooler from './components/VinylSpooler'
import ContourCutWizard from './components/ContourCutWizard'
import AlignmentDialog from './components/AlignmentDialog'
import GradientEditor from './components/GradientEditor'
import TextureLibrary from './components/TextureLibrary'
import StepRepeatDialog from './components/StepRepeatDialog'
import ShapeOperations from './components/ShapeOperations'
import KeyboardShortcuts from './components/KeyboardShortcuts'
import MasterPages from './components/MasterPages'
import ExportDialog from './components/ExportDialog'
import FontManager from './components/FontManager'
import ColorLibrary from './components/ColorLibrary'
import VectorizeDialog from './components/VectorizeDialog'
import { AppProvider, useApp } from './context/AppContext'
import { printDocument } from './platform'
import './App.css'

const tools = [
  // Selection & Navigation
  { id: 'select', name: 'Select', icon: '⬚', shortcut: 'V' },
  { id: 'node', name: 'Node Edit', icon: '◇', shortcut: 'N' },
  { id: 'pan', name: 'Pan', icon: '✋', shortcut: 'H' },
  { id: 'zoom', name: 'Zoom', icon: '🔍', shortcut: 'Z' },

  // Basic Shapes
  { id: 'rect', name: 'Rectangle', icon: '□', shortcut: 'R' },
  { id: 'ellipse', name: 'Ellipse', icon: '○', shortcut: 'E' },
  { id: 'polygon', name: 'Polygon', icon: '⬡', shortcut: 'P' },
  { id: 'star', name: 'Star', icon: '☆', shortcut: 'S' },
  { id: 'spiral', name: 'Spiral', icon: '🌀', shortcut: '' },
  { id: 'arrow', name: 'Arrow', icon: '➤', shortcut: 'A' },
  { id: 'chaos', name: 'Chaos', icon: '❋', shortcut: '' },

  // Power Shapes
  { id: 'powerRect', name: 'Power Rect', icon: '▣', shortcut: '' },
  { id: 'powerCircle', name: 'Power Circle', icon: '◉', shortcut: '' },
  { id: 'powerStar', name: 'Power Star', icon: '★', shortcut: '' },
  { id: 'powerPolygon', name: 'Power Poly', icon: '⬠', shortcut: '' },

  // Curve Tools
  { id: 'line', name: 'Line', icon: '/', shortcut: 'L' },
  { id: 'curve', name: 'Curve', icon: '∿', shortcut: 'C' },
  { id: 'freehand', name: 'Freehand', icon: '✎', shortcut: 'F' },
  { id: 'pen', name: 'Pen', icon: '✒', shortcut: '' },
  { id: 'knife', name: 'Knife', icon: '🔪', shortcut: 'K' },

  // Text Tools
  { id: 'text', name: 'Text', icon: 'T', shortcut: 'T' },
  { id: 'textArc', name: 'Text Arc', icon: '◠', shortcut: '' },
  { id: 'textPath', name: 'Text Path', icon: '∿T', shortcut: '' },
  { id: 'textVert', name: 'Vertical T', icon: '↕T', shortcut: '' },
  { id: 'textBox', name: 'Text Box', icon: '▭', shortcut: '' },
  { id: 'paragraph', name: 'Paragraph', icon: '¶', shortcut: '' },

  // Image & Trace
  { id: 'image', name: 'Image', icon: '🖼', shortcut: 'I' },
  { id: 'trace', name: 'Vectorize', icon: '◎', shortcut: '' },

  // Clone Tools
  { id: 'clone', name: 'Clone', icon: '⧉', shortcut: '' },
  { id: 'cloneArray', name: 'Mtx Array', icon: '▦', shortcut: '' },
  { id: 'cloneCircle', name: 'Circle Arr', icon: '◎', shortcut: '' },

  // Dimension & Measure
  { id: 'dimension', name: 'Dimension', icon: '↔', shortcut: 'D' },

  // Warp Tools
  { id: 'warpCircle', name: 'Warp Circle', icon: '◯', shortcut: '' },
  { id: 'warpFlag', name: 'Warp Flag', icon: '⚑', shortcut: '' },
  { id: 'warpWave', name: 'Warp Wave', icon: '〰', shortcut: '' },

  // Effects
  { id: 'outline', name: 'Outline', icon: '○', shortcut: '' },
  { id: 'shadow', name: 'Shadow', icon: '◐', shortcut: '' },
  { id: 'glow', name: 'Glow', icon: '✦', shortcut: '' },
  { id: '3d', name: '3D', icon: '🧊', shortcut: '' },

  // Fill & Paint
  { id: 'fill', name: 'Fill', icon: '🎨', shortcut: 'G' },
  { id: 'eraser', name: 'Eraser', icon: '◻', shortcut: '' },

  // Contour & Cut
  { id: 'contour', name: 'Contour', icon: '✂', shortcut: '' },
]

function AppContent() {
  const [dialog, setDialog] = useState(null)
  const [toast, setToast] = useState(null)
  const { state, dispatch, actions } = useApp()
  const canvasRef = useRef(null)

  const handleNewDocument = useCallback(() => {
    dispatch({ type: 'NEW_DOCUMENT' })
    setDialog(null)
  }, [dispatch])

  const handleOpenFile = useCallback(() => {
    actions.openImportPicker()
  }, [actions])

  const handleSave = useCallback(() => actions.saveDocument(), [actions])
  const handleExport = useCallback(() => setDialog({ type: 'export' }), [])
  const handlePrint = useCallback(() => { printDocument() }, [])
  const handleCut = useCallback(() => dispatch({ type: 'CUT_SELECTED' }), [dispatch])
  const handleCopy = useCallback(() => dispatch({ type: 'COPY_SELECTED' }), [dispatch])
  const handlePaste = useCallback(() => dispatch({ type: 'PASTE' }), [dispatch])
  const handleDelete = useCallback(() => dispatch({ type: 'DELETE_SELECTED' }), [dispatch])
  const handleDuplicate = useCallback(() => dispatch({ type: 'DUPLICATE_SELECTED' }), [dispatch])
  const handleSelectAll = useCallback(() => dispatch({ type: 'SELECT_ALL' }), [dispatch])
  const handleUndo = useCallback(() => dispatch({ type: 'UNDO' }), [dispatch])
  const handleRedo = useCallback(() => dispatch({ type: 'REDO' }), [dispatch])
  const handleZoomIn = useCallback(() => dispatch({ type: 'ZOOM_IN' }), [dispatch])
  const handleZoomOut = useCallback(() => dispatch({ type: 'ZOOM_OUT' }), [dispatch])
  const handleZoomToAll = useCallback(() => dispatch({ type: 'ZOOM_TO_ALL' }), [dispatch])
  const handleZoomToPage = useCallback(() => dispatch({ type: 'ZOOM_TO_PAGE' }), [dispatch])
  const handleAlign = useCallback((direction) => dispatch({ type: 'ALIGN', payload: { direction } }), [dispatch])
  const handleGroup = useCallback(() => dispatch({ type: 'GROUP' }), [dispatch])
  const handleUngroup = useCallback(() => dispatch({ type: 'UNGROUP' }), [dispatch])
  const handleBringToFront = useCallback(() => dispatch({ type: 'BRING_TO_FRONT' }), [dispatch])
  const handleSendToBack = useCallback(() => dispatch({ type: 'SEND_TO_BACK' }), [dispatch])
  const handleBringForward = useCallback(() => dispatch({ type: 'BRING_FORWARD' }), [dispatch])
  const handleSendBackward = useCallback(() => dispatch({ type: 'SEND_BACKWARD' }), [dispatch])
  const handleMirrorX = useCallback(() => dispatch({ type: 'MIRROR_X' }), [dispatch])
  const handleMirrorY = useCallback(() => dispatch({ type: 'MIRROR_Y' }), [dispatch])
  const handleRotate = useCallback((degrees) => dispatch({ type: 'ROTATE', payload: { degrees } }), [dispatch])
  const handleToolChange = useCallback((toolId) => dispatch({ type: 'SET_TOOL', payload: { toolId } }), [dispatch])
  const handlePropertyChange = useCallback((property, value) => dispatch({ type: 'UPDATE_PROPERTY', payload: { property, value } }), [dispatch])

  React.useEffect(() => {
    const handler = (e) => setDialog({ type: e.detail })
    window.addEventListener('openDialog', handler)
    return () => window.removeEventListener('openDialog', handler)
  }, [])

  React.useEffect(() => {
    const handler = (e) => {
      const detail = (e && e.detail) || {}
      setToast({ message: detail.message || '', kind: detail.kind || 'info', id: Date.now() })
    }
    window.addEventListener('vcs-notify', handler)
    return () => window.removeEventListener('vcs-notify', handler)
  }, [])

  React.useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), 4200)
    return () => clearTimeout(t)
  }, [toast])

  // Bounding-box size of the current selection, shown in the status bar.
  const selectionSize = React.useMemo(() => {
    const selected = state.objects.filter(o => state.selectedObjects.includes(o.id))
    if (!selected.length) return null
    const minX = Math.min(...selected.map(o => o.x || 0))
    const minY = Math.min(...selected.map(o => o.y || 0))
    const maxX = Math.max(...selected.map(o => (o.x || 0) + (o.width || 0)))
    const maxY = Math.max(...selected.map(o => (o.y || 0) + (o.height || 0)))
    return { width: maxX - minX, height: maxY - minY }
  }, [state.objects, state.selectedObjects])

  return (
    <div className="app-container">
      <KeyboardShortcuts />
      <MenuBar
        onNew={handleNewDocument}
        onOpen={handleOpenFile}
        onSave={handleSave}
        onExport={handleExport}
        onPrint={handlePrint}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onCut={handleCut}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onDelete={handleDelete}
        onSelectAll={handleSelectAll}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomToAll={handleZoomToAll}
        onZoomToPage={handleZoomToPage}
      />
      <TabBar
        activeTab={state.activeTab}
        onTabChange={(tab) => dispatch({ type: 'SET_TAB', payload: { tab } })}
      />
      <Toolbar
        tools={tools}
        activeTool={state.activeTool}
        onToolChange={handleToolChange}
        activeTab={state.activeTab}
      />
      <div className="main-workspace">
        <Canvas ref={canvasRef} />
        <PropertyPanel
          selectedObject={state.selectedObject}
          onPropertyChange={handlePropertyChange}
        />
      </div>
      <StatusBar
        zoom={state.zoom}
        cursorPos={state.cursorPos}
        objectCount={state.objects.length}
        selectedCount={state.selectedObjects.length}
        selectionSize={selectionSize}
        pageCount={state.pages.length}
        activePage={state.activePage}
        tool={state.activeTool}
      />
      {dialog?.type === 'spooler' && <VinylSpooler onClose={() => setDialog(null)} />}
      {dialog?.type === 'contour' && <ContourCutWizard onClose={() => setDialog(null)} />}
      {dialog?.type === 'align' && <AlignmentDialog onClose={() => setDialog(null)} />}
      {dialog?.type === 'gradient' && <GradientEditor onClose={() => setDialog(null)} onApply={(g) => { dispatch({ type: 'SET_FILL', payload: { type: 'gradient', stops: g.stops, angle: g.angle == null ? 90 : g.angle } }); setDialog(null) }} />}
      {dialog?.type === 'texture' && <TextureLibrary onClose={() => setDialog(null)} onSelect={(t) => { dispatch({ type: 'SET_FILL', payload: { type: 'texture', color: t.color, pattern: t.pattern, size: t.size || 8, lineColor: t.lineColor || '#666666' } }); setDialog(null) }} />}
      {dialog?.type === 'stepRepeat' && <StepRepeatDialog onClose={() => setDialog(null)} onApply={() => dispatch({ type: 'APPLY_STEP_REPEAT' })} />}
      {dialog?.type === 'shapeOps' && <ShapeOperations onClose={() => setDialog(null)} />}
      {dialog?.type === 'masterPages' && <MasterPages onClose={() => setDialog(null)} />}
      {dialog?.type === 'export' && <ExportDialog onClose={() => setDialog(null)} />}
      {dialog?.type === 'fontManager' && <FontManager onClose={() => setDialog(null)} />}
      {dialog?.type === 'colorLibrary' && <ColorLibrary onClose={() => setDialog(null)} onSelect={(color) => { dispatch({ type: 'SET_FILL', payload: { type: 'solid', color } }); setDialog(null) }} />}
      {dialog?.type === 'vectorize' && <VectorizeDialog selectedObject={state.selectedObject} onClose={() => setDialog(null)} />}
      {toast && (
        <div className={`vcs-toast vcs-toast-${toast.kind}`} onClick={() => setToast(null)}>
          {toast.message}
        </div>
      )}
      {dialog && !['spooler', 'contour', 'align', 'gradient', 'texture', 'stepRepeat', 'shapeOps', 'masterPages', 'export', 'fontManager', 'colorLibrary', 'vectorize'].includes(dialog.type) && (
        <Dialog
          type={dialog.type}
          title={dialog.title}
          message={dialog.message}
          onConfirm={dialog.onConfirm}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  )
}

export { tools as TOOLS }
export const TOOLS_LIST = tools

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
