import { describe, it, expect } from 'vitest'
import { detectEngines, summarize } from '../src/server/engines/detect.js'

// Isolate every test from the real ~/.six-hats/cloud.json via loadCloud: () => [].
describe('detect', () => {
  it('registers only installed CLIs, ollama models, and keyed cloud', async () => {
    const cfg = { cloud: [{ id: 'openai', label: 'OpenAI', baseUrl: 'https://h/v1', apiKey: 'sk', models: ['gpt-4o'] }], custom: [] }
    const reg = await detectEngines(cfg, {
      which: (bin) => (bin === 'claude' || bin === 'agy' ? `/usr/bin/${bin}` : null),
      listOllama: async () => ['qwen2.5'],
      loadCloud: () => [],
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
      loadCloud: () => [],
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
      loadCloud: () => [],
    })
    const ids = reg.list().map((e) => e.id).sort()
    expect(ids).toEqual(['openclaw:main', 'openclaw:writer'])
  })
  it('ignores empty/invalid entries in a configured openclawAgent array', async () => {
    const cfg = { cloud: [], custom: [], openclawAgent: ['main', null, '  ', 'writer', 'main'] }
    const reg = await detectEngines(cfg, {
      which: (bin) => (bin === 'openclaw' ? '/usr/bin/openclaw' : null),
      listOllama: async () => [],
      loadCloud: () => [],
    })
    const ids = reg.list().map((e) => e.id).sort()
    expect(ids).toEqual(['openclaw:main', 'openclaw:writer'])
  })
  it('does not register openclaw when the binary is absent', async () => {
    const reg = await detectEngines({ cloud: [], custom: [] }, {
      which: () => null,
      listOllama: async () => [],
      listOpenclaw: () => ['main'],   // even if agents exist, no binary → nothing
      loadCloud: () => [],
    })
    expect(reg.list().some((e) => e.type === 'cli' && e.id.startsWith('openclaw'))).toBe(false)
  })
  it('registers user-added cloud providers as engines', async () => {
    const reg = await detectEngines({ cloud: [], custom: [] }, {
      which: () => null,
      listOllama: async () => [],
      loadCloud: () => [{ id: 'openai--gpt-4o-mini', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk', models: ['gpt-4o-mini'] }],
    })
    const engines = reg.list()
    expect(engines.map((e) => e.id)).toContain('openai--gpt-4o-mini:gpt-4o-mini')
    expect(engines.find((e) => e.id.startsWith('openai--')).type).toBe('cloud')
  })
  it('summarize groups by family', async () => {
    const cfg = { cloud: [], custom: [] }
    const reg = await detectEngines(cfg, { which: (b) => (b === 'claude' ? '/x' : null), listOllama: async () => [], loadCloud: () => [] })
    const s = summarize(reg)
    expect(s.cli).toEqual(['claude'])
    expect(s.cloud).toEqual([])
  })
})
