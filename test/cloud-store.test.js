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
    const p = saveCloudProvider({ label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-proj-abcdefghijkl', model: 'gpt-4o-mini' }, { file })
    expect(p.id).toMatch(/^openai-[a-z0-9]+$/)
    expect(p.models).toEqual(['gpt-4o-mini'])
    const loaded = loadCloudProviders({ file })
    expect(loaded).toHaveLength(1)
    expect(loaded[0].apiKey).toBe('sk-proj-abcdefghijkl')
    const masked = listMasked({ file })
    expect(masked[0].keyMasked).toBe('sk-…ijkl')
    expect(masked[0].apiKey).toBeUndefined()
    fs.rmSync(file, { force: true })
  })
  it('upserts by id — same label+model overwrites the key', () => {
    const file = tmp()
    const a = saveCloudProvider({ label: 'OpenAI', baseUrl: 'https://a/v1', apiKey: 'key-one-1234567', model: 'gpt-4o' }, { file })
    const b = saveCloudProvider({ label: 'OpenAI', baseUrl: 'https://a/v1', apiKey: 'key-two-7654321', model: 'gpt-4o' }, { file })
    expect(b.id).toBe(a.id)
    const loaded = loadCloudProviders({ file })
    expect(loaded).toHaveLength(1)
    expect(loaded[0].apiKey).toBe('key-two-7654321')
    fs.rmSync(file, { force: true })
  })
  it('gives distinct ids to different labels even when they slug identically (CJK)', () => {
    const file = tmp()
    const a = saveCloudProvider({ label: '我的模型', baseUrl: 'https://a/v1', apiKey: 'kkkkkkkkkkkkk', model: 'm' }, { file })
    const b = saveCloudProvider({ label: '另一个', baseUrl: 'https://b/v1', apiKey: 'kkkkkkkkkkkkk', model: 'm' }, { file })
    expect(a.id).not.toBe(b.id)
    expect(loadCloudProviders({ file })).toHaveLength(2)
    fs.rmSync(file, { force: true })
  })
  it('rejects missing fields, bad protocol, non-URL, and embedded credentials', () => {
    const file = tmp()
    expect(() => saveCloudProvider({ label: 'X', baseUrl: 'https://a/v1', apiKey: 'k' }, { file })).toThrow()
    expect(() => saveCloudProvider({ label: 'X', baseUrl: 'ftp://a', apiKey: 'k', model: 'm' }, { file })).toThrow(/baseUrl/)
    expect(() => saveCloudProvider({ label: 'X', baseUrl: 'not a url', apiKey: 'k', model: 'm' }, { file })).toThrow(/URL/)
    expect(() => saveCloudProvider({ label: 'X', baseUrl: 'https://u:p@host/v1', apiKey: 'k', model: 'm' }, { file })).toThrow(/用户名|密码/)
  })
  it('normalizes baseUrl — strips query, hash, and trailing slash', () => {
    const file = tmp()
    const p = saveCloudProvider({ label: 'X', baseUrl: 'https://host.com/v1/?a=1#f', apiKey: 'k', model: 'm' }, { file })
    expect(p.baseUrl).toBe('https://host.com/v1')
    fs.rmSync(file, { force: true })
  })
  it('deletes a provider by id', () => {
    const file = tmp()
    const p = saveCloudProvider({ label: 'OpenAI', baseUrl: 'https://a/v1', apiKey: 'k-1234567890', model: 'gpt-4o' }, { file })
    deleteCloudProvider(p.id, { file })
    expect(loadCloudProviders({ file })).toHaveLength(0)
    fs.rmSync(file, { force: true })
  })
  it('loadCloudProviders returns [] for a missing/corrupt file', () => {
    expect(loadCloudProviders({ file: tmp() })).toEqual([])
  })
  it('maskKey hides the middle; short strings are never partially revealed', () => {
    expect(maskKey('sk-proj-1234567890')).toBe('sk-…7890')
    expect(maskKey('short-key-12')).toBe('••••')
    expect(maskKey('abc')).toBe('••••')
    expect(maskKey('')).toBe('••••')
  })
})
