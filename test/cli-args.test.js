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
  it('reorders --hats to canonical order and de-dups', () => {
    expect(parseArgs(['t', '--hats', 'blue,white,white']).hats).toEqual(['white', 'blue'])
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
  it('rejects extra positionals', () => {
    expect(() => parseArgs(['a', 'b'])).toThrow(/too many arguments/i)
  })
  it('rejects --hats that matches no valid hats', () => {
    expect(() => parseArgs(['t', '--hats', ''])).toThrow(/matched no valid hats/i)
    expect(() => parseArgs(['t', '--hats', ','])).toThrow(/matched no valid hats/i)
  })
  it('rejects blue-only hats', () => {
    expect(() => parseArgs(['t', '--hats', 'blue'])).toThrow(/only synthesizes/i)
  })
  it('rejects a non-positive or non-finite --timeout', () => {
    expect(() => parseArgs(['t', '--timeout', '0'])).toThrow(/positive number of seconds/i)
    expect(() => parseArgs(['t', '--timeout=-5'])).toThrow(/positive number of seconds/i)
    expect(() => parseArgs(['t', '--timeout', 'Infinity'])).toThrow(/positive number of seconds/i)
  })
})
