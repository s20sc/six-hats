import { describe, it, expect } from 'vitest'
import { listOllamaModels, makeOllamaEngine } from '../src/server/engines/ollama.js'

const okFetch = (body) => async () => ({ ok: true, json: async () => body })

describe('ollama adapter', () => {
  it('lists model names from /api/tags', async () => {
    const models = await listOllamaModels({ fetchImpl: okFetch({ models: [{ name: 'qwen2.5' }, { name: 'llama3' }] }) })
    expect(models).toEqual(['qwen2.5', 'llama3'])
  })
  it('returns [] when unreachable', async () => {
    const models = await listOllamaModels({ fetchImpl: async () => { throw new Error('econnrefused') } })
    expect(models).toEqual([])
  })
  it('engine.run posts to /api/chat and returns content', async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ message: { content: 'hola' } }) })
    const eng = makeOllamaEngine('qwen2.5', { fetchImpl })
    expect(eng.type).toBe('ollama')
    expect(await eng.run('hi')).toBe('hola')
  })
})
