export function assignEngines(hats, engines, { pins = {}, rng = Math.random } = {}) {
  if (engines.length === 0) throw new Error('NO_ENGINES')
  const LOCAL = new Set(['cli', 'ollama', 'custom'])
  const local = engines.filter((e) => LOCAL.has(e.type))
  const pool = local.length > 0 ? local : engines
  const out = {}
  for (const hat of hats) {
    if (pins[hat.id] && engines.some((e) => e.id === pins[hat.id])) {
      out[hat.id] = pins[hat.id]
    } else {
      out[hat.id] = pool[Math.floor(rng() * pool.length)].id
    }
  }
  return out
}
