// Furlong Hand fixtures (D385): configs on the invented content (`career/synthetic.ts`, `syntheticCards`), and spreads
// written as text so a rule test reads like the table it sets up. Invented values only.
import { syntheticCards } from '../build/decks'
import { syntheticCareerUmas, syntheticCourses, syntheticRaces, syntheticSkills } from '../career/synthetic'
import type { SupportCardTemplate } from '../content'
import { buildStageConfig } from '../stages/config'
import type { StageConfig } from '../stages/contract'
import { initFurlong, LINE, type FurlongCard, type FurlongState } from '../stages/furlong/rules'
import { furlongSetup, typicalStat, type FurlongHer, type FurlongSetup } from '../stages/furlong/setup'
import type { Stats } from '../types'

export const UMAS = syntheticCareerUmas()
export const RACES = syntheticRaces()
export const COURSES = new Map(syntheticCourses().map((course) => [course.id, course]))
export const SKILLS = new Map(syntheticSkills().map((skill) => [skill.id, skill]))
export const CARDS = syntheticCards()
export const UMA_MAP = new Map(UMAS.map((uma) => [uma.id, uma]))

export const cardOf = (id: string): SupportCardTemplate => {
  const found = CARDS.find((card) => card.id === id)
  if (found === undefined) throw new Error(`No card ${id}`)
  return found
}

/** One card a type and a Friend, at quality 2. */
export const FURLONG_DECK = ['sim-speed-2', 'sim-stamina-2', 'sim-power-2', 'sim-guts-2', 'sim-wit-2', 'sim-friend-2']

export interface FurlongConfigOptions {
  readonly seed?: number
  readonly deck?: readonly string[]
  /** Bonds by card id; every other card at 30. */
  readonly bonds?: Readonly<Record<string, number>>
  readonly raceId?: string
  readonly uma?: number
  readonly season?: number
  /** Her stats; the typical career's at the season, every colour alike, when absent. */
  readonly stats?: Stats
  readonly bought?: readonly string[]
  /** Overrides of the setup's parts. */
  readonly her?: Partial<FurlongHer>
  readonly setup?: Partial<FurlongSetup>
  readonly practice?: boolean
  /** Card overrides by id (invented effects for a hook's test). */
  readonly cards?: Readonly<Record<string, Partial<SupportCardTemplate>>>
}

export function furlongConfig(options: FurlongConfigOptions = {}): StageConfig {
  const seed = options.seed ?? 4242
  const uma = UMAS[options.uma ?? 0]!
  const race = RACES.find((entry) => entry.id === (options.raceId ?? 'sim-turf-medium-g1-3'))!
  const season = options.season ?? 6
  // The typical career's stat at the season, every colour alike: her classes are 0 whatever the rivals' curve (D391).
  const typical = Math.round(typicalStat(1, season))
  const stats = options.stats ?? { speed: typical, stamina: typical, power: typical, guts: typical, wit: typical }
  const setup = furlongSetup({
    seed, T: 1, season, grade: race.grade, race, course: COURSES.get(race.courseId)!, uma, stats, strategy: options.her?.strategy ?? 'pace',
    bought: options.bought ?? [], skills: SKILLS, umas: UMA_MAP,
  })
  const furlong: FurlongSetup = { ...setup, ...options.setup, her: { ...setup.her, ...options.her } }
  const deck = (options.deck ?? FURLONG_DECK).map((id) => ({ ...cardOf(id), ...options.cards?.[id] }))
  return buildStageConfig({
    kind: 'furlong-hand', seed, T: 1, uma, practice: options.practice ?? false, course: race.id, furlong,
    deck: deck.map((card) => ({ card, bond: options.bonds?.[card.id] ?? 30 })),
  })
}

const COLOURS = 'stpgw'

/**
 * A card from a token: a stat letter (s Speed, t Stamina, p Power, g Guts, w Wit) or `*` (wild) and a value 1–6 for a
 * stride card; `P` and a deck index for that Partner (its value is its own); `K` and an index for that Skill card.
 */
function cardFrom(token: string, state: FurlongState): FurlongCard {
  if (token[0] === 'P') {
    const found = state.cards.find((card) => card.kind === 'partner' && card.ref === Number(token.slice(1)))
    if (found === undefined) throw new Error(`No Partner ${token}`)
    return found
  }
  if (token[0] === 'K') {
    const found = state.cards.find((card) => card.kind === 'skill' && card.ref === Number(token.slice(1)))
    if (found === undefined) throw new Error(`No Skill card ${token}`)
    return found
  }
  const colour = token[0] === '*' ? -1 : COLOURS.indexOf(token[0]!)
  if (colour === -1 && token[0] !== '*') throw new Error(`Bad token ${token}`)
  return { kind: 'stride', colour, value: Number(token.slice(1)), ref: -1 }
}

export interface SpreadText {
  /** Four columns, each bottom to front, tokens split by spaces ('' for an empty column). */
  readonly columns: readonly string[]
  /** The lead. */
  readonly lead: string
  /** The draw cards, the next first. */
  readonly pile?: readonly string[]
}

/**
 * A play mid-leg on this table: the config's state at a leg with these columns, lead and pile. Its `cards` are the
 * tokens' cards in order (column cards, then the lead, then the pile), so `state.cards[i]` reads as written.
 */
export function furlongAt(table: SpreadText, change: Partial<FurlongState> = {}, options: FurlongConfigOptions = {}): FurlongState {
  const start = initFurlong(furlongConfig(options))
  const cards: FurlongCard[] = []
  const take = (token: string): number => {
    cards.push(cardFrom(token, start))
    return cards.length - 1
  }
  const columns = table.columns.map((column) => column.trim() === '' ? [] : column.trim().split(/\s+/).map(take))
  const lead = take(table.lead)
  const pile = (table.pile ?? []).map(take)
  return {
    ...start, phase: 'leg', line: LINE.middle, cards, columns, lead, leadWild: cards[lead]!.colour === -1, pile, redrawn: true,
    ...change,
  }
}

/** The tokens of a state's columns, as written. */
export const showColumns = (state: FurlongState): string[] => state.columns.map((column) => column.map((i) => {
  const card = state.cards[i]!
  if (card.kind === 'partner') return `P${card.ref}`
  if (card.kind === 'skill') return `K${card.ref}`
  return `${card.colour < 0 ? '*' : COLOURS[card.colour]}${card.value}`
}).join(' '))
