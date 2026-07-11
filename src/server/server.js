import 'dotenv/config'
import express from 'express'
import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { loadConfig } from './config.js'
import { stateFile } from './paths.js'
import { detectEngines, summarize } from './engines/detect.js'
import { HATS, applySkin, applyPromptOverrides } from './hats.js'
import { assignEngines } from './assign.js'
import { runDeliberation, runSingleHat } from './orchestrate.js'
import { listMasked, saveCloudProvider, deleteCloudProvider } from './cloud-store.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function createApp({ registry, cfg, detect, invalidate } = {}) {
  const app = express()
  app.use(express.json())
  const hats = applyPromptOverrides(applySkin(HATS, cfg.skins), cfg.hatPromptOverrides)
  // Mutable so a live re-detect (below) can pick up engines installed after startup.
  let reg = registry

  app.get('/api/engines', async (req, res) => {
    let stale = false
    if (detect) {
      try { reg = await detect() }
      catch (e) { stale = true; console.warn(`[engines] live re-detect failed, serving cached list: ${e.message}`) }
    }
    res.json({ engines: reg.list().map((e) => ({ id: e.id, type: e.type, label: e.label })), summary: summarize(reg), stale })
  })
  app.get('/api/hats', (req, res) => res.json(hats.map(({ id, color, emoji, name }) => ({ id, color, emoji, name }))))
  app.post('/api/assign', (req, res) => {
    try { res.json({ assignment: assignEngines(hats, reg.localFirst(), { pins: req.body?.pins ?? {} }) }) }
    catch (e) { res.status(400).json({ error: e.message }) }
  })
  app.post('/api/run', async (req, res) => {
    try {
      const { topic, assignment } = req.body ?? {}
      if (!topic || !assignment || Object.keys(assignment).length === 0) return res.status(400).json({ error: 'missing topic/assignment' })
      const missingHat = hats.find((h) => !assignment[h.id])
      if (missingHat) return res.status(400).json({ error: `assignment missing hat: ${missingHat.id}` })
      const badEngine = Object.values(assignment).find((id) => !reg.get(id))
      if (badEngine) return res.status(400).json({ error: `unknown engine: ${badEngine}` })
      const result = await runDeliberation({ topic, hats, registry: reg, assignment })
      try { fs.writeFileSync(stateFile(), JSON.stringify({ topic, ...result }, null, 2)) } catch {}
      res.json(result)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })
  app.post('/api/run-hat', async (req, res) => {
    try {
      const { topic, hatId, engineId, contributions = [] } = req.body ?? {}
      if (!topic || !hatId || !engineId) return res.status(400).json({ error: 'missing topic/hatId/engineId' })
      const hat = hats.find((h) => h.id === hatId)
      if (!hat) return res.status(400).json({ error: `unknown hat: ${hatId}` })
      const engine = reg.get(engineId)
      if (!engine) return res.status(400).json({ error: `unknown engine: ${engineId}` })
      try {
        const text = await runSingleHat({ topic, hat, engine, contributions })
        res.json({ hatId, text })
      } catch (e) {
        res.json({ hatId, error: e.message })
      }
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })
  app.get('/api/state', (req, res) => {
    try { res.json(JSON.parse(fs.readFileSync(stateFile(), 'utf8'))) } catch { res.json({ topic: '', contributions: [], summary: '' }) }
  })
  app.post('/api/reset', (req, res) => { try { fs.unlinkSync(stateFile()) } catch {} res.json({ ok: true }) })

  // ── User-added cloud engines (enter an API key, no CLI needed) ──────
  // After a change, rebuild the live registry now so /api/run etc. can't keep invoking a
  // just-deleted engine (and its closed-over key) until someone happens to hit /api/engines.
  async function refreshRegistry() {
    invalidate?.()
    if (detect) { try { reg = await detect() } catch {} }
  }
  app.get('/api/cloud', (req, res) => res.json({ providers: listMasked() }))
  app.post('/api/cloud', async (req, res) => {
    try {
      saveCloudProvider(req.body ?? {})
      await refreshRegistry()
      res.json({ ok: true, providers: listMasked() })
    } catch (e) { res.status(400).json({ error: e.message }) }
  })
  app.delete('/api/cloud/:id', async (req, res) => {
    try {
      deleteCloudProvider(req.params.id)
      await refreshRegistry()
      res.json({ ok: true, providers: listMasked() })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.use(express.static(join(__dirname, '..', '..', 'dist')))
  return app
}

export async function start() {
  const cfg = loadConfig()
  // Throttle request-path re-detection: spawning `openclaw agents list` (etc.) on
  // every /api/engines hit is wasteful, so reuse a recent result within a short window.
  let cached = null
  let cachedAt = 0
  const detect = async () => {
    if (cached && Date.now() - cachedAt < 3000) return cached
    cached = await detectEngines(cfg)
    cachedAt = Date.now()
    return cached
  }
  const invalidate = () => { cachedAt = 0 }
  const registry = await detect()
  const app = createApp({ registry, cfg, detect, invalidate })
  const host = process.env.HOST || '127.0.0.1'
  return await new Promise((resolve, reject) => {
    const server = app.listen(cfg.port, host, () => {
      const port = server.address().port
      console.log(`Six Hats running on http://${host}:${port}`)
      resolve({ server, host, port })
    })
    server.on('error', reject) // surface EADDRINUSE / bad host instead of hanging
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start()
