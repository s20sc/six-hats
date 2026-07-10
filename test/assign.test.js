import { describe, it, expect } from 'vitest'
import { assignEngines } from '../src/server/assign.js'
import { HATS } from '../src/server/hats.js'

const eng = (id) => ({ id, type: 'cli', run: async () => '' })

describe('assign', () => {
  it('assigns every hat an engine', () => {
    const a = assignEngines(HATS, [eng('a'), eng('b'), eng('c')], { rng: () => 0 })
    expect(Object.keys(a).sort()).toEqual(HATS.map((h) => h.id).sort())
  })
  it('honors pins', () => {
    const a = assignEngines(HATS, [eng('a'), eng('b')], { pins: { blue: 'b' }, rng: () => 0 })
    expect(a.blue).toBe('b')
  })
  it('reuses engines when pool smaller than 6', () => {
    const a = assignEngines(HATS, [eng('only')], { rng: () => 0 })
    expect(Object.values(a).every((id) => id === 'only')).toBe(true)
  })
  it('is deterministic under seeded rng', () => {
    const seed = () => 0.42
    const a = assignEngines(HATS, [eng('a'), eng('b'), eng('c')], { rng: seed })
    const b = assignEngines(HATS, [eng('a'), eng('b'), eng('c')], { rng: seed })
    expect(a).toEqual(b)
  })
  it('draws non-pinned hats only from local engines when a local engine exists', () => {
    const engines = [
      { id: 'claude', type: 'cli', run: async () => '' },
      { id: 'gpt', type: 'cloud', run: async () => '' },
    ]
    const a = assignEngines(HATS, engines, { rng: () => 0.99 })
    expect(Object.values(a).every((id) => id === 'claude')).toBe(true)
  })
  it('falls back to cloud engines when there are zero local engines', () => {
    const engines = [{ id: 'gpt', type: 'cloud', run: async () => '' }]
    const a = assignEngines(HATS, engines, { rng: () => 0.99 })
    expect(Object.values(a).every((id) => id === 'gpt')).toBe(true)
  })
})
