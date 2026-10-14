// Plain words and purity (docs/rework/02-check-ins-and-notifications.md §9; docs/tasks/M033-rework-rules.md "Pure"): no
// banned word in any sentence the check-in, the planner or any rework refusal table can show, and the check-in and
// planner read no clock, roll no dice, do no I/O, touch no browser global, never write into their inputs and repeat
// themselves exactly.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { account, atFarmLevel, clock, craft, ENV, gather, nodes, ok, slot, uma } from '../../__fixtures__/rework-check-in'
import { codeOnly } from '../../__fixtures__/code-only'
import { deepFreeze } from '../../__fixtures__/rework-tiers'
import { EXCHANGE_REFUSALS } from '../exchange/refusals'
import { plan } from '../planner/needs'
import { queueWarnings } from '../planner/project'
import { needsFor, rosterTotals, suggest } from '../planner/suggest'
import { TIER_REFUSALS } from '../tiers/refusals'
import { LINEAGE_WHY, TRAINING_REFUSALS } from '../training/refusals'
import { queue, start } from '../work/operations'
import { WORK_REFUSALS } from '../work/refusals'
import type { WorkState } from '../work/types'
import { collectAll } from './collect-all'
import { repeat } from './repeat'
import { checkInSummary } from './summary'
import { BANNED_WORDS, CHECK_IN_REFUSALS, CHECK_IN_WORDS, hasBannedWord } from './words'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const PLANNER = fileURLToPath(new URL('../planner/', import.meta.url))

/** Every string in a refusal table, however it nests. */
const sentences = (table: unknown): string[] =>
  typeof table === 'string' ? [table] : table && typeof table === 'object' ? Object.values(table).flatMap(sentences) : []

describe('plain words', () => {
  it("bans 02 §9's words", () => {
    expect(BANNED_WORDS).toEqual(['operation', 'receipt', 'revision', 'generation', 'version', 'stale', 'conflict', 'payload', 'id'])
    for (const text of ['That operation failed', 'Receipts', 'Stale revision', 'conflict', 'bad payload', 'missing ids', 'Sync failed (503)', 'sync error', 'HTTP 404']) {
      expect(hasBannedWord(text), text).toBe(true)
    }
    for (const text of ["Saved on this phone. It'll sync when you're back online.", 'Already collected.', 'Only 3 left now. Start ×3?',
      'Kitasan Black is busy until 18:30.', 'Needs Farm Lv 16.', 'Short 2 raw Vegetables G2.', 'Buy 2 and restart · 99', 'idle', 'Overnight']) {
      expect(hasBannedWord(text), text).toBe(false)
    }
  })

  it('keeps every template and every refusal table of the rework free of them', () => {
    const tables = { CHECK_IN_WORDS, CHECK_IN_REFUSALS, TIER_REFUSALS, WORK_REFUSALS, TRAINING_REFUSALS, LINEAGE_WHY, EXCHANGE_REFUSALS }
    for (const [name, table] of Object.entries(tables)) {
      const all = sentences(table)
      expect(all.length, name).toBeGreaterThan(0)
      for (const text of all) expect(hasBannedWord(text), `${name}: ${text}`).toBe(false)
    }
  })
})

describe('purity', () => {
  it('reads no clock, rolls no dice and does no I/O in rework/check-in or rework/planner', () => {
    const sources = [HERE, PLANNER].flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).map((f) => join(dir, f)))
    expect(sources.length).toBeGreaterThanOrEqual(14)
    for (const file of sources) {
      const code = codeOnly(readFileSync(file, 'utf8'))
      for (const banned of [/Date\.now/, /new Date\b/, /Math\.random/, /from 'node:/, /\brequire\(/, /\bfetch\(/, /localStorage/, /indexedDB/, /\bwindow\./, /\bdocument\./, /\bprocess\./, /\bconsole\./]) {
        expect(banned.test(code), `${file} uses ${banned}`).toBe(false)
      }
    }
  })

  it('never writes into deep-frozen inputs, and repeats itself exactly, after a JSON round trip too', () => {
    const night = (): WorkState => {
      let state = atFarmLevel(account(6, { carrot: 9, 'dish-vegetables-1': 2, 'speed-ticket': 3 }), uma(2), 4)
      state = ok(start(state, { outfitId: uma(1), slot: slot('pantry'), request: craft('chopped-carrot', 4) }, clock('22:30'), ENV)).state
      state = ok(queue(state, { outfitId: uma(1), add: { request: craft('chopped-carrot', 9), building: 'pantry' } }, clock('22:31'), ENV)).state
      state = ok(start(state, { outfitId: uma(2), slot: slot('vegetable-garden'), request: gather('carrot', 3) }, clock('22:30'), ENV)).state
      return ok(start(state, { outfitId: uma(3), slot: slot('observatory'), request: nodes(1) }, clock('22:30'), ENV)).state
    }
    const run = (initial: WorkState) => {
      const state = deepFreeze(initial)
      const morning = clock('08:00', 1)
      const warnings = queueWarnings(state, clock('22:32'), ENV)
      const collected = collectAll(state, {}, morning, ENV)
      const repeated = repeat(deepFreeze(collected.state), {}, morning, ENV)
      const after = deepFreeze(repeated.state)
      return {
        warnings, collected, repeated,
        plan: plan(after, [uma(4), uma(5)], morning, {}, ENV),
        suggest: suggest(after, morning, { env: ENV }),
        needs: needsFor(after, uma(6), morning, { env: ENV }),
        roster: rosterTotals(after, morning, { env: ENV }),
        summary: checkInSummary(after, { since: clock('22:30'), collect: collected.receipt, repeat: repeated.receipt }, morning, { env: ENV }),
      }
    }
    const first = run(night())
    expect(run(night())).toEqual(first)
    expect(run(JSON.parse(JSON.stringify(night())) as WorkState)).toEqual(first)
    expect(first.warnings).toHaveLength(1)
    expect(first.summary.sections.length).toBeGreaterThan(3)
  })
})
