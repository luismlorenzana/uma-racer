// The build, derived when read (docs/game/05-the-build.md, D382): what the bought pips pay is recomputed from the
// current deck, posts and bonds, so swapping a card or reaching bond 80 changes every pip at once, and purchase order
// never matters. Her stats are her star-5 base, the deck's Initial stats, the tree and her tracks' hint rewards. Pure.
import type { SupportCardTemplate, UmaTemplate } from '../content'
import { BRANCHES, bondId, type BondRecord, type Branch, type CareerRecord } from '../save/records'
import { tierOf } from '../tiers/map'
import { STATS, zeroStats, type Stats } from '../types'
import { bondValue, trackGifts, tracksOf } from './bond'
import { postOf } from './deck'
import { amountOf, deckWideTerms, EFFECT, INITIAL_STAT, inFriendship, staticEffects, type CardSituation, type DeckFacts } from './effects'
import { branchLevel, FACILITY_LEVELS, facilityRow, pipCost, PIPS_PER_LEVEL } from './facilities'
import { addGains, NO_GAIN, sessionCard, sessionCuts, sessionGain, sessionScaleAt, type Gain } from './session'

/** What the build reads beside the career: her template, the cards and her bond tracks. */
export interface BuildView {
  readonly uma: Pick<UmaTemplate, 'baseStats' | 'growthRates'>
  readonly cards: ReadonlyMap<string, SupportCardTemplate>
  readonly bonds: Readonly<Record<string, BondRecord>>
}

/** A Camp node: four level-5 sessions in the branch the owner picks. */
export const CAMP_SESSIONS = 4
export const CAMP_LEVEL = FACILITY_LEVELS
/** Camps open once any branch reaches level 3: its first two levels full. */
export const CAMP_OPENS_AT_LEVEL = 3

/** A deck card as the rules read it. */
export interface PostedCard {
  readonly id: string
  readonly card: SupportCardTemplate
  readonly branch: Branch
  readonly bond: number
}

export interface DeckRead {
  readonly posted: readonly PostedCard[]
  readonly facts: DeckFacts
}

/** Sessions bought in a branch: its pips and its Camp sessions. */
export const sessionsIn = (career: Pick<CareerRecord, 'pips' | 'camps'>, branch: Branch): number =>
  career.pips[branch] + CAMP_SESSIONS * career.camps.filter((camp) => camp === branch).length

/** The deck read once: each card's template, branch and bond, and the deck's facts. Cards missing from content drop out. */
export function readDeck(career: CareerRecord, view: Pick<BuildView, 'cards' | 'bonds'>): DeckRead {
  const tier = tierOf(career.T)
  const cards = career.deck.flatMap((id) => {
    const card = view.cards.get(id)
    return card === undefined ? [] : [{ id, card }]
  })
  const deckWide = deckWideTerms(cards.map(({ card }) => card))
  const lone: DeckFacts = { types: [], bondTotal: 0, combinedLevel: 5, deckWide }
  const posted = cards.map(({ id, card }): PostedCard => ({
    id, card, branch: postOf(career, id, card), bond: bondValue(view.bonds[bondId(career.umaId, tier, id)], card, lone),
  }))
  const facts: DeckFacts = {
    types: posted.map(({ card }) => card.type),
    bondTotal: posted.reduce((sum, { bond }) => sum + bond, 0),
    combinedLevel: BRANCHES.reduce((sum, branch) => sum + branchLevel(career.pips[branch]), 0),
    deckWide,
  }
  return { posted, facts }
}

function situations(career: CareerRecord, read: DeckRead, branch: Branch, level: number): { card: SupportCardTemplate; at: CardSituation }[] {
  const here = read.posted.filter((entry) => entry.branch === branch)
  const friendshipPip = here.some((entry) => inFriendship(entry.card, branch, entry.bond))
  const sessions = sessionsIn(career, branch)
  return here.map(({ card, bond }) => ({
    card,
    at: { branch, bond, level, present: here.length, friendshipPip, sessions, deck: read.facts },
  }))
}

