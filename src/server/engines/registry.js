export function makeEngine({ id, type, label, model = null, run }) {
  return { id, type, label, model, run }
}

const LOCAL_TYPES = new Set(['cli', 'ollama', 'custom'])

export class EngineRegistry {
  constructor() { this._byId = new Map() }
  add(engine) { this._byId.set(engine.id, engine); return this }
  get(id) { return this._byId.get(id) }
  list() { return [...this._byId.values()] }
  localFirst() {
    return this.list().sort((a, b) => rank(a) - rank(b))
  }
}
function rank(e) { return LOCAL_TYPES.has(e.type) ? 0 : 1 }
