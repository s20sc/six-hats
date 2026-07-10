import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = join(__dirname, '..', '..', 'config.json')

export function loadConfig({ env = process.env, fileJson } = {}) {
  const file = fileJson !== undefined ? fileJson : readFileJson()
  const cloudRaw = file?.cloud ?? []
  const cloud = cloudRaw
    .map((c) => ({ id: c.id, label: c.label ?? c.id, baseUrl: c.baseUrl, apiKey: env[c.apiKeyEnv] ?? '', models: c.models ?? [] }))
    .filter((c) => c.apiKey && c.baseUrl)
  return {
    port: Number(env.PORT) || file?.port || 3002,
    cloud,
    custom: file?.custom ?? [],
    skins: file?.skins ?? {},
    hatPromptOverrides: file?.hatPrompts ?? {},
  }
}

function readFileJson() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) } catch { return null }
}
