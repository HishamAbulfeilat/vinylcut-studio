import { describe, it, expect, vi } from 'vitest'
import { selectBackend } from '../index'
import { createWebBackend } from '../web'
import { createDesktopBackend, acceptToFilters, bytesToBase64, base64ToBlob } from '../desktop'

const fakeBridge = (over = {}) => ({
  isDesktop: true,
  openDialog: vi.fn(async () => ({ canceled: true })),
  saveDialog: vi.fn(async () => ({ canceled: false, path: 'C:/out/file.plt' })),
  readFile: vi.fn(),
  writeFile: vi.fn(async () => ({ ok: true })),
  print: { document: vi.fn(async () => ({ ok: true, via: 'os' })) },
  ports: {
    open: vi.fn(async () => ({ ok: true })),
    write: vi.fn(async () => ({ ok: true })),
    close: vi.fn(async () => ({ ok: true })),
  },
  ...over,
})

describe('selectBackend', () => {
  it('picks desktop when the preload bridge is present', () => {
    expect(selectBackend({ vcsDesktop: fakeBridge() }).kind).toBe('desktop')
  })

  it('picks web with no bridge', () => {
    expect(selectBackend({}).kind).toBe('web')
    expect(selectBackend(undefined).kind).toBe('web')
  })

  it('ignores a bridge that does not claim isDesktop', () => {
    expect(selectBackend({ vcsDesktop: { isDesktop: false } }).kind).toBe('web')
  })
})

describe('desktop backend', () => {
  it('saveFile writes base64 content to the chosen path', async () => {
    const bridge = fakeBridge()
    const be = createDesktopBackend(bridge)
    const res = await be.saveFile({ suggestedName: 'a.txt', data: 'hello' })
    expect(res).toEqual({ saved: true, path: 'C:/out/file.plt' })
    expect(bridge.saveDialog).toHaveBeenCalledWith({ title: 'Save As', defaultPath: 'a.txt' })
    expect(bridge.writeFile).toHaveBeenCalledWith('C:/out/file.plt', btoa('hello'))
  })

  it('saveFile reports cancel without writing', async () => {
    const bridge = fakeBridge({ saveDialog: vi.fn(async () => ({ canceled: true })) })
    const res = await createDesktopBackend(bridge).saveFile({ suggestedName: 'a', data: 'x' })
    expect(res).toEqual({ saved: false })
    expect(bridge.writeFile).not.toHaveBeenCalled()
  })

  it('openFiles returns [] on cancel and Files on success', async () => {
    expect(await createDesktopBackend(fakeBridge()).openFiles({})).toEqual([])
    const bridge = fakeBridge({
      openDialog: vi.fn(async () => ({ canceled: false, paths: ['/x/a.svg'] })),
      readFile: vi.fn(async () => ({ name: 'a.svg', data: btoa('<svg/>') })),
    })
    const files = await createDesktopBackend(bridge).openFiles({ accept: '.svg' })
    expect(files).toHaveLength(1)
    expect(files[0].name).toBe('a.svg')
    expect(await files[0].text()).toBe('<svg/>')
    expect(bridge.openDialog.mock.calls[0][0].filters[0]).toEqual({ name: 'Supported Files', extensions: ['svg'] })
  })

  it('printDocument goes through the OS print pipeline', async () => {
    const bridge = fakeBridge()
    expect(await createDesktopBackend(bridge).printDocument({ silent: true })).toEqual({ ok: true, via: 'os' })
    expect(bridge.print.document).toHaveBeenCalledWith({ silent: true })
  })

  it('cutter connect/write/close use the ports bridge', async () => {
    const bridge = fakeBridge()
    const { cutter } = createDesktopBackend(bridge)
    const h = await cutter.connect({ id: 'hpgl' })
    expect(bridge.ports.open).toHaveBeenCalledWith({ profile: 'hpgl' })
    expect(await cutter.write(h, 'IN;')).toBe(3)
    expect(bridge.ports.write).toHaveBeenCalledWith('IN;')
    await cutter.close(h)
    expect(bridge.ports.close).toHaveBeenCalled()
  })

  it('cutter connect surfaces an unavailable port honestly', async () => {
    const bridge = fakeBridge({
      ports: { open: vi.fn(async () => ({ ok: false, unavailable: true, reason: 'not wired' })) },
    })
    await expect(createDesktopBackend(bridge).cutter.connect({ id: 'x' })).rejects.toThrow('not wired')
  })

  it('helpers: accept filters and base64 round trip', async () => {
    expect(acceptToFilters('*')).toEqual([{ name: 'All Files', extensions: ['*'] }])
    expect(acceptToFilters('.svg, .dxf')[0].extensions).toEqual(['svg', 'dxf'])
    const bytes = new Uint8Array([0, 1, 2, 250, 255])
    const back = new Uint8Array(await base64ToBlob(bytesToBase64(bytes), '').arrayBuffer())
    expect(Array.from(back)).toEqual(Array.from(bytes))
  })
})

