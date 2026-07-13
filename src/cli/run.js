// src/cli/run.js
import { assignEngines } from '../server/assign.js'
import { runDeliberation } from '../server/orchestrate.js'

export async function runCli({ topic, hats, engine, timeoutMs = 180000, onProgress = () => {} }, registry) {
  let assignment
  if (engine) {
    if (!registry.get(engine)) throw new Error(`unknown engine: ${engine}`)
    assignment = Object.fromEntries(hats.map((h) => [h.id, engine]))
  } else {
    assignment = assignEngines(hats, registry.localFirst())
  }

  const results = {}
  for (const h of hats) results[h.id] = { status: 'idle', engineId: assignment[h.id] }

  const onUpdate = (hatId, patch) => {
    results[hatId] = { ...results[hatId], ...patch }
    onProgress(hatId, results[hatId])
  }

  let timer
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve('timeout'), timeoutMs) })
  const run = runDeliberation({ topic, hats, registry, assignment, onUpdate }).then(() => 'done')
  const outcome = await Promise.race([run, timeout])
  clearTimeout(timer)

  if (outcome === 'timeout') {
    for (const h of hats) {
      if (results[h.id].status === 'idle' || results[h.id].status === 'speaking') {
        results[h.id] = { ...results[h.id], status: 'error', error: 'timed out' }
      }
    }
  }

  const anyDone = hats.some((h) => h.id !== 'blue' && results[h.id].status === 'done' && results[h.id].text)
  return { results, anyDone }
}
