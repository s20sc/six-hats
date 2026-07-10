import { describe, it, expect } from 'vitest'
import { makeEngine, EngineRegistry } from '../src/server/engines/registry.js'

describe('engine registry', () => {
  it('localFirst orders local engines before cloud', () => {
    const reg = new EngineRegistry()
    reg.add(makeEngine({ id: 'gpt', type: 'cloud', label: 'GPT', run: async () => 'x' }))
    reg.add(makeEngine({ id: 'claude', type: 'cli', label: 'Claude', run: async () => 'y' }))
    reg.add(makeEngine({ id: 'qwen', type: 'ollama', label: 'Qwen', run: async () => 'z' }))
    const ids = reg.localFirst().map((e) => e.id)
    expect(ids.indexOf('gpt')).toBe(2)
    expect(ids.slice(0, 2).sort()).toEqual(['claude', 'qwen'])
  })
  it('get returns by id, list returns all', () => {
    const reg = new EngineRegistry()
    reg.add(makeEngine({ id: 'a', type: 'cli', label: 'A', run: async () => '' }))
    expect(reg.get('a').id).toBe('a')
    expect(reg.list()).toHaveLength(1)
  })
})
