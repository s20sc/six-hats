# Six Hats Portable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the six-hats deliberation app so anyone can run it cross-platform with `npm install`, preferring locally-installed AI-agent CLIs and falling back to a cloud OpenAI-compatible API.

**Architecture:** A Node/Express backend exposes an **engine pool** — each engine is a uniform `run(prompt, {model}) -> Promise<string>`. Engines are auto-detected: local CLI adapters (`claude`, `codex`, `agy`, `hermes`, `openclaw`), local Ollama models over HTTP, a custom command template, and OpenAI-compatible cloud endpoints. Six De Bono hat personas are assigned engines (random-to-model, pinnable, reusable); white/red/black/yellow/green run in parallel, blue summarizes them. The existing Vite+React UI is adapted to show detection and assignment.

**Tech Stack:** Node ≥18 (ESM), Express 4, Vite 6 + React 18, Vitest for tests, `node:child_process`/`node:os`/`fetch` (Node built-ins, no new heavy deps).

## Global Constraints

- Node ≥ 18 (uses global `fetch`, `node:test`-free — tests via Vitest). One line in README.
- ESM only (`"type": "module"`); all imports use `.js` extension where local.
- No hardcoded machine paths (`/opt/homebrew/...`, `/Users/qinxue`, `/tmp`). Resolve binaries via `PATH`; state file via `os.tmpdir()`.
- Never inject prompts into a shell string. CLI adapters pass the prompt as a spawn **argument** (argv), not interpolated into `sh -c`. The custom-template adapter passes the prompt via the `SIXHATS_PROMPT` env var, never string-substituted into the command.
- A cloud provider is registered only if its API key is present in env/config. No key committed anywhere. `.env` stays gitignored; ship `.env.example`.
- All user-facing repo docs bilingual: `README.md` (English) + `README.zh-CN.md` (中文). License: MIT, `Copyright (c) 2026 s20sc`.
- No Claude attribution in any commit or file.

---

### Task 0: Reset scaffolding, config loader, test harness

**Files:**
- Modify: `package.json` (scripts + devDeps)
- Create: `.env.example`
- Create: `.gitignore` (ensure `.env`, `node_modules`, `dist`, `.DS_Store`)
- Create: `src/server/config.js`
- Create: `src/server/paths.js`
- Test: `test/config.test.js`

**Interfaces:**
- Produces: `loadConfig() -> { port:number, cloud:CloudEndpoint[], custom:CustomEngine[], skins:object, hatPromptOverrides:object }` from `src/server/config.js`.
  - `CloudEndpoint = { id:string, label:string, baseUrl:string, apiKey:string, models:string[] }`
  - `CustomEngine = { name:string, cmd:string, parse:string }`
- Produces: `stateFile() -> string` (absolute path in `os.tmpdir()`) from `src/server/paths.js`.

- [ ] **Step 1: Write the failing test**

```js
// test/config.test.js
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/config.test.js`
Expected: FAIL — cannot find `../src/server/config.js`.

- [ ] **Step 3: Add Vitest + scripts to package.json**

Merge into `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "start": "node src/server/server.js",
    "server": "node src/server/server.js",
    "test": "vitest run"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.5",
    "vitest": "^2.1.8"
  }
}
```

Run: `npm install`

- [ ] **Step 4: Implement paths.js and config.js**

```js
// src/server/paths.js
import os from 'node:os'
import { join } from 'node:path'
export function stateFile() {
  return join(os.tmpdir(), 'six-hats-state.json')
}
```

```js
// src/server/config.js
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = join(__dirname, '..', '..', 'config.json')

export function loadConfig({ env = process.env, fileJson } = {}) {
  const file = fileJson !== undefined ? fileJson : readFileJson()
  const cloudRaw = file?.cloud ?? []
  const cloud = cloudRaw
    .map((c) => ({ id: c.id, label: c.label ?? c.id, baseUrl: c.baseUrl, apiKey: env[c.apiKeyEnv] ?? '', models: c.models ?? [] }))
    .filter((c) => c.apiKey && c.baseUrl)
  return {
    port: Number(env.PORT) || file?.port || 3002,
    cloud,
    custom: file?.custom ?? [],
    skins: file?.skins ?? {},
    hatPromptOverrides: file?.hatPrompts ?? {},
  }
}

function readFileJson() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) } catch { return null }
}
```

- [ ] **Step 5: Create .env.example and .gitignore**

```bash
# .env.example
PORT=3002
# Cloud API keys — fill any you have. A provider is used only if its key is set.
OPENAI_API_KEY=
OPENROUTER_API_KEY=
MINIMAX_API_KEY=
```

```bash
# .gitignore  (append if present)
node_modules/
dist/
.env
.DS_Store
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run test/config.test.js`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git init && git add -A && git commit -m "chore: scaffold config loader, cross-platform paths, vitest"
```

---

### Task 1: Engine interface + registry

**Files:**
- Create: `src/server/engines/registry.js`
- Test: `test/registry.test.js`

**Interfaces:**
- Produces: `makeEngine({ id, type, label, model, run }) -> Engine` where `Engine = { id, type, label, model, run(prompt) }`.
- Produces: `EngineRegistry` class with `add(engine)`, `list() -> Engine[]`, `get(id) -> Engine|undefined`, `localFirst() -> Engine[]` (CLI+ollama before cloud).

- [ ] **Step 1: Write the failing test**

```js
// test/registry.test.js
import { describe, it, expect } from 'vitest'
import { makeEngine, EngineRegistry } from '../src/server/engines/registry.js'

