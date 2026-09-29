// Stable Farm's pinned progression and cycle constants (docs/design/farm.md, D203–D208).

export const FARM_SCHEMA_VERSION = 1 as const

export const FARM_PLOT_IDS = ['plot-1', 'plot-2', 'plot-3', 'plot-4', 'plot-5', 'plot-6'] as const
export type FarmPlotId = (typeof FARM_PLOT_IDS)[number]

export const FARM_PLOT_LEVEL_REQUIREMENTS = [1, 2, 6, 13, 27, 42] as const
export const FARM_OUTFIT_LEVEL_REQUIREMENTS = [1, 2, 4, 5, 7, 8, 10, 11, 13, 14, 16, 17, 19, 20] as const
export const FARM_CROP_LEVEL_REQUIREMENTS = [1, 2, 4, 7, 11, 16, 22, 29, 37, 46, 56, 67, 79, 92] as const

export const MAX_OUTFIT_FARMING_LEVEL = 20
export const MAX_FARM_WORKERS = 1_000
export const FARM_GROWTH_HOURS = 12 as const
export const FARM_GROWTH_MS = FARM_GROWTH_HOURS * 60 * 60 * 1_000
export const FARM_CROP_YIELD = 1 as const
export const FARMING_EXP_PER_HARVEST = 12 as const

