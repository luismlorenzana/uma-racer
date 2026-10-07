// Initial, not balance-closed Puzzle rules (docs/design/uma-puzzles.md §§2–4, 7–8; D269/D271).
export const PUZZLE_RULES_VERSION = 1 as const
export const PUZZLE_SCHEMA_VERSION = 1 as const
export const PUZZLE_STAT_GROWTH = { atk: 12, hp: 36, rcv: 4, guard: 6, resilience: 6 } as const
export const PUZZLE_STAT_BASE = { atk: 1, hp: 4, rcv: 0.5, guardDivisor: 20, resilienceDivisor: 20 } as const
export const PUZZLE_EXP_BASE = 100
export const PUZZLE_EXP_STEP = 10
export const PUZZLE_EXP_WEIGHTS = { ordinary: 0.5, guardian: 1, champion: 1.5 } as const
export const PUZZLE_RELATIVE_EXP = { min: 0.25, max: 2, perLevel: 0.1 } as const
export const PUZZLE_CL_MAX = 10
export const PUZZLE_EXCHANGE_RATIO = 2
export const PUZZLE_LEGACY_EXP_PER_TICKET = 1250

// Work/transport bounds, NOT level caps or account storage limits. Larger cohorts need chunked transport in T110.
export const PUZZLE_PARSE_LIMITS = { id: 120, scenarios: 256, units: 4096, levelPage: 256 } as const
