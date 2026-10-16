// VinylCut Studio — host capability abstraction
//
// The app runs on two hosts: a browser (web build) and Electron (desktop build).
// Everything host-specific is funnelled through this module so the rest of the
// app never branches on "am I in Electron".
//
// A capability is only reported as available when the running host can actually
// perform it. Callers are expected to check `capabilities.*` and degrade
// honestly rather than silently doing nothing.

import { createWebBackend } from './web'
import { createDesktopBackend } from './desktop'

/**
 * Pick the backend for a window-like object. The Electron preload exposes
 * `window.vcsDesktop` (isDesktop: true); its presence selects desktop.
 */
export function selectBackend(win = typeof window !== 'undefined' ? window : undefined) {
  const bridge = win && win.vcsDesktop
  if (bridge && bridge.isDesktop) return createDesktopBackend(bridge)
  return createWebBackend(win)
}

const desktop = typeof window !== 'undefined' ? window.vcsDesktop : undefined

export const isDesktop = !!desktop?.isDesktop
export const host = isDesktop ? 'desktop' : 'web'

export const backend = selectBackend()

const hasSerial = typeof navigator !== 'undefined' && 'serial' in navigator

export const capabilities = Object.freeze({
  // Web already has these
  serialCutter: hasSerial,
  localFonts: typeof window !== 'undefined' && 'queryLocalFonts' in window,
  downloadExport: !isDesktop,

  // Desktop-only
  nativeFileDialogs: isDesktop,
  realFilesystem: isDesktop,
  osPrintPipeline: isDesktop,
  nativeCutterPorts: isDesktop,   // USB + parallel, beyond WebSerial
  scannerAcquisition: isDesktop,
  installedFonts: isDesktop,
})

// --- app metadata -----------------------------------------------------------

export async function appInfo() {
  if (isDesktop) return desktop.appInfo()
  return { platform: 'web', userAgent: navigator.userAgent }
}

// --- file open / save -------------------------------------------------------

/**
 * Open one or more files; returns real `File` objects on both hosts.
 * @param {{ accept?: string, multiple?: boolean, title?: string }} opts
 * @returns {Promise<File[]>}
 */
export const openFiles = (opts = {}) => backend.openFiles(opts)

/**
 * Save bytes. Desktop: native save dialog + filesystem write. Web: File System
 * Access save picker when available, otherwise a browser download.
 * @param {{ suggestedName: string, mime?: string, data: Blob | string | Uint8Array }} opts
 * @returns {Promise<{ saved: boolean, path?: string }>}
 */
export const saveFile = (opts) => backend.saveFile(opts)

// --- cutter output ----------------------------------------------------------

export const cutter = backend.cutter

// --- printing ---------------------------------------------------------------

export async function listPrinters() {
  if (!isDesktop) return { printers: [], reason: 'browsers do not expose the printer list' }
  return desktop.print.listPrinters()
}

export const printDocument = (opts = {}) => backend.printDocument(opts)

export async function printToPdf(opts = {}) {
  if (!isDesktop) {
    return { ok: false, unavailable: true, reason: 'PDF printing from the print pipeline is desktop-only' }
  }
  const res = await desktop.saveDialog({ title: 'Save PDF', defaultPath: opts.suggestedName || 'output.pdf' })
  if (res.canceled || !res.path) return { ok: false, canceled: true }
  return desktop.print.toPdf(res.path, opts)
}

// --- cutter devices ---------------------------------------------------------

export async function listCutterPorts() {
  if (isDesktop) return desktop.ports.list()
  return {
    ok: true,
    ports: [],
    via: hasSerial ? 'webserial' : 'none',
    note: hasSerial
      ? 'WebSerial is available; a port is chosen interactively when cutting.'
      : 'This browser has no WebSerial support and cannot enumerate cutter ports.',
  }
}

export async function listScanners() {
  if (!isDesktop) {
    return { ok: false, unavailable: true, reason: 'scanner acquisition is desktop-only' }
  }
  return desktop.scanner.list()
}

export async function acquireScan(opts = {}) {
  if (!isDesktop) {
    return { ok: false, unavailable: true, reason: 'scanner acquisition is desktop-only' }
  }
  return desktop.scanner.acquire(opts)
}

export async function listInstalledFonts() {
  if (isDesktop) return desktop.fonts.list()
  if (capabilities.localFonts) {
    const fonts = await window.queryLocalFonts()
    return { ok: true, via: 'local-font-access', fonts: fonts.map(f => f.family) }
  }
  return { ok: false, unavailable: true, reason: 'no font enumeration API available in this browser' }
}
