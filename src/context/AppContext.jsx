import React, { createContext, useContext, useReducer, useCallback } from 'react'

const AppContext = createContext()

const initialState = {
  documentName: 'Untitled-1',
  pages: [{ id: 1, name: 'Page 1', width: 210, height: 297, objects: [], isMaster: false }],
  masterPages: [],
  activePage: 0,
  activeTab: 'design',
  activeTool: 'select',
  selectedObjects: [],
  selectedObject: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  showGrid: false,
  showGuides: false,
  showRulers: true,
  snapToGrid: false,
  snapToGuides: false,
  snapToObjects: false,
  snapToPage: false,
  gridSize: 10,
  history: [],
  historyIndex: -1,
  cursorPos: { x: 0, y: 0 },
  isModified: false,
  clipboard: null,
  objects: [],
  currentFill: { type: 'solid', color: '#ff8000', opacity: 100, spotColor: null, logoImage: null, maskPath: null, parentFill: null },
  currentStroke: { color: '#000000', width: 1, style: 'solid' },
  currentEffect: { type: 'none', outline: null, blockShadow: null, dropShadow: null, softShadow: null, glow: null, multiOutline: null, multiInline: null, tintMap: null, threeD: null },
  textSettings: { font: 'Arial', size: 16, bold: false, italic: false, underline: false, align: 'left', lineSpacing: 1.2, charSpacing: 0, elasticity: 0, kerning: true },
  paragraphSettings: { columns: 1, gutter: 0.5, composingMethod: 1, charToWordRatio: 0.2, indent: 0, hyphenation: false },
  cloneSettings: { type: 'single', rows: 2, cols: 2, spacingX: 10, spacingY: 10, circleRadius: 50, circleCount: 8 },
  stepRepeatSettings: { method: 'grid', rows: 2, cols: 2, spacingX: 10, spacingY: 10, alternate: false, alternateOffset: 5 },
  dimensionSettings: { type: 'affine', active: true, guide: false, units: 'mm', precision: 1 },
  warpSettings: { type: 'circle', intensity: 50, centerX: 50, centerY: 50 },
  knifeSettings: { mode: 'cut', closePath: true, snapToNodes: true },
  penSettings: { style: 1, width: 1, endCap: 'round', lineJoin: 'miter', miterLimit: 10 },
  pageSizes: [
    { name: 'A4', width: 210, height: 297 },
    { name: 'A3', width: 297, height: 420 },
    { name: 'A5', width: 148, height: 210 },
    { name: 'Letter', width: 216, height: 279 },
    { name: 'Legal', width: 216, height: 356 },
    { name: 'Tabloid', width: 279, height: 432 },
    { name: 'Business Card', width: 89, height: 51 },
    { name: 'Custom', width: 210, height: 297 },
  ],
  cutterModels: [
    { id: 'summa_d60', name: 'Summa D60', type: 'drag', maxWidth: 600 },
    { id: 'summa_d120', name: 'Summa D120', type: 'drag', maxWidth: 1200 },
    { id: 'graphtec_ce6000', name: 'Graphtec CE6000', type: 'drag', maxWidth: 600 },
    { id: 'graphtec_fc8000', name: 'Graphtec FC8000', type: 'blade', maxWidth: 1600 },
    { id: 'roland_gx24', name: 'Roland GX-24', type: 'blade', maxWidth: 584 },
    { id: 'mimaki_cg130', name: 'Mimaki CG-130', type: 'blade', maxWidth: 1300 },
    { id: 'jinka_arms', name: 'Jinka with ARMS', type: 'drag', maxWidth: 1300 },
    { id: 'liyu_dmpl', name: 'Liyu DMPL', type: 'drag', maxWidth: 1200 },
  ],
  traceSettings: { mode: 'color', threshold: 128, smoothing: 1, cornerThreshold: 60, noiseReduction: 2, colorCount: 16, traceType: 'outline' },
  registrationMarks: { enabled: true, size: 5, offset: 2, style: 'L-shape', color: '#FF0000' },
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
        pages: [{ id: 1, name: 'Page 1', width: 210, height: 297, objects: [], isMaster: false }],
        masterPages: [],
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
      return { ...state, objects: newObjects, selectedObjects: [], selectedObject: null }
    }

    case 'DUPLICATE_SELECTED': {
      const newObjects = state.selectedObjects
        .map(id => state.objects.find(o => o.id === id))
        .filter(Boolean)
        .map(o => ({ ...o, id: generateId(), x: (o.x || 0) + 10, y: (o.y || 0) + 10 }))
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

    case 'DISTRIBUTE': {
      if (state.selectedObjects.length < 3) return state
      const objects = state.objects.filter(o => state.selectedObjects.includes(o.id))
      const sorted = [...objects].sort((a, b) => {
        if (action.payload.direction === 'horizontal') return (a.x || 0) - (b.x || 0)
        return (a.y || 0) - (b.y || 0)
      })
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const totalSpace = action.payload.direction === 'horizontal'
        ? (last.x || 0) - (first.x || 0)
        : (last.y || 0) - (first.y || 0)
      const avgSpace = totalSpace / (sorted.length - 1)
      let pos = action.payload.direction === 'horizontal' ? (first.x || 0) : (first.y || 0)
      const newObjects = state.objects.map(obj => {
        if (!state.selectedObjects.includes(obj.id)) return obj
        const newObj = { ...obj }
        if (action.payload.direction === 'horizontal') {
          newObj.x = pos
          pos += avgSpace
        } else {
          newObj.y = pos
          pos += avgSpace
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

    case 'SKEW': {
      const newObjects = state.objects.map(obj => {
        if (!state.selectedObjects.includes(obj.id)) return obj
        return { ...obj, skewX: (obj.skewX || 0) + action.payload.skewX, skewY: (obj.skewY || 0) + action.payload.skewY }
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
        skewX: 0,
        skewY: 0,
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

    case 'SET_EFFECT':
      return { ...state, currentEffect: { ...state.currentEffect, ...action.payload } }

    case 'SET_TEXT_SETTINGS':
      return { ...state, textSettings: { ...state.textSettings, ...action.payload } }

    case 'SET_PARAGRAPH_SETTINGS':
      return { ...state, paragraphSettings: { ...state.paragraphSettings, ...action.payload } }

    case 'SET_CLONE_SETTINGS':
      return { ...state, cloneSettings: { ...state.cloneSettings, ...action.payload } }

    case 'SET_STEP_REPEAT_SETTINGS':
      return { ...state, stepRepeatSettings: { ...state.stepRepeatSettings, ...action.payload } }

    case 'SET_DIMENSION_SETTINGS':
      return { ...state, dimensionSettings: { ...state.dimensionSettings, ...action.payload } }

    case 'SET_WARP_SETTINGS':
      return { ...state, warpSettings: { ...state.warpSettings, ...action.payload } }

    case 'SET_KNIFE_SETTINGS':
      return { ...state, knifeSettings: { ...state.knifeSettings, ...action.payload } }

    case 'SET_PEN_SETTINGS':
      return { ...state, penSettings: { ...state.penSettings, ...action.payload } }

    case 'SET_TRACE_SETTINGS':
      return { ...state, traceSettings: { ...state.traceSettings, ...action.payload } }

    case 'SET_REGISTRATION_MARKS':
      return { ...state, registrationMarks: { ...state.registrationMarks, ...action.payload } }

    case 'SET_CURSOR_POS':
      return { ...state, cursorPos: action.payload }

    case 'TOGGLE_GRID':
      return { ...state, showGrid: !state.showGrid }

    case 'TOGGLE_GUIDES':
      return { ...state, showGuides: !state.showGuides }

    case 'TOGGLE_RULERS':
      return { ...state, showRulers: !state.showRulers }

    case 'TOGGLE_SNAP_GRID':
      return { ...state, snapToGrid: !state.snapToGrid }

    case 'TOGGLE_SNAP_GUIDES':
      return { ...state, snapToGuides: !state.snapToGuides }

    case 'TOGGLE_SNAP_OBJECTS':
      return { ...state, snapToObjects: !state.snapToObjects }

    case 'TOGGLE_SNAP_PAGE':
      return { ...state, snapToPage: !state.snapToPage }

    case 'SET_ZOOM':
      return { ...state, zoom: action.payload }

    case 'ADD_PAGE': {
      const newPage = {
        id: generateId(),
        name: `Page ${state.pages.length + 1}`,
        width: 210,
        height: 297,
        objects: [],
        isMaster: false,
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

    case 'ADD_MASTER_PAGE': {
      const newMaster = {
        id: generateId(),
        name: `Master ${state.masterPages.length + 1}`,
        width: 210,
        height: 297,
        objects: [],
        isMaster: true,
      }
      return {
        ...state,
        masterPages: [...state.masterPages, newMaster],
      }
    }

    case 'SET_PAGE_SIZE': {
      const newPages = state.pages.map((p, i) =>
        i === state.activePage ? { ...p, width: action.payload.width, height: action.payload.height } : p
      )
      return { ...state, pages: newPages }
    }

    case 'SET_PAGE_ORIENTATION': {
      const newPages = state.pages.map((p, i) =>
        i === state.activePage ? { ...p, width: p.height, height: p.width } : p
      )
      return { ...state, pages: newPages }
    }

    case 'APPLY_EFFECT': {
      if (!state.selectedObject) return state
      const newObjects = state.objects.map(obj =>
        obj.id === state.selectedObject.id
          ? { ...obj, effect: { ...state.currentEffect, ...action.payload } }
          : obj
      )
      return { ...state, objects: newObjects }
    }

    case 'APPLY_WELD': {
      if (state.selectedObjects.length < 2) return state
      const welded = {
        id: generateId(),
        type: 'path',
        x: Math.min(...state.objects.filter(o => state.selectedObjects.includes(o.id)).map(o => o.x || 0)),
        y: Math.min(...state.objects.filter(o => state.selectedObjects.includes(o.id)).map(o => o.y || 0)),
        width: 100,
        height: 100,
        fill: { ...state.currentFill },
        pathData: 'M0,0 L100,0 L100,100 L0,100 Z',
      }
      const newObjects = state.objects.filter(o => !state.selectedObjects.includes(o.id))
      newObjects.push(welded)
      return { ...state, objects: newObjects, selectedObjects: [welded.id], selectedObject: welded }
    }

    case 'APPLY_PUNCH_OUT': {
      if (state.selectedObjects.length < 2) return state
      const front = state.objects.find(o => o.id === state.selectedObjects[0])
      const back = state.objects.find(o => o.id === state.selectedObjects[1])
      if (!front || !back) return state
      const punched = { ...back, id: generateId(), punchPath: front }
      const newObjects = state.objects.filter(o => !state.selectedObjects.includes(o.id))
      newObjects.push(punched)
      return { ...state, objects: newObjects, selectedObjects: [punched.id], selectedObject: punched }
    }

    case 'APPLY_TRIM': {
      if (state.selectedObjects.length < 2) return state
      const front = state.objects.find(o => o.id === state.selectedObjects[0])
      const back = state.objects.find(o => o.id === state.selectedObjects[1])
      if (!front || !back) return state
      const trimmed = { ...back, id: generateId(), trimPath: front }
      const newObjects = state.objects.filter(o => !state.selectedObjects.includes(o.id))
      newObjects.push(trimmed)
      return { ...state, objects: newObjects, selectedObjects: [trimmed.id], selectedObject: trimmed }
    }

    case 'APPLY_COOKIE_CUT': {
      if (state.selectedObjects.length < 2) return state
      const objects = state.objects.filter(o => state.selectedObjects.includes(o.id))
      const common = {
        id: generateId(),
        type: 'path',
        x: Math.min(...objects.map(o => o.x || 0)),
        y: Math.min(...objects.map(o => o.y || 0)),
        width: 100,
        height: 100,
        fill: { ...state.currentFill },
        pathData: 'M0,0 L100,0 L100,100 L0,100 Z',
      }
      const newObjects = state.objects.filter(o => !state.selectedObjects.includes(o.id))
      newObjects.push(common)
      return { ...state, objects: newObjects, selectedObjects: [common.id], selectedObject: common }
    }

    case 'APPLY_OUTLINE': {
      if (!state.selectedObject) return state
      const outline = {
        ...state.selectedObject,
        id: generateId(),
        fill: { type: 'none' },
        stroke: { color: state.currentStroke.color, width: state.currentStroke.width },
        isOutline: true,
      }
      const newObjects = [...state.objects, outline]
      return { ...state, objects: newObjects, selectedObjects: [outline.id], selectedObject: outline }
    }

    case 'APPLY_CLONE': {
      if (!state.selectedObject) return state
      const clones = []
      const settings = state.cloneSettings
      if (settings.type === 'single') {
        clones.push({ ...state.selectedObject, id: generateId(), x: (state.selectedObject.x || 0) + 10, y: (state.selectedObject.y || 0) + 10 })
      } else if (settings.type === 'array') {
        for (let r = 0; r < settings.rows; r++) {
          for (let c = 0; c < settings.cols; c++) {
            clones.push({
              ...state.selectedObject,
              id: generateId(),
              x: (state.selectedObject.x || 0) + c * settings.spacingX,
              y: (state.selectedObject.y || 0) + r * settings.spacingY,
            })
          }
        }
      } else if (settings.type === 'circle') {
        for (let i = 0; i < settings.circleCount; i++) {
          const angle = (i / settings.circleCount) * Math.PI * 2
          clones.push({
            ...state.selectedObject,
            id: generateId(),
            x: (state.selectedObject.x || 0) + Math.cos(angle) * settings.circleRadius,
            y: (state.selectedObject.y || 0) + Math.sin(angle) * settings.circleRadius,
            rotation: (angle * 180 / Math.PI) + 90,
          })
        }
      }
      const newObjects = [...state.objects, ...clones]
      return { ...state, objects: newObjects, selectedObjects: clones.map(c => c.id) }
    }

    case 'APPLY_STEP_REPEAT': {
      if (!state.selectedObject) return state
      const repeats = []
      const settings = state.stepRepeatSettings
      if (settings.method === 'grid') {
        for (let r = 0; r < settings.rows; r++) {
          for (let c = 0; c < settings.cols; c++) {
            repeats.push({
              ...state.selectedObject,
              id: generateId(),
              x: (state.selectedObject.x || 0) + c * settings.spacingX,
              y: (state.selectedObject.y || 0) + r * settings.spacingY,
            })
          }
        }
      } else if (settings.method === 'horizontal') {
        for (let i = 0; i < settings.cols; i++) {
          repeats.push({
            ...state.selectedObject,
            id: generateId(),
            x: (state.selectedObject.x || 0) + i * settings.spacingX,
            y: state.selectedObject.y || 0,
          })
        }
      } else if (settings.method === 'vertical') {
        for (let i = 0; i < settings.rows; i++) {
          repeats.push({
            ...state.selectedObject,
            id: generateId(),
            x: state.selectedObject.x || 0,
            y: (state.selectedObject.y || 0) + i * settings.spacingY,
          })
        }
      }
      const newObjects = [...state.objects, ...repeats]
      return { ...state, objects: newObjects, selectedObjects: repeats.map(r => r.id) }
    }

    case 'APPLY_KNIFE': {
      if (!state.selectedObject) return state
      const parts = [
        { ...state.selectedObject, id: generateId(), pathData: 'M0,0 L50,0 L50,100 L0,100 Z' },
        { ...state.selectedObject, id: generateId(), x: (state.selectedObject.x || 0) + 50, pathData: 'M50,0 L100,0 L100,100 L50,100 Z' },
      ]
      const newObjects = state.objects.filter(o => o.id !== state.selectedObject.id)
      newObjects.push(...parts)
      return { ...state, objects: newObjects, selectedObjects: parts.map(p => p.id) }
    }

    case 'APPLY_VECTORIZE': {
      if (!state.selectedObject || state.selectedObject.type !== 'image') return state
      const vectorized = {
        ...state.selectedObject,
        id: generateId(),
        type: 'path',
        pathData: 'M10,10 L90,10 L90,90 L10,90 Z',
        isVectorized: true,
      }
      const newObjects = [...state.objects, vectorized]
      return { ...state, objects: newObjects, selectedObjects: [vectorized.id], selectedObject: vectorized }
    }

    case 'APPLY_WARP': {
      if (!state.selectedObject) return state
      const warped = {
        ...state.selectedObject,
        id: generateId(),
        warpType: state.warpSettings.type,
        warpIntensity: state.warpSettings.intensity,
      }
      const newObjects = [...state.objects, warped]
      return { ...state, objects: newObjects, selectedObjects: [warped.id], selectedObject: warped }
    }

    case 'APPLY_3D': {
      if (!state.selectedObject) return state
      const threeD = {
        ...state.selectedObject,
        id: generateId(),
        effect: {
          ...state.currentEffect,
          threeD: { depth: 20, angle: 45, bevel: 5, lighting: 'top-left' }
        }
      }
      const newObjects = [...state.objects, threeD]
      return { ...state, objects: newObjects, selectedObjects: [threeD.id], selectedObject: threeD }
    }

    case 'APPLY_TEXT_TO_PATH': {
      if (!state.selectedObject || state.selectedObject.type !== 'text') return state
      const onPath = {
        ...state.selectedObject,
        id: generateId(),
        textOnPath: true,
        pathData: 'M0,50 Q50,0 100,50',
      }
      const newObjects = [...state.objects, onPath]
      return { ...state, objects: newObjects, selectedObjects: [onPath.id], selectedObject: onPath }
    }

    case 'APPLY_TEXT_TO_ARC': {
      if (!state.selectedObject || state.selectedObject.type !== 'text') return state
      const onArc = {
        ...state.selectedObject,
        id: generateId(),
        textOnArc: true,
        arcRadius: 80,
        arcAngle: 180,
      }
      const newObjects = [...state.objects, onArc]
      return { ...state, objects: newObjects, selectedObjects: [onArc.id], selectedObject: onArc }
    }

    case 'APPLY_VERTICAL_TEXT': {
      if (!state.selectedObject || state.selectedObject.type !== 'text') return state
      const vertical = {
        ...state.selectedObject,
        id: generateId(),
        verticalText: true,
      }
      const newObjects = [...state.objects, vertical]
      return { ...state, objects: newObjects, selectedObjects: [vertical.id], selectedObject: vertical }
    }

    case 'APPLY_PARAGRAPH_TEXT': {
      if (!state.selectedObject || state.selectedObject.type !== 'text') return state
      const paragraph = {
        ...state.selectedObject,
        id: generateId(),
        isParagraph: true,
        paragraphSettings: { ...state.paragraphSettings },
      }
      const newObjects = [...state.objects, paragraph]
      return { ...state, objects: newObjects, selectedObjects: [paragraph.id], selectedObject: paragraph }
    }

    case 'APPLY_INNER_OUTLINE': {
      if (!state.selectedObject) return state
      const innerOutline = {
        ...state.selectedObject,
        id: generateId(),
        fill: { type: 'none' },
        stroke: { color: state.currentStroke.color, width: state.currentStroke.width },
        isInnerOutline: true,
      }
      const newObjects = [...state.objects, innerOutline]
      return { ...state, objects: newObjects, selectedObjects: [innerOutline.id], selectedObject: innerOutline }
    }

    case 'APPLY_TINT_MAP': {
      if (!state.selectedObject) return state
      const tintMap = {
        ...state.selectedObject,
        id: generateId(),
        effect: { ...state.currentEffect, tintMap: { color: '#ff0000', intensity: 50 } }
      }
      const newObjects = [...state.objects, tintMap]
      return { ...state, objects: newObjects, selectedObjects: [tintMap.id], selectedObject: tintMap }
    }

    case 'APPLY_FIRE_EFFECT': {
      if (!state.selectedObject) return state
      const fire = {
        ...state.selectedObject,
        id: generateId(),
        effect: { ...state.currentEffect, fire: { intensity: 50, color1: '#ff0000', color2: '#ffff00' } }
      }
      const newObjects = [...state.objects, fire]
      return { ...state, objects: newObjects, selectedObjects: [fire.id], selectedObject: fire }
    }

    case 'APPLY_REFLECT_EFFECT': {
      if (!state.selectedObject) return state
      const reflect = {
        ...state.selectedObject,
        id: generateId(),
        effect: { ...state.currentEffect, reflect: { opacity: 50, blur: 5, offset: 10 } }
      }
      const newObjects = [...state.objects, reflect]
      return { ...state, objects: newObjects, selectedObjects: [reflect.id], selectedObject: reflect }
    }

    case 'APPLY_LOGO_3D': {
      if (!state.selectedObject) return state
      const logo3D = {
        ...state.selectedObject,
        id: generateId(),
        effect: { ...state.currentEffect, logo3D: { depth: 30, bevel: 10, lighting: 'top-right' } }
      }
      const newObjects = [...state.objects, logo3D]
      return { ...state, objects: newObjects, selectedObjects: [logo3D.id], selectedObject: logo3D }
    }

    case 'APPLY_POWER_SHAPE': {
      const { shapeType, x, y, width, height, points, innerRadius, rotation: rot } = action.payload
      const powerShape = {
        id: generateId(),
        type: 'powerShape',
        shapeType,
        x, y, width, height,
        points: points || 5,
        innerRadius: innerRadius || 50,
        rotation: rot || 0,
        fill: { ...state.currentFill },
        stroke: { ...state.currentStroke },
      }
      const newObjects = [...state.objects, powerShape]
      return { ...state, objects: newObjects, selectedObjects: [powerShape.id], selectedObject: powerShape }
    }

    case 'APPLY_SPIRAL': {
      const { x, y, width, height, turns, direction } = action.payload
      const spiral = {
        id: generateId(),
        type: 'spiral',
        x, y, width, height,
        turns: turns || 5,
        direction: direction || 'clockwise',
        fill: { type: 'none' },
        stroke: { ...state.currentStroke },
      }
      const newObjects = [...state.objects, spiral]
      return { ...state, objects: newObjects, selectedObjects: [spiral.id], selectedObject: spiral }
    }

    case 'APPLY_ARROW': {
      const { x, y, width, height, arrowStyle, headSize, tailWidth } = action.payload
      const arrow = {
        id: generateId(),
        type: 'arrow',
        x, y, width, height,
        arrowStyle: arrowStyle || 'standard',
        headSize: headSize || 20,
        tailWidth: tailWidth || 5,
        fill: { ...state.currentFill },
        stroke: { ...state.currentStroke },
      }
      const newObjects = [...state.objects, arrow]
      return { ...state, objects: newObjects, selectedObjects: [arrow.id], selectedObject: arrow }
    }

    case 'APPLY_CHAOS_SHAPE': {
      const { x, y, width, height, complexity, seed } = action.payload
      const chaos = {
        id: generateId(),
        type: 'chaos',
        x, y, width, height,
        complexity: complexity || 5,
        seed: seed || Math.random(),
        fill: { ...state.currentFill },
        stroke: { ...state.currentStroke },
      }
      const newObjects = [...state.objects, chaos]
      return { ...state, objects: newObjects, selectedObjects: [chaos.id], selectedObject: chaos }
    }

    case 'APPLY_DIMENSION': {
      const { x, y, width, height, dimType, value } = action.payload
      const dimension = {
        id: generateId(),
        type: 'dimension',
        x, y, width, height,
        dimType: dimType || 'linear',
        value: value || 0,
        units: state.dimensionSettings.units,
        precision: state.dimensionSettings.precision,
        color: '#000000',
      }
      const newObjects = [...state.objects, dimension]
      return { ...state, objects: newObjects, selectedObjects: [dimension.id], selectedObject: dimension }
    }

    case 'APPLY_PEN_STYLE': {
      if (!state.selectedObject) return state
      const withPen = {
        ...state.selectedObject,
        id: generateId(),
        penStyle: { ...state.penSettings },
      }
      const newObjects = [...state.objects, withPen]
      return { ...state, objects: newObjects, selectedObjects: [withPen.id], selectedObject: withPen }
    }

    case 'APPLY_MASK': {
      if (!state.selectedObject) return state
      const masked = {
        ...state.selectedObject,
        id: generateId(),
        mask: { pathData: 'M0,0 L100,0 L100,100 L0,100 Z', invert: false },
      }
      const newObjects = [...state.objects, masked]
      return { ...state, objects: newObjects, selectedObjects: [masked.id], selectedObject: masked }
    }

    case 'APPLY_PARENT_FILL': {
      if (!state.selectedObject) return state
      const withParent = {
        ...state.selectedObject,
        id: generateId(),
        fill: { ...state.currentFill, type: 'parent' },
      }
      const newObjects = [...state.objects, withParent]
      return { ...state, objects: newObjects, selectedObjects: [withParent.id], selectedObject: withParent }
    }

    case 'APPLY_SPOT_COLOR': {
      if (!state.selectedObject) return state
      const withSpot = {
        ...state.selectedObject,
        id: generateId(),
        fill: { ...state.currentFill, type: 'spot', spotColor: action.payload.color || '#ff0000' },
      }
      const newObjects = [...state.objects, withSpot]
      return { ...state, objects: newObjects, selectedObjects: [withSpot.id], selectedObject: withSpot }
    }

    case 'APPLY_LOGO_FILL': {
      if (!state.selectedObject) return state
      const withLogo = {
        ...state.selectedObject,
        id: generateId(),
        fill: { ...state.currentFill, type: 'logo', logoImage: action.payload.image || null },
      }
      const newObjects = [...state.objects, withLogo]
      return { ...state, objects: newObjects, selectedObjects: [withLogo.id], selectedObject: withLogo }
    }

    case 'APPLY_MULTI_OUTLINE': {
      if (!state.selectedObject) return state
      const multiOutline = {
        ...state.selectedObject,
        id: generateId(),
        effect: { ...state.currentEffect, multiOutline: { count: 3, spacing: 2, color: '#000000' } }
      }
      const newObjects = [...state.objects, multiOutline]
      return { ...state, objects: newObjects, selectedObjects: [multiOutline.id], selectedObject: multiOutline }
    }

    case 'APPLY_MULTI_INLINE': {
      if (!state.selectedObject) return state
      const multiInline = {
        ...state.selectedObject,
        id: generateId(),
        effect: { ...state.currentEffect, multiInline: { count: 3, spacing: 2, color: '#000000' } }
      }
      const newObjects = [...state.objects, multiInline]
      return { ...state, objects: newObjects, selectedObjects: [multiInline.id], selectedObject: multiInline }
    }

    case 'APPLY_BLOCK_SHADOW': {
      if (!state.selectedObject) return state
      const blockShadow = {
        ...state.selectedObject,
        id: generateId(),
        effect: { ...state.currentEffect, blockShadow: { offsetX: 5, offsetY: 5, blur: 0, color: '#000000' } }
      }
      const newObjects = [...state.objects, blockShadow]
      return { ...state, objects: newObjects, selectedObjects: [blockShadow.id], selectedObject: blockShadow }
    }

    case 'APPLY_DROP_SHADOW': {
      if (!state.selectedObject) return state
      const dropShadow = {
        ...state.selectedObject,
        id: generateId(),
        effect: { ...state.currentEffect, dropShadow: { offsetX: 3, offsetY: 3, blur: 5, color: '#000000' } }
      }
      const newObjects = [...state.objects, dropShadow]
      return { ...state, objects: newObjects, selectedObjects: [dropShadow.id], selectedObject: dropShadow }
    }

    case 'APPLY_SOFT_SHADOW': {
      if (!state.selectedObject) return state
      const softShadow = {
        ...state.selectedObject,
        id: generateId(),
        effect: { ...state.currentEffect, softShadow: { offsetX: 2, offsetY: 2, blur: 10, color: '#000000' } }
      }
      const newObjects = [...state.objects, softShadow]
      return { ...state, objects: newObjects, selectedObjects: [softShadow.id], selectedObject: softShadow }
    }

    case 'APPLY_GLOW': {
      if (!state.selectedObject) return state
      const glow = {
        ...state.selectedObject,
        id: generateId(),
        effect: { ...state.currentEffect, glow: { radius: 10, color: '#ff8000', intensity: 50 } }
      }
      const newObjects = [...state.objects, glow]
      return { ...state, objects: newObjects, selectedObjects: [glow.id], selectedObject: glow }
    }

    case 'APPLY_WARP_CIRCLE': {
      if (!state.selectedObject) return state
      const warped = {
        ...state.selectedObject,
        id: generateId(),
        warpType: 'circle',
        warpIntensity: state.warpSettings.intensity,
      }
      const newObjects = [...state.objects, warped]
      return { ...state, objects: newObjects, selectedObjects: [warped.id], selectedObject: warped }
    }

    case 'APPLY_WARP_COONS': {
      if (!state.selectedObject) return state
      const warped = {
        ...state.selectedObject,
        id: generateId(),
        warpType: 'coons',
        warpIntensity: state.warpSettings.intensity,
      }
      const newObjects = [...state.objects, warped]
      return { ...state, objects: newObjects, selectedObjects: [warped.id], selectedObject: warped }
    }

    case 'APPLY_WARP_FLAG': {
      if (!state.selectedObject) return state
      const warped = {
        ...state.selectedObject,
        id: generateId(),
        warpType: 'flag',
        warpIntensity: state.warpSettings.intensity,
      }
      const newObjects = [...state.objects, warped]
      return { ...state, objects: newObjects, selectedObjects: [warped.id], selectedObject: warped }
    }

    case 'APPLY_WARP_PERSPECTIVE': {
      if (!state.selectedObject) return state
      const warped = {
        ...state.selectedObject,
        id: generateId(),
        warpType: 'perspective',
        warpIntensity: state.warpSettings.intensity,
      }
      const newObjects = [...state.objects, warped]
      return { ...state, objects: newObjects, selectedObjects: [warped.id], selectedObject: warped }
    }

    case 'APPLY_WARP_SKIRT': {
      if (!state.selectedObject) return state
      const warped = {
        ...state.selectedObject,
        id: generateId(),
        warpType: 'skirt',
        warpIntensity: state.warpSettings.intensity,
      }
      const newObjects = [...state.objects, warped]
      return { ...state, objects: newObjects, selectedObjects: [warped.id], selectedObject: warped }
    }

    case 'APPLY_WARP_TRAPEZOID': {
      if (!state.selectedObject) return state
      const warped = {
        ...state.selectedObject,
        id: generateId(),
        warpType: 'trapezoid',
        warpIntensity: state.warpSettings.intensity,
      }
      const newObjects = [...state.objects, warped]
      return { ...state, objects: newObjects, selectedObjects: [warped.id], selectedObject: warped }
    }

    case 'APPLY_WARP_WAVE': {
      if (!state.selectedObject) return state
      const warped = {
        ...state.selectedObject,
        id: generateId(),
        warpType: 'wave',
        warpIntensity: state.warpSettings.intensity,
      }
      const newObjects = [...state.objects, warped]
      return { ...state, objects: newObjects, selectedObjects: [warped.id], selectedObject: warped }
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
    distribute: useCallback((direction) => dispatch({ type: 'DISTRIBUTE', payload: { direction } }), []),
    group: useCallback(() => dispatch({ type: 'GROUP' }), []),
    ungroup: useCallback(() => dispatch({ type: 'UNGROUP' }), []),
    bringToFront: useCallback(() => dispatch({ type: 'BRING_TO_FRONT' }), []),
    sendToBack: useCallback(() => dispatch({ type: 'SEND_TO_BACK' }), []),
    bringForward: useCallback(() => dispatch({ type: 'BRING_FORWARD' }), []),
    sendBackward: useCallback(() => dispatch({ type: 'SEND_BACKWARD' }), []),
    mirrorX: useCallback(() => dispatch({ type: 'MIRROR_X' }), []),
    mirrorY: useCallback(() => dispatch({ type: 'MIRROR_Y' }), []),
    rotate: useCallback((degrees) => dispatch({ type: 'ROTATE', payload: { degrees } }), []),
    skew: useCallback((skewX, skewY) => dispatch({ type: 'SKEW', payload: { skewX, skewY } }), []),
    updateProperty: useCallback((property, value) => dispatch({ type: 'UPDATE_PROPERTY', payload: { property, value } }), []),
    addObject: useCallback((obj) => dispatch({ type: 'ADD_OBJECT', payload: obj }), []),
    updateObject: useCallback((id, updates) => dispatch({ type: 'UPDATE_OBJECT', payload: { id, updates } }), []),
    setFill: useCallback((fill) => dispatch({ type: 'SET_FILL', payload: fill }), []),
    setStroke: useCallback((stroke) => dispatch({ type: 'SET_STROKE', payload: stroke }), []),
    setEffect: useCallback((effect) => dispatch({ type: 'SET_EFFECT', payload: effect }), []),
    setTextSettings: useCallback((settings) => dispatch({ type: 'SET_TEXT_SETTINGS', payload: settings }), []),
    setParagraphSettings: useCallback((settings) => dispatch({ type: 'SET_PARAGRAPH_SETTINGS', payload: settings }), []),
    setCloneSettings: useCallback((settings) => dispatch({ type: 'SET_CLONE_SETTINGS', payload: settings }), []),
    setStepRepeatSettings: useCallback((settings) => dispatch({ type: 'SET_STEP_REPEAT_SETTINGS', payload: settings }), []),
    setDimensionSettings: useCallback((settings) => dispatch({ type: 'SET_DIMENSION_SETTINGS', payload: settings }), []),
    setWarpSettings: useCallback((settings) => dispatch({ type: 'SET_WARP_SETTINGS', payload: settings }), []),
    setKnifeSettings: useCallback((settings) => dispatch({ type: 'SET_KNIFE_SETTINGS', payload: settings }), []),
    setPenSettings: useCallback((settings) => dispatch({ type: 'SET_PEN_SETTINGS', payload: settings }), []),
    setTraceSettings: useCallback((settings) => dispatch({ type: 'SET_TRACE_SETTINGS', payload: settings }), []),
    setRegistrationMarks: useCallback((settings) => dispatch({ type: 'SET_REGISTRATION_MARKS', payload: settings }), []),
    setCursorPos: useCallback((pos) => dispatch({ type: 'SET_CURSOR_POS', payload: pos }), []),
    toggleGrid: useCallback(() => dispatch({ type: 'TOGGLE_GRID' }), []),
    toggleGuides: useCallback(() => dispatch({ type: 'TOGGLE_GUIDES' }), []),
    toggleRulers: useCallback(() => dispatch({ type: 'TOGGLE_RULERS' }), []),
    toggleSnapGrid: useCallback(() => dispatch({ type: 'TOGGLE_SNAP_GRID' }), []),
    toggleSnapGuides: useCallback(() => dispatch({ type: 'TOGGLE_SNAP_GUIDES' }), []),
    toggleSnapObjects: useCallback(() => dispatch({ type: 'TOGGLE_SNAP_OBJECTS' }), []),
    toggleSnapPage: useCallback(() => dispatch({ type: 'TOGGLE_SNAP_PAGE' }), []),
    setZoom: useCallback((zoom) => dispatch({ type: 'SET_ZOOM', payload: zoom }), []),
    addPage: useCallback(() => dispatch({ type: 'ADD_PAGE' }), []),
    deletePage: useCallback(() => dispatch({ type: 'DELETE_PAGE' }), []),
    addMasterPage: useCallback(() => dispatch({ type: 'ADD_MASTER_PAGE' }), []),
    setPageSize: useCallback((width, height) => dispatch({ type: 'SET_PAGE_SIZE', payload: { width, height } }), []),
    setPageOrientation: useCallback(() => dispatch({ type: 'SET_PAGE_ORIENTATION' }), []),
    applyEffect: useCallback((effect) => dispatch({ type: 'APPLY_EFFECT', payload: effect }), []),
    applyWeld: useCallback(() => dispatch({ type: 'APPLY_WELD' }), []),
    applyPunchOut: useCallback(() => dispatch({ type: 'APPLY_PUNCH_OUT' }), []),
    applyTrim: useCallback(() => dispatch({ type: 'APPLY_TRIM' }), []),
    applyCookieCut: useCallback(() => dispatch({ type: 'APPLY_COOKIE_CUT' }), []),
    applyOutline: useCallback(() => dispatch({ type: 'APPLY_OUTLINE' }), []),
    applyClone: useCallback(() => dispatch({ type: 'APPLY_CLONE' }), []),
    applyStepRepeat: useCallback(() => dispatch({ type: 'APPLY_STEP_REPEAT' }), []),
    applyKnife: useCallback(() => dispatch({ type: 'APPLY_KNIFE' }), []),
    applyVectorize: useCallback(() => dispatch({ type: 'APPLY_VECTORIZE' }), []),
    applyWarp: useCallback(() => dispatch({ type: 'APPLY_WARP' }), []),
    apply3D: useCallback(() => dispatch({ type: 'APPLY_3D' }), []),
    applyTextToPath: useCallback(() => dispatch({ type: 'APPLY_TEXT_TO_PATH' }), []),
    applyTextToArc: useCallback(() => dispatch({ type: 'APPLY_TEXT_TO_ARC' }), []),
    applyVerticalText: useCallback(() => dispatch({ type: 'APPLY_VERTICAL_TEXT' }), []),
    applyParagraphText: useCallback(() => dispatch({ type: 'APPLY_PARAGRAPH_TEXT' }), []),
    applyInnerOutline: useCallback(() => dispatch({ type: 'APPLY_INNER_OUTLINE' }), []),
    applyTintMap: useCallback(() => dispatch({ type: 'APPLY_TINT_MAP' }), []),
    applyFireEffect: useCallback(() => dispatch({ type: 'APPLY_FIRE_EFFECT' }), []),
    applyReflectEffect: useCallback(() => dispatch({ type: 'APPLY_REFLECT_EFFECT' }), []),
    applyLogo3D: useCallback(() => dispatch({ type: 'APPLY_LOGO_3D' }), []),
    applyPowerShape: useCallback((config) => dispatch({ type: 'APPLY_POWER_SHAPE', payload: config }), []),
    applySpiral: useCallback((config) => dispatch({ type: 'APPLY_SPIRAL', payload: config }), []),
    applyArrow: useCallback((config) => dispatch({ type: 'APPLY_ARROW', payload: config }), []),
    applyChaosShape: useCallback((config) => dispatch({ type: 'APPLY_CHAOS_SHAPE', payload: config }), []),
    applyDimension: useCallback((config) => dispatch({ type: 'APPLY_DIMENSION', payload: config }), []),
    applyPenStyle: useCallback(() => dispatch({ type: 'APPLY_PEN_STYLE' }), []),
    applyMask: useCallback(() => dispatch({ type: 'APPLY_MASK' }), []),
    applyParentFill: useCallback(() => dispatch({ type: 'APPLY_PARENT_FILL' }), []),
    applySpotColor: useCallback((color) => dispatch({ type: 'APPLY_SPOT_COLOR', payload: { color } }), []),
    applyLogoFill: useCallback((image) => dispatch({ type: 'APPLY_LOGO_FILL', payload: { image } }), []),
    applyMultiOutline: useCallback(() => dispatch({ type: 'APPLY_MULTI_OUTLINE' }), []),
    applyMultiInline: useCallback(() => dispatch({ type: 'APPLY_MULTI_INLINE' }), []),
    applyBlockShadow: useCallback(() => dispatch({ type: 'APPLY_BLOCK_SHADOW' }), []),
    applyDropShadow: useCallback(() => dispatch({ type: 'APPLY_DROP_SHADOW' }), []),
    applySoftShadow: useCallback(() => dispatch({ type: 'APPLY_SOFT_SHADOW' }), []),
    applyGlow: useCallback(() => dispatch({ type: 'APPLY_GLOW' }), []),
    applyWarpCircle: useCallback(() => dispatch({ type: 'APPLY_WARP_CIRCLE' }), []),
    applyWarpCoons: useCallback(() => dispatch({ type: 'APPLY_WARP_COONS' }), []),
    applyWarpFlag: useCallback(() => dispatch({ type: 'APPLY_WARP_FLAG' }), []),
    applyWarpPerspective: useCallback(() => dispatch({ type: 'APPLY_WARP_PERSPECTIVE' }), []),
    applyWarpSkirt: useCallback(() => dispatch({ type: 'APPLY_WARP_SKIRT' }), []),
    applyWarpTrapezoid: useCallback(() => dispatch({ type: 'APPLY_WARP_TRAPEZOID' }), []),
    applyWarpWave: useCallback(() => dispatch({ type: 'APPLY_WARP_WAVE' }), []),
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
