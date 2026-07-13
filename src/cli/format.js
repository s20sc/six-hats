// src/cli/format.js
export function formatMarkdown({ topic, hats, results, engineLabel }) {
  const lines = [`# 六顶思考帽 · ${topic}`, '']
  for (const hat of hats) {
    if (hat.id === 'blue') continue
    const r = results[hat.id]
    if (!r) continue
    const label = engineLabel(r.engineId)
    lines.push(`## ${hat.emoji} ${hat.name}（${label}）`)
    if (r.status === 'done' && r.text) lines.push(r.text)
    else lines.push(`_（${label} 失败：${r.error || '无输出'}）_`)
    lines.push('')
  }
  const blue = hats.find((h) => h.id === 'blue')
  const br = blue && results.blue
  if (blue && br && br.status === 'done' && br.text) {
    lines.push(`## ${blue.emoji} ${blue.name}总结`, br.text, '')
  }
  return lines.join('\n').trimEnd() + '\n'
}

export function formatJson({ topic, hats, results }) {
  const contributions = []
  const errors = {}
  let summary = ''
  for (const hat of hats) {
    const r = results[hat.id]
    if (!r) continue
    if (hat.id === 'blue') { if (r.status === 'done') summary = r.text || ''; else if (r.error) errors.blue = r.error; continue }
    if (r.status === 'done' && r.text) contributions.push({ hatId: hat.id, name: hat.name, engineId: r.engineId, text: r.text })
    else if (r.error) errors[hat.id] = r.error
  }
  return { topic, contributions, summary, errors }
}
