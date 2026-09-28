// Deterministic, presentation-only Chibi casting for the T071 proof (D178).
import { GRADES, STRATEGIES, type SparkOrb, type Strategy, type UmaTemplate } from '@racer/domain'

export interface SparkProofCast {
  orbs: Readonly<Record<SparkOrb, string>>
  rivals: Readonly<Record<Strategy, string>>
}

/** Art identity never affects the engine; this only picks stable, distinct faces from the already loaded catalogue. */
export function sparkProofCast(umas: readonly UmaTemplate[], traineeId: string | null): SparkProofCast | null {
  const ordered = [...umas].sort((left, right) => left.id.localeCompare(right.id))
  const trainee = ordered.find((uma) => uma.id === traineeId) ?? ordered.find((uma) => uma.starter) ?? ordered[0]
  if (!trainee) return null
  const usedCharacters = new Set([trainee.charaId])
  const rivals = {} as Record<Strategy, string>

  for (const strategy of STRATEGIES) {
    const choice = ordered
      .filter((uma) => !usedCharacters.has(uma.charaId))
      .sort((left, right) => GRADES.indexOf(left.aptitudes.strategy[strategy]) - GRADES.indexOf(right.aptitudes.strategy[strategy]) || left.id.localeCompare(right.id))[0]
    const selected = choice ?? trainee
    rivals[strategy] = selected.id
    usedCharacters.add(selected.charaId)
  }
  const recovery = ordered.find((uma) => !usedCharacters.has(uma.charaId)) ?? trainee
  return {
    orbs: {
      front: rivals.front,
      pace: rivals.pace,
      late: rivals.late,
      end: rivals.end,
      spark: trainee.id,
      recovery: recovery.id,
    },
    rivals,
  }
}
