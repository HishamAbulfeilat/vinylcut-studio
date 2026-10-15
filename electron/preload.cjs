// VinylCut Studio — Electron preload bridge
//
// Exposes a narrow, explicit capability surface to the renderer as
// `window.vcsDesktop`. The shared app detects its presence and routes
// host-specific work through it; on the web this object simply does not exist.

const { contextBridge, ipcRenderer } = require('electron')

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args)

contextBridge.exposeInMainWorld('vcsDesktop', {
  isDesktop: true,

  appInfo: () => invoke('app:info'),

  // Native dialogs + real filesystem
  openDialog: (opts) => invoke('dialog:open', opts),
  saveDialog: (opts) => invoke('dialog:save', opts),
  readFile: (filePath) => invoke('fs:read', filePath),
  writeFile: (filePath, base64) => invoke('fs:write', filePath, base64),

  // OS print pipeline (desktop-only)
  print: {
    document: (opts) => invoke('print:document', opts),
    toPdf: (filePath, opts) => invoke('print:to-pdf', filePath, opts),
    listPrinters: () => invoke('print:list'),
  },

  // Cutter device output (desktop-only: USB and parallel)
  ports: {
    list: () => invoke('port:list'),
    open: (opts) => invoke('port:open', opts),
    write: (data) => invoke('port:write', data),
    close: () => invoke('port:close'),
  },

  // Scanner / camera acquisition (desktop-only)
  scanner: {
    list: () => invoke('scan:list'),
    acquire: (opts) => invoke('scan:acquire', opts),
  },

  // Installed fonts (desktop-only)
  fonts: {
    list: () => invoke('fonts:list'),
  },
})
