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
  const listEngines = values['list-engines']
  const topic = positionals[0]
  if (!listEngines && !topic) throw new Error('missing <topic>')

  let hats = HAT_IDS
  if (values.hats) {
    hats = values.hats.split(',').map((s) => s.trim()).filter(Boolean)
    const bad = hats.find((h) => !HAT_IDS.includes(h))
    if (bad) throw new Error(`unknown hat id: ${bad} (valid: ${HAT_IDS.join(',')})`)
    hats = HAT_IDS.filter((h) => hats.includes(h)) // canonical order, de-duped
  }

  const timeoutMs = values.timeout ? Math.max(1, Number(values.timeout)) * 1000 : 180000
  if (Number.isNaN(timeoutMs)) throw new Error('--timeout must be a number of seconds')

  return { help: false, listEngines, topic, engine: values.engine, hats, json: values.json, quiet: values.quiet, timeoutMs }
}
