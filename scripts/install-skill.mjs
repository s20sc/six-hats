// scripts/install-skill.mjs
import fs from 'node:fs'
import os from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const src = join(root, 'skill')
const dest = join(os.homedir(), '.claude', 'skills', 'six-hats')

fs.mkdirSync(dirname(dest), { recursive: true })
try {
  const st = fs.lstatSync(dest)
  if (st.isSymbolicLink()) fs.rmSync(dest)
  else { console.error(`refusing to overwrite non-symlink at ${dest} — remove it manually first`); process.exit(1) }
} catch { /* dest does not exist — fine */ }
fs.symlinkSync(src, dest)
console.log(`linked ${dest} -> ${src}`)
