// `sim:decks` (docs/game/05-the-build.md "Keeping it balanced", D382): a full tree of sessions with an empty deck, a
// median bonded deck and a strong bonded deck, and each one's share of the scenario's cap budget. The private pack's
// cards when present (scripts/sim/decks.ts), or the invented cards below in CI. Reports aggregates only: no card id or
// value. Pure.
import type { SupportCardTemplate, SupportCardType } from '../content'
import { BOND_MAX, bondId, type BondRecord, type CareerRecord } from '../save/records'
import { isRefusal } from '../save/registry'
import { tierOf } from '../tiers/map'
import { capBudgetAt, capProfileAt } from '../tiers/scaling'
import { STATS, zeroStats, type StatKey, type Stats } from '../types'
import { pourBond } from './bond'
import { withDeck } from './deck'
import { statParts, type BuildView } from './derive'
import { EFFECT, INITIAL_STAT, STAT_BONUS, UNIQUE } from './effects'
import { cardPower, powerScale } from './power'
import { careerStats } from './racing-build'

/** The bands the sim holds (M036, D382): a median bonded deck at 55–77% of the cap budget, a strong one at 70–90%. */
export const DECK_BANDS = Object.freeze({
  median: Object.freeze({ min: 0.55, max: 0.77 }),
  strong: Object.freeze({ min: 0.7, max: 0.9 }),
})
/** A full tree: five branches of 20 pips (Camps aside). */
export const SIM_PIPS = 20

export interface SimUma {
  readonly baseStats: Stats
  readonly growthRates: Stats
}

