// `sim:stages` (docs/game/07-stages.md §6, D384; 02 §2 and §5): each game's three bots over many seeds, graded by the
// framework, against the bands M036 sets: the competent bot's median at A, the novice's at C or B, the expert at S on
// 35–65% of seeds, and a play of 3–7 minutes at a human pace (the competent bot's median moves × the game's seconds a
// move). Reports aggregates only: no Uma or card id. Pure: the configs come from the caller.
import { initialBond } from '../build/bond'
import { pickDecks } from '../build/decks'
import { seasonFocus } from '../career/season'
import type { SupportCardTemplate, UmaTemplate } from '../content'
import { SEASONS } from '../save/records'
import { buildStageConfig } from './config'
import type { BotLevel, StageConfig, StageInput, StageKind, StageRules } from './contract'
import { BOT_LEVELS, STAGE_NAMES } from './contract'
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
}

/** M036's bands for every game. */
export const STAGE_BANDS: StageBands = Object.freeze({
  competent: Object.freeze(['A'] as const),
  novice: Object.freeze(['C', 'B'] as const),
  expertS: Object.freeze({ min: 0.35, max: 0.65 }),
  minutes: Object.freeze({ min: 3, max: 7 }),
})

/** A human's pace, in seconds a move, by game: the Yard's placements (holds ride along). */
export const SECONDS_PER_MOVE: Readonly<Record<string, number>> = Object.freeze({ 'training-yard': 4, 'furlong-hand': 3 })

/** What the sim's configs are built from: the private pack's, or the invented content's. */
export interface StageSimContent {
  readonly umas: readonly Pick<UmaTemplate, 'id' | 'growthRates'>[]
  readonly cards: readonly SupportCardTemplate[]
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
  return (n) => {
    const bonded = n % 4
    return buildStageConfig({
      kind, seed: simSeed(n), T: 1, uma: content.umas[n % content.umas.length]!, practice: false,
      deck: deck.map((card, i) => ({ card, bond: i < bonded ? Math.max(80, initialBond(card)) : initialBond(card) })),
      ...(kind === 'training-yard' ? { focus: seasonFocus(n % SEASONS) } : {}),
    })
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
}

export interface StageSimReport {
  readonly kind: string
  readonly name: string
  readonly seeds: number
  readonly lines: readonly BotLine[]
  /** The competent bot's median moves × the game's seconds a move. */
  readonly minutes: number
  readonly failures: readonly string[]
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 0) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** Plays each bot `seeds` times, seed n on `configOf(n)`, and checks the bands. */
export function simulateStage<S>(rules: StageRules<S>, configOf: (n: number) => StageConfig, seeds: number, bands: StageBands = STAGE_BANDS): StageSimReport {
  const lines: BotLine[] = []
  for (const level of BOT_LEVELS) {
    const ps: number[] = []
    const scores: number[] = []
    const moves: number[] = []
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
      grades[settled.grade] += 1
      if (settled.report.tasks.length > 0 && settled.report.tasks.every(Boolean)) allTasks += 1
    }
    const medianP = median(ps)
    lines.push({
      level, plays: seeds, medianP, medianGrade: grade(medianP, []), grades, sShare: grades.S / seeds, allTasks,
      medianScore: median(scores), medianMoves: median(moves),
    })
  }
  const line = (level: BotLevel) => lines.find((each) => each.level === level)!
  const minutes = (line('competent').medianMoves * (SECONDS_PER_MOVE[rules.kind] ?? 4)) / 60
  const failures: string[] = []
  const pct = (n: number) => `${Math.round(n * 1000) / 10}%`
  if (!bands.competent.includes(line('competent').medianGrade)) failures.push(`The competent bot's median is ${line('competent').medianGrade}, not ${bands.competent.join(' or ')}`)
  if (!bands.novice.includes(line('novice').medianGrade)) failures.push(`The novice's median is ${line('novice').medianGrade}, not ${bands.novice.join(' or ')}`)
  const s = line('expert').sShare
  if (s < bands.expertS.min || s > bands.expertS.max) failures.push(`The expert reaches S on ${pct(s)}, outside ${pct(bands.expertS.min)}–${pct(bands.expertS.max)}`)
  if (minutes < bands.minutes.min || minutes > bands.minutes.max) failures.push(`A play runs ${minutes.toFixed(1)} minutes, outside ${bands.minutes.min}–${bands.minutes.max}`)
  return { kind: rules.kind, name: STAGE_NAMES[rules.kind], seeds, lines, minutes, failures }
}
