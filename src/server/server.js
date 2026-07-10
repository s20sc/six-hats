import 'dotenv/config'
import express from 'express'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadConfig } from './config.js'
import { stateFile } from './paths.js'
import { detectEngines, summarize } from './engines/detect.js'
import { HATS, applySkin } from './hats.js'
import { assignEngines } from './assign.js'
import { runDeliberation } from './orchestrate.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function createApp({ registry, cfg }) {
  const app = express()
  app.use(express.json())
  const hats = applySkin(HATS, cfg.skins)

  app.get('/api/engines', (req, res) => {
    res.json({ engines: registry.list().map((e) => ({ id: e.id, type: e.type, label: e.label })), summary: summarize(registry) })
  })
  app.get('/api/hats', (req, res) => res.json(hats.map(({ id, color, emoji, name }) => ({ id, color, emoji, name }))))
  app.post('/api/assign', (req, res) => {
    try { res.json({ assignment: assignEngines(hats, registry.localFirst(), { pins: req.body?.pins ?? {} }) }) }
    catch (e) { res.status(400).json({ error: e.message }) }
  })
  app.post('/api/run', async (req, res) => {
    const { topic, assignment } = req.body ?? {}
    if (!topic || !assignment || Object.keys(assignment || {}).length === 0) return res.status(400).json({ error: 'missing topic/assignment' })
    const result = await runDeliberation({ topic, hats, registry, assignment })
    try { fs.writeFileSync(stateFile(), JSON.stringify({ topic, ...result }, null, 2)) } catch {}
    res.json(result)
  })
  app.get('/api/state', (req, res) => {
    try { res.json(JSON.parse(fs.readFileSync(stateFile(), 'utf8'))) } catch { res.json({ topic: '', contributions: [], summary: '' }) }
  })
  app.post('/api/reset', (req, res) => { try { fs.unlinkSync(stateFile()) } catch {} res.json({ ok: true }) })

  app.use(express.static(join(__dirname, '..', '..', 'dist')))
  return app
}

export async function start() {
  const cfg = loadConfig()
  const registry = await detectEngines(cfg)
  const app = createApp({ registry, cfg })
  app.listen(cfg.port, () => console.log(`Six Hats running on http://localhost:${cfg.port}`))
}

if (import.meta.url === `file://${process.argv[1]}`) start()
