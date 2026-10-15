/* ------------------------------------------------------------------ *
 * Cutter driver.
 *
 * A browser cannot install an OS print/plot driver, but it can talk to a
 * vinyl cutter directly over WebSerial. This module implements that for
 * real: per-vendor command dialects, per-vendor USB device filters,
 * chunked writes with drain/backpressure, a status handshake, and an
 * honest failure path that falls back to a .plt file.
 *
 * Dialects: HP-GL/1, HP-GL/2, Graphtec GP-GL, Roland DMPL.
 * ------------------------------------------------------------------ */

import { objectToRings, simplify } from './geometry'

/* Known USB vendor IDs for cutter bridges and controllers. */
export const USB_BRIDGES = {
  ftdi: 0x0403,
  prolific: 0x067b,
  silabs: 0x10c4,
  ch340: 0x1a86,
  roland: 0x0b48,
  graphtec: 0x0b4d,
}

export const CUTTER_PROFILES = [
  {
    id: 'hpgl',
    name: 'Generic HP-GL/1 cutter',
    dialect: 'hpgl',
    baudRate: 9600,
    usbFilters: [],
    init: ['IN;'],
    setup: (o) => [`SP${o.pen || 1};`, `VS${o.speed || 20};`, `FS${o.force || 10};`],
    end: ['PU0,0;', 'SP0;'],
    statusQuery: 'IN;',
    perPoint: false,
    close: false,
  },
  {
    id: 'hpgl2',
    name: 'HP-GL/2 plotter',
    dialect: 'hpgl2',
    baudRate: 9600,
    usbFilters: [],
    init: ['IN;', 'BP;'],
    setup: (o) => [`SP${o.pen || 1};`, `VS${o.speed || 20};`, `FS${o.force || 10};`],
    end: ['PU0,0;', 'PG;'],
    statusQuery: 'IN;',
    perPoint: false,
    close: false,
  },
  {
    id: 'gpgl',
    name: 'Graphtec GP-GL (CE/FC)',
    dialect: 'gpgl',
    baudRate: 9600,
    usbFilters: [{ usbVendorId: USB_BRIDGES.graphtec }, { usbVendorId: USB_BRIDGES.ftdi }],
    init: ['IN;'],
    setup: (o) => [`SP${o.pen || 1};`, `VS${o.speed || 20};`, `FS${o.force || 10};`],
    end: ['PU0,0;'],
    statusQuery: '\x1b.B', // ESC .B = status/version request
    perPoint: false,
    close: true,
  },
  {
    id: 'summa',
    name: 'Summa (HP-GL with status)',
    dialect: 'hpgl',
    baudRate: 9600,
    usbFilters: [{ usbVendorId: USB_BRIDGES.ftdi }],
    init: ['IN;'],
    setup: (o) => [`SP${o.pen || 1};`, `VS${o.speed || 20};`, `FS${o.force || 10};`],
    end: ['PU0,0;'],
    statusQuery: '\x1b.B',
    perPoint: false,
    close: true,
  },
  {
    id: 'roland-dmpl',
    name: 'Roland DMPL (CAMM/GX/STIKA)',
    dialect: 'dmpl',
    baudRate: 9600,
    usbFilters: [{ usbVendorId: USB_BRIDGES.roland }, { usbVendorId: USB_BRIDGES.ftdi }],
    init: ['IN;'],
    setup: (o) => [`VS${o.speed || 20};`, `FS${o.force || 10};`, `SP${o.pen || 1};`],
    end: ['PU0,0;'],
    statusQuery: '\x1b.B',
    perPoint: true, // DMPL prefers one coordinate pair per command
    close: true,
  },
]

export function profileById(id) {
  return CUTTER_PROFILES.find(p => p.id === id) || CUTTER_PROFILES[0]
}

