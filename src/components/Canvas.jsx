import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useApp } from '../context/AppContext'
import './Canvas.css'

const Canvas = forwardRef((props, ref) => {
  const { state, dispatch, actions } = useApp()
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  const getCanvasCoords = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
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
        dispatch({ type: 'UPDATE_PROPERTY', payload: { property: 'selectedObject', value: clickedObj } })
      }
      return
    }

    if (['rect', 'ellipse', 'polygon', 'star', 'line', 'text'].includes(state.activeTool)) {
      setIsDrawing(true)
      setDrawStart(coords)
      setCurrentPos(coords)
    }
  }, [state.activeTool, state.objects, state.zoom, state.panX, state.panY, getCanvasCoords, dispatch])

  const handleMouseMove = useCallback((e) => {
    const coords = getCanvasCoords(e)
    actions.setCursorPos(coords)

    if (isPanning) {
      dispatch({
        type: 'SET_ZOOM',
        payload: state.zoom,
      })
      return
    }

    if (isDrawing) {
      setCurrentPos(coords)
    }
  }, [isPanning, isDrawing, getCanvasCoords, actions, dispatch, state.zoom])

  const handleMouseUp = useCallback((e) => {
    if (isPanning) {
      setIsPanning(false)
      return
    }

    if (isDrawing) {
      const coords = getCanvasCoords(e)
      const x = Math.min(drawStart.x, coords.x)
      const y = Math.min(drawStart.y, coords.y)
      const width = Math.abs(coords.x - drawStart.x)
      const height = Math.abs(coords.y - drawStart.y)

      if (width > 5 && height > 5) {
        const toolMap = {
          rect: { type: 'rect', width, height },
          ellipse: { type: 'ellipse', width, height },
          polygon: { type: 'polygon', width, height },
          star: { type: 'star', width, height },
          line: { type: 'line', width, height },
          text: { type: 'text', width: Math.max(width, 100), height: Math.max(height, 20), text: 'Text' },
        }

        const objConfig = toolMap[state.activeTool]
        if (objConfig) {
          actions.addObject({
            ...objConfig,
            x, y,
            fill: { ...state.currentFill },
            stroke: { ...state.currentStroke },
          })
        }
      }
      setIsDrawing(false)
    }
  }, [isDrawing, isPanning, drawStart, state.activeTool, state.currentFill, state.currentStroke, getCanvasCoords, actions])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    if (e.ctrlKey) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      actions.setZoom(state.zoom * delta)
    } else {
      dispatch({
        type: 'SET_ZOOM',
        payload: state.zoom,
      })
    }
  }, [state.zoom, actions, dispatch])

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

  const renderObject = (obj) => {
    const isSelected = state.selectedObjects.includes(obj.id)
    const style = {
      position: 'absolute',
      left: obj.x * state.zoom + state.panX * state.zoom,
      top: obj.y * state.zoom + state.panY * state.zoom,
      width: obj.width * state.zoom,
      height: obj.height * state.zoom,
      transform: `rotate(${obj.rotation || 0}deg) scaleX(${obj.scaleX || 1}) scaleY(${obj.scaleY || 1})`,
      opacity: (obj.opacity || 100) / 100,
    }

    const fillStyle = obj.fill?.type === 'solid'
      ? { background: obj.fill.color }
      : obj.fill?.type === 'gradient'
      ? { background: `linear-gradient(135deg, ${obj.fill.color}, ${obj.fill.color}88)` }
      : { background: 'transparent' }

    const strokeStyle = obj.stroke?.width > 0
      ? { border: `${obj.stroke.width}px solid ${obj.stroke.color}` }
      : {}

    return (
      <div
        key={obj.id}
        className={`canvas-object ${isSelected ? 'selected' : ''}`}
        style={{ ...style, ...fillStyle, ...strokeStyle }}
        data-id={obj.id}
      >
        {obj.type === 'text' && (
          <span style={{
            fontSize: (obj.fontSize || 16) * state.zoom,
            fontFamily: obj.fontFamily || 'Arial',
            color: obj.fill?.color || '#000',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {obj.text}
          </span>
        )}
        {isSelected && (
          <>
            <div className="handle handle-tl" />
            <div className="handle handle-tr" />
            <div className="handle handle-bl" />
            <div className="handle handle-br" />
          </>
        )}
      </div>
    )
  }

  return (
    <div className="canvas-container" ref={containerRef}>
      {state.showRulers && (
        <>
          <div className="ruler ruler-horizontal">
            {Array.from({ length: 50 }, (_, i) => (
              <div key={i} className="ruler-tick" style={{ left: i * 50 * state.zoom }}>
                <span className="ruler-label">{i * 50}</span>
              </div>
            ))}
          </div>
          <div className="ruler ruler-vertical">
            {Array.from({ length: 50 }, (_, i) => (
              <div key={i} className="ruler-tick" style={{ top: i * 50 * state.zoom }}>
                <span className="ruler-label">{i * 50}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="canvas-viewport">
        <div className="page-boundary" style={{
          width: (state.pages[state.activePage]?.width || 210) * state.zoom,
          height: (state.pages[state.activePage]?.height || 297) * state.zoom,
        }}>
          {state.showGrid && (
            <div className="grid-overlay" style={{
              backgroundSize: `${state.gridSize * state.zoom}px ${state.gridSize * state.zoom}px`,
            }} />
          )}
          {state.objects.map(renderObject)}
          {isDrawing && (
            <div className="drawing-preview" style={{
              left: Math.min(drawStart.x, currentPos.x) * state.zoom + state.panX * state.zoom,
              top: Math.min(drawStart.y, currentPos.y) * state.zoom + state.panY * state.zoom,
              width: Math.abs(currentPos.x - drawStart.x) * state.zoom,
              height: Math.abs(currentPos.y - drawStart.y) * state.zoom,
            }} />
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
