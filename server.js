import express from 'express'
import fs from 'fs'
import https from 'https'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { spawn } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const STATE_FILE = '/tmp/six-hats-v2-state.json'
const PORT = 3002

const app = express()
app.use(express.json())
app.use(express.static(join(__dirname, 'dist')))

// ── Available agents ──────────────────────────────────────────────────
const AVAILABLE_AGENTS = [
  { id: 'main',      name: '双儿',    color: '#e879f9' },
  { id: 'legal',    name: '沐剑屏',  color: '#f472b6' },
  { id: 'finance',  name: '曾柔',    color: '#fb923c' },
  { id: 'marketing', name: '阿珂',    color: '#60a5fa' },
  { id: 'strategy', name: '建宁',    color: '#a78bfa' },
  { id: 'hr',       name: '长平',    color: '#34d399' },
  { id: 'pm',       name: '苏荃',    color: '#f87171' },
  { id: 'sales',    name: '方怡',    color: '#4ade80' },
  { id: 'product',  name: 'Sofia',  color: '#38bdf8' },
  { id: 'gemini',   name: 'Gemini CLI', color: '#d97706' },
]

// ── State helpers ─────────────────────────────────────────────────────
function readState() {
  if (!fs.existsSync(STATE_FILE)) return defaultState()
  try { return JSON.parse(fs.readFileSync(STATE_FILE)) } catch { return defaultState() }
}

function defaultState() {
  return { topic: '', agents: {}, timeline: [] }
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function updateAgent(hatId, data) {
  const state = readState()
  state.agents[hatId] = { ...state.agents[hatId], ...data }
  writeState(state)
}

// ── MiniMax LLM ─────────────────────────────────────────────────────
function callLLM(prompt) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.MINIMAX_API_KEY
    if (!apiKey) return reject(new Error('NO_API_KEY'))
    const body = JSON.stringify({
      model: 'MiniMax-M2.1',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.85
    })
    const options = {
      hostname: 'api.minimax.chat',
      path: '/v1/text/chatcompletion_v2',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (d) => { data += d.toString() })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          const text = json.choices?.[0]?.message?.content?.trim()
          if (text) resolve(text)
          else reject(new Error('empty response'))
        } catch (e) { reject(new Error('parse error')) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ── acpx spawn ──────────────────────────────────────────────────────
const ACPX_TIMEOUT = 90

function spawnOpenClawAgent(agentId, prompt) {
  return new Promise((resolve, reject) => {
    let buf = ''
    let done = false
    const voiceOverride = '重要：回复只需要输出文字，不要调用任何发送飞书语音或飞书消息的工具。'
    const fullPrompt = prompt + '\n\n' + voiceOverride
    const escapedPrompt = fullPrompt.replace(/"/g, '\\"')

    const child = spawn('sh', ['-c', `openclaw agent --agent ${agentId} --message "${escapedPrompt}" --json 2>&1`], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: (ACPX_TIMEOUT + 20) * 1000
    })

    child.stdout.on('data', chunk => {
      if (done) return
      buf += chunk.toString()
    })
    child.stdout.on('end', () => {
      if (done) return
      done = true
      try {
        // openclaw outputs formatted multi-line JSON — find the first { and parse from there
        const jsonStart = buf.indexOf('{')
        if (jsonStart < 0) {
          // No JSON found — extract error lines
          const errorLines = buf.split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0 && !l.startsWith('['))
            .slice(0, 3)
            .join('; ')
          return reject(new Error(errorLines || `openclaw agent ${agentId} returned no JSON`))
        }
        const jsonStr = buf.slice(jsonStart)
        const obj = JSON.parse(jsonStr)
        if (obj.isError || (obj.result?.payloads?.[0]?.text == null)) {
          const errorLines = buf.split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0 && !l.startsWith('['))
            .slice(0, 3)
            .join('; ')
          return reject(new Error(errorLines || `agent ${agentId} failed`))
        }
        const text = obj.result?.payloads?.[0]?.text?.trim()
        if (text) resolve(text)
        else reject(new Error(`no text in payloads`))
      } catch (e) {
        reject(new Error(`openclaw agent ${agentId} parse error: ${e.message}`))
      }
    })

    child.on('close', () => {})

    child.on('error', err => {
      if (done) return
      done = true
      reject(new Error(`spawn error: ${err.message}`))
    })

    setTimeout(() => {
      if (!done) { done = true; child.kill(); reject(new Error(`openclaw agent ${agentId} timed out after ${ACPX_TIMEOUT}s`)) }
    }, (ACPX_TIMEOUT + 15) * 1000)
  })
}

