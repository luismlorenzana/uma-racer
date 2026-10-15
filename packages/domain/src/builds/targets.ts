// The balance targets the rework's builds are held to (docs/rework/03-uma-progression.md §12, 05 §12, D336 (4); T133).
// `pnpm sim:builds` and `pnpm sim:careers` check them, and the live blocks mark a miss.
import type { CareerStage } from '../career-stages'

/**
 * Each career stage's best-case win rate, in whole percent, with full-layer builds and today's handicaps (03 §12): every
 * Maiden G3 won, the Trials G2s at 90% or more, the Main G1s at 60–100%.
 */
export const CAREER_TARGETS: Readonly<Record<CareerStage, { readonly min: number; readonly words: string }>> = Object.freeze({
  maiden: { min: 100, words: 'won' },
  trials: { min: 90, words: '90% or more' },
  main: { min: 60, words: '60–100%' },
})

export const meetsCareerTarget = (stage: CareerStage, rate: number): boolean => rate >= CAREER_TARGETS[stage].min

/**
 * Hard stamina-ladder checks the rework's builds miss by design (D350): a tier's first Gym layer has one Extra Stats
 * single per stat, so there the miler leans her stamina card one node instead, and URA Finale's 2,400 m race takes the
 * long set. `pnpm sim:builds` reports them as ACCEPTED and fails on any other miss; an entry goes if it holds.
 */
export const LADDER_ACCEPTED_MISSES: readonly { readonly T: number; readonly name: string }[] = Object.freeze([
  { T: 1, name: 'Extra Stats into stamina run 1,800 m' },
  { T: 1, name: 'a Power card runs 2,400 m' },
  { T: 6, name: 'Extra Stats into stamina run 1,800 m' },
])

export const isAcceptedLadderMiss = (T: number, name: string): boolean => LADDER_ACCEPTED_MISSES.some((miss) => miss.T === T && miss.name === name)