describe('engine registry', () => {
  it('localFirst orders local engines before cloud', () => {
    const reg = new EngineRegistry()
    reg.add(makeEngine({ id: 'gpt', type: 'cloud', label: 'GPT', run: async () => 'x' }))
    reg.add(makeEngine({ id: 'claude', type: 'cli', label: 'Claude', run: async () => 'y' }))
    reg.add(makeEngine({ id: 'qwen', type: 'ollama', label: 'Qwen', run: async () => 'z' }))
    const ids = reg.localFirst().map((e) => e.id)
    expect(ids.indexOf('gpt')).toBe(2)
    expect(ids.slice(0, 2).sort()).toEqual(['claude', 'qwen'])
  })
  it('get returns by id, list returns all', () => {
    const reg = new EngineRegistry()
    reg.add(makeEngine({ id: 'a', type: 'cli', label: 'A', run: async () => '' }))
    expect(reg.get('a').id).toBe('a')
    expect(reg.list()).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/registry.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement registry.js**

```js
// src/server/engines/registry.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/registry.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: engine interface and registry with local-first ordering"
```

---

### Task 2: CLI adapter (built-in table + safe spawn)

**Files:**
- Create: `src/server/engines/cli.js`
- Test: `test/cli.test.js`

**Interfaces:**
- Consumes: `makeEngine` from registry.
- Produces: `CLI_TABLE` (object keyed by tool name → `{ bin, buildArgs(prompt, model), parse }`).
- Produces: `runCliCommand(bin, args, { timeoutMs }) -> Promise<{ code, stdout, stderr }>` (thin spawn wrapper, injectable for tests via `spawnImpl`).
- Produces: `cleanOutput(raw, parse) -> string`.
- Produces: `makeCliEngine(tool, { model }={}, deps={}) -> Engine|null` (null if `bin` not on PATH).

- [ ] **Step 1: Write the failing test**

```js
// test/cli.test.js
import { describe, it, expect } from 'vitest'
import { CLI_TABLE, cleanOutput, makeCliEngine } from '../src/server/engines/cli.js'

describe('cli adapter', () => {
  it('claude builds -p prompt args', () => {
    expect(CLI_TABLE.claude.buildArgs('hello')).toEqual(['-p', 'hello'])
  })
  it('codex builds exec prompt args', () => {
    expect(CLI_TABLE.codex.buildArgs('hi')).toEqual(['exec', 'hi'])
  })
  it('hermes adds -m when model given', () => {
    expect(CLI_TABLE.hermes.buildArgs('q', 'gpt-4o')).toEqual(['-z', 'q', '-m', 'gpt-4o'])
    expect(CLI_TABLE.hermes.buildArgs('q')).toEqual(['-z', 'q'])
  })
  it('cleanOutput strips ANSI and trims for raw', () => {
    expect(cleanOutput('[32mhi[0m\n', 'raw')).toBe('hi')
  })
  it('makeCliEngine runs via injected spawn and returns cleaned text', async () => {
    const fakeSpawn = () => makeFakeChild(0, 'the answer\n', '')
    const eng = makeCliEngine('claude', {}, { which: () => '/usr/bin/claude', spawnImpl: fakeSpawn })
    expect(await eng.run('anything')).toBe('the answer')
  })
  it('makeCliEngine returns null when bin missing', () => {
    const eng = makeCliEngine('claude', {}, { which: () => null })
    expect(eng).toBe(null)
  })
})

// minimal EventEmitter-like fake child
function makeFakeChild(code, stdout, stderr) {
  const listeners = {}
  const child = {
    stdout: { on: (ev, cb) => { listeners[`out:${ev}`] = cb } },
    stderr: { on: (ev, cb) => { listeners[`err:${ev}`] = cb } },
    on: (ev, cb) => { listeners[ev] = cb },
    kill: () => {},
  }
  queueMicrotask(() => {
    if (stdout) listeners['out:data']?.(Buffer.from(stdout))
    if (stderr) listeners['err:data']?.(Buffer.from(stderr))
    listeners['close']?.(code)
  })
  return child
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/cli.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement cli.js**

```js
// src/server/engines/cli.js
import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { makeEngine } from './registry.js'

const ANSI = /\[[0-9;]*m/g

export const CLI_TABLE = {
  claude:   { bin: 'claude',   buildArgs: (p) => ['-p', p],                              parse: 'raw' },
  codex:    { bin: 'codex',    buildArgs: (p) => ['exec', p],                            parse: 'raw' },
  agy:      { bin: 'agy',      buildArgs: (p) => ['-p', p],                              parse: 'raw' },
  hermes:   { bin: 'hermes',   buildArgs: (p, m) => (m ? ['-z', p, '-m', m] : ['-z', p]), parse: 'raw' },
  openclaw: { bin: 'openclaw', buildArgs: (p, m) => ['agent', '--agent', m, '--message', p, '--json'], parse: 'openclaw-json' },
}

export function whichSync(bin) {
  try { return execFileSync(process.platform === 'win32' ? 'where' : 'which', [bin]).toString().trim().split('\n')[0] || null }
  catch { return null }
}

export function cleanOutput(raw, parse) {
  const stripped = raw.replace(ANSI, '')
  if (parse === 'openclaw-json') {
    const i = stripped.indexOf('{')
    if (i < 0) return stripped.trim()
    try { return (JSON.parse(stripped.slice(i)).result?.payloads?.[0]?.text ?? '').trim() } catch { return stripped.trim() }
  }
  return stripped.trim()
}

export function runCliCommand(bin, args, { timeoutMs = 120000, spawnImpl = spawn } = {}) {
  return new Promise((resolve, reject) => {
    let out = '', err = '', done = false
    const child = spawnImpl(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', (d) => { out += d.toString() })
    child.stderr.on('data', (d) => { err += d.toString() })
    child.on('close', (code) => { if (!done) { done = true; resolve({ code, stdout: out, stderr: err }) } })
    child.on('error', (e) => { if (!done) { done = true; reject(e) } })
    setTimeout(() => { if (!done) { done = true; try { child.kill() } catch {} reject(new Error(`${bin} timed out`)) } }, timeoutMs)
  })
}

export function makeCliEngine(tool, { model = null } = {}, deps = {}) {
  const spec = CLI_TABLE[tool]
  if (!spec) return null
  const which = deps.which ?? whichSync
  const path = which(spec.bin)
  if (!path) return null
  const spawnImpl = deps.spawnImpl ?? spawn
  return makeEngine({
    id: model ? `${tool}:${model}` : tool,
    type: 'cli',
    label: model ? `${tool} (${model})` : tool,
    model,
    run: async (prompt) => {
      const { code, stdout, stderr } = await runCliCommand(spec.bin, spec.buildArgs(prompt, model), { spawnImpl })
      const text = cleanOutput(stdout, spec.parse)
      if (!text) throw new Error(`${tool} returned no text (code ${code}): ${stderr.slice(0, 200)}`)
      return text
    },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/cli.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: CLI engine adapter with built-in table and safe argv spawn"
```

---

### Task 3: Ollama adapter (HTTP + model enumeration)

**Files:**
- Create: `src/server/engines/ollama.js`
- Test: `test/ollama.test.js`

**Interfaces:**
- Consumes: `makeEngine`.
- Produces: `listOllamaModels({ fetchImpl, baseUrl }) -> Promise<string[]>` (empty array if unreachable).
- Produces: `makeOllamaEngine(model, { baseUrl, fetchImpl }) -> Engine`.

- [ ] **Step 1: Write the failing test**

```js
// test/ollama.test.js
import { describe, it, expect } from 'vitest'
import { listOllamaModels, makeOllamaEngine } from '../src/server/engines/ollama.js'

const okFetch = (body) => async () => ({ ok: true, json: async () => body })

describe('ollama adapter', () => {
  it('lists model names from /api/tags', async () => {
    const models = await listOllamaModels({ fetchImpl: okFetch({ models: [{ name: 'qwen2.5' }, { name: 'llama3' }] }) })
    expect(models).toEqual(['qwen2.5', 'llama3'])
  })
  it('returns [] when unreachable', async () => {
    const models = await listOllamaModels({ fetchImpl: async () => { throw new Error('econnrefused') } })
    expect(models).toEqual([])
  })
  it('engine.run posts to /api/chat and returns content', async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ message: { content: 'hola' } }) })
    const eng = makeOllamaEngine('qwen2.5', { fetchImpl })
    expect(eng.type).toBe('ollama')
    expect(await eng.run('hi')).toBe('hola')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/ollama.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement ollama.js**

```js
// src/server/engines/ollama.js
import { makeEngine } from './registry.js'

const DEFAULT_BASE = 'http://localhost:11434'

export async function listOllamaModels({ fetchImpl = fetch, baseUrl = DEFAULT_BASE } = {}) {
  try {
    const res = await fetchImpl(`${baseUrl}/api/tags`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.models ?? []).map((m) => m.name)
  } catch { return [] }
}

export function makeOllamaEngine(model, { baseUrl = DEFAULT_BASE, fetchImpl = fetch } = {}) {
  return makeEngine({
    id: `ollama:${model}`,
    type: 'ollama',
    label: `ollama (${model})`,
    model,
    run: async (prompt) => {
      const res = await fetchImpl(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false }),
      })
      if (!res.ok) throw new Error(`ollama ${model} HTTP ${res.status}`)
      const data = await res.json()
      const text = data.message?.content?.trim()
      if (!text) throw new Error(`ollama ${model} empty response`)
      return text
    },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/ollama.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: ollama adapter with model enumeration"
```

---

### Task 4: OpenAI-compatible cloud adapter

**Files:**
- Create: `src/server/engines/openai.js`
- Test: `test/openai.test.js`

**Interfaces:**
- Consumes: `makeEngine`.
- Produces: `makeOpenAiEngine({ id, label, baseUrl, apiKey, model, fetchImpl }) -> Engine`.

- [ ] **Step 1: Write the failing test**

```js
// test/openai.test.js
import { describe, it, expect } from 'vitest'
import { makeOpenAiEngine } from '../src/server/engines/openai.js'

describe('openai-compat adapter', () => {
  it('posts to {baseUrl}/chat/completions with bearer auth and returns content', async () => {
    let seen
    const fetchImpl = async (url, opts) => { seen = { url, opts }; return { ok: true, json: async () => ({ choices: [{ message: { content: 'cloud says hi' } }] }) } }
    const eng = makeOpenAiEngine({ id: 'openai:gpt-4o', label: 'GPT-4o', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-x', model: 'gpt-4o', fetchImpl })
    const text = await eng.run('hi')
    expect(text).toBe('cloud says hi')
    expect(seen.url).toBe('https://api.openai.com/v1/chat/completions')
    expect(seen.opts.headers.Authorization).toBe('Bearer sk-x')
    expect(eng.type).toBe('cloud')
  })
  it('throws on non-ok', async () => {
    const eng = makeOpenAiEngine({ id: 'x', label: 'x', baseUrl: 'https://h/v1', apiKey: 'k', model: 'm', fetchImpl: async () => ({ ok: false, status: 401, text: async () => 'bad key' }) })
    await expect(eng.run('hi')).rejects.toThrow(/401/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/openai.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement openai.js**

```js
// src/server/engines/openai.js
import { makeEngine } from './registry.js'

export function makeOpenAiEngine({ id, label, baseUrl, apiKey, model, fetchImpl = fetch }) {
  return makeEngine({
    id, type: 'cloud', label, model,
    run: async (prompt) => {
      const res = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.85, max_tokens: 600 }),
      })
      if (!res.ok) throw new Error(`${label} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content?.trim()
      if (!text) throw new Error(`${label} empty response`)
      return text
    },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/openai.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: openai-compatible cloud adapter"
```

---

### Task 5: Custom command-template adapter (injection-safe)

**Files:**
- Create: `src/server/engines/custom.js`
- Test: `test/custom.test.js`

**Interfaces:**
- Consumes: `makeEngine`, `cleanOutput` from cli.js.
- Produces: `makeCustomEngine({ name, cmd, parse }, deps) -> Engine`. The prompt is passed via `SIXHATS_PROMPT` env; `cmd` must reference `"$SIXHATS_PROMPT"`. Never string-substitute the prompt into `cmd`.

- [ ] **Step 1: Write the failing test**

```js
// test/custom.test.js
import { describe, it, expect } from 'vitest'
import { makeCustomEngine } from '../src/server/engines/custom.js'

describe('custom template adapter', () => {
  it('passes prompt via SIXHATS_PROMPT env, not string interpolation', async () => {
    let seenEnv
    const spawnImpl = (bin, args, opts) => {
      seenEnv = opts.env.SIXHATS_PROMPT
      const l = {}
      const child = { stdout: { on: (e, cb) => { l[`o${e}`] = cb } }, stderr: { on: () => {} }, on: (e, cb) => { l[e] = cb }, kill: () => {} }
      queueMicrotask(() => { l['odata']?.(Buffer.from('custom out\n')); l['close']?.(0) })
      return child
    }
    const eng = makeCustomEngine({ name: 'mytool', cmd: 'echo "$SIXHATS_PROMPT"', parse: 'raw' }, { spawnImpl })
    const text = await eng.run('inject; rm -rf /')
    expect(text).toBe('custom out')
    expect(seenEnv).toBe('inject; rm -rf /')
    expect(eng.type).toBe('custom')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/custom.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement custom.js**

```js
// src/server/engines/custom.js
import { spawn } from 'node:child_process'
import { makeEngine } from './registry.js'
import { cleanOutput } from './cli.js'

export function makeCustomEngine({ name, cmd, parse = 'raw' }, deps = {}) {
  const spawnImpl = deps.spawnImpl ?? spawn
  return makeEngine({
    id: `custom:${name}`,
    type: 'custom',
    label: name,
    model: null,
    run: (prompt) => new Promise((resolve, reject) => {
      let out = '', err = '', done = false
      const child = spawnImpl('sh', ['-c', cmd], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, SIXHATS_PROMPT: prompt },
      })
      child.stdout.on('data', (d) => { out += d.toString() })
      child.stderr.on('data', (d) => { err += d.toString() })
      child.on('close', (code) => {
        if (done) return; done = true
        const text = cleanOutput(out, parse === 'raw' ? 'raw' : parse)
        text ? resolve(text) : reject(new Error(`custom ${name} empty (code ${code}): ${err.slice(0, 200)}`))
      })
      child.on('error', (e) => { if (!done) { done = true; reject(e) } })
      setTimeout(() => { if (!done) { done = true; try { child.kill() } catch {} reject(new Error(`custom ${name} timed out`)) } }, 120000)
    }),
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/custom.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: injection-safe custom command-template adapter"
```

---

### Task 6: Detection — build the engine pool

**Files:**
- Create: `src/server/engines/detect.js`
- Test: `test/detect.test.js`

**Interfaces:**
- Consumes: `EngineRegistry`, `makeCliEngine`, `CLI_TABLE`, `whichSync`, `listOllamaModels`, `makeOllamaEngine`, `makeOpenAiEngine`, `makeCustomEngine`, `loadConfig`.
- Produces: `detectEngines(cfg, deps={}) -> Promise<EngineRegistry>`. `openclaw` is included only when an `openclawAgent` is configured (needs an agent id); otherwise skipped.
- Produces: `summarize(registry) -> { cli:string[], ollama:string[], cloud:string[], custom:string[] }` for the UI panel.

- [ ] **Step 1: Write the failing test**

```js
// test/detect.test.js
import { describe, it, expect } from 'vitest'
import { detectEngines, summarize } from '../src/server/engines/detect.js'

describe('detect', () => {
  it('registers only installed CLIs, ollama models, and keyed cloud', async () => {
    const cfg = { cloud: [{ id: 'openai', label: 'OpenAI', baseUrl: 'https://h/v1', apiKey: 'sk', models: ['gpt-4o'] }], custom: [] }
    const reg = await detectEngines(cfg, {
      which: (bin) => (bin === 'claude' || bin === 'agy' ? `/usr/bin/${bin}` : null),
      listOllama: async () => ['qwen2.5'],
      fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
    })
    const ids = reg.list().map((e) => e.id).sort()
    expect(ids).toContain('claude')
    expect(ids).toContain('agy')
    expect(ids).not.toContain('codex')       // not installed
    expect(ids).toContain('ollama:qwen2.5')
    expect(ids).toContain('openai:gpt-4o')
  })
  it('summarize groups by family', async () => {
    const cfg = { cloud: [], custom: [] }
    const reg = await detectEngines(cfg, { which: (b) => (b === 'claude' ? '/x' : null), listOllama: async () => [] })
    const s = summarize(reg)
    expect(s.cli).toEqual(['claude'])
    expect(s.cloud).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/detect.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement detect.js**

```js
// src/server/engines/detect.js
import { EngineRegistry } from './registry.js'
import { CLI_TABLE, makeCliEngine, whichSync } from './cli.js'
import { listOllamaModels, makeOllamaEngine } from './ollama.js'
import { makeOpenAiEngine } from './openai.js'
import { makeCustomEngine } from './custom.js'

export async function detectEngines(cfg, deps = {}) {
  const which = deps.which ?? whichSync
  const listOllama = deps.listOllama ?? ((d) => listOllamaModels(d))
  const reg = new EngineRegistry()

  // Built-in CLI tools (openclaw needs an agent id → only if configured)
  for (const tool of Object.keys(CLI_TABLE)) {
    if (tool === 'openclaw') {
      if (!cfg.openclawAgent) continue
      const e = makeCliEngine('openclaw', { model: cfg.openclawAgent }, { which })
      if (e) reg.add(e)
      continue
    }
    const e = makeCliEngine(tool, {}, { which })
    if (e) reg.add(e)
  }

  // Ollama models
  const models = await listOllama({ fetchImpl: deps.fetchImpl })
  for (const m of models) reg.add(makeOllamaEngine(m, { fetchImpl: deps.fetchImpl }))

  // Cloud (already key-filtered by loadConfig)
  for (const c of cfg.cloud ?? []) {
    for (const model of c.models) {
      reg.add(makeOpenAiEngine({ id: `${c.id}:${model}`, label: `${c.label} ${model}`, baseUrl: c.baseUrl, apiKey: c.apiKey, model, fetchImpl: deps.fetchImpl }))
    }
  }

  // Custom templates
  for (const c of cfg.custom ?? []) reg.add(makeCustomEngine(c))

  return reg
}

export function summarize(reg) {
  const g = { cli: [], ollama: [], cloud: [], custom: [] }
  for (const e of reg.list()) g[e.type === 'cli' ? 'cli' : e.type === 'ollama' ? 'ollama' : e.type === 'cloud' ? 'cloud' : 'custom'].push(e.id)
  return g
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/detect.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: engine detection builds pool from CLIs, ollama, cloud, custom"
```

---

### Task 7: Hat personas + skins

**Files:**
- Create: `src/server/hats.js`
- Test: `test/hats.test.js`

**Interfaces:**
- Produces: `HATS` — array of 6 `{ id, color, emoji, name, system }` in order `white,red,black,yellow,green,blue`.
- Produces: `hatPrompt(hat, topic) -> string` (for the five); `bluePrompt(topic, contributions) -> string` where `contributions = [{ name, text }]`.
- Produces: `applySkin(hats, skins) -> hats` (override `name`/`emoji` by hat id; personas unchanged).

- [ ] **Step 1: Write the failing test**

```js
// test/hats.test.js
import { describe, it, expect } from 'vitest'
import { HATS, hatPrompt, bluePrompt, applySkin } from '../src/server/hats.js'

describe('hats', () => {
  it('has six hats in canonical order', () => {
    expect(HATS.map((h) => h.id)).toEqual(['white', 'red', 'black', 'yellow', 'green', 'blue'])
  })
  it('hatPrompt embeds system persona and topic', () => {
    const p = hatPrompt(HATS[0], '要不要做 X')
    expect(p).toContain(HATS[0].system)
    expect(p).toContain('要不要做 X')
  })
  it('bluePrompt includes every contribution', () => {
    const p = bluePrompt('T', [{ name: 'White', text: 'facts' }, { name: 'Red', text: 'gut' }])
    expect(p).toContain('facts')
    expect(p).toContain('gut')
  })
  it('applySkin overrides display name but keeps persona', () => {
    const skinned = applySkin(HATS, { white: { name: '双儿' } })
    const white = skinned.find((h) => h.id === 'white')
    expect(white.name).toBe('双儿')
    expect(white.system).toBe(HATS[0].system)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/hats.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement hats.js**

```js
// src/server/hats.js
export const HATS = [
  { id: 'white',  color: '#e5e7eb', emoji: '⚪', name: '白帽',
    system: '你戴白帽。只陈述与话题相关的客观事实、数据、已知信息与信息缺口，不做评价、不表态、不给建议。' },
  { id: 'red',    color: '#f87171', emoji: '🔴', name: '红帽',
    system: '你戴红帽。只表达直觉、情绪与第一反应，不需要理由或论证，用感受说话。' },
  { id: 'black',  color: '#374151', emoji: '⚫', name: '黑帽',
    system: '你戴黑帽。只做审慎的批判：指出风险、缺陷、隐患、为什么可能行不通，保持逻辑严谨。' },
  { id: 'yellow', color: '#facc15', emoji: '🟡', name: '黄帽',
    system: '你戴黄帽。只找价值与好处：可行性、机会、正面收益，给出乐观但有依据的判断。' },
  { id: 'green',  color: '#4ade80', emoji: '🟢', name: '绿帽',
    system: '你戴绿帽。只做创造性发散：提出新点子、替代方案、打破常规的可能，鼓励大胆设想。' },
  { id: 'blue',   color: '#60a5fa', emoji: '🔵', name: '蓝帽',
    system: '你戴蓝帽，负责主持与综合。基于其他帽子的发言，梳理要点、指出共识与分歧，给出清晰的结论与下一步建议。' },
]

export function hatPrompt(hat, topic) {
  return `${hat.system}\n\n话题：${topic}\n\n请直接输出你这一顶帽子的观点，不要加前缀，控制在 150 字以内。`
}

export function bluePrompt(topic, contributions) {
  const blue = HATS.find((h) => h.id === 'blue')
  const body = contributions.map((c) => `【${c.name}】${c.text}`).join('\n\n')
  return `${blue.system}\n\n话题：${topic}\n\n以下是其他帽子的发言：\n\n${body}\n\n请综合以上，给出结论与下一步建议，控制在 250 字以内。`
}

export function applySkin(hats, skins = {}) {
  return hats.map((h) => (skins[h.id] ? { ...h, name: skins[h.id].name ?? h.name, emoji: skins[h.id].emoji ?? h.emoji } : h))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/hats.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: six De Bono hat personas with skin overrides"
```

---

### Task 8: Assignment — random-to-model, pinnable, reusable

**Files:**
- Create: `src/server/assign.js`
- Test: `test/assign.test.js`

**Interfaces:**
- Consumes: `HATS`.
- Produces: `assignEngines(hats, engines, { pins = {}, rng = Math.random } = {}) -> { [hatId]: engineId }`. Prefers local engines (caller passes `registry.localFirst()`), honors `pins` (hatId→engineId), reuses engines when fewer than hats, and is deterministic under a seeded `rng`.

- [ ] **Step 1: Write the failing test**

```js
// test/assign.test.js
import { describe, it, expect } from 'vitest'
import { assignEngines } from '../src/server/assign.js'
import { HATS } from '../src/server/hats.js'

const eng = (id) => ({ id, type: 'cli', run: async () => '' })

describe('assign', () => {
  it('assigns every hat an engine', () => {
    const a = assignEngines(HATS, [eng('a'), eng('b'), eng('c')], { rng: () => 0 })
    expect(Object.keys(a).sort()).toEqual(HATS.map((h) => h.id).sort())
  })
  it('honors pins', () => {
    const a = assignEngines(HATS, [eng('a'), eng('b')], { pins: { blue: 'b' }, rng: () => 0 })
    expect(a.blue).toBe('b')
  })
  it('reuses engines when pool smaller than 6', () => {
    const a = assignEngines(HATS, [eng('only')], { rng: () => 0 })
    expect(Object.values(a).every((id) => id === 'only')).toBe(true)
  })
  it('is deterministic under seeded rng', () => {
    const seed = () => 0.42
    const a = assignEngines(HATS, [eng('a'), eng('b'), eng('c')], { rng: seed })
    const b = assignEngines(HATS, [eng('a'), eng('b'), eng('c')], { rng: seed })
    expect(a).toEqual(b)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/assign.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement assign.js**

```js
// src/server/assign.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/assign.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: engine-to-hat assignment with pinning and reuse"
```

---

### Task 9: Orchestration — parallel five, blue summarizes, error isolation

**Files:**
- Create: `src/server/orchestrate.js`
- Test: `test/orchestrate.test.js`

**Interfaces:**
- Consumes: `HATS`, `hatPrompt`, `bluePrompt`.
- Produces: `runDeliberation({ topic, hats, registry, assignment, onUpdate }) -> Promise<{ contributions, summary, errors }>`. Runs the five non-blue hats in parallel via their assigned engine; each failure is captured in `errors[hatId]` and excluded from `contributions`. Blue then summarizes the successful contributions with its assigned engine. `onUpdate(hatId, patch)` is called as each hat starts/finishes.

- [ ] **Step 1: Write the failing test**

```js
// test/orchestrate.test.js
import { describe, it, expect } from 'vitest'
import { runDeliberation } from '../src/server/orchestrate.js'
import { HATS } from '../src/server/hats.js'

function fakeRegistry(map) {
  return { get: (id) => ({ id, run: map[id] }) }
}

describe('orchestrate', () => {
  it('collects five contributions then blue summary', async () => {
    const reg = fakeRegistry({ e: async (p) => (p.includes('其他帽子的发言') ? 'SUMMARY' : 'op') })
    const assignment = Object.fromEntries(HATS.map((h) => [h.id, 'e']))
    const res = await runDeliberation({ topic: 'T', hats: HATS, registry: reg, assignment })
    expect(res.contributions).toHaveLength(5)
    expect(res.summary).toBe('SUMMARY')
    expect(res.errors).toEqual({})
  })
  it('isolates a failing hat and still summarizes the rest', async () => {
    const reg = fakeRegistry({
      good: async (p) => (p.includes('其他帽子的发言') ? 'SUM' : 'ok'),
      bad: async () => { throw new Error('boom') },
    })
    const assignment = Object.fromEntries(HATS.map((h) => [h.id, h.id === 'red' ? 'bad' : 'good']))
    const res = await runDeliberation({ topic: 'T', hats: HATS, registry: reg, assignment })
    expect(res.errors.red).toMatch(/boom/)
    expect(res.contributions).toHaveLength(4)
    expect(res.summary).toBe('SUM')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/orchestrate.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement orchestrate.js**

```js
// src/server/orchestrate.js
import { hatPrompt, bluePrompt } from './hats.js'

export async function runDeliberation({ topic, hats, registry, assignment, onUpdate = () => {} }) {
  const five = hats.filter((h) => h.id !== 'blue')
  const blue = hats.find((h) => h.id === 'blue')
  const errors = {}
  const contributions = []

  await Promise.all(five.map(async (hat) => {
    const engine = registry.get(assignment[hat.id])
    onUpdate(hat.id, { status: 'speaking', engineId: assignment[hat.id] })
    try {
      const text = await engine.run(hatPrompt(hat, topic))
      contributions.push({ hatId: hat.id, name: hat.name, text })
      onUpdate(hat.id, { status: 'done', text })
    } catch (e) {
      errors[hat.id] = e.message
      onUpdate(hat.id, { status: 'error', error: e.message })
    }
  }))

  // keep canonical order for the summary
  const ordered = five.filter((h) => contributions.some((c) => c.hatId === h.id))
    .map((h) => contributions.find((c) => c.hatId === h.id))

  let summary = ''
  if (ordered.length > 0) {
    const engine = registry.get(assignment[blue.id])
    onUpdate(blue.id, { status: 'speaking', engineId: assignment[blue.id] })
    try {
      summary = await engine.run(bluePrompt(topic, ordered))
      onUpdate(blue.id, { status: 'done', text: summary })
    } catch (e) {
      errors[blue.id] = e.message
      onUpdate(blue.id, { status: 'error', error: e.message })
    }
  }
  return { contributions: ordered, summary, errors }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/orchestrate.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: orchestration with parallel hats, blue summary, error isolation"
```

---

### Task 10: HTTP server — routes wired to the kernel

**Files:**
- Create: `src/server/server.js` (replaces old root `server.js`)
- Delete: old `server.js` at repo root
- Test: `test/server.test.js`

**Interfaces:**
- Consumes: everything above.
- Produces: `createApp({ registry, cfg }) -> express app` (exported for tests) with routes:
  - `GET /api/engines` → `{ engines:[{id,type,label}], summary }`
  - `GET /api/hats` → skinned `HATS` (id,color,emoji,name)
  - `POST /api/assign` `{ pins }` → `{ assignment }`
  - `POST /api/run` `{ topic, assignment }` → `{ contributions, summary, errors }` and persists state
  - `GET /api/state`, `POST /api/reset`
- `server.js` also has a `start()` that detects engines then `app.listen(cfg.port)`.

- [ ] **Step 1: Write the failing test**

```js
// test/server.test.js
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
```

- [ ] **Step 2: Add supertest devDep and run to verify it fails**

Run: `npm i -D supertest && npx vitest run test/server.test.js`
Expected: FAIL — `../src/server/server.js` not found.

- [ ] **Step 3: Implement server.js**

```js
// src/server/server.js
import express from 'express'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadConfig } from './config.js'
import { stateFile } from './paths.js'
import { detectEngines, summarize } from './engines/detect.js'
import { HATS, applySkin } from './hats.js'
import { assignEngines } from './assign.js'
import { runDeliberation } from './orchestrate.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function createApp({ registry, cfg }) {
  const app = express()
  app.use(express.json())
  const hats = applySkin(HATS, cfg.skins)

  app.get('/api/engines', (req, res) => {
    res.json({ engines: registry.list().map((e) => ({ id: e.id, type: e.type, label: e.label })), summary: summarize(registry) })
  })
  app.get('/api/hats', (req, res) => res.json(hats.map(({ id, color, emoji, name }) => ({ id, color, emoji, name }))))
  app.post('/api/assign', (req, res) => {
    try { res.json({ assignment: assignEngines(hats, registry.localFirst(), { pins: req.body?.pins ?? {} }) }) }
    catch (e) { res.status(400).json({ error: e.message }) }
  })
  app.post('/api/run', async (req, res) => {
    const { topic, assignment } = req.body ?? {}
    if (!topic || !assignment) return res.status(400).json({ error: 'missing topic/assignment' })
    const result = await runDeliberation({ topic, hats, registry, assignment })
    try { fs.writeFileSync(stateFile(), JSON.stringify({ topic, ...result }, null, 2)) } catch {}
    res.json(result)
  })
  app.get('/api/state', (req, res) => {
    try { res.json(JSON.parse(fs.readFileSync(stateFile(), 'utf8'))) } catch { res.json({ topic: '', contributions: [], summary: '' }) }
  })
  app.post('/api/reset', (req, res) => { try { fs.unlinkSync(stateFile()) } catch {} res.json({ ok: true }) })

  app.use(express.static(join(__dirname, '..', '..', 'dist')))
  return app
}

export async function start() {
  const cfg = loadConfig()
  const registry = await detectEngines(cfg)
  const app = createApp({ registry, cfg })
  app.listen(cfg.port, () => console.log(`Six Hats running on http://localhost:${cfg.port}`))
}

if (import.meta.url === `file://${process.argv[1]}`) start()
```

- [ ] **Step 4: Delete the old root server.js**

Run: `git rm server.js`

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/server.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: express server wiring engine pool, assignment, run"
```

---

### Task 11: Frontend — detection panel, assignment, run, results

**Files:**
- Modify: `src/App.jsx` (rewrite to new API)
- Modify: `src/App.css` (as needed for engine panel / hat cards)
- Modify: `vite.config.js` (proxy already targets 3002 — confirm)
- Test: manual smoke (documented) + `test/app-contract.test.js` (asserts the fetch calls the UI relies on exist on the server)

**Interfaces:**
- Consumes: server routes from Task 10.
- Produces: a working single-page UI: shows `/api/engines` summary; renders six hat cards from `/api/hats`; a topic box; "分配/重新随机" calls `/api/assign`; per-hat pin dropdown (choose engine id) folded into the assignment POST; "开始" calls `/api/run` and renders contributions + blue summary; errors render on the offending card.

- [ ] **Step 1: Write the failing contract test**

```js
// test/app-contract.test.js
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
```

- [ ] **Step 2: Run to verify it passes (routes already exist)**

Run: `npx vitest run test/app-contract.test.js`
Expected: PASS (guards the UI's backend contract).

- [ ] **Step 3: Rewrite App.jsx to the new flow**

Replace `src/App.jsx` with a component that:
- on mount `fetch('/api/engines')` and `fetch('/api/hats')`;
- renders an "引擎检测" panel from `summary`;
- holds `pins` state (`{hatId: engineId|null}`), a topic string, and per-hat result state;
- `随机分配` → `POST /api/assign {pins}` → store `assignment`;
- `开始` → `POST /api/run {topic, assignment}` → set contributions/summary/errors;
- each hat card shows: emoji+name, assigned engine label, a `<select>` to pin an engine (updates `pins`), status (idle/speaking/done/error), and text or error.

```jsx
// src/App.jsx (skeleton — fill card markup against App.css)
import { useEffect, useState } from 'react'
import './App.css'

export default function App() {
  const [engines, setEngines] = useState([])
  const [summary, setSummary] = useState(null)
  const [hats, setHats] = useState([])
  const [pins, setPins] = useState({})
  const [assignment, setAssignment] = useState({})
  const [topic, setTopic] = useState('')
  const [results, setResults] = useState({})   // hatId -> {status,text,error,engineId}
  const [summaryText, setSummaryText] = useState('')

  useEffect(() => {
    fetch('/api/engines').then((r) => r.json()).then((d) => { setEngines(d.engines); setSummary(d.summary) })
    fetch('/api/hats').then((r) => r.json()).then(setHats)
  }, [])

  async function assign() {
    const d = await (await fetch('/api/assign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pins }) })).json()
    setAssignment(d.assignment)
  }
  async function run() {
    if (!topic || !Object.keys(assignment).length) return
    setResults(Object.fromEntries(hats.map((h) => [h.id, { status: 'speaking', engineId: assignment[h.id] }])))
    setSummaryText('')
    const d = await (await fetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, assignment }) })).json()
    const next = {}
    for (const h of hats) {
      const c = d.contributions.find((x) => x.hatId === h.id)
      if (h.id === 'blue') next[h.id] = { status: d.summary ? 'done' : 'error', text: d.summary, error: d.errors.blue }
      else next[h.id] = c ? { status: 'done', text: c.text } : { status: 'error', error: d.errors[h.id] }
    }
    setResults(next); setSummaryText(d.summary)
  }

  return (
    <div className="app">
      <header><h1>🎩 Six Hats</h1></header>
      {summary && (
        <section className="engines">
          {['cli','ollama','cloud','custom'].map((k) => (
            <span key={k} className={`badge ${summary[k].length ? 'on' : 'off'}`}>{k}: {summary[k].join(', ') || '—'}</span>
          ))}
        </section>
      )}
      <section className="controls">
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="输入议题…" />
        <button onClick={assign}>随机分配</button>
        <button onClick={run} disabled={!topic || !Object.keys(assignment).length}>开始</button>
      </section>
      <section className="hats">
        {hats.map((h) => (
          <div key={h.id} className="hat" style={{ borderColor: h.color }}>
            <div className="hat-head">{h.emoji} {h.name}</div>
            <select value={pins[h.id] ?? ''} onChange={(e) => setPins({ ...pins, [h.id]: e.target.value || null })}>
              <option value="">（随机）{assignment[h.id] ? `→ ${assignment[h.id]}` : ''}</option>
              {engines.map((en) => <option key={en.id} value={en.id}>{en.label}</option>)}
            </select>
            <div className={`hat-body ${results[h.id]?.status ?? ''}`}>
              {results[h.id]?.status === 'error' ? <span className="err">⚠ {results[h.id].error}</span> : (results[h.id]?.text ?? '')}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Manual smoke test**

Run: `npm run build && npm start`, open `http://localhost:3002`.
Expected: engine panel shows detected engines; entering a topic, clicking 随机分配 then 开始 yields five opinions and a blue summary. On a machine with no engines and no key, the UI shows all-empty badges and `/api/run` returns an `NO_ENGINES`-style error surfaced on cards.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: adapt React UI to engine detection, assignment, and run"
```

---

### Task 12: Docs, license, cross-platform polish

**Files:**
- Create: `README.md` (English), `README.zh-CN.md` (中文)
- Create: `LICENSE` (MIT, `Copyright (c) 2026 s20sc`)
- Create: `config.example.json`
- Modify: `package.json` (name → `six-hats`, description, license: MIT)

**Interfaces:** none (documentation).

- [ ] **Step 1: Write config.example.json**

```json
{
  "port": 3002,
  "cloud": [
    { "id": "openai", "label": "OpenAI", "baseUrl": "https://api.openai.com/v1", "apiKeyEnv": "OPENAI_API_KEY", "models": ["gpt-4o-mini"] },
    { "id": "openrouter", "label": "OpenRouter", "baseUrl": "https://openrouter.ai/api/v1", "apiKeyEnv": "OPENROUTER_API_KEY", "models": ["anthropic/claude-3.5-sonnet"] }
  ],
  "custom": [],
  "skins": {},
  "openclawAgent": null
}
```

- [ ] **Step 2: Write README.md (English) — cover**

Sections: what it is (De Bono six hats, multi-model deliberation); how it works (engine pool, local-first, cloud fallback, blue summary); requirements (Node ≥18); quick start (`cp .env.example .env`, optional `cp config.example.json config.json`, `npm install`, `npm run build`, `npm start`); using local agents (list detected: claude/codex/agy/hermes/openclaw, Ollama); using cloud (fill a key); custom CLI template; skins; screenshot placeholder `pics/`; license link. Add the `English | 中文` switcher line at top.

- [ ] **Step 3: Write README.zh-CN.md (中文)** — same content, mirror structure, `中文 | English` switcher.

- [ ] **Step 4: Write LICENSE (MIT)** with `Copyright (c) 2026 s20sc`.

- [ ] **Step 5: Update package.json** name to `six-hats`, add `"description"`, `"license": "MIT"`, `"engines": { "node": ">=18" }`.

- [ ] **Step 6: Full test + build gate**

Run: `npm test && npm run build`
Expected: all Vitest suites PASS; Vite build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "docs: bilingual README, MIT license, example config"
```

---

## Self-Review

**Spec coverage:**
- §3 architecture → Tasks 1–11. §4 engine pool → Tasks 2–6. §5 personas/assignment → Tasks 7–8. §6 run flow → Task 9. §7 error handling → Task 9. §8 portability fixes → Task 0 (tmpdir/paths), Task 2 (PATH lookup), Task 10 (state), Task 12 (docs). §9 testing → each task's tests. §10 deliverables → Task 12. All covered.
- Deferred §11 (Skill shell, native Claude/Gemini, streaming) intentionally out of scope — not tasked.

**Placeholder scan:** No TBD/TODO. The only "verify against local install" note (exact CLI flags) is resolved: flags are captured in `CLI_TABLE` in Task 2 from probed `--help` output (`claude -p`, `codex exec`, `agy -p`, `hermes -z/-m`, `openclaw agent --agent --message --json`).

**Type consistency:** `makeEngine({id,type,label,model,run})` shape is used identically across cli/ollama/openai/custom/registry. `run(prompt)` single-arg everywhere (model captured at engine creation). `assignEngines(hats, engines, {pins,rng})` returns `{hatId:engineId}`, consumed unchanged by `runDeliberation` (`registry.get(assignment[hatId])`) and the server. `summarize()` families (`cli/ollama/cloud/custom`) match `engine.type` values.
