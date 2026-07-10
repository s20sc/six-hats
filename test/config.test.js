import { describe, it, expect } from 'vitest'
import { loadConfig } from '../src/server/config.js'
import { stateFile } from '../src/server/paths.js'
import os from 'node:os'

describe('config', () => {
  it('defaults port to 3002 when unset', () => {
    const cfg = loadConfig({ env: {}, fileJson: null })
    expect(cfg.port).toBe(3002)
  })
  it('registers a cloud endpoint only when its key is present', () => {
    const fileJson = { cloud: [{ id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKeyEnv: 'OPENAI_API_KEY', models: ['gpt-4o'] }] }
    const withKey = loadConfig({ env: { OPENAI_API_KEY: 'sk-x' }, fileJson })
    const without = loadConfig({ env: {}, fileJson })
    expect(withKey.cloud).toHaveLength(1)
    expect(withKey.cloud[0].apiKey).toBe('sk-x')
    expect(without.cloud).toHaveLength(0)
  })
  it('stateFile lives in os.tmpdir()', () => {
    expect(stateFile().startsWith(os.tmpdir())).toBe(true)
  })
  it('exposes openclawAgent from file config, defaulting to null', () => {
    const withAgent = loadConfig({ env: {}, fileJson: { openclawAgent: 'main' } })
    expect(withAgent.openclawAgent).toBe('main')
    const without = loadConfig({ env: {}, fileJson: null })
    expect(without.openclawAgent).toBe(null)
  })
})
