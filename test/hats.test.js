import { describe, it, expect } from 'vitest'
import { HATS, hatPrompt, bluePrompt, applySkin, applyPromptOverrides } from '../src/server/hats.js'

describe('hats', () => {
  it('has six hats in canonical order', () => {
    expect(HATS.map((h) => h.id)).toEqual(['white', 'red', 'black', 'yellow', 'green', 'blue'])
  })
  it('hatPrompt embeds system persona and topic', () => {
    const p = hatPrompt(HATS[0], '要不要做 X')
    expect(p).toContain(HATS[0].system)
    expect(p).toContain('要不要做 X')
  })
  it('bluePrompt includes every contribution', () => {
    const p = bluePrompt('T', [{ name: 'White', text: 'facts' }, { name: 'Red', text: 'gut' }])
    expect(p).toContain('facts')
    expect(p).toContain('gut')
  })
  it('applySkin overrides display name but keeps persona', () => {
    const skinned = applySkin(HATS, { white: { name: 'Scout' } })
    const white = skinned.find((h) => h.id === 'white')
    expect(white.name).toBe('Scout')
    expect(white.system).toBe(HATS[0].system)
  })
  it('applyPromptOverrides overrides system prompt and leaves others unchanged', () => {
    const overridden = applyPromptOverrides(HATS, { white: 'CUSTOM' })
    const white = overridden.find((h) => h.id === 'white')
    expect(white.system).toBe('CUSTOM')
    const red = overridden.find((h) => h.id === 'red')
    expect(red.system).toBe(HATS.find((h) => h.id === 'red').system)
  })
})
