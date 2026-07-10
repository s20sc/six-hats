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
})
