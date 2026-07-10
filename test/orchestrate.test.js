import { describe, it, expect } from 'vitest'
import { runDeliberation } from '../src/server/orchestrate.js'
import { HATS } from '../src/server/hats.js'

function fakeRegistry(map) {
  return { get: (id) => ({ id, run: map[id] }) }
}

describe('orchestrate', () => {
  it('collects five contributions then blue summary', async () => {
    const reg = fakeRegistry({ e: async (p) => (p.includes('其他帽子的发言') ? 'SUMMARY' : 'op') })
    const assignment = Object.fromEntries(HATS.map((h) => [h.id, 'e']))
    const res = await runDeliberation({ topic: 'T', hats: HATS, registry: reg, assignment })
    expect(res.contributions).toHaveLength(5)
    expect(res.summary).toBe('SUMMARY')
    expect(res.errors).toEqual({})
  })
  it('isolates a failing hat and still summarizes the rest', async () => {
    const reg = fakeRegistry({
      good: async (p) => (p.includes('其他帽子的发言') ? 'SUM' : 'ok'),
      bad: async () => { throw new Error('boom') },
    })
    const assignment = Object.fromEntries(HATS.map((h) => [h.id, h.id === 'red' ? 'bad' : 'good']))
    const res = await runDeliberation({ topic: 'T', hats: HATS, registry: reg, assignment })
    expect(res.errors.red).toMatch(/boom/)
    expect(res.contributions).toHaveLength(4)
    expect(res.summary).toBe('SUM')
  })
})
