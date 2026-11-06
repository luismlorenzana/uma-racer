// `sim:stages` (docs/game/07-stages.md §6, D384, D385; 02 §2 and §5): each game's three bots over many seeds, graded
// by the framework, against the bands M036 sets: the competent bot's median at A, the novice's at C or B, the expert at
// S on 35–65% of seeds, and a play of 3–7 minutes at a human pace (the competent bot's median moves × the game's
// seconds a move; Furlong Hand's own packet asks 3.5–6.5), and the competent bot's drills spread over at least three
// colours (each holding a tenth of the split, D391). Reports aggregates only: no Uma or card id. Pure: the configs come
// from the caller.
import { initialBond } from '../build/bond'
import { pickDecks } from '../build/decks'
import { finaleRace } from '../career/finale'
import { seasonFocus } from '../career/season'
import { newCareer } from '../career/start'
import type { CourseTemplate, RaceTemplate, SkillTemplate, SupportCardTemplate, UmaTemplate } from '../content'
import { bestStrategy } from '../race-attempt'
import { FINALE_SEASON, SEASONS, type CareerRecord } from '../save/records'
import { STATS, type StatKey, type Stats } from '../types'
import { buildStageConfig, FINALE_PREP_GRADE } from './config'
import type { BotLevel, StageConfig, StageInput, StageKind, StageRules } from './contract'
import { BOT_LEVELS, STAGE_NAMES } from './contract'
import { furlongSetup, typicalStat, type FurlongSetup } from './furlong/setup'
import { grade, STAGE_GRADES, type StageGrade } from './grade'
import { stageRng } from './rng'
import { settle, isReplayFailure } from './settle'

export interface StageBands {
  /** The competent bot's median grade. */
  readonly competent: readonly StageGrade[]
  /** The novice's median grade. */
  readonly novice: readonly StageGrade[]
  /** The expert's share of S. */
  readonly expertS: { readonly min: number; readonly max: number }
  /** A play's length at a human pace, in minutes. */
  readonly minutes: { readonly min: number; readonly max: number }
  /** The colours the competent bot's median play splits its drills over, at least (`coloursCovered`). */
  readonly colours: number
}

/** M036's bands for every game. */
export const STAGE_BANDS: StageBands = Object.freeze({
  competent: Object.freeze(['A'] as const),
  novice: Object.freeze(['C', 'B'] as const),
  expertS: Object.freeze({ min: 0.35, max: 0.65 }),
  minutes: Object.freeze({ min: 3, max: 7 }),
  colours: 3,
})

/** A colour counts as covered when it holds this share of a play's drill weights. */
export const COLOUR_SHARE = 0.1

/** The colours holding at least `COLOUR_SHARE` of a report's drill weights. */
export function coloursCovered(drills: Stats): number {
  const total = STATS.reduce((sum, stat) => sum + Math.max(0, drills[stat]), 0)
  return total <= 0 ? 0 : STATS.filter((stat) => drills[stat] / total >= COLOUR_SHARE).length
}

/** Each game's length band, in minutes at a human pace: M036's 3–7, and Furlong Hand's packet's 3.5–6.5 (T156). */
export const STAGE_MINUTES: Readonly<Record<StageKind, { readonly min: number; readonly max: number }>> = Object.freeze({
  'training-yard': STAGE_BANDS.minutes,
  'furlong-hand': Object.freeze({ min: 3.5, max: 6.5 }),
})

/** A game's bands: the shared grade bands and its own length. */
export const bandsFor = (kind: StageKind): StageBands => ({ ...STAGE_BANDS, minutes: STAGE_MINUTES[kind] })

/** A human's pace, in seconds a move, by game: the Yard's placements (holds ride along), Furlong Hand's cards. */
export const SECONDS_PER_MOVE: Readonly<Record<string, number>> = Object.freeze({ 'training-yard': 4, 'furlong-hand': 3 })

/** What the sim's configs are built from: the private pack's, or the invented content's. Furlong Hand reads it all. */
export interface StageSimContent {
  readonly umas: readonly UmaTemplate[]
  readonly cards: readonly SupportCardTemplate[]
  readonly races?: readonly RaceTemplate[]
  readonly courses?: readonly CourseTemplate[]
  readonly skills?: readonly SkillTemplate[]
}

/** Seed n's play seed: n spread over 32 bits. */
export const simSeed = (n: number): number => Math.imul(n + 1, 0x9e3779b1) >>> 0

/**
 * The sim's config for play n, a typical career's: Uma n in turn, season n of the twelve (its focus), and the median
 * deck (`pickDecks`) with an even spread of 0–3 of its cards at bond 80, the rest at their Initial Friendship Gauge.
 */
