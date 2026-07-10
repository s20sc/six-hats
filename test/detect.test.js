import { describe, it, expect } from 'vitest'
import { detectEngines, summarize } from '../src/server/engines/detect.js'

describe('detect', () => {
  it('registers only installed CLIs, ollama models, and keyed cloud', async () => {
    const cfg = { cloud: [{ id: 'openai', label: 'OpenAI', baseUrl: 'https://h/v1', apiKey: 'sk', models: ['gpt-4o'] }], custom: [] }
    const reg = await detectEngines(cfg, {
      which: (bin) => (bin === 'claude' || bin === 'agy' ? `/usr/bin/${bin}` : null),
      listOllama: async () => ['qwen2.5'],
      fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
    })
    const ids = reg.list().map((e) => e.id).sort()
    expect(ids).toContain('claude')
    expect(ids).toContain('agy')
    expect(ids).not.toContain('codex')       // not installed
    expect(ids).toContain('ollama:qwen2.5')
    expect(ids).toContain('openai:gpt-4o')
  })
  it('summarize groups by family', async () => {
    const cfg = { cloud: [], custom: [] }
    const reg = await detectEngines(cfg, { which: (b) => (b === 'claude' ? '/x' : null), listOllama: async () => [] })
    const s = summarize(reg)
    expect(s.cli).toEqual(['claude'])
    expect(s.cloud).toEqual([])
  })
})