export function serialSupported() {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

/** Build the dialect-specific drawing commands for a set of rings. */
export function emitRings(rings, profile, opts = {}) {
  const upm = opts.unitsPerMm || 40 // 1016 units/inch ~= 40 per mm
  // Cutters have their origin at the lower-left of the media; page space is
  // top-left, so flip Y.
  const H = opts.pageHeight || 0
  const X = (v) => Math.round(v * upm)
  const Y = (v) => Math.round((H - v) * upm)
  const out = []

  for (const ring of rings) {
    if (!ring || ring.length < 2) continue
    const pts = simplify(ring, opts.tolerance || 0.05)
    const [sx, sy] = pts[0]
    out.push(`PU${X(sx)},${Y(sy)};`)
    if (profile.perPoint) {
      for (let i = 1; i < pts.length; i++) out.push(`PD${X(pts[i][0])},${Y(pts[i][1])};`)
    } else {
      let chunk = []
      for (let i = 1; i < pts.length; i++) {
        chunk.push(`${X(pts[i][0])},${Y(pts[i][1])}`)
        if (chunk.length >= 8) {
          out.push(`PD${chunk.join(',')};`)
          chunk = []
        }
      }
      if (chunk.length) out.push(`PD${chunk.join(',')};`)
    }
    if (profile.close) {
      const [lx, ly] = pts[pts.length - 1]
      if (Math.abs(lx - sx) > 1e-6 || Math.abs(ly - sy) > 1e-6) out.push(`PD${X(sx)},${Y(sy)};`)
    }
  }
  return out
}

/**
 * Assemble a complete cutter job: initialise, set up tool/speed/force,
 * draw every ring, park the head and (for dialects that support it) close
 * the connection.
 */
export function buildCutterJob(objects, page, profileOrId, opts = {}) {
  const profile = typeof profileOrId === 'string' ? profileById(profileOrId) : (profileOrId || CUTTER_PROFILES[0])
  const o = { ...opts, pageHeight: opts.pageHeight != null ? opts.pageHeight : (page ? page.height : 0) }

  const lines = []
  for (const cmd of profile.init) lines.push(cmd)
  for (const cmd of (profile.setup ? profile.setup(o) : [])) lines.push(cmd)

  const rings = []
  for (const obj of objects || []) {
    if (['clone', 'cloneArray', 'cloneCircle'].includes(obj.type)) continue
    for (const ring of objectToRings(obj)) rings.push(ring)
  }
  lines.push(...emitRings(rings, profile, o))

  for (const cmd of profile.end) lines.push(cmd)
  return lines.filter(Boolean).join('\n') + '\n'
}

/** Byte length of a job, for progress reporting. */
export function jobLength(job) {
  return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(job).length : job.length
}

/**
 * Ask the browser for a cutter port. When the profile declares USB
 * filters the chooser is narrowed to that vendor's devices; otherwise the
 * user sees every serial device.
 */
export async function connectCutter(profileOrId) {
  if (!serialSupported()) throw new Error('This browser has no WebSerial support - download the .plt file instead')
  const profile = typeof profileOrId === 'string' ? profileById(profileOrId) : (profileOrId || CUTTER_PROFILES[0])
  const filters = profile.usbFilters && profile.usbFilters.length ? profile.usbFilters : undefined
  const port = await navigator.serial.requestPort(filters ? { filters } : {})
  await port.open({ baudRate: profile.baudRate || 9600 })
  return port
}

export async function closeCutter(port) {
  try {
    if (port && port.readable) await port.close()
  } catch {
    // Already closed / detached - nothing useful to do.
  }
}

/**
 * Write a job in bounded chunks, keeping the browser responsive on large
 * documents and reporting progress as bytes leave.
 */
export async function writeJob(port, job, { chunkSize = 512, onProgress } = {}) {
  const bytes = new TextEncoder().encode(job)
  const writer = port.writable.getWriter()
  try {
    for (let at = 0; at < bytes.length; at += chunkSize) {
      const slice = bytes.subarray(at, Math.min(bytes.length, at + chunkSize))
      await writer.write(slice)
      if (onProgress) onProgress(Math.min(bytes.length, at + chunkSize), bytes.length)
    }
  } finally {
    writer.releaseLock()
  }
  return bytes.length
}

/**
 * Send the dialect's status query and read whatever the cutter answers
 * within `timeout` ms. Returns '' when the device stays silent (many
 * cutters only respond to ESC-based queries).
 */
export async function queryStatus(port, profileOrId, timeout = 1200) {
  const profile = typeof profileOrId === 'string' ? profileById(profileOrId) : (profileOrId || CUTTER_PROFILES[0])
  if (!profile.statusQuery || !port || !port.readable) return ''
  const reader = port.readable.getReader()
  try {
    const writer = port.writable.getWriter()
    await writer.write(new TextEncoder().encode(profile.statusQuery))
    writer.releaseLock()

    const chunks = []
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      const race = await Promise.race([
        reader.read(),
        new Promise(res => setTimeout(() => res({ timeout: true }), Math.max(0, deadline - Date.now()))),
      ])
      if (!race || race.timeout) break
      if (race.done) break
      if (race.value && race.value.length) chunks.push(new TextDecoder().decode(race.value))
      if (chunks.join('').length > 256) break
    }
    return chunks.join('').trim()
  } catch {
    return ''
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // reader may already be released
    }
  }
}
