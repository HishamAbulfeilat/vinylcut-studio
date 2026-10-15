import React, { useState, useCallback, useRef } from 'react'
import MenuBar from './components/MenuBar'
import Toolbar from './components/Toolbar'
import Canvas from './components/Canvas'
import PropertyPanel from './components/PropertyPanel'
import StatusBar from './components/StatusBar'
import TabBar from './components/TabBar'
import Dialog from './components/Dialog'
import { AppProvider, useApp } from './context/AppContext'
import './App.css'

const tools = [
  { id: 'select', name: 'Select', icon: '⬚', shortcut: 'V' },
  { id: 'node', name: 'Node Edit', icon: '◇', shortcut: 'N' },
  { id: 'pan', name: 'Pan', icon: '✋', shortcut: 'H' },
  { id: 'zoom', name: 'Zoom', icon: '🔍', shortcut: 'Z' },
  { id: 'rect', name: 'Rectangle', icon: '□', shortcut: 'R' },
  { id: 'ellipse', name: 'Ellipse', icon: '○', shortcut: 'E' },
  { id: 'polygon', name: 'Polygon', icon: '⬡', shortcut: 'P' },
  { id: 'star', name: 'Star', icon: '☆', shortcut: 'S' },
  { id: 'spiral', name: 'Spiral', icon: '🌀', shortcut: '' },
  { id: 'arrow', name: 'Arrow', icon: '➤', shortcut: 'A' },
  { id: 'line', name: 'Line', icon: '/', shortcut: 'L' },
  { id: 'curve', name: 'Curve', icon: '∿', shortcut: 'C' },
  { id: 'freehand', name: 'Freehand', icon: '✎', shortcut: 'F' },
  { id: 'pen', name: 'Pen', icon: '✒', shortcut: '' },
  { id: 'text', name: 'Text', icon: 'T', shortcut: 'T' },
  { id: 'textArc', name: 'Text on Arc', icon: '◠', shortcut: '' },
  { id: 'textPath', name: 'Text on Path', icon: '∿T', shortcut: '' },
  { id: 'textVert', name: 'Vertical Text', icon: '↕T', shortcut: '' },
  { id: 'textBox', name: 'Text Box', icon: '▭', shortcut: '' },
  { id: 'image', name: 'Image', icon: '🖼', shortcut: 'I' },
  { id: 'trace', name: 'Vectorize', icon: '◎', shortcut: '' },
  { id: 'clone', name: 'Clone', icon: '⧉', shortcut: '' },
  { id: 'cloneArray', name: 'Clone Array', icon: '▦', shortcut: '' },
  { id: 'cloneCircle', name: 'Circle Array', icon: '◎', shortcut: '' },
  { id: 'dimension', name: 'Dimension', icon: '↔', shortcut: 'D' },
  { id: 'knife', name: 'Knife', icon: '🔪', shortcut: 'K' },
  { id: 'eraser', name: 'Eraser', icon: '◻', shortcut: '' },
  { id: 'fill', name: 'Fill', icon: '🎨', shortcut: 'G' },
  { id: 'outline', name: 'Outline', icon: '○', shortcut: '' },
  { id: 'shadow', name: 'Shadow', icon: '◐', shortcut: '' },
  { id: 'effects', name: 'Effects', icon: '✨', shortcut: '' },
  { id: 'warp', name: 'Warp', icon: '〰', shortcut: '' },
  { id: '3d', name: '3D', icon: '🧊', shortcut: '' },
  { id: 'contour', name: 'Contour Cut', icon: '✂', shortcut: '' },
]

