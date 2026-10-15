import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useApp } from '../context/AppContext'
import { parsePathData, objectToSegments, subpathsBounds } from '../lib/geometry'
import { warpSubpaths } from '../lib/warp'
import RasterWarp from './RasterWarp'
import CropMarks from './CropMarks'
import './Canvas.css'

/* Real gradient / texture / spot fills, shared by DOM and SVG shapes. */

function gradientStops(fill) {
  if (fill.stops && fill.stops.length) return fill.stops
  return [
    { offset: 0, color: fill.color || '#000000' },
    { offset: 1, color: fill.color2 || '#ffffff' },
  ]
}

function fillToCss(fill) {
  if (!fill || fill.type === 'none') return 'transparent'
  if (fill.type === 'solid') return fill.color || '#000000'
  if (fill.type === 'spot') return fill.spotColor || '#ff0000'
  if (fill.type === 'gradient') {
    const list = gradientStops(fill)
      .map(s => `${s.color} ${Math.round((s.offset || 0) * 100)}%`)
      .join(', ')
    return `linear-gradient(${fill.angle == null ? 90 : fill.angle}deg, ${list})`
  }
  if (fill.type === 'texture') {
    const c = fill.color || '#cccccc'
    const lc = fill.lineColor || '#666666'
    const s = fill.size || 8
    return `repeating-linear-gradient(45deg, ${lc} 0 1px, transparent 1px ${s}px), repeating-linear-gradient(-45deg, ${c} 0 ${s}px, ${lc} ${s}px ${s + 1}px)`
  }
  if (fill.type === 'logo') return 'repeating-conic-gradient(#bbbbbb 0 25%, #dddddd 0 50%)'
  if (fill.type === 'mask' || fill.type === 'parent') return 'rgba(130,130,130,0.35)'
  return 'transparent'
}

function svgFill(fill, id) {
  if (!fill || fill.type === 'none') return { fill: 'none', defs: null }
  if (fill.type === 'solid') return { fill: fill.color || '#000000', defs: null }
  if (fill.type === 'spot') return { fill: fill.spotColor || '#ff0000', defs: null }
  if (fill.type === 'mask' || fill.type === 'parent') return { fill: 'rgba(130,130,130,0.35)', defs: null }

  if (fill.type === 'gradient') {
    const rad = ((fill.angle == null ? 90 : fill.angle) * Math.PI) / 180
    const x1 = 0.5 - Math.cos(rad) / 2
    const y1 = 0.5 - Math.sin(rad) / 2
    const x2 = 0.5 + Math.cos(rad) / 2
    const y2 = 0.5 + Math.sin(rad) / 2
    return {
      fill: `url(#${id})`,
      defs: (
        <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
          {gradientStops(fill).map((s, i) => (
            <stop key={i} offset={`${Math.round((s.offset || 0) * 100)}%`} stopColor={s.color} />
          ))}
        </linearGradient>
      ),
    }
  }
  if (fill.type === 'texture') {
    const s = fill.size || 8
    return {
      fill: `url(#${id})`,
      defs: (
        <pattern id={id} width={s} height={s} patternUnits="userSpaceOnUse">
          <rect width={s} height={s} fill={fill.color || '#cccccc'} opacity="0.35" />
          <path d={`M0,${s} L${s},0`} stroke={fill.lineColor || '#666666'} strokeWidth="1" />
          <path d={`M0,0 L${s},${s}`} stroke={fill.lineColor || '#666666'} strokeWidth="0.6" opacity="0.6" />
        </pattern>
      ),
    }
  }
  if (fill.type === 'logo') {
    return {
      fill: `url(#${id})`,
      defs: (
        <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill="#dddddd" />
          <circle cx="8" cy="8" r="5" fill="#999999" />
        </pattern>
      ),
    }
  }
  return { fill: 'none', defs: null }
}

