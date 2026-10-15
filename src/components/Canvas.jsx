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
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragObjStart, setDragObjStart] = useState({ x: 0, y: 0 })
  const [nodeEditMode, setNodeEditMode] = useState(false)

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
        setIsDragging(true)
        setDragStart(coords)
        setDragObjStart({ x: clickedObj.x, y: clickedObj.y })
      } else {
        dispatch({ type: 'UPDATE_PROPERTY', payload: { property: 'selectedObject', value: null } })
      }
      return
    }

    if (state.activeTool === 'node') {
      const clickedObj = [...state.objects].reverse().find(obj => {
        return coords.x >= obj.x && coords.x <= obj.x + obj.width &&
               coords.y >= obj.y && coords.y <= obj.y + obj.height
      })
      if (clickedObj) {
        dispatch({ type: 'UPDATE_PROPERTY', payload: { property: 'selectedObject', value: clickedObj } })
        setNodeEditMode(true)
      }
      return
    }

    const drawableTools = ['rect', 'ellipse', 'polygon', 'star', 'spiral', 'arrow', 'chaos', 'line', 'curve', 'freehand', 'pen', 'text', 'textArc', 'textPath', 'textVert', 'textBox', 'paragraph', 'image', 'clone', 'cloneArray', 'cloneCircle', 'dimension', 'contour']
    if (drawableTools.includes(state.activeTool)) {
      setIsDrawing(true)
      setDrawStart(coords)
      setCurrentPos(coords)
    }
  }, [state.activeTool, state.objects, state.zoom, state.panX, state.panY, getCanvasCoords, dispatch])

  const handleMouseMove = useCallback((e) => {
    const coords = getCanvasCoords(e)
    actions.setCursorPos(coords)

    if (isPanning) return
    if (isDragging && state.selectedObject) {
      const dx = coords.x - dragStart.x
      const dy = coords.y - dragStart.y
      dispatch({ type: 'UPDATE_OBJECT', payload: { id: state.selectedObject.id, updates: { x: dragObjStart.x + dx, y: dragObjStart.y + dy } } })
      return
    }
    if (isDrawing) setCurrentPos(coords)
  }, [isPanning, isDrawing, isDragging, dragStart, dragObjStart, state.selectedObject, getCanvasCoords, actions, dispatch])

  const handleMouseUp = useCallback((e) => {
    if (isPanning) { setIsPanning(false); return }
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
  }, [isDrawing, isDragging, isPanning, drawStart, state.activeTool, state.currentFill, state.currentStroke, state.textSettings, getCanvasCoords, actions])

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

  const renderShape = (obj) => {
    const scale = state.zoom
    const left = obj.x * scale + state.panX * scale
    const top = obj.y * scale + state.panY * scale
    const width = obj.width * scale
    const height = obj.height * scale

    const fillColor = obj.fill?.type === 'solid' ? obj.fill.color
      : obj.fill?.type === 'gradient' ? `linear-gradient(135deg, ${obj.fill.color}, ${obj.fill.color}88)`
      : 'transparent'

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
            <polygon
              points={Array.from({ length: pts }, (_, i) => {
                const angle = (i / pts) * Math.PI * 2 - Math.PI / 2
                return `${50 + Math.cos(angle) * 50},${50 + Math.sin(angle) * 50}`
              }).join(' ')}
              fill={fillColor}
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
            <polygon
              points={Array.from({ length: starPts * 2 }, (_, i) => {
                const angle = (i / (starPts * 2)) * Math.PI * 2 - Math.PI / 2
                const r = i % 2 === 0 ? 50 : innerR
                return `${50 + Math.cos(angle) * r},${50 + Math.sin(angle) * r}`
              }).join(' ')}
              fill={fillColor}
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
            <path
              d={`M${50 + (obj.seed || 0.5) * 30},${50 - (obj.seed || 0.5) * 30} L${50 - 40},${50 + (obj.seed || 0.5) * 20} L${50 + (obj.seed || 0.5) * 20},${50 + 40} Z`}
              fill={fillColor}
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
            <div style={{ ...baseStyle, overflow: 'hidden' }}>
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
          <div style={{ ...baseStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={textStyle}>
              {obj.text}
            </span>
          </div>
        )
      }

      case 'image':
        return (
          <div style={{ ...baseStyle, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 24 }}>🖼</span>
            {obj.isVectorized && <span style={{ position: 'absolute', top: 2, right: 2, fontSize: 10, color: '#00aaff' }}>◎</span>}
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

      case 'contour':
        return <div style={{ ...baseStyle, border: `2px dashed #FF0000`, background: 'rgba(255,0,0,0.05)' }} />

      default:
        return <div style={baseStyle} />
    }
  }

  const renderNodeEditOverlay = () => {
    if (!nodeEditMode || !state.selectedObject) return null
    const obj = state.selectedObject
    const scale = state.zoom
    const left = obj.x * scale + state.panX * scale
    const top = obj.y * scale + state.panY * scale
    const width = obj.width * scale
    const height = obj.height * scale

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
              <div key={i} className="ruler-tick" style={{ left: i * 50 * state.zoom }}>
                <span className="ruler-label">{i * 50}</span>
              </div>
            ))}
          </div>
          <div className="ruler ruler-vertical">
            {Array.from({ length: 100 }, (_, i) => (
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
          {state.showGuides && (
            <>
              <div className="guide guide-horizontal" style={{ top: '50%' }} />
              <div className="guide guide-vertical" style={{ left: '50%' }} />
            </>
          )}
          {state.objects.map(obj => (
            <React.Fragment key={obj.id}>
              {renderShape(obj)}
              {state.selectedObjects.includes(obj.id) && (
                <div className="selection-box" style={{
                  position: 'absolute',
                  left: obj.x * state.zoom + state.panX * scale - 2,
                  top: obj.y * state.zoom + state.panY * scale - 2,
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
          {renderNodeEditOverlay()}
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
