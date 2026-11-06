// `sim:careers` (docs/game/12-pacing.md, D383, D391): every Uma's URA Finale career, played once at grade A by a fixed
// allocation bot, with a median and a strong bonded deck (`pickDecks`). Each season pays one play of its main game
// (`CAREER_GAMES`' first, Furlong Hand) at A, the one bundle every game pays, and the bot spends
// everything, and each objective is raced on the real engine, which the caller hands in (the domain never imports
// it). It reports first-try win rates by grade and URA Finals round, the pacing (tree, bonds, skills, SP), and the
// typical career's average stat at each season, which the rivals' season shares are set from. Reports aggregates only:
// no Uma, card, skill or race id. Pure.
//
// The bot, every season after its stage pays:
// - the drills split as Furlong Hand's do, by the colours she runs: the sim's model is the race's cards, three base
//   strides a colour and each deck card's three strides and Partner in its type's colour, Friend and Group cards' in
//   the season's focus;
// - Bond: into the deck card nearest to 80, stat cards first, then on to 100;
// - pips: each branch buys its next pip while its colour pays for it; a full branch's colour buys a Camp there;
// - skills: golds first (with the white beneath), then the cheapest, while SP pays;
// - each objective is raced `attempts` times from attempt 0, every one a first try's draw; retries being free, the
//   career then goes on as if it was won, and its reward is paid. The URA Finals' rounds run the same way.
import type { CourseTemplate, RaceTemplate, SkillTemplate, SupportCardTemplate, UmaTemplate } from '../content'
import { bondToFill, extraBond, pourBond } from '../build/bond'
import { withDeck } from '../build/deck'
import { pickDecks } from '../build/decks'
import { CAMP_SESSIONS, deckInitials, hintRewards, readDeck, sessionsIn, treeGain, type BuildView } from '../build/derive'
import { FRIENDSHIP_BOND } from '../build/effects'
import { careerStats, deriveRacingBuild } from '../build/racing-build'
import { buySkill, skillCost, skillLibrary, skillPoints } from '../build/skills'
import { buyCamp, buyPips } from '../build/tree'
import { STAT_BONUS_SOURCE_IDS } from '../cards'
import type { RaceEngine } from '../race-attempt'
import { skillChainBelow } from '../race-skills'
import { isRefusal } from '../save/registry'
import { BOND_MAX, BRANCHES, FINALE_RACES, FINALE_SEASON, PIPS_PER_BRANCH, SEASONS, bondId, type BondRecord, type CareerRecord } from '../save/records'
import { STATS, type StatKey, type Stats } from '../types'
import { FINALE_ROUNDS, finaleRace, finaleSpec, settleFinale } from './finale'
import { STAGE_PAY_AT_A } from './pay'
import { objectiveSpec, prepareCareerRace, runPrepared, type PreparedRace, type RaceContent, type RaceSpec } from './races'
import { objectiveReward } from './rewards'
import { seasonFocus, seasonObjectives } from './season'
import { newCareer } from './start'

interface Band {
  readonly min: number
  readonly max: number
}

export interface CareerTargets {
  /** First-try win rates with a median deck, at least; null checks only that each race is sometimes won and lost. */
  readonly median: Readonly<Record<'g3' | 'g2' | 'g1', number>> | null
  /** The URA Finals final with a median deck. */
  readonly final: Band | null
  /** The tree's share of sessions bought by a career played once at A. */
  readonly tree: Band
  /** Deck cards at bond 80 or more at the end. */
  readonly bonded: Band
  /** SP earned, counted in golds with their whites at the content's median price. */
  readonly goldSkills: Band
  /** The tree's share with one replay of each season's play, at least. */
  readonly replayTree: number
}

/** The targets on the private pack (M036 "Rivals" and "The targets", D383). */
export const CAREER_TARGETS: CareerTargets = Object.freeze({
  median: Object.freeze({ g3: 0.9, g2: 0.75, g1: 0.5 }),
  final: Object.freeze({ min: 0.4, max: 0.6 }),
  tree: Object.freeze({ min: 0.55, max: 0.65 }),
  bonded: Object.freeze({ min: 2.5, max: 3.5 }),
  goldSkills: Object.freeze({ min: 4, max: 6 }),
  replayTree: 0.95,
})

