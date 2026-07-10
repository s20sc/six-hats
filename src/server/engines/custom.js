import { spawn } from 'node:child_process'
import { makeEngine } from './registry.js'
import { cleanOutput } from './cli.js'

export function makeCustomEngine({ name, cmd, parse = 'raw' }, deps = {}) {
  const spawnImpl = deps.spawnImpl ?? spawn
  return makeEngine({
    id: `custom:${name}`,
    type: 'custom',
    label: name,
    model: null,
    run: (prompt) => new Promise((resolve, reject) => {
      let out = '', err = '', done = false
      const child = spawnImpl('sh', ['-c', cmd], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, SIXHATS_PROMPT: prompt },
      })
      child.stdout.on('data', (d) => { out += d.toString() })
      child.stderr.on('data', (d) => { err += d.toString() })
      const timer = setTimeout(() => { if (!done) { done = true; try { child.kill() } catch {} reject(new Error(`custom ${name} timed out`)) } }, 120000)
      child.on('close', (code) => {
        if (done) return; done = true
        clearTimeout(timer)
        const text = cleanOutput(out, parse === 'raw' ? 'raw' : parse)
        text ? resolve(text) : reject(new Error(`custom ${name} empty (code ${code}): ${err.slice(0, 200)}`))
      })
      child.on('error', (e) => { if (!done) { done = true; clearTimeout(timer); reject(e) } })
    }),
  })
}
