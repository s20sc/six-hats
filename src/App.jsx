import { useEffect, useState } from 'react'
import './App.css'

const SUMMARY_LABELS = { cli: 'CLI', ollama: 'Ollama', cloud: 'Cloud', custom: 'Custom' }
const STATUS_LABELS = { idle: '待发言', speaking: '思考中', done: '已完成', error: '出错' }

// Editorial kicker for each hat — the API only sends id/color/emoji/name.
const HAT_LABELS = {
  white: '事实与数据',
  red: '直觉与感受',
  black: '谨慎与风险',
  yellow: '价值与收益',
  green: '创造与发散',
  blue: '综合与推进',
}

// The white hat's #e5e7eb is nearly invisible on light paper — give its
// accents a legible warm-gray while keeping the "neutral/white" reading.
const HAT_ACCENT = { white: '#a8a29e' }
const accentOf = (hat) => HAT_ACCENT[hat.id] || hat.color

/* ── Inline icons (crisp, currentColor) ─────────────────────────── */
function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  )
}
function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
function IconRefresh() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
    </svg>
  )
}

function SpeakingDots() {
  return (
    <span className="dots" aria-label="思考中">
      <span /><span /><span />
    </span>
  )
}

// Six-color spectrum — the signature mark tying the whole board to its six hats.
function Spectrum({ hats, className = '' }) {
  if (!hats?.length) return null
  return (
    <div className={`spectrum ${className}`} aria-hidden="true">
      {hats.map((h) => (
        <span key={h.id} style={{ background: accentOf(h) }} />
      ))}
    </div>
  )
}

function EngineCredits({ summary }) {
  if (!summary) return null
  const keys = ['cli', 'ollama', 'cloud', 'custom']
  const total = keys.reduce((n, k) => n + (summary[k]?.length || 0), 0)
  return (
    <div className="credits">
      <span className="credits__label">在场引擎</span>
      {total === 0 ? (
        <span className="credits__none">未检测到可用引擎</span>
      ) : (
        keys
          .filter((k) => summary[k]?.length)
          .map((k) => (
            <span key={k} className="credits__group">
              <span className="credits__kind">{SUMMARY_LABELS[k]}</span>
              {summary[k].join(' · ')}
            </span>
          ))
      )}
    </div>
  )
}

function HatCard({ hat, index, engines, assignedId, pinnedId, onPinChange, result, onRefresh, canRefresh, onCopy, copiedId }) {
  const status = result?.status ?? 'idle'
  const assignedEngine = engines.find((e) => e.id === assignedId)
  const canCopy = Boolean(result?.text)

  return (
    <article className={`hat hat--${status}`} style={{ '--hat-color': accentOf(hat), '--i': index }}>
      <div className="hat-head">
        <span className="hat-dot" />
        <div className="hat-title">
          <span className="hat-name">{hat.name}</span>
          <span className="hat-kicker">{HAT_LABELS[hat.id] || ''}</span>
        </div>
        <span className={`hat-status hat-status--${status}`}>{STATUS_LABELS[status]}</span>
        <div className="hat-tools">
          <button className="tool" onClick={() => onCopy(result?.text, hat.id)} disabled={!canCopy} title="复制这一顶帽子的内容">
            {copiedId === hat.id ? <IconCheck /> : <IconCopy />}
          </button>
          <button className="tool" onClick={() => onRefresh(hat.id)} disabled={!canRefresh} title="重新生成这一顶帽子">
            <IconRefresh />
          </button>
        </div>
      </div>

      <label className="hat-pin">
        <span className="hat-pin__label">引擎</span>
        <select value={pinnedId ?? ''} onChange={(e) => onPinChange(hat.id, e.target.value || null)}>
          <option value="">随机{assignedEngine ? ` → ${assignedEngine.label}` : ''}</option>
          {engines.map((en) => (
            <option key={en.id} value={en.id}>{en.label}</option>
          ))}
        </select>
      </label>

      <div className="hat-body">
        <span className="hat-index">{String(index + 1).padStart(2, '0')}</span>
        {status === 'error' ? (
          <span className="hat-error">⚠ {result.error}</span>
        ) : status === 'speaking' ? (
          <SpeakingDots />
        ) : result?.text ? (
          <p className="hat-text">{result.text}</p>
        ) : (
          <p className="hat-placeholder">待发言</p>
        )}
      </div>
    </article>
  )
}

