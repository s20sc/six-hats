#!/usr/bin/env node
// bin/six-hats.js
import { parseArgs } from '../src/cli/args.js'
import { bootstrapPool, selectHats, listEnginesText } from '../src/cli/pool.js'
import { runCli } from '../src/cli/run.js'
import { formatMarkdown, formatJson } from '../src/cli/format.js'

const USAGE = `six-hats "<topic>" [options]

  --engine <id>       pin all hats to one engine (default: random, local-first)
  --hats <ids>        comma list: white,red,black,yellow,green,blue (default: all)
  --json              emit JSON instead of Markdown
  --quiet             suppress stderr progress
  --list-engines      print the detected engine pool and exit
  --timeout <secs>    global wall-clock cap (default 180)
  -h, --help          this help
`

async function main() {
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n\n${USAGE}`)
    process.exit(2)
  }
  if (opts.help) { process.stdout.write(USAGE); process.exit(0) }

  const { registry, hats: allHats } = await bootstrapPool()

  if (opts.listEngines) { process.stdout.write(listEnginesText(registry) + '\n'); process.exit(0) }

  if (registry.list().length === 0) {
    process.stderr.write('error: no engines detected. Install a local CLI/Ollama or add a cloud key.\n')
    process.exit(1)
  }

  const hats = selectHats(allHats, opts.hats)
  const engineLabel = (id) => registry.get(id)?.label || id
  const onProgress = opts.quiet ? undefined : (hatId, r) => {
    const hat = hats.find((h) => h.id === hatId)
    if (r.status === 'speaking') process.stderr.write(`▸ ${hat.name} → ${engineLabel(r.engineId)} …\n`)
    else if (r.status === 'done') process.stderr.write(`✓ ${hat.name}\n`)
    else if (r.status === 'error') process.stderr.write(`✗ ${hat.name}: ${r.error}\n`)
  }

  let out
  try {
    out = await runCli({ topic: opts.topic, hats, engine: opts.engine, timeoutMs: opts.timeoutMs, onProgress }, registry)
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`)
    process.exit(1)
  }

  if (opts.json) process.stdout.write(JSON.stringify(formatJson({ topic: opts.topic, hats, results: out.results }), null, 2) + '\n')
  else process.stdout.write(formatMarkdown({ topic: opts.topic, hats, results: out.results, engineLabel }))

  process.exit(out.anyDone ? 0 : 1)
}

main().catch((e) => { process.stderr.write(`fatal: ${e.stack || e}\n`); process.exit(1) })
