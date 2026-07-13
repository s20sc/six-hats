import { describe, it, expect } from 'vitest'
import { listEnginesText, selectHats, bootstrapPool } from '../src/cli/pool.js'
import { HATS } from '../src/server/hats.js'

const reg = { list: () => [{ id: 'claude', type: 'cli', label: 'claude' }, { id: 'ollama:q', type: 'ollama', label: 'ollama (q)' }] }

describe('cli/pool', () => {
  it('selectHats keeps canonical order', () => {
    expect(selectHats(HATS, ['blue', 'white']).map((h) => h.id)).toEqual(['white', 'blue'])
  })
  it('listEnginesText lists detected engines by family', () => {
    const t = listEnginesText(reg)
    expect(t).toMatch(/claude/)
    expect(t).toMatch(/ollama \(q\)/)
  })
  it('bootstrapPool wires config → detect → skinned hats', async () => {
    const { registry, hats } = await bootstrapPool({
      loadConfig: () => ({ skins: { white: { name: 'FactBot' } }, hatPromptOverrides: {} }),
      detectEngines: async () => reg,
    })
    expect(registry).toBe(reg)
    expect(hats.find((h) => h.id === 'white').name).toBe('FactBot')
    expect(hats).toHaveLength(6)
  })
})
