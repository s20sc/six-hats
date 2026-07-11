import { EngineRegistry } from './registry.js'
import { CLI_TABLE, makeCliEngine, whichSync, listOpenclawAgents } from './cli.js'
import { loadCloudProviders } from '../cloud-store.js'
import { listOllamaModels, makeOllamaEngine } from './ollama.js'
import { makeOpenAiEngine } from './openai.js'
import { makeCustomEngine } from './custom.js'

export async function detectEngines(cfg, deps = {}) {
  const which = deps.which ?? whichSync
  const listOllama = deps.listOllama ?? ((d) => listOllamaModels(d))
  const listOpenclaw = deps.listOpenclaw ?? ((d) => listOpenclawAgents(d))
  const loadCloud = deps.loadCloud ?? (() => loadCloudProviders())
  const reg = new EngineRegistry()

  // Built-in CLI tools. openclaw needs an agent id per engine: by default we
  // auto-detect every local agent; cfg.openclawAgent (string or array) pins it.
  for (const tool of Object.keys(CLI_TABLE)) {
    if (tool === 'openclaw') {
      if (!which('openclaw')) continue
      const configured = cfg.openclawAgent
      const raw = Array.isArray(configured) ? configured
        : configured ? [configured]
        : await listOpenclaw({ which })
      const agents = [...new Set(raw.filter((a) => typeof a === 'string' && a.trim()).map((a) => a.trim()))]
      for (const agent of agents) {
        const e = makeCliEngine('openclaw', { model: agent }, { which })
        if (e) reg.add(e)
      }
      continue
    }
    const e = makeCliEngine(tool, {}, { which })
    if (e) reg.add(e)
  }

  // Ollama models
  const models = await listOllama({ fetchImpl: deps.fetchImpl, baseUrl: cfg.ollamaHost || undefined })
  for (const m of models) reg.add(makeOllamaEngine(m, { fetchImpl: deps.fetchImpl, baseUrl: cfg.ollamaHost || undefined }))

  // Cloud: from config.json (key-filtered by loadConfig) + user-added providers (in-app)
  for (const c of [...(cfg.cloud ?? []), ...loadCloud()]) {
    for (const model of c.models) {
      reg.add(makeOpenAiEngine({ id: `${c.id}:${model}`, label: `${c.label} ${model}`, baseUrl: c.baseUrl, apiKey: c.apiKey, model, fetchImpl: deps.fetchImpl }))
    }
  }

  // Custom templates
  for (const c of cfg.custom ?? []) reg.add(makeCustomEngine(c))

  return reg
}

export function summarize(reg) {
  const g = { cli: [], ollama: [], cloud: [], custom: [] }
  for (const e of reg.list()) g[e.type === 'cli' ? 'cli' : e.type === 'ollama' ? 'ollama' : e.type === 'cloud' ? 'cloud' : 'custom'].push(e.id)
  return g
}