const Canvas = forwardRef((props, ref) => {
  const { state, dispatch, actions } = useApp()
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  // The element that defines the document coordinate origin (object 0,0).
  const pageRef = useRef(null)
  // Where the page sits inside the container, so rulers can align with it.
  const [pageOrigin, setPageOrigin] = useState({ x: 0, y: 0 })
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragObjStart, setDragObjStart] = useState({})
  const [nodeEditMode, setNodeEditMode] = useState(false)
  const [isMarquee, setIsMarquee] = useState(false)
  const [marqueeStart, setMarqueeStart] = useState({ x: 0, y: 0 })
  const [marqueeEnd, setMarqueeEnd] = useState({ x: 0, y: 0 })
  // Tool-specific drags
  const [isKnifing, setIsKnifing] = useState(false)
  const [knifeStart, setKnifeStart] = useState({ x: 0, y: 0 })
  const [knifeEnd, setKnifeEnd] = useState({ x: 0, y: 0 })
  const [isContouring, setIsContouring] = useState(false)
  const [contourStart, setContourStart] = useState({ x: 0, y: 0 })
  const [contourEnd, setContourEnd] = useState({ x: 0, y: 0 })
  const [isErasing, setIsErasing] = useState(false)
  const eraseIds = useRef([])

  const objectAt = useCallback((coords) => (
    [...state.objects].reverse().find(o =>
      coords.x >= (o.x || 0) && coords.x <= (o.x || 0) + (o.width || 0) &&
      coords.y >= (o.y || 0) && coords.y <= (o.y || 0) + (o.height || 0))
  ), [state.objects])

  // Eraser: delete whatever the cursor is over, once per object.
  const eraseAt = useCallback((coords) => {
    const hit = objectAt(coords)
    if (hit && !eraseIds.current.includes(hit.id)) {
      eraseIds.current = [...eraseIds.current, hit.id]
      dispatch({ type: 'DELETE_OBJECTS', payload: { ids: [hit.id] } })
    }
  }, [objectAt, dispatch])

  // Screen -> document coordinates.
  //
  // Objects are laid out inside `.page-boundary`, which the viewport centres
  // with flexbox, so the page origin is NOT the canvas origin. Measuring from
  // the canvas made every click land offset by the centring margin. Measure
  // from the page itself instead (getBoundingClientRect is also scroll-aware,
  // so a scrolled viewport stays correct).
  const getCanvasCoords = useCallback((e) => {
    const page = pageRef.current || canvasRef.current
    if (!page) return { x: 0, y: 0 }
    const rect = page.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / state.zoom - state.panX,
      y: (e.clientY - rect.top) / state.zoom - state.panY,
    }
  }, [state.zoom, state.panX, state.panY])

  const handleMouseDown = useCallback((e) => {
    const coords = getCanvasCoords(e)

    if (state.activeTool === 'pan' || e.button === 1) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - state.panX * state.zoom, y: e.clientY - state.panY * state.zoom })
      return
    }

    if (state.activeTool === 'select') {
      const clickedObj = [...state.objects].reverse().find(obj => {
        return coords.x >= obj.x && coords.x <= obj.x + obj.width &&
               coords.y >= obj.y && coords.y <= obj.y + obj.height
      })
      if (clickedObj) {
        let ids
        if (e.shiftKey) {
          ids = state.selectedObjects.includes(clickedObj.id)
            ? state.selectedObjects.filter(id => id !== clickedObj.id)
            : [...state.selectedObjects, clickedObj.id]
        } else if (state.selectedObjects.includes(clickedObj.id)) {
          ids = state.selectedObjects
        } else {
          ids = [clickedObj.id]
        }
        actions.setSelection(ids)
        setIsDragging(true)
        setDragStart(coords)
        const starts = {}
        state.objects.filter(o => ids.includes(o.id)).forEach(o => {
          starts[o.id] = { x: o.x || 0, y: o.y || 0 }
        })
        setDragObjStart(starts)
      } else {
        if (!e.shiftKey) actions.setSelection([])
        setIsMarquee(true)
        setMarqueeStart(coords)
        setMarqueeEnd(coords)
      }
      return
    }

    if (state.activeTool === 'node') {
      const clickedObj = [...state.objects].reverse().find(obj => {
        return coords.x >= obj.x && coords.x <= obj.x + obj.width &&
               coords.y >= obj.y && coords.y <= obj.y + obj.height
      })
      if (clickedObj) {
        actions.setSelection([clickedObj.id])
        setNodeEditMode(true)
      }
      return
    }

    const drawableTools = ['rect', 'ellipse', 'polygon', 'star', 'spiral', 'arrow', 'chaos', 'line', 'curve', 'freehand', 'pen', 'text', 'textArc', 'textPath', 'textVert', 'textBox', 'paragraph', 'dimension']

    // --- Knife: drag a cutting line ----------------------------------
    if (state.activeTool === 'knife') {
      setIsKnifing(true)
      setKnifeStart(coords)
      setKnifeEnd(coords)
      return
    }

    // --- Contour / offset: drag outward or inward ---------------------
    if (state.activeTool === 'contour') {
      const obj = objectAt(coords) || state.selectedObject
      if (obj) {
        actions.setSelection([obj.id])
        setIsContouring(true)
        setContourStart(coords)
        setContourEnd(coords)
      }
      return
    }

    // --- Eraser -------------------------------------------------------
    if (state.activeTool === 'eraser') {
      setIsErasing(true)
      eraseIds.current = []
      eraseAt(coords)
      return
    }

    // --- Bucket fill --------------------------------------------------
    if (state.activeTool === 'fill') {
      const obj = objectAt(coords)
      if (obj) actions.updateObject(obj.id, { fill: { ...state.currentFill } })
      return
    }

    // --- Zoom tool ----------------------------------------------------
    if (state.activeTool === 'zoom') {
      const factor = e.altKey ? 0.8 : 1.25
      actions.setZoom(Math.max(0.05, Math.min(20, state.zoom * factor)))
      return
    }

    // --- Click-to-apply tools (clone / warp / effects) ----------------
    if (['clone', 'cloneArray', 'cloneCircle', 'warpCircle', 'warpFlag', 'warpWave', 'outline', 'shadow', 'glow', '3d'].includes(state.activeTool)) {
      const obj = objectAt(coords)
      if (!obj) return
      actions.setSelection([obj.id])
      if (state.activeTool.startsWith('clone')) {
        const kind = state.activeTool === 'clone' ? 'single' : state.activeTool === 'cloneArray' ? 'array' : 'circle'
        dispatch({ type: 'SET_CLONE_SETTINGS', payload: { type: kind } })
        dispatch({ type: 'APPLY_CLONE' })
      } else if (state.activeTool.startsWith('warp')) {
        const type = state.activeTool.replace('warp', '').toLowerCase()
        dispatch({ type: 'SET_WARP_SETTINGS', payload: { type } })
        dispatch({ type: 'APPLY_WARP' })
      } else {
        const effect = { outline: 'outline', shadow: 'dropShadow', glow: 'glow', '3d': 'threeD' }[state.activeTool]
        dispatch({ type: 'APPLY_EFFECT', payload: { type: effect } })
      }
      return
    }

    // --- Image: import a real bitmap on click -------------------------
    if (state.activeTool === 'image') {
      actions.openImportPicker()
      return
    }

    // --- Vectorize: open the tracing dialog ---------------------------
    if (state.activeTool === 'trace') {
      const obj = objectAt(coords)
      if (obj && obj.type === 'image') actions.setSelection([obj.id])
      window.dispatchEvent(new CustomEvent('openDialog', { detail: 'vectorize' }))
      return
    }

    if (drawableTools.includes(state.activeTool)) {
      setIsDrawing(true)
      setDrawStart(coords)
      setCurrentPos(coords)
    }
  }, [state.activeTool, state.objects, state.zoom, state.panX, state.panY, state.selectedObject, state.selectedObjects, state.currentFill, getCanvasCoords, actions, dispatch, objectAt, eraseAt])

  const handleMouseMove = useCallback((e) => {
    const coords = getCanvasCoords(e)
    actions.setCursorPos(coords)

    if (isPanning) return
    if (isMarquee) { setMarqueeEnd(coords); return }
    if (isKnifing) { setKnifeEnd(coords); return }
    if (isContouring) { setContourEnd(coords); return }
    if (isErasing) {
      eraseAt(coords)
      return
    }
    if (isDragging && Object.keys(dragObjStart).length) {
      const dx = coords.x - dragStart.x
      const dy = coords.y - dragStart.y
      Object.entries(dragObjStart).forEach(([id, start]) => {
        dispatch({ type: 'UPDATE_OBJECT', payload: { id, updates: { x: start.x + dx, y: start.y + dy } } })
      })
      return
    }
    if (isDrawing) setCurrentPos(coords)
  }, [isPanning, isDrawing, isDragging, isKnifing, isContouring, isErasing, dragStart, dragObjStart, state.selectedObject, getCanvasCoords, actions, dispatch, eraseAt])

  const handleMouseUp = useCallback((e) => {
    if (isPanning) { setIsPanning(false); return }
    if (isKnifing) {
      setIsKnifing(false)
      const coords = getCanvasCoords(e)
      const len = Math.hypot(coords.x - knifeStart.x, coords.y - knifeStart.y)
      if (len > 3) {
        actions.applyKnife({ x1: knifeStart.x, y1: knifeStart.y, x2: coords.x, y2: coords.y })
      }
      return
    }
    if (isContouring) {
      setIsContouring(false)
      const coords = getCanvasCoords(e)
      const obj = state.selectedObject
      if (obj) {
        const cx = (obj.x || 0) + (obj.width || 0) / 2
        const cy = (obj.y || 0) + (obj.height || 0) / 2
        let ox = contourStart.x - cx
        let oy = contourStart.y - cy
        const ol = Math.hypot(ox, oy) || 1
        ox /= ol
        oy /= ol
        const delta = (coords.x - contourStart.x) * ox + (coords.y - contourStart.y) * oy
        if (Math.abs(delta) > 0.5) actions.applyContour({ delta, count: 1 })
      }
      return
    }
    if (isErasing) { setIsErasing(false); eraseIds.current = []; return }
    if (isMarquee) {
      setIsMarquee(false)
      const coords = getCanvasCoords(e)
      const x1 = Math.min(marqueeStart.x, coords.x)
      const y1 = Math.min(marqueeStart.y, coords.y)
      const x2 = Math.max(marqueeStart.x, coords.x)
      const y2 = Math.max(marqueeStart.y, coords.y)
      const hits = state.objects
        .filter(o => !((o.x || 0) > x2 || (o.x || 0) + (o.width || 0) < x1 ||
                       (o.y || 0) > y2 || (o.y || 0) + (o.height || 0) < y1))
        .map(o => o.id)
      const merged = e.shiftKey
        ? Array.from(new Set([...state.selectedObjects, ...hits]))
        : hits
      actions.setSelection(merged)
      return
    }
    if (isDragging) { setIsDragging(false); return }
    if (isDrawing) {
      const coords = getCanvasCoords(e)
      const x = Math.min(drawStart.x, coords.x)
      const y = Math.min(drawStart.y, coords.y)
      const width = Math.abs(coords.x - drawStart.x)
      const height = Math.abs(coords.y - drawStart.y)

      if (width > 3 || height > 3) {
        const toolMap = {
          rect: { type: 'rect', width, height },
          ellipse: { type: 'ellipse', width, height },
          polygon: { type: 'polygon', width, height, points: 5 },
          star: { type: 'star', width, height, points: 5, innerRadius: 50 },
          spiral: { type: 'spiral', width, height, turns: 5, direction: 'clockwise' },
          arrow: { type: 'arrow', width, height, arrowStyle: 'standard', headSize: 20, tailWidth: 5 },
          chaos: { type: 'chaos', width, height, complexity: 5, seed: Math.random() },
          line: { type: 'line', width, height },
          curve: { type: 'curve', width, height },
          freehand: { type: 'freehand', width, height },
          pen: { type: 'pen', width, height },
          text: { type: 'text', width: Math.max(width, 100), height: Math.max(height, 20), text: 'Text' },
          textArc: { type: 'text', width: Math.max(width, 100), height: Math.max(height, 20), text: 'Arc Text', textOnArc: true, arcRadius: 80, arcAngle: 180 },
          textPath: { type: 'text', width: Math.max(width, 100), height: Math.max(height, 20), text: 'Path Text', textOnPath: true, pathData: 'M0,50 Q50,0 100,50' },
          textVert: { type: 'text', width: Math.max(width, 50), height: Math.max(height, 100), text: 'Vertical', verticalText: true },
          textBox: { type: 'text', width: Math.max(width, 150), height: Math.max(height, 100), text: 'Text Box', isTextBox: true },
          paragraph: { type: 'text', width: Math.max(width, 150), height: Math.max(height, 100), text: 'Paragraph text...', isParagraph: true },
          image: { type: 'image', width, height },
          clone: { type: 'clone', width, height },
          cloneArray: { type: 'cloneArray', width, height },
          cloneCircle: { type: 'cloneCircle', width, height },
          dimension: { type: 'dimension', width, height, dimType: 'linear', value: Math.round(width) },
          contour: { type: 'contour', width, height },
        }

        const objConfig = toolMap[state.activeTool]
        if (objConfig) {
          actions.addObject({
            ...objConfig,
            x, y,
            fill: { ...state.currentFill },
            stroke: { ...state.currentStroke },
            fontSize: state.textSettings.size,
            fontFamily: state.textSettings.font,
          })
        }
      }
      setIsDrawing(false)
    }
  }, [isDrawing, isDragging, isPanning, isKnifing, isContouring, isErasing, knifeStart, contourStart, marqueeStart, state.activeTool, state.objects, state.selectedObjects, state.currentFill, state.currentStroke, state.textSettings, state.selectedObject, getCanvasCoords, actions, dispatch])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    if (e.ctrlKey) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      actions.setZoom(state.zoom * delta)
    }
  }, [state.zoom, actions])

  useImperativeHandle(ref, () => ({
    handleCanvasClick: (e) => handleMouseDown(e),
  }))

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(() => {
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = container.clientWidth
        canvas.height = container.clientHeight
      }
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  // Track where the (flex-centred) page sits inside the container so the
  // rulers and their labels line up with the page, not the container edges.
  useLayoutEffect(() => {
    const measure = () => {
      const page = pageRef.current
      const container = containerRef.current
      if (!page || !container) return
      const p = page.getBoundingClientRect()
      const c = container.getBoundingClientRect()
      const x = Math.round(p.left - c.left)
      const y = Math.round(p.top - c.top)
      setPageOrigin(prev => (prev.x === x && prev.y === y ? prev : { x, y }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    if (pageRef.current) ro.observe(pageRef.current)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [state.zoom, state.activePage, state.pages, state.showRulers])

  const renderShape = (obj, at) => {
    const scale = state.zoom
    const left = at ? at.left : obj.x * scale + state.panX * scale
    const top = at ? at.top : obj.y * scale + state.panY * scale
    const width = obj.width * scale
    const height = obj.height * scale

    const fillColor = fillToCss(obj.fill)
    const fillId = `cv-fill-${String(obj.id || '').replace(/[^a-zA-Z0-9]/g, '')}`
    const svgF = svgFill(obj.fill, fillId)

    const strokeStr = obj.stroke?.width > 0 ? `${obj.stroke.width}px ${obj.stroke.style || 'solid'} ${obj.stroke.color}` : 'none'

    const baseStyle = {
      position: 'absolute',
      left, top, width, height,
      transform: `rotate(${obj.rotation || 0}deg) scaleX(${obj.scaleX || 1}) scaleY(${obj.scaleY || 1})`,
      opacity: (obj.opacity || 100) / 100,
      background: fillColor,
      border: strokeStr,
    }

    switch (obj.type) {
      case 'rect':
      case 'powerRect':
        return <div style={{ ...baseStyle, borderRadius: obj.shapeType === 'powerRect' ? '10%' : '0' }} />

      case 'ellipse':
      case 'powerCircle':
        return <div style={{ ...baseStyle, borderRadius: '50%' }} />

      case 'polygon':
      case 'powerPolygon': {
        const pts = obj.points || 5
        return (
          <svg style={{ position: 'absolute', left, top, width, height, transform: `rotate(${obj.rotation || 0}deg)` }}>
            <defs>{svgF.defs}</defs>
            <polygon
              points={Array.from({ length: pts }, (_, i) => {
                const angle = (i / pts) * Math.PI * 2 - Math.PI / 2
                return `${50 + Math.cos(angle) * 50},${50 + Math.sin(angle) * 50}`
              }).join(' ')}
              fill={svgF.fill}
              stroke={obj.stroke?.width > 0 ? obj.stroke.color : 'none'}
              strokeWidth={obj.stroke?.width || 0}
            />
          </svg>
        )
      }

      case 'star':
      case 'powerStar': {
        const starPts = obj.points || 5
        const innerR = obj.innerRadius || 50
        return (
          <svg style={{ position: 'absolute', left, top, width, height, transform: `rotate(${obj.rotation || 0}deg)` }}>
            <defs>{svgF.defs}</defs>
            <polygon
              points={Array.from({ length: starPts * 2 }, (_, i) => {
                const angle = (i / (starPts * 2)) * Math.PI * 2 - Math.PI / 2
                const r = i % 2 === 0 ? 50 : innerR
                return `${50 + Math.cos(angle) * r},${50 + Math.sin(angle) * r}`
              }).join(' ')}
              fill={svgF.fill}
              stroke={obj.stroke?.width > 0 ? obj.stroke.color : 'none'}
              strokeWidth={obj.stroke?.width || 0}
            />
          </svg>
        )
      }

      case 'spiral':
        return (
          <svg style={{ position: 'absolute', left, top, width, height, transform: `rotate(${obj.rotation || 0}deg)` }}>
            <path
              d={`M50,50 ${Array.from({ length: (obj.turns || 5) * 20 }, (_, i) => {
                const angle = (i / 20) * Math.PI * 2
                const r = (i / ((obj.turns || 5) * 20)) * 45
                return `L${50 + Math.cos(angle) * r},${50 + Math.sin(angle) * r}`
              }).join(' ')}`}
              fill="none"
              stroke={obj.stroke?.color || '#000'}
              strokeWidth={obj.stroke?.width || 1}
            />
          </svg>
        )

      case 'arrow':
        return (
          <svg style={{ position: 'absolute', left, top, width, height, transform: `rotate(${obj.rotation || 0}deg)` }}>
            <line x1="0" y1="50" x2={100 - (obj.headSize || 20)} y2="50" stroke={obj.stroke?.color || '#000'} strokeWidth={obj.tailWidth || 5} />
            <polygon
              points={`${100 - (obj.headSize || 20)},${50 - (obj.headSize || 20) / 2} 100,50 ${100 - (obj.headSize || 20)},${50 + (obj.headSize || 20) / 2}`}
              fill={fillColor || obj.stroke?.color || '#000'}
            />
          </svg>
        )

      case 'line':
        return (
          <svg style={{ position: 'absolute', left, top, width, height }}>
            <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke={obj.stroke?.color || '#000'} strokeWidth={obj.stroke?.width || 1} />
          </svg>
        )

      case 'curve':
        return (
          <svg style={{ position: 'absolute', left, top, width, height }}>
            <path
              d={`M0,${height / 2} Q${width / 2},0 ${width},${height / 2}`}
              fill="none"
              stroke={obj.stroke?.color || '#000'}
              strokeWidth={obj.stroke?.width || 1}
            />
          </svg>
        )

      case 'freehand':
      case 'pen':
        return (
          <svg style={{ position: 'absolute', left, top, width, height }}>
            <path
              d={`M0,${height} Q${width * 0.25},0 ${width * 0.5},${height * 0.5} T${width},0`}
              fill="none"
              stroke={obj.stroke?.color || '#000'}
              strokeWidth={obj.stroke?.width || 1}
              strokeLinecap={obj.penStyle?.endCap || 'round'}
            />
          </svg>
        )

      case 'chaos':
        return (
          <svg style={{ position: 'absolute', left, top, width, height, transform: `rotate(${obj.rotation || 0}deg)` }}>
            <defs>{svgF.defs}</defs>
            <path
              d={`M${50 + (obj.seed || 0.5) * 30},${50 - (obj.seed || 0.5) * 30} L${50 - 40},${50 + (obj.seed || 0.5) * 20} L${50 + (obj.seed || 0.5) * 20},${50 + 40} Z`}
              fill={svgF.fill}
              stroke={obj.stroke?.width > 0 ? obj.stroke.color : 'none'}
              strokeWidth={obj.stroke?.width || 0}
            />
          </svg>
        )

      case 'text': {
        const textStyle = {
          fontSize: (obj.fontSize || 16) * scale,
          fontFamily: obj.fontFamily || 'Arial',
          color: obj.fill?.color || '#000',
          fontWeight: obj.bold ? 'bold' : 'normal',
          fontStyle: obj.italic ? 'italic' : 'normal',
          textDecoration: obj.underline ? 'underline' : 'none',
          writingMode: obj.verticalText ? 'vertical-rl' : 'horizontal-tb',
          textAlign: obj.align || 'left',
          lineHeight: obj.lineSpacing || 1.2,
          padding: '2px 4px',
          borderRadius: '2px',
          whiteSpace: obj.isParagraph ? 'normal' : 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'flex',
          alignItems: 'center',
          justifyContent: obj.align === 'center' ? 'center' : obj.align === 'right' ? 'flex-end' : 'flex-start',
          flexDirection: obj.verticalText ? 'column' : 'row',
        }

        // For text the fill is the *glyph colour*, not a box fill: the
        // container must stay transparent or the label renders as a solid
        // block with invisible lettering.
        const textBase = { ...baseStyle, background: 'transparent', border: 'none' }

        if (obj.textOnArc) {
          const radius = (obj.arcRadius || 80) * scale
          const startAngle = -((obj.arcAngle || 180) / 2) * Math.PI / 180
          const endAngle = ((obj.arcAngle || 180) / 2) * Math.PI / 180
          const text = obj.text || ''
          const angleStep = (endAngle - startAngle) / Math.max(text.length - 1, 1)
          const chars = text.split('').map((char, i) => {
            const angle = startAngle + i * angleStep
            return {
              char,
              x: 50 + Math.cos(angle) * (radius / (obj.width * scale) * 100),
              y: 50 + Math.sin(angle) * (radius / (obj.height * scale) * 100),
              rotation: angle * 180 / Math.PI + 90,
            }
          })
          return (
            <div style={{ position: 'absolute', left, top, width, height }}>
              <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                {chars.map((c, i) => (
                  <text
                    key={i}
                    x={`${c.x}%`}
                    y={`${c.y}%`}
                    fill={obj.fill?.color || '#000'}
                    fontSize={(obj.fontSize || 16) * scale}
                    fontFamily={obj.fontFamily || 'Arial'}
                    transform={`rotate(${c.rotation} ${c.x}% ${c.y}%)`}
                    textAnchor="middle"
                  >
                    {c.char}
                  </text>
                ))}
              </svg>
            </div>
          )
        }

        if (obj.textOnPath) {
          return (
            <div style={{ position: 'absolute', left, top, width, height }}>
              <svg width={width} height={height}>
                <defs>
                  <path id={`textPath-${obj.id}`} d={obj.pathData || 'M0,50 Q50,0 100,50'} fill="none" />
                </defs>
                <text
                  fill={obj.fill?.color || '#000'}
                  fontSize={(obj.fontSize || 16) * scale}
                  fontFamily={obj.fontFamily || 'Arial'}
                  fontWeight={obj.bold ? 'bold' : 'normal'}
                  fontStyle={obj.italic ? 'italic' : 'normal'}
                >
                  <textPath href={`#textPath-${obj.id}`} startOffset="50%" textAnchor="middle">
                    {obj.text || ''}
                  </textPath>
                </text>
              </svg>
            </div>
          )
        }

        if (obj.isParagraph) {
          return (
            <div style={{ ...textBase, overflow: 'hidden' }}>
              <div style={{
                columns: obj.paragraphSettings?.columns || 1,
                columnGap: `${(obj.paragraphSettings?.gutter || 0.5) * scale}px`,
                fontSize: (obj.fontSize || 16) * scale,
                fontFamily: obj.fontFamily || 'Arial',
                color: obj.fill?.color || '#000',
                textAlign: obj.align || 'left',
                lineHeight: obj.lineSpacing || 1.2,
                padding: '4px',
                columnFill: 'auto',
              }}>
                {obj.text}
              </div>
            </div>
          )
        }

        return (
          <div style={{ ...textBase, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={textStyle}>
              {obj.text}
            </span>
          </div>
        )
      }

      case 'image':
        if (obj.src) {
          return (
            <img
              src={obj.src}
              alt={obj.name || 'imported'}
              draggable={false}
              style={{
                position: 'absolute',
                left, top, width, height,
                transform: `rotate(${obj.rotation || 0}deg)`,
                opacity: (obj.opacity || 100) / 100,
                objectFit: obj.preserveAspectRatio === 'meet' ? 'contain' : 'fill',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />
          )
        }
        return (
          <div style={{ ...baseStyle, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 12, color: '#888', padding: 4, textAlign: 'center' }}>
              Drop an image here<br />(File &gt; Import)
            </span>
          </div>
        )

      case 'clone':
      case 'cloneArray':
      case 'cloneCircle':
        return <div style={{ ...baseStyle, border: `2px dashed ${obj.stroke?.color || '#999'}`, background: `${obj.fill?.color || '#fff'}44` }} />

      case 'dimension':
        return (
          <div style={{ position: 'absolute', left, top, width, height }}>
            <svg width={width} height={height}>
              <line x1={width / 2} y1="0" x2={width / 2} y2={height} stroke={obj.color || '#000'} strokeWidth={1} strokeDasharray="4,2" />
              <text x={width / 2} y={height / 2} textAnchor="middle" fill={obj.color || '#000'} fontSize={10 * scale}>
                {obj.value}{obj.units || 'mm'}
              </text>
            </svg>
          </div>
        )

      case 'path':
        return (
          <div style={{
            position: 'absolute',
            left, top, width, height,
            transform: `rotate(${obj.rotation || 0}deg)`,
            opacity: (obj.opacity || 100) / 100,
          }}>
            <svg
              width={width}
              height={height}
              viewBox={`0 0 ${obj.pathWidth || obj.width} ${obj.pathHeight || obj.height}`}
              preserveAspectRatio="none"
            >
              <defs>{svgF.defs}</defs>
              <path
                d={obj.pathData}
                fill={svgF.fill}
                fillRule="evenodd"
                stroke={obj.stroke?.width > 0 ? obj.stroke.color : 'none'}
                strokeWidth={obj.stroke?.width || 0}
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )

      case 'contour':
        return <div style={{ ...baseStyle, border: `2px dashed #FF0000`, background: 'rgba(255,0,0,0.05)' }} />

      default:
        return <div style={baseStyle} />
    }
  }

  // ------------------------------------------------------------------
  // Live effects + warp rendering.
  // Effects are layered copies of the same shape (extrusion stacks,
  // shadows, glows, mirrored reflections). Warp slices the object into
  // vertical strips and displaces/scales each strip, which is a genuine
  // (if discrete) implementation of the classic warp mappings.
  // ------------------------------------------------------------------

  const shiftColor = (hex, factor) => {
    if (!hex || typeof hex !== 'string' || hex[0] !== '#' || hex.length < 7) return hex
    const n = parseInt(hex.slice(1, 7), 16)
    const r = Math.min(255, Math.round(((n >> 16) & 255) * factor))
    const g = Math.min(255, Math.round(((n >> 8) & 255) * factor))
    const b = Math.min(255, Math.round((n & 255) * factor))
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
  }

  const renderEffectLayers = (obj) => {
    const e = obj.effect
    if (!e || !Object.keys(e).length) return null
    const s = state.zoom || 1
    const layers = []

    // --- 3D extrusion / Logo 3D -------------------------------------
    const d3 = e.threeD || e.logo3D
    if (d3) {
      const depth = Math.max(1, Math.min(60, Math.round(d3.depth || 20)))
      const angle = ((d3.angle != null ? d3.angle : 45) * Math.PI) / 180
      const ux = Math.cos(angle)
      const uy = Math.sin(angle)
      const baseFill = obj.fill?.color || '#888888'
      const lightFromTopLeft = (d3.lighting || 'top-left').indexOf('top') === 0
      for (let i = depth; i >= 1; i--) {
        const t = i / depth
        // closer to the original body = lighter, far edge = darkest
        const factor = lightFromTopLeft ? 0.35 + 0.5 * (1 - t) : 0.25 + 0.55 * (1 - t)
        layers.push({ key: `x3d-${i}`, color: shiftColor(baseFill, factor), dx: (ux * i) / s, dy: (uy * i) / s })
      }
    }

    // --- Block / drop / soft shadows --------------------------------
    const shadow = e.blockShadow || e.dropShadow || e.softShadow
    if (shadow) {
      const blur = e.softShadow ? (e.softShadow.blur || 0)
        : e.dropShadow ? (e.dropShadow.blur || 0)
        : (e.blockShadow?.blur || 0)
      layers.push({
        key: 'shadow',
        color: shadow.color || '#000000',
        dx: (shadow.offsetX || 0) / s,
        dy: (shadow.offsetY || 0) / s,
        blur,
        opacity: 1,
      })
    }

    // --- Multi-outline / Multi-inline -------------------------------
    const multi = e.multiOutline || e.multiInline
    if (multi) {
      const count = Math.max(1, Math.min(12, multi.count || 3))
      for (let i = count; i >= 1; i--) {
        layers.push({ key: `mo-${i}`, color: multi.color || '#000', outlineWidth: (multi.spacing || 2) * i * 2, noFill: true })
      }
    }

    // --- Outline (stroke the contour) -------------------------------
    if (e.outline) {
      layers.push({ key: 'outline', color: e.outline.color || '#000', outlineWidth: (e.outline.width || 2) * 2 })
    }

    // --- Inner outline (stroked copy clipped to the shape box) ------
    if (e.innerOutline) {
      layers.push({ key: 'innerOutline', color: e.innerOutline.color || '#000', outlineWidth: (e.innerOutline.width || 2) * 2, clip: true })
    }

    // --- Glow (blurred, coloured silhouette) ------------------------
    if (e.glow) {
      const r = e.glow.radius || 10
      const passes = Math.max(1, Math.round((e.glow.intensity || 50) / 25))
      layers.push({
        key: 'glow',
        color: e.glow.color || '#ff8000',
        glowRadius: r,
        glowPasses: passes,
        coloredSilhouette: true,
      })
    }

    // --- Tint map (colour overlay, blended) -------------------------
    if (e.tintMap) {
      layers.push({ key: 'tint', color: e.tintMap.color || '#ff0000', blend: 'multiply', opacity: (e.tintMap.intensity || 50) / 100, clip: true })
    }

    // --- Fire (gradient overlay, blended) ---------------------------
    if (e.fire) {
      layers.push({ key: 'fire', gradient: [e.fire.color1 || '#ff0000', e.fire.color2 || '#ffff00'], blend: 'overlay', opacity: 0.75, clip: true })
    }

    // --- Reflect (mirrored copy below) ------------------------------
    if (e.reflect) {
      layers.push({
        key: 'reflect',
        color: obj.fill?.color || '#888888',
        reflect: true,
        opacity: Math.max(0.05, (e.reflect.opacity || 50) / 100) * 0.85,
        blur: (e.reflect.blur || 0),
      })
    }

    if (!layers.length) return null

    const boxStyle = (layer) => ({
      position: 'absolute',
      left: obj.x * s + state.panX * s,
      top: obj.y * s + state.panY * s,
      width: Math.abs((obj.width || 0) * s),
      height: Math.abs((obj.height || 0) * s),
      overflow: layer.clip ? 'hidden' : 'visible',
      pointerEvents: 'none',
      opacity: layer.opacity != null ? layer.opacity : 1,
      mixBlendMode: layer.blend,
      filter: layer.glowRadius
        ? Array.from({ length: layer.glowPasses || 1 }, () => `drop-shadow(0 0 ${layer.glowRadius}px ${layer.color})`).join(' ')
        : layer.blur ? `blur(${layer.blur}px)` : undefined,
      zIndex: 0,
    })

    return layers.map(layer => {
      let copy = obj
      let atY = 0
      if (layer.reflect) {
        copy = { ...obj, scaleY: -(obj.scaleY || 1) }
        atY = (obj.height || 0) * s
      } else if (layer.outlineWidth) {
        copy = { ...obj, fill: layer.noFill ? { type: 'none' } : obj.fill, stroke: { ...(obj.stroke || {}), color: layer.color, width: layer.outlineWidth } }
      } else if (layer.coloredSilhouette) {
        // keep the shape's own look; the filter produces the glow
      } else if (layer.gradient) {
        copy = { ...obj, fill: { type: 'gradient', color: layer.gradient[0], color2: layer.gradient[1] }, stroke: { width: 0 } }
      } else {
        copy = { ...obj, fill: { type: 'solid', color: layer.color }, stroke: { width: 0 } }
      }
      return (
        <div key={layer.key} style={boxStyle(layer)}>
          {renderShape(copy, { left: layer.dx ? layer.dx * s : 0, top: atY + (layer.dy ? layer.dy * s : 0) })}
        </div>
      )
    })
  }

  // Continuous warp rendering.
  //
  // Vector art is deformed by pushing its own geometry through a smooth
  // analytic map, so curves stay crisp. Text and bitmap art are resampled
  // per pixel through the inverse of the same map. Neither path slices the
  // object into strips.
  const renderWarped = (obj) => {
    if (!obj.warpType) return renderShape(obj)
    const s = state.zoom || 1

    // Raster content (text, bitmaps) -> per-pixel continuous resample.
    if (obj.type === 'text' || obj.type === 'image') {
      return (
        <RasterWarp
          obj={obj}
          scale={s}
          panX={state.panX}
          panY={state.panY}
          pad={0.4}
          fallback={() => renderShape({ ...obj, warpType: undefined, warpIntensity: undefined })}
        />
      )
    }

    // Vector content -> warp the real outline.
    let subs = []
    try {
      subs = objectToSegments(obj)
    } catch {
      subs = []
    }
    if (!subs.length) return renderShape(obj)

    const b = subpathsBounds(subs)
    if (!b) return renderShape(obj)

    const isStrokeOnly = ['line', 'curve', 'freehand', 'pen', 'spiral'].includes(obj.type) || obj.fill?.type === 'none'
    const warped = warpSubpaths(subs, b, obj.warpType, obj.warpIntensity || 50, 0.02)
    if (!warped.length) return renderShape(obj)

    const d = warped
      .map(sp => sp.points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(3)},${y.toFixed(3)}`).join(' ') + (sp.closed ? ' Z' : ''))
      .join(' ')

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const sp of warped) {
      for (const [x, y] of sp.points) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
    if (!isFinite(minX)) return renderShape(obj)
    const vw = Math.max(0.01, maxX - minX)
    const vh = Math.max(0.01, maxY - minY)

    const fillId = `cv-warp-fill-${String(obj.id || '').replace(/[^a-zA-Z0-9]/g, '')}`
    const svgF = svgFill(obj.fill, fillId)

    return (
      <div
        style={{
          position: 'absolute',
          left: minX * s + state.panX * s,
          top: minY * s + state.panY * s,
          width: vw * s,
          height: vh * s,
          opacity: (obj.opacity || 100) / 100,
          pointerEvents: 'none',
        }}
      >
        <svg width={vw * s} height={vh * s} viewBox={`${minX} ${minY} ${vw} ${vh}`} style={{ overflow: 'visible' }}>
          <defs>{svgF.defs}</defs>
          <path
            d={d}
            fill={isStrokeOnly ? 'none' : svgF.fill}
            fillRule="evenodd"
            stroke={obj.stroke?.width > 0 ? obj.stroke.color : (isStrokeOnly ? (obj.stroke?.color || '#000') : 'none')}
            strokeWidth={obj.stroke?.width || (isStrokeOnly ? 1 : 0)}
            strokeLinejoin="round"
            strokeLinecap={obj.penStyle?.endCap || 'round'}
          />
        </svg>
      </div>
    )
  }

  const renderObject = (obj) => (
    <>
      {renderEffectLayers(obj)}
      {renderWarped(obj)}
    </>
  )

  const renderNodeEditOverlay = () => {
    if (!nodeEditMode || !state.selectedObject) return null
    const obj = state.selectedObject
    const scale = state.zoom
    const left = obj.x * scale + state.panX * scale
    const top = obj.y * scale + state.panY * scale
    const width = obj.width * scale
    const height = obj.height * scale

    // Real node editing: for vector paths, drag the actual vertices.
    if (obj.type === 'path' && obj.pathData) {
      const sx = (obj.pathWidth || obj.width) / (obj.width || 1)
      const sy = (obj.pathHeight || obj.height) / (obj.height || 1)
      const closed = /z/i.test(obj.pathData)
      const subpaths = parsePathData(obj.pathData)
      const pts = []
      subpaths.forEach((sp, si) => sp.forEach(([px, py], pi) => {
        pts.push({ si, pi, gx: obj.x + px / sx, gy: obj.y + py / sy })
      }))

      return (
        <div className="node-edit-overlay">
          {pts.map(pt => (
            <div
              key={`${pt.si}-${pt.pi}`}
              className="node-handle node-point"
              title="Drag to move this node"
              style={{
                left: pt.gx * scale + state.panX * scale - 3,
                top: pt.gy * scale + state.panY * scale - 3,
                width: 7,
                height: 7,
                borderRadius: 0,
                background: '#ffd166',
                border: '1px solid #7a5c00',
                pointerEvents: 'auto',
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
                const startX = e.clientX
                const startY = e.clientY
                const origD = obj.pathData
                const onMove = (moveEvent) => {
                  const dx = (moveEvent.clientX - startX) / scale
                  const dy = (moveEvent.clientY - startY) / scale
                  const subs = parsePathData(origD)
                  const sub = subs[pt.si]
                  if (!sub || !sub[pt.pi]) return
                  sub[pt.pi] = [sub[pt.pi][0] + dx * sx, sub[pt.pi][1] + dy * sy]
                  const d = subs
                    .map(sp => sp.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${+x.toFixed(3)},${+y.toFixed(3)}`).join(' ') + (closed ? ' Z' : ''))
                    .join(' ')
                  dispatch({ type: 'UPDATE_OBJECT', payload: { id: obj.id, updates: { pathData: d, rings: undefined } } })
                }
                const onUp = () => {
                  window.removeEventListener('mousemove', onMove)
                  window.removeEventListener('mouseup', onUp)
                }
                window.addEventListener('mousemove', onMove)
                window.addEventListener('mouseup', onUp)
              }}
            />
          ))}
        </div>
      )
    }

    const nodes = [
      { x: left, y: top, id: 'tl' },
      { x: left + width / 2, y: top, id: 'tm' },
      { x: left + width, y: top, id: 'tr' },
      { x: left, y: top + height / 2, id: 'ml' },
      { x: left + width, y: top + height / 2, id: 'mr' },
      { x: left, y: top + height, id: 'bl' },
      { x: left + width / 2, y: top + height, id: 'bm' },
      { x: left + width, y: top + height, id: 'br' },
    ]

    return (
      <div className="node-edit-overlay">
        {nodes.map(node => (
          <div
            key={node.id}
            className="node-handle"
            style={{ left: node.x - 4, top: node.y - 4 }}
            onMouseDown={(e) => {
              e.stopPropagation()
              const startX = e.clientX
              const startY = e.clientY
              const origX = obj.x
              const origY = obj.y
              const origW = obj.width
              const origH = obj.height

              const onMove = (moveEvent) => {
                const dx = (moveEvent.clientX - startX) / scale
                const dy = (moveEvent.clientY - startY) / scale
                let newX = origX, newY = origY, newW = origW, newH = origH

                if (node.id.includes('l')) { newX = origX + dx; newW = origW - dx }
                if (node.id.includes('r')) { newW = origW + dx }
                if (node.id.includes('t')) { newY = origY + dy; newH = origH - dy }
                if (node.id.includes('b')) { newH = origH + dy }

                dispatch({ type: 'UPDATE_OBJECT', payload: { id: obj.id, updates: { x: newX, y: newY, width: newW, height: newH } } })
              }

              const onUp = () => {
                window.removeEventListener('mousemove', onMove)
                window.removeEventListener('mouseup', onUp)
              }

              window.addEventListener('mousemove', onMove)
              window.addEventListener('mouseup', onUp)
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="canvas-container" ref={containerRef}>
      {state.showRulers && (
        <>
          <div className="ruler ruler-horizontal">
            {Array.from({ length: 100 }, (_, i) => (
              <div key={i} className="ruler-tick" style={{ left: pageOrigin.x - 20 + i * 50 * state.zoom }}>
                <span className="ruler-label">{i * 50}</span>
              </div>
            ))}
          </div>
          <div className="ruler ruler-vertical">
            {Array.from({ length: 100 }, (_, i) => (
              <div key={i} className="ruler-tick" style={{ top: pageOrigin.y - 20 + i * 50 * state.zoom }}>
                <span className="ruler-label">{i * 50}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="canvas-viewport">
        <div className="page-boundary" ref={pageRef} style={{
          width: (state.pages[state.activePage]?.width || 210) * state.zoom,
          height: (state.pages[state.activePage]?.height || 297) * state.zoom,
        }}>
          {state.showGrid && (
            <div className="grid-overlay" style={{
              backgroundSize: `${state.gridSize * state.zoom}px ${state.gridSize * state.zoom}px`,
            }} />
          )}
          {state.showGuides && (
            <>
              <div className="guide guide-horizontal" style={{ top: '50%' }} />
              <div className="guide guide-vertical" style={{ left: '50%' }} />
            </>
          )}
          {state.objects.map(obj => (
            <React.Fragment key={obj.id}>
              {renderObject(obj)}
              {state.selectedObjects.includes(obj.id) && (
                <div className="selection-box" style={{
                  position: 'absolute',
                  left: obj.x * state.zoom + state.panX * state.zoom - 2,
                  top: obj.y * state.zoom + state.panY * state.zoom - 2,
                  width: obj.width * state.zoom + 4,
                  height: obj.height * state.zoom + 4,
                  border: '2px solid var(--selection)',
                  pointerEvents: 'none',
                }}>
                  <div className="handle handle-tl" />
                  <div className="handle handle-tr" />
                  <div className="handle handle-bl" />
                  <div className="handle handle-br" />
                </div>
              )}
            </React.Fragment>
          ))}
          <CropMarks />
          {renderNodeEditOverlay()}
          {isMarquee && (
            <div className="marquee-box" style={{
              left: Math.min(marqueeStart.x, marqueeEnd.x) * state.zoom + state.panX * state.zoom,
              top: Math.min(marqueeStart.y, marqueeEnd.y) * state.zoom + state.panY * state.zoom,
              width: Math.abs(marqueeEnd.x - marqueeStart.x) * state.zoom,
              height: Math.abs(marqueeEnd.y - marqueeStart.y) * state.zoom,
            }} />
          )}
          {isDrawing && (
            <div className="drawing-preview" style={{
              left: Math.min(drawStart.x, currentPos.x) * state.zoom + state.panX * state.zoom,
              top: Math.min(drawStart.y, currentPos.y) * state.zoom + state.panY * state.zoom,
              width: Math.abs(currentPos.x - drawStart.x) * state.zoom,
              height: Math.abs(currentPos.y - drawStart.y) * state.zoom,
            }} />
          )}
          {isKnifing && (
            <svg className="tool-overlay" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <line
                x1={knifeStart.x * state.zoom + state.panX * state.zoom}
                y1={knifeStart.y * state.zoom + state.panY * state.zoom}
                x2={knifeEnd.x * state.zoom + state.panX * state.zoom}
                y2={knifeEnd.y * state.zoom + state.panY * state.zoom}
                stroke="#ff4444"
                strokeWidth="1.5"
                strokeDasharray="6,3"
              />
            </svg>
          )}
          {isContouring && (
            <svg className="tool-overlay" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <line
                x1={contourStart.x * state.zoom + state.panX * state.zoom}
                y1={contourStart.y * state.zoom + state.panY * state.zoom}
                x2={contourEnd.x * state.zoom + state.panX * state.zoom}
                y2={contourEnd.y * state.zoom + state.panY * state.zoom}
                stroke="#44aaff"
                strokeWidth="1.5"
                strokeDasharray="4,3"
              />
            </svg>
          )}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        id="main-canvas"
        className="main-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      />
    </div>
  )
})

Canvas.displayName = 'Canvas'
export default Canvas