export function stageSimConfig(kind: StageKind, content: StageSimContent): (n: number) => StageConfig {
  if (content.umas.length === 0) throw new RangeError('The sim needs an Uma')
  const deck = pickDecks(content.cards, 1).median
  const furlong = kind === 'furlong-hand' ? furlongSim(content, deck) : null
  return (n) => {
    // Furlong Hand's plays cycle her objectives with the Umas, so its bonds turn a step each cycle (else they follow her style).
    const bonded = furlong === null ? n % 4 : (n + Math.floor(n / content.umas.length)) % 4
    const uma = content.umas[n % content.umas.length]!
    return buildStageConfig({
      kind, seed: simSeed(n), T: 1, uma, practice: false,
      deck: deck.map((card, i) => ({ card, bond: i < bonded ? Math.max(80, initialBond(card)) : initialBond(card) })),
      ...(furlong === null ? { focus: seasonFocus(n % SEASONS) } : furlong(n, uma)),
    })
  }
}

/**
 * Furlong Hand's sim races: Uma n's career objectives and her URA Finals in turn, each at its season against its
 * grade's field. Her stats are the typical career's at that season (`typicalStat`) in her own base stats' shape, her
 * style her best, and she has bought a skill from her deck's hints every two seasons.
 */
function furlongSim(content: StageSimContent, deck: readonly SupportCardTemplate[]): (n: number, uma: UmaTemplate) => { course: string; furlong: FurlongSetup; focus: StatKey } {
  const races = content.races ?? []
  const courses = new Map((content.courses ?? []).map((course) => [course.id, course]))
  const skills = new Map((content.skills ?? []).map((skill) => [skill.id, skill]))
  const umas = new Map(content.umas.map((uma) => [uma.id, uma]))
  const careers = new Map<string, CareerRecord>()
  const hints = [...new Set(deck.flatMap((card) => card.hintSkillIds))].filter((id) => skills.has(id) && skills.get(id)!.costSp !== null)
  return (n, uma) => {
    let career = careers.get(uma.id)
    if (career === undefined) {
      career = newCareer(uma, 1, races, 0)
      careers.set(uma.id, career)
    }
    // Her objectives and the URA Finals, spread over the plays by a hash of n (Uma n is n's turn of the Umas).
    const k = (Math.imul(n + 7, 0x85ebca6b) >>> 0) % (career.objectives.length + 1)
    const objective = career.objectives[k]
    const race = objective === undefined ? finaleRace(uma, career, races) : races.find((entry) => entry.id === objective.raceId)!
    const season = objective === undefined ? FINALE_SEASON : objective.season
    const typical = typicalStat(1, season)
    const mean = STATS.reduce((sum, stat) => sum + uma.baseStats[stat], 0) / STATS.length
    const stats = Object.fromEntries(STATS.map((stat) => [stat, Math.round((typical * uma.baseStats[stat]) / mean)])) as unknown as Stats
    const furlong = furlongSetup({
      seed: simSeed(n), T: 1, season, grade: objective === undefined ? FINALE_PREP_GRADE : race.grade, race, course: courses.get(race.courseId)!, uma,
      stats, strategy: bestStrategy(uma), bought: hints.slice(0, Math.floor(season / 2)), skills, umas,
    })
    return { course: race.id, furlong, focus: seasonFocus(season) }
  }
}

/** A bot's whole play from a config: its inputs, the state it ended in, and the settle of its journal. */
export function playBot<S>(rules: StageRules<S>, config: StageConfig, level: BotLevel, botSeed: number): { inputs: StageInput[]; state: S } {
  const rng = stageRng(botSeed)
  const inputs: StageInput[] = []
  let state = rules.init(config)
  while (!rules.done(state)) {
    if (inputs.length >= rules.maxInputs) throw new RangeError(`The ${level} bot ran past ${rules.maxInputs} moves`)
    const input = rules.bots[level](state, rng)
    const next = rules.step(state, input)
    if (next === null) throw new RangeError(`The ${level} bot made an illegal move at ${inputs.length}`)
    inputs.push(input)
    state = next
  }
  return { inputs, state }
}

export interface BotLine {
  readonly level: BotLevel
  readonly plays: number
  readonly medianP: number
  readonly medianGrade: StageGrade
  /** Plays at each grade. */
  readonly grades: Readonly<Record<StageGrade, number>>
  readonly sShare: number
  /** Plays with every task done. */
  readonly allTasks: number
  readonly medianScore: number
  readonly medianMoves: number
  /** The median play's colours covered by its drill split (`coloursCovered`). */
  readonly medianColours: number
}

