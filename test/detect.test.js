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
  it('registers the openclaw CLI engine when cfg.openclawAgent is set', async () => {
    const cfg = { cloud: [], custom: [], openclawAgent: 'main' }
    const reg = await detectEngines(cfg, {
      which: (bin) => (bin === 'openclaw' ? '/usr/bin/openclaw' : null),
      listOllama: async () => [],
    })
    const ids = reg.list().map((e) => e.id)
    expect(ids).toContain('openclaw:main')
  })
  it('auto-detects every local openclaw agent when none is configured', async () => {
    const cfg = { cloud: [], custom: [] }
    const reg = await detectEngines(cfg, {
      which: (bin) => (bin === 'openclaw' ? '/usr/bin/openclaw' : null),
      listOllama: async () => [],
      listOpenclaw: () => ['main', 'writer'],
    })
    const ids = reg.list().map((e) => e.id).sort()
    expect(ids).toEqual(['openclaw:main', 'openclaw:writer'])
  })
  it('does not register openclaw when the binary is absent', async () => {
    const reg = await detectEngines({ cloud: [], custom: [] }, {
      which: () => null,
      listOllama: async () => [],
      listOpenclaw: () => ['main'],   // even if agents exist, no binary → nothing
    })
    expect(reg.list().some((e) => e.type === 'cli' && e.id.startsWith('openclaw'))).toBe(false)
  })
  it('summarize groups by family', async () => {
    const cfg = { cloud: [], custom: [] }
    const reg = await detectEngines(cfg, { which: (b) => (b === 'claude' ? '/x' : null), listOllama: async () => [] })
    const s = summarize(reg)
    expect(s.cli).toEqual(['claude'])
    expect(s.cloud).toEqual([])
  })
})
