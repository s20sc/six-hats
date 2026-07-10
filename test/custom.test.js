import { describe, it, expect } from 'vitest'
import { makeCustomEngine } from '../src/server/engines/custom.js'

describe('custom template adapter', () => {
  it('passes prompt via SIXHATS_PROMPT env, not string interpolation', async () => {
    let seenEnv
    const spawnImpl = (bin, args, opts) => {
      seenEnv = opts.env.SIXHATS_PROMPT
      const l = {}
      const child = { stdout: { on: (e, cb) => { l[`o${e}`] = cb } }, stderr: { on: () => {} }, on: (e, cb) => { l[e] = cb }, kill: () => {} }
      queueMicrotask(() => { l['odata']?.(Buffer.from('custom out\n')); l['close']?.(0) })
      return child
    }
    const eng = makeCustomEngine({ name: 'mytool', cmd: 'echo "$SIXHATS_PROMPT"', parse: 'raw' }, { spawnImpl })
    const text = await eng.run('inject; rm -rf /')
    expect(text).toBe('custom out')
    expect(seenEnv).toBe('inject; rm -rf /')
    expect(eng.type).toBe('custom')
  })

  it('rejects with an error mentioning "empty" when the child prints no output', async () => {
    const spawnImpl = () => {
      const l = {}
      const child = { stdout: { on: (e, cb) => { l[`o${e}`] = cb } }, stderr: { on: () => {} }, on: (e, cb) => { l[e] = cb }, kill: () => {} }
      queueMicrotask(() => { l['close']?.(0) })
      return child
    }
    const eng = makeCustomEngine({ name: 'mytool', cmd: 'true', parse: 'raw' }, { spawnImpl })
    await expect(eng.run('hello')).rejects.toThrow(/empty/)
  })
})
