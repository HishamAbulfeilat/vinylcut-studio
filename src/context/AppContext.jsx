import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react'
import {
  objectToRings,
  objectToMultiPolygon,
  multiPolygonToShape,
  multiPolygonBounds,
  ringArea,
  multiPolygonToHPGL,
  offsetMultiPolygon,
  splitByLine,
  simplify,
  parsePathData,
  union,
  difference,
  intersection,
} from '../lib/geometry'
import { importFile, loadImageElement } from '../lib/importers'
import { vectorizeImage } from '../lib/tracer'
import { buildSvg, buildPdf, buildPostScript, buildDxf, buildHpgl, rasterise, download, vectorObjects, encodeBmp } from '../lib/exporters'

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

/* ------------------------------------------------------------------ *
 * Live effects. Effects are stored on the object itself (`obj.effect`)
 * so they travel with the shape, survive save/load and can be layered.
 * ------------------------------------------------------------------ */

// Apply a warp to the selected object(s), in place.
function mergeWarp(state, type) {
  const intensity = state.warpSettings ? state.warpSettings.intensity : 50
  return mergeObjects(state, { warpType: type, warpIntensity: intensity })
}

// Merge arbitrary props (not just effects) into every selected object.
function mergeObjects(state, patch) {
  const ids = (state.selectedObjects && state.selectedObjects.length)
    ? state.selectedObjects
    : (state.selectedObject ? [state.selectedObject.id] : [])
  if (!ids.length) return state
  const objects = state.objects.map(o => (ids.includes(o.id) ? { ...o, ...patch } : o))
  const selectedObject = state.selectedObject
    ? (objects.find(o => o.id === state.selectedObject.id) || state.selectedObject)
    : null
  return { ...state, objects, selectedObject }
}

// Merge an effect patch into every selected object, in place.
function mergeEffect(state, patch) {
  const ids = (state.selectedObjects && state.selectedObjects.length)
    ? state.selectedObjects
    : (state.selectedObject ? [state.selectedObject.id] : [])
  if (!ids.length) return state
  const objects = state.objects.map(o =>
    ids.includes(o.id) ? { ...o, effect: { ...(o.effect || {}), ...patch } } : o
  )
  const selectedObject = state.selectedObject
    ? (objects.find(o => o.id === state.selectedObject.id) || state.selectedObject)
    : null
  return { ...state, objects, selectedObject }
}

