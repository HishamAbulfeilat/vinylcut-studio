import { useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { printDocument } from '../platform'

export default function KeyboardShortcuts() {
  const { state, dispatch, actions } = useApp()

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return

      const key = e.key.toLowerCase()
      const ctrl = e.ctrlKey
      const shift = e.shiftKey
      const alt = e.altKey

      // === FILE OPERATIONS ===
      if (ctrl && key === 'n') { e.preventDefault(); actions.newDocument() }
      if (ctrl && key === 'o') { e.preventDefault(); actions.loadFile() }
      if (ctrl && key === 's') { e.preventDefault(); actions.saveDocument() }
      if (ctrl && shift && key === 's') { e.preventDefault(); actions.saveDocument() }
      if (ctrl && key === 'p') { e.preventDefault(); printDocument() }
      if (ctrl && key === 'i') { e.preventDefault(); actions.loadFile() }
      if (ctrl && key === 'e') { e.preventDefault(); actions.exportDocument() }

      // === EDIT OPERATIONS ===
      if (ctrl && key === 'z') { e.preventDefault(); actions.undo() }
      if (ctrl && key === 'y') { e.preventDefault(); actions.redo() }
      if (ctrl && key === 'x') { e.preventDefault(); actions.cutSelected() }
      if (ctrl && key === 'c') { e.preventDefault(); actions.copySelected() }
      if (ctrl && key === 'v') { e.preventDefault(); actions.paste() }
      if (ctrl && key === 'a') { e.preventDefault(); actions.selectAll() }
      if (ctrl && key === 'd') { e.preventDefault(); actions.duplicateSelected() }
      if (ctrl && key === 'g') { e.preventDefault(); actions.group() }
      if (ctrl && key === 'u') { e.preventDefault(); actions.ungroup() }
      if (ctrl && shift && key === 'u') { e.preventDefault(); actions.ungroup() }
      if (ctrl && key === 'q') { e.preventDefault(); actions.applyWeld() }
      if (ctrl && key === 'l') { e.preventDefault(); /* lock */ }
      if (ctrl && key === 'w') { e.preventDefault(); /* wireframe */ }
      if (ctrl && key === 'j') { e.preventDefault(); actions.applyWeld() }

      // === VIEW ===
      if (key === 'f3') { e.preventDefault(); actions.zoomIn() }
      if (key === 'f4') { e.preventDefault(); actions.zoomOut() }
      if (key === 'f5') { e.preventDefault(); actions.zoomToAll() }
      if (key === 'f6') { e.preventDefault(); actions.zoomToPage() }
      if (key === 'f7') { e.preventDefault(); /* zoom to page width */ }
      if (key === 'f8') { e.preventDefault(); /* zoom to page height */ }
      if (key === 'f1') { e.preventDefault(); /* help */ }
      if (key === 'f2') { e.preventDefault(); /* user settings */ }
      if (key === 'f9') { e.preventDefault(); /* preview */ }
      if (key === 'f10') { e.preventDefault(); /* spooler */ }
      if (key === 'f11') { e.preventDefault(); /* contour cut */ }
      if (key === 'f12') { e.preventDefault(); /* preferences */ }

      // === SNAP ===
      if (shift && alt && key === 'g') { e.preventDefault(); actions.toggleSnapGrid() }
      if (shift && alt && key === 'l') { e.preventDefault(); actions.toggleSnapGuides() }
      if (shift && alt && key === 'o') { e.preventDefault(); actions.toggleSnapObjects() }
      if (shift && alt && key === 'p') { e.preventDefault(); actions.toggleSnapPage() }
      if (shift && alt && key === 'a') { e.preventDefault(); actions.toggleSnapGrid(); actions.toggleSnapGuides(); actions.toggleSnapObjects() }

      // === DISPLAY ===
      if (shift && ctrl && key === 'g') { e.preventDefault(); actions.toggleGrid() }
      if (shift && ctrl && key === 's') { e.preventDefault(); actions.toggleGuides() }
      if (shift && ctrl && key === 'r') { e.preventDefault(); actions.toggleRulers() }
      if (shift && ctrl && key === 'b') { e.preventDefault(); /* page border */ }
      if (shift && ctrl && key === 'd') { e.preventDefault(); /* page bg */ }
      if (shift && ctrl && key === 'p') { e.preventDefault(); /* page setup */ }
      if (shift && ctrl && key === 'o') { e.preventDefault(); actions.setPageOrientation() }
      if (shift && ctrl && key === 't') { e.preventDefault(); /* dimensions */ }

      // === ALIGN ===
      if (key === 'l' && !ctrl && !shift && !alt) { e.preventDefault(); actions.align('left') }
      if (key === 'r' && !ctrl && !shift && !alt) { e.preventDefault(); actions.align('right') }
      if (key === 't' && !ctrl && !shift && !alt) { e.preventDefault(); actions.align('top') }
      if (key === 'b' && !ctrl && !shift && !alt) { e.preventDefault(); actions.align('bottom') }
      if (key === 'e' && !ctrl && !shift && !alt) { e.preventDefault(); actions.align('centerH') }
      if (key === 'c' && !ctrl && !shift && !alt) { e.preventDefault(); actions.align('centerV') }
      if (key === 'p' && !ctrl && !shift && !alt) { e.preventDefault(); /* align to page center */ }

      // === Z-ORDER ===
      if (shift && e.key === 'PageUp') { e.preventDefault(); actions.bringToFront() }
      if (shift && e.key === 'PageDown') { e.preventDefault(); actions.sendToBack() }
      if (ctrl && e.key === 'PageUp') { e.preventDefault(); actions.bringForward() }
      if (ctrl && e.key === 'PageDown') { e.preventDefault(); actions.sendBackward() }

      // === ROTATE ===
      if (ctrl && key === 'r') { e.preventDefault(); actions.rotate(90) }

      // === MIRROR ===
      if (shift && ctrl && key === 'h') { e.preventDefault(); actions.mirrorX() }
      if (shift && ctrl && key === 'v') { e.preventDefault(); actions.mirrorY() }

      // === DELETE ===
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); actions.deleteSelected() }

      // === SELECT BY ===
      if (key === 's' && !ctrl && !shift && !alt) { e.preventDefault(); /* select by color */ }
      if (key === 'o' && !ctrl && !shift && !alt) { e.preventDefault(); /* select by type */ }

      // === SHAPE OPERATIONS ===
      if (key === 'y' && !ctrl && !shift && !alt) { e.preventDefault(); actions.applyWeld() }
      if (key === 'z' && !ctrl && !shift && !alt) { e.preventDefault(); /* break apart */ }

      // === NODE EDIT ===
      if (key === 'w' && !ctrl && !shift && !alt) { e.preventDefault(); /* break node */ }
      if (key === 'm' && !ctrl && !shift && !alt) { e.preventDefault(); /* smooth curve */ }

      // === FILL ===
      if (ctrl && e.key === 'F1') { e.preventDefault(); actions.setFill({ type: 'solid' }) }
      if (ctrl && e.key === 'F2') { e.preventDefault(); actions.setFill({ type: 'gradient' }) }
      if (ctrl && e.key === 'F3') { e.preventDefault(); actions.setFill({ type: 'texture' }) }
      if (ctrl && e.key === 'F4') { e.preventDefault(); actions.setFill({ type: 'none' }) }

      // === SPOOLER ===
      if (shift && alt && key === 'v') { e.preventDefault(); /* vinyl spooler */ }
      if (shift && alt && key === 'f') { e.preventDefault(); /* contour cut */ }
      if (alt && key === 'p') { e.preventDefault(); /* auto cut */ }

      // === TUTORIALS ===
      if (ctrl && key === 't') { e.preventDefault(); /* tutorials */ }

      // === GUIDES ===
      if (ctrl && key === '4') { e.preventDefault(); /* guide left */ }
      if (ctrl && key === '6') { e.preventDefault(); /* guide right */ }
      if (ctrl && key === '8') { e.preventDefault(); /* guide top */ }
      if (ctrl && key === '2') { e.preventDefault(); /* guide bottom */ }
      if (ctrl && key === '5') { e.preventDefault(); /* guide center h */ }
      if (ctrl && key === '0') { e.preventDefault(); /* guide center v */ }

      // === REGISTRATION MARKS ===
      if (ctrl && key === '3') { e.preventDefault(); /* add registration marks */ }

      // === NUMBER PAD ===
      if (e.key === '+' || e.key === '=') { if (!ctrl && !shift) { e.preventDefault(); actions.duplicateSelected() } }
      if (e.key === '-') { if (!ctrl && !shift) { e.preventDefault(); actions.deleteSelected() } }

      // === ESC ===
      if (e.key === 'Escape') { dispatch({ type: 'UPDATE_PROPERTY', payload: { property: 'selectedObject', value: null } }) }

      // === ENTER ===
      if (e.key === 'Enter' && state.selectedObject) { /* edit text */ }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [actions, dispatch, state])

  return null
}
