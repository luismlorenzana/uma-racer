// Racer's typed projections and check-in words over kit models, not a second set of work UI rules (SC5).
import * as kit from '@luismlorenzana/uma-kit/work'
import { durationText, say, type Words } from '@racer/domain/check-in'
import type { BuildingId } from '@racer/domain/farm'
import { racerRefusal, sharedWorkEnv, WORK_BUILDINGS, type SlotRef, type WorkRequest, type WorkState } from '@racer/domain/work'
import type { WorkView } from './view'
import { racerSizeRule } from './size'
import { workWords } from './words'

export interface HeldSlotCard extends Omit<kit.HeldSlotCard, 'slot' | 'request' | 'queue'> {
  readonly slot: SlotRef; readonly request: WorkRequest; readonly queue: readonly WorkRequest[]
}
export type SlotCardModel = { readonly kind: 'free'; readonly slot: SlotRef } | HeldSlotCard
export const slotCards = (state: WorkState, building: BuildingId, now: number): SlotCardModel[] =>
  kit.slotCards(state, building, now, WORK_BUILDINGS) as SlotCardModel[]

export interface UpgradeView {
  readonly to: 2 | 3; readonly prizeMoney: number; readonly haveMoney: number
  readonly items: kit.UpgradeView['items']
  readonly adds: Pick<kit.UpgradeView, 'slots' | 'slotsNow' | 'speed' | 'speedNow'>
  readonly refusal: Words | null
}
export function upgradeView(view: WorkView, building: BuildingId): UpgradeView | null {
  const next = kit.upgradeView(view.settled, building, view.now, sharedWorkEnv(view.env))
  if (next === null) return null
  const refused = next.refusal === null ? null : racerRefusal(next.refusal)
  return { to: next.to as 2 | 3, prizeMoney: next.money, haveMoney: next.haveMoney, items: next.items,
    adds: { slots: next.slots, slotsNow: next.slotsNow, speed: next.speed, speedNow: next.speedNow },
    refusal: refused === null ? null : say(refused.reason, refused.data) }
}

/** Retained for check-in/planner comparisons: its fit and idle words stay game-owned, geometry is the kit's. */
export function sizeChipsView(start: number, seconds: readonly number[], max: number, times: readonly number[], offset: number) {
  const view = kit.sizeChipsView(start, seconds, max, racerSizeRule(times, offset))
  return { ...view, marked: view.marked ?? 1, chips: view.chips.map((chip) => {
    const duration = durationText(chip.ms)
    return { ...chip, duration, words: chip.idleMs > 0
      ? workWords('size-chip-idle', { time: duration, idle: durationText(chip.idleMs) }) : duration }
  }) }
}
