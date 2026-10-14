// The rework's balance reports (docs/rework/03-uma-progression.md §9, §12, 04 §8, 05 §12; T133): what
// `pnpm sim:rework-builds` and `pnpm sim:rework-careers` write with `--write-report`, committed so the rework pages'
// live blocks render without the race engine. Rates are whole percents; typical values are fractions of a tree.
import type { CareerStage } from '../../career-stages'
import type { DistanceCategory, Strategy } from '../../types'

/** One scenario's stamina ladder: each rung build's Stamina, and the checks that missed. */
export interface LadderRow {
  readonly T: number
  /** Stamina of each rung's build, in `BuildsReport.rungs` order. */
  readonly stamina: readonly number[]
  readonly misses: readonly { readonly name: string; readonly hard: boolean }[]
}

/** One cell's best case: its win rate in whole percent, the build that won it and her running style. */
export interface RateCell {
  readonly rate: number
  readonly build: string
  readonly strategy: Strategy
}

/** One scenario's G1 grid: per distance, the pace rate and the best case. */
export interface G1Row {
  readonly T: number
  readonly cells: Readonly<Record<DistanceCategory, RateCell & { readonly pace: number }>>
}

/** A buff's gain on the rework's typical build, as a share of her tree: per distance set, and their mean. */
export interface TypicalRow {
  readonly T: number
  readonly measured: number
  readonly bySet: Readonly<Record<DistanceCategory, number>>
}

/** `pnpm sim:rework-builds -- --write-report`. */
export interface BuildsReport {
  readonly racesPerCell: number
  readonly ladderRaces: number
  /** The ladder's rung builds, in order. */
  readonly rungs: readonly string[]
  readonly ladder: readonly LadderRow[]
  readonly g1: readonly G1Row[]
  readonly typical: readonly TypicalRow[]
}

/** One scenario's career rates: each stage's race, per distance, best case. */
export interface CareerRow {
  readonly T: number
  readonly stages: Readonly<Record<CareerStage, Readonly<Record<DistanceCategory, RateCell>>>>
}

/** `pnpm sim:rework-careers -- --write-report`. Only rates and synthetic labels: nothing from the private packs. */
export interface CareersReport {
  readonly racesPerCell: number
  readonly rates: readonly CareerRow[]
}