/** One session's gain at a branch and level, from the current deck. */
export function branchGain(career: CareerRecord, view: BuildView, branch: Branch, level: number, read = readDeck(career, view)): Gain {
  return sessionGain({
    base: facilityRow(branch, level),
    cards: situations(career, read, branch, level).map(({ card, at }) => sessionCard(card, at)),
    growth: view.uma.growthRates,
    scale: sessionScaleAt(career.T),
  })
}

/** One session's drill cost at a branch and level, after its cards' cuts. */
export function branchCost(career: CareerRecord, view: Pick<BuildView, 'cards' | 'bonds'>, branch: Branch, level: number, read = readDeck(career, view)): number {
  const { energyCut, recovery } = sessionCuts(situations(career, read, branch, level), branch)
  return pipCost(level, energyCut, recovery)
}

/** Every bought session's gain: the pips at their levels and the Camps at level 5. */
export function treeGain(career: CareerRecord, view: BuildView, read = readDeck(career, view)): Gain {
  let total: Gain = NO_GAIN
  for (const branch of BRANCHES) {
    for (let level = 1; level <= FACILITY_LEVELS; level++) {
      const count = Math.min(PIPS_PER_LEVEL, Math.max(0, career.pips[branch] - PIPS_PER_LEVEL * (level - 1)))
      if (count > 0) total = addGains(total, branchGain(career, view, branch, level, read), count)
    }
  }
  for (const camp of career.camps) {
    if (camp !== null) total = addGains(total, branchGain(career, view, camp, CAMP_LEVEL, read), CAMP_SESSIONS)
  }
  return total
}

/** The deck's Initial stats (once per deck card, with the per-card unique 105) and Initial Skill Points. */
export function deckInitials(read: DeckRead): { readonly stats: Stats; readonly sp: number } {
  const stats = zeroStats()
  let sp = 0
  for (const { card } of read.posted) {
    const effects = staticEffects(card, read.facts)
    for (const stat of STATS) stats[stat] += amountOf(effects, INITIAL_STAT[stat])
    sp += amountOf(effects, EFFECT.initialSp)
  }
  return { stats, sp }
}

/** What her tracks for the career's tier have given beyond skills: stat and SP hint rewards. */
export function hintRewards(career: Pick<CareerRecord, 'umaId' | 'T'>, view: Pick<BuildView, 'cards' | 'bonds'>): { readonly stats: Stats; readonly sp: number } {
  const stats = zeroStats()
  let sp = 0
  for (const track of tracksOf(view.bonds, career.umaId, tierOf(career.T))) {
    const card = view.cards.get(track.cardId)
    if (card === undefined) continue
    const gifts = trackGifts(track, card)
    for (const stat of STATS) stats[stat] += gifts.stats[stat]
    sp += gifts.sp
  }
  return { stats, sp }
}

/** Her stats before the caps, by part, and their sum. */
export interface StatParts {
  readonly base: Stats
  readonly initial: Stats
  readonly tree: Stats
  readonly hints: Stats
  readonly total: Stats
}

export function statParts(career: CareerRecord, view: BuildView, read = readDeck(career, view)): StatParts {
  const base = { ...view.uma.baseStats }
  const initial = deckInitials(read).stats
  const tree = treeGain(career, view, read).stats
  const hints = hintRewards(career, view).stats
  const total = Object.fromEntries(STATS.map((stat) => [stat, base[stat] + initial[stat] + tree[stat] + hints[stat]])) as unknown as Stats
  return { base, initial, tree, hints, total }
}

/** SP the career has earned: the wallet's (stages and races), the tree's, the deck's Initial SP and the hint rewards. */
export function spEarned(career: CareerRecord, view: BuildView, read = readDeck(career, view)): number {
  return career.wallet.sp + treeGain(career, view, read).sp + deckInitials(read).sp + hintRewards(career, view).sp
}

export const gainDelta = (after: Gain, before: Gain): Gain => addGains(after, before, -1)
