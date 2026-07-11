import { useEffect, useRef, useState } from 'react'
import './App.css'

const STATUS_LABELS = { idle: '待发言', speaking: '思考中', done: '已完成', error: '出错' }

// Editorial kicker for each hat — the API only sends id/color/emoji/name.
const HAT_LABELS = {
  white: 'White Hat · 事实与数据',
  red: 'Red Hat · 直觉与情绪',
  black: 'Black Hat · 谨慎与风险',
  yellow: 'Yellow Hat · 乐观与收益',
  green: 'Green Hat · 创造与发散',
  blue: 'Blue Hat · 综合与推进',
}

// Concise theme shown in the exported markdown, e.g. 白帽（事实与数据）.
const HAT_THEME = {
  white: '事实与数据',
  red: '直觉与情绪',
  black: '谨慎与风险',
  yellow: '乐观与收益',
  green: '创造与发散',
  blue: '综合与推进',
}

// The white hat's near-white color is invisible on a light board — nudge to warm gray.
const HAT_ACCENT = { white: '#9ca3af' }
const accentOf = (hat) => HAT_ACCENT[hat.id] || hat.color

// Playful pinned annotations — pure whiteboard decoration, one per few hats.
// Bottom-row hats only — notes hang off the outer-bottom corners into the empty
// area below the grid, clear of every card's title and text.
const STICKY = {
  yellow: { text: '价值！', tone: 'yellow', pos: 'bl', rot: -6 },
  green: { text: 'Good Idea!', tone: 'sticker-green', pos: 'br', sticker: true, rot: 5 },
  blue: { text: '推进！', tone: 'blue', pos: 'br', rot: 6 },
}

const AVATAR_TONES = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

// OpenAI-compatible (/chat/completions) cloud providers — enter a key, no CLI needed.
const CLOUD_PRESETS = [
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-3.5-sonnet' },
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { label: 'Kimi (Moonshot)', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { label: '自定义', baseUrl: '', model: '' },
]

/* ── Inline icons ────────────────────────────────────────────────── */
function IconCopy() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
}
function IconCheck() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
}
function IconRefresh() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
}
function IconShuffle() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5" /><path d="M4 20 21 3" /><path d="M21 16v5h-5" /><path d="m15 15 6 6" /><path d="M4 4l5 5" /></svg>
}
function IconPlay() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M6 4l14 8-14 8z" /></svg>
}
function IconGear() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
}
function IconClose() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
}

