import { describe, it, expect, vi } from 'vitest'
import { createDesktopBackend, acceptToFilters, bytesToBase64, base64ToBlob } from '../desktop'

const fakeBridge = (over = {}) => ({
  isDesktop: true,
  openDialog: vi.fn(async () => ({ canceled: true })),
  saveDialog: vi.fn(async () => ({ canceled: false, path: 'C:/out/file.plt' })),
  readFile: vi.fn(),
  writeFile: vi.fn(async () => ({ ok: true })),
  print: { 
    document: vi.fn(async () => ({ ok: true, via: 'os' })),
    toPdf: vi.fn(async () => ({ ok: true, path: 'C:/out/file.pdf', bytes: 1000 })),
    listPrinters: vi.fn(async () => ({ printers: [] }))
  },
  ports: {
    open: vi.fn(async () => ({ ok: true })),
    write: vi.fn(async () => ({ ok: true })),
    close: vi.fn(async () => ({ ok: true })),
  },
  ...over,
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
