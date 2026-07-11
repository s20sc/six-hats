import fs from 'node:fs'
import os from 'node:os'
import { dirname, join } from 'node:path'

// User-added cloud providers live outside the app bundle so they survive updates.
// Plaintext (like most CLIs' ~/.config credentials) — local-only desktop app.
export function cloudFile() {
  return join(os.homedir(), '.six-hats', 'cloud.json')
}

function readAll(file) {
  try {
    const v = JSON.parse(fs.readFileSync(file, 'utf8'))
    return Array.isArray(v) ? v : []
  } catch { return [] }
}

function writeAll(file, list) {
  fs.mkdirSync(dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(list, null, 2))
}

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x'

// Well-formed providers only (each becomes one openai-compatible engine per model).
export function loadCloudProviders({ file = cloudFile() } = {}) {
  return readAll(file).filter(
    (p) => p && p.id && p.baseUrl && p.apiKey && Array.isArray(p.models) && p.models.length,
  )
}

// Validate + normalize to origin+path only (drops credentials / query / hash / trailing slash).
function normalizeBaseUrl(raw) {
  let u
  try { u = new URL(raw) } catch { throw new Error('baseUrl 不是合法的 URL') }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('baseUrl 必须是 http(s)://')
  if (!u.hostname) throw new Error('baseUrl 缺少主机名')
  if (u.username || u.password) throw new Error('baseUrl 不能包含用户名/密码')
  return `${u.origin}${u.pathname}`.replace(/\/+$/, '')
}

export function saveCloudProvider(input, { file = cloudFile() } = {}) {
  const label = String(input?.label ?? '').trim()
  const apiKey = String(input?.apiKey ?? '').trim()
  const model = String(input?.model ?? '').trim()
  if (!label || !input?.baseUrl || !apiKey || !model) throw new Error('缺少 label / baseUrl / apiKey / model')
  const baseUrl = normalizeBaseUrl(String(input.baseUrl).trim())
  const id = `${slug(label)}--${slug(model)}`
  const provider = { id, label, baseUrl, apiKey, models: [model] }
  const list = readAll(file).filter((p) => p.id !== id) // upsert by id
  list.push(provider)
  writeAll(file, list)
  return provider
}

export function deleteCloudProvider(id, { file = cloudFile() } = {}) {
  writeAll(file, readAll(file).filter((p) => p.id !== id))
}

export function maskKey(key) {
  const s = String(key ?? '')
  return s.length <= 6 ? '••••' : `${s.slice(0, 3)}…${s.slice(-4)}`
}

// Safe view for the client — never leak the raw key.
export function listMasked({ file = cloudFile() } = {}) {
  return readAll(file).map((p) => ({ id: p.id, label: p.label, baseUrl: p.baseUrl, models: p.models, keyMasked: maskKey(p.apiKey) }))
}