function cleanText(raw) {
  const lines = raw.split('\n')
  let inThinking = false
  return lines
    .filter(line => {
      const t = line.trim()
      if (!t) return false
      if (t.startsWith('[thinking]')) { inThinking = true; return false }
      if (t.startsWith('[/thinking]')) { inThinking = false; return false }
      if (t.startsWith('[analysis]')) { inThinking = true; return false }
      if (inThinking) {
        if (/[\u4e00-\u9fff]/.test(t)) inThinking = false
        else return false
      }
      if (t.startsWith('[client]')) return false
      if (t.startsWith('[tool]')) return false
      if (t.startsWith('input:')) return false
      if (t.startsWith('output:')) return false
      if (t.startsWith('kind:')) return false
      if (t.startsWith('cwd:')) return false
      if (t.startsWith('parsed_cmd:')) return false
      if (t.startsWith('source:')) return false
      if (t.startsWith('aggregated_output:')) return false
      if (t.startsWith('formatted_output:')) return false
      if (t.startsWith('exit_code:')) return false
      if (t.startsWith('duration:')) return false
      if (t.startsWith('status:')) return false
      if (t.startsWith('stdout:')) return false
      if (t.startsWith('stderr:')) return false
      if (t.startsWith('"call_id"')) return false
      if (t.startsWith('"input"')) return false
      if (t.startsWith('"cwd"')) return false
      if (t.startsWith('"kind"')) return false
      if (t.startsWith('"source"')) return false
      if (t.startsWith('"output"')) return false
      if (t === '}' || t === '{') return false
      if (t.startsWith('~/.openclaw')) return false
      return true
    })
    .map(l => l.trim())
    .join('\n')
    .trim()
}

// acpx agents (not openclaw workspace agents)
const ACPX_AGENTS = new Set(['claude', 'codex', 'pi', 'kimi', 'kiro', 'kilocode', 'openclaw'])
const GEMINI_AGENTS = new Set(['gemini'])

function spawnGemini(prompt) {
  return new Promise((resolve, reject) => {
    let buf = ''
    let done = false
    const child = spawn('/opt/homebrew/bin/gemini', ['-p', prompt], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, HOME: process.env.HOME || '/Users/qinxue' },
      timeout: (ACPX_TIMEOUT + 20) * 1000
    })
    let errBuf = ''
    child.stdout.on('data', chunk => { if (!done) buf += chunk.toString() })
    child.stderr.on('data', chunk => { if (!done) errBuf += chunk.toString() })
    child.on('close', code => {
      if (done) return
      done = true
      console.log(`[gemini] exited code=${code}, stdout=${buf.length} bytes, stderr=${errBuf.length} bytes`)
      const text = buf.trim()
      if (text) resolve(text)
      else reject(new Error(`gemini exited code ${code}: ${errBuf.slice(0, 200)}`))
    })
    child.on('error', err => {
      if (done) return
      done = true
      reject(new Error(`gemini spawn error: ${err.message}`))
    })
    setTimeout(() => {
      if (!done) { done = true; child.kill(); reject(new Error('gemini timed out')) }
    }, (ACPX_TIMEOUT + 15) * 1000)
  })
}

