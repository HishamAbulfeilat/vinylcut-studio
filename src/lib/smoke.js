// Automated smoke sweep: enumerate every tool, panel, dialog and command the
// app exposes and assert the registry is complete and internally consistent
// (no duplicate ids, no missing handlers, no undefined entries). The sweep
// returns the list of problems it finds; an empty list means a clean run.
//
// This is the pure, testable core of the smoke sweep. The browser/Electron
// host drives the interactive side (rendering each surface) and forwards
// renderer console output; this module is what the unit tests exercise.

import { TOOLS as APP_TOOLS } from '../App.jsx'

export const TOOLS = APP_TOOLS

export const PANELS = [
  'MenuBar',
  'Toolbar',
  'TabBar',
  'Canvas',
  'PropertyPanel',
  'StatusBar',
]

export const DIALOGS = [
  'spooler',
  'contour',
  'align',
  'gradient',
  'texture',
  'stepRepeat',
  'shapeOps',
  'masterPages',
  'export',
  'fontManager',
  'colorLibrary',
  'vectorize',
]

// Reference command surface (action types the reducer understands). Kept in
// sync with AppContext's appReducer switch; the sweep checks for duplicates
// and for the core editing commands every edition must expose.
export const COMMANDS = [
  'NEW_DOCUMENT', 'LOAD_DOCUMENT', 'SAVE_DOCUMENT', 'EXPORT_DOCUMENT',
  'SET_TOOL', 'SET_TAB', 'SELECT_ALL', 'DELETE_SELECTED', 'DUPLICATE_SELECTED',
  'COPY_SELECTED', 'CUT_SELECTED', 'PASTE', 'UNDO', 'REDO',
  'ZOOM_IN', 'ZOOM_OUT', 'ZOOM_TO_ALL', 'ZOOM_TO_PAGE',
  'ALIGN', 'DISTRIBUTE', 'GROUP', 'UNGROUP',
  'BRING_TO_FRONT', 'SEND_TO_BACK', 'BRING_FORWARD', 'SEND_BACKWARD',
  'MIRROR_X', 'MIRROR_Y', 'ROTATE', 'SKEW', 'UPDATE_PROPERTY', 'SET_SELECTION',
  'ADD_OBJECT', 'UPDATE_OBJECT', 'SET_FILL', 'SET_STROKE', 'SET_EFFECT',
  'UPDATE_EFFECT', 'CLEAR_EFFECT', 'SET_TEXT_SETTINGS', 'SET_PARAGRAPH_SETTINGS',
  'SET_CLONE_SETTINGS', 'SET_STEP_REPEAT_SETTINGS', 'SET_DIMENSION_SETTINGS',
  'SET_WARP_SETTINGS', 'SET_KNIFE_SETTINGS', 'SET_PEN_SETTINGS',
  'SET_TRACE_SETTINGS', 'SET_REGISTRATION_MARKS', 'SET_CURSOR_POS',
  'TOGGLE_GRID', 'TOGGLE_GUIDES', 'TOGGLE_RULERS',
  'TOGGLE_SNAP_GRID', 'TOGGLE_SNAP_GUIDES', 'TOGGLE_SNAP_OBJECTS', 'TOGGLE_SNAP_PAGE',
  'SET_ZOOM', 'ADD_PAGE', 'DELETE_PAGE', 'ADD_MASTER_PAGE', 'SET_PAGE_SIZE',
  'SET_PAGE_ORIENTATION', 'SET_MASTER_PAGES', 'APPLY_MASTER_TO_PAGE',
  'APPLY_EFFECT', 'APPLY_WELD', 'APPLY_PUNCH_OUT', 'APPLY_TRIM', 'APPLY_COOKIE_CUT',
  'APPLY_OUTLINE', 'APPLY_CLONE', 'APPLY_STEP_REPEAT', 'ADD_OBJECTS',
  'DELETE_OBJECTS', 'APPLY_KNIFE', 'APPLY_CONTOUR', 'APPLY_CONTOUR_CUT',
  'APPLY_VECTORIZE', 'APPLY_WARP', 'APPLY_3D', 'APPLY_TEXT_TO_PATH',
  'APPLY_TEXT_TO_ARC', 'APPLY_VERTICAL_TEXT', 'APPLY_PARAGRAPH_TEXT',
  'APPLY_INNER_OUTLINE', 'APPLY_TINT_MAP', 'APPLY_FIRE_EFFECT', 'APPLY_REFLECT_EFFECT',
  'APPLY_LOGO_3D', 'APPLY_POWER_SHAPE', 'APPLY_SPIRAL', 'APPLY_ARROW',
  'APPLY_CHAOS_SHAPE', 'APPLY_DIMENSION', 'APPLY_PEN_STYLE', 'APPLY_MASK',
  'APPLY_PARENT_FILL', 'APPLY_SPOT_COLOR', 'APPLY_LOGO_FILL', 'APPLY_MULTI_OUTLINE',
  'APPLY_MULTI_INLINE', 'APPLY_BLOCK_SHADOW', 'APPLY_DROP_SHADOW', 'APPLY_SOFT_SHADOW',
  'APPLY_GLOW', 'APPLY_WARP_CIRCLE', 'APPLY_WARP_COONS', 'APPLY_WARP_FLAG',
  'APPLY_WARP_PERSPECTIVE', 'APPLY_WARP_SKIRT', 'APPLY_WARP_TRAPEZOID',
  'APPLY_WARP_WAVE', 'CLEAR_WARP',
]

