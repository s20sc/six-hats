import { useEffect, useState } from 'react'
import './App.css'

const SUMMARY_LABELS = { cli: 'CLI', ollama: 'Ollama', cloud: 'Cloud', custom: 'Custom' }
const STATUS_LABELS = { idle: '等待', speaking: '思考中', done: '已完成', error: '出错' }

function EnginePanel({ summary }) {
  if (!summary) return null
  const keys = ['cli', 'ollama', 'cloud', 'custom']
  const total = keys.reduce((n, k) => n + (summary[k]?.length || 0), 0)
  return (
    <section className="engines">
      <div className="engines__title">引擎检测 {total === 0 && <span className="engines__none">未检测到可用引擎</span>}</div>
      <div className="engines__badges">
        {keys.map((k) => (
          <span key={k} className={`badge ${summary[k]?.length ? 'badge--on' : 'badge--off'}`}>
            {SUMMARY_LABELS[k]}: {summary[k]?.length ? summary[k].join(', ') : '—'}
          </span>
        ))}
      </div>
    </section>
  )
}

function HatCard({ hat, engines, assignedId, pinnedId, onPinChange, result, onRefresh, canRefresh }) {
  const status = result?.status ?? 'idle'
  const assignedEngine = engines.find((e) => e.id === assignedId)

  return (
    <div className={`hat hat--${status}`} style={{ '--hat-color': hat.color }}>
      <div className="hat-head">
        <span className="hat-emoji">{hat.emoji}</span>
        <span className="hat-name">{hat.name}</span>
        <span className={`hat-status hat-status--${status}`}>{STATUS_LABELS[status]}</span>
        <button
          className="hat-refresh"
          onClick={() => onRefresh(hat.id)}
          disabled={!canRefresh}
          title="重新生成这一顶帽子"
        >
          🔄
        </button>
      </div>

      <label className="hat-pin">
        <span className="hat-pin__label">引擎</span>
        <select value={pinnedId ?? ''} onChange={(e) => onPinChange(hat.id, e.target.value || null)}>
          <option value="">
            随机{assignedEngine ? ` → ${assignedEngine.label}` : ''}
          </option>
          {engines.map((en) => (
            <option key={en.id} value={en.id}>{en.label}</option>
          ))}
        </select>
      </label>

      <div className="hat-body">
        {status === 'error' ? (
          <span className="hat-error">⚠ {result.error}</span>
        ) : (
          <p className="hat-text">{result?.text ?? ''}</p>
        )}
      </div>
    </div>
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
    setResults(Object.fromEntries(hats.map((h) => [h.id, { status: 'speaking', engineId: assignment[h.id] }])))

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, assignment }),
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

  const canAssign = engines.length > 0
  const canRun = !running && topic.trim() && Object.keys(assignment).length > 0

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎩 Six Hats</h1>
        <span className="app-tagline">六顶思考帽 · 便携版</span>
      </header>

      <EnginePanel summary={summary} />

      <section className="controls">
        <input
          className="topic-input"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="输入议题…"
        />
        <button className="btn" onClick={assign} disabled={!canAssign} title={canAssign ? '' : '未检测到可用引擎'}>
          随机分配
        </button>
        <button className="btn btn--primary" onClick={run} disabled={!canRun}>
          {running ? '思考中…' : '开始'}
        </button>
      </section>

      {assignError && <div className="assign-error">⚠ {assignError}</div>}

      <section className="hats">
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
          />
        ))}
      </section>

      {summaryText && (
        <section className="summary">
          <div className="summary__label">💙 蓝帽总结</div>
          <p className="summary__text">{summaryText}</p>
        </section>
      )}
    </div>
  )
}
