import { describe, it, expect } from 'vitest'
import { createApp } from '../src/server/server.js'
import { EngineRegistry, makeEngine } from '../src/server/engines/registry.js'

describe('routes the UI depends on', () => {
  const r = new EngineRegistry(); r.add(makeEngine({ id: 'e', type: 'cli', label: 'E', run: async () => 'x' }))
  const app = createApp({ registry: r, cfg: { skins: {}, cloud: [], custom: [] } })
  for (const [method, path] of [['get', '/api/engines'], ['get', '/api/hats']]) {
    it(`${method.toUpperCase()} ${path} responds 200`, async () => {
      const { default: request } = await import('supertest')
      const res = await request(app)[method](path)
      expect(res.status).toBe(200)
    })
  }
})
