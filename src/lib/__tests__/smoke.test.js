import { describe, it, expect } from 'vitest'
import { runSmokeSweep, TOOLS, PANELS, DIALOGS, COMMANDS } from '../smoke'

describe('smoke sweep', () => {
  it('runs clean with zero errors', () => {
    const result = runSmokeSweep()
    expect(result).toHaveLength(0)
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('exposes the full tool/panel/dialog/command inventories', () => {
    expect(TOOLS.length).toBeGreaterThan(40)
    expect(PANELS.length).toBe(6)
    expect(DIALOGS.length).toBe(12)
    expect(COMMANDS.length).toBeGreaterThan(100)
  })

  it('reports problems for bad registries', () => {
    const result = runSmokeSweep({ tools: [{ id: 'select' }], panels: [], dialogs: [], commands: [] })
    expect(result.length).toBeGreaterThan(0)
    expect(result.ok).toBe(false)
  })
})