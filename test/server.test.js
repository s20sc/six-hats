import { describe, it, expect } from 'vitest'
import { createApp } from '../src/server/server.js'
import { EngineRegistry, makeEngine } from '../src/server/engines/registry.js'

function reg() {
  const r = new EngineRegistry()
  r.add(makeEngine({ id: 'e', type: 'cli', label: 'E', run: async (p) => (p.includes('其他帽子的发言') ? 'S' : 'op') }))
  return r
}
async function call(app, method, path, body) {
  const { default: request } = await import('supertest')
  return request(app)[method](path).send(body)
}

describe('server routes', () => {
  const cfg = { skins: {}, cloud: [], custom: [] }
  it('GET /api/engines lists engines', async () => {
    const res = await call(createApp({ registry: reg(), cfg }), 'get', '/api/engines')
    expect(res.body.engines[0].id).toBe('e')
  })
  it('POST /api/run returns summary', async () => {
    const app = createApp({ registry: reg(), cfg })
    const assignment = { white: 'e', red: 'e', black: 'e', yellow: 'e', green: 'e', blue: 'e' }
    const res = await call(app, 'post', '/api/run', { topic: 'T', assignment })
    expect(res.body.summary).toBe('S')
    expect(res.body.contributions).toHaveLength(5)
  })
  it('POST /api/run 400s when assignment is missing a hat', async () => {
    const app = createApp({ registry: reg(), cfg })
    const assignment = { white: 'e', red: 'e', black: 'e', yellow: 'e', green: 'e' } // blue omitted
    const res = await call(app, 'post', '/api/run', { topic: 'T', assignment })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/blue/)
  })
  it('POST /api/run 400s when assignment references an unknown engine', async () => {
    const app = createApp({ registry: reg(), cfg })
    const assignment = { white: 'e', red: 'e', black: 'e', yellow: 'e', green: 'e', blue: 'nope' }
    const res = await call(app, 'post', '/api/run', { topic: 'T', assignment })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/nope/)
  })
  it('POST /api/run-hat returns a single hat text', async () => {
    const app = createApp({ registry: reg(), cfg })
    const res = await call(app, 'post', '/api/run-hat', { topic: 'T', hatId: 'white', engineId: 'e', contributions: [] })
    expect(res.status).toBe(200)
    expect(res.body.hatId).toBe('white')
    expect(res.body.text).toBe('op')
  })
  it('POST /api/run-hat 400s on unknown engineId', async () => {
    const app = createApp({ registry: reg(), cfg })
    const res = await call(app, 'post', '/api/run-hat', { topic: 'T', hatId: 'white', engineId: 'nope', contributions: [] })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/nope/)
  })
})
