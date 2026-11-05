// Generation 3's records (docs/tasks/M036-ura-finale-slice.md "The save", D381): the account, what it has unlocked,
// each career and each bond track, and the race results. Every shape every M036 part writes is here, so the parts
// fill in rules without changing the save. Strict parsers in the save's style: exact keys, `T | null`. Pure.
import { CAREER_STAGES, type CareerStage } from '../career-stages'
import { parseRaceRun, type RaceRun } from '../race-attempt'
import { GRADES, STATS, type Aptitudes, type Grade, type StatKey, type Stats } from '../types'
import { LAST_SCENARIO_NUMBER, type Tier } from '../tiers/map'
import { isRowId } from './kinds'

/** A tree branch: one per training facility, named by its stat. */
export type Branch = StatKey
export const BRANCHES: readonly Branch[] = STATS

/** The calendar: 12 seasons (Junior, Classic, Senior × Spring, Summer, Autumn, Winter), then the finale at 12. */
export const SEASONS = 12
export const FINALE_SEASON = SEASONS
/** A deck holds six cards. */
export const DECK_SIZE = 6
/** A branch holds 20 pips: five levels of four sessions. */
export const PIPS_PER_BRANCH = 20
/** Two Camp nodes a tree. */
export const CAMPS = 2
/** The URA Finals: qualifier, semifinal and final. */
export const FINALE_RACES = 3
/** A bond track's top. */
export const BOND_MAX = 100

/** `account/main`. */
export interface AccountRecord {
  readonly createdAt: number
  readonly umaTickets: number
  readonly cardTickets: number
}

/** `umas/{outfitId}` and `cards/{cardId}`: unlocked, and when. */
export interface UnlockRecord {
  readonly unlockedAt: number
}

export interface CareerObjective {
  readonly raceId: string
  readonly stage: CareerStage
  /** The season it falls in, 0–11. */
  readonly season: number
  readonly status: 'open' | 'won'
  readonly wonAt: number | null
}

export interface CareerFinale {
  /** The races won so far: 0–3. */
  readonly step: number
  readonly won: boolean
}

/**
 * What the career has earned from play. Drills and Bond are spent from here. `sp` is only what stages and races pay:
 * the tree's, the deck's and hints' SP are derived, and skills are paid by `spSpent` against the total (D382).
 */
export interface CareerWallet {
  readonly drills: Stats
  readonly bond: number
  readonly sp: number
}

/** A finished career's build, frozen: what she races with for that scenario. */
export interface RacingBuild {
  readonly stats: Stats
  readonly aptitudes: Aptitudes
  readonly skills: readonly string[]
}

/** `careers/{umaId}:{T}`: one Uma's career in scenario T. */
export interface CareerRecord {
  readonly umaId: string
  readonly T: number
  readonly startedAt: number
  /** 0–11, or 12 at the finale. */
  readonly season: number
  readonly objectives: readonly CareerObjective[]
  readonly finale: CareerFinale
  /** Up to six owned card ids. */
  readonly deck: readonly string[]
  /** Each deck card's branch. */
  readonly posts: Readonly<Record<string, Branch>>
  /** Bought pips per branch, 0–20. */
  readonly pips: Readonly<Record<Branch, number>>
  /** Each Camp node's branch, or null while unbought. */
  readonly camps: readonly (Branch | null)[]
  readonly skills: readonly string[]
  readonly spSpent: number
  readonly wallet: CareerWallet
  readonly completedAt: number | null
  readonly racingBuild: RacingBuild | null
}

/** `bonds/{umaId}:{tier}:{cardId}`: one card's bond track with one Uma for a tier. */
export interface BondRecord {
  readonly umaId: string
  readonly tier: Tier
  readonly cardId: string
  /** 0–100. */
  readonly value: number
  /** Hints the track has given so far. */
  readonly hints: number
}

