// How her stats fit the race she is about to run (docs/design/ux.md, D233). Nothing is authored per race: Stamina is read
// against what a full spurt needs at this distance and style (the HP model rivals are built on), and every other stat
// against the field she will actually meet, from the prepared race.

import { STATS, fullSpurtStamina, type StatKey, type Stats, type Strategy } from '@racer/domain'

export type StatFitVerdict = 'good' | 'average' | 'bad'

export interface StatFit {
  stat: StatKey
  value: number
  verdict: StatFitVerdict
  /** Stamina: what a full spurt needs. The rest: the field's median. */
  reference: number
  /** The rest: how many rivals she is ahead of (ties count half), and the field's size. Stamina: null. */
  ahead: number | null
  rivals: number
  /** Stamina only: what she carries past the need where nothing turns it into speed (2,100 m and under). */
  spare: number
}

/** Holds a full spurt with a small margin; within 5% either way is tight. */
export const STAMINA_GOOD = 1.05
export const STAMINA_AVERAGE = 0.95
/** Ahead of two-thirds of the field is good; behind two-thirds is bad. */
export const FIELD_GOOD = 2 / 3
export const FIELD_AVERAGE = 1 / 3
/** The stamina contest pays for Stamina past 1,200 only above this distance (D135). */
const STAMINA_CONTEST_FROM = 2100

/** Stats above 1,200 count half in a race (the original's), so standings compare what each stat is worth. */
const effective = (value: number): number => (value <= 1200 ? value : 1200 + (value - 1200) / 2)

function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

export function raceStatFit(input: {
  stats: Stats
  rivals: readonly Stats[]
  distance: number
  strategy: Strategy
}): StatFit[] {
  const { stats, rivals, distance, strategy } = input
  return STATS.map((stat): StatFit => {
    const value = stats[stat]
    if (stat === 'stamina') {
      const need = Math.round(fullSpurtStamina(distance, strategy, stats.speed, stats.guts))
      const ratio = value / Math.max(1, need)
      return {
        stat,
        value,
        verdict: ratio >= STAMINA_GOOD ? 'good' : ratio >= STAMINA_AVERAGE ? 'average' : 'bad',
        reference: need,
        ahead: null,
        rivals: rivals.length,
        spare: distance <= STAMINA_CONTEST_FROM ? Math.max(0, value - need) : 0,
      }
    }
    const mine = effective(value)
    const field = rivals.map((rival) => effective(rival[stat]))
    const ahead = field.filter((other) => other < mine).length + field.filter((other) => other === mine).length / 2
    const share = field.length > 0 ? ahead / field.length : 0.5
    return {
      stat,
      value,
      verdict: share >= FIELD_GOOD ? 'good' : share >= FIELD_AVERAGE ? 'average' : 'bad',
      reference: Math.round(median(rivals.map((rival) => rival[stat]))),
      ahead,
      rivals: rivals.length,
      spare: 0,
    }
  })
}
