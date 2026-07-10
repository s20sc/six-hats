import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Settings, Trash2, Zap, Bot, Loader2, CheckCircle2, XCircle,
  ChevronDown, X, Sparkles, RotateCcw, MessageSquare, Shuffle,
  Copy, Download, Check
} from 'lucide-react'

const HATS = [
  {
    id: 'white',
    emoji: '🤍',
    name: '白帽',
    label: '事实与数据',
    color: '#e8e8e8',
    bgColor: '#1a1a1a',
    defaultAgent: 'claude',
    prompt: '你是白帽思维（事实与数据）。你的职责是用客观事实和数据进行分析。只陈述可验证的信息，不带感情和猜测。如果数据不足，明确指出。控制在150字以内，简洁有力。'
  },
  {
    id: 'yellow',
    emoji: '💛',
    name: '黄帽',
    label: '价值与收益',
    color: '#ffd700',
    bgColor: '#1a1400',
    defaultAgent: 'gemini',
    prompt: '你是黄帽思维（价值与收益）。你的职责是找出话题的乐观可能性、潜在收益和价值亮点。用"这可以带来..."、"价值在于..."、"乐观来看..."的模式思考。控制在150字以内。'
  },
  {
    id: 'green',
    emoji: '💚',
    name: '绿帽',
    label: '创造力',
    color: '#3fb950',
    bgColor: '#0a1a0a',
    defaultAgent: 'pi',
    prompt: '你是绿帽思维（创造力）。你的职责是提出创新的想法、替代方案和突破性思考。不要重复别人的观点，提出全新的角度或解决方案。控制在150字以内。'
  },
  {
    id: 'black',
    emoji: '🖤',
    name: '黑帽',
    label: '谨慎与风险',
    color: '#8b949e',
    bgColor: '#0a0a0a',
    defaultAgent: 'kimi',
    prompt: '你是黑帽思维（谨慎与风险）。你的职责是指出潜在的问题、风险和可能出错的环节。用批判性眼光审视，不要否定，但要指出需要小心的地方。控制在150字以内。'
  },
  {
    id: 'red',
    emoji: '❤️',
    name: '红帽',
    label: '直觉与感受',
    color: '#ff4d4d',
    bgColor: '#1a0000',
    defaultAgent: 'codex',
    prompt: '你是红帽思维（直觉与感受）。你的职责是表达对这个话题的直觉感受和情绪。不要理性分析，直接说出喜欢、担忧、兴奋或困惑。控制在120字以内，语言感性直接。'
  },
  {
    id: 'blue',
    emoji: '💙',
    name: '蓝帽',
    label: '总结与推进',
    color: '#58a6ff',
    bgColor: '#000a1a',
    defaultAgent: 'openclaw',
    prompt: '你是蓝帽思维（总结与推进）。你的职责是总结其他帽子的观点，指出共识和分歧，给出下一步建议。保持中立和建设性。控制在120字以内。'
  }
]

const ACPX_AGENTS = [
  { id: 'claude',  name: 'Claude Code', color: '#7c3aed' },
  { id: 'codex',   name: 'Codex',       color: '#059669' },
]

const AGENT_MODEL_LABELS = {
  gemini: 'gemini',
  codex: 'gpt5.4',
  claude: 'opus4.6',
}

const DEFAULT_AGENTS = {
  white: 'main',
  yellow: 'strategy',
  green: 'marketing',
  black: 'legal',
  red: 'pm',
  blue: 'product'
}