/**
 * The targets on the invented content CI runs: its cards are weaker than the pack the rivals are tuned on, and start at
 * lower bonds, so the rates are only checked for sense and the pacing bands are wider.
 */
export const INVENTED_TARGETS: CareerTargets = Object.freeze({
  median: null,
  final: null,
  tree: Object.freeze({ min: 0.45, max: 0.75 }),
  bonded: Object.freeze({ min: 1.5, max: 4.5 }),
  goldSkills: Object.freeze({ min: 3, max: 7 }),
  replayTree: 0.9,
})

/** The sim's model of Furlong Hand's cards: three base strides a colour, and each deck card's three strides and Partner. */
export const SIM_BASE_CARDS = 3
export const SIM_CARD_CARDS = 4
/** A tree's sessions: five branches of 20 pips and two Camps of four. */
export const TREE_SESSIONS = BRANCHES.length * PIPS_PER_BRANCH + 2 * CAMP_SESSIONS

export interface CareerSimContent {
  readonly umas: readonly UmaTemplate[]
  readonly cards: readonly SupportCardTemplate[]
  readonly skills: readonly SkillTemplate[]
  readonly races: readonly RaceTemplate[]
  readonly courses: readonly CourseTemplate[]
  readonly contentVersion: string
}

export interface CareerSimOptions {
  readonly T?: number
  /** Races per objective and per URA Finals round. */
  readonly attempts: number
  /** Without an engine, only the pacing runs. */
  readonly race?: RaceEngine
  /** Also plays the median deck's careers with one replay of each season's play (no races), for the tree. */
  readonly replay?: boolean
  /** Plays only the first n Umas' careers (every Uma still races as a rival). */
  readonly sample?: number
  /** Called with every race the sim runs, for a closer look. */
  readonly onRace?: (race: SimRace) => void
  /** The targets to hold: `CAREER_TARGETS` (the default, for the private pack) or `INVENTED_TARGETS`. */
  readonly targets?: CareerTargets
}

/** One race the sim ran. */
export interface SimRace {
  readonly deck: 'median' | 'strong'
  readonly key: TallyKey
  readonly season: number
  readonly prepared: PreparedRace
  readonly placement: number
}

export interface Tally {
  wins: number
  races: number
}

export type TallyKey = 'g3' | 'g2' | 'g1' | 'qualifier' | 'semifinal' | 'final'

/** Where a career's SP came from: stages and races (the wallet), the tree's sessions, the deck's Initial SP, hints. */
export interface SpParts {
  readonly wallet: number
  readonly tree: number
  readonly deck: number
  readonly hints: number
}

export interface DeckCareers {
  readonly label: 'median' | 'strong'
  readonly careers: number
  /** First tries by objective grade, then by URA Finals round. */
  readonly rates: Readonly<Record<TallyKey, Tally>>
  /** Means over careers, at the end. */
  readonly tree: number
  readonly bonded: number
  /** Racing skills the bot bought (a gold and its white once). */
  readonly skills: number
  readonly spEarned: number
  readonly spParts: SpParts
  /** SP earned in golds with their whites (`goldPairPrice`). */
  readonly goldSkills: number
  /** The career's average stat when it races, by season 0–12 (the Finale), averaged over careers. */
  readonly curve: readonly number[]
  /** The tree's share with one replay of each season's play, when run. */
  readonly replayTree: number | null
}

export interface CareerSimReport {
  readonly T: number
  readonly umas: number
  /** A gold with its white at hint level 1, the content's median. */
  readonly goldPairPrice: number
  readonly decks: readonly DeckCareers[]
  readonly failures: readonly string[]
}

const rate = (tally: Tally): number => (tally.races === 0 ? 0 : tally.wins / tally.races)
/** A tally's win rate. */
export const tallyRate = rate
const mean = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
const meanStat = (stats: Stats): number => STATS.reduce((sum, stat) => sum + stats[stat], 0) / STATS.length