function Synthesis({ hat, hats, engines, assignedId, pinnedId, onPinChange, result, summaryText, onRefresh, canRefresh, onCopy, copiedId }) {
  const status = result?.status ?? 'idle'
  const assignedEngine = engines.find((e) => e.id === assignedId)
  const text = summaryText || result?.text || ''

  return (
    <section className="synthesis" style={{ '--hat-color': hat.color }}>
      <Spectrum hats={hats} className="spectrum--rule" />
      <div className="synthesis__head">
        <div className="synthesis__kicker">
          <span className="hat-dot" />
          <span className="synthesis__name">{hat.name}</span>
          <span className="synthesis__sub">主编综合 · 结论与下一步</span>
        </div>
        <div className="synthesis__tools">
          <label className="hat-pin hat-pin--inline">
            <span className="hat-pin__label">引擎</span>
            <select value={pinnedId ?? ''} onChange={(e) => onPinChange(hat.id, e.target.value || null)}>
              <option value="">随机{assignedEngine ? ` → ${assignedEngine.label}` : ''}</option>
              {engines.map((en) => (
                <option key={en.id} value={en.id}>{en.label}</option>
              ))}
            </select>
          </label>
          <button className="tool" onClick={() => onCopy(text, hat.id)} disabled={!text} title="复制蓝帽总结">
            {copiedId === hat.id ? <IconCheck /> : <IconCopy />}
          </button>
          <button className="tool" onClick={() => onRefresh(hat.id)} disabled={!canRefresh} title="重新生成总结">
            <IconRefresh />
          </button>
        </div>
      </div>
      <div className="synthesis__body">
        {status === 'error' ? (
          <span className="hat-error">⚠ {result.error}</span>
        ) : status === 'speaking' ? (
          <SpeakingDots />
        ) : text ? (
          <>
            <p className="synthesis__text">{text}</p>
            <p className="synthesis__sign">— 蓝帽 · 主编综合</p>
          </>
        ) : (
          <p className="synthesis__placeholder">其他帽子发言后，蓝帽在此综合共识与分歧，给出结论与下一步。</p>
        )}
      </div>
    </section>
  )
}

