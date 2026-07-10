import { describe, it, expect } from 'vitest'
import { CLI_TABLE, cleanOutput, makeCliEngine } from '../src/server/engines/cli.js'

describe('cli adapter', () => {
  it('claude builds -p prompt args', () => {
    expect(CLI_TABLE.claude.buildArgs('hello')).toEqual(['-p', 'hello'])
  })
  it('codex builds exec prompt args', () => {
    expect(CLI_TABLE.codex.buildArgs('hi')).toEqual(['exec', 'hi'])
  })
  it('hermes adds -m when model given', () => {
    expect(CLI_TABLE.hermes.buildArgs('q', 'gpt-4o')).toEqual(['-z', 'q', '-m', 'gpt-4o'])
    expect(CLI_TABLE.hermes.buildArgs('q')).toEqual(['-z', 'q'])
  })
  it('cleanOutput strips ANSI and trims for raw', () => {
    expect(cleanOutput('[32mhi[0m\n', 'raw')).toBe('hi')
  })
  it('makeCliEngine runs via injected spawn and returns cleaned text', async () => {
    const fakeSpawn = () => makeFakeChild(0, 'the answer\n', '')
    const eng = makeCliEngine('claude', {}, { which: () => '/usr/bin/claude', spawnImpl: fakeSpawn })
    expect(await eng.run('anything')).toBe('the answer')
  })
  it('makeCliEngine returns null when bin missing', () => {
    const eng = makeCliEngine('claude', {}, { which: () => null })
    expect(eng).toBe(null)
  })
})

// minimal EventEmitter-like fake child
function makeFakeChild(code, stdout, stderr) {
  const listeners = {}
  const child = {
    stdout: { on: (ev, cb) => { listeners[`out:${ev}`] = cb } },
    stderr: { on: (ev, cb) => { listeners[`err:${ev}`] = cb } },
    on: (ev, cb) => { listeners[ev] = cb },
    kill: () => {},
  }
  queueMicrotask(() => {
    if (stdout) listeners['out:data']?.(Buffer.from(stdout))
    if (stderr) listeners['err:data']?.(Buffer.from(stderr))
    listeners['close']?.(code)
  })
  return child
}
