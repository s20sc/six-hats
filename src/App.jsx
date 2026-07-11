import { useEffect, useState } from 'react'
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
  yellow: { text: '价值！', tone: 'yellow', pos: 'bl' },
  green: { text: 'Good Idea!', tone: 'sticker-green', pos: 'br', sticker: true },
  blue: { text: '推进！', tone: 'blue', pos: 'br' },
}

const AVATAR_TONES = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

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

function SpeakingDots() {
  return <span className="dots" aria-label="思考中"><span /><span /><span /></span>
}

function StickyNote({ note }) {
  if (!note) return null
  const cls = note.sticker ? `sticker sticker--${note.tone}` : `sticky-note sticky--${note.tone} sticky--${note.pos}`
  return <span className={cls}>{note.text}</span>
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

      <StickyNote note={note} />
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
  const [summaryText, setSummaryText] = useState('')
  const [running, setRunning] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

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
    if (summaryText) {
      const blue = hats.find((h) => h.id === 'blue')
      doc += `\n\n## ${blue?.emoji || '🔵'} ${blue?.name || '蓝帽'}（${HAT_THEME.blue}）${engineTag(results.blue?.engineId)}\n${summaryText}`
    }
    return doc
  }

  useEffect(() => {
    fetch('/api/engines').then((r) => r.json()).then((d) => setEngines(d.engines))
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
    setSummaryText('')
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
        setSummaryText('')
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
      setSummaryText(d.summary || '')
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
      if (hatId === 'blue' && d.text) setSummaryText(d.text)
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
    </div>
  )
}
