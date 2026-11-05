// A play's config (docs/game/07-stages.md §1, D384, D385): what the rules read, built alike on the device and the API
// from the career and the content, so a journal's replay needs only its seed and inputs. Her growth rates as whole
// percents, her deck in deck order with each card's real effects and unique, each card's bond (its track, or its
// Initial Friendship Gauge), the season's focus stat for Training Yard, and for Furlong Hand the race it runs (her
// season's objective, else her next one, else the URA Finals' course) with her racing build, her skills and the
// rival field. Pure.
import { readDeck } from '../build/derive'
import { uniqueTerms } from '../build/effects'
import { careerStats } from '../build/racing-build'
import { finaleRace } from '../career/finale'
import { seasonFocus, seasonObjectives } from '../career/season'
import type { CourseTemplate, RaceTemplate, SkillTemplate, SupportCardTemplate, UmaTemplate } from '../content'
import { bestStrategy } from '../race-attempt'
import { FINALE_SEASON, type BondRecord, type CareerRecord } from '../save/records'
import { refuse, type Refusal } from '../save/registry'
import { STATS, type RaceGrade, type StatKey, type Stats } from '../types'
import type { StageCard, StageConfig, StageKind, StageUma } from './contract'
import { furlongSetup, type FurlongSetup } from './furlong/setup'
import { isStageSeed } from './rng'

/** What a config reads from the content: Furlong Hand also reads the races, their courses and the skills. */
export interface StageContent {
  readonly umas: ReadonlyMap<string, UmaTemplate>
  readonly cards: ReadonlyMap<string, SupportCardTemplate>
  readonly races?: readonly RaceTemplate[]
  readonly courses?: ReadonlyMap<string, CourseTemplate>
  readonly skills?: ReadonlyMap<string, SkillTemplate>
}

/** Her, for a stage: her growth rates (0.1) as whole percents (10). */
export const stageUma = (uma: Pick<UmaTemplate, 'id' | 'growthRates'>): StageUma => ({
  id: uma.id,
  growth: Object.fromEntries(STATS.map((stat) => [stat, Math.round(uma.growthRates[stat] * 100)])) as unknown as Stats,
})

export const stageCard = (card: Pick<SupportCardTemplate, 'id' | 'type' | 'effects'> & Partial<Pick<SupportCardTemplate, 'uniqueEffect'>>): StageCard => {
  const terms = card.uniqueEffect === undefined ? [] : uniqueTerms({ uniqueEffect: card.uniqueEffect })
  return {
    id: card.id, type: card.type, effects: { ...card.effects },
    ...(terms.length === 0 ? {} : { unique: { effects: terms.map((term) => ({ type: term.type, value: term.value, params: [...term.params] })) } }),
  }
}

export interface StageParts {
  readonly kind: StageKind
  readonly seed: number
  readonly T: number
  readonly uma: Pick<UmaTemplate, 'id' | 'growthRates'>
  /** The deck in order, each card with its bond. */
  readonly deck: readonly { readonly card: SupportCardTemplate; readonly bond: number }[]
  readonly focus?: StatKey
  readonly course?: string
  readonly furlong?: FurlongSetup
  readonly practice: boolean
}

export function buildStageConfig(parts: StageParts): StageConfig {
  if (!isStageSeed(parts.seed)) throw new RangeError('A stage seed is an unsigned 32-bit integer')
  return {
    kind: parts.kind,
    seed: parts.seed,
    T: parts.T,
    uma: stageUma(parts.uma),
    deck: parts.deck.map(({ card }) => stageCard(card)),
    bonds: Object.fromEntries(parts.deck.map(({ card, bond }) => [card.id, bond])),
    ...(parts.focus === undefined ? {} : { seasonFocus: parts.focus }),
    ...(parts.course === undefined ? {} : { course: parts.course }),
    ...(parts.furlong === undefined ? {} : { furlong: parts.furlong }),
    practice: parts.practice,
  }
}

/** The race a Furlong Hand play runs, and the field it meets. */
export interface FurlongRace {
  readonly race: RaceTemplate
  /** The career's season the field is as strong as: hers now (12 at the Finale). */
  readonly season: number
  readonly grade: RaceGrade
}

/** The URA Finals' prep heat meets a G1 field, as the semifinal does. */
export const FINALE_PREP_GRADE: RaceGrade = 'g1'

