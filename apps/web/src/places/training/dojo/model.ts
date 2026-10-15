// Her bonds and card set at the Dojo (docs/rework/06-cards-and-bonds.md §2, §3, §6; D129; T139): her bonds this tier and
// "6 of 9 by scenario 2" (`bondsThrough`); the viewed preset's six slots, each card with the nodes it holds and what one
// pays (`cardPay`), dimmed with "Newer cards available" where its `eraPct` fell (06 §3); the set a pick would make for a
// slot (`set-card-set` checks it); the receipt's hand-over and emptied nodes in one line; and which cards she can bond
// now (`bondStatus`), for **Bond more** in T138's Library. Pure.
import type { DistanceCategory, SupportCardType } from '@racer/domain'
import { cardNodeId } from '@racer/domain/rework/constellation'
import { workAhead } from '@racer/domain/rework/planner'
import { isRefusal, scenarioNumber, type UmaState } from '@racer/domain/rework/tiers'
import { bondsThrough, bondStatus, CARD_SET_SIZE, cardPay, type CardSetReceipt } from '@racer/domain/rework/training'
import type { WorkState } from '@racer/domain/rework/work'
import { payWords } from '../../card-library/model'
import { cardName } from '../../../ui/words'
import type { Content } from '../common'
import { trainingWords } from '../words'

export interface SetSlotView {
  readonly index: number
  readonly cardId: string | null
  readonly name: string | null
  readonly type: SupportCardType | null
  /** Open nodes it holds in this preset. */
  readonly nodes: number
  /** "Speed +84 · Power +36 a node", or SP for Friend and Group. */
  readonly pay: string | null
  /** Its `eraPct` fell below 100 at her scenario: a dimmed value and "Newer cards available" (06 §3). */
  readonly older: boolean
}

export interface DojoView {
  readonly bonds: readonly string[]
  /** "6 bonds this tier · 6 of 9 by scenario 2". */
  readonly line: string
  readonly set: readonly SetSlotView[]
}

export function dojoView(uma: UmaState, preset: DistanceCategory, content: Content): DojoView {
  const T = scenarioNumber(uma)
  const current = uma.build.presets[preset]
  const open = new Set(Array.from({ length: uma.build.constellationOpened }, (_, i) => cardNodeId(i + 1)))
  const target = bondsThrough(uma.scenario)
  const bonds = uma.build.bonds
  const line = [
    bonds.length === 0 ? trainingWords('bonds-none') : bonds.length === 1 ? trainingWords('bonds-tier-one') : trainingWords('bonds-tier', { n: bonds.length }),
    trainingWords('bonds-by', { n: Math.min(bonds.length, target), target, s: uma.scenario }),
  ].join(' · ')
  const set = Array.from({ length: CARD_SET_SIZE }, (_, index): SetSlotView => {
    const cardId = current.cardSetIds[index] ?? null
    const card = cardId === null ? undefined : content.cards.get(cardId)
    const pay = card === undefined ? null : cardPay(card, T)
    return {
      index,
      cardId,
      name: cardId === null ? null : cardName(content, cardId),
      type: card?.type ?? null,
      nodes: cardId === null ? 0 : Object.entries(current.assignments).filter(([node, id]) => id === cardId && open.has(node)).length,
      pay: pay === null || !pay.eligible ? null : payWords(pay),
      older: pay !== null && pay.eraPct < 100,
    }
  })
  return { bonds, line, set }
}

/** The set a pick makes: `cardId` in slot `index` (a replacement hands over its nodes, D129), or the slot emptied. */
export function setWith(current: readonly string[], index: number, cardId: string | null): readonly string[] {
  const next = [...current]
  if (cardId === null) next.splice(index, 1)
  else if (index < next.length) next[index] = cardId
  else next.push(cardId)
  return next
}

/** The receipt's hand-over and emptied nodes in one line (D129): "B took A's nodes. 2 nodes emptied." */
export function receiptLine(receipt: Pick<CardSetReceipt, 'handedOver' | 'emptied'>, content: Content): string {
  const parts = Object.entries(receipt.handedOver).map(([from, to]) => trainingWords('handed-over', { from: cardName(content, from), to: cardName(content, to) }))
  if (receipt.emptied.length === 1) parts.push(trainingWords('emptied-one'))
  else if (receipt.emptied.length > 1) parts.push(trainingWords('emptied', { n: receipt.emptied.length }))
  return parts.length === 0 ? trainingWords('set-done') : parts.join(' ')
}

/** Cards she can bond now (`bondStatus` available), with her work ahead counted: **Bond more** (06 §6). */
export function bondable(settled: WorkState, uma: UmaState, content: Content): (cardId: string) => boolean {
  const T = scenarioNumber(uma)
  const ahead = workAhead(settled.work[uma.outfitId])
  return (cardId) => {
    const card = content.cards.get(cardId)
    if (card === undefined) return false
    const status = bondStatus(uma.build, card, T, ahead)
    return !isRefusal(status) && status.status === 'available'
  }
}
