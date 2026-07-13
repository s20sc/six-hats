import { describe, it, expect } from 'vitest'
import { parseArgs, HAT_IDS } from '../src/cli/args.js'

describe('parseArgs', () => {
  it('takes the topic as a positional', () => {
    expect(parseArgs(['要不要接 offer']).topic).toBe('要不要接 offer')
  })
  it('defaults to all six hats in canonical order', () => {
    expect(parseArgs(['t']).hats).toEqual(HAT_IDS)
  })
  it('parses --engine, --json, --quiet', () => {
    const o = parseArgs(['t', '--engine', 'claude', '--json', '--quiet'])
    expect(o.engine).toBe('claude'); expect(o.json).toBe(true); expect(o.quiet).toBe(true)
  })
  it('parses and validates --hats subset', () => {
    expect(parseArgs(['t', '--hats', 'white,blue']).hats).toEqual(['white', 'blue'])
  })
  it('rejects an unknown hat id', () => {
    expect(() => parseArgs(['t', '--hats', 'pink'])).toThrow(/unknown hat/i)
  })
  it('--timeout is seconds → ms, default 180000', () => {
    expect(parseArgs(['t']).timeoutMs).toBe(180000)
    expect(parseArgs(['t', '--timeout', '30']).timeoutMs).toBe(30000)
  })
  it('--list-engines needs no topic', () => {
    expect(parseArgs(['--list-engines']).listEngines).toBe(true)
  })
  it('requires a topic otherwise', () => {
    expect(() => parseArgs([])).toThrow(/topic/i)
  })
})
