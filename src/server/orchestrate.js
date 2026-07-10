import { hatPrompt, bluePrompt } from './hats.js'

export async function runDeliberation({ topic, hats, registry, assignment, onUpdate = () => {} }) {
  const five = hats.filter((h) => h.id !== 'blue')
  const blue = hats.find((h) => h.id === 'blue')
  const errors = {}
  const contributions = []

  await Promise.all(five.map(async (hat) => {
    const engine = registry.get(assignment[hat.id])
    onUpdate(hat.id, { status: 'speaking', engineId: assignment[hat.id] })
    try {
      const text = await engine.run(hatPrompt(hat, topic))
      contributions.push({ hatId: hat.id, name: hat.name, text })
      onUpdate(hat.id, { status: 'done', text })
    } catch (e) {
      errors[hat.id] = e.message
      onUpdate(hat.id, { status: 'error', error: e.message })
    }
  }))

  // keep canonical order for the summary
  const ordered = five.filter((h) => contributions.some((c) => c.hatId === h.id))
    .map((h) => contributions.find((c) => c.hatId === h.id))

  let summary = ''
  if (ordered.length > 0) {
    const engine = registry.get(assignment[blue.id])
    onUpdate(blue.id, { status: 'speaking', engineId: assignment[blue.id] })
    try {
      summary = await engine.run(bluePrompt(topic, ordered))
      onUpdate(blue.id, { status: 'done', text: summary })
    } catch (e) {
      errors[blue.id] = e.message
      onUpdate(blue.id, { status: 'error', error: e.message })
    }
  }
  return { contributions: ordered, summary, errors }
}
