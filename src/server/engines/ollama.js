import { makeEngine } from './registry.js'

const DEFAULT_BASE = 'http://localhost:11434'

export async function listOllamaModels({ fetchImpl = fetch, baseUrl = DEFAULT_BASE } = {}) {
  try {
    const res = await fetchImpl(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return []
    const data = await res.json()
    return (data.models ?? []).map((m) => m.name)
  } catch { return [] }
}

export function makeOllamaEngine(model, { baseUrl = DEFAULT_BASE, fetchImpl = fetch } = {}) {
  return makeEngine({
    id: `ollama:${model}`,
    type: 'ollama',
    label: `ollama (${model})`,
    model,
    run: async (prompt) => {
      const res = await fetchImpl(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false }),
        signal: AbortSignal.timeout(120000),
      })
      if (!res.ok) throw new Error(`ollama ${model} HTTP ${res.status}`)
      const data = await res.json()
      const text = data.message?.content?.trim()
      if (!text) throw new Error(`ollama ${model} empty response`)
      return text
    },
  })
}