describe('web backend', () => {
  it('reports serial cutter availability from navigator.serial', () => {
    const web = createWebBackend({})
    // Node has no navigator.serial
    expect(web.cutter.available()).toBe(false)
  })

  it('saveFile uses the File System Access picker when present', async () => {
    const write = vi.fn()
    const close = vi.fn()
    const win = { showSaveFilePicker: vi.fn(async () => ({ name: 'x.plt', createWritable: async () => ({ write, close }) })) }
    const res = await createWebBackend(win).saveFile({ suggestedName: 'x.plt', data: 'IN;' })
    expect(res).toEqual({ saved: true, path: 'x.plt' })
    expect(write).toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
  })

  it('saveFile treats picker abort as cancel', async () => {
    const win = { showSaveFilePicker: vi.fn(async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }) }) }
    expect(await createWebBackend(win).saveFile({ suggestedName: 'x', data: 'a' })).toEqual({ saved: false })
  })

  it('saveFile falls back to an anchor download without a picker', async () => {
    const click = vi.fn()
    const a = { click, remove: vi.fn() }
    const win = {
      document: { createElement: vi.fn(() => a), body: { appendChild: vi.fn() } },
      URL: { createObjectURL: vi.fn(() => 'blob:1'), revokeObjectURL: vi.fn() },
    }
    const res = await createWebBackend(win).saveFile({ suggestedName: 'out.svg', mime: 'image/svg+xml', data: '<svg/>' })
    expect(res).toEqual({ saved: true })
    expect(a.download).toBe('out.svg')
    expect(a.href).toBe('blob:1')
    expect(click).toHaveBeenCalled()
  })

  it('saveFile falls back to download when the picker fails for another reason', async () => {
    const a = { click: vi.fn(), remove: vi.fn() }
    const win = {
      showSaveFilePicker: vi.fn(async () => { throw new Error('SecurityError') }),
      document: { createElement: vi.fn(() => a), body: { appendChild: vi.fn() } },
      URL: { createObjectURL: vi.fn(() => 'blob:2'), revokeObjectURL: vi.fn() },
    }
    expect(await createWebBackend(win).saveFile({ suggestedName: 'o', data: 'a' })).toEqual({ saved: true })
    expect(a.click).toHaveBeenCalled()
  })

  it('openFiles uses showOpenFilePicker and returns [] on abort', async () => {
    const file = { name: 'a.svg' }
    const win = { showOpenFilePicker: vi.fn(async () => [{ getFile: async () => file }]) }
    expect(await createWebBackend(win).openFiles({ accept: '.svg' })).toEqual([file])
    const aborting = { showOpenFilePicker: vi.fn(async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }) }) }
    expect(await createWebBackend(aborting).openFiles({})).toEqual([])
  })

  it('printDocument calls window.print', async () => {
    const win = { print: vi.fn() }
    expect(await createWebBackend(win).printDocument()).toEqual({ ok: true, via: 'browser' })
    expect(win.print).toHaveBeenCalled()
  })
})
