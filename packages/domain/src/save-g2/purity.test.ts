// The generation-2 save is pure (docs/game/architecture.md#the-rework-modules "Pure"; T134): no clock, no randomness, no
// I/O and no browser globals; it never writes into its inputs. Built beside today's game (M034): nothing in today's app
// or API imports it until T143 switches over.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { codeOnly } from '../__fixtures__/code-only'
import { deepFreeze } from '../__fixtures__/rework-tiers'
import { clock, DEV, opId, uma } from '../__fixtures__/save-g2'
import { commitOperation } from './commit'
import { initialSave } from './initial'
import { entityChanges, toSaveState } from './state'
import { stampEntity, stampLog } from './rows'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url))

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? (name === 'node_modules' ? [] : files(path)) : [path]
  })
}

describe('purity', () => {
  it('reads no clock, rolls no dice, does no I/O and touches no browser global', () => {
    const sources = readdirSync(HERE).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    expect(sources).toEqual(['commit.ts', 'env.ts', 'index.ts', 'initial.ts', 'inputs.ts', 'kinds.ts', 'parse.ts', 'rows.ts', 'state.ts', 'wire.ts'])
    for (const file of sources) {
      const code = codeOnly(readFileSync(join(HERE, file), 'utf8'))
      for (const banned of [/Date\.now/, /\bDate\b/, /Math\.random/, /from 'node:/, /\brequire\(/, /\bfetch\(/, /localStorage/, /indexedDB/,
        /\bwindow\./, /\bdocument\./, /\bnavigator\./, /\bcrypto\./, /\bprocess\./, /\bconsole\./, /TextEncoder/]) {
        expect(banned.test(code), `${file} uses ${banned}`).toBe(false)
      }
    }
  })

  it('never writes into its inputs, and repeats itself exactly', () => {
    const run = () => {
      const save = initialSave(clock('07:00'))
      const state = deepFreeze(save.state)
      const commit = commitOperation(state, deepFreeze({ id: opId(1), name: 'unlock-uma', input: { outfitId: uma(1) }, at: clock('07:01') }), DEV)
      if (commit.status !== 'applied') throw new Error(commit.status)
      const entities = deepFreeze([...save.entities, ...commit.entities].map((draft) => stampEntity(draft, 1, 0)))
      const logs = deepFreeze([...save.logs, ...commit.logs].map((draft) => stampLog(draft, 0)))
      return { commit, read: toSaveState(entities, logs), changes: entityChanges(state, deepFreeze(commit.state)) }
    }
    expect(run()).toEqual(run())
  })
})

describe('built beside today\'s game (M034)', () => {
  it('is imported by nothing in today\'s app or API, only by the generation-2 folders T135 and T136 build', () => {
    const today = [join(ROOT, 'apps', 'web', 'src'), join(ROOT, 'apps', 'api', 'src')].flatMap(files)
      .filter((path) => /\.(ts|tsx)$/.test(path))
      .filter((path) => !/[/\\](g2|save-g2)[/\\]/.test(path))
    expect(today.length).toBeGreaterThan(50)
    const importers = today.filter((path) => /save-g2/.test(readFileSync(path, 'utf8'))).map((path) => relative(ROOT, path))
    expect(importers).toEqual([])
  })
})
