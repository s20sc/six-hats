import { spawn, execFileSync } from 'node:child_process'
import { makeEngine } from './registry.js'

const ANSI = /\x1b\[[0-9;]*m/g

export const CLI_TABLE = {
  claude:   { bin: 'claude',   buildArgs: (p) => ['-p', p],                              parse: 'raw' },
  codex:    { bin: 'codex',    buildArgs: (p) => ['exec', p],                            parse: 'raw' },
  agy:      { bin: 'agy',      buildArgs: (p) => ['-p', p],                              parse: 'raw' },
  hermes:   { bin: 'hermes',   buildArgs: (p, m) => (m ? ['-z', p, '-m', m] : ['-z', p]), parse: 'raw' },
  openclaw: { bin: 'openclaw', buildArgs: (p, m) => { if (!m) throw new Error('openclaw requires an agent id (model)'); return ['agent', '--agent', m, '--message', p, '--json'] }, parse: 'openclaw-json' },
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
    const timer = setTimeout(() => { if (!done) { done = true; try { child.kill() } catch {} reject(new Error(`${bin} timed out`)) } }, timeoutMs)
    child.on('close', (code) => { if (!done) { done = true; clearTimeout(timer); resolve({ code, stdout: out, stderr: err }) } })
    child.on('error', (e) => { if (!done) { done = true; clearTimeout(timer); reject(e) } })
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
