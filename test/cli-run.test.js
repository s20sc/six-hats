// test/cli-run.test.js
import { describe, it, expect } from 'vitest'
import { runCli } from '../src/cli/run.js'
import { HATS } from '../src/server/hats.js'

function reg(map) {
  const engines = Object.keys(map).map((id) => ({ id, type: 'cli', label: id, run: map[id] }))
  return { get: (id) => engines.find((e) => e.id === id), list: () => engines, localFirst: () => engines }
}
const two = (ids) => HATS.filter((h) => ids.includes(h.id))

describe('runCli', () => {
  it('pins all hats to --engine and collects results', async () => {
    const r = reg({ e: async (p) => (p.includes('其他帽子的发言') ? 'SUM' : 'op') })
    const { results, anyDone } = await runCli({ topic: 'T', hats: HATS, engine: 'e', timeoutMs: 5000 }, r)
    expect(anyDone).toBe(true)
    expect(results.white).toMatchObject({ status: 'done', text: 'op', engineId: 'e' })
    expect(results.blue).toMatchObject({ status: 'done', text: 'SUM' })
  })
  it('throws on unknown --engine', async () => {
    await expect(runCli({ topic: 'T', hats: HATS, engine: 'nope', timeoutMs: 5000 }, reg({ e: async () => 'x' })))
      .rejects.toThrow(/unknown engine/i)
  })
  it('runs only the requested hats', async () => {
    const r = reg({ e: async () => 'op' })
    const { results } = await runCli({ topic: 'T', hats: two(['white', 'red']), engine: 'e', timeoutMs: 5000 }, r)
    expect(Object.keys(results).sort()).toEqual(['red', 'white'])
  })
  it('global timeout yields partial results (slow hat → timed out)', async () => {
    const r = reg({
      fast: async () => 'quick',
      slow: async () => new Promise((res) => setTimeout(() => res('late'), 1000)),
    })
    // pin white→slow via a per-hat engine is not supported; use two hats each on its own engine
    // simplest: everything on 'slow' but timeout before it resolves
    const { results, anyDone } = await runCli({ topic: 'T', hats: two(['white']), engine: 'slow', timeoutMs: 50 }, r)
    expect(anyDone).toBe(false)
    expect(results.white).toMatchObject({ status: 'error' })
    expect(results.white.error).toMatch(/timed out/i)
  })
  it('preserves a hat that finishes before the timeout while flipping unfinished ones', async () => {
    const r = reg({
      e: async (p) => (p.includes('你戴白帽') ? 'fast' : new Promise((res) => setTimeout(() => res('late'), 1000))),
    })
    const { results, anyDone } = await runCli(
      { topic: 'T', hats: HATS.filter((h) => ['white', 'red'].includes(h.id)), engine: 'e', timeoutMs: 50 },
      r
    )
    expect(results.white).toMatchObject({ status: 'done', text: 'fast' })
    expect(results.red.status).toBe('error')
    expect(results.red.error).toMatch(/timed out/i)
    expect(anyDone).toBe(true)
  })
})