const byPower = (a: SupportCardTemplate, b: SupportCardTemplate): number =>
  cardPower(b) - cardPower(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/**
 * The decks the sim runs, from the cards scenario T allows. **Median:** each stat type's median card by power, and the
 * median Friend or Group card (a second median Speed card when there is none). **Strong:** each stat type's strongest
 * card, and the strongest stat card left.
 */
export function pickDecks(cards: readonly SupportCardTemplate[], T: number): { median: SupportCardTemplate[]; strong: SupportCardTemplate[] } {
  const allowed = cards.filter((card) => card.era <= T)
  const ofType = (type: SupportCardType) => allowed.filter((card) => card.type === type).sort(byPower)
  const median: SupportCardTemplate[] = []
  const strong: SupportCardTemplate[] = []
  for (const stat of STATS) {
    const list = ofType(stat)
    if (list.length === 0) continue
    median.push(list[Math.floor((list.length - 1) / 2)]!)
    strong.push(list[0]!)
  }
  const supports = allowed.filter((card) => powerScale(card) === 'support').sort(byPower)
  const sixth = supports[Math.floor((supports.length - 1) / 2)]
    ?? ofType('speed').find((card) => !median.includes(card))
  if (sixth !== undefined) median.push(sixth)
  const extra = allowed.filter((card) => powerScale(card) === 'stat' && !strong.includes(card)).sort(byPower)[0]
  if (extra !== undefined) strong.push(extra)
  return { median, strong }
}

/** Her career with every pip bought, the deck at its default posts, and (bonded) every track poured to 100. */
export function fullTree(deck: readonly SupportCardTemplate[], T: number, bonded: boolean): { career: CareerRecord; bonds: Record<string, BondRecord>; cards: ReadonlyMap<string, SupportCardTemplate> } {
  const cards = new Map(deck.map((card) => [card.id, card]))
  const empty: CareerRecord = {
    umaId: 'sim-uma', T, startedAt: 0, season: 0, objectives: [], finale: { step: 0, won: false },
    deck: [], posts: {}, pips: { speed: SIM_PIPS, stamina: SIM_PIPS, power: SIM_PIPS, guts: SIM_PIPS, wit: SIM_PIPS },
    camps: [null, null], skills: [], spSpent: 0, wallet: { drills: zeroStats(), bond: 0, sp: 0 }, completedAt: null, racingBuild: null,
  }
  let career = withDeck(empty, deck.map((card) => card.id), cards)
  const bonds: Record<string, BondRecord> = {}
  if (bonded) {
    for (const card of deck) {
      const poured = pourBond({ ...career, wallet: { ...career.wallet, bond: BOND_MAX * 10 } }, bonds, cards, card.id, BOND_MAX * 10)
      if (isRefusal(poured)) throw new Error(poured.reason)
      bonds[bondId(career.umaId, tierOf(T), card.id)] = poured.track
    }
    career = { ...career, wallet: { ...career.wallet, bond: 0 } }
  }
  return { career, bonds, cards }
}

export interface DeckRun {
  /** Σ capped stats ÷ the cap budget. */
  readonly share: number
  /** Stats at or over their cap. */
  readonly capped: number
  readonly stats: Stats
}

/** One Uma's full tree with a deck. */
export function runDeck(deck: readonly SupportCardTemplate[], uma: SimUma, T: number, bonded: boolean): DeckRun {
  const { career, bonds, cards } = fullTree(deck, T, bonded)
  const view: BuildView = { uma, cards, bonds }
  const stats = careerStats(career, view)
  const total = statParts(career, view).total
  const caps = capProfileAt(T)
  return {
    share: STATS.reduce((sum, stat) => sum + stats[stat], 0) / capBudgetAt(T),
    capped: STATS.filter((stat) => total[stat] >= caps[stat]).length,
    stats,
  }
}

export interface DeckLine {
  readonly label: 'empty' | 'median' | 'strong'
  readonly mean: number
  readonly min: number
  readonly max: number
  /** Mean stats at cap. */
  readonly cappedMean: number
  /** Umas whose every stat capped. */
  readonly allCapped: number
}

export interface DeckSimReport {
  readonly T: number
  readonly umas: number
  readonly cards: number
  readonly lines: readonly DeckLine[]
  readonly failures: readonly string[]
}

/** Runs the three decks for every Uma at scenario T, and checks the bands. */
export function simulateDecks(cards: readonly SupportCardTemplate[], umas: readonly SimUma[], T: number): DeckSimReport {
  if (umas.length === 0) throw new RangeError('The deck sim needs an Uma')
  const { median, strong } = pickDecks(cards, T)
  const decks = [['empty', [], false], ['median', median, true], ['strong', strong, true]] as const
  const lines = decks.map(([label, deck, bonded]): DeckLine => {
    const runs = umas.map((uma) => runDeck(deck, uma, T, bonded))
    const shares = runs.map((run) => run.share)
    return {
      label,
      mean: shares.reduce((sum, share) => sum + share, 0) / shares.length,
      min: Math.min(...shares),
      max: Math.max(...shares),
      cappedMean: runs.reduce((sum, run) => sum + run.capped, 0) / runs.length,
      allCapped: runs.filter((run) => run.capped === STATS.length).length,
    }
  })
  const failures: string[] = []
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`
  for (const line of lines) {
    if (line.allCapped > 0) failures.push(`The ${line.label} deck caps all five stats for ${line.allCapped} Uma(s)`)
    const band = line.label === 'empty' ? null : DECK_BANDS[line.label]
    if (band !== null && (line.mean < band.min || line.mean > band.max)) {
      failures.push(`The ${line.label} deck reaches ${pct(line.mean)}, outside ${pct(band.min)}–${pct(band.max)}`)
    }
  }
  if (median.length < 6 || strong.length < 6) failures.push(`Scenario ${T} allows too few cards for full decks`)
  return { T, umas: umas.length, cards: cards.filter((card) => card.era <= T).length, lines, failures }
}

// --- Invented cards and Umas for CI -----------------------------------------------------------------------------------
// Made-up numbers on a formula, shaped like the original's SSRs (05 §1's field shapes); never a real card's values.

function syntheticCard(type: SupportCardType, q: number): SupportCardTemplate {
  const stat = (STATS as readonly string[]).includes(type) ? type as StatKey : null
  const effects: Record<number, number> = {
    [EFFECT.friendship]: stat === null ? 0 : 14 + 3 * q,
    [EFFECT.mood]: 10 + 5 * q,
    [EFFECT.effectiveness]: 2 + 2 * q,
    [EFFECT.initialBond]: 12 + 5 * q,
    [EFFECT.raceBonus]: 3 + q,
    [EFFECT.hintLevels]: 1 + Math.floor(q / 2),
    [EFFECT.hintFrequency]: 15 + 10 * q,
    19: 25 + 15 * q, // Specialty Priority: shown, dropped
  }
  if (stat !== null) {
    effects[STAT_BONUS[stat]] = 1
    effects[INITIAL_STAT[stat]] = 14 + 4 * q
  } else {
    effects[EFFECT.spBonus] = 1
  }
  if (q >= 2) effects[EFFECT.spBonus] = (effects[EFFECT.spBonus] ?? 0) + 1
  for (const id of Object.keys(effects).map(Number)) if (effects[id] === 0) delete effects[id]
  const hintStat = stat === null ? 1 : STATS.indexOf(stat) + 1
  return {
    id: `sim-${type}-${q}`, charaId: `sim-${type}`, charName: `Sim ${type}`, title: `[Sim ${type} ${q}]`, type,
    jpRelease: '2021-02-24', era: 1, obtain: 'gacha', starter: false,
    hintSkillIds: [`sim-skill-${type}-1`, `sim-skill-${type}-2`, `sim-skill-${type}-3`],
    hintOthers: [{ type: hintStat, value: 2 + q, minLevel: null }, { type: 30, value: 2, minLevel: null }],
    eventSkillIds: [`sim-event-${type}`],
    effects,
    uniqueEffect: q >= 1 ? {
      level: 30, description: null,
      effects: [{ type: UNIQUE.bond, value: 80, params: stat === null ? [EFFECT.effectiveness, 2 + q] : [EFFECT.friendship, 2 + q] }],
    } : null,
  }
}

/** Invented SSRs: five per stat type at qualities 0–4, and three Friend cards. */
export function syntheticCards(): SupportCardTemplate[] {
  return [
    ...STATS.flatMap((stat) => [0, 1, 2, 3, 4].map((q) => syntheticCard(stat, q))),
    ...[0, 2, 4].map((q) => syntheticCard('friend', q)),
  ]
}

const stats = (speed: number, stamina: number, power: number, guts: number, wit: number): Stats => ({ speed, stamina, power, guts, wit })

/** Invented Umas: star-5 bases near 100 and growth rates summing to 30%. */
export function syntheticUmas(): SimUma[] {
  return [
    { baseStats: stats(105, 90, 100, 95, 110), growthRates: stats(0.2, 0, 0.1, 0, 0) },
    { baseStats: stats(95, 110, 95, 100, 100), growthRates: stats(0, 0.2, 0, 0.1, 0) },
    { baseStats: stats(100, 95, 105, 100, 100), growthRates: stats(0.1, 0, 0.1, 0, 0.1) },
  ]
}