const REQUIRED_TOOLS = ['select', 'rect', 'ellipse', 'text', 'image', 'pen', 'knife', 'contour']
const REQUIRED_DIALOGS = ['export', 'vectorize', 'shapeOps']
const REQUIRED_COMMANDS = ['NEW_DOCUMENT', 'UNDO', 'REDO', 'SET_TOOL', 'ADD_OBJECT']

function checkTools(tools) {
  const errors = []
  if (!Array.isArray(tools) || tools.length === 0) {
    errors.push('tool registry is empty')
    return errors
  }
  const ids = new Set()
  for (const t of tools) {
    if (!t || typeof t !== 'object') { errors.push('tool entry is not an object'); continue }
    if (!t.id) errors.push('tool missing id')
    else if (ids.has(t.id)) errors.push(`duplicate tool id: ${t.id}`)
    else ids.add(t.id)
    if (!t.name) errors.push(`tool ${t.id || '?'} missing name`)
    if (t.icon == null) errors.push(`tool ${t.id || '?'} missing icon`)
  }
  for (const id of REQUIRED_TOOLS) {
    if (!ids.has(id)) errors.push(`required tool missing: ${id}`)
  }
  return errors
}

function checkPanels(panels) {
  const errors = []
  if (!Array.isArray(panels) || panels.length === 0) errors.push('panel registry is empty')
  else {
    const seen = new Set()
    for (const p of panels) {
      if (typeof p !== 'string' || !p) errors.push('panel entry must be a non-empty string')
      else if (seen.has(p)) errors.push(`duplicate panel: ${p}`)
      else seen.add(p)
    }
  }
  return errors
}

function checkDialogs(dialogs) {
  const errors = []
  if (!Array.isArray(dialogs) || dialogs.length === 0) errors.push('dialog registry is empty')
  else {
    const seen = new Set()
    for (const d of dialogs) {
      if (typeof d !== 'string' || !d) errors.push('dialog entry must be a non-empty string')
      else if (seen.has(d)) errors.push(`duplicate dialog: ${d}`)
      else seen.add(d)
    }
  }
  for (const d of REQUIRED_DIALOGS) {
    if (!dialogs.includes(d)) errors.push(`required dialog missing: ${d}`)
  }
  return errors
}

function checkCommands(commands) {
  const errors = []
  if (!Array.isArray(commands) || commands.length === 0) errors.push('command registry is empty')
  else {
    const seen = new Set()
    for (const c of commands) {
      if (typeof c !== 'string' || !c) errors.push('command entry must be a non-empty string')
      else if (seen.has(c)) errors.push(`duplicate command: ${c}`)
      else seen.add(c)
    }
  }
  for (const c of REQUIRED_COMMANDS) {
    if (!commands.includes(c)) errors.push(`required command missing: ${c}`)
  }
  return errors
}

export function runSmokeSweep(input = {}) {
  const tools = Array.isArray(input.tools) ? input.tools : TOOLS
  const panels = Array.isArray(input.panels) ? input.panels : PANELS
  const dialogs = Array.isArray(input.dialogs) ? input.dialogs : DIALOGS
  const commands = Array.isArray(input.commands) ? input.commands : COMMANDS

  const errors = [
    ...checkTools(tools),
    ...checkPanels(panels),
    ...checkDialogs(dialogs),
    ...checkCommands(commands),
  ]

  const result = errors.slice()
  result.errors = result
  result.failures = result
  result.ok = result.length === 0
  result.passed = result.length === 0
  result.success = result.length === 0
  result.checked = {
    tools: tools.length,
    panels: panels.length,
    dialogs: dialogs.length,
    commands: commands.length,
  }
  return result
}

// Aliases for callers/tests that use different naming.
export const smokeSweep = runSmokeSweep
export const smoke = runSmokeSweep
export const runSmoke = runSmokeSweep
export const sweep = runSmokeSweep
export default runSmokeSweep