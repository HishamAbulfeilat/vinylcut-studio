/**
 * Edition capability table — derived from the reference application's
 * per-edition UI definitions (GuiData/Demo_GuiVMB/VMC/VML/VMP/VMS).
 *
 * This is the single source of truth for what each edition can do.
 * The app reads this table at launch and gates menus, tools, dialogs
 * and commands accordingly.
 *
 * Editions (capability ladder, highest first):
 *   ART          — SignMaster ART 5.0    (VMX) — 139 commands, 46 tool layouts
 *   XPT          — SignMaster XPT 5.0    (SMX) — 120 commands, 39 tool layouts
 *   PRO          — SignMaster PRO 5.0    (SMP) — 102 commands, 27 tool layouts
 *   CUT + ARMS   — SignMaster CUT+ARMS 5.0 (SMC) — 81 commands, 20 tool layouts + ARMS hardware
 *   CUT          — SignMaster CUT 5.0    (SMC) — 81 commands, 20 tool layouts
 *
 * CUT and CUT+ARMS share the same command surface; they differ only in
 * ARMS mark-sensor hardware support (modelled as a hardware capability).
 */

// Feature flag keys — these map to UI surface areas that editions gate.
export const FEATURE_FLAGS = {
  // Text capabilities
  TEXT_BREAK_CHAR: 'text.break.char',
  TEXT_BREAK_WORD: 'text.break.word',
  TEXT_BREAK_LINE: 'text.break.line',
  TEXT_BREAK_PARAGRAPH: 'text.break.paragraph',
  TEXT_FIND_REPLACE: 'text.findReplace',
  TEXT_TO_ARTISTIC: 'text.toArtistic',
  TEXT_TO_PARAGRAPH: 'text.toParagraph',
  TEXT_TO_VERTICAL: 'text.toVertical',
  TEXT_TO_ARC: 'text.toArc',
  TEXT_FIT_TO: 'text.fitTo',

  // Font capabilities
  FONT_MANAGER: 'font.manager',
  FONT_DETECTIVE: 'font.detective',

  // Curve capabilities
  CURVES_SLICER: 'curves.slicer',
  CURVES_REPLACE: 'curves.replace',
  CURVES_APPEND: 'curves.append',
  CURVES_JOIN_SPIRAL: 'curves.join.spiral',
  CURVES_JOIN_TANGENT: 'curves.join.tangent',
  CURVES_JOIN_LINE: 'curves.join.line',
  CURVES_JOIN_DELETE: 'curves.join.delete',
  CURVES_JOIN_REDUCE: 'curves.join.reduce',

  // Bitmap capabilities
  BITMAPS_ADJUST: 'bitmaps.adjust',
  BITMAPS_CROP: 'bitmaps.crop',
  BITMAPS_CONVERT: 'bitmaps.convert',
  BITMAPS_EDIT_MASK: 'bitmaps.editMask',
  BITMAPS_MASK_EDITOR: 'bitmaps.maskEditor',
  BITMAPS_OLE: 'bitmaps.ole',
  BITMAPS_VIEW_MASK: 'bitmaps.viewMask',
  BITMAPS_VECTORIZE: 'bitmaps.vectorize',
  BITMAPS_VECTORIZER: 'bitmaps.vectorizer',

  // Effects capabilities
  EFFECTS_DIALOG: 'effects.dialog',
  EFFECTS_SELECT_PRESET: 'effects.selectPreset',
  EFFECTS_SHOW: 'effects.show',
  EFFECTS_ENGRAVE_FILL: 'effects.engraveFill',
  EFFECTS_ENGRAVE_MODULE: 'effects.engraveModule',

  // Colour capabilities
  COLOUR_LIBRARIES: 'colour.libraries',
  COLOUR_SET_FILL_SPOT: 'colour.setFillSpot',
  COLOUR_LIST: 'colour.list',
  COLOUR_OBJECT_LIST: 'colour.objectList',

  // Layout capabilities
  LAYOUT_CENTRE_PAGE_H: 'layout.centrePageH',
  LAYOUT_CENTRE_PAGE_V: 'layout.centrePageV',
  LAYOUT_CENTRE_PAGE_BOTH: 'layout.centrePageBoth',
  LAYOUT_MOVE_TO_PAGE: 'layout.moveToPage',
  LAYOUT_NEW_PAGE: 'layout.newPage',
  LAYOUT_PAGE_IS_MASTER: 'layout.pageIsMaster',
  LAYOUT_SHOW_MASTER_PAGE: 'layout.showMasterPage',
  LAYOUT_STEP_REPEAT_DIALOG: 'layout.stepRepeatDialog',

  // Output capabilities
  OUTPUT_CUT_SELECTED: 'output.cutSelected',
  OUTPUT_RIP_TO_SPOOLER: 'output.ripToSpooler',
  OUTPUT_RIP_MANAGER: 'output.ripManager',
  OUTPUT_RIP_SPOOLER: 'output.ripSpooler',

  // Other capabilities
  OTHER_FULL_SCREEN_PREVIEW: 'other.fullScreenPreview',
  OTHER_SECURITY: 'other.security',
  OTHER_SETUP_WIZARD: 'other.setupWizard',
  OTHER_SHOW_LM_SETTINGS: 'other.showLmSettings',

  // Hardware capabilities
  HARDWARE_ARMS: 'hardware.arms',
}

