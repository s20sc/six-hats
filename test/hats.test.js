import { describe, it, expect } from 'vitest'
import { HATS, hatPrompt, bluePrompt, applySkin } from '../src/server/hats.js'

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
    const skinned = applySkin(HATS, { white: { name: '双儿' } })
    const white = skinned.find((h) => h.id === 'white')
    expect(white.name).toBe('双儿')
    expect(white.system).toBe(HATS[0].system)
  })
})
