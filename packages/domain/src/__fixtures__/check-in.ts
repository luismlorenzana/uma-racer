// Synthetic accounts for the check-in and planner tests (packages/domain/src/check-in and planner): up to
// 25 invented Umas, all C, on T127's real work engine with T128's real session kind. Times are UTC wall clocks on the
// invented day of `rework-work`'s `clock`.
import type { Aptitudes } from '../types'
import type { BuildingId, RoomId } from '../farm/buildings'
import { newAccount, unlockUma } from '../tiers/roster'
import { isRefusal, type ReworkState } from '../state/types'
import { newWorkState } from '../work/adapter'
import type { FarmKind, SlotRef, WorkRequest, WorkState } from '../work/types'
import { template } from './tiers'
import { TIER_AND_TRAINING } from './training'

export { atFarmLevel, clock, minutes, ok, withStock } from './work'

const PLAIN: Aptitudes = {
  surface: { turf: 'A', dirt: 'G' },
  distance: { sprint: 'C', mile: 'C', medium: 'C', long: 'C' },
  strategy: { front: 'C', pace: 'C', late: 'C', end: 'C' },
}

/** 25 invented Umas, `uma-01` … `uma-25`, C at everything (Farm EXP ×1.0). */
export const ROSTER = Array.from({ length: 25 }, (_, i) => template(`uma-${String(i + 1).padStart(2, '0')}`, PLAIN))
/** The n-th Uma's outfit, from 1. */
export const uma = (n: number): string => ROSTER[n - 1]!.id

/** T128's content (cards, skills, the tier fixtures) with the roster added. */
export const CHECK_IN_CONTENT = { ...TIER_AND_TRAINING, umas: new Map([...TIER_AND_TRAINING.umas, ...ROSTER.map((t) => [t.id, t] as const)]) }
export const ENV = { content: CHECK_IN_CONTENT }

/** An account with the first `n` Umas unlocked at Farm Lv 1, every building at Lv 1, and this Warehouse. */
export function account(n = 25, items: Readonly<Record<string, number>> = {}): WorkState {
  let state: ReworkState = newAccount(0)
  state = { ...state, profile: { ...state.profile, umaTickets: n } }
  for (const template of ROSTER.slice(0, n)) {
    const result = unlockUma(state, { outfitId: template.id }, 1, { content: CHECK_IN_CONTENT })
    if (isRefusal(result)) throw new Error(result.reason)
    state = result.state
  }
  const work = newWorkState(state)
  return { ...work, items: { ...items } }
}

export const job = (kind: FarmKind, item: string, count: number): WorkRequest => ({ kind, item, count })
export const gather = (item: string, count: number) => job('gather', item, count)
export const craft = (item: string, count: number) => job('craft', item, count)
export const cook = (item: string, count: number) => job('cook', item, count)
export const session = (...targets: readonly [kind: string, target: string][]): WorkRequest =>
  ({ kind: 'session', unlocks: targets.map(([kind, target]) => ({ kind, target })) })
export const nodes = (...ks: readonly number[]): WorkRequest => session(...ks.map((k) => ['node', `n${k}`] as [string, string]))

export const slot = (building: BuildingId, n = 0, room?: RoomId): SlotRef => (room === undefined ? { building, slot: n } : { building, room, slot: n })
