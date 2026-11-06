// The stage contract (docs/game/07-stages.md, D384; 02 §5): what every mini-game implements and what the framework,
// the sims and the views read. A game is pure seeded rules: `init` from a config, `step` one move at a time, `done`,
// `report` (its score over its target, its bonus tasks, and how its drills split across the colours), and three bots.
// The framework grades the report, pays the grade (one bundle for every game, D391), and settles a play by replaying
// its journal from the seed. Types only.
import type { SupportCardType } from '../content'
import type { CareerGame } from '../career/season'
import type { StatKey, Stats } from '../types'
import type { FurlongSetup } from './furlong/setup'

/** The games, by kind: one per career game. */
export type StageKind = CareerGame
export const STAGE_KINDS: readonly StageKind[] = Object.freeze(['training-yard', 'furlong-hand'] as const)
export const isStageKind = (value: unknown): value is StageKind => (STAGE_KINDS as readonly unknown[]).includes(value)
/** Each game's name, as the screens and refusals say it. */
export const STAGE_NAMES: Readonly<Record<StageKind, string>> = Object.freeze({ 'training-yard': 'Training Yard', 'furlong-hand': 'Furlong Hand' })

/** Her, as a stage reads her. */
export interface StageUma {
  /** Her outfit id. */
  readonly id: string
  /** Her growth rates in whole percents (her template's 0.1 is 10). */
  readonly growth: Stats
}

/** A card's unique effect, as a stage reads it: its terms (Furlong Hand maps them to an ability). */
export interface StageUnique {
  readonly effects: readonly { readonly type: number; readonly value: number; readonly params: readonly number[] }[]
}

/** One deck card, as a stage reads it. */
export interface StageCard {
  readonly id: string
  readonly type: SupportCardType
  /** Its real effects at full level, by the original's effect id (`build/effects.ts`): Specialty Priority is 19. */
  readonly effects: Readonly<Record<number, number>>
  /** Its unique effect's terms, when it has one at full level. */
  readonly unique?: StageUnique
}

/**
 * Everything a play reads: the rules never look further. The device and the API build it alike from the save and the
 * content (`stages/config.ts`), so a journal's replay needs only its seed and inputs.
 */
export interface StageConfig {
  readonly kind: StageKind
  /** The play's seed: an unsigned 32-bit integer. */
  readonly seed: number
  /** The career's scenario number. */
  readonly T: number
  readonly uma: StageUma
  /** Her career's deck, in deck order (empty outside a career). */
  readonly deck: readonly StageCard[]
  /** Each deck card's bond with her, 0–100, by card id. */
  readonly bonds: Readonly<Record<string, number>>
  /** The season's focus stat: it tilts Training Yard's colours, and Furlong Hand's wild cards count for it (D391). */
  readonly seasonFocus?: StatKey
  /** The race whose course the stage runs (Furlong Hand, T156). */
  readonly course?: string
  /** Furlong Hand's race: its legs, her racing build as it reads it, her skills and the rival field (T156). */
  readonly furlong?: FurlongSetup
  /** Practice: graded, and pays nothing. */
  readonly practice: boolean
}

/**
 * One quantised move. A turn-based game's `tick` is the move's index in the journal; `code` names the move (the game's
 * own table), and `x` and `y` are whole numbers when the move needs a place.
 */
export interface StageInput {
  readonly tick: number
  readonly code: number
  readonly x?: number
  readonly y?: number
}

/** What a finished (or stopped) play reports: the framework grades it (`grade.ts`). */
export interface StageReport {
  /** The score over the stage's target: 1 is grade A. */
  readonly p: number
  /** The bonus tasks, done or not: every one done lifts an A to S. */
  readonly tasks: readonly boolean[]
  /** The score `p` is read from, in the game's own unit (the Yard's drills, Furlong Hand's place). */
  readonly score: number
  /**
   * How the bundle's drills split across the colours, as relative weights: the Yard's merges, the ground Furlong Hand
   * ran in each colour (D391). A game adds no pay of its own; with every weight 0, the season's focus takes them all.
   */
  readonly drills: Stats
}

export type BotLevel = 'novice' | 'competent' | 'expert'
export const BOT_LEVELS: readonly BotLevel[] = Object.freeze(['novice', 'competent', 'expert'] as const)

/** A bot's own dice: the stage's seed never feeds them. */
export interface StageRng {
  /** An unsigned 32-bit integer. */
  nextInt(): number
  /** A whole number in [0, n). */
  below(n: number): number
}

/** A bot's next move in a play that isn't done. */
export type StageBot<S> = (state: S, rng: StageRng) => StageInput

/**
 * A game's rules. Pure and deterministic: integers or `+ − × ÷` only, no `Math.random`, no wall clock, no `Math.pow`
 * or `Math.sin` (they can differ between JavaScriptCore and V8). A rule change bumps `version`: a journal on another
 * version is refused, never replayed on new rules.
 */
export interface StageRules<S> {
  readonly kind: StageKind
  readonly version: number
  /** The most moves a finished play can hold: a longer journal is refused unread. */
  readonly maxInputs: number
  init(config: StageConfig): S
  /** One move: the next state, or null when the move isn't legal in `state`. Never writes into `state`. */
  step(state: S, input: StageInput): S | null
  done(state: S): boolean
  report(state: S): StageReport
  readonly bots: Readonly<Record<BotLevel, StageBot<S>>>
}

/** Any game's rules, in the registry. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyStageRules = StageRules<any>

/** A play's journal: its config, the rules' version and every move so far. The device keeps it until it settles. */
export interface Journal {
  readonly config: StageConfig
  readonly version: number
  readonly inputs: readonly StageInput[]
}