function CloudSettings({ open, onClose, providers, onAdd, onRemove }) {
  const [preset, setPreset] = useState(0)
  const [form, setForm] = useState({ label: CLOUD_PRESETS[0].label, baseUrl: CLOUD_PRESETS[0].baseUrl, apiKey: '', model: CLOUD_PRESETS[0].model })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (!open) return null

  function pick(i) {
    setPreset(i)
    const p = CLOUD_PRESETS[i]
    setForm((f) => ({ ...f, label: p.label === '自定义' ? '' : p.label, baseUrl: p.baseUrl, model: p.model }))
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  async function submit() {
    setErr(''); setBusy(true)
    try { await onAdd(form); setForm((f) => ({ ...f, apiKey: '' })) }
    catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>云引擎</h2>
          <button className="tool" onClick={onClose} title="关闭"><IconClose /></button>
        </div>
        <p className="modal-hint">填入 API Key 即可使用云端模型，<b>无需安装任何 CLI</b>。密钥仅本地明文保存在 <code>~/.six-hats/cloud.json</code>。</p>
        <div className="cloud-form">
          <label className="field"><span>服务商</span>
            <select value={preset} onChange={(e) => pick(Number(e.target.value))}>
              {CLOUD_PRESETS.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
            </select>
          </label>
          <label className="field"><span>名称</span><input value={form.label} onChange={set('label')} placeholder="OpenAI" /></label>
          <label className="field"><span>Base URL</span><input value={form.baseUrl} onChange={set('baseUrl')} placeholder="https://api.openai.com/v1" /></label>
          <label className="field"><span>模型</span><input value={form.model} onChange={set('model')} placeholder="gpt-4o-mini" /></label>
          <label className="field"><span>API Key</span><input type="password" value={form.apiKey} onChange={set('apiKey')} placeholder="sk-…" autoComplete="off" /></label>
          {err && <div className="cloud-err">⚠ {err}</div>}
          <button className="nbtn nbtn--primary cloud-add" onClick={submit} disabled={busy}>{busy ? '添加中…' : '添加引擎'}</button>
        </div>
        <div className="cloud-list">
          {providers.length === 0
            ? <p className="cloud-empty">还没有添加云引擎</p>
            : providers.map((p) => (
              <div key={p.id} className="cloud-item">
                <div className="cloud-item__info">
                  <b>{p.label}</b> <span className="cloud-model">{p.models.join(', ')}</span>
                  <div className="cloud-key">{p.keyMasked}</div>
                </div>
                <button className="nbtn cloud-del" onClick={() => onRemove(p.id)}>删除</button>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

function SpeakingDots() {
  return <span className="dots" aria-label="思考中"><span /><span /><span /></span>
}

// Draggable pinned note — drag it out of the way when long text runs under it.
// Offset persists per hat in localStorage.
function StickyNote({ note, storageKey }) {
  const key = storageKey ? `sixhats.sticky.${storageKey}` : null
  const [pos, setPos] = useState(() => {
    if (!key) return { dx: 0, dy: 0 }
    try {
      const v = JSON.parse(localStorage.getItem(key))
      if (v && Number.isFinite(v.dx) && Number.isFinite(v.dy)) return { dx: v.dx, dy: v.dy }
    } catch {}
    return { dx: 0, dy: 0 }
  })
  const dragRef = useRef(null)
  if (!note) return null
  const rot = note.rot ?? 0

  const posFromEvent = (e) => {
    const d = dragRef.current
    return { dx: d.dx + (e.clientX - d.sx), dy: d.dy + (e.clientY - d.sy) }
  }
  function down(e) {
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    dragRef.current = { sx: e.clientX, sy: e.clientY, dx: pos.dx, dy: pos.dy }
  }
  function move(e) {
    if (!dragRef.current) return
    setPos(posFromEvent(e))
  }
  function up(e) {
    if (!dragRef.current) return
    const final = posFromEvent(e) // from the event, never a stale render
    dragRef.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
    setPos(final)
    if (key) { try { localStorage.setItem(key, JSON.stringify(final)) } catch {} }
  }

  const cls = note.sticker ? `sticker sticker--${note.tone}` : `sticky-note sticky--${note.tone} sticky--${note.pos}`
  return (
    <span
      className={cls}
      style={{ transform: `translate(${pos.dx}px, ${pos.dy}px) rotate(${rot}deg)` }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      title="拖动我"
    >
      {note.text}
    </span>
  )
}

function HatCard({ hat, engines, assignedId, pinnedId, onPinChange, result, onRefresh, canRefresh, onCopy, copiedId }) {
  const status = result?.status ?? 'idle'
  const assignedEngine = engines.find((e) => e.id === assignedId)
  const canCopy = Boolean(result?.text)
  const note = STICKY[hat.id]

  return (
    <article className={`card card--${hat.id} card--${status}`} style={{ '--hat-color': accentOf(hat) }}>
      <div className="card-head">
        <span className="card-icon">{hat.emoji}</span>
        <div className="card-title-group">
          <h3 className="card-title">{hat.name}</h3>
          <span className="card-subtitle">{HAT_LABELS[hat.id] || ''}</span>
        </div>
        <span className={`card-badge card-badge--${status}`}>{STATUS_LABELS[status]}</span>
      </div>

      <div className="card-pin">
        <select value={pinnedId ?? ''} onChange={(e) => onPinChange(hat.id, e.target.value || null)}>
          <option value="">🎲 随机{assignedEngine ? ` → ${assignedEngine.label}` : ''}</option>
          {engines.map((en) => (
            <option key={en.id} value={en.id}>{en.label}</option>
          ))}
        </select>
        <div className="card-tools">
          <button className="tool" onClick={() => onCopy(result?.text, hat.id)} disabled={!canCopy} title="复制这一顶帽子">
            {copiedId === hat.id ? <IconCheck /> : <IconCopy />}
          </button>
          <button className="tool" onClick={() => onRefresh(hat.id)} disabled={!canRefresh} title="重新生成这一顶帽子">
            <IconRefresh />
          </button>
        </div>
      </div>

      <div className="card-body">
        {status === 'error' ? (
          <span className="card-error">⚠ {result.error}</span>
        ) : status === 'speaking' ? (
          <SpeakingDots />
        ) : result?.text ? (
          <p className="card-text">{result.text}</p>
        ) : (
          <p className="card-placeholder">等待这顶帽子发言…</p>
        )}
      </div>

      <StickyNote note={note} storageKey={hat.id} />
    </article>
  )
}

export default function App() {
  const [engines, setEngines] = useState([])
  const [hats, setHats] = useState([])
  const [pins, setPins] = useState({})
  const [assignment, setAssignment] = useState({})
  const [assignError, setAssignError] = useState('')
  const [topic, setTopic] = useState('')
  const [results, setResults] = useState({})
  const [running, setRunning] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [cloud, setCloud] = useState([])

  function loadEngines() {
    fetch('/api/engines').then((r) => r.json()).then((d) => setEngines(d.engines)).catch(() => {})
  }
  function loadCloud() {
    fetch('/api/cloud').then((r) => r.json()).then((d) => setCloud(d.providers || [])).catch(() => {})
  }
  async function addCloud(form) {
    const res = await fetch('/api/cloud', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await res.json()
    if (!res.ok) throw new Error(d.error || '添加失败')
    setCloud(d.providers || [])
    loadEngines()
  }
  async function removeCloud(id) {
    const res = await fetch(`/api/cloud/${encodeURIComponent(id)}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    setCloud(d.providers || [])
    loadEngines()
  }

  function copyText(text, id) {
    if (!text || !navigator.clipboard) return
    navigator.clipboard.writeText(text)
      .then(() => { setCopiedId(id); setTimeout(() => setCopiedId(null), 1500) })
      .catch(() => {})
  }

  function engineTag(engineId) {
    const label = engines.find((e) => e.id === engineId)?.label || engineId || ''
    return label ? ` · ${label}` : ''
  }

  function buildMarkdown() {
    const sections = []
    for (const h of hats) {
      if (h.id === 'blue') continue
      const r = results[h.id]
      if (r?.status !== 'done' || !r.text) continue
      sections.push(`## ${h.emoji} ${h.name}（${HAT_THEME[h.id] || ''}）${engineTag(r.engineId)}\n${r.text}`)
    }
    let doc = `# 六顶思考帽 · ${topic}\n\n${sections.join('\n\n')}`
    const blueR = results.blue
    if (blueR?.status === 'done' && blueR.text) {
      const blue = hats.find((h) => h.id === 'blue')
      doc += `\n\n## ${blue?.emoji || '🔵'} ${blue?.name || '蓝帽'}（${HAT_THEME.blue}）${engineTag(blueR.engineId)}\n${blueR.text}`
    }
    return doc
  }

  useEffect(() => {
    loadEngines()
    loadCloud()
    fetch('/api/hats').then((r) => r.json()).then(setHats)
  }, [])

  async function assign() {
    setAssignError('')
    try {
      const res = await fetch('/api/assign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pins }),
      })
      const d = await res.json()
      if (!res.ok) { setAssignError(d.error || '分配失败'); return }
      setAssignment(d.assignment)
    } catch (err) { setAssignError(err.message) }
  }

  async function run() {
    if (!topic.trim() || !Object.keys(assignment).length) return
    setRunning(true)
    const effective = Object.fromEntries(hats.map((h) => [h.id, pins[h.id] || assignment[h.id]]))
    setResults(Object.fromEntries(hats.map((h) => [h.id, { status: 'speaking', engineId: effective[h.id] }])))

    try {
      const res = await fetch('/api/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, assignment: effective }),
      })
      const d = await res.json()
      if (!res.ok) {
        setResults(Object.fromEntries(hats.map((h) => [h.id, { status: 'error', error: d.error || '运行失败' }])))
        return
      }
      const next = {}
      for (const h of hats) {
        const engineId = effective[h.id]
        if (h.id === 'blue') {
          next[h.id] = d.summary ? { status: 'done', text: d.summary, engineId } : { status: 'error', error: d.errors?.blue || '未知错误', engineId }
        } else {
          const c = d.contributions?.find((x) => x.hatId === h.id)
          next[h.id] = c ? { status: 'done', text: c.text, engineId } : { status: 'error', error: d.errors?.[h.id] || '未知错误', engineId }
        }
      }
      setResults(next)
    } catch (err) {
      setResults(Object.fromEntries(hats.map((h) => [h.id, { status: 'error', error: err.message }])))
    } finally { setRunning(false) }
  }

  async function refreshHat(hatId) {
    const hat = hats.find((h) => h.id === hatId)
    if (!hat) return
    const engineId = pins[hatId] || assignment[hatId]
    if (!engineId) return
    setResults((prev) => ({ ...prev, [hatId]: { status: 'speaking', engineId } }))

    const contributions = hat.id === 'blue'
      ? hats.filter((h) => h.id !== 'blue' && results[h.id]?.status === 'done' && results[h.id]?.text)
          .map((h) => ({ hatId: h.id, name: h.name, text: results[h.id].text }))
      : []

    try {
      const res = await fetch('/api/run-hat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, hatId, engineId, contributions }),
      })
      const d = await res.json()
      if (!res.ok) { setResults((prev) => ({ ...prev, [hatId]: { status: 'error', error: d.error || '刷新失败' } })); return }
      const next = d.text ? { status: 'done', text: d.text, engineId } : { status: 'error', error: d.error || '未知错误', engineId }
      setResults((prev) => ({ ...prev, [hatId]: next }))
    } catch (err) {
      setResults((prev) => ({ ...prev, [hatId]: { status: 'error', error: err.message } }))
    }
  }

  const canAssign = engines.length > 0
  const canRun = !running && topic.trim() && Object.keys(assignment).length > 0
  const canCopyAll = hats.some((h) => results[h.id]?.status === 'done' && results[h.id]?.text)

  return (
    <div className="board-app">
      <header className="topbar">
        <div className="topbar__logo">
          <div className="topbar__dots">
            {hats.map((h) => <span key={h.id} className="dot" style={{ background: accentOf(h) }} />)}
          </div>
          <span className="topbar__title">Six&nbsp;Hats <em>· AI 联席脑暴看板</em></span>
        </div>
        <div className="topbar__right">
          <div className="engine-chips" title="在场引擎">
            <span className="engine-chips__label">在场引擎</span>
            {engines.length === 0 ? (
              <span className="engine-chip engine-chip--none">未检测到引擎</span>
            ) : (
              engines.map((e, i) => (
                <span key={e.id} className="engine-chip" title={e.id}>
                  <span className="engine-chip__dot" style={{ background: AVATAR_TONES[i % AVATAR_TONES.length] }} />
                  {e.label}
                </span>
              ))
            )}
          </div>
          <button className="btn-icon" onClick={() => setShowSettings(true)} title="云引擎设置"><IconGear /></button>
          <button className="btn-share" onClick={() => copyText(buildMarkdown(), 'all')} disabled={!canCopyAll}>
            {copiedId === 'all' ? '已复制 ✓' : '分享看板'}
          </button>
        </div>
      </header>

      <div className="deck">
        <input
          className="topic-input"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && canRun) run() }}
          placeholder="把要脑暴的议题写在这里…"
        />
        <button className="nbtn" onClick={assign} disabled={!canAssign} title={canAssign ? '' : '未检测到可用引擎'}>
          <IconShuffle /> 随机分配
        </button>
        <button className="nbtn nbtn--primary" onClick={run} disabled={!canRun}>
          <IconPlay /> {running ? '思考中…' : '开始审议'}
        </button>
      </div>

      {assignError && <div className="assign-error">⚠ {assignError}</div>}

      <section className="canvas">
        {hats.map((h) => (
          <HatCard
            key={h.id}
            hat={h}
            engines={engines}
            assignedId={assignment[h.id]}
            pinnedId={pins[h.id]}
            onPinChange={(hatId, engineId) => setPins((p) => ({ ...p, [hatId]: engineId }))}
            result={results[h.id]}
            onRefresh={refreshHat}
            canRefresh={Boolean(topic.trim()) && Boolean(assignment[h.id])}
            onCopy={copyText}
            copiedId={copiedId}
          />
        ))}
      </section>

      <footer className="board-footer">Local-first · 六顶思考帽 · De Bono Six Thinking Hats</footer>

      <CloudSettings open={showSettings} onClose={() => setShowSettings(false)} providers={cloud} onAdd={addCloud} onRemove={removeCloud} />
    </div>
  )
}
