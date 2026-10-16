// Web backend: browser APIs only.
//   open  : File System Access picker when present, else <input type=file>
//   save  : File System Access save picker when present, else download
//   print : window.print()
//   cutter: WebSerial

import { connectCutter, closeCutter, writeJob, serialSupported } from '../lib/cutter'

const MIME_FALLBACK = 'application/octet-stream'

function acceptToPickerTypes(accept) {
  const exts = accept
    .split(',')
    .map(s => s.trim())
    .filter(s => /^\.[a-z0-9]+$/i.test(s))
  if (!exts.length) return undefined
  return [{ description: 'Supported Files', accept: { [MIME_FALLBACK]: exts } }]
}

function downloadBlob(win, blob, name) {
  const doc = win.document
  const url = win.URL.createObjectURL(blob)
  const a = doc.createElement('a')
  a.href = url
  a.download = name
  doc.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => win.URL.revokeObjectURL(url), 1000)
}

export function createWebBackend(win = globalThis.window) {
  const hasPicker = !!win && typeof win.showOpenFilePicker === 'function'
  const hasSavePicker = !!win && typeof win.showSaveFilePicker === 'function'

  return {
    kind: 'web',

    async openFiles({ accept = '*', multiple = false } = {}) {
      if (hasPicker) {
        try {
          const handles = await win.showOpenFilePicker({
            multiple,
            types: acceptToPickerTypes(accept),
            excludeAcceptAllOption: false,
          })
          return await Promise.all(handles.map(h => h.getFile()))
        } catch (err) {
          if (err && err.name === 'AbortError') return []
          throw err
        }
      }
      return new Promise((resolve) => {
        const input = win.document.createElement('input')
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
        win.document.body.appendChild(input)
        input.click()
      })
    },

    async saveFile({ suggestedName, mime = MIME_FALLBACK, data }) {
      const blob = new Blob([data], { type: mime })
      if (hasSavePicker) {
        try {
          const handle = await win.showSaveFilePicker({ suggestedName })
          const writable = await handle.createWritable()
          await writable.write(blob)
          await writable.close()
          return { saved: true, path: handle.name }
        } catch (err) {
          if (err && err.name === 'AbortError') return { saved: false }
          // Any other picker failure: fall through to a plain download.
        }
      }
      downloadBlob(win, blob, suggestedName)
      return { saved: true }
    },

    async printDocument() {
      win.print()
      return { ok: true, via: 'browser' }
    },

    cutter: {
      available: () => serialSupported(),
      /** Resolves to a handle; `handle.port` is the raw WebSerial port. */
      async connect(profile) {
        const port = await connectCutter(profile)
        return { port }
      },
      write: (handle, job, opts) => writeJob(handle.port, job, opts),
      close: (handle) => closeCutter(handle && handle.port),
    },
  }
}
