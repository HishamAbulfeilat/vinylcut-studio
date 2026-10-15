import React, { createContext, useContext, useReducer, useCallback } from 'react'

const AppContext = createContext()

const initialState = {
  // Document state
  documentName: 'Untitled-1',
  pages: [{ id: 1, name: 'Page 1', width: 210, height: 297, objects: [] }],
  activePage: 0,
  activeTab: 'design',

  // Tool state
  activeTool: 'select',

  // Selection state
  selectedObjects: [],
  selectedObject: null,

  // Canvas state
  zoom: 1,
  panX: 0,
  panY: 0,
  showGrid: false,
  showGuides: false,
  showRulers: true,
  snapToGrid: false,
  snapToGuides: false,
  snapToObjects: false,
  gridSize: 10,

  // History state
  history: [],
  historyIndex: -1,

  // UI state
  cursorPos: { x: 0, y: 0 },
  isModified: false,
  clipboard: null,

  // Object state
  objects: [],

  // Fill state
  currentFill: { type: 'solid', color: '#ff8000', opacity: 100 },
  currentStroke: { color: '#000000', width: 1 },
}

function generateId() {
  return Math.random().toString(36).substr(2, 9)
}

function appReducer(state, action) {
  switch (action.type) {
    case 'NEW_DOCUMENT':
      return {
        ...state,
        documentName: 'Untitled-1',
        pages: [{ id: 1, name: 'Page 1', width: 210, height: 297, objects: [] }],
        activePage: 0,
        objects: [],
        selectedObjects: [],
        selectedObject: null,
        zoom: 1,
        history: [],
        historyIndex: -1,
        isModified: false,
      }

    case 'LOAD_FILE':
      return { ...state, documentName: action.payload.file.name, isModified: false }

    case 'SAVE_DOCUMENT':
      return { ...state, isModified: false }

    case 'EXPORT_DOCUMENT':
      return { ...state }

    case 'SET_TOOL':
      return { ...state, activeTool: action.payload.toolId }

    case 'SET_TAB':
      return { ...state, activeTab: action.payload.tab }

    case 'SELECT_ALL':
      return {
        ...state,
        selectedObjects: state.objects.map(o => o.id),
        selectedObject: state.objects.length === 1 ? state.objects[0] : null,
      }

    case 'DELETE_SELECTED': {
      const newObjects = state.objects.filter(o => !state.selectedObjects.includes(o.id))
      return {
        ...state,
        objects: newObjects,
        selectedObjects: [],
        selectedObject: null,
      }
    }

    case 'DUPLICATE_SELECTED': {
      const newObjects = state.selectedObjects
        .map(id => state.objects.find(o => o.id === id))
        .filter(Boolean)
        .map(o => ({
          ...o,
          id: generateId(),
          x: (o.x || 0) + 10,
          y: (o.y || 0) + 10,
        }))
      return {
        ...state,
        objects: [...state.objects, ...newObjects],
        selectedObjects: newObjects.map(o => o.id),
        selectedObject: newObjects.length === 1 ? newObjects[0] : null,
      }
    }

    case 'COPY_SELECTED':
      return {
        ...state,
        clipboard: state.selectedObjects
          .map(id => state.objects.find(o => o.id === id))
          .filter(Boolean),
      }

    case 'CUT_SELECTED': {
      const cutObjects = state.selectedObjects
        .map(id => state.objects.find(o => o.id === id))
        .filter(Boolean)
      const newObjects = state.objects.filter(o => !state.selectedObjects.includes(o.id))
      return {
        ...state,
        objects: newObjects,
        selectedObjects: [],
        selectedObject: null,
        clipboard: cutObjects,
      }
    }

    case 'PASTE': {
      if (!state.clipboard || state.clipboard.length === 0) return state
      const pasted = state.clipboard.map(o => ({
        ...o,
        id: generateId(),
        x: (o.x || 0) + 10,
        y: (o.y || 0) + 10,
      }))
      return {
        ...state,
        objects: [...state.objects, ...pasted],
        selectedObjects: pasted.map(o => o.id),
        selectedObject: pasted.length === 1 ? pasted[0] : null,
      }
    }

    case 'UNDO': {
      if (state.historyIndex < 0) return state
      const newIndex = state.historyIndex - 1
      const snapshot = newIndex >= 0 ? state.history[newIndex] : { objects: [], pages: state.pages }
      return {
        ...state,
        objects: snapshot.objects,
        pages: snapshot.pages,
        selectedObjects: [],
        selectedObject: null,
        historyIndex: newIndex,
      }
    }

    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) return state
      const newIndex = state.historyIndex + 1
      const snapshot = state.history[newIndex]
      return {
        ...state,
        objects: snapshot.objects,
        pages: snapshot.pages,
        selectedObjects: [],
        selectedObject: null,
        historyIndex: newIndex,
      }
    }

    case 'ZOOM_IN':
      return { ...state, zoom: Math.min(state.zoom * 1.2, 10) }

    case 'ZOOM_OUT':
      return { ...state, zoom: Math.max(state.zoom / 1.2, 0.1) }

    case 'ZOOM_TO_ALL': {
      if (state.objects.length === 0) return { ...state, zoom: 1 }
      const padding = 50
      const canvas = document.getElementById('main-canvas')
      if (!canvas) return { ...state, zoom: 1 }
      const bounds = state.objects.reduce(
        (acc, obj) => ({
          minX: Math.min(acc.minX, obj.x || 0),
          minY: Math.min(acc.minY, obj.y || 0),
          maxX: Math.max(acc.maxX, (obj.x || 0) + (obj.width || 0)),
          maxY: Math.max(acc.maxY, (obj.y || 0) + (obj.height || 0)),
        }),
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
      )
      const contentWidth = bounds.maxX - bounds.minX + padding * 2
      const contentHeight = bounds.maxY - bounds.minY + padding * 2
      const canvasRect = canvas.getBoundingClientRect()
      const zoomX = canvasRect.width / contentWidth
      const zoomY = canvasRect.height / contentHeight
      return { ...state, zoom: Math.min(zoomX, zoomY, 5) }
    }

    case 'ZOOM_TO_PAGE': {
      const canvas = document.getElementById('main-canvas')
      if (!canvas) return { ...state, zoom: 1 }
      const page = state.pages[state.activePage]
      if (!page) return { ...state, zoom: 1 }
      const canvasRect = canvas.getBoundingClientRect()
      const zoomX = canvasRect.width / (page.width + 100)
      const zoomY = canvasRect.height / (page.height + 100)
      return { ...state, zoom: Math.min(zoomX, zoomY, 5) }
    }

    case 'ALIGN': {
      if (state.selectedObjects.length < 2) return state
      const objects = state.objects.filter(o => state.selectedObjects.includes(o.id))
      const bounds = objects.reduce(
        (acc, obj) => ({
          minX: Math.min(acc.minX, obj.x || 0),
          maxX: Math.max(acc.maxX, (obj.x || 0) + (obj.width || 0)),
          minY: Math.min(acc.minY, obj.y || 0),
          maxY: Math.max(acc.maxY, (obj.y || 0) + (obj.height || 0)),
        }),
        { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
      )
      const newObjects = state.objects.map(obj => {
        if (!state.selectedObjects.includes(obj.id)) return obj
        const newObj = { ...obj }
        switch (action.payload.direction) {
          case 'left': newObj.x = bounds.minX; break
          case 'right': newObj.x = bounds.maxX - (obj.width || 0); break
          case 'top': newObj.y = bounds.minY; break
          case 'bottom': newObj.y = bounds.maxY - (obj.height || 0); break
          case 'centerH': newObj.x = (bounds.minX + bounds.maxX) / 2 - (obj.width || 0) / 2; break
          case 'centerV': newObj.y = (bounds.minY + bounds.maxY) / 2 - (obj.height || 0) / 2; break
        }
        return newObj
      })
      return { ...state, objects: newObjects }
    }

    case 'GROUP': {
      if (state.selectedObjects.length < 2) return state
      const groupId = generateId()
      const newObjects = state.objects.map(obj =>
        state.selectedObjects.includes(obj.id) ? { ...obj, groupId } : obj
      )
      return { ...state, objects: newObjects, selectedObjects: [groupId] }
    }

    case 'UNGROUP': {
      const newObjects = state.objects.map(obj =>
        obj.groupId ? { ...obj, groupId: undefined } : obj
      )
      return { ...state, objects: newObjects }
    }

    case 'BRING_TO_FRONT': {
      const selected = state.objects.filter(o => state.selectedObjects.includes(o.id))
      const others = state.objects.filter(o => !state.selectedObjects.includes(o.id))
      return { ...state, objects: [...others, ...selected] }
    }

    case 'SEND_TO_BACK': {
      const selected = state.objects.filter(o => state.selectedObjects.includes(o.id))
      const others = state.objects.filter(o => !state.selectedObjects.includes(o.id))
      return { ...state, objects: [...selected, ...others] }
    }

    case 'BRING_FORWARD': {
      const newObjects = [...state.objects]
      for (let i = newObjects.length - 2; i >= 0; i--) {
        if (state.selectedObjects.includes(newObjects[i].id)) {
          const temp = newObjects[i]
          newObjects[i] = newObjects[i + 1]
          newObjects[i + 1] = temp
        }
      }
      return { ...state, objects: newObjects }
    }

    case 'SEND_BACKWARD': {
      const newObjects = [...state.objects]
      for (let i = 1; i < newObjects.length; i++) {
        if (state.selectedObjects.includes(newObjects[i].id)) {
          const temp = newObjects[i]
          newObjects[i] = newObjects[i - 1]
          newObjects[i - 1] = temp
        }
      }
      return { ...state, objects: newObjects }
    }

    case 'MIRROR_X': {
      const newObjects = state.objects.map(obj => {
        if (!state.selectedObjects.includes(obj.id)) return obj
        return { ...obj, scaleX: (obj.scaleX || 1) * -1 }
      })
      return { ...state, objects: newObjects }
    }

    case 'MIRROR_Y': {
      const newObjects = state.objects.map(obj => {
        if (!state.selectedObjects.includes(obj.id)) return obj
        return { ...obj, scaleY: (obj.scaleY || 1) * -1 }
      })
      return { ...state, objects: newObjects }
    }

    case 'ROTATE': {
      const newObjects = state.objects.map(obj => {
        if (!state.selectedObjects.includes(obj.id)) return obj
        return { ...obj, rotation: ((obj.rotation || 0) + action.payload.degrees) % 360 }
      })
      return { ...state, objects: newObjects }
    }

    case 'UPDATE_PROPERTY': {
      if (!state.selectedObject) return state
      const newObjects = state.objects.map(obj =>
        obj.id === state.selectedObject.id
          ? { ...obj, [action.payload.property]: action.payload.value }
          : obj
      )
      const updatedObj = { ...state.selectedObject, [action.payload.property]: action.payload.value }
      return { ...state, objects: newObjects, selectedObject: updatedObj }
    }

    case 'ADD_OBJECT': {
      const newObj = {
        id: generateId(),
        type: action.payload.type,
        x: action.payload.x || 100,
        y: action.payload.y || 100,
        width: action.payload.width || 100,
        height: action.payload.height || 100,
        text: action.payload.text || '',
        fill: { ...state.currentFill },
        stroke: { ...state.currentStroke },
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 100,
        ...action.payload.properties,
      }
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push({ objects: [...state.objects, newObj], pages: state.pages })
      return {
        ...state,
        objects: [...state.objects, newObj],
        selectedObjects: [newObj.id],
        selectedObject: newObj,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        isModified: true,
      }
    }

    case 'UPDATE_OBJECT': {
      const newObjects = state.objects.map(obj =>
        obj.id === action.payload.id ? { ...obj, ...action.payload.updates } : obj
      )
      return { ...state, objects: newObjects }
    }

    case 'SET_FILL':
      return { ...state, currentFill: { ...state.currentFill, ...action.payload } }

    case 'SET_STROKE':
      return { ...state, currentStroke: { ...state.currentStroke, ...action.payload } }

    case 'SET_CURSOR_POS':
      return { ...state, cursorPos: action.payload }

    case 'TOGGLE_GRID':
      return { ...state, showGrid: !state.showGrid }

    case 'TOGGLE_GUIDES':
      return { ...state, showGuides: !state.showGuides }

    case 'TOGGLE_RULERS':
      return { ...state, showRulers: !state.showRulers }

    case 'SET_ZOOM':
      return { ...state, zoom: action.payload }

    case 'ADD_PAGE': {
      const newPage = {
        id: generateId(),
        name: `Page ${state.pages.length + 1}`,
        width: 210,
        height: 297,
        objects: [],
      }
      return {
        ...state,
        pages: [...state.pages, newPage],
        activePage: state.pages.length,
      }
    }

    case 'DELETE_PAGE': {
      if (state.pages.length <= 1) return state
      const newPages = state.pages.filter((_, i) => i !== state.activePage)
      return {
        ...state,
        pages: newPages,
        activePage: Math.max(0, state.activePage - 1),
      }
    }

    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  const actions = {
    newDocument: useCallback(() => dispatch({ type: 'NEW_DOCUMENT' }), []),
    loadFile: useCallback((file) => dispatch({ type: 'LOAD_FILE', payload: { file } }), []),
    saveDocument: useCallback(() => dispatch({ type: 'SAVE_DOCUMENT' }), []),
    exportDocument: useCallback(() => dispatch({ type: 'EXPORT_DOCUMENT' }), []),
    setTool: useCallback((toolId) => dispatch({ type: 'SET_TOOL', payload: { toolId } }), []),
    setTab: useCallback((tab) => dispatch({ type: 'SET_TAB', payload: { tab } }), []),
    selectAll: useCallback(() => dispatch({ type: 'SELECT_ALL' }), []),
    deleteSelected: useCallback(() => dispatch({ type: 'DELETE_SELECTED' }), []),
    duplicateSelected: useCallback(() => dispatch({ type: 'DUPLICATE_SELECTED' }), []),
    copySelected: useCallback(() => dispatch({ type: 'COPY_SELECTED' }), []),
    cutSelected: useCallback(() => dispatch({ type: 'CUT_SELECTED' }), []),
    paste: useCallback(() => dispatch({ type: 'PASTE' }), []),
    undo: useCallback(() => dispatch({ type: 'UNDO' }), []),
    redo: useCallback(() => dispatch({ type: 'REDO' }), []),
    zoomIn: useCallback(() => dispatch({ type: 'ZOOM_IN' }), []),
    zoomOut: useCallback(() => dispatch({ type: 'ZOOM_OUT' }), []),
    zoomToAll: useCallback(() => dispatch({ type: 'ZOOM_TO_ALL' }), []),
    zoomToPage: useCallback(() => dispatch({ type: 'ZOOM_TO_PAGE' }), []),
    align: useCallback((direction) => dispatch({ type: 'ALIGN', payload: { direction } }), []),
    group: useCallback(() => dispatch({ type: 'GROUP' }), []),
    ungroup: useCallback(() => dispatch({ type: 'UNGROUP' }), []),
    bringToFront: useCallback(() => dispatch({ type: 'BRING_TO_FRONT' }), []),
    sendToBack: useCallback(() => dispatch({ type: 'SEND_TO_BACK' }), []),
    bringForward: useCallback(() => dispatch({ type: 'BRING_FORWARD' }), []),
    sendBackward: useCallback(() => dispatch({ type: 'SEND_BACKWARD' }), []),
    mirrorX: useCallback(() => dispatch({ type: 'MIRROR_X' }), []),
    mirrorY: useCallback(() => dispatch({ type: 'MIRROR_Y' }), []),
    rotate: useCallback((degrees) => dispatch({ type: 'ROTATE', payload: { degrees } }), []),
    updateProperty: useCallback((property, value) => dispatch({ type: 'UPDATE_PROPERTY', payload: { property, value } }), []),
    addObject: useCallback((obj) => dispatch({ type: 'ADD_OBJECT', payload: obj }), []),
    updateObject: useCallback((id, updates) => dispatch({ type: 'UPDATE_OBJECT', payload: { id, updates } }), []),
    setFill: useCallback((fill) => dispatch({ type: 'SET_FILL', payload: fill }), []),
    setStroke: useCallback((stroke) => dispatch({ type: 'SET_STROKE', payload: stroke }), []),
    setCursorPos: useCallback((pos) => dispatch({ type: 'SET_CURSOR_POS', payload: pos }), []),
    toggleGrid: useCallback(() => dispatch({ type: 'TOGGLE_GRID' }), []),
    toggleGuides: useCallback(() => dispatch({ type: 'TOGGLE_GUIDES' }), []),
    toggleRulers: useCallback(() => dispatch({ type: 'TOGGLE_RULERS' }), []),
    setZoom: useCallback((zoom) => dispatch({ type: 'SET_ZOOM', payload: zoom }), []),
    addPage: useCallback(() => dispatch({ type: 'ADD_PAGE' }), []),
    deletePage: useCallback(() => dispatch({ type: 'DELETE_PAGE' }), []),
  }

  return (
    <AppContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
