import { describe, it, expect } from 'vitest'
import { CLI_TABLE, cleanOutput, makeCliEngine, listOpenclawAgents } from '../src/server/engines/cli.js'

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
    expect(cleanOutput('\x1b[32mhi\x1b[0m\n', 'raw')).toBe('hi')
  })
  it('cleanOutput parses openclaw-json payload text', () => {
    expect(cleanOutput('log line\n{"result":{"payloads":[{"text":"hi there"}]}}', 'openclaw-json')).toBe('hi there')
  })
  it('openclaw buildArgs throws without a model/agent id', () => {
    expect(() => CLI_TABLE.openclaw.buildArgs('p')).toThrow('openclaw requires an agent id (model)')
  })
  it('listOpenclawAgents parses column-0 agent ids and ignores boxed noise', () => {
    const out = [
      '[state-migrations] warning',
      '│  - Left legacy config health state in place  │',
      'Agents:',
      '- main (default)',
      '  Identity: 🪕 蔡文姬 (IDENTITY.md)',
      '- writer',
      '  Identity: X',
      '',
      'Routing rules map channel/account/peer to an agent.',
    ].join('\n')
    const agents = listOpenclawAgents({ which: () => '/usr/bin/openclaw', execImpl: () => out })
    expect(agents).toEqual(['main', 'writer'])
  })
  it('listOpenclawAgents returns [] when openclaw is not installed', () => {
    expect(listOpenclawAgents({ which: () => null })).toEqual([])
  })
  it('listOpenclawAgents still parses stdout when the CLI exits non-zero', () => {
    const throwing = () => { const e = new Error('exit 1'); e.stdout = 'Agents:\n- main (default)\n'; throw e }
    expect(listOpenclawAgents({ which: () => '/bin/openclaw', execImpl: throwing })).toEqual(['main'])
  })
  it('makeCliEngine runs via injected spawn and returns cleaned text', async () => {
    let seenBin, seenArgs
    const fakeSpawn = (bin, args) => { seenBin = bin; seenArgs = args; return makeFakeChild(0, 'the answer\n', '') }
    const eng = makeCliEngine('claude', {}, { which: () => '/usr/bin/claude', spawnImpl: fakeSpawn })
    expect(await eng.run('anything')).toBe('the answer')
    expect(seenBin).toBe('claude')
    expect(seenArgs).toEqual(['-p', 'anything'])
  })
  it('makeCliEngine returns null when bin missing', () => {
    const eng = makeCliEngine('claude', {}, { which: () => null })
    expect(eng).toBe(null)
  })
  it('makeCliEngine rejects when the child exits non-zero, even with stdout', async () => {
    const fakeSpawn = () => makeFakeChild(1, 'partial output\n', 'boom')
    const eng = makeCliEngine('claude', {}, { which: () => '/usr/bin/claude', spawnImpl: fakeSpawn })
    await expect(eng.run('anything')).rejects.toThrow(/exited 1/)
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

import { stripLeadingNoise } from '../src/server/engines/cli.js'
describe('stripLeadingNoise', () => {
  it('drops leading Claude Code hook preamble but keeps the answer', () => {
    const raw = 'No skills needed\n\nActivating: foo — bar\n\n台风来了要囤水和干粮。\n还有充电宝。'
    expect(stripLeadingNoise(raw)).toBe('台风来了要囤水和干粮。\n还有充电宝。')
  })
  it('leaves clean output untouched', () => {
    expect(stripLeadingNoise('直接就是答案')).toBe('直接就是答案')
  })
})