export default function App() {
  const [engines, setEngines] = useState([])
  const [summary, setSummary] = useState(null)
  const [hats, setHats] = useState([])
  const [pins, setPins] = useState({})
  const [assignment, setAssignment] = useState({})
  const [assignError, setAssignError] = useState('')
  const [topic, setTopic] = useState('')
  const [results, setResults] = useState({})
  const [summaryText, setSummaryText] = useState('')
  const [running, setRunning] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })

  function copyText(text, id) {
    if (!text || !navigator.clipboard) return
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 1500)
      })
      .catch(() => {})
  }

  function buildMarkdown() {
    const sections = []
    for (const h of hats) {
      if (h.id === 'blue') continue
      const r = results[h.id]
      if (r?.status !== 'done' || !r.text) continue
      const engineLabel = engines.find((e) => e.id === r.engineId)?.label || r.engineId || ''
      sections.push(`## ${h.emoji} ${h.name}（${engineLabel}）\n${r.text}`)
    }
    let doc = `# 六顶思考帽 · ${topic}\n\n${sections.join('\n\n')}`
    if (summaryText) {
      doc += `\n\n## 🔵 蓝帽总结\n${summaryText}`
    }
    return doc
  }

  useEffect(() => {
    fetch('/api/engines').then((r) => r.json()).then((d) => { setEngines(d.engines); setSummary(d.summary) })
    fetch('/api/hats').then((r) => r.json()).then(setHats)
  }, [])

  async function assign() {
    setAssignError('')
    try {
      const res = await fetch('/api/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pins }),
      })
      const d = await res.json()
      if (!res.ok) { setAssignError(d.error || '分配失败'); return }
      setAssignment(d.assignment)
    } catch (err) {
      setAssignError(err.message)
    }
  }

  async function run() {
    if (!topic.trim() || !Object.keys(assignment).length) return
    setRunning(true)
    setSummaryText('')
    // A manual pin overrides the last random assignment for that hat.
    const effective = Object.fromEntries(hats.map((h) => [h.id, pins[h.id] || assignment[h.id]]))
    setResults(Object.fromEntries(hats.map((h) => [h.id, { status: 'speaking', engineId: effective[h.id] }])))

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        if (h.id === 'blue') {
          next[h.id] = d.summary
            ? { status: 'done', text: d.summary }
            : { status: 'error', error: d.errors?.blue || '未知错误' }
        } else {
          const c = d.contributions?.find((x) => x.hatId === h.id)
          next[h.id] = c ? { status: 'done', text: c.text } : { status: 'error', error: d.errors?.[h.id] || '未知错误' }
        }
      }
      setResults(next)
      setSummaryText(d.summary || '')
    } catch (err) {
      setResults(Object.fromEntries(hats.map((h) => [h.id, { status: 'error', error: err.message }])))
    } finally {
      setRunning(false)
    }
  }

  async function refreshHat(hatId) {
    const hat = hats.find((h) => h.id === hatId)
    if (!hat) return
    const engineId = pins[hatId] || assignment[hatId]
    if (!engineId) return

    setResults((prev) => ({ ...prev, [hatId]: { status: 'speaking', engineId } }))

    const contributions = hat.id === 'blue'
      ? hats
          .filter((h) => h.id !== 'blue' && results[h.id]?.status === 'done' && results[h.id]?.text)
          .map((h) => ({ hatId: h.id, name: h.name, text: results[h.id].text }))
      : []

    try {
      const res = await fetch('/api/run-hat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, hatId, engineId, contributions }),
      })
      const d = await res.json()
      if (!res.ok) {
        setResults((prev) => ({ ...prev, [hatId]: { status: 'error', error: d.error || '刷新失败' } }))
        return
      }
      const next = d.text ? { status: 'done', text: d.text } : { status: 'error', error: d.error || '未知错误' }
      setResults((prev) => ({ ...prev, [hatId]: next }))
      if (hatId === 'blue' && d.text) setSummaryText(d.text)
    } catch (err) {
      setResults((prev) => ({ ...prev, [hatId]: { status: 'error', error: err.message } }))
    }
  }

  const inputHats = hats.filter((h) => h.id !== 'blue')
  const blueHat = hats.find((h) => h.id === 'blue')

  const canAssign = engines.length > 0
  const canRun = !running && topic.trim() && Object.keys(assignment).length > 0
  const canCopyAll = hats.some((h) => results[h.id]?.status === 'done' && results[h.id]?.text)

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead__top">
          <span className="masthead__eyebrow">协作审议系统 · Six Thinking Hats</span>
          <span className="masthead__date">{today}</span>
        </div>
        <div className="masthead__main">
          <div className="masthead__brand">
            <h1 className="masthead__title">Six&nbsp;Hats</h1>
            <p className="masthead__sub">六顶思考帽 · 平行思维审议</p>
            <Spectrum hats={hats} />
          </div>
          <EngineCredits summary={summary} />
        </div>
      </header>

      <section className="deck">
        <div className="deck__field">
          <label className="deck__eyebrow" htmlFor="topic">本期议题 · Topic</label>
          <input
            id="topic"
            className="topic-input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canRun) run() }}
            placeholder="输入你要审议的议题…"
          />
        </div>
        <div className="deck__actions">
          <button className="btn" onClick={assign} disabled={!canAssign} title={canAssign ? '' : '未检测到可用引擎'}>
            随机分配
          </button>
          <button className="btn btn--primary" onClick={run} disabled={!canRun}>
            {running ? '思考中…' : '开始审议'}
          </button>
          <button className="btn btn--ghost" onClick={() => copyText(buildMarkdown(), 'all')} disabled={!canCopyAll}>
            {copiedId === 'all' ? '已复制 ✓' : '复制全部'}
          </button>
        </div>
      </section>

      {assignError && <div className="assign-error">⚠ {assignError}</div>}

      <section className="columns">
        {inputHats.map((h, i) => (
          <HatCard
            key={h.id}
            hat={h}
            index={i}
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

      {blueHat && (
        <Synthesis
          hat={blueHat}
          hats={hats}
          engines={engines}
          assignedId={assignment.blue}
          pinnedId={pins.blue}
          onPinChange={(hatId, engineId) => setPins((p) => ({ ...p, [hatId]: engineId }))}
          result={results.blue}
          summaryText={summaryText}
          onRefresh={refreshHat}
          canRefresh={Boolean(topic.trim()) && Boolean(assignment.blue)}
          onCopy={copyText}
          copiedId={copiedId}
        />
      )}

      <footer className="app-footer">Local-first · 六顶思考帽 · De Bono Six Thinking Hats</footer>
    </div>
  )
}
