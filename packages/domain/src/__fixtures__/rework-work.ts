// Synthetic Umas, accounts and a stand-in session kind for the work engine's tests (packages/domain/src/rework/work and
// rework/farm). Every template is invented; times are UTC wall clocks on an invented day.
import type { Aptitudes, Grade } from '../types'
import { CONTENT, template } from './rework-tiers'
import type { TierContent } from '../rework/tiers/career'
import { newAccount, unlockUma } from '../rework/tiers/roster'
import { isRefusal, refuse, type OpResult, type ReworkState } from '../rework/types'
import { FACILITY_IDS, type BuildingId, type BuildingLevel } from '../rework/farm/buildings'
import { farmExpAtLevel, QUARTERS_PER_EXP } from '../rework/farm/level'
import { itemById, planetDish, type ItemGrade } from '../rework/items/catalogue'
import { WORK_KINDS, type PlannedItem, type WorkEnv, type WorkKindRules } from '../rework/work/kinds'
import { newWorkState } from '../rework/work/state'
import type { UnlockRef, WorkState } from '../rework/work/types'

/** Running aptitudes: distances sprint, mile, medium, long; styles front, pace, late, end. */
function aptitudes(distance: [Grade, Grade, Grade, Grade], style: [Grade, Grade, Grade, Grade]): Aptitudes {
  return {
    surface: { turf: 'A', dirt: 'G' },
    distance: { sprint: distance[0], mile: distance[1], medium: distance[2], long: distance[3] },
    strategy: { front: style[0], pace: style[1], late: style[2], end: style[3] },
  }
}

/** C at everything: Farm EXP ×1.0 on every family, like 07 §2's worked example. */
export const PLAIN = template('plain', aptitudes(['C', 'C', 'C', 'C'], ['C', 'C', 'C', 'C']))
/** Sprint S (Sweets ×1.8), Mile D (Fish ×0.9), Long G (Fruits ×0.8), Medium B (Herbs ×1.2), the rest C. */
export const SPRINTS = template('sprints', aptitudes(['S', 'D', 'B', 'G'], ['C', 'C', 'C', 'C']))
/** A at everything: Farm EXP ×1.6. */
export const STRONG = template('strong', aptitudes(['A', 'A', 'A', 'A'], ['A', 'A', 'A', 'A']))
/** Another plain worker, for slot and stock contests. */
export const HELPER = template('helper', aptitudes(['C', 'C', 'C', 'C'], ['C', 'C', 'C', 'C']))
/** A session-goer for the Training Hub's examples. */
export const STUDENT = template('student', aptitudes(['C', 'C', 'C', 'C'], ['C', 'C', 'C', 'C']))

export const WORK_CONTENT: TierContent = {
  umas: new Map([...CONTENT.umas, ...[PLAIN, SPRINTS, STRONG, HELPER, STUDENT].map((uma) => [uma.id, uma] as const)]),
  races: CONTENT.races,
}

export const ENV: WorkEnv = { content: WORK_CONTENT }

/** An invented day: `clock('13:00')` is 13:00 UTC on it, and `clock('08:20', 1)` the next morning. */
const DAY = Date.UTC(2026, 9, 14)
export function clock(hhmm: string, day = 0): number {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  return DAY + day * 86_400_000 + (h * 60 + m) * 60_000
}
export const minutes = (n: number): number => n * 60_000

/** An account with these Umas unlocked at Farm Lv 1, every building at Lv 1 and an empty Warehouse. */
export function farmAccount(outfitIds: readonly string[] = [PLAIN.id, SPRINTS.id, STRONG.id, HELPER.id, STUDENT.id]): WorkState {
  let state: ReworkState = newAccount(0)
  for (const outfitId of outfitIds) state = ok(unlockUma(state, { outfitId }, 1, { content: WORK_CONTENT })).state
  return newWorkState(state)
}

/** The state with an Uma at a Farm Level, holding exactly the EXP that level takes. */
export function atFarmLevel<S extends WorkState>(state: S, outfitId: string, level: number, extraQuarters = 0): S {
  const uma = state.umas[outfitId]!
  return { ...state, umas: { ...state.umas, [outfitId]: { ...uma, farm: { level, exp: farmExpAtLevel(level) * QUARTERS_PER_EXP + extraQuarters } } } }
}

