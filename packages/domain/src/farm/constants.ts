// Stable Farm's pinned progression and cycle constants (docs/design/farm.md, D203–D208, D234).

/** v2 (D234): plots are numbered without end and stored sparsely; Farming Levels have no cap. */
export const FARM_SCHEMA_VERSION = 2 as const

/** A plot is `plot-<n>`, numbered from 1 across every Farm Section. */
export type FarmPlotId = `plot-${number}`
export const FARM_PLOT_ID_PATTERN = /^plot-([1-9]\d{0,2})$/

/** Sections hold six plots each, the 2 × 3 field a phone shows at once (D234). */
export const FARM_PLOTS_PER_SECTION = 6
/** A parser bound on plot numbers, not a design cap: Farm Level keeps opening plots (D234). */
export const MAX_FARM_PLOTS = 600

/**
 * The Farm Level a plot costs over the one before it (D234): twice the square of the plots already open. Each wait is a
 * little longer than the last, so later Sections need many outfits levelled very high.
 */
export const FARM_PLOT_STEP_FACTOR = 2

/** A worker opens the next scenario's crops every ten Farming Levels (D234). */
export const FARM_LEVELS_PER_CROP_TIER = 10
/** Scenario crop rows in the catalog. A new scenario adds a row; nothing else caps the ladder. */
export const FARM_CROP_TIERS = 14

/** Every crop starts at twelve hours and grows 24 minutes faster for each of the next ten levels, to eight (D234). */
export const FARM_BASE_GROWTH_MINUTES = 720
export const FARM_GROWTH_STEP_MINUTES = 24
export const FARM_GROWTH_STEPS = 10
export const FARM_FASTEST_GROWTH_MINUTES = FARM_BASE_GROWTH_MINUTES - FARM_GROWTH_STEP_MINUTES * FARM_GROWTH_STEPS
export const MINUTE_MS = 60 * 1_000

/** Every Farming Level costs the same two harvests (D234): the vertical track is linear. */
export const FARMING_EXP_PER_LEVEL = 24
/** A parser bound on a worker's Farming Level, not a design cap (D234): it is centuries of harvests away. */
export const MAX_FARMING_LEVEL_BOUND = 99_999
export const MAX_FARM_WORKERS = 1_000
export const FARM_CROP_YIELD = 1 as const
export const FARMING_EXP_PER_HARVEST = 12 as const