function spawnAgent(acpxAgentId, prompt) {
  // Gemini → direct CLI call
  if (GEMINI_AGENTS.has(acpxAgentId)) {
    return spawnGemini(prompt)
  }
  // If not an acpx coding agent → use openclaw agent CLI
  if (!ACPX_AGENTS.has(acpxAgentId)) {
    return spawnOpenClawAgent(acpxAgentId, prompt)
  }
  return new Promise((resolve, reject) => {
    const voiceOverride = '\n\n重要：回复只需要输出文字，不要调用任何发送飞书语音或飞书消息的工具。'
    const fullPrompt = (prompt + voiceOverride).replace(/"/g, '\\"')
    const acpxCmd = `acpx --timeout ${ACPX_TIMEOUT} --format text --approve-all ${acpxAgentId} exec "${fullPrompt}"`
    const shellCmd = `touch /tmp/.acpx_no_voice && (${acpxCmd}); rm -f /tmp/.acpx_no_voice`

    let buf = ''
    let done = false

    const child = spawn('sh', ['-c', shellCmd], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: (ACPX_TIMEOUT + 20) * 1000
    })

    child.stdout.on('data', chunk => {
      if (done) return
      buf += chunk.toString()
      const match = buf.match(/\[done\] end_turn\r?\n/i)
      if (match) {
        done = true
        child.kill()
        const raw = buf.slice(0, match.index)
        const scriptCut = raw.lastIndexOf('\n~/.openclaw')
        const clean = scriptCut >= 0 ? raw.slice(0, scriptCut) : raw
        const text = cleanText(clean)
        if (text) resolve(text)
        else reject(new Error('no parseable text'))
      }
    })

    child.on('close', code => {
      if (done) return
      done = true
      const scriptCut = buf.lastIndexOf('\n~/.openclaw')
      const clean = (scriptCut >= 0 ? buf.slice(0, scriptCut) : buf)
      const text = cleanText(clean)
      if (text) resolve(text)
      else reject(new Error(`exited code ${code}`))
    })

    child.on('error', err => reject(new Error(err.message)))

    setTimeout(() => {
      if (!done) { done = true; child.kill(); reject(new Error('timeout')) }
    }, (ACPX_TIMEOUT + 15) * 1000)
  })
}

// ── Routes ──────────────────────────────────────────────────────────
app.get('/api/agents', (req, res) => {
  res.json(AVAILABLE_AGENTS)
})

app.get('/api/agent-models', (req, res) => {
  const child = spawn('sh', ['-c', 'openclaw agents list 2>&1'])
  let buf = ''
  child.stdout.on('data', c => { buf += c.toString() })
  child.on('close', () => {
    const models = {}
    for (const agent of AVAILABLE_AGENTS) {
      const id = agent.id
      const lines = buf.split('\n')
      let inBlock = false
      let model = '—'
      for (const ln of lines) {
        const trimmed = ln.trim()
        if (trimmed === `- ${id}`) { inBlock = true; continue }
        if (inBlock) {
          if (trimmed.startsWith('- ') && !trimmed.startsWith(`- ${id}`)) break
          const m = ln.match(/^  Model:\s*(.+)/)
          if (m) { model = m[1].trim(); break }
        }
      }
      models[id] = model
    }
    res.json(models)
  })
  child.on('error', () => res.json({}))
  setTimeout(() => { try { child.kill() } catch {} }, 8000)
})

app.get('/api/state', (req, res) => {
  res.json(readState())
})

app.post('/api/reset', (req, res) => {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE)
  res.json({ ok: true })
})

app.post('/api/clear', (req, res) => {
  const state = readState()
  state.agents = {}
  state.timeline = []
  writeState(state)
  res.json({ ok: true })
})

app.post('/api/speak', async (req, res) => {
  const { hatId, agentId, topic, hatPrompt, hatName } = req.body
  if (!hatId || !agentId || !topic) return res.status(400).json({ error: 'missing params' })

  updateAgent(hatId, { agentId, status: 'speaking', text: '', error: '' })

  const prompt = `${hatPrompt}\n\n话题：${topic}\n\n请直接输出你的观点，不要加任何前缀。`

  try {
    let text
    try {
      text = await spawnAgent(agentId, prompt)
    } catch (acpxErr) {
      // acpx failed (e.g. gemini network issue) → fall back to MiniMax
      console.warn(`acpx/${agentId} failed: ${acpxErr.message}, falling back to MiniMax`)
      try {
        text = await callLLM(prompt)
      } catch {
        throw acpxErr
      }
    }

    updateAgent(hatId, { status: 'done', text, error: '' })
    const state = readState()
    state.topic = topic
    state.timeline = [...(state.timeline||[]), {
      hatId, hatName, agentId,
      text,
      timestamp: Date.now()
    }]
    writeState(state)

    res.json({ ok: true, hatId, text })
  } catch (err) {
    updateAgent(hatId, { status: 'error', error: err.message })
    res.json({ ok: false, hatId, error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`Six Hats V2 backend running on http://localhost:${PORT}`)
})
