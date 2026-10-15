import { useEffect } from 'react'
import { useApp } from '../context/AppContext'

export default function KeyboardShortcuts() {
  const { state, dispatch, actions } = useApp()

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return

      const key = e.key.toLowerCase()
      const ctrl = e.ctrlKey
      const shift = e.shiftKey
      const alt = e.altKey

      // File operations
      if (ctrl && key === 'n') { e.preventDefault(); actions.newDocument() }
      if (ctrl && key === 'o') { e.preventDefault(); /* open file */ }
      if (ctrl && key === 's') { e.preventDefault(); actions.saveDocument() }
      if (ctrl && key === 'p') { e.preventDefault(); window.print() }
      if (ctrl && key === 'i') { e.preventDefault(); /* import */ }
      if (ctrl && key === 'e') { e.preventDefault(); actions.exportDocument() }

      // Edit operations
      if (ctrl && key === 'z') { e.preventDefault(); actions.undo() }
      if (ctrl && key === 'y') { e.preventDefault(); actions.redo() }
      if (ctrl && key === 'x') { e.preventDefault(); actions.cutSelected() }
      if (ctrl && key === 'c') { e.preventDefault(); actions.copySelected() }
      if (ctrl && key === 'v') { e.preventDefault(); actions.paste() }
      if (ctrl && key === 'a') { e.preventDefault(); actions.selectAll() }
      if (ctrl && key === 'd') { e.preventDefault(); actions.duplicateSelected() }
      if (ctrl && key === 'g') { e.preventDefault(); actions.group() }
      if (ctrl && key === 'u') { e.preventDefault(); actions.ungroup() }
      if (ctrl && key === 'q') { e.preventDefault(); /* convert to curves */ }
      if (ctrl && key === 'l') { e.preventDefault(); /* lock object */ }
      if (ctrl && key === 'w') { e.preventDefault(); /* wireframe */ }

      // View
      if (key === 'f3') { e.preventDefault(); actions.zoomIn() }
      if (key === 'f4') { e.preventDefault(); actions.zoomOut() }
      if (key === 'f5') { e.preventDefault(); actions.zoomToAll() }
      if (key === 'f6') { e.preventDefault(); actions.zoomToPage() }
      if (key === 'f1') { e.preventDefault(); /* help */ }
      if (key === 'f2') { e.preventDefault(); /* user settings */ }

      // Snap
      if (shift && alt && key === 'g') { e.preventDefault(); actions.toggleSnapGrid() }
      if (shift && alt && key === 'l') { e.preventDefault(); actions.toggleSnapGuides() }
      if (shift && alt && key === 'o') { e.preventDefault(); actions.toggleSnapObjects() }
      if (shift && alt && key === 'p') { e.preventDefault(); actions.toggleSnapPage() }
      if (shift && alt && key === 'a') { e.preventDefault(); /* all snap */ }

      // Display
      if (shift && ctrl && key === 'g') { e.preventDefault(); actions.toggleGrid() }
      if (shift && ctrl && key === 's') { e.preventDefault(); actions.toggleGuides() }
      if (shift && ctrl && key === 'r') { e.preventDefault(); actions.toggleRulers() }
      if (shift && ctrl && key === 'b') { e.preventDefault(); /* page border */ }
      if (shift && ctrl && key === 'd') { e.preventDefault(); /* page bg */ }
      if (shift && ctrl && key === 'p') { e.preventDefault(); /* page setup */ }
      if (shift && ctrl && key === 'o') { e.preventDefault(); actions.setPageOrientation() }
      if (shift && ctrl && key === 't') { e.preventDefault(); /* dimensions */ }

      // Align
      if (key === 'l' && !ctrl && !shift && !alt) { e.preventDefault(); actions.align('left') }
      if (key === 'r' && !ctrl && !shift && !alt) { e.preventDefault(); actions.align('right') }
      if (key === 't' && !ctrl && !shift && !alt) { e.preventDefault(); actions.align('top') }
      if (key === 'b' && !ctrl && !shift && !alt) { e.preventDefault(); actions.align('bottom') }
      if (key === 'e' && !ctrl && !shift && !alt) { e.preventDefault(); actions.align('centerH') }
      if (key === 'c' && !ctrl && !shift && !alt) { e.preventDefault(); actions.align('centerV') }

      // Z-order
      if (shift && e.key === 'PageUp') { e.preventDefault(); actions.bringToFront() }
      if (shift && e.key === 'PageDown') { e.preventDefault(); actions.sendToBack() }
      if (ctrl && e.key === 'PageUp') { e.preventDefault(); actions.bringForward() }
      if (ctrl && e.key === 'PageDown') { e.preventDefault(); actions.sendBackward() }

      // Rotate
      if (ctrl && key === 'r') { e.preventDefault(); actions.rotate(90) }

      // Mirror
      if (shift && ctrl && key === 'h') { e.preventDefault(); actions.mirrorX() }
      if (shift && ctrl && key === 'v') { e.preventDefault(); actions.mirrorY() }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); actions.deleteSelected() }

      // Select by
      if (key === 's' && !ctrl && !shift && !alt) { e.preventDefault(); /* select by color */ }
      if (key === 'o' && !ctrl && !shift && !alt) { e.preventDefault(); /* select by type */ }

      // Combine/Break
      if (key === 'y' && !ctrl && !shift && !alt) { e.preventDefault(); actions.applyWeld() }
      if (key === 'z' && !ctrl && !shift && !alt) { e.preventDefault(); /* break apart */ }

      // Node edit
      if (key === 'w' && !ctrl && !shift && !alt) { e.preventDefault(); /* break node */ }
      if (key === 'm' && !ctrl && !shift && !alt) { e.preventDefault(); /* smooth curve */ }

      // Fill
      if (ctrl && key === 'F1') { e.preventDefault(); /* solid fill */ }

      // Spooler
      if (shift && alt && key === 'v') { e.preventDefault(); /* vinyl spooler */ }
      if (shift && alt && key === 'f') { e.preventDefault(); /* contour cut */ }

      // Tutorials
      if (ctrl && key === 't') { e.preventDefault(); /* tutorials */ }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [actions, dispatch, state])

  return null
}
