// Race Form: race-time stat multipliers that reset each scenario (docs/design/racing.md#difficulty-race-form).
import { levelsIntoScenario } from './scenarios'
import { mapStats, type Stats } from './types'

export const yourForm = (umaLevel: number): number => 0.8 + 0.02 * levelsIntoScenario(umaLevel)

export const fieldForm = (umaLevel: number): number => 0.8 + 0.01 * levelsIntoScenario(umaLevel)

export const applyForm = (stats: Stats, form: number): Stats => mapStats(stats, (v) => v * form)