/**
 * The race a career's Furlong Hand runs: her season's first objective (`seasonStage`'s), else her next objective after
 * it, else the URA Finals' course (at the Finale, or once every objective is behind her). The field is as strong as
 * her season now. Null when the content can't name one.
 */
export function furlongRaceFor(career: Pick<CareerRecord, 'objectives' | 'season'>, uma: UmaTemplate, races: readonly RaceTemplate[]): FurlongRace | null {
  const find = (id: string) => races.find((race) => race.id === id)
  if (career.season < FINALE_SEASON) {
    const next = seasonObjectives(career)[0] ?? [...career.objectives].filter((objective) => objective.season > career.season).sort((a, b) => a.season - b.season)[0]
    const race = next === undefined ? undefined : find(next.raceId)
    if (race !== undefined) return { race, season: career.season, grade: race.grade }
  }
  try {
    return { race: finaleRace(uma, career, races), season: Math.min(FINALE_SEASON, career.season), grade: FINALE_PREP_GRADE }
  } catch {
    return null
  }
}

const NO_RACE = 'Furlong Hand has no race to run here.'

/** Furlong Hand's setup for her on `at`, from the content, or the words why not. */
function furlongFor(content: StageContent, uma: UmaTemplate, at: FurlongRace, stats: Stats, bought: readonly string[], T: number, seed: number): FurlongSetup | Refusal {
  const course = content.courses?.get(at.race.courseId)
  if (course === undefined || content.skills === undefined) return refuse('no-race', NO_RACE)
  try {
    return furlongSetup({
      seed, T, season: at.season, grade: at.grade, race: at.race, course, uma, stats, strategy: bestStrategy(uma), bought,
      skills: content.skills, umas: content.umas,
    })
  } catch {
    return refuse('no-race', NO_RACE)
  }
}

/**
 * A career's play of `kind` at its current season: her deck and bonds as they stand; for Training Yard the season's
 * focus, for Furlong Hand her race (`furlongRaceFor`), her racing stats and bought skills, and the rival field. Refuses
 * when her Uma isn't in the content, or Furlong Hand has no race.
 */
export function careerStageConfig(
  career: CareerRecord,
  bonds: Readonly<Record<string, BondRecord>>,
  content: StageContent,
  kind: StageKind,
  seed: number,
  practice: boolean,
): StageConfig | Refusal {
  const uma = content.umas.get(career.umaId)
  if (uma === undefined) return refuse('unknown-uma', 'That Uma isn\'t in the game.')
  const posted = readDeck(career, { cards: content.cards, bonds }).posted
  const parts = { kind, seed, T: career.T, uma, practice, deck: posted.map(({ card, bond }) => ({ card, bond })) }
  if (kind === 'training-yard') return buildStageConfig({ ...parts, focus: seasonFocus(career.season) })
  if (!isStageSeed(seed)) throw new RangeError('A stage seed is an unsigned 32-bit integer')
  const at = furlongRaceFor(career, uma, content.races ?? [])
  if (at === null) return refuse('no-race', NO_RACE)
  const stats = careerStats(career, { uma, cards: content.cards, bonds })
  const furlong = furlongFor(content, uma, at, stats, career.skills, career.T, seed)
  if ('refused' in furlong) return furlong
  return buildStageConfig({ ...parts, course: at.race.id, furlong })
}

/**
 * A practice play outside any career: her alone, no deck. Training Yard's focus is Speed; Furlong Hand runs the URA
 * Finals' course for her best surface and distance on her base stats, against that race's field as the first season's.
 */
export function practiceStageConfig(uma: UmaTemplate, kind: StageKind, seed: number, content?: StageContent): StageConfig | Refusal {
  const parts = { kind, seed, T: 1, uma, deck: [], practice: true }
  if (kind === 'training-yard') return buildStageConfig({ ...parts, focus: STATS[0] })
  if (!isStageSeed(seed)) throw new RangeError('A stage seed is an unsigned 32-bit integer')
  if (content === undefined) return refuse('no-race', NO_RACE)
  let race: RaceTemplate
  try {
    race = finaleRace(uma, { objectives: [] }, content.races ?? [])
  } catch {
    return refuse('no-race', NO_RACE)
  }
  const furlong = furlongFor(content, uma, { race, season: 0, grade: race.grade }, uma.baseStats, [], 1, seed)
  if ('refused' in furlong) return furlong
  return buildStageConfig({ ...parts, course: race.id, furlong })
}