/**
 * The sim's model of a Furlong Hand play's drills: `total` split by the race's cards in each colour (`SIM_BASE_CARDS`,
 * and `SIM_CARD_CARDS` a deck card in its type's colour, a Friend or Group card's in the focus), largest remainders.
 */
export function mainGameDrills(total: number, deck: readonly Pick<SupportCardTemplate, 'type'>[], focus: StatKey): Stats {
  const colourOf = (type: string): StatKey => ((STATS as readonly string[]).includes(type) ? type as StatKey : focus)
  const weights = STATS.map((stat) => SIM_BASE_CARDS + SIM_CARD_CARDS * deck.filter((card) => colourOf(card.type) === stat).length)
  const sum = weights.reduce((a, b) => a + b, 0)
  const exact = weights.map((weight) => (total * weight) / sum)
  const floors = exact.map(Math.floor)
  let left = total - floors.reduce((a, b) => a + b, 0)
  const order = exact.map((value, i) => ({ i, rest: value - floors[i]! })).sort((a, b) => b.rest - a.rest || a.i - b.i)
  for (const { i } of order) if (left-- > 0) floors[i]! += 1
  return Object.fromEntries(STATS.map((stat, i) => [stat, floors[i]!])) as unknown as Stats
}

/** The skills she races with beside her unique: what she bought, a chain once (a gold races in place of its white). */
export function racingSkillCount(bought: readonly string[], skills: ReadonlyMap<string, SkillTemplate>): number {
  const below = new Set(bought.flatMap((id) => {
    const skill = skills.get(id)
    return skill === undefined ? [] : skillChainBelow(skill, skills).map((lower) => lower.id)
  }))
  return bought.filter((id) => !below.has(id)).length
}

/** A gold with its white, both at hint level 1, at the content's median: the price the SP target counts in. */
export function goldPairPrice(skills: readonly SkillTemplate[]): number {
  const byId = new Map(skills.map((skill) => [skill.id, skill]))
  const prices = skills.flatMap((skill) => {
    const white = skill.kind === 'gold' && skill.normalSkillId !== null ? byId.get(skill.normalSkillId) : undefined
    const gold = skillCost(skill, 1)
    const lower = white === undefined ? null : skillCost(white, 1)
    return white === undefined || gold === null || lower === null ? [] : [gold + lower]
  }).sort((a, b) => a - b)
  if (prices.length === 0) throw new RangeError('The content holds no gold skill with its white')
  return prices[Math.floor((prices.length - 1) / 2)]!
}

interface Bot {
  career: CareerRecord
  bonds: Record<string, BondRecord>
}

/** The season's play pays the bundle at grade A, `plays` times over, its drills split by the deck's colours. */
function pay(bot: Bot, cards: ReadonlyMap<string, SupportCardTemplate>, plays: number): void {
  const at = STAGE_PAY_AT_A
  const wallet = bot.career.wallet
  const deck = bot.career.deck.flatMap((id) => cards.get(id) ?? [])
  const drills = mainGameDrills(at.drills * plays, deck, seasonFocus(bot.career.season))
  bot.career = {
    ...bot.career,
    wallet: {
      drills: Object.fromEntries(STATS.map((stat) => [stat, wallet.drills[stat] + drills[stat]])) as unknown as Stats,
      bond: wallet.bond + at.bond * plays,
      sp: wallet.sp + at.sp * plays,
    },
  }
}

const STAT_TYPES = new Set(Object.keys(STAT_BONUS_SOURCE_IDS))

function spendBond(bot: Bot, cards: ReadonlyMap<string, SupportCardTemplate>): void {
  while (bot.career.wallet.bond > 0) {
    const posted = readDeck(bot.career, { cards, bonds: bot.bonds }).posted
    const below80 = posted.filter((entry) => entry.bond < FRIENDSHIP_BOND)
    const pool = below80.length > 0 ? below80 : posted.filter((entry) => entry.bond < BOND_MAX)
    if (pool.length === 0) return
    const target = below80.length > 0 ? FRIENDSHIP_BOND : BOND_MAX
    const pick = [...pool].sort((a, b) => Number(STAT_TYPES.has(b.card.type)) - Number(STAT_TYPES.has(a.card.type)) || b.bond - a.bond)[0]!
    const amount = Math.min(bot.career.wallet.bond, Math.max(1, bondToFill(target - pick.bond, extraBond(bot.career, pick.id, cards))))
    const poured = pourBond(bot.career, bot.bonds, cards, pick.id, amount)
    if (isRefusal(poured)) return
    bot.career = poured.career
    bot.bonds[bondId(poured.track.umaId, poured.track.tier, poured.track.cardId)] = poured.track
  }
}

