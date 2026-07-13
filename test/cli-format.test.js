// test/cli-format.test.js
import { describe, it, expect } from 'vitest'
import { formatMarkdown, formatJson } from '../src/cli/format.js'
import { HATS } from '../src/server/hats.js'

const label = (id) => ({ claude: 'claude', q: 'ollama (qwen)' }[id] || id)

describe('formatMarkdown', () => {
  it('renders topic, per-hat sections with engine label, and blue summary', () => {
    const results = {
      white: { status: 'done', text: '事实A', engineId: 'claude' },
      blue: { status: 'done', text: '结论X', engineId: 'q' },
    }
    const md = formatMarkdown({ topic: 'T', hats: HATS.filter((h) => ['white', 'blue'].includes(h.id)), results, engineLabel: label })
    expect(md).toContain('# 六顶思考帽 · T')
    expect(md).toContain('## ⚪ 白帽（claude）')
    expect(md).toContain('事实A')
    expect(md).toContain('## 🔵 蓝帽总结')
    expect(md).toContain('结论X')
  })
  it('renders a failed hat inline and omits blue when absent', () => {
    const results = { red: { status: 'error', error: 'boom', engineId: 'claude' } }
    const md = formatMarkdown({ topic: 'T', hats: HATS.filter((h) => h.id === 'red'), results, engineLabel: label })
    expect(md).toMatch(/失败|failed/i)
    expect(md).not.toContain('蓝帽总结')
  })
})

describe('formatJson', () => {
  it('shapes contributions, summary, errors', () => {
    const results = {
      white: { status: 'done', text: 'f', engineId: 'claude' },
      red: { status: 'error', error: 'boom', engineId: 'claude' },
      blue: { status: 'done', text: 's', engineId: 'q' },
    }
    const j = formatJson({ topic: 'T', hats: HATS, results })
    expect(j.topic).toBe('T')
    expect(j.contributions).toEqual([{ hatId: 'white', name: '白帽', engineId: 'claude', text: 'f' }])
    expect(j.summary).toBe('s')
    expect(j.errors).toEqual({ red: 'boom' })
  })
})
