import { makeEngine } from './registry.js'

export function makeOpenAiEngine({ id, label, baseUrl, apiKey, model, fetchImpl = fetch }) {
  return makeEngine({
    id, type: 'cloud', label, model,
    run: async (prompt) => {
      const res = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.85, max_tokens: 600 }),
        signal: AbortSignal.timeout(120000),
      })
      if (!res.ok) throw new Error(`${label} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content?.trim()
      if (!text) throw new Error(`${label} empty response`)
      return text
    },
  })
}
