// The build's operations (docs/game/05-the-build.md, D382): setting the deck, posting a card, buying pips or a Camp,
// pouring Bond and buying a skill. Each reads one career, spends from its wallet, refuses in plain words, and is
// idempotent by its id through `commitOperation`. Pure.
import type { UmaTemplate } from '../content'
import { isRowId } from '../save/kinds'
import { defineOperation, isRefusal, refuse, type AnyOperationDef, type OperationEnv, type Refusal } from '../save/registry'
import { BRANCHES, bondId, type Branch, type CareerRecord } from '../save/records'
import type { SaveState } from '../save/state'
import { pourBond, type PourReceipt } from './bond'
import { deckRefusal, postCard, withDeck } from './deck'
import type { BuildView } from './derive'
import { buySkill, skillPoints } from './skills'
import { buyCamp, buyPips } from './tree'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
const isBranch = (value: unknown): value is Branch => (BRANCHES as readonly unknown[]).includes(value)
const isCount = (value: unknown, max: number): value is number => Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= max

interface Open {
  readonly career: CareerRecord
  readonly uma: UmaTemplate
  readonly view: BuildView
}

/** The career an operation acts on, while it can still change. */
function open(state: SaveState, careerId: string, env: OperationEnv): Open | Refusal {
  const career = state.careers[careerId]
  if (career === undefined) return refuse('unknown-career', 'That career doesn\'t exist.')
  if (career.completedAt !== null) return refuse('career-complete', 'Her career is complete, so its build is frozen.')
  const uma = env.content.umas.get(career.umaId)
  if (uma === undefined) return refuse('unknown-uma', 'That Uma isn\'t in the game.')
  return { career, uma, view: { uma, cards: env.content.cards, bonds: state.bonds } }
}

const withCareer = (state: SaveState, careerId: string, career: CareerRecord): SaveState =>
  ({ ...state, careers: { ...state.careers, [careerId]: career } })

// --- set-deck ---------------------------------------------------------------------------------------------------------

export interface SetDeckInput {
  readonly careerId: string
  readonly deck: readonly string[]
}

export interface SetDeckReceipt {
  readonly deck: readonly string[]
  readonly posts: Readonly<Record<string, Branch>>
}

export const setDeckOp = defineOperation<SetDeckInput, SetDeckReceipt>({
  name: 'set-deck',
  parse: (value) => {
    if (!isObject(value) || !exact(value, ['careerId', 'deck']) || !isRowId(value.careerId)) return null
    if (!Array.isArray(value.deck) || value.deck.length > 64 || !value.deck.every(isRowId)) return null
    return { careerId: value.careerId, deck: [...(value.deck as string[])] }
  },
  apply: (state, input, _now, env) => {
    const opened = open(state, input.careerId, env)
    if (isRefusal(opened)) return opened
    const refusal = deckRefusal(input.deck, opened.career.T, env.content.cards, state.cards)
    if (refusal !== null) return refusal
    const career = withDeck(opened.career, input.deck, env.content.cards)
    return { state: withCareer(state, input.careerId, career), receipt: { deck: career.deck, posts: career.posts } }
  },
})

// --- post-card --------------------------------------------------------------------------------------------------------

export interface PostCardInput {
  readonly careerId: string
  readonly cardId: string
  readonly branch: Branch
}

export const postCardOp = defineOperation<PostCardInput, PostCardInput>({
  name: 'post-card',
  parse: (value) => {
    if (!isObject(value) || !exact(value, ['careerId', 'cardId', 'branch'])) return null
    if (!isRowId(value.careerId) || !isRowId(value.cardId) || !isBranch(value.branch)) return null
    return { careerId: value.careerId, cardId: value.cardId, branch: value.branch }
  },
  apply: (state, input, _now, env) => {
    const opened = open(state, input.careerId, env)
    if (isRefusal(opened)) return opened
    const career = postCard(opened.career, input.cardId, input.branch, env.content.cards)
    if (isRefusal(career)) return career
    return { state: withCareer(state, input.careerId, career), receipt: input }
  },
})

// --- buy-pips ---------------------------------------------------------------------------------------------------------