/* ------------------------------------------------------------------ *
 * Geometry helpers live in ../lib/geometry.js so the canvas, exporters
 * and importers all share one implementation.
 * ------------------------------------------------------------------ */

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

    case 'LOAD_DOCUMENT': {
      const doc = action.payload.doc || {}
      const name = (action.payload.name || 'Untitled-1').replace(/\.vcs\.json$/i, '').replace(/\.json$/i, '')
      return {
        ...state,
        documentName: name,
        pages: Array.isArray(doc.pages) && doc.pages.length ? doc.pages : state.pages,
        masterPages: Array.isArray(doc.masterPages) ? doc.masterPages : [],
        objects: Array.isArray(doc.objects) ? doc.objects : [],
        activePage: typeof doc.activePage === 'number' ? doc.activePage : 0,
        currentFill: doc.currentFill || state.currentFill,
        currentStroke: doc.currentStroke || state.currentStroke,
        textSettings: doc.textSettings || state.textSettings,
        selectedObjects: [],
        selectedObject: null,
        history: [],
        historyIndex: -1,
        isModified: false,
      }
    }

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

    case 'SET_SELECTION': {
      const ids = action.payload.ids || []
      const objs = state.objects.filter(o => ids.includes(o.id))
      return {
        ...state,
        selectedObjects: ids,
        selectedObject: objs.length ? objs[objs.length - 1] : null,
      }
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

    case 'SET_FILL': {
      // Update the pending default *and* restyle the current selection.
      const merged = { ...state, currentFill: { ...state.currentFill, ...action.payload } }
      return mergeObjects(merged, { fill: merged.currentFill })
    }

    case 'SET_STROKE': {
      const merged = { ...state, currentStroke: { ...state.currentStroke, ...action.payload } }
      return mergeObjects(merged, { stroke: merged.currentStroke })
    }

    case 'SET_EFFECT':
      return { ...state, currentEffect: { ...state.currentEffect, ...action.payload } }

    case 'UPDATE_EFFECT': {
      const currentEffect = { ...state.currentEffect, ...action.payload }
      if (!state.selectedObject) return { ...state, currentEffect }
      return { ...mergeEffect(state, action.payload), currentEffect }
    }

    case 'CLEAR_EFFECT': {
      if (!state.selectedObject) return state
      const objects = state.objects.map(o => {
        if (o.id !== state.selectedObject.id) return o
        const next = { ...o }
        delete next.effect
        return next
      })
      return { ...state, objects, selectedObject: objects.find(o => o.id === state.selectedObject.id) }
    }

    case 'SET_TEXT_SETTINGS': {
      const merged = { ...state, textSettings: { ...state.textSettings, ...action.payload } }
      const patch = {}
      for (const k of ['fontFamily', 'fontSize', 'bold', 'italic', 'underline', 'align', 'lineSpacing']) {
        if (k in action.payload) patch[k] = action.payload[k]
      }
      return Object.keys(patch).length ? mergeObjects(merged, patch) : merged
    }

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

    case 'SET_MASTER_PAGES':
      return { ...state, masterPages: action.payload }

    case 'APPLY_MASTER_TO_PAGE': {
      const master = state.masterPages[action.payload]
      if (!master) return state
      const newPages = state.pages.map((p, i) =>
        i === state.activePage ? { ...p, objects: [...master.objects] } : p
      )
      return { ...state, pages: newPages }
    }

    case 'APPLY_EFFECT':
      return mergeEffect(state, action.payload)

    case 'APPLY_WELD': {
      const weldObjs = state.objects.filter(o => state.selectedObjects.includes(o.id))
      if (weldObjs.length < 2) return state
      try {
        const geoms = weldObjs.map(objectToMultiPolygon)
        const shape = multiPolygonToShape(union(geoms[0], ...geoms.slice(1)))
        if (!shape) return state
        const welded = {
          id: generateId(),
          type: 'path',
          ...shape,
          fill: { ...(weldObjs[0].fill || state.currentFill) },
          stroke: { ...(weldObjs[0].stroke || state.currentStroke) },
          opacity: weldObjs[0].opacity || 100,
        }
        const newObjects = state.objects.filter(o => !state.selectedObjects.includes(o.id))
        newObjects.push(welded)
        return { ...state, objects: newObjects, selectedObjects: [welded.id], selectedObject: welded }
      } catch (e) {
        return state
      }
    }

    case 'APPLY_PUNCH_OUT': {
      // Z-order: the topmost selected object is the "punch"; it is subtracted
      // from the union of everything selected underneath it.
      const punchObjs = state.objects.filter(o => state.selectedObjects.includes(o.id))
      if (punchObjs.length < 2) return state
      const punchFront = punchObjs[punchObjs.length - 1]
      const punchBehind = punchObjs.slice(0, -1)
      try {
        let base = objectToMultiPolygon(punchBehind[0])
        for (const o of punchBehind.slice(1)) base = union(base, objectToMultiPolygon(o))
        const shape = multiPolygonToShape(difference(base, objectToMultiPolygon(punchFront)))
        if (!shape) return state
        const punched = {
          id: generateId(),
          type: 'path',
          ...shape,
          fill: { ...(punchBehind[0].fill || state.currentFill) },
          stroke: { ...(punchBehind[0].stroke || state.currentStroke) },
          opacity: punchBehind[0].opacity || 100,
        }
        const newObjects = state.objects.filter(o => !state.selectedObjects.includes(o.id))
        newObjects.push(punched)
        return { ...state, objects: newObjects, selectedObjects: [punched.id], selectedObject: punched }
      } catch (e) {
        return state
      }
    }

    case 'APPLY_TRIM': {
      // Subtract the topmost object from each of the others, keeping every
      // remaining piece as its own object (this is what "Trim" does).
      const trimObjs = state.objects.filter(o => state.selectedObjects.includes(o.id))
      if (trimObjs.length < 2) return state
      const trimFront = trimObjs[trimObjs.length - 1]
      const trimRest = trimObjs.slice(0, -1)
      try {
        const frontGeo = objectToMultiPolygon(trimFront)
        const pieces = []
        for (const o of trimRest) {
          const shape = multiPolygonToShape(difference(objectToMultiPolygon(o), frontGeo))
          if (!shape) continue
          pieces.push({
            id: generateId(),
            type: 'path',
            ...shape,
            fill: { ...(o.fill || state.currentFill) },
            stroke: { ...(o.stroke || state.currentStroke) },
            opacity: o.opacity || 100,
          })
        }
        if (!pieces.length) return state
        const newObjects = state.objects.filter(o => !state.selectedObjects.includes(o.id))
        newObjects.push(...pieces)
        return { ...state, objects: newObjects, selectedObjects: pieces.map(o => o.id), selectedObject: pieces[0] }
      } catch (e) {
        return state
      }
    }

    case 'APPLY_COOKIE_CUT': {
      // Keep only the area common to every selected object.
      const cookieObjs = state.objects.filter(o => state.selectedObjects.includes(o.id))
      if (cookieObjs.length < 2) return state
      try {
        let acc = objectToMultiPolygon(cookieObjs[0])
        for (const o of cookieObjs.slice(1)) acc = intersection(acc, objectToMultiPolygon(o))
        const shape = multiPolygonToShape(acc)
        if (!shape) return state
        const common = {
          id: generateId(),
          type: 'path',
          ...shape,
          fill: { ...(cookieObjs[0].fill || state.currentFill) },
          stroke: { ...(cookieObjs[0].stroke || state.currentStroke) },
          opacity: cookieObjs[0].opacity || 100,
        }
        const newObjects = state.objects.filter(o => !state.selectedObjects.includes(o.id))
        newObjects.push(common)
        return { ...state, objects: newObjects, selectedObjects: [common.id], selectedObject: common }
      } catch (e) {
        return state
      }
    }

    case 'APPLY_OUTLINE':
      return mergeEffect(state, {
        type: 'outline',
        outline: { color: state.currentStroke.color, width: state.currentStroke.width || 2, ...(state.currentEffect.outline || {}) },
      })

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

    case 'ADD_OBJECTS': {
      // Bulk-insert fully-formed objects (imports, tracing, contour output).
      const incoming = action.payload.objects || []
      if (!incoming.length) return state
      const withIds = incoming.map(o => ({ ...o, id: o.id || generateId() }))
      const drop = action.payload.replaceIds || []
      const kept = drop.length ? state.objects.filter(o => !drop.includes(o.id)) : state.objects
      const objects = [...kept, ...withIds]
      const last = withIds[withIds.length - 1]
      return {
        ...state,
        objects,
        selectedObjects: withIds.map(o => o.id),
        selectedObject: last,
        isModified: true,
      }
    }

    case 'DELETE_OBJECTS': {
      const ids = action.payload && action.payload.ids
        ? action.payload.ids
        : (state.selectedObjects.length ? state.selectedObjects : (state.selectedObject ? [state.selectedObject.id] : []))
      if (!ids.length) return state
      const objects = state.objects.filter(o => !ids.includes(o.id))
      if (objects.length === state.objects.length) return state
      return { ...state, objects, selectedObjects: [], selectedObject: null, isModified: true }
    }

    case 'APPLY_KNIFE': {
      // Split every targeted object with a real line cut.
      const line = action.payload || {}
      const targets = state.selectedObjects.length
        ? state.objects.filter(o => state.selectedObjects.includes(o.id))
        : state.objects.slice()
      if (!targets.length) return state

      const pieces = []
      let cut = false
      for (const o of targets) {
        const mp = objectToMultiPolygon(o)
        const b = multiPolygonBounds(mp)
        let p1
        let p2
        if (Number.isFinite(line.x1) && Number.isFinite(line.y1) && Number.isFinite(line.x2) && Number.isFinite(line.y2)) {
          p1 = [line.x1, line.y1]
          p2 = [line.x2, line.y2]
        } else if (b) {
          const cx = (b.minX + b.maxX) / 2
          p1 = [cx, b.minY - 10]
          p2 = [cx, b.maxY + 10]
        } else {
          continue
        }
        let left
        let right
        try {
          ;[left, right] = splitByLine(mp, p1, p2)
        } catch (e) {
          continue
        }
        const sides = [left, right].filter(g => g && g.length && multiPolygonBounds(g))
        if (sides.length < 2) continue
        cut = true
        for (const side of sides) {
          const shape = multiPolygonToShape(side, o)
          if (!shape) continue
          pieces.push({
            ...o,
            ...shape,
            id: generateId(),
            type: 'path',
            fill: { ...(o.fill || state.currentFill) },
            stroke: { ...(o.stroke || state.currentStroke) },
          })
        }
      }

      if (!cut) return state
      const drop = targets.map(t => t.id)
      const objects = [...state.objects.filter(o => !drop.includes(o.id)), ...pieces]
      return { ...state, objects, selectedObjects: pieces.map(p => p.id), selectedObject: pieces[0], isModified: true }
    }

    case 'APPLY_CONTOUR': {
      // Real polygon offsetting: grow/shrink the selection and/or emit
      // concentric contour rings.
      const { delta = 2, count = 1, spacing = 2 } = action.payload || {}
      const targets = state.selectedObjects.length
        ? state.objects.filter(o => state.selectedObjects.includes(o.id))
        : (state.selectedObject ? [state.selectedObject] : [])
      if (!targets.length) return state

      const produced = []
      let any = false
      for (const o of targets) {
        const mp = objectToMultiPolygon(o)
        for (let i = 1; i <= Math.max(1, count); i++) {
          const d = count === 1 ? delta : delta + (i - 1) * spacing
          let off
          try {
            off = offsetMultiPolygon(mp, d)
          } catch (e) {
            continue
          }
          const shape = multiPolygonToShape(off, o)
          if (!shape) continue
          any = true
          produced.push({
            ...o,
            ...shape,
            id: generateId(),
            type: 'path',
            fill: { type: 'none' },
            stroke: { ...(o.stroke || state.currentStroke) },
          })
        }
      }
      if (!any) return state
      return {
        ...state,
        objects: [...state.objects, ...produced],
        selectedObjects: produced.map(p => p.id),
        selectedObject: produced[0],
        isModified: true,
      }
    }

    case 'APPLY_CONTOUR_CUT': {
      // Contour Cut Wizard: build real cut lines around the page/selection.
      const cfg = action.payload || {}
      const offset = Number.isFinite(cfg.offset) ? cfg.offset : 1
      const stroke = {
        color: cfg.cutLineColor || '#ff0000',
        width: Number.isFinite(cfg.cutLineWidth) ? cfg.cutLineWidth : 0.25,
      }
      const cutType = cfg.cutType || 'contour'
      const targets = state.selectedObjects.length
        ? state.objects.filter(o => state.selectedObjects.includes(o.id))
        : state.objects.slice()
      if (!targets.length) return state

      const produced = []
      for (const o of targets) {
        if (cutType === 'contour' || cutType === 'both') {
          let mp = null
          try {
            mp = offsetMultiPolygon(objectToMultiPolygon(o), offset)
          } catch (e) {
            mp = null
          }
          if (mp && mp.length) {
            let out = mp
            if (cfg.skipInnerCuts) {
              // Keep only the largest ring of each island.
              out = mp.map((poly) => {
                let best = poly[0]
                for (const r of poly) if (ringArea(r) > ringArea(best)) best = r
                return [best]
              })
            }
            const shape = multiPolygonToShape(out, o)
            if (shape) {
              produced.push({
                ...shape,
                id: generateId(),
                type: 'path',
                fill: { type: 'none' },
                stroke: { ...stroke },
                isCutLine: true,
              })
            }
          }
        }
        if (cutType === 'crop' || cutType === 'both') {
          produced.push({
            id: generateId(),
            type: 'rect',
            x: (o.x || 0) - offset,
            y: (o.y || 0) - offset,
            width: (o.width || 0) + offset * 2,
            height: (o.height || 0) + offset * 2,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            skewX: 0,
            skewY: 0,
            opacity: 100,
            fill: { type: 'none' },
            stroke: { ...stroke },
            isCutLine: true,
          })
        }
      }
      if (!produced.length) return state

      // Cut order: inside-out (smallest first) or the reverse.
      produced.sort((a, b) => (a.width || 0) * (a.height || 0) - (b.width || 0) * (b.height || 0))
      if (cfg.cutOrder === 'outsideIn') produced.reverse()

      return {
        ...state,
        objects: [...state.objects, ...produced],
        selectedObjects: produced.map(p => p.id),
        selectedObject: produced[0],
        isModified: true,
      }
    }

    case 'APPLY_VECTORIZE': {
      // The tracing itself happens in the provider action (it is async and
      // needs the image element); the reducer just installs the result.
      const shapes = (action.payload && action.payload.objects) || []
      if (!shapes.length) return state
      const withIds = shapes.map(s => ({ ...s, id: generateId() }))
      const drop = (action.payload && action.payload.replaceIds) || []
      const kept = drop.length ? state.objects.filter(o => !drop.includes(o.id)) : state.objects
      const objects = [...kept, ...withIds]
      return { ...state, objects, selectedObjects: withIds.map(o => o.id), selectedObject: withIds[withIds.length - 1], isModified: true }
    }

    case 'APPLY_WARP':
      return mergeWarp(state, state.warpSettings.type)

    case 'APPLY_3D':
      return mergeEffect(state, {
        type: 'threeD',
        threeD: { depth: 20, angle: 45, bevel: 5, lighting: 'top-left', ...(state.currentEffect.threeD || {}) },
      })

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

    case 'APPLY_INNER_OUTLINE':
      return mergeEffect(state, {
        type: 'innerOutline',
        innerOutline: { color: state.currentStroke.color, width: state.currentStroke.width || 2, ...(state.currentEffect.innerOutline || {}) },
      })

    case 'APPLY_TINT_MAP':
      return mergeEffect(state, {
        type: 'tintMap',
        tintMap: { color: '#ff0000', intensity: 50, ...(state.currentEffect.tintMap || {}) },
      })

    case 'APPLY_FIRE_EFFECT':
      return mergeEffect(state, {
        type: 'fire',
        fire: { intensity: 50, color1: '#ff0000', color2: '#ffff00', ...(state.currentEffect.fire || {}) },
      })

    case 'APPLY_REFLECT_EFFECT':
      return mergeEffect(state, {
        type: 'reflect',
        reflect: { opacity: 50, blur: 5, offset: 10, ...(state.currentEffect.reflect || {}) },
      })

    case 'APPLY_LOGO_3D':
      return mergeEffect(state, {
        type: 'logo3D',
        logo3D: { depth: 30, bevel: 10, lighting: 'top-right', angle: 45, ...(state.currentEffect.logo3D || {}) },
      })

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

    case 'APPLY_MULTI_OUTLINE':
      return mergeEffect(state, {
        type: 'multiOutline',
        multiOutline: { count: 3, spacing: 2, color: '#000000', ...(state.currentEffect.multiOutline || {}) },
      })

    case 'APPLY_MULTI_INLINE':
      return mergeEffect(state, {
        type: 'multiInline',
        multiInline: { count: 3, spacing: 2, color: '#000000', ...(state.currentEffect.multiInline || {}) },
      })

    case 'APPLY_BLOCK_SHADOW':
      return mergeEffect(state, {
        type: 'blockShadow',
        blockShadow: { offsetX: 5, offsetY: 5, blur: 0, color: '#000000', ...(state.currentEffect.blockShadow || {}) },
      })

    case 'APPLY_DROP_SHADOW':
      return mergeEffect(state, {
        type: 'dropShadow',
        dropShadow: { offsetX: 3, offsetY: 3, blur: 5, color: '#000000', ...(state.currentEffect.dropShadow || {}) },
      })

    case 'APPLY_SOFT_SHADOW':
      return mergeEffect(state, {
        type: 'softShadow',
        softShadow: { offsetX: 2, offsetY: 2, blur: 10, color: '#000000', ...(state.currentEffect.softShadow || {}) },
      })

    case 'APPLY_GLOW':
      return mergeEffect(state, {
        type: 'glow',
        glow: { radius: 10, color: '#ff8000', intensity: 50, ...(state.currentEffect.glow || {}) },
      })

    case 'APPLY_WARP_CIRCLE':
      return mergeWarp(state, 'circle')

    case 'APPLY_WARP_COONS':
      return mergeWarp(state, 'coons')

    case 'APPLY_WARP_FLAG':
      return mergeWarp(state, 'flag')

    case 'APPLY_WARP_PERSPECTIVE':
      return mergeWarp(state, 'perspective')

    case 'APPLY_WARP_SKIRT':
      return mergeWarp(state, 'skirt')

    case 'APPLY_WARP_TRAPEZOID':
      return mergeWarp(state, 'trapezoid')

    case 'APPLY_WARP_WAVE':
      return mergeWarp(state, 'wave')

    case 'CLEAR_WARP': {
      if (!state.selectedObject) return state
      const objects = state.objects.map(o => {
        if (o.id !== state.selectedObject.id) return o
        const next = { ...o }
        delete next.warpType
        delete next.warpIntensity
        return next
      })
      return { ...state, objects, selectedObject: objects.find(o => o.id === state.selectedObject.id) }
    }

    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  // Always-current state for use inside stable callbacks (file I/O, etc.)
  const stateRef = useRef(state)
  stateRef.current = state

  // Read a saved .vcs.json document off disk and restore it.
  const readDocumentFile = useCallback((file) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const doc = JSON.parse(String(reader.result))
        if (doc && doc.format === 'vinylcut-document') {
          dispatch({ type: 'LOAD_DOCUMENT', payload: { doc, name: file.name } })
        } else {
          console.warn('Unrecognised document format:', file.name)
        }
      } catch (err) {
        console.warn('Could not parse document:', err)
      }
    }
    reader.readAsText(file)
  }, [])

  const openDocumentPicker = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.id = 'vcs-open-input'
    input.accept = '.json,.vcs'
    input.style.display = 'none'
    input.onchange = (e) => {
      const f = e.target.files && e.target.files[0]
      if (f) readDocumentFile(f)
      input.remove()
    }
    document.body.appendChild(input)
    input.click()
  }, [readDocumentFile])

  const openImportPicker = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.id = 'vcs-import-input'
    input.accept = '.svg,.dxf,.plt,.hpgl,.hgl,.png,.jpg,.jpeg,.gif,.bmp,.webp,.avif,.json,.vcs'
    input.style.display = 'none'
    input.onchange = async (e) => {
      const f = e.target.files && e.target.files[0]
      input.remove()
      if (!f) return
      await importAnyFile(f)
    }
    document.body.appendChild(input)
    input.click()
  }, [])

  const serialiseDocument = useCallback(() => {
    const s = stateRef.current
    return JSON.stringify({
      format: 'vinylcut-document',
      version: 1,
      documentName: s.documentName,
      activePage: s.activePage,
      pages: s.pages,
      masterPages: s.masterPages,
      objects: s.objects,
      currentFill: s.currentFill,
      currentStroke: s.currentStroke,
      textSettings: s.textSettings,
    }, null, 2)
  }, [])

  const notify = useCallback((message, kind = 'info') => {
    try {
      window.dispatchEvent(new CustomEvent('vcs-notify', { detail: { message, kind } }))
    } catch (e) {
      /* ignore */
    }
  }, [])

  // Real import: raster / SVG / DXF / HPGL / document.
  const importAnyFile = useCallback(async (file) => {
    const page = stateRef.current.pages[stateRef.current.activePage] || { width: 210, height: 297 }
    try {
      const result = await importFile(file, page)
      if (result.document) {
        dispatch({ type: 'LOAD_DOCUMENT', payload: { doc: result.document, name: file.name } })
        notify(`Opened ${file.name}`, 'ok')
        return
      }
      const objects = result.objects || []
      if (!objects.length) {
        notify(`Nothing importable found in ${file.name}`, 'warn')
        return
      }
      dispatch({ type: 'ADD_OBJECTS', payload: { objects } })
      notify(`Imported ${objects.length} object${objects.length === 1 ? '' : 's'} from ${file.name}`, 'ok')
    } catch (err) {
      notify(err && err.message ? err.message : 'Import failed', 'error')
    }
  }, [notify])

  // Real export for every advertised format.
  const exportAs = useCallback(async (format, options = {}) => {
    const s = stateRef.current
    const page = s.pages[s.activePage] || { width: 210, height: 297 }
    const objects = s.objects
    const base = (s.documentName || 'Untitled-1').replace(/\.[^.]*$/, '')
    const dpi = options.dpi || 300
    const px = (mm) => Math.max(1, Math.round((mm / 25.4) * dpi))

    if (!objects.length) {
      notify('Nothing to export - the page is empty', 'warn')
      return null
    }

    const svg = buildSvg(objects, page, {
      cropMarks: options.includeCropMarks,
      registrationMarks: options.includeRegistrationMarks,
      transparentBg: options.transparentBg !== false,
    })

    const f = format.toLowerCase()
    try {
      if (f === 'svg') {
        download(svg, `${base}.svg`, 'image/svg+xml')
      } else if (f === 'png' || f === 'jpg' || f === 'jpeg') {
        const mime = f === 'png' ? 'image/png' : 'image/jpeg'
        const url = await rasterise(svg, px(page.width), px(page.height), mime, 0.95)
        download(url, `${base}.${f === 'jpeg' ? 'jpg' : f}`)
      } else if (f === 'bmp') {
        const url = await rasterise(svg, px(page.width), px(page.height), 'image/png', 1)
        const img = await loadImageElement(url)
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const bmp = encodeBmp(data)
        download(new Blob([bmp], { type: 'image/bmp' }), `${base}.bmp`)
      } else if (f === 'pdf') {
        download(buildPdf(objects, page), `${base}.pdf`, 'application/pdf')
      } else if (f === 'eps' || f === 'ps') {
        download(buildPostScript(objects, page), `${base}.eps`, 'application/postscript')
      } else if (f === 'ai') {
        download(buildPostScript(objects, page), `${base}.ai`, 'application/postscript')
      } else if (f === 'dxf') {
        download(buildDxf(objects), `${base}.dxf`, 'application/dxf')
      } else if (f === 'plt' || f === 'hpgl') {
        download(buildHpgl(objects, options), `${base}.plt`, 'application/vnd.hp-hpgl')
      } else {
        notify(`Export format .${f} is not supported`, 'error')
        return null
      }
      dispatch({ type: 'SAVE_DOCUMENT' })
      notify(`Exported ${base}.${f}`, 'ok')
      return `${base}.${f}`
    } catch (err) {
      notify(err && err.message ? err.message : 'Export failed', 'error')
      return null
    }
  }, [notify])

  // Real raster tracing -> vector paths.
  const vectorizeSelected = useCallback(async (options = {}) => {
    const s = stateRef.current
    const target = s.selectedObject && s.selectedObject.type === 'image'
      ? s.selectedObject
      : s.objects.find(o => o.type === 'image')
    if (!target || !target.src) {
      notify('Select an imported image first (File > Import, then Vectorize)', 'warn')
      return null
    }
    try {
      const img = await loadImageElement(target.src)
      const rect = { x: target.x, y: target.y, width: target.width, height: target.height }
      const shapes = vectorizeImage(img, rect, {
        mode: options.mode || 'outline',
        threshold: options.threshold == null ? 128 : options.threshold,
        colors: options.colors || 8,
        smoothing: options.smoothing == null ? 0.8 : options.smoothing,
        noise: options.noise == null ? 3 : options.noise,
      })
      if (!shapes.length) {
        notify('Vectorize found nothing at this threshold - try a different setting', 'warn')
        return null
      }
      dispatch({
        type: 'APPLY_VECTORIZE',
        payload: { objects: shapes, replaceIds: options.replaceSource ? [target.id] : [] },
      })
      notify(`Vectorized into ${shapes.length} path${shapes.length === 1 ? '' : 's'}`, 'ok')
      return shapes.length
    } catch (err) {
      notify(err && err.message ? err.message : 'Vectorize failed', 'error')
      return null
    }
  }, [notify])

  // HPGL spooling: always offers a real .plt file; also streams over WebSerial
  // when the browser and the cutter both support it.
  const serialSupported = typeof navigator !== 'undefined' && 'serial' in navigator

  const sendToCutter = useCallback(async (options = {}) => {
    const s = stateRef.current
    const objects = s.selectedObjects.length
      ? s.objects.filter(o => s.selectedObjects.includes(o.id))
      : s.objects
    if (!objects.length) {
      notify('Nothing to cut - the page is empty', 'warn')
      return null
    }
    const hpgl = buildHpgl(objects, options)
    if (!serialSupported || options.downloadOnly) {
      download(hpgl, `${(s.documentName || 'Untitled-1').replace(/\.[^.]*$/, '')}.plt`, 'application/vnd.hp-hpgl')
      notify('Saved HPGL (.plt) - load it from your cutter software', 'ok')
      return 'download'
    }
    try {
      const port = await navigator.serial.requestPort()
      await port.open({ baudRate: options.baudRate || 9600 })
      const writer = port.writable.getWriter()
      await writer.write(new TextEncoder().encode(hpgl))
      writer.releaseLock()
      await port.close()
      notify('Sent to cutter over serial', 'ok')
      return 'serial'
    } catch (err) {
      download(hpgl, `${(s.documentName || 'Untitled-1').replace(/\.[^.]*$/, '')}.plt`, 'application/vnd.hp-hpgl')
      notify('Serial send cancelled - saved HPGL (.plt) instead', 'warn')
      return 'download'
    }
  }, [notify, serialSupported])

  const actions = {
    newDocument: useCallback(() => dispatch({ type: 'NEW_DOCUMENT' }), []),
    loadFile: useCallback((file) => {
      if (file) readDocumentFile(file)
      else openDocumentPicker()
    }, [readDocumentFile, openDocumentPicker]),
    importFile: importAnyFile,
    openImportPicker,
    exportAs,
    vectorizeSelected,
    sendToCutter,
    serialSupported,
    notify,
    saveDocument: useCallback(() => {
      const s = stateRef.current
      const blob = new Blob([serialiseDocument()], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(s.documentName || 'Untitled-1').replace(/\.[^.]*$/, '')}.vcs.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      dispatch({ type: 'SAVE_DOCUMENT' })
    }, [serialiseDocument]),
    exportDocument: useCallback(() => dispatch({ type: 'EXPORT_DOCUMENT' }), []),
    setTool: useCallback((toolId) => dispatch({ type: 'SET_TOOL', payload: { toolId } }), []),
    setTab: useCallback((tab) => dispatch({ type: 'SET_TAB', payload: { tab } }), []),
    selectAll: useCallback(() => dispatch({ type: 'SELECT_ALL' }), []),
    setSelection: useCallback((ids) => dispatch({ type: 'SET_SELECTION', payload: { ids } }), []),
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
    addObjects: useCallback((objects, replaceIds) => dispatch({ type: 'ADD_OBJECTS', payload: { objects, replaceIds } }), []),
    deleteObjects: useCallback((ids) => dispatch({ type: 'DELETE_OBJECTS', payload: { ids } }), []),
    updateObject: useCallback((id, updates) => dispatch({ type: 'UPDATE_OBJECT', payload: { id, updates } }), []),
    setFill: useCallback((fill) => dispatch({ type: 'SET_FILL', payload: fill }), []),
    setStroke: useCallback((stroke) => dispatch({ type: 'SET_STROKE', payload: stroke }), []),
    setEffect: useCallback((effect) => dispatch({ type: 'UPDATE_EFFECT', payload: effect }), []),
    clearEffect: useCallback(() => dispatch({ type: 'CLEAR_EFFECT' }), []),
    clearWarp: useCallback(() => dispatch({ type: 'CLEAR_WARP' }), []),
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
    applyMasterToPage: useCallback((index) => dispatch({ type: 'APPLY_MASTER_TO_PAGE', payload: index }), []),
    applyEffect: useCallback((effect) => dispatch({ type: 'APPLY_EFFECT', payload: effect }), []),
    applyWeld: useCallback(() => dispatch({ type: 'APPLY_WELD' }), []),
    applyPunchOut: useCallback(() => dispatch({ type: 'APPLY_PUNCH_OUT' }), []),
    applyTrim: useCallback(() => dispatch({ type: 'APPLY_TRIM' }), []),
    applyCookieCut: useCallback(() => dispatch({ type: 'APPLY_COOKIE_CUT' }), []),
    applyOutline: useCallback(() => dispatch({ type: 'APPLY_OUTLINE' }), []),
    applyClone: useCallback(() => dispatch({ type: 'APPLY_CLONE' }), []),
    applyStepRepeat: useCallback(() => dispatch({ type: 'APPLY_STEP_REPEAT' }), []),
    applyKnife: useCallback((line) => dispatch({ type: 'APPLY_KNIFE', payload: line }), []),
    applyContour: useCallback((config) => dispatch({ type: 'APPLY_CONTOUR', payload: config }), []),
    applyContourCut: useCallback((config) => dispatch({ type: 'APPLY_CONTOUR_CUT', payload: config }), []),
    applyVectorize: useCallback((objects, replaceIds) => dispatch({ type: 'APPLY_VECTORIZE', payload: { objects, replaceIds } }), []),
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
