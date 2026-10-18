// What CI pins (docs/game/12-economy-and-pacing.md §12, T132's "CI checks"): each check as data,
// with the run it reads and how it reads it. A check passes when every value it reads is in its range. The ranges are
// the owner's tolerances; only the owner's decision moves one (D351), and 12 §11 tunes the game, not the check.
import { BUILDING_IDS } from '../farm/buildings'
import type { LoopResult } from './loop'
import type { FarmLevelProbe, FirstUnlockProbe } from './probes'

/** The runs the checks read: the baseline, the heavy variant and the two probes. */
export interface CheckedRuns {
  readonly baseline: LoopResult
  readonly heavy: LoopResult
  readonly farmLevels: readonly FarmLevelProbe[]
  readonly firstUnlock: FirstUnlockProbe
}

export type CheckRun = 'baseline' | 'heavy' | 'probe'

export interface LoopCheck {
  readonly id: string
  readonly label: string
  readonly run: CheckRun
  readonly min: number | null
  readonly max: number | null
  readonly unit: string
  /** The values it reads: every one must be in range. A null value (never reached) fails. */
  readonly read: (runs: CheckedRuns) => readonly (number | null)[]
  /** A second condition beside the range, with its words. */
  readonly also?: { readonly label: string; readonly holds: (runs: CheckedRuns) => boolean }
  /**
   * A known miss (uma-rpg's H14 pattern): no lever of 12 §11 fixes it without breaking another, so the loop test marks it
   * `it.fails`, D348 records the measured miss and docs/open-questions.md the recommendation. The words say why.
   */
  readonly knownMiss?: string
}

const scenarioDays = (result: LoopResult, tiers: readonly number[]) =>
  result.metrics.scenarios.filter((row) => tiers.includes(row.tier)).map((row) => row.days.median)

export const LOOP_CHECKS: readonly LoopCheck[] = Object.freeze([
  {
    // A new account's ramp (D351): every building at Lv 1, Farm Levels from 1, no Prize Money until the first careers.
    id: 'first-scenario', label: "A new account's first scenario", run: 'baseline', min: null, max: 42, unit: 'days',
    read: ({ baseline }) => [scenarioDays(baseline, [1])[0] ?? null],
  },
  {
    // One band for every scenario but a new account's first, in every tier (D374): a guard of about 2½ to 5 weeks
    // around the four-week target, not a target per scenario. The owner keeps the layers symmetric rather than tuning
    // each one to a day count.
    id: 'scenarios', label: "Days in each scenario after a new account's first", run: 'baseline', min: 18, max: 35, unit: 'days',
    read: ({ baseline }) => {
      const days = [...scenarioDays(baseline, [1]).slice(1), ...scenarioDays(baseline, [2, 3])]
      return days.length === 13 ? days : [...days, null]
    },
    also: {
      label: 'every building and facility at Lv 3 when the cohort entered tiers 2 and 3',
      holds: ({ baseline }) => baseline.metrics.tiers.filter((row) => row.tier > 1).every((row) => row.allLv3AtEntry),
    },
  },
  {
    id: 'tier-1-weeks', label: 'Tier 1', run: 'baseline', min: 19, max: 23, unit: 'weeks',
    read: ({ baseline }) => [baseline.metrics.tiers.find((row) => row.tier === 1)?.weeks ?? null],
  },
  {
    id: 'slot-use', label: "Every building's and facility's slot use, in every scenario window", run: 'baseline', min: null, max: 0.9, unit: 'share',
    read: ({ baseline }) => [Math.max(...BUILDING_IDS.map((id) => baseline.metrics.slots.find((row) => row.building === id)!.peakHeld))],
  },
  {
    id: 'racing-target', label: 'Time saved by target racing', run: 'baseline', min: 0.05, max: 0.1, unit: 'share',
    read: ({ baseline }) => [baseline.metrics.racingShare],
  },
  {
    id: 'racing-heavy', label: 'Time saved by heavy racing', run: 'heavy', min: 0.18, max: 0.25, unit: 'share',
    read: ({ heavy }) => [heavy.metrics.racingShare],
  },
  {
    id: 'farm-levels-c', label: 'Farm Levels a day early in a tier, at C', run: 'probe', min: 2, max: 3, unit: 'levels a day',
    read: ({ farmLevels }) => farmLevels.filter((probe) => probe.letter === 'C').map((probe) => probe.levelsPerDay),
  },
  {
    id: 'farm-levels-suited', label: 'Farm Levels a day early in a tier, at A and S', run: 'probe', min: 4, max: 5, unit: 'levels a day',
    read: ({ farmLevels }) => farmLevels.filter((probe) => probe.letter !== 'C').map((probe) => probe.levelsPerDay),
  },
  {
    id: 'first-unlock', label: 'First unlock on a fresh account', run: 'probe', min: null, max: 12, unit: 'hours',
    read: ({ firstUnlock }) => [firstUnlock.hours],
  },
] satisfies LoopCheck[])

export interface CheckResult {
  readonly check: LoopCheck
  readonly values: readonly (number | null)[]
  readonly pass: boolean
}

const inRange = (check: LoopCheck, value: number | null): boolean =>
  value !== null && Number.isFinite(value) && (check.min === null || value >= check.min - 1e-9) && (check.max === null || value <= check.max + 1e-9)

export function evaluateChecks(runs: CheckedRuns): readonly CheckResult[] {
  return LOOP_CHECKS.map((check) => {
    const values = check.read(runs)
    const pass = values.length > 0 && values.every((value) => inRange(check, value)) && (check.also?.holds(runs) ?? true)
    return { check, values, pass }
  })
}