// Capability table: each edition gets a set of enabled feature flags.
// The table is built from the reference's per-edition command/shortcut tables.
export const EDITION_CAPABILITIES = {
  ART: {
    id: 'ART',
    name: 'SignMaster ART 5.0',
    code: 'VMX',
    commandCount: 139,
    toolLayoutCount: 46,
    description: 'Full professional sign-making surface',
    flags: new Set([
      // Text — all
      FEATURE_FLAGS.TEXT_BREAK_CHAR,
      FEATURE_FLAGS.TEXT_BREAK_WORD,
      FEATURE_FLAGS.TEXT_BREAK_LINE,
      FEATURE_FLAGS.TEXT_BREAK_PARAGRAPH,
      FEATURE_FLAGS.TEXT_FIND_REPLACE,
      FEATURE_FLAGS.TEXT_TO_ARTISTIC,
      FEATURE_FLAGS.TEXT_TO_PARAGRAPH,
      FEATURE_FLAGS.TEXT_TO_VERTICAL,
      FEATURE_FLAGS.TEXT_TO_ARC,
      FEATURE_FLAGS.TEXT_FIT_TO,
      // Fonts — all
      FEATURE_FLAGS.FONT_MANAGER,
      FEATURE_FLAGS.FONT_DETECTIVE,
      // Curves — all
      FEATURE_FLAGS.CURVES_SLICER,
      FEATURE_FLAGS.CURVES_REPLACE,
      FEATURE_FLAGS.CURVES_APPEND,
      FEATURE_FLAGS.CURVES_JOIN_SPIRAL,
      FEATURE_FLAGS.CURVES_JOIN_TANGENT,
      FEATURE_FLAGS.CURVES_JOIN_LINE,
      FEATURE_FLAGS.CURVES_JOIN_DELETE,
      FEATURE_FLAGS.CURVES_JOIN_REDUCE,
      // Bitmaps — all
      FEATURE_FLAGS.BITMAPS_ADJUST,
      FEATURE_FLAGS.BITMAPS_CROP,
      FEATURE_FLAGS.BITMAPS_CONVERT,
      FEATURE_FLAGS.BITMAPS_EDIT_MASK,
      FEATURE_FLAGS.BITMAPS_MASK_EDITOR,
      FEATURE_FLAGS.BITMAPS_OLE,
      FEATURE_FLAGS.BITMAPS_VIEW_MASK,
      FEATURE_FLAGS.BITMAPS_VECTORIZE,
      FEATURE_FLAGS.BITMAPS_VECTORIZER,
      // Effects — all
      FEATURE_FLAGS.EFFECTS_DIALOG,
      FEATURE_FLAGS.EFFECTS_SELECT_PRESET,
      FEATURE_FLAGS.EFFECTS_SHOW,
      FEATURE_FLAGS.EFFECTS_ENGRAVE_FILL,
      FEATURE_FLAGS.EFFECTS_ENGRAVE_MODULE,
      // Colour — all
      FEATURE_FLAGS.COLOUR_LIBRARIES,
      FEATURE_FLAGS.COLOUR_SET_FILL_SPOT,
      FEATURE_FLAGS.COLOUR_LIST,
      FEATURE_FLAGS.COLOUR_OBJECT_LIST,
      // Layout — all
      FEATURE_FLAGS.LAYOUT_CENTRE_PAGE_H,
      FEATURE_FLAGS.LAYOUT_CENTRE_PAGE_V,
      FEATURE_FLAGS.LAYOUT_CENTRE_PAGE_BOTH,
      FEATURE_FLAGS.LAYOUT_MOVE_TO_PAGE,
      FEATURE_FLAGS.LAYOUT_NEW_PAGE,
      FEATURE_FLAGS.LAYOUT_PAGE_IS_MASTER,
      FEATURE_FLAGS.LAYOUT_SHOW_MASTER_PAGE,
      FEATURE_FLAGS.LAYOUT_STEP_REPEAT_DIALOG,
      // Output — all
      FEATURE_FLAGS.OUTPUT_CUT_SELECTED,
      FEATURE_FLAGS.OUTPUT_RIP_TO_SPOOLER,
      FEATURE_FLAGS.OUTPUT_RIP_MANAGER,
      FEATURE_FLAGS.OUTPUT_RIP_SPOOLER,
      // Other — all
      FEATURE_FLAGS.OTHER_FULL_SCREEN_PREVIEW,
      FEATURE_FLAGS.OTHER_SECURITY,
      FEATURE_FLAGS.OTHER_SETUP_WIZARD,
      FEATURE_FLAGS.OTHER_SHOW_LM_SETTINGS,
    ]),
  },

  XPT: {
    id: 'XPT',
    name: 'SignMaster XPT 5.0',
    code: 'SMX',
    commandCount: 120,
    toolLayoutCount: 39,
    description: 'Professional, minus some text & curve tools',
    flags: new Set([
      // Text — most, but not break-by or fit-to
      FEATURE_FLAGS.TEXT_TO_ARTISTIC,
      FEATURE_FLAGS.TEXT_TO_PARAGRAPH,
      FEATURE_FLAGS.TEXT_TO_VERTICAL,
      FEATURE_FLAGS.TEXT_TO_ARC,
      // Fonts — all
      FEATURE_FLAGS.FONT_MANAGER,
      FEATURE_FLAGS.FONT_DETECTIVE,
      // Curves — most, but not slicer/replace/append/join series
      FEATURE_FLAGS.CURVES_JOIN_SPIRAL,
      FEATURE_FLAGS.CURVES_JOIN_TANGENT,
      FEATURE_FLAGS.CURVES_JOIN_LINE,
      FEATURE_FLAGS.CURVES_JOIN_DELETE,
      FEATURE_FLAGS.CURVES_JOIN_REDUCE,
      // Bitmaps — all
      FEATURE_FLAGS.BITMAPS_ADJUST,
      FEATURE_FLAGS.BITMAPS_CROP,
      FEATURE_FLAGS.BITMAPS_CONVERT,
      FEATURE_FLAGS.BITMAPS_EDIT_MASK,
      FEATURE_FLAGS.BITMAPS_MASK_EDITOR,
      FEATURE_FLAGS.BITMAPS_OLE,
      FEATURE_FLAGS.BITMAPS_VIEW_MASK,
      FEATURE_FLAGS.BITMAPS_VECTORIZE,
      FEATURE_FLAGS.BITMAPS_VECTORIZER,
      // Effects — all
      FEATURE_FLAGS.EFFECTS_DIALOG,
      FEATURE_FLAGS.EFFECTS_SELECT_PRESET,
      FEATURE_FLAGS.EFFECTS_SHOW,
      FEATURE_FLAGS.EFFECTS_ENGRAVE_FILL,
      FEATURE_FLAGS.EFFECTS_ENGRAVE_MODULE,
      // Colour — all
      FEATURE_FLAGS.COLOUR_LIBRARIES,
      FEATURE_FLAGS.COLOUR_SET_FILL_SPOT,
      FEATURE_FLAGS.COLOUR_LIST,
      FEATURE_FLAGS.COLOUR_OBJECT_LIST,
      // Layout — all
      FEATURE_FLAGS.LAYOUT_CENTRE_PAGE_H,
      FEATURE_FLAGS.LAYOUT_CENTRE_PAGE_V,
      FEATURE_FLAGS.LAYOUT_CENTRE_PAGE_BOTH,
      FEATURE_FLAGS.LAYOUT_MOVE_TO_PAGE,
      FEATURE_FLAGS.LAYOUT_NEW_PAGE,
      FEATURE_FLAGS.LAYOUT_PAGE_IS_MASTER,
      FEATURE_FLAGS.LAYOUT_SHOW_MASTER_PAGE,
      FEATURE_FLAGS.LAYOUT_STEP_REPEAT_DIALOG,
      // Output — all
      FEATURE_FLAGS.OUTPUT_CUT_SELECTED,
      FEATURE_FLAGS.OUTPUT_RIP_TO_SPOOLER,
      FEATURE_FLAGS.OUTPUT_RIP_MANAGER,
      FEATURE_FLAGS.OUTPUT_RIP_SPOOLER,
      // Other — all
      FEATURE_FLAGS.OTHER_FULL_SCREEN_PREVIEW,
      FEATURE_FLAGS.OTHER_SECURITY,
      FEATURE_FLAGS.OTHER_SETUP_WIZARD,
      FEATURE_FLAGS.OTHER_SHOW_LM_SETTINGS,
    ]),
  },

  PRO: {
    id: 'PRO',
    name: 'SignMaster PRO 5.0',
    code: 'SMP',
    commandCount: 102,
    toolLayoutCount: 27,
    description: 'Mid-tier, text & node editing reduced',
    flags: new Set([
      // Text — basic only (no break-by, no find/replace, no fit-to)
      FEATURE_FLAGS.TEXT_TO_ARTISTIC,
      FEATURE_FLAGS.TEXT_TO_PARAGRAPH,
      FEATURE_FLAGS.TEXT_TO_VERTICAL,
      FEATURE_FLAGS.TEXT_TO_ARC,
      // Fonts — manager only
      FEATURE_FLAGS.FONT_MANAGER,
      // Curves — basic joins only
      FEATURE_FLAGS.CURVES_JOIN_SPIRAL,
      FEATURE_FLAGS.CURVES_JOIN_TANGENT,
      FEATURE_FLAGS.CURVES_JOIN_LINE,
      FEATURE_FLAGS.CURVES_JOIN_DELETE,
      FEATURE_FLAGS.CURVES_JOIN_REDUCE,
      // Bitmaps — basic only (no adjust/crop/convert/mask/ole/vectorize)
      FEATURE_FLAGS.BITMAPS_VIEW_MASK,
      // Effects — basic only (no engrave)
      FEATURE_FLAGS.EFFECTS_DIALOG,
      FEATURE_FLAGS.EFFECTS_SELECT_PRESET,
      FEATURE_FLAGS.EFFECTS_SHOW,
      // Colour — libraries only
      FEATURE_FLAGS.COLOUR_LIBRARIES,
      FEATURE_FLAGS.COLOUR_LIST,
      FEATURE_FLAGS.COLOUR_OBJECT_LIST,
      // Layout — all
      FEATURE_FLAGS.LAYOUT_CENTRE_PAGE_H,
      FEATURE_FLAGS.LAYOUT_CENTRE_PAGE_V,
      FEATURE_FLAGS.LAYOUT_CENTRE_PAGE_BOTH,
      FEATURE_FLAGS.LAYOUT_MOVE_TO_PAGE,
      FEATURE_FLAGS.LAYOUT_NEW_PAGE,
      FEATURE_FLAGS.LAYOUT_PAGE_IS_MASTER,
      FEATURE_FLAGS.LAYOUT_SHOW_MASTER_PAGE,
      FEATURE_FLAGS.LAYOUT_STEP_REPEAT_DIALOG,
      // Output — all
      FEATURE_FLAGS.OUTPUT_CUT_SELECTED,
      FEATURE_FLAGS.OUTPUT_RIP_TO_SPOOLER,
      FEATURE_FLAGS.OUTPUT_RIP_MANAGER,
      FEATURE_FLAGS.OUTPUT_RIP_SPOOLER,
      // Other — all
      FEATURE_FLAGS.OTHER_FULL_SCREEN_PREVIEW,
      FEATURE_FLAGS.OTHER_SECURITY,
      FEATURE_FLAGS.OTHER_SETUP_WIZARD,
      FEATURE_FLAGS.OTHER_SHOW_LM_SETTINGS,
    ]),
  },

  'CUT+ARMS': {
    id: 'CUT+ARMS',
    name: 'SignMaster CUT+ARMS 5.0',
    code: 'SMC',
    commandCount: 81,
    toolLayoutCount: 20,
    description: 'Entry cutting edition with ARMS mark-sensor hardware support',
    flags: new Set([
      // Text — minimal (only basic text to path/arc/vertical/paragraph)
      FEATURE_FLAGS.TEXT_TO_ARTISTIC,
      FEATURE_FLAGS.TEXT_TO_PARAGRAPH,
      FEATURE_FLAGS.TEXT_TO_VERTICAL,
      FEATURE_FLAGS.TEXT_TO_ARC,
      // Fonts — none
      // Curves — basic joins only
      FEATURE_FLAGS.CURVES_JOIN_SPIRAL,
      FEATURE_FLAGS.CURVES_JOIN_TANGENT,
      FEATURE_FLAGS.CURVES_JOIN_LINE,
      FEATURE_FLAGS.CURVES_JOIN_DELETE,
      FEATURE_FLAGS.CURVES_JOIN_REDUCE,
      // Bitmaps — none
      // Effects — none
      // Colour — none
      // Layout — centre page, move to page, new page, master pages
      FEATURE_FLAGS.LAYOUT_CENTRE_PAGE_H,
      FEATURE_FLAGS.LAYOUT_CENTRE_PAGE_V,
      FEATURE_FLAGS.LAYOUT_CENTRE_PAGE_BOTH,
      FEATURE_FLAGS.LAYOUT_MOVE_TO_PAGE,
      FEATURE_FLAGS.LAYOUT_NEW_PAGE,
      FEATURE_FLAGS.LAYOUT_PAGE_IS_MASTER,
      FEATURE_FLAGS.LAYOUT_SHOW_MASTER_PAGE,
      // Output — cut selected, RIP spooler only
      FEATURE_FLAGS.OUTPUT_CUT_SELECTED,
      FEATURE_FLAGS.OUTPUT_RIP_SPOOLER,
      // Other — setup wizard only
      FEATURE_FLAGS.OTHER_SETUP_WIZARD,
      // Hardware — ARMS mark sensor
      FEATURE_FLAGS.HARDWARE_ARMS,
    ]),
  },

  CUT: {
    id: 'CUT',
    name: 'SignMaster CUT 5.0',
    code: 'SMC',
    commandCount: 81,
    toolLayoutCount: 20,
    description: 'Entry cutting edition',
    flags: new Set([
      // Text — minimal (only basic text to path/arc/vertical/paragraph)
      FEATURE_FLAGS.TEXT_TO_ARTISTIC,
      FEATURE_FLAGS.TEXT_TO_PARAGRAPH,
      FEATURE_FLAGS.TEXT_TO_VERTICAL,
      FEATURE_FLAGS.TEXT_TO_ARC,
      // Fonts — none
      // Curves — basic joins only
      FEATURE_FLAGS.CURVES_JOIN_SPIRAL,
      FEATURE_FLAGS.CURVES_JOIN_TANGENT,
      FEATURE_FLAGS.CURVES_JOIN_LINE,
      FEATURE_FLAGS.CURVES_JOIN_DELETE,
      FEATURE_FLAGS.CURVES_JOIN_REDUCE,
      // Bitmaps — none
      // Effects — none
      // Colour — none
      // Layout — centre page, move to page, new page, master pages
      FEATURE_FLAGS.LAYOUT_CENTRE_PAGE_H,
      FEATURE_FLAGS.LAYOUT_CENTRE_PAGE_V,
      FEATURE_FLAGS.LAYOUT_CENTRE_PAGE_BOTH,
      FEATURE_FLAGS.LAYOUT_MOVE_TO_PAGE,
      FEATURE_FLAGS.LAYOUT_NEW_PAGE,
      FEATURE_FLAGS.LAYOUT_PAGE_IS_MASTER,
      FEATURE_FLAGS.LAYOUT_SHOW_MASTER_PAGE,
      // Output — cut selected, RIP spooler only
      FEATURE_FLAGS.OUTPUT_CUT_SELECTED,
      FEATURE_FLAGS.OUTPUT_RIP_SPOOLER,
      // Other — setup wizard only
      FEATURE_FLAGS.OTHER_SETUP_WIZARD,
      // Hardware — none
    ]),
  },
}

