import { describe, it, expect } from 'vitest'
import { makeOpenAiEngine } from '../src/server/engines/openai.js'

describe('openai-compat adapter', () => {
  it('posts to {baseUrl}/chat/completions with bearer auth and returns content', async () => {
    let seen
    const fetchImpl = async (url, opts) => { seen = { url, opts }; return { ok: true, json: async () => ({ choices: [{ message: { content: 'cloud says hi' } }] }) } }
    const eng = makeOpenAiEngine({ id: 'openai:gpt-4o', label: 'GPT-4o', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-x', model: 'gpt-4o', fetchImpl })
    const text = await eng.run('hi')
    expect(text).toBe('cloud says hi')
    expect(seen.url).toBe('https://api.openai.com/v1/chat/completions')
    expect(seen.opts.headers.Authorization).toBe('Bearer sk-x')
    expect(eng.type).toBe('cloud')
  })
  it('throws on non-ok', async () => {
    const eng = makeOpenAiEngine({ id: 'x', label: 'x', baseUrl: 'https://h/v1', apiKey: 'k', model: 'm', fetchImpl: async () => ({ ok: false, status: 401, text: async () => 'bad key' }) })
    await expect(eng.run('hi')).rejects.toThrow(/401/)
  })
  it('throws when message content is empty or blank', async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '   ' } }] }) })
    const eng = makeOpenAiEngine({ id: 'x', label: 'x', baseUrl: 'https://h/v1', apiKey: 'k', model: 'm', fetchImpl })
    await expect(eng.run('hi')).rejects.toThrow(/empty/)
  })
  it('includes the model field in the request body', async () => {
    let seen
    const fetchImpl = async (url, opts) => { seen = opts; return { ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) } }
    const eng = makeOpenAiEngine({ id: 'x', label: 'x', baseUrl: 'https://h/v1', apiKey: 'k', model: 'gpt-4o-mini', fetchImpl })
    await eng.run('hi')
    const body = JSON.parse(seen.body)
    expect(body.model).toBe('gpt-4o-mini')
  })
})
