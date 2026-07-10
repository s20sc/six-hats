import { describe, it, expect } from 'vitest'
import { listOllamaModels, makeOllamaEngine } from '../src/server/engines/ollama.js'

const okFetch = (body) => async () => ({ ok: true, json: async () => body })

describe('ollama adapter', () => {
  it('lists model names from /api/tags', async () => {
    const models = await listOllamaModels({ fetchImpl: okFetch({ models: [{ name: 'qwen2.5' }, { name: 'llama3' }] }) })
    expect(models).toEqual(['qwen2.5', 'llama3'])
  })
  it('filters out embedding models', async () => {
    const models = await listOllamaModels({
      fetchImpl: okFetch({ models: [{ name: 'qwen2.5' }, { name: 'nomic-embed-text' }, { name: 'llama3' }] }),
    })
    expect(models).toEqual(['qwen2.5', 'llama3'])
  })
  it('returns [] when unreachable', async () => {
    const models = await listOllamaModels({ fetchImpl: async () => { throw new Error('econnrefused') } })
    expect(models).toEqual([])
  })
  it('returns [] when the server responds non-ok', async () => {
    const models = await listOllamaModels({ fetchImpl: async () => ({ ok: false }) })
    expect(models).toEqual([])
  })
  it('engine.run posts to /api/chat and returns content', async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ message: { content: 'hola' } }) })
    const eng = makeOllamaEngine('qwen2.5', { fetchImpl })
    expect(eng.type).toBe('ollama')
    expect(await eng.run('hi')).toBe('hola')
  })
  it('engine.run throws on non-ok HTTP response', async () => {
    const fetchImpl = async () => ({ ok: false, status: 500 })
    const eng = makeOllamaEngine('qwen2.5', { fetchImpl })
    await expect(eng.run('hi')).rejects.toThrow(/500/)
  })
  it('engine.run throws on empty/blank content', async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ message: { content: '  ' } }) })
    const eng = makeOllamaEngine('qwen2.5', { fetchImpl })
    await expect(eng.run('hi')).rejects.toThrow(/empty/)
  })
})
