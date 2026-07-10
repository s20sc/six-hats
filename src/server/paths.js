import os from 'node:os'
import { join } from 'node:path'
export function stateFile() {
  return join(os.tmpdir(), 'six-hats-state.json')
}
