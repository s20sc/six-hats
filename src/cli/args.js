import { parseArgs as nodeParseArgs } from 'node:util'

export const HAT_IDS = ['white', 'red', 'black', 'yellow', 'green', 'blue']

export function parseArgs(argv) {
  const { values, positionals } = nodeParseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      engine: { type: 'string' },
      hats: { type: 'string' },
      json: { type: 'boolean', default: false },
      quiet: { type: 'boolean', default: false },
      'list-engines': { type: 'boolean', default: false },
      timeout: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })
  if (values.help) return { help: true }
  if (positionals.length > 1) throw new Error('too many arguments — quote the topic')
  const listEngines = values['list-engines']
  const topic = positionals[0]
  if (!listEngines && !topic) throw new Error('missing <topic>')

  let hats = HAT_IDS
  if (values.hats !== undefined) {
    hats = values.hats.split(',').map((s) => s.trim()).filter(Boolean)
    const bad = hats.find((h) => !HAT_IDS.includes(h))
    if (bad) throw new Error(`unknown hat id: ${bad} (valid: ${HAT_IDS.join(',')})`)
    hats = HAT_IDS.filter((h) => hats.includes(h)) // canonical order, de-duped
    if (hats.length === 0) throw new Error('--hats matched no valid hats')
    if (hats.length === 1 && hats[0] === 'blue') {
      throw new Error('the blue hat only synthesizes the others — include at least one non-blue hat')
    }
  }

  let timeoutMs = 180000
  if (values.timeout) {
    const secs = Number(values.timeout)
    if (!Number.isFinite(secs) || secs <= 0) throw new Error('--timeout must be a positive number of seconds')
    timeoutMs = secs * 1000
  }

  return { help: false, listEngines, topic, engine: values.engine, hats, json: values.json, quiet: values.quiet, timeoutMs }
}
