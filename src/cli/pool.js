import { loadConfig as realLoadConfig } from '../server/config.js'
import { detectEngines as realDetect, summarize } from '../server/engines/detect.js'
import { HATS, applySkin, applyPromptOverrides } from '../server/hats.js'

export async function bootstrapPool(deps = {}) {
  const loadConfig = deps.loadConfig ?? realLoadConfig
  const detectEngines = deps.detectEngines ?? realDetect
  const cfg = loadConfig()
  const registry = await detectEngines(cfg)
  const hats = applyPromptOverrides(applySkin(HATS, cfg.skins), cfg.hatPromptOverrides)
  return { registry, hats, cfg }
}

export function selectHats(allHats, ids) {
  return allHats.filter((h) => ids.includes(h.id))
}

export function listEnginesText(registry) {
  const byType = { cli: [], ollama: [], cloud: [], custom: [] }
  for (const e of registry.list()) (byType[e.type] ?? (byType[e.type] = [])).push(e.label)
  const order = ['cli', 'ollama', 'cloud', 'custom']
  const lines = order
    .filter((k) => byType[k] && byType[k].length)
    .map((k) => `${k}: ${byType[k].join(', ')}`)
  return lines.length ? lines.join('\n') : '(no engines detected)'
}