/** `raceResults/{id}`: one race she ran in a career, replayable. */
export interface RaceResultRecord {
  readonly careerId: string
  readonly umaId: string
  readonly raceId: string
  readonly kind: 'objective' | 'finale'
  readonly placement: number
  readonly run: RaceRun
  readonly at: number
}

/** `operations/{id}`: an operation's first receipt, so a retried id never applies twice. */
export interface OperationRecord {
  readonly name: string
  readonly at: number
  readonly receipt: unknown
}

export const careerId = (umaId: string, T: number): string => `${umaId}:${T}`
export const bondId = (umaId: string, tier: Tier, cardId: string): string => `${umaId}:${tier}:${cardId}`

// --- Parsers ---------------------------------------------------------------------------------------------------------

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).filter((key) => value[key] !== undefined)
  // A key holding `undefined` is absent, as JSON reads it; `null` is a present value.
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key) && value[key] !== undefined)
}
const isInt = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number =>
  Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max
const isTime = (value: unknown): value is number => isInt(value, 0)
const isNullableTime = (value: unknown): value is number | null => value === null || isTime(value)
const isBranch = (value: unknown): value is Branch => (STATS as readonly unknown[]).includes(value)

function parseStatsRecord(value: unknown, min = 0): Stats | null {
  if (!isObject(value) || !exact(value, STATS) || STATS.some((stat) => !isInt(value[stat], min))) return null
  return Object.fromEntries(STATS.map((stat) => [stat, value[stat]])) as unknown as Stats
}

function parseAptitudes(value: unknown): Aptitudes | null {
  if (!isObject(value) || !exact(value, ['surface', 'distance', 'strategy'])) return null
  const group = (entry: unknown): Record<string, Grade> | null =>
    isObject(entry) && Object.values(entry).every((grade) => (GRADES as readonly unknown[]).includes(grade))
      ? { ...(entry as Record<string, Grade>) } : null
  const surface = group(value.surface)
  const distance = group(value.distance)
  const strategy = group(value.strategy)
  return surface && distance && strategy ? ({ surface, distance, strategy } as unknown as Aptitudes) : null
}

function parseIdList(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value) || value.length > max || !value.every(isRowId) || new Set(value).size !== value.length) return null
  return [...(value as string[])]
}

export function parseAccountRecord(value: unknown): AccountRecord | null {
  if (!isObject(value) || !exact(value, ['createdAt', 'umaTickets', 'cardTickets'])) return null
  if (!isTime(value.createdAt) || !isInt(value.umaTickets, 0) || !isInt(value.cardTickets, 0)) return null
  return { createdAt: value.createdAt, umaTickets: value.umaTickets, cardTickets: value.cardTickets }
}

export function parseUnlockRecord(value: unknown): UnlockRecord | null {
  if (!isObject(value) || !exact(value, ['unlockedAt']) || !isTime(value.unlockedAt)) return null
  return { unlockedAt: value.unlockedAt }
}

function parseObjective(value: unknown): CareerObjective | null {
  if (!isObject(value) || !exact(value, ['raceId', 'stage', 'season', 'status', 'wonAt'])) return null
  if (!isRowId(value.raceId) || !(CAREER_STAGES as readonly unknown[]).includes(value.stage) || !isInt(value.season, 0, SEASONS - 1)) return null
  if ((value.status !== 'open' && value.status !== 'won') || !isNullableTime(value.wonAt)) return null
  if ((value.status === 'won') !== (value.wonAt !== null)) return null
  return { raceId: value.raceId, stage: value.stage as CareerStage, season: value.season, status: value.status, wonAt: value.wonAt }
}

function parseRacingBuild(value: unknown): RacingBuild | null {
  if (!isObject(value) || !exact(value, ['stats', 'aptitudes', 'skills'])) return null
  const stats = parseStatsRecord(value.stats)
  const aptitudes = parseAptitudes(value.aptitudes)
  const skills = parseIdList(value.skills, 64)
  return stats && aptitudes && skills ? { stats, aptitudes, skills } : null
}

