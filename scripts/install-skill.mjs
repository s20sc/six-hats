// scripts/install-skill.mjs
import fs from 'node:fs'
import os from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const src = join(root, 'skill')
const dest = join(os.homedir(), '.claude', 'skills', 'six-hats')

fs.mkdirSync(dirname(dest), { recursive: true })
try { if (fs.lstatSync(dest)) fs.rmSync(dest, { recursive: true, force: true }) } catch {}
fs.symlinkSync(src, dest)
console.log(`linked ${dest} -> ${src}`)
