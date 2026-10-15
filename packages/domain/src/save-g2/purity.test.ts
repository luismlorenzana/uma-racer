// The generation-2 save is pure (docs/game/architecture.md#the-rework-modules "Pure"; T134): no clock, no randomness, no
// I/O and no browser globals; it never writes into its inputs.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
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

describe('purity', () => {
  it('reads no clock, rolls no dice, does no I/O and touches no browser global', () => {
    const sources = readdirSync(HERE).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    expect(sources.length).toBeGreaterThanOrEqual(10)
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
