// Uma Level: permanent, earned only from racing (docs/design/uma-progression.md).
import type { RaceGrade } from './types'

export const expToNextUmaLevel = (level: number): number => 100 + 25 * (level - 1)

export const WIN_EXP: Record<RaceGrade, number> = {
  debut: 40,
  maiden: 40,
  'pre-op': 60,
  op: 60,
  g3: 80,
  g2: 110,
  g1: 150,
}

/** 2nd and 3rd place earn this share of the win EXP. */
export const PLACED_EXP_SHARE = 0.25
export const UMA_LEVEL_TICKET_REWARD = 5
export const GATE_SHARD_REWARD = 1

/** Uma EXP for a finish. `raceBonus` is the summed card Race Bonus (0.03 = +3%). */
export function raceExp(grade: RaceGrade, placement: number, raceBonus = 0): number {
  const win = WIN_EXP[grade] * (1 + raceBonus)
  if (placement === 1) return Math.round(win)
  if (placement === 2 || placement === 3) return Math.round(win * PLACED_EXP_SHARE)
  return 0
}

/** Gate-level overflow EXP is banked up to one level's worth and applied after promotion. */
export const OVERFLOW_BANK_LEVELS = 1

/** Flat bonus to each stat on promotion (not limited by caps). */
export const PROMOTION_BONUS_PER_STAT = 10
