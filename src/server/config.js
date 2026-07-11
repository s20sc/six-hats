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
  const envPort = env.PORT !== undefined && env.PORT !== '' ? Number(env.PORT) : NaN
  return {
    // honor an explicit PORT (including 0 = OS-assigned ephemeral); else config, else 3002
    port: Number.isFinite(envPort) ? envPort : (file?.port ?? 3002),
    cloud,
    custom: file?.custom ?? [],
    skins: file?.skins ?? {},
    hatPromptOverrides: file?.hatPrompts ?? {},
    openclawAgent: file?.openclawAgent ?? null,
    ollamaHost: env.OLLAMA_HOST || env.OLLAMA_BASE_URL || null,
  }
}

function readFileJson() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) } catch { return null }
}