export function parseCareerRecord(value: unknown): CareerRecord | null {
  const keys = ['umaId', 'T', 'startedAt', 'season', 'objectives', 'finale', 'deck', 'posts', 'pips', 'camps', 'skills', 'spSpent',
    'wallet', 'completedAt', 'racingBuild']
  if (!isObject(value) || !exact(value, keys)) return null
  if (!isRowId(value.umaId) || !isInt(value.T, 1, LAST_SCENARIO_NUMBER) || !isTime(value.startedAt) || !isInt(value.season, 0, FINALE_SEASON)) return null
  if (!Array.isArray(value.objectives)) return null
  const objectives = value.objectives.map(parseObjective)
  if (objectives.some((objective) => objective === null)) return null
  const finale = value.finale
  if (!isObject(finale) || !exact(finale, ['step', 'won']) || !isInt(finale.step, 0, FINALE_RACES) || typeof finale.won !== 'boolean' ||
    finale.won !== (finale.step === FINALE_RACES)) return null
  const deck = parseIdList(value.deck, DECK_SIZE)
  if (deck === null || !isObject(value.posts)) return null
  const posts = value.posts
  if (!Object.keys(posts).every((card) => deck.includes(card) && isBranch(posts[card]))) return null
  const pips = parseStatsRecord(value.pips)
  if (pips === null || STATS.some((stat) => pips[stat] > PIPS_PER_BRANCH)) return null
  if (!Array.isArray(value.camps) || value.camps.length !== CAMPS || !value.camps.every((camp) => camp === null || isBranch(camp))) return null
  const skills = parseIdList(value.skills, 64)
  if (skills === null || !isInt(value.spSpent, 0)) return null
  const wallet = value.wallet
  if (!isObject(wallet) || !exact(wallet, ['drills', 'bond', 'sp']) || !isInt(wallet.bond, 0) || !isInt(wallet.sp, 0)) return null
  const drills = parseStatsRecord(wallet.drills)
  if (drills === null || !isNullableTime(value.completedAt)) return null
  const racingBuild = value.racingBuild === null ? null : parseRacingBuild(value.racingBuild)
  if (value.racingBuild !== null && racingBuild === null) return null
  if ((value.completedAt === null) !== (racingBuild === null)) return null
  return {
    umaId: value.umaId, T: value.T, startedAt: value.startedAt, season: value.season,
    objectives: objectives as CareerObjective[], finale: { step: finale.step, won: finale.won },
    deck, posts: { ...(posts as Record<string, Branch>) }, pips, camps: [...value.camps] as (Branch | null)[],
    skills, spSpent: value.spSpent, wallet: { drills, bond: wallet.bond, sp: wallet.sp },
    completedAt: value.completedAt, racingBuild,
  }
}

export function parseBondRecord(value: unknown): BondRecord | null {
  if (!isObject(value) || !exact(value, ['umaId', 'tier', 'cardId', 'value', 'hints'])) return null
  if (!isRowId(value.umaId) || !isInt(value.tier, 1, 3) || !isRowId(value.cardId) || !isInt(value.value, 0, BOND_MAX) || !isInt(value.hints, 0)) return null
  return { umaId: value.umaId, tier: value.tier as Tier, cardId: value.cardId, value: value.value, hints: value.hints }
}

export function parseRaceResultRecord(value: unknown): RaceResultRecord | null {
  if (!isObject(value) || !exact(value, ['careerId', 'umaId', 'raceId', 'kind', 'placement', 'run', 'at'])) return null
  if (!isRowId(value.careerId) || !isRowId(value.umaId) || !isRowId(value.raceId) || (value.kind !== 'objective' && value.kind !== 'finale')) return null
  if (!isInt(value.placement, 1, 18) || !isTime(value.at)) return null
  const run = parseRaceRun(value.run)
  if (run === null || run.field.find((runner) => runner.isPlayer)?.placement !== value.placement) return null
  return { careerId: value.careerId, umaId: value.umaId, raceId: value.raceId, kind: value.kind, placement: value.placement, run, at: value.at }
}