// ── Agent Select ─────────────────────────────────────────────────
function AgentSelect({ value, agents, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selected = agents.find(a => a.id === value) || agents[0]

  return (
    <div className="agent-select-wrap" ref={ref}>
      <button className="agent-select-btn" onClick={() => setOpen(o => !o)}>
        <Bot size={11} />
        <span>{selected?.name || value}</span>
        <ChevronDown size={11} className={open ? 'rotated' : ''} />
      </button>
      {open && (
        <div className="agent-dropdown">
          {agents.map(agent => (
            <button
              key={agent.id}
              className={`agent-option ${agent.id === value ? 'active' : ''}`}
              onClick={() => { onChange(agent.id); setOpen(false) }}
            >
              <span className="agent-dot" style={{ background: agent.color }} />
              {agent.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Hat Card ─────────────────────────────────────────────────────
function HatCard({ hat, agentId, state, agents, onAgentChange, onSpeak, disabled }) {
  const status = state?.status || 'idle'
  const text = state?.text || ''
  const error = state?.error || ''

  const statusMeta = {
    idle:    { label: '等待发言', icon: <Bot size={12} />, cls: '' },
    speaking:{ label: '思考中',   icon: <Loader2 size={12} className="spin" />, cls: 'speaking' },
    done:    { label: '已发言',   icon: <CheckCircle2 size={12} />, cls: 'done' },
    error:   { label: '出错',     icon: <XCircle size={12} />, cls: 'error' }
  }[status]

  return (
    <div
      className={`hat-card hat-card--${hat.id} ${status === 'speaking' ? 'is-speaking' : ''} ${status === 'done' ? 'is-done' : ''} ${status === 'error' ? 'is-error' : ''}`}
      style={{ '--hat-color': hat.color }}
    >
      <div className="hat-card__header">
        <div className="hat-card__identity">
          <span className="hat-card__emoji">{hat.emoji}</span>
          <div>
            <div className="hat-card__name">{hat.name}</div>
            <div className="hat-card__label">{hat.label}</div>
          </div>
        </div>
        <AgentSelect
          value={agentId}
          agents={agents}
          onChange={onAgentChange}
        />
      </div>

      <div className="hat-card__body">
        {status === 'idle' && (
          <p className="hat-card__placeholder">等待发言...</p>
        )}
        {status === 'speaking' && (
          <p className="hat-card__speaking">
            <Loader2 size={14} className="spin" />
            正在思考
          </p>
        )}
        {status === 'done' && text && (
          <p className="hat-card__text">{text}</p>
        )}
        {status === 'error' && (
          <p className="hat-card__error">{error}</p>
        )}
      </div>

      <button
        className="hat-card__btn"
        onClick={onSpeak}
        disabled={disabled || status === 'speaking'}
        style={{ '--hat-color': hat.color }}
      >
        {status === 'speaking'
          ? <><Loader2 size={13} className="spin" /> 思考中</>
          : status === 'done'
            ? <><Sparkles size={13} /> 再次发言</>
            : <><Zap size={13} /> 发言</>}
      </button>
    </div>
  )
}

// ── Timeline ──────────────────────────────────────────────────────
function getModelLabel(agentId, models) {
  if (AGENT_MODEL_LABELS[agentId]) return AGENT_MODEL_LABELS[agentId]
  const raw = models[agentId]
  if (!raw || raw === '—') return agentId
  return raw.split('/').pop()
}

function getRound(entries, index) {
  let round = 1
  const seen = new Set()
  for (let i = 0; i < index; i++) {
    const id = entries[i].hatId
    if (seen.has(id)) {
      round++
      seen.clear()
    }
    seen.add(id)
  }
  return round
}

function Timeline({ entries, onClear, copied, onCopy, onDownload, topic, models }) {
  // Auto-scroll disabled — user controls their own scroll position

  if (!entries?.length) return null

  return (
    <div className="timeline">
      {topic && <div className="timeline__topic"># {topic}</div>}
      <div className="timeline__header">
        <div className="timeline__title">
          <MessageSquare size={14} />
          发言记录
          <span className="timeline__count">{entries.length}</span>
        </div>
        {entries.length > 0 && (
          <div className="timeline__actions">
            <button className="tl-action-btn" onClick={onCopy} title="复制 Markdown">
              {copied ? <><Check size={12} /> 已复制</> : <><Copy size={12} /> 复制</>}
            </button>
            <button className="tl-action-btn tl-action-btn--primary" onClick={onDownload} title="导出 .md">
              <Download size={12} /> 导出
            </button>
            <button className="tl-action-btn" onClick={onClear} title="清空记录">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
      <div className="timeline__list">
        {entries.map((e, i) => {
          const hat = HATS.find(h => h.id === e.hatId)
          const round = getRound(entries, i)
          const prevRound = i > 0 ? getRound(entries, i - 1) : 0
          return (
            <div key={i}>
              {round !== prevRound && (
                <div className="tl-round-divider">第 {round} 轮</div>
              )}
              <div className="tl-entry" style={{ '--tl-color': hat?.color || '#6e7681' }}>
                <div className="tl-entry__meta">
                  <span className="tl-entry__emoji">{hat?.emoji}</span>
                  <span className="tl-entry__hat">{hat?.name}</span>
                  <span className="tl-entry__agent">@{e.agentId}</span>
                  <span className="tl-entry__model">{getModelLabel(e.agentId, models)}</span>
                  <span className="tl-entry__time">
                    {new Date(e.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="tl-entry__text">{e.text}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Settings Panel ───────────────────────────────────────────────
// ── Status Bar ───────────────────────────────────────────────────
function StatusBar({ hatAgents, agents, models }) {
  const usedIds = new Set(Object.values(hatAgents))

  return (
    <div className="status-bar">
      {HATS.map(hat => {
        const agent = agents.find(a => a.id === hatAgents[hat.id])
        const model = (models[hatAgents[hat.id]] || '—').split('/').pop()
        return (
          <div key={hat.id} className="status-bar__item status-bar__item--assigned" style={{ '--hat-color': hat.color }}>
            <span className="status-bar__emoji">{hat.emoji}</span>
            <span className="status-bar__agent">{agent?.name || hatAgents[hat.id]}</span>
            <span className="status-bar__model">{model}</span>
          </div>
        )
      })}
      {agents.filter(a => !usedIds.has(a.id)).map(agent => (
        <div key={agent.id} className="status-bar__item status-bar__item--idle" style={{ '--agent-color': agent.color }}>
          <span className="status-bar__dot" />
          <span className="status-bar__agent">{agent.name}</span>
          <span className="status-bar__model status-bar__model--idle">空闲</span>
        </div>
      ))}
    </div>
  )
}

// ── Settings Panel ───────────────────────────────────────────────
function SettingsPanel({ agents, hatAgents, onClose, onReset }) {
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>
        <div className="settings-panel__header">
          <h2>设置</h2>
          <button className="settings-panel__close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="settings-panel__body">
          <h3 className="settings-section-title">帽子 → Agent 分配</h3>
          <div className="settings-list">
            {HATS.map(hat => (
              <div key={hat.id} className="settings-row">
                <div className="settings-row__hat">
                  <span>{hat.emoji}</span>
                  <span>{hat.name}</span>
                </div>
                <div className="settings-row__agent">
                  {agents.find(a => a.id === hatAgents[hat.id])?.name || hatAgents[hat.id]}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="settings-panel__footer">
          <button className="btn-reset" onClick={onReset}>
            <RotateCcw size={14} />
            恢复默认分配
          </button>
        </div>
      </div>
    </div>
  )
}

// ── App ─────────────────────────────────────────────────────────
export default function App() {
  const [agents, setAgents] = useState([])
  const [topic, setTopic] = useState('')
  const [started, setStarted] = useState(false)
  const [hatAgents, setHatAgents] = useState(DEFAULT_AGENTS)
  const [agentStates, setAgentStates] = useState({})
  const [timeline, setTimeline] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [copied, setCopied] = useState(false)
  const [models, setModels] = useState({})
  const [includeAcpx, setIncludeAcpx] = useState(false)
  const pollRef = useRef(null)

  // Load available agents
  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(data => { setAgents(data); setLoadingAgents(false) })
      .catch(() => setLoadingAgents(false))
    fetch('/api/agent-models')
      .then(r => r.json())
      .then(data => setModels(data))
      .catch(() => {})
  }, [])

  const allAgents = includeAcpx ? [...agents, ...ACPX_AGENTS] : agents

  // Poll state
  const sync = useCallback(async () => {
    try {
      const r = await fetch('/api/state')
      if (!r.ok) return
      const d = await r.json()
      setAgentStates(d.agents || {})
      setTimeline(d.timeline || [])
      if (d.topic) setTopic(d.topic)
    } catch {}
  }, [])

  useEffect(() => {
    sync()
    pollRef.current = setInterval(sync, 2000)
    return () => clearInterval(pollRef.current)
  }, [sync])

  // Speak all — blue hat goes last with summary of others
  const speakAll = async () => {
    if (!topic.trim()) return
    setStarted(true)

    setAgentStates(
      Object.fromEntries(HATS.map(h => [h.id, { status: 'speaking', text: '', error: '' }]))
    )

    const otherHats = HATS.filter(h => h.id !== 'blue')
    const blueHat = HATS.find(h => h.id === 'blue')
    const otherResults = {}

    // Phase 1: all non-blue hats in parallel
    await Promise.allSettled(
      otherHats.map(hat =>
        fetch('/api/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hatId: hat.id,
            agentId: hatAgents[hat.id],
            topic,
            hatPrompt: hat.prompt,
            hatName: hat.name
          })
        }).then(r => r.json())
          .then(d => {
            if (d.ok) {
              otherResults[hat.id] = d.text
              setAgentStates(s => ({ ...s, [hat.id]: { status: 'done', text: d.text, error: '' } }))
            } else {
              setAgentStates(s => ({ ...s, [hat.id]: { status: 'error', text: '', error: d.error || '失败' } }))
            }
          })
          .catch(err => {
            setAgentStates(s => ({ ...s, [hat.id]: { status: 'error', text: '', error: err.message } }))
          })
      )
    )

    // Phase 2: blue hat with context from others
    const summary = otherHats
      .filter(h => otherResults[h.id])
      .map(h => `${h.emoji} ${h.name}：${otherResults[h.id]}`)
      .join('\n\n')
    const bluePrompt = `${blueHat.prompt}\n\n话题：${topic}\n\n以下是其他帽子的发言：\n\n${summary}\n\n请根据以上发言进行总结，指出共识和分歧，给出下一步建议。`

    try {
      const r = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hatId: blueHat.id,
          agentId: hatAgents[blueHat.id],
          topic,
          hatPrompt: bluePrompt,
          hatName: blueHat.name
        })
      })
      const d = await r.json()
      if (d.ok) {
        setAgentStates(s => ({ ...s, blue: { status: 'done', text: d.text, error: '' } }))
      } else {
        setAgentStates(s => ({ ...s, blue: { status: 'error', text: '', error: d.error || '失败' } }))
      }
    } catch (err) {
      setAgentStates(s => ({ ...s, blue: { status: 'error', text: '', error: err.message } }))
    }
  }

  // Speak single
  const speakOne = async (hatId) => {
    if (!topic.trim()) return
    setStarted(true)
    const hat = HATS.find(h => h.id === hatId)
    setAgentStates(s => ({ ...s, [hatId]: { status: 'speaking', text: '', error: '' } }))

    try {
      const r = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hatId: hat.id,
          agentId: hatAgents[hat.id],
          topic,
          hatPrompt: hat.prompt,
          hatName: hat.name
        })
      })
      const d = await r.json()
      if (d.ok) {
        setAgentStates(s => ({ ...s, [hatId]: { status: 'done', text: d.text, error: '' } }))
      } else {
        setAgentStates(s => ({ ...s, [hatId]: { status: 'error', text: '', error: d.error || '失败' } }))
      }
    } catch (err) {
      setAgentStates(s => ({ ...s, [hatId]: { status: 'error', text: '', error: err.message } }))
    }
  }

  const handleAgentChange = (hatId, agentId) => {
    setHatAgents(prev => ({ ...prev, [hatId]: agentId }))
  }

  const clearTimeline = async () => {
    await fetch('/api/clear', { method: 'POST' }).catch(() => {})
    setAgentStates({})
    setTimeline([])
  }

  const resetAll = async () => {
    await fetch('/api/reset', { method: 'POST' }).catch(() => {})
    setTopic('')
    setStarted(false)
    setAgentStates({})
    setTimeline([])
    setHatAgents(DEFAULT_AGENTS)
  }

  const shuffleAgents = () => {
    const pool = includeAcpx ? [...agents, ...ACPX_AGENTS] : agents
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    setHatAgents(
      Object.fromEntries(HATS.map((h, i) => [h.id, shuffled[i % shuffled.length].id]))
    )
  }

  const buildMarkdown = () => {
    if (!timeline.length) return ''
    const topicText = topic ? `# ${topic}\n\n` : ''
    const entries = timeline.map(e => {
      const hat = HATS.find(h => h.id === e.hatId)
      const agent = allAgents.find(a => a.id === e.agentId)
      const model = getModelLabel(e.agentId, models)
      return `## ${hat?.emoji || ''} ${hat?.name || e.hatId} · @${agent?.name || e.agentId} (${model})\n\n${e.text}\n`
    }).join('\n---\n\n')
    return `${topicText}${entries}`
  }

  // 从服务端拿最新话题 + 发言，构建 Markdown
  const buildMarkdownWithTopic = async () => {
    let serverTopic = topic
    let serverTimeline = timeline
    try {
      const r = await fetch('/api/state')
      if (r.ok) {
        const d = await r.json()
        serverTopic = d.topic || topic
        serverTimeline = d.timeline || timeline
      }
    } catch {}
    if (!serverTimeline.length) return ''
    const topicLine = serverTopic ? `# ${serverTopic}\n\n` : ''
    const entries = serverTimeline.map(e => {
      const hat = HATS.find(h => h.id === e.hatId)
      const agent = allAgents.find(a => a.id === e.agentId)
      const model = getModelLabel(e.agentId, models)
      return `## ${hat?.emoji || ''} ${hat?.name || e.hatId} · @${agent?.name || e.agentId} (${model})\n\n${e.text}\n`
    }).join('\n---\n\n')
    return `${topicLine}${entries}`
  }

  const copyMarkdown = async () => {
    try {
      const md = await buildMarkdownWithTopic()
      if (!md) return
      await navigator.clipboard.writeText(md)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  const downloadMarkdown = () => {
    buildMarkdownWithTopic().then(md => {
      if (!md) return
      const filename = topic ? `${topic.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')}.md` : 'six-hats-export.md'
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  return (
    <div className="app">
      {/* Status Bar */}
      <StatusBar hatAgents={hatAgents} agents={allAgents} models={models} />

      {/* Header */}
      <header className="app-header">
        <div className="app-header__left">
          <h1 className="app-logo">🎩 Six Hats <span>V2</span></h1>
          <span className="app-tagline">Multi-Agent 协作审议</span>
        </div>
        <div className="app-header__right">
          <label className="acpx-toggle">
            <input
              type="checkbox"
              checked={includeAcpx}
              onChange={e => setIncludeAcpx(e.target.checked)}
            />
            <span>🤖 外部 Agent</span>
          </label>
          <button className="btn-icon" onClick={shuffleAgents} title="随机分配Agent">
            <Shuffle size={18} />
          </button>
          <button className="btn-icon" onClick={() => setShowSettings(true)} title="设置">
            <Settings size={18} />
          </button>
          <button className="btn-icon btn-reset-top" onClick={resetAll} title="新话题">
            <RotateCcw size={16} />
          </button>
        </div>
      </header>

      {/* Topic */}
      <div className="topic-section">
        <div className="topic-input-wrap">
          <input
            className="topic-input"
            placeholder="输入讨论话题，按回车开始审议..."
            value={topic}
            onChange={e => setTopic(e.target.value)}
            disabled={started}
            onKeyDown={e => {
              if (e.key === 'Enter' && !started && topic.trim()) speakAll()
            }}
          />
          {!started && topic.trim() && (
            <button className="btn-start" onClick={speakAll}>
              <Zap size={15} />
              开始审议
            </button>
          )}
          {started && (
            <button className="btn-start" onClick={speakAll}>
              <RotateCcw size={15} />
              再次审议
            </button>
          )}
        </div>
      </div>

      {/* Hat Cards */}
      <div className="hats-grid">
        {HATS.map(hat => (
          <HatCard
            key={hat.id}
            hat={hat}
            agentId={hatAgents[hat.id]}
            state={agentStates[hat.id]}
            agents={allAgents}
            onAgentChange={agentId => handleAgentChange(hat.id, agentId)}
            onSpeak={() => speakOne(hat.id)}
            disabled={!topic.trim()}
          />
        ))}
      </div>

      {/* Timeline */}
      <Timeline entries={timeline} onClear={clearTimeline} copied={copied} onCopy={copyMarkdown} onDownload={downloadMarkdown} topic={topic} models={models} />

      {/* Footer */}
      <footer className="app-footer">
        Powered by OpenClaw · acpx agents · Six Thinking Hats
      </footer>

      {/* Settings */}
      {showSettings && (
        <SettingsPanel
          agents={allAgents}
          hatAgents={hatAgents}
          onClose={() => setShowSettings(false)}
          onReset={() => setHatAgents(DEFAULT_AGENTS)}
        />
      )}
    </div>
  )
}
