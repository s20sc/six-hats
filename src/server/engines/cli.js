import { spawn, execFile, execFileSync } from 'node:child_process'
import { makeEngine } from './registry.js'

const ANSI = /\x1b\[[0-9;]*m/g

// Some agent CLIs (notably Claude Code with skill/hook plugins) print
// preamble lines to stdout before the real answer, e.g. "No skills needed",
// "Activating: <skill> — <reason>", "Using <skill> to <purpose>". Drop such
// noise from the START of the output only, stopping at the first real line.
const PREAMBLE = /^(no skills needed\.?|activating:.*|using .+ to .+|✳.*)$/i
export function stripLeadingNoise(text) {
  const lines = text.split('\n')
  let i = 0
  while (i < lines.length && (lines[i].trim() === '' || PREAMBLE.test(lines[i].trim()))) i++
  return lines.slice(i).join('\n').trim()
}

export const CLI_TABLE = {
  claude:   { bin: 'claude',   buildArgs: (p) => ['-p', p],                              parse: 'raw' },
  codex:    { bin: 'codex',    buildArgs: (p) => ['exec', p],                            parse: 'raw' },
  agy:      { bin: 'agy',      buildArgs: (p) => ['-p', p],                              parse: 'raw' },
  hermes:   { bin: 'hermes',   buildArgs: (p, m) => (m ? ['-z', p, '-m', m] : ['-z', p]), parse: 'raw' },
  openclaw: { bin: 'openclaw', buildArgs: (p, m) => { if (!m) throw new Error('openclaw requires an agent id (model)'); return ['agent', '--agent', m, '--message', p, '--json'] }, parse: 'openclaw-json' },
}

export function whichSync(bin) {
  try { return execFileSync(process.platform === 'win32' ? 'where' : 'which', [bin]).toString().split('\n')[0].trim() || null }
  catch { return null }
}

// Default runner: async so it never blocks the event loop on the request path.
// execFile buffers stderr (no console leak) and still yields stdout on non-zero exit.
function runOpenclawList() {
  return new Promise((resolve) => {
    execFile('openclaw', ['agents', 'list'], { timeout: 8000, maxBuffer: 1 << 20 }, (_err, stdout) => {
      resolve((stdout ?? '').toString())
    })
  })
}

// List all locally-configured openclaw agents — each becomes its own engine.
// Real entries sit at column 0 as "- <id>"; the doctor-warning box is indented
// (e.g. "│  - …"). Parsing is bounded to the contiguous block under "Agents:" so a
// later section's column-0 bullet (routing rules, channels) is never mistaken for an agent.
export async function listOpenclawAgents({ which = whichSync, execImpl = runOpenclawList } = {}) {
  if (!which('openclaw')) return []
  let out = ''
  try { out = await execImpl() } catch (e) { out = (e?.stdout ?? '').toString() }
  out = (out ?? '').toString()

  const agents = []
  let inAgents = false
  for (const line of out.split('\n')) {
    if (line.trim() === 'Agents:') { inAgents = true; continue }
    if (!inAgents) continue
    const m = line.match(/^- (\S+)/)
    if (m) { agents.push(m[1]); continue }
    if (line.trim() === '' || /^\s/.test(line)) continue // blank or indented detail → still in block
    break // a column-0 non-agent line begins the next section
  }
  return [...new Set(agents)]
}

export function cleanOutput(raw, parse) {
  const stripped = raw.replace(ANSI, '')
  if (parse === 'openclaw-json') {
    const i = stripped.indexOf('{')
    if (i < 0) return stripped.trim()
    try { return (JSON.parse(stripped.slice(i)).result?.payloads?.[0]?.text ?? '').trim() } catch { return stripped.trim() }
  }
  return stripLeadingNoise(stripped.trim())
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
      if (code !== 0) throw new Error(`${tool} exited ${code}: ${stderr.slice(0, 200)}`)
      const text = cleanOutput(stdout, spec.parse)
      if (!text) throw new Error(`${tool} returned no text (code ${code}): ${stderr.slice(0, 200)}`)
      return text
    },
  })
}