function spendDrills(bot: Bot, view: BuildView): void {
  for (const branch of BRANCHES) {
    for (;;) {
      const bought = buyPips(bot.career, view, branch, 1)
      if (isRefusal(bought)) break
      bot.career = bought.career
    }
    if (bot.career.pips[branch] === PIPS_PER_BRANCH) {
      const camp = buyCamp(bot.career, view, branch)
      if (!isRefusal(camp)) bot.career = camp.career
    }
  }
}

/** Golds first (the white beneath bought first when it isn't yet), then the cheapest, while SP pays. */
function spendSp(bot: Bot, uma: UmaTemplate, view: BuildView, skills: ReadonlyMap<string, SkillTemplate>): void {
  for (;;) {
    const library = skillLibrary(bot.career, uma, view.cards, bot.bonds, skills).filter((entry) => !bot.career.skills.includes(entry.skillId))
    const costOf = new Map(library.map((entry) => [entry.skillId, skillCost(skills.get(entry.skillId)!, entry.hintLevel)]))
    const options = library.flatMap((entry) => {
      const skill = skills.get(entry.skillId)!
      const cost = costOf.get(entry.skillId) ?? null
      const lower = skill.normalSkillId !== null && !bot.career.skills.includes(skill.normalSkillId) ? skill.normalSkillId : null
      const lowerCost = lower === null ? 0 : costOf.get(lower) ?? null
      if (cost === null || lowerCost === null) return []
      return [{ ids: lower === null ? [entry.skillId] : [lower, entry.skillId], total: cost + lowerCost, gold: skill.kind === 'gold', id: entry.skillId }]
    }).sort((a, b) => Number(b.gold) - Number(a.gold) || a.total - b.total || (a.id < b.id ? -1 : 1))
    const available = skillPoints(bot.career, view).available
    let bought = false
    for (const option of options) {
      if (option.total > available) continue
      let career: CareerRecord | null = bot.career
      for (const id of option.ids) {
        const result = buySkill(career, view, uma, skills, id)
        if (isRefusal(result)) { career = null; break }
        career = result.career
      }
      if (career !== null) {
        bot.career = career
        bought = true
        break
      }
    }
    if (!bought) return
  }
}

function spend(bot: Bot, uma: UmaTemplate, content: RaceContent): void {
  spendBond(bot, content.cards)
  const view: BuildView = { uma, cards: content.cards, bonds: bot.bonds }
  spendDrills(bot, view)
  spendSp(bot, uma, view, content.skills)
}

const emptyTallies = (): Record<TallyKey, Tally> => ({
  g3: { wins: 0, races: 0 }, g2: { wins: 0, races: 0 }, g1: { wins: 0, races: 0 },
  qualifier: { wins: 0, races: 0 }, semifinal: { wins: 0, races: 0 }, final: { wins: 0, races: 0 },
})

interface OneCareer {
  readonly tree: number
  readonly bonded: number
  readonly skills: number
  readonly spEarned: number
  readonly spParts: SpParts
  readonly curve: readonly number[]
}

type SimContent = RaceContent & { readonly races: readonly RaceTemplate[] }

