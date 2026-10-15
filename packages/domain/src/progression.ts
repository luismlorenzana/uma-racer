// The level curve and race EXP, earned only from racing, that Racing Level reads (docs/game/03-uma-progression.md §2).
import { levelsIntoScenario } from './scenarios'
import type { RaceGrade } from './types'

/**
 * Every scenario's levels cost the same (D241): 100 EXP at its first level and 25 more at each level after, 1,800 for a
 * scenario's nine. A gate's bank is the next scenario's first level, 100.
 */
export const expToNextUmaLevel = (level: number): number => 100 + 25 * levelsIntoScenario(level)

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
export const GATE_SHARD_REWARD = 1

/** The ledger entry that pays a gate's Uma Shard: one per Uma per gate, ever. */
export const umaGateShardLedgerId = (umaId: string, gate: number): string => `uma-gate-shard:${umaId}:${gate}`

/** Uma EXP for a finish. `raceBonus` is the summed card Race Bonus (0.03 = +3%). */
export function raceExp(grade: RaceGrade, placement: number, raceBonus = 0): number {
  const win = WIN_EXP[grade] * (1 + raceBonus)
  if (placement === 1) return Math.round(win)
  if (placement === 2 || placement === 3) return Math.round(win * PLACED_EXP_SHARE)
  return 0
}

/** Gate-level overflow EXP is banked up to one level's worth and applied after promotion. */
export const OVERFLOW_BANK_LEVELS = 1