export const withStock = <S extends WorkState>(state: S, items: Readonly<Record<string, number>>): S => ({ ...state, items: { ...state.items, ...items } })
export const withLevel = <S extends WorkState>(state: S, building: BuildingId, level: BuildingLevel): S =>
  ({ ...state, buildings: { ...state.buildings, [building]: { level } } })
export const withPrizeMoney = <S extends WorkState>(state: S, prizeMoney: number): S => ({ ...state, profile: { ...state.profile, prizeMoney } })

/** The success branch, or a test failure naming the refusal. */
export function ok<R, S extends ReworkState>(result: OpResult<R, S>): { readonly state: S; readonly receipt: R } {
  if (isRefusal(result)) throw new Error(`Refused ${result.code}: ${result.reason}`)
  return result
}

// --- A stand-in session kind (T128 owns the real one) ---------------------------------------------------------------

/** The page's base minutes for a session unlock of grade g (05 §2), kept at k = 1 so the worked examples read as written. */
export const baseSessionSeconds = (g: ItemGrade, speed: number): number => Math.round(((180 + 15 * (g - 1)) * 60) / speed)

/** Observatory nodes n1–n6 are grade 1 and n7–n12 grade 2, as scenario 1's layer (05 §3). */
const nodeGrade = (n: number): ItemGrade => (n <= 6 ? 1 : 2)

/**
 * A synthetic session kind, only for these tests. Two unlock shapes:
 * - `{ kind: 'node', target: 'n<k>' }` at the Observatory: the next node in order, after her opened nodes and every node
 *   her earlier entries make (T127 counts them as made), paid with `dish-vegetables-<g>`;
 * - `{ kind: 'dish', target: '<dish id>' }` at any facility: one session paid with that dish.
 * Paying a node opens it in her build; paying a dish unlock opens nothing.
 */
export const SYNTHETIC_SESSION: WorkKindRules = {
  plan(state, outfitId, request, _now, context) {
    if (request.kind !== 'session' || !(FACILITY_IDS as readonly string[]).includes(context.slot.building)) return refuse('not-here', "That isn't made here.")
    const nodesAhead = context.earlier.flatMap((earlier) => (earlier.kind === 'session' ? earlier.unlocks : [])).filter((u) => u.kind === 'node').length
    let next = state.umas[outfitId]!.build.constellationOpened + nodesAhead + 1
    const items: PlannedItem[] = []
    for (const unlock of request.unlocks) {
      let dish: string
      if (unlock.kind === 'node') {
        if (context.slot.building !== 'observatory' || unlock.target !== `n${next}`) return refuse('needs-first', 'Needs node {n} first.', { n: next })
        dish = planetDish('vegetables', nodeGrade(next)).id
        next += 1
      } else {
        dish = unlock.target
      }
      const grade = itemById(dish)
      if (grade === undefined || grade.kind !== 'dish') return refuse('not-here', "That isn't made here.")
      items.push({ seconds: baseSessionSeconds(grade.grade, context.speed), inputs: [{ item: dish, qty: 1 }], output: { unlock }, farmExp: 0 })
    }
    return items
  },
  pay(state, outfitId, outputs) {
    const opened = outputs.flatMap((output) => ('unlock' in output && output.unlock.kind === 'node' ? [output.unlock.target] : []))
    const uma = state.umas[outfitId]!
    const build = { ...uma.build, constellationOpened: uma.build.constellationOpened + opened.length }
    return { state: { ...state, umas: { ...state.umas, [outfitId]: { ...uma, build } } }, detail: { opened } }
  },
}

export const SESSION_ENV: WorkEnv = { content: WORK_CONTENT, kinds: { ...WORK_KINDS, session: SYNTHETIC_SESSION } }

export const node = (n: number): UnlockRef => ({ kind: 'node', target: `n${n}` })
export const dishUnlock = (dish: string): UnlockRef => ({ kind: 'dish', target: dish })

/** The state with her constellation opened to `n` nodes. */
export function withNodes<S extends WorkState>(state: S, outfitId: string, n: number): S {
  const uma = state.umas[outfitId]!
  return { ...state, umas: { ...state.umas, [outfitId]: { ...uma, build: { ...uma.build, constellationOpened: n } } } }
}