/** The next `count` pips of a branch, or (with `camp`) the next Camp node in it. */
export type BuyPipsInput =
  | { readonly careerId: string; readonly branch: Branch; readonly count: number }
  | { readonly careerId: string; readonly branch: Branch; readonly camp: true }

export interface BuyPipsReceipt {
  readonly branch: Branch
  /** The branch's pips after. */
  readonly pips: number
  /** Camp nodes bought, in order. */
  readonly camps: readonly (Branch | null)[]
  readonly spent: number
  readonly drillsLeft: number
}

export const buyPipsOp = defineOperation<BuyPipsInput, BuyPipsReceipt>({
  name: 'buy-pips',
  parse: (value) => {
    if (!isObject(value) || !isRowId(value.careerId) || !isBranch(value.branch)) return null
    if (exact(value, ['careerId', 'branch', 'count']) && isCount(value.count, 20)) {
      return { careerId: value.careerId, branch: value.branch, count: value.count }
    }
    if (exact(value, ['careerId', 'branch', 'camp']) && value.camp === true) return { careerId: value.careerId, branch: value.branch, camp: true }
    return null
  },
  apply: (state, input, _now, env) => {
    const opened = open(state, input.careerId, env)
    if (isRefusal(opened)) return opened
    const bought = 'camp' in input
      ? buyCamp(opened.career, opened.view, input.branch)
      : buyPips(opened.career, opened.view, input.branch, input.count)
    if (isRefusal(bought)) return bought
    const career = bought.career
    return {
      state: withCareer(state, input.careerId, career),
      receipt: { branch: input.branch, pips: career.pips[input.branch], camps: career.camps, spent: bought.spent, drillsLeft: career.wallet.drills[input.branch] },
    }
  },
})

// --- pour-bond --------------------------------------------------------------------------------------------------------

export interface PourBondInput {
  readonly careerId: string
  readonly cardId: string
  readonly amount: number
}

export const pourBondOp = defineOperation<PourBondInput, PourReceipt>({
  name: 'pour-bond',
  parse: (value) => {
    if (!isObject(value) || !exact(value, ['careerId', 'cardId', 'amount'])) return null
    if (!isRowId(value.careerId) || !isRowId(value.cardId) || !isCount(value.amount, 100_000)) return null
    return { careerId: value.careerId, cardId: value.cardId, amount: value.amount }
  },
  apply: (state, input, _now, env) => {
    const opened = open(state, input.careerId, env)
    if (isRefusal(opened)) return opened
    const poured = pourBond(opened.career, state.bonds, env.content.cards, input.cardId, input.amount)
    if (isRefusal(poured)) return poured
    const { track } = poured
    return {
      state: {
        ...withCareer(state, input.careerId, poured.career),
        bonds: { ...state.bonds, [bondId(track.umaId, track.tier, track.cardId)]: track },
      },
      receipt: poured.receipt,
    }
  },
})

// --- buy-skill --------------------------------------------------------------------------------------------------------

export interface BuySkillInput {
  readonly careerId: string
  readonly skillId: string
}

export interface BuySkillReceipt {
  readonly skillId: string
  readonly cost: number
  /** SP she can still spend. */
  readonly spLeft: number
}

export const buySkillOp = defineOperation<BuySkillInput, BuySkillReceipt>({
  name: 'buy-skill',
  parse: (value) => {
    if (!isObject(value) || !exact(value, ['careerId', 'skillId']) || !isRowId(value.careerId) || !isRowId(value.skillId)) return null
    return { careerId: value.careerId, skillId: value.skillId }
  },
  apply: (state, input, _now, env) => {
    const opened = open(state, input.careerId, env)
    if (isRefusal(opened)) return opened
    const bought = buySkill(opened.career, opened.view, opened.uma, env.content.skills, input.skillId)
    if (isRefusal(bought)) return bought
    return {
      state: withCareer(state, input.careerId, bought.career),
      receipt: { skillId: input.skillId, cost: bought.cost, spLeft: skillPoints(bought.career, opened.view).available },
    }
  },
})

export const BUILD_OPERATIONS: readonly AnyOperationDef[] = [setDeckOp, postCardOp, buyPipsOp, pourBondOp, buySkillOp]