/** The competent bot's plays in one group (Furlong Hand's by distance). */
export interface GroupLine {
  readonly label: string
  readonly plays: number
  readonly medianP: number
  readonly medianMoves: number
  readonly minutes: number
}

export interface StageSimReport {
  readonly kind: string
  readonly name: string
  readonly seeds: number
  readonly lines: readonly BotLine[]
  /** The competent bot's median moves × the game's seconds a move. */
  readonly minutes: number
  /** The length band it was held to. */
  readonly band: { readonly min: number; readonly max: number }
  /** The competent bot's plays by group, when the game has groups. */
  readonly groups: readonly GroupLine[]
  readonly failures: readonly string[]
}

/** A config's group in the report: Furlong Hand's race distance. */
const groupOf = (config: StageConfig): string | null => config.furlong?.race.distance ?? null

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 0) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** Plays each bot `seeds` times, seed n on `configOf(n)`, and checks the bands (the game's own by default). */
export function simulateStage<S>(rules: StageRules<S>, configOf: (n: number) => StageConfig, seeds: number, bands: StageBands = bandsFor(rules.kind)): StageSimReport {
  const lines: BotLine[] = []
  const groups = new Map<string, { ps: number[]; moves: number[] }>()
  for (const level of BOT_LEVELS) {
    const ps: number[] = []
    const scores: number[] = []
    const moves: number[] = []
    const colours: number[] = []
    const grades = Object.fromEntries(STAGE_GRADES.map((g) => [g, 0])) as Record<StageGrade, number>
    let allTasks = 0
    for (let n = 0; n < seeds; n += 1) {
      const config = configOf(n)
      const { inputs } = playBot(rules, config, level, (config.seed ^ 0x5eed5eed) >>> 0)
      const settled = settle({ config, version: rules.version, inputs }, rules)
      if (isReplayFailure(settled)) throw new RangeError(`The ${level} bot's play ${n} doesn't settle (${settled.failed})`)
      ps.push(settled.report.p)
      scores.push(settled.report.score)
      moves.push(inputs.length)
      colours.push(coloursCovered(settled.report.drills))
      const group = level === 'competent' ? groupOf(config) : null
      if (group !== null) {
        const tally = groups.get(group) ?? { ps: [], moves: [] }
        tally.ps.push(settled.report.p)
        tally.moves.push(inputs.length)
        groups.set(group, tally)
      }
      grades[settled.grade] += 1
      if (settled.report.tasks.length > 0 && settled.report.tasks.every(Boolean)) allTasks += 1
    }
    const medianP = median(ps)
    lines.push({
      level, plays: seeds, medianP, medianGrade: grade(medianP, []), grades, sShare: grades.S / seeds, allTasks,
      medianScore: median(scores), medianMoves: median(moves), medianColours: median(colours),
    })
  }
  const line = (level: BotLevel) => lines.find((each) => each.level === level)!
  const pace = SECONDS_PER_MOVE[rules.kind] ?? 4
  const minutes = (line('competent').medianMoves * pace) / 60
  const failures: string[] = []
  const pct = (n: number) => `${Math.round(n * 1000) / 10}%`
  if (!bands.competent.includes(line('competent').medianGrade)) failures.push(`The competent bot's median is ${line('competent').medianGrade}, not ${bands.competent.join(' or ')}`)
  if (!bands.novice.includes(line('novice').medianGrade)) failures.push(`The novice's median is ${line('novice').medianGrade}, not ${bands.novice.join(' or ')}`)
  const s = line('expert').sShare
  if (s < bands.expertS.min || s > bands.expertS.max) failures.push(`The expert reaches S on ${pct(s)}, outside ${pct(bands.expertS.min)}–${pct(bands.expertS.max)}`)
  if (minutes < bands.minutes.min || minutes > bands.minutes.max) failures.push(`A play runs ${minutes.toFixed(1)} minutes, outside ${bands.minutes.min}–${bands.minutes.max}`)
  const covered = line('competent').medianColours
  if (covered < bands.colours) failures.push(`The competent bot's drills split over ${covered} colours, under ${bands.colours}`)
  const groupLines = [...groups.entries()].map(([label, tally]) => ({
    label, plays: tally.ps.length, medianP: median(tally.ps), medianMoves: median(tally.moves), minutes: (median(tally.moves) * pace) / 60,
  }))
  return { kind: rules.kind, name: STAGE_NAMES[rules.kind], seeds, lines, minutes, band: bands.minutes, groups: groupLines, failures }
}
