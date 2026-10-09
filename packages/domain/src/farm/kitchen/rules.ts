// Additive production/cooking baseline; no live Farm caller yet (docs/design/farm-kitchen-rework.md, T118).
export const FARM_KITCHEN_RULES_VERSION = 1
export const FARM_KITCHEN_SCHEMA_VERSION = 3
export const FARM_KITCHEN_ROW_VERSION = 1
export const FARM_EXTRA_TEMPLATE_VERSION = 1
export const FARM_KITCHEN_EXP_PER_LEVEL = 24
export const FARM_KITCHEN_EXP_PER_JOB = 12
export const FARM_KITCHEN_JOB_MS = 6 * 60 * 60 * 1000
export const FARM_KITCHEN_RAW_YIELD = 6
export const FARM_KITCHEN_PROCESS_BATCH = 6
export const FARM_KITCHEN_MAX_MEALS = 4
export const FARM_KITCHEN_ENERGY_MS = 30 * 60 * 1000
export const FARM_KITCHEN_ENERGY_GRANT = 50
export const FARM_KITCHEN_ENERGY_ID = 'farm:energy'
export const FARM_KITCHEN_SCENARIOS_PER_BLOCK = 5
export const FARM_KITCHEN_LEVELS_PER_BLOCK = 50
export const FARM_KITCHEN_LEVELS_PER_FLAVOUR = 10
export const FARM_KITCHEN_PROCESS_LEVEL = 6
export const FARM_KITCHEN_COOK_LEVEL = 9
export const FARM_KITCHEN_STATIONS_PER_DISTRICT = 6
export const FARM_KITCHEN_MAX_INPUTS = 10
export const FARM_EXTRA_PURE_PER_STAT = 10
export const FARM_EXTRA_SUNS = 5
export const FARM_EXTRA_NODE_TOTAL = 20
export const FARM_EXTRA_INITIAL_CAPACITY = 18
export const FARM_EXTRA_CAPACITY_STEP = 2
export const FARM_EXTRA_NODE_COUNT = 65

export const FARM_DISTRICTS = ['garden', 'orchard', 'barn', 'workshop', 'kitchen'] as const
export type FarmDistrict = (typeof FARM_DISTRICTS)[number]
export type FarmStationId = `${FarmDistrict}-${1 | 2 | 3 | 4 | 5 | 6}`
export const FARM_STATION_IDS: readonly FarmStationId[] = FARM_DISTRICTS.flatMap(district =>
  Array.from({ length: FARM_KITCHEN_STATIONS_PER_DISTRICT }, (_, i) => `${district}-${i + 1}` as FarmStationId))

export const FARM_RAW_FAMILIES = ['vegetable', 'fruit', 'milk', 'egg', 'chicken', 'beef', 'pork'] as const
export type FarmRawFamily = (typeof FARM_RAW_FAMILIES)[number]
export const FARM_PROCESSES = [
  { id: 'canned-vegetable', raw: 'vegetable', label: 'Canned' },
  { id: 'vegetable-juice', raw: 'vegetable', label: 'Juice' },
  { id: 'canned-fruit', raw: 'fruit', label: 'Canned' },
  { id: 'fruit-juice', raw: 'fruit', label: 'Juice' },
  { id: 'cheese', raw: 'milk', label: 'Cheese' },
  { id: 'mayonnaise', raw: 'egg', label: 'Mayonnaise' },
  { id: 'chicken-stock', raw: 'chicken', label: 'Chicken Stock' },
  { id: 'beef-stock', raw: 'beef', label: 'Beef Stock' },
  { id: 'cured-ham', raw: 'pork', label: 'Cured Ham' },
] as const
export type FarmProcessedFamily = (typeof FARM_PROCESSES)[number]['id']

export const farmSafeInteger = (n: unknown, min = 0): n is number => Number.isSafeInteger(n) && (n as number) >= min
export const farmSafeId = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(s) &&
  !['__proto__', 'constructor', 'prototype'].includes(s)
export const isFarmStationId = (id: unknown): id is FarmStationId =>
  typeof id === 'string' && (FARM_STATION_IDS as readonly string[]).includes(id)

export type FarmErrorCode = 'invalid' | 'unknown-recipe' | 'unknown-scenario' | 'unknown-node' | 'not-owned' |
  'busy' | 'no-worker' | 'worker-level' | 'recipe-locked' | 'wrong-district' | 'wrong-ingredient' |
  'insufficient-stock' | 'not-running' | 'not-ready' | 'already-ready' | 'wrong-block' | 'not-bought' | 'capacity'
export type FarmResult<T> = { ok: true; value: T } | { ok: false; error: { code: FarmErrorCode; detail: string } }
export const farmSuccess = <T>(value: T): FarmResult<T> => ({ ok: true, value })
export const farmFailure = (code: FarmErrorCode, detail: string): FarmResult<never> => ({ ok: false, error: { code, detail } })

export const farmRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
export const farmExactKeys = (v: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key))