/** One Uma's career with a deck: the bot's choices, and the races when an engine is given. */
function playCareer(uma: UmaTemplate, deck: { readonly label: 'median' | 'strong'; readonly cards: readonly SupportCardTemplate[] }, content: SimContent,
  contentVersion: string, options: CareerSimOptions, tallies: Record<TallyKey, Tally>, plays = 1): OneCareer {
  const bot: Bot = { career: withDeck(newCareer(uma, options.T ?? 1, content.races, 0), deck.cards.map((card) => card.id), content.cards), bonds: {} }
  const curve: number[] = []
  const statsNow = () => meanStat(careerStats(bot.career, { uma, cards: content.cards, bonds: bot.bonds }))
  const race = (key: TallyKey, spec: RaceSpec) => {
    for (let attempt = 0; options.race !== undefined && attempt < options.attempts; attempt++) {
      const prepared = prepareCareerRace(bot.career, spec, { attempt }, bot.bonds, content, contentVersion)
      const { placement } = runPrepared(prepared, options.race)
      tallies[key].races += 1
      if (placement === 1) tallies[key].wins += 1
      options.onRace?.({ deck: deck.label, key, season: bot.career.season, prepared, placement })
    }
  }
  for (let season = 0; season < SEASONS; season++) {
    pay(bot, content.cards, plays)
    spend(bot, uma, content)
    curve.push(statsNow())
    for (const objective of seasonObjectives(bot.career)) {
      const template = content.races.find((entry) => entry.id === objective.raceId)!
      race(template.grade === 'g3' || template.grade === 'g2' ? template.grade : 'g1', objectiveSpec(objective, template))
      const reward = objectiveReward(objective.stage, bot.career.deck, content.cards)
      bot.career = {
        ...bot.career,
        objectives: bot.career.objectives.map((entry) => (entry.raceId === objective.raceId ? { ...entry, status: 'won', wonAt: 0 } : entry)),
        wallet: { ...bot.career.wallet, sp: bot.career.wallet.sp + reward.sp },
      }
    }
    bot.career = { ...bot.career, season: season + 1 }
  }
  // The Finale: its prep heat, then the three rounds.
  pay(bot, content.cards, 1)
  spend(bot, uma, content)
  curve.push(statsNow())
  const finale = finaleRace(uma, bot.career, content.races)
  for (let round = 0; round < FINALE_RACES; round++) {
    race(FINALE_ROUNDS[round]!, finaleSpec(finale, round))
    bot.career = settleFinale(bot.career, 1, 0, deriveRacingBuild(bot.career, uma, content.cards, bot.bonds)).career
  }
  const view: BuildView = { uma, cards: content.cards, bonds: bot.bonds }
  return {
    tree: BRANCHES.reduce((sum, branch) => sum + sessionsIn(bot.career, branch), 0) / TREE_SESSIONS,
    bonded: readDeck(bot.career, view).posted.filter((entry) => entry.bond >= FRIENDSHIP_BOND).length,
    skills: racingSkillCount(bot.career.skills, content.skills),
    spEarned: skillPoints(bot.career, view).earned,
    spParts: {
      wallet: bot.career.wallet.sp, tree: treeGain(bot.career, view).sp, deck: deckInitials(readDeck(bot.career, view)).sp,
      hints: hintRewards(bot.career, view).sp,
    },
    curve,
  }
}

/** Every Uma's career at T with the median and the strong deck, and the targets checked. */
export function simulateCareers(content: CareerSimContent, options: CareerSimOptions): CareerSimReport {
  const T = options.T ?? 1
  if (content.umas.length === 0) throw new RangeError('The career sim needs an Uma')
  const maps: SimContent = {
    umas: new Map(content.umas.map((uma) => [uma.id, uma])),
    cards: new Map(content.cards.map((card) => [card.id, card])),
    skills: new Map(content.skills.map((skill) => [skill.id, skill])),
    courses: new Map(content.courses.map((course) => [course.id, course])),
    races: content.races,
  }
  const pairPrice = goldPairPrice(content.skills)
  const { median, strong } = pickDecks(content.cards, T)
  const players = options.sample === undefined ? content.umas : content.umas.slice(0, options.sample)
  const decks = ([['median', median], ['strong', strong]] as const).map(([label, deck]): DeckCareers => {
    const tallies = emptyTallies()
    const runs = players.map((uma) => playCareer(uma, { label, cards: deck }, maps, content.contentVersion, options, tallies))
    const replay = label === 'median' && options.replay === true
      ? players.map((uma) => playCareer(uma, { label, cards: deck }, maps, content.contentVersion, { attempts: 0, T }, emptyTallies(), 2))
      : null
    const spEarned = mean(runs.map((run) => run.spEarned))
    return {
      label, careers: runs.length, rates: tallies,
      tree: mean(runs.map((run) => run.tree)),
      bonded: mean(runs.map((run) => run.bonded)),
      skills: mean(runs.map((run) => run.skills)),
      spEarned,
      spParts: {
        wallet: mean(runs.map((run) => run.spParts.wallet)), tree: mean(runs.map((run) => run.spParts.tree)),
        deck: mean(runs.map((run) => run.spParts.deck)), hints: mean(runs.map((run) => run.spParts.hints)),
      },
      goldSkills: spEarned / pairPrice,
      curve: Array.from({ length: FINALE_SEASON + 1 }, (_, season) => mean(runs.map((run) => run.curve[season]!))),
      replayTree: replay === null ? null : mean(replay.map((run) => run.tree)),
    }
  })
  const raced = options.race !== undefined && options.attempts > 0
  return { T, umas: players.length, goldPairPrice: pairPrice, decks, failures: careerFailures(decks, options.targets ?? CAREER_TARGETS, raced) }
}

