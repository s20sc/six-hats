import { describe, it, expect } from 'vitest'
import { parseArgs } from '../src/cli/args.js'
import { runCli } from '../src/cli/run.js'
import { formatMarkdown } from '../src/cli/format.js'
import { selectHats } from '../src/cli/pool.js'
import { HATS } from '../src/server/hats.js'

// End-to-end of the pure pieces the entry composes (no process/spawn).
describe('cli composition', () => {
  it('parse → select → run → format produces markdown', async () => {
    const o = parseArgs(['要不要囤货', '--engine', 'e', '--hats', 'white,blue'])
    const hats = selectHats(HATS, o.hats)
    const reg = (() => {
      const es = [{ id: 'e', type: 'cli', label: 'e', run: async (p) => (p.includes('其他帽子的发言') ? 'S' : 'A') }]
      return { get: (id) => es.find((x) => x.id === id), list: () => es, localFirst: () => es }
    })()
    const { results, anyDone } = await runCli({ topic: o.topic, hats, engine: o.engine, timeoutMs: o.timeoutMs }, reg)
    expect(anyDone).toBe(true)
    const md = formatMarkdown({ topic: o.topic, hats, results, engineLabel: (id) => id })
    expect(md).toContain('# 六顶思考帽 · 要不要囤货')
    expect(md).toContain('## ⚪ 白帽（e）')
    expect(md).toContain('## 🔵 蓝帽总结')
  })
})
