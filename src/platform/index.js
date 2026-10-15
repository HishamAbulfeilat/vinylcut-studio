// VinylCut Studio — host capability abstraction
//
// The app runs on two hosts: a browser (web build) and Electron (desktop build).
// Everything host-specific is funnelled through this module so the rest of the
// app never branches on "am I in Electron".
//
// A capability is only reported as available when the running host can actually
// perform it. Callers are expected to check `capabilities.*` and degrade
// honestly rather than silently doing nothing.

const desktop = typeof window !== 'undefined' ? window.vcsDesktop : undefined

export const isDesktop = !!desktop?.isDesktop
export const host = isDesktop ? 'desktop' : 'web'

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

// --- file open --------------------------------------------------------------
//
// Returns real `File` objects on both hosts, so callers that already speak File
// keep working unchanged.

const MIME_FALLBACK = 'application/octet-stream'

function base64ToBlob(base64, type) {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

/**
 * Open one or more files.
 * @param {{ accept?: string, multiple?: boolean, title?: string }} opts
 * @returns {Promise<File[]>}
 */
export async function openFiles(opts = {}) {
  const accept = opts.accept || '*'
  const multiple = !!opts.multiple

  if (isDesktop) {
    const filters = acceptToFilters(accept)
    const res = await desktop.openDialog({ title: opts.title, filters, multiple })
    if (res.canceled || !res.paths?.length) return []
    const files = []
    for (const p of res.paths) {
      const r = await desktop.readFile(p)
      files.push(new File([base64ToBlob(r.data, MIME_FALLBACK)], r.name))
    }
    return files
  }

  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.style.display = 'none'
    input.addEventListener('change', () => {
      const files = Array.from(input.files || [])
      input.remove()
      resolve(files)
    })
    input.addEventListener('cancel', () => { input.remove(); resolve([]) })
    document.body.appendChild(input)
    input.click()
  })
}

function acceptToFilters(accept) {
  const exts = accept
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => (s.startsWith('.') ? s.slice(1) : s))
    .filter(s => /^[a-z0-9]+$/i.test(s))
  if (!exts.length) return [{ name: 'All Files', extensions: ['*'] }]
  return [
    { name: 'Supported Files', extensions: exts },
    { name: 'All Files', extensions: ['*'] },
  ]
}

// --- file save --------------------------------------------------------------

/**
 * Save bytes to disk.
 * Desktop: native save dialog + real filesystem write.
 * Web: browser download (there is no filesystem to write to).
 * @param {{ suggestedName: string, mime?: string, data: Blob }} opts
 * @returns {Promise<{ saved: boolean, path?: string }>}
 */
export async function saveFile(opts) {
  const { suggestedName, mime = MIME_FALLBACK, data } = opts

  if (isDesktop) {
    const res = await desktop.saveDialog({
      title: 'Save As',
      defaultPath: suggestedName,
    })
    if (res.canceled || !res.path) return { saved: false }
    const buf = await data.arrayBuffer()
    const base64 = bytesToBase64(new Uint8Array(buf))
    await desktop.writeFile(res.path, base64)
    return { saved: true, path: res.path }
  }

  const url = URL.createObjectURL(new Blob([data], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { saved: true }
}

function bytesToBase64(bytes) {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

// --- printing ---------------------------------------------------------------

export async function listPrinters() {
  if (!isDesktop) return { printers: [], reason: 'browsers do not expose the printer list' }
  return desktop.print.listPrinters()
}

export async function printDocument(opts = {}) {
  if (isDesktop) return desktop.print.document(opts)
  window.print()
  return { ok: true, via: 'browser' }
}

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