function AppContent() {
  const [dialog, setDialog] = useState(null)
  const { state, dispatch } = useApp()
  const canvasRef = useRef(null)

  const handleNewDocument = useCallback(() => {
    dispatch({ type: 'NEW_DOCUMENT' })
    setDialog(null)
  }, [dispatch])

  const handleOpenFile = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.svg,.png,.jpg,.jpeg,.bmp,.pdf,.ai,.eps,.dxf,.plt,.hpgl'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (file) {
        dispatch({ type: 'LOAD_FILE', payload: { file } })
      }
    }
    input.click()
  }, [dispatch])

  const handleSave = useCallback(() => {
    dispatch({ type: 'SAVE_DOCUMENT' })
  }, [dispatch])

  const handleExport = useCallback(() => {
    dispatch({ type: 'EXPORT_DOCUMENT' })
  }, [dispatch])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const handleCut = useCallback(() => {
    dispatch({ type: 'CUT_SELECTED' })
  }, [dispatch])

  const handleCopy = useCallback(() => {
    dispatch({ type: 'COPY_SELECTED' })
  }, [dispatch])

  const handlePaste = useCallback(() => {
    dispatch({ type: 'PASTE' })
  }, [dispatch])

  const handleDelete = useCallback(() => {
    dispatch({ type: 'DELETE_SELECTED' })
  }, [dispatch])

  const handleDuplicate = useCallback(() => {
    dispatch({ type: 'DUPLICATE_SELECTED' })
  }, [dispatch])

  const handleSelectAll = useCallback(() => {
    dispatch({ type: 'SELECT_ALL' })
  }, [dispatch])

  const handleUndo = useCallback(() => {
    dispatch({ type: 'UNDO' })
  }, [dispatch])

  const handleRedo = useCallback(() => {
    dispatch({ type: 'REDO' })
  }, [dispatch])

  const handleZoomIn = useCallback(() => {
    dispatch({ type: 'ZOOM_IN' })
  }, [dispatch])

  const handleZoomOut = useCallback(() => {
    dispatch({ type: 'ZOOM_OUT' })
  }, [dispatch])

  const handleZoomToAll = useCallback(() => {
    dispatch({ type: 'ZOOM_TO_ALL' })
  }, [dispatch])

  const handleZoomToPage = useCallback(() => {
    dispatch({ type: 'ZOOM_TO_PAGE' })
  }, [dispatch])

  const handleAlign = useCallback((direction) => {
    dispatch({ type: 'ALIGN', payload: { direction } })
  }, [dispatch])

  const handleGroup = useCallback(() => {
    dispatch({ type: 'GROUP' })
  }, [dispatch])

  const handleUngroup = useCallback(() => {
    dispatch({ type: 'UNGROUP' })
  }, [dispatch])

  const handleBringToFront = useCallback(() => {
    dispatch({ type: 'BRING_TO_FRONT' })
  }, [dispatch])

  const handleSendToBack = useCallback(() => {
    dispatch({ type: 'SEND_TO_BACK' })
  }, [dispatch])

  const handleBringForward = useCallback(() => {
    dispatch({ type: 'BRING_FORWARD' })
  }, [dispatch])

  const handleSendBackward = useCallback(() => {
    dispatch({ type: 'SEND_BACKWARD' })
  }, [dispatch])

  const handleMirrorX = useCallback(() => {
    dispatch({ type: 'MIRROR_X' })
  }, [dispatch])

  const handleMirrorY = useCallback(() => {
    dispatch({ type: 'MIRROR_Y' })
  }, [dispatch])

  const handleRotate = useCallback((degrees) => {
    dispatch({ type: 'ROTATE', payload: { degrees } })
  }, [dispatch])

  const handleToolChange = useCallback((toolId) => {
    dispatch({ type: 'SET_TOOL', payload: { toolId } })
  }, [dispatch])

  const handlePropertyChange = useCallback((property, value) => {
    dispatch({ type: 'UPDATE_PROPERTY', payload: { property, value } })
  }, [dispatch])

  const handleCanvasClick = useCallback((e) => {
    if (canvasRef.current) {
      canvasRef.current.handleCanvasClick(e)
    }
  }, [])

  return (
    <div className="app-container">
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
        pageCount={state.pages.length}
        activePage={state.activePage}
        tool={state.activeTool}
      />
      {dialog && (
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

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