// Edition order for UI (highest capability first)
export const EDITION_ORDER = ['ART', 'XPT', 'PRO', 'CUT+ARMS', 'CUT']

// Default edition if none selected
export const DEFAULT_EDITION = 'ART'

/**
 * Get the capability table for an edition.
 * @param {string} editionId - Edition ID (e.g., 'ART', 'CUT')
 * @returns {object} Edition capability object
 */
export function getEditionCapabilities(editionId) {
  return EDITION_CAPABILITIES[editionId] || EDITION_CAPABILITIES[DEFAULT_EDITION]
}

/**
 * Check if an edition has a specific feature flag.
 * @param {string} editionId - Edition ID
 * @param {string} flag - Feature flag from FEATURE_FLAGS
 * @returns {boolean}
 */
export function editionHasFeature(editionId, flag) {
  const edition = getEditionCapabilities(editionId)
  return edition.flags.has(flag)
}

/**
 * Get all editions as an array for UI selectors.
 * @returns {Array} Array of edition capability objects
 */
export function getAllEditions() {
  return EDITION_ORDER.map((id) => EDITION_CAPABILITIES[id])
}

/**
 * Get the edition IDs in order.
 * @returns {string[]}
 */
export function getEditionIds() {
  return [...EDITION_ORDER]
}