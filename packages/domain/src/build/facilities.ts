// The training facilities (docs/game/05-the-build.md, D382): URA Finale's base table at facility levels 1–5, every
// scenario's tree's base, and what a pip costs in drills. A rule constant, like the cap ladder: public game mechanics
// (uma.guide's "URA Base Trainings", checked against GameTora's level 1 and the Biligame wiki's level 5). Pure.
import type { Branch } from '../save/records'
import { STATS, type Stats } from '../types'

/** A facility's level: 1–5. Each level is four sessions, as the original levels a facility every four uses. */
export const FACILITY_LEVELS = 5
export const PIPS_PER_LEVEL = 4

/** One facility level's base: the stats it trains and its SP. */
export interface FacilityRow {
  readonly stats: Stats
  readonly sp: number
}

const row = (sp: number, stats: Partial<Stats>): FacilityRow =>
  Object.freeze({ stats: Object.freeze(Object.fromEntries(STATS.map((stat) => [stat, stats[stat] ?? 0])) as unknown as Stats), sp })

/**
 * URA Finale's base training, by facility and level (D382). Speed trains Speed and Power; Stamina, Stamina and Guts;
 * Power, Stamina and Power; Guts, Speed, Power and Guts; Wit, Speed and Wit. Wit pays one more SP.
 */
export const URA_FACILITIES: Readonly<Record<Branch, readonly FacilityRow[]>> = Object.freeze({
  speed: [
    row(4, { speed: 11, power: 6 }), row(4, { speed: 12, power: 6 }), row(4, { speed: 13, power: 6 }),
    row(4, { speed: 14, power: 7 }), row(4, { speed: 15, power: 8 }),
  ],
  stamina: [
    row(4, { stamina: 10, guts: 6 }), row(4, { stamina: 11, guts: 6 }), row(4, { stamina: 12, guts: 6 }),
    row(4, { stamina: 13, guts: 7 }), row(4, { stamina: 14, guts: 8 }),
  ],
  power: [
    row(4, { stamina: 6, power: 9 }), row(4, { stamina: 6, power: 10 }), row(4, { stamina: 6, power: 11 }),
    row(4, { stamina: 7, power: 12 }), row(4, { stamina: 8, power: 13 }),
  ],
  guts: [
    row(4, { speed: 5, power: 5, guts: 8 }), row(4, { speed: 5, power: 5, guts: 9 }), row(4, { speed: 5, power: 5, guts: 10 }),
    row(4, { speed: 6, power: 5, guts: 11 }), row(4, { speed: 6, power: 5, guts: 13 }),
  ],
  wit: [
    row(5, { speed: 2, wit: 10 }), row(5, { speed: 2, wit: 11 }), row(5, { speed: 2, wit: 12 }),
    row(5, { speed: 3, wit: 13 }), row(5, { speed: 4, wit: 14 }),
  ],
})

function assertLevel(level: number): void {
  if (!Number.isInteger(level) || level < 1 || level > FACILITY_LEVELS) throw new RangeError(`A facility level is 1–5: ${level}`)
}

/** A facility's base at a level. */
export function facilityRow(branch: Branch, level: number): FacilityRow {
  assertLevel(level)
  return URA_FACILITIES[branch][level - 1]!
}

/** A pip's drill cost by level, before cuts: about the original's energy for one session (19–28). */
export const PIP_COSTS: readonly number[] = Object.freeze([20, 22, 24, 26, 28])

/**
 * A cost after cuts: Energy Cost Reduction (a fraction, summed over the cards posted there) rounded up, then Wit
 * Friendship Recovery (whole drills) off; never under one drill.
 */
export const cutCost = (base: number, energyCut = 0, recovery = 0): number =>
  Math.max(1, Math.ceil(base * (1 - Math.min(1, Math.max(0, energyCut))) - 1e-9) - Math.max(0, recovery))

/** A pip's drill cost at a level, after its branch's cuts. */
export function pipCost(level: number, energyCut = 0, recovery = 0): number {
  assertLevel(level)
  return cutCost(PIP_COSTS[level - 1]!, energyCut, recovery)
}

/** The level of a branch's pip by its index (0–19): four pips a level. */
export const pipLevel = (index: number): number => Math.floor(index / PIPS_PER_LEVEL) + 1

/** A branch's facility level with this many pips bought: the level of its next pip, 5 once full. */
export const branchLevel = (pips: number): number => Math.min(FACILITY_LEVELS, Math.floor(pips / PIPS_PER_LEVEL) + 1)
