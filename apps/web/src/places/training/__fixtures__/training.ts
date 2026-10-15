// Synthetic Training accounts for T139's tests, built with the rework's own operations on `rework/sim`'s invented
// content (T140's `farmAccount`, a new account at day 0, 08:00 UTC), never from the private packs: Umas unlocked,
// dishes and Prize Money by `dev-grant`, a scenario's gate and `advance-scenario`, a card set by `set-card-set`. A
// layer already done is committed with the Training Hub's own `commitUnlocks`, as a finished session's Collect does.
// Imported by tests only.
import type { DistanceCategory } from '@racer/domain'
import { simCardId } from '@racer/domain/rework/sim'
import { bondUnlock, commitUnlocks, layerUnlocks, type Unlock } from '@racer/domain/rework/training'
import { isRefusal } from '@racer/domain/rework/tiers'
import type { WorkState } from '@racer/domain/rework/work'
import { workView, type WorkView } from '../../ui/work/view'
import type { WordsContext } from '../../ui/work/words'
import { apply, DEV_ENV, farmAccount, farmSeed, uma } from '../farm/fixtures'

export { apply, DEV_ENV, farmSeed, uma }
export { HOUR, MINUTE } from '../farm/fixtures'

export const content = DEV_ENV.content

/** The fresh account (13 §5) with the first `n` synthetic Umas unlocked. */
export const trainingAccount = (n: number) => farmAccount(n)

/** Her build with `unlocks` committed in order, as Collect writes a finished session (05 §2). */
export function withCommitted(state: WorkState, outfitId: string, unlocks: readonly Unlock[]): WorkState {
  const her = state.umas[outfitId]!
  const { build } = commitUnlocks(her.build, her, unlocks)
  return { ...state, umas: { ...state.umas, [outfitId]: { ...her, build } } }
}

/** Her layers' fixed unlocks committed, layer by layer. */
export const withLayers = (state: WorkState, outfitId: string, layers: readonly number[]): WorkState =>
  withCommitted(state, outfitId, layers.flatMap((s) => layerUnlocks(s as Unlock['layer'])))

/** She advances to the next scenario of her tier: `dev-grant` to her gate with every goal won, then `advance-scenario`. */
export function advanced(state: WorkState, outfitId: string, at: number): WorkState {
  const gate = apply(state, 'dev-grant', { gate: outfitId }, at).state
  return apply(gate, 'advance-scenario', { umaId: outfitId }, at).state
}

/** Dishes or other items into the Warehouse, and Prize Money, by `dev-grant`. */
export function granted(state: WorkState, at: number, items: Readonly<Record<string, number>>, prizeMoney?: number): WorkState {
  return apply(state, 'dev-grant', { items, ...(prizeMoney === undefined ? {} : { prizeMoney }) }, at).state
}

/** A card bonded to her (a committed Dojo unlock) and put in her preset's set (`set-card-set`). */
export function withSetCard(state: WorkState, outfitId: string, type: 'speed' | 'stamina' | 'power' | 'guts' | 'wit' | 'friend', era: number, preset: DistanceCategory, at: number): { state: WorkState; cardId: string } {
  const her = state.umas[outfitId]!
  const card = content.cards.get(simCardId(type, era))!
  const bond = bondUnlock(card, her.tier, her.scenario)
  if (isRefusal(bond)) throw new Error(bond.reason)
  const bonded = withCommitted(state, outfitId, [bond])
  const set = [...bonded.umas[outfitId]!.build.presets[preset].cardSetIds, card.id]
  return { state: apply(bonded, 'set-card-set', { umaId: outfitId, preset, cardSetIds: set }, at).state, cardId: card.id }
}

/** The view at `now`, as the screens read it. */
export const viewAt = (state: WorkState, now: number): WorkView => workView(state, now, DEV_ENV)

/** Names from the synthetic content; UTC, as the seeds run. */
export const CONTEXT: WordsContext = Object.freeze({ umaName: (outfitId: string) => content.umas.get(outfitId)?.name ?? '', utcOffsetMin: 0 })
