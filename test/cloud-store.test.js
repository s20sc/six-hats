import { describe, it, expect } from 'vitest'
import os from 'node:os'
import fs from 'node:fs'
import { join } from 'node:path'
import { loadCloudProviders, saveCloudProvider, deleteCloudProvider, maskKey, listMasked } from '../src/server/cloud-store.js'

let n = 0
const tmp = () => join(os.tmpdir(), `six-hats-cloud-test-${process.pid}-${n++}.json`)

describe('cloud-store', () => {
  it('saves, loads, and lists (masked, no raw key) a provider', () => {
    const file = tmp()
    const p = saveCloudProvider({ label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-abcdefgh', model: 'gpt-4o-mini' }, { file })
    expect(p.id).toBe('openai--gpt-4o-mini')
    expect(p.models).toEqual(['gpt-4o-mini'])
    const loaded = loadCloudProviders({ file })
    expect(loaded).toHaveLength(1)
    expect(loaded[0].apiKey).toBe('sk-abcdefgh')
    const masked = listMasked({ file })
    expect(masked[0].keyMasked).toBe('sk-…efgh')
    expect(masked[0].apiKey).toBeUndefined()
    fs.rmSync(file, { force: true })
  })
  it('upserts by id — same label+model overwrites the key', () => {
    const file = tmp()
    saveCloudProvider({ label: 'OpenAI', baseUrl: 'https://a/v1', apiKey: 'k1', model: 'gpt-4o' }, { file })
    saveCloudProvider({ label: 'OpenAI', baseUrl: 'https://a/v1', apiKey: 'k2', model: 'gpt-4o' }, { file })
    const loaded = loadCloudProviders({ file })
    expect(loaded).toHaveLength(1)
    expect(loaded[0].apiKey).toBe('k2')
    fs.rmSync(file, { force: true })
  })
  it('rejects missing fields and non-http baseUrl', () => {
    const file = tmp()
    expect(() => saveCloudProvider({ label: 'X', baseUrl: 'https://a/v1', apiKey: 'k' }, { file })).toThrow()
    expect(() => saveCloudProvider({ label: 'X', baseUrl: 'ftp://a', apiKey: 'k', model: 'm' }, { file })).toThrow(/baseUrl/)
  })
  it('deletes a provider by id', () => {
    const file = tmp()
    saveCloudProvider({ label: 'OpenAI', baseUrl: 'https://a/v1', apiKey: 'k', model: 'gpt-4o' }, { file })
    deleteCloudProvider('openai--gpt-4o', { file })
    expect(loadCloudProviders({ file })).toHaveLength(0)
    fs.rmSync(file, { force: true })
  })
  it('loadCloudProviders returns [] for a missing/corrupt file', () => {
    expect(loadCloudProviders({ file: tmp() })).toEqual([])
  })
  it('maskKey hides the middle', () => {
    expect(maskKey('sk-1234567890')).toBe('sk-…7890')
    expect(maskKey('abc')).toBe('••••')
    expect(maskKey('')).toBe('••••')
  })
})