const pct = (n: number): string => `${(n * 100).toFixed(1)}%`
const RATE_KEYS: readonly TallyKey[] = ['g3', 'g2', 'g1', 'qualifier', 'semifinal', 'final']
const totalWins = (deck: DeckCareers): number => RATE_KEYS.reduce((sum, key) => sum + deck.rates[key].wins, 0)

/**
 * The targets a report misses, in plain words. With races: the median deck's rates are held to the targets' (or, when
 * the targets set none, every kind of race must be sometimes won and sometimes lost), and a strong deck must win more
 * races in all than a median one. Then the pacing bands.
 */
export function careerFailures(decks: readonly DeckCareers[], t: CareerTargets, raced: boolean): string[] {
  const failures: string[] = []
  const medianDeck = decks.find((deck) => deck.label === 'median')
  const strongDeck = decks.find((deck) => deck.label === 'strong')
  if (medianDeck === undefined) return ['The sim ran no median deck']
  if (raced && t.median !== null) {
    for (const grade of ['g3', 'g2', 'g1'] as const) {
      const value = rate(medianDeck.rates[grade])
      if (value < t.median[grade]) failures.push(`A median deck wins ${pct(value)} of ${grade.toUpperCase()} first tries, under ${pct(t.median[grade])}`)
    }
  }
  if (raced && t.final !== null) {
    const final = rate(medianDeck.rates.final)
    if (final < t.final.min || final > t.final.max) failures.push(`A median deck wins ${pct(final)} of URA Finals finals, outside ${pct(t.final.min)}–${pct(t.final.max)}`)
  }
  if (raced && t.median === null) {
    for (const key of RATE_KEYS) {
      const value = rate(medianDeck.rates[key])
      if (value <= 0 || value >= 1) failures.push(`A median deck wins ${pct(value)} of its ${key} races`)
    }
  }
  if (raced && strongDeck !== undefined && totalWins(strongDeck) < totalWins(medianDeck)) {
    failures.push(`A strong deck wins ${totalWins(strongDeck)} races to a median deck's ${totalWins(medianDeck)}`)
  }
  if (medianDeck.tree < t.tree.min || medianDeck.tree > t.tree.max) failures.push(`A career played once at A buys ${pct(medianDeck.tree)} of the tree, outside ${pct(t.tree.min)}–${pct(t.tree.max)}`)
  if (medianDeck.bonded < t.bonded.min || medianDeck.bonded > t.bonded.max) failures.push(`It ends with ${medianDeck.bonded.toFixed(1)} cards at bond 80, outside ${t.bonded.min}–${t.bonded.max}`)
  if (medianDeck.goldSkills < t.goldSkills.min || medianDeck.goldSkills > t.goldSkills.max) {
    failures.push(`It earns SP for ${medianDeck.goldSkills.toFixed(1)} golds with their whites, outside ${t.goldSkills.min}–${t.goldSkills.max}`)
  }
  if (medianDeck.replayTree !== null && medianDeck.replayTree < t.replayTree) failures.push(`One replay of each season's play buys ${pct(medianDeck.replayTree)} of the tree, under ${pct(t.replayTree)}`)
  return failures
}
