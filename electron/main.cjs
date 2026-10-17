// VinylCut Studio — Electron host (main process)
//
// Owns the application window and routes every host-specific capability that the
// shared React app needs on the desktop build. The renderer never touches Node
// directly; everything goes through the preload bridge (see preload.cjs).
//
// Responsibilities:
//   - window + app lifecycle
//   - native open/save dialogs and real filesystem access
//   - the OS print pipeline
//   - device integration (cutter ports, scanner acquisition) as it lands
//
// Nothing here fakes a capability. Where a backend is not wired yet it answers
// with an explicit unavailable result rather than an empty success.

const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')

// `--dev` loads the Vite dev server instead of the built bundle, so the desktop
// host can hot-reload against the same code the web build runs.
const isDev = process.argv.includes('--dev')
const DEV_URL = process.env.VCS_DEV_URL || 'http://localhost:3100'

// `--capture=<file>` renders the window, writes a PNG and exits. The layout
// regression harness uses this to screenshot every screen deterministically.
const captureTarget = (process.argv.find(a => a.startsWith('--capture=')) || '').split('=')[1] || null

/** @type {BrowserWindow | null} */
let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1e1e1e',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Chromium feature the web build already relies on for cutter output.
      enableBlinkFeatures: 'Serial',
    },
  })

  // The app draws its own menu bar, so the native one stays hidden.
  Menu.setApplicationMenu(null)

  mainWindow.once('ready-to-show', () => mainWindow.show())

  // Renderer console output is forwarded to the host console. Combined with
  // --capture this doubles as the smoke check used by the verification harness.
  if (isDev || captureTarget) {
    mainWindow.webContents.on('console-message', (event, level, message, line, source) => {
      // Newer Electron passes a single event object; older passes positional args.
      const e = event && typeof event === 'object' && 'message' in event
        ? event
        : { level, message, lineNumber: line, sourceId: source }
      const names = ['log', 'warn', 'error', 'debug']
      const lvl = typeof e.level === 'number' ? (names[e.level] || e.level) : (e.level || 'log')
      const where = e.sourceId ? ` (${e.sourceId}:${e.lineNumber})` : ''
      console.log(`[renderer:${lvl}] ${e.message}${where}`)
    })
  }

  if (captureTarget) {
    mainWindow.webContents.once('did-finish-load', async () => {
      // Let fonts, images and the first paint settle before grabbing the frame.
      await new Promise(resolve => setTimeout(resolve, 2500))
      const image = await mainWindow.webContents.capturePage()
      await fs.writeFile(captureTarget, image.toPNG())
      const { width, height } = image.getSize()
      console.log(`captured ${captureTarget} (${width}x${height})`)
      app.quit()
    })
  }

  if (isDev) {
    mainWindow.loadURL(DEV_URL)
  } else {
    // Resolve the built bundle relative to the app root so the same code works in
    // development (project root) and in a packaged build (app.asar / resources).
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'))
  }

  // External links open in the real browser, never inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// ---------------------------------------------------------------------------
// Native dialogs + filesystem
// ---------------------------------------------------------------------------

ipcMain.handle('dialog:open', async (_e, opts = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: opts.title || 'Open',
    filters: opts.filters || [{ name: 'All Files', extensions: ['*'] }],
    properties: opts.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
  })
  return { canceled: result.canceled, paths: result.filePaths }
})

ipcMain.handle('dialog:save', async (_e, opts = {}) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: opts.title || 'Save',
    defaultPath: opts.defaultPath,
    filters: opts.filters || [{ name: 'All Files', extensions: ['*'] }],
  })
  return { canceled: result.canceled, path: result.filePath || null }
})

ipcMain.handle('fs:read', async (_e, filePath) => {
  const buf = await fs.readFile(filePath)
  return { path: filePath, name: path.basename(filePath), data: buf.toString('base64') }
})

ipcMain.handle('fs:write', async (_e, filePath, base64) => {
  await fs.writeFile(filePath, Buffer.from(base64, 'base64'))
  return { path: filePath }
})

// ---------------------------------------------------------------------------
// OS print pipeline (desktop-only: the web build only has window.print)
// ---------------------------------------------------------------------------

ipcMain.handle('print:document', async (_e, opts = {}) => {
  if (!mainWindow) return { ok: false, reason: 'no-window' }
  return new Promise((resolve) => {
    mainWindow.webContents.print(
      {
        silent: false,
        printBackground: true,
        landscape: !!opts.landscape,
        copies: opts.copies || 1,
      },
      (success, failureReason) => resolve({ ok: success, reason: failureReason || null }),
    )
  })
})

ipcMain.handle('print:to-pdf', async (_e, filePath, opts = {}) => {
  if (!mainWindow) return { ok: false, reason: 'no-window' }
  const data = await mainWindow.webContents.printToPDF({
    landscape: !!opts.landscape,
    printBackground: true,
    pageSize: opts.pageSize || 'A4',
  })
  await fs.writeFile(filePath, data)
  return { ok: true, path: filePath, bytes: data.length }
})

ipcMain.handle('print:list', async () => {
  if (!mainWindow) return { printers: [] }
  const printers = await mainWindow.webContents.getPrintersAsync()
  return { printers: printers.map(p => ({ name: p.name, displayName: p.displayName, isDefault: p.isDefault })) }
})

// ---------------------------------------------------------------------------
// Capabilities not yet wired in this build.
//
// These report themselves as unavailable on purpose. Returning an empty list or
// a silent success here would make the app claim a feature it does not have.
// ---------------------------------------------------------------------------

const PENDING = {
  'port:list': 'cutter port enumeration (desktop USB/parallel)',
  'port:open': 'native cutter output',
  'port:write': 'native cutter output',
  'port:close': 'native cutter output',
  'scan:list': 'scanner acquisition',
  'scan:acquire': 'scanner acquisition',
  'fonts:list': 'installed-font enumeration',
}

for (const [channel, label] of Object.entries(PENDING)) {
  ipcMain.handle(channel, () => ({
    ok: false,
    unavailable: true,
    reason: `${label} is not wired in this build yet`,
  }))
}

ipcMain.handle('app:info', () => ({
  platform: process.platform,
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
  version: app.getVersion(),
}))

// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
