// The Training Hub's rules are pure (docs/game/architecture.md#the-rework-modules "Pure"): no clock, no randomness, no I/O; they never
// write into their inputs and repeat themselves exactly. Their refusals are one table of plain words
// (docs/game/02-check-ins-and-notifications.md §9), and the entry exports the whole area.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { codeOnly } from '../__fixtures__/code-only'
import { CONTENT, COLT, deepFreeze, placeUma } from '../__fixtures__/tiers'
import { ENV, MOM, TRAINING_CONTENT, slotAt, workAccount } from '../__fixtures__/training'
import { collect, start } from '../work/adapter'
import type { WorkState } from '../work/types'
import { isRefusal, type OpResult, type ReworkState } from '../state/types'
import * as training from './index'

const HERE = fileURLToPath(new URL('.', import.meta.url))

describe('purity', () => {
  it('reads no clock, rolls no dice and does no I/O', () => {
    const sources = readdirSync(HERE).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    expect(sources.length).toBeGreaterThan(10)
    for (const file of sources) {
      const code = codeOnly(readFileSync(join(HERE, file), 'utf8'))
      for (const banned of [/Date\.now/, /new Date\b/, /Math\.random/, /from 'node:/, /\brequire\(/, /\bfetch\(/, /localStorage/, /indexedDB/, /\bprocess\./, /\bconsole\./, /\bwindow\./]) {
        expect(banned.test(code), `${file} uses ${banned}`).toBe(false)
      }
    }
  })

  it('never writes into deep-frozen inputs, and repeats itself exactly', () => {
    const run = () => {
      const receipts: unknown[] = []
      const step = <R, S extends ReworkState>(result: OpResult<R, S>): S => {
        if (isRefusal(result)) throw new Error(result.reason)
        receipts.push(result.receipt)
        return deepFreeze(result.state)
      }
      const dishes = { 'tonic-1': 8, 'tonic-2': 4 }
      let state: WorkState = deepFreeze(workAccount([COLT.id, MOM.id], dishes))
      state = deepFreeze({ ...state, umas: { ...state.umas, [COLT.id]: placeUma(state.umas[COLT.id]!, { tier: 1, scenario: 2, level: 20, careerWon: true }) } })
      const colt = () => state.umas[COLT.id]!
      const session = (building: 'observatory' | 'lineage-hall' | 'dojo', unlocks: readonly { kind: string; target: string }[], at: number) => {
        const started = step(start(state, { outfitId: COLT.id, slot: building === 'dojo' ? slotAt(building, 'speed') : slotAt(building), request: training.sessionRequest(unlocks) }, at, ENV))
        const done = collect(started, { outfitId: COLT.id }, at + 3 * 86_400_000, ENV)
        receipts.push(done.receipt)
        state = deepFreeze(done.state)
      }
      session('observatory', training.nextUnlocks(colt().build, colt(), 'observatory', null, 10), 3)
      session('dojo', [{ kind: 'bond', target: 'speed-e1' }], 4)
      session('lineage-hall', training.nextUnlocks(colt().build, colt(), 'lineage-hall', null, 2), 5)
      state = step(training.setCardSet(state, { umaId: COLT.id, preset: 'mile', cardSetIds: ['speed-e1'] }, 6, { content: TRAINING_CONTENT }))
      state = step(training.setAssignments(state, { umaId: COLT.id, preset: 'mile', assignments: { n1: 'speed-e1' } }, 7))
      state = step(training.setLineage(state, { umaId: COLT.id, preset: 'mile', lineage: { parent0: MOM.id } }, 8, { content: TRAINING_CONTENT }))
      state = step(training.setActiveNodes(state, { umaId: COLT.id, preset: 'mile', nodeIds: [] }, 9))
      state = step(training.setLoadout(state, { umaId: COLT.id, preset: 'mile', skillIds: [] }, 10, { content: TRAINING_CONTENT }))
      state = step(training.advanceScenario(state, { umaId: COLT.id }, 11, { content: CONTENT }))
      const derived = training.deriveUmaPreset(colt(), 'mile', TRAINING_CONTENT)
      return { state, receipts, derived }
    }
    const first = run()
    expect(run()).toEqual(first)
    expect(JSON.parse(JSON.stringify(first.state))).toEqual(first.state)
    expect(first.state.umas[COLT.id]!.build.constellationOpened).toBe(10)
    expect(first.state.umas[COLT.id]!.build.bonds).toEqual(['speed-e1'])
    // Every tonic was used (the bond took none), and the Warehouse keeps no empty rows.
    expect(first.state.items).toEqual({})
    expect(first.derived.filledNodes).toBe(1)
  })
})

describe('refusals', () => {
  it('list every rule failure in one table, the spec\'s codes and the edits\' own', () => {
    expect(Object.keys(training.TRAINING_REFUSALS).sort()).toEqual([
      'already-bonded', 'already-open', 'card-era', 'duplicate', 'duplicate-character', 'later-layer', 'lineage', 'mixed-facility', 'needs-first',
      'node-cap', 'node-locked', 'not-bonded', 'not-in-set', 'over-capacity', 'over-sp', 'session-size', 'set-size', 'skill-unavailable',
      'slot-not-open', 'wrong-room',
    ])
    expect(training.TRAINING_REFUSALS['later-layer']).toBe('Opens in scenario {scenario} · {name}')
  })

  it('use plain words: no protocol names, no codes', () => {
    const banned = /\b(operation|receipt|revision|generation|version|stale|conflict|payload|id|ids|sync|error|[1-5]\d\d)\b/i
    for (const [code, reason] of Object.entries(training.TRAINING_REFUSALS)) expect(banned.test(reason), `${code}: ${reason}`).toBe(false)
    for (const why of Object.values(training.LINEAGE_WHY)) expect(banned.test(why)).toBe(false)
  })
})

describe('the entry', () => {
  it('exports the contract', () => {
    for (const name of ['FACILITY_UNLOCKS', 'GYM_ROOM_FAMILY', 'roomAccepts', 'layerUnlocks', 'bondUnlock', 'sessionBaseMinutes', 'LAYER_SIZES',
      'BONDS_BY_SCENARIO', 'unlockStatus', 'nextUnlocks', 'remainingUnlocks', 'layerDone', 'EXTRA_NODE_IDS', 'extraNodeStats', 'EXTRA_CAPACITY',
      'EXTRA_HELD', 'baselineSp', 'reworkSpNodeValue', 'cardTypesIn', 'bondGrade', 'bondStatus', 'commitUnlocks', 'carryOnAdvance',
      'advanceScenario', 'setCardSet', 'setAssignments', 'setLineage', 'setActiveNodes', 'setLoadout', 'sessionKind', 'REWORK_BUFFS', 'deriveBuild',
      'TRAINING_REFUSALS']) {
      expect(training, name).toHaveProperty(name)
    }
  })
})
