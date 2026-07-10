export function assignEngines(hats, engines, { pins = {}, rng = Math.random } = {}) {
  if (engines.length === 0) throw new Error('NO_ENGINES')
  const out = {}
  for (const hat of hats) {
    if (pins[hat.id] && engines.some((e) => e.id === pins[hat.id])) {
      out[hat.id] = pins[hat.id]
    } else {
      out[hat.id] = engines[Math.floor(rng() * engines.length)].id
    }
  }
  return out
}
