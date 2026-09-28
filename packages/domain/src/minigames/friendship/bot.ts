// A simple Friendship Training player for `pnpm sim:training` and the engine's tests (M020 T063): greedy best train,
// redraws towards on-type cards, plain reward, skill and shop choices. A person who plans ahead does better.

import {
  ftApply,
  ftFinished,
  ftIsBroad,
  ftOnType,
  ftScoreTrain,
  ftStart,
  type FtAction,
  type FtState,
  type FtTrainResult,
} from './engine'
import { FT_MAX_REDRAW, FT_MAX_TRAIN, FT_SHOP_PRICES, FT_SKILL_SLOTS } from './rules'
import type { FtSetup } from './setup'
import { STATS, type StatKey } from '../../types'

function subsets(items: readonly number[], max: number): number[][] {
  const result: number[][] = []
  const walk = (start: number, picked: number[]) => {
    if (picked.length > 0) result.push([...picked])
    if (picked.length === max) return
    for (let index = start; index < items.length; index += 1) {
      picked.push(items[index]!)
      walk(index + 1, picked)
      picked.pop()
    }
  }
  walk(0, [])
  return result
}

/** The highest-scoring train the hand allows. */
export function ftBestTrain(setup: FtSetup, state: FtState): FtTrainResult {
  let best: FtTrainResult | null = null
  for (const uids of subsets(state.encounter!.hand, FT_MAX_TRAIN)) {
    const result = ftScoreTrain(setup, state, uids)
    if (!best || result.total > best.total || (result.total === best.total && result.uids.length < best.uids.length)) best = result
  }
  return best!
}

const typeCounts = (setup: FtSetup, state: FtState): Record<StatKey, number> => {
  const counts: Record<StatKey, number> = { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }
  for (const { cardId } of state.deck) {
    const type = setup.cards[cardId]!.type
    if (type !== 'friend' && type !== 'group') counts[type] += 1
  }
  return counts
}

/** The bot's next choice. */
export function ftBotAction(setup: FtSetup, state: FtState): FtAction {
  switch (state.phase) {
    case 'build': {
      const counts = typeCounts(setup, state)
      return { type: 'build', facilities: [...STATS].sort((left, right) => counts[right] - counts[left]).slice(0, 2) }
    }
    case 'facility': {
      const counts = typeCounts(setup, state)
      const offers = state.facilityOffers!
      let bestIndex = 0
      let bestValue = -Infinity
      offers.forEach((offer, index) => {
        const value = (counts[offer.type] + 2) / offer.target + offer.payout * 0.0005
        if (value > bestValue) { bestValue = value; bestIndex = index }
      })
      return { type: 'facility', index: bestIndex }
    }
    case 'encounter': {
      const encounter = state.encounter!
      const best = ftBestTrain(setup, state)
      const need = encounter.target - encounter.score
      if (best.total >= need || encounter.redrawsLeft <= 0 || best.total * encounter.trainsLeft >= need * 1.1) {
        return { type: 'train', uids: best.uids }
      }
      const off = encounter.hand.filter((uid) => {
        const instance = state.deck.find((entry) => entry.uid === uid)!
        const def = setup.cards[instance.cardId]!
        return instance.cardId !== setup.mainCardId && !ftIsBroad(def) && !ftOnType(setup, state, instance, def)
      }).slice(0, FT_MAX_REDRAW)
      return off.length > 0 ? { type: 'redraw', uids: off } : { type: 'train', uids: best.uids }
    }
    case 'reward': {
      const main = setup.cards[setup.mainCardId]!
      const counts = typeCounts(setup, state)
      const offer = state.rewardOffer!
      const score = (id: string) => {
        const def = setup.cards[id]!
        if (def.type === main.type) return 100 + def.stars
        if (ftIsBroad(def)) return 50 + def.stars
        return counts[def.type as StatKey] + def.stars
      }
      return { type: 'reward', cardId: offer.length > 0 ? [...offer].sort((left, right) => score(right) - score(left))[0]! : null }
    }
    case 'skill': {
      if (state.skills.length >= FT_SKILL_SLOTS) return { type: 'skill', skillId: null }
      const speed = state.deck.some(({ cardId }) => setup.cards[cardId]!.type === 'speed')
      const usable = state.skillOffer!.filter((id) => setup.skills[id]!.rule !== 'surge' || speed)
      return { type: 'skill', skillId: usable[0] ?? state.skillOffer![0] ?? null }
    }
    case 'shop': {
      const shop = state.shop!
      const room = state.skills.length < FT_SKILL_SLOTS
      if (room && shop.gold && !shop.bought.includes('gold') && state.fans >= FT_SHOP_PRICES.gold) return { type: 'buy', item: 'gold' }
      if (room && shop.white && !shop.bought.includes('white') && state.fans >= FT_SHOP_PRICES.white) return { type: 'buy', item: 'white' }
      const main = state.deck.find(({ cardId }) => cardId === setup.mainCardId)
      if (main && !shop.bought.includes('upgrade') && state.fans >= FT_SHOP_PRICES.upgrade) return { type: 'buy', item: 'upgrade', uid: main.uid }
      return { type: 'leave-shop' }
    }
    default:
      throw new Error('The run is over')
  }
}

/** Plays a whole run; returns the choices and where they ended. */
export function ftBotPlay(setup: FtSetup, maxSteps = 400): { actions: FtAction[]; state: FtState } {
  let state = ftStart(setup)
  const actions: FtAction[] = []
  while (!ftFinished(state) && actions.length < maxSteps) {
    const action = ftBotAction(setup, state)
    state = ftApply(setup, state, action)
    actions.push(action)
  }
  return { actions, state }
}
