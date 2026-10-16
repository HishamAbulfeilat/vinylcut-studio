// Desktop backend: everything goes through the Electron preload bridge
// (`window.vcsDesktop`, see electron/preload.cjs).

const MIME_FALLBACK = 'application/octet-stream'

export function base64ToBlob(base64, type) {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

export function bytesToBase64(bytes) {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

export function acceptToFilters(accept) {
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

export function createDesktopBackend(bridge) {
  return {
    kind: 'desktop',

    async openFiles({ accept = '*', multiple = false, title } = {}) {
      const res = await bridge.openDialog({ title, filters: acceptToFilters(accept), multiple })
      if (res.canceled || !res.paths?.length) return []
      const files = []
      for (const p of res.paths) {
        const r = await bridge.readFile(p)
        files.push(new File([base64ToBlob(r.data, MIME_FALLBACK)], r.name))
      }
      return files
    },

    async saveFile({ suggestedName, data, mime = MIME_FALLBACK }) {
      const res = await bridge.saveDialog({ title: 'Save As', defaultPath: suggestedName })
      if (res.canceled || !res.path) return { saved: false }
      const buf = await new Blob([data], { type: mime }).arrayBuffer()
      await bridge.writeFile(res.path, bytesToBase64(new Uint8Array(buf)))
      return { saved: true, path: res.path }
    },

    printDocument: (opts = {}) => bridge.print.document(opts),
    printToPdf: (filePath, opts = {}) => bridge.print.toPdf(filePath, opts),
    listPrinters: () => bridge.print.listPrinters(),

    cutter: {
      available: () => true,
      async connect(profile) {
        const res = await bridge.ports.open({ profile: profile && profile.id })
        if (!res || res.ok === false) {
          throw new Error((res && res.reason) || 'Could not open the cutter port')
        }
        return { desktop: true }
      },
      async write(_handle, job, opts = {}) {
        const res = await bridge.ports.write(job)
        if (!res || res.ok === false) throw new Error((res && res.reason) || 'Cutter write failed')
        if (opts.onProgress) opts.onProgress(job.length, job.length)
        return new TextEncoder().encode(job).length
      },
      async close() {
        await bridge.ports.close()
      },
    },
  }
}
