import { EngineRegistry } from './registry.js'
import { CLI_TABLE, makeCliEngine, whichSync } from './cli.js'
import { listOllamaModels, makeOllamaEngine } from './ollama.js'
import { makeOpenAiEngine } from './openai.js'
import { makeCustomEngine } from './custom.js'

export async function detectEngines(cfg, deps = {}) {
  const which = deps.which ?? whichSync
  const listOllama = deps.listOllama ?? ((d) => listOllamaModels(d))
  const reg = new EngineRegistry()

  // Built-in CLI tools (openclaw needs an agent id → only if configured)
  for (const tool of Object.keys(CLI_TABLE)) {
    if (tool === 'openclaw') {
      if (!cfg.openclawAgent) continue
      const e = makeCliEngine('openclaw', { model: cfg.openclawAgent }, { which })
      if (e) reg.add(e)
      continue
    }
    const e = makeCliEngine(tool, {}, { which })
    if (e) reg.add(e)
  }

  // Ollama models
  const models = await listOllama({ fetchImpl: deps.fetchImpl })
  for (const m of models) reg.add(makeOllamaEngine(m, { fetchImpl: deps.fetchImpl }))

  // Cloud (already key-filtered by loadConfig)
  for (const c of cfg.cloud ?? []) {
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
