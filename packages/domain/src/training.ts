// Training Levels, earned by Spark Match (docs/design/minigames.md, docs/design/training.md).

import { MAX_TRAINING_LEVEL } from './constellation'

/**
 * Spark Match score needed to leave Training Level `n`. Surplus carries over, so a run can cross more than
 * one level and a bad run is slow progress rather than wasted progress.
 */
export const trainingExpToNext = (trainingLevel: number): number =>
  1000 + 350 * (Math.min(MAX_TRAINING_LEVEL - 1, Math.max(1, trainingLevel)) - 1)

/** Retained under its old name because the save parser pins the tier-1 bound. */
export const EXP_TO_NEXT_TRAINING_LEVEL = trainingExpToNext(1)

export interface TrainingLevelGain {
  trainingLevel: number
  trainingExp: number
  levelsGained: number
}

/** Adds Spark Match score, resolving levels greedily. EXP stops accumulating at the maximum. */
export function addTrainingExp(trainingLevel: number, exp: number, gained: number): TrainingLevelGain {
  let level = Math.min(MAX_TRAINING_LEVEL, Math.max(1, trainingLevel))
  let total = Math.max(0, exp) + Math.max(0, gained)
  const from = level
  while (level < MAX_TRAINING_LEVEL && total >= trainingExpToNext(level)) {
    total -= trainingExpToNext(level)
    level += 1
  }
  return {
    trainingLevel: level,
    trainingExp: level === MAX_TRAINING_LEVEL ? 0 : total,
    levelsGained: level - from,
  }
}
