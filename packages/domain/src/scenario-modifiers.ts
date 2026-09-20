// Tier-local scenario training modifiers (docs/design/scenarios.md#scenario-modifiers).

import type { AptitudeCategory } from './inheritance'
import {
  DISTANCE_CATEGORIES,
  GRADES,
  STATS,
  STRATEGIES,
  SURFACES,
  type Aptitudes,
  type GainKey,
  type Grade,
  type StatKey,
} from './types'

export const SCENARIO_MODIFIER_VERSION = 1 as const
export const TEAM_SPIRIT_CARD_THRESHOLD = 3
export const TEAM_SPIRIT_STAT_BONUS = 10
export const CLIMAX_ITEMS_PER_WIN = 1
export const CLIMAX_TRAINING_MULTIPLIER = 1.2
export const PERFORMANCE_NOTE_COUNT = 5
export const PERFORMANCE_STAT_BONUS = 20
export const GODDESS_FRAGMENT_THRESHOLD = 8
export const GODDESS_BURST_MULTIPLIER = 1.5
export const EXPEDITION_STAMP_THRESHOLD = 5

export const SCENARIO_MODIFIER_KINDS = [
  'team-spirit',
  'climax',
  'performances',
  'goddess-fragments',
  'expedition',
] as const

export interface TeamSpiritModifierState {
  version: typeof SCENARIO_MODIFIER_VERSION
  tier: 2
  kind: 'team-spirit'
  bursts: number
}

export interface ClimaxModifierState {
  version: typeof SCENARIO_MODIFIER_VERSION
  tier: 3
  kind: 'climax'
  earned: number
  stock: number
  used: number
}

export interface PerformancesModifierState {
  version: typeof SCENARIO_MODIFIER_VERSION
  tier: 4
  kind: 'performances'
  notes: StatKey[]
  performances: number
}

export interface GoddessFragmentsModifierState {
  version: typeof SCENARIO_MODIFIER_VERSION
  tier: 5
  kind: 'goddess-fragments'
  fragments: number
  bursts: number
}

export interface ExpeditionModifierState {
  version: typeof SCENARIO_MODIFIER_VERSION
  tier: 6
  kind: 'expedition'
  stamps: number
  completed: number
  upgraded: number
}

export type ScenarioModifierState =
  | TeamSpiritModifierState
  | ClimaxModifierState
  | PerformancesModifierState
  | GoddessFragmentsModifierState
  | ExpeditionModifierState

export interface ScenarioModifierDefinition {
  tier: 2 | 3 | 4 | 5 | 6
  kind: ScenarioModifierState['kind']
  name: string
  shortRule: string
}

export type ScenarioTrainingModifierEffect =
  | {
    kind: 'team-spirit'
    triggered: boolean
    presentCardCount: number
    bonusGains: Partial<Record<GainKey, number>>
  }
  | {
    kind: 'climax'
    triggered: boolean
    multiplier: number
    itemConsumed: boolean
  }
  | {
    kind: 'performances'
    note: StatKey
    collected: boolean
    completed: boolean
    bonusGains: Partial<Record<GainKey, number>>
  }
  | {
    kind: 'goddess-fragments'
    fragmentGranted: boolean
    fragmentCount: number
    burst: boolean
    multiplier: number
  }
  | {
    kind: 'expedition'
    stampGranted: boolean
    stampCount: number
    ready: boolean
  }

export interface ScenarioTrainingModifierProjection {
  rawGains: Partial<Record<GainKey, number>>
  nextState: ScenarioModifierState | null
  effect: ScenarioTrainingModifierEffect | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort()
  const sorted = [...expected].sort()
  return actual.length === sorted.length && actual.every((key, index) => key === sorted[index])
}

const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0

const canonicalNotes = (value: unknown): value is StatKey[] =>
  Array.isArray(value) && value.length < PERFORMANCE_NOTE_COUNT &&
  value.every((note) => STATS.includes(note as StatKey)) &&
  value.every((note, index) => index === 0 || STATS.indexOf(value[index - 1] as StatKey) < STATS.indexOf(note as StatKey))

export function parseScenarioModifierState(value: unknown): ScenarioModifierState | null {
  if (!isRecord(value) || value.version !== SCENARIO_MODIFIER_VERSION) return null
  if (value.kind === 'team-spirit') {
    if (!exactKeys(value, ['version', 'tier', 'kind', 'bursts']) || value.tier !== 2 || !isCount(value.bursts)) return null
    return { version: SCENARIO_MODIFIER_VERSION, tier: 2, kind: 'team-spirit', bursts: value.bursts }
  }
  if (value.kind === 'climax') {
    if (!exactKeys(value, ['version', 'tier', 'kind', 'earned', 'stock', 'used']) || value.tier !== 3 ||
      !isCount(value.earned) || !isCount(value.stock) || !isCount(value.used) || value.stock + value.used !== value.earned) return null
    return {
      version: SCENARIO_MODIFIER_VERSION,
      tier: 3,
      kind: 'climax',
      earned: value.earned,
      stock: value.stock,
      used: value.used,
    }
  }
  if (value.kind === 'performances') {
    if (!exactKeys(value, ['version', 'tier', 'kind', 'notes', 'performances']) || value.tier !== 4 ||
      !canonicalNotes(value.notes) || !isCount(value.performances)) return null
    return {
      version: SCENARIO_MODIFIER_VERSION,
      tier: 4,
      kind: 'performances',
      notes: [...value.notes],
      performances: value.performances,
    }
  }
  if (value.kind === 'goddess-fragments') {
    if (!exactKeys(value, ['version', 'tier', 'kind', 'fragments', 'bursts']) || value.tier !== 5 ||
      !isCount(value.fragments) || value.fragments >= GODDESS_FRAGMENT_THRESHOLD || !isCount(value.bursts)) return null
    return {
      version: SCENARIO_MODIFIER_VERSION,
      tier: 5,
      kind: 'goddess-fragments',
      fragments: value.fragments,
      bursts: value.bursts,
    }
  }
  if (value.kind === 'expedition') {
    if (!exactKeys(value, ['version', 'tier', 'kind', 'stamps', 'completed', 'upgraded']) || value.tier !== 6 ||
      !isCount(value.stamps) || value.stamps > EXPEDITION_STAMP_THRESHOLD || !isCount(value.completed) ||
      !isCount(value.upgraded) || value.upgraded > value.completed) return null
    return {
      version: SCENARIO_MODIFIER_VERSION,
      tier: 6,
      kind: 'expedition',
      stamps: value.stamps,
      completed: value.completed,
      upgraded: value.upgraded,
    }
  }
  return null
}

export function scenarioModifierDefinition(tier: number): ScenarioModifierDefinition | null {
  if (tier === 2) return {
    tier: 2,
    kind: 'team-spirit',
    name: 'Team Spirit',
    shortRule: `${TEAM_SPIRIT_CARD_THRESHOLD}+ cards at one facility add +${TEAM_SPIRIT_STAT_BONUS} to all five stats.`,
  }
  if (tier === 3) return {
    tier: 3,
    kind: 'climax',
    name: 'Climax',
    shortRule: `Eligible wins grant one item for a ×${CLIMAX_TRAINING_MULTIPLIER.toFixed(2)} training.`,
  }
  if (tier === 4) return {
    tier: 4,
    kind: 'performances',
    name: 'Performances',
    shortRule: `Collect all ${PERFORMANCE_NOTE_COUNT} facility notes for +${PERFORMANCE_STAT_BONUS} to all five stats.`,
  }
  if (tier === 5) return {
    tier: 5,
    kind: 'goddess-fragments',
    name: 'Goddess Fragments',
    shortRule: `Every ${GODDESS_FRAGMENT_THRESHOLD}th training gets ×${GODDESS_BURST_MULTIPLIER.toFixed(2)} raw stat and SP gains.`,
  }
  if (tier === 6) return {
    tier: 6,
    kind: 'expedition',
    name: 'Expedition',
    shortRule: `${EXPEDITION_STAMP_THRESHOLD} training stamps fund one chosen aptitude upgrade, capped at A.`,
  }
  return null
}

export function createScenarioModifierState(tier: number): ScenarioModifierState | null {
  if (tier === 2) return { version: SCENARIO_MODIFIER_VERSION, tier: 2, kind: 'team-spirit', bursts: 0 }
  if (tier === 3) return { version: SCENARIO_MODIFIER_VERSION, tier: 3, kind: 'climax', earned: 0, stock: 0, used: 0 }
  if (tier === 4) return { version: SCENARIO_MODIFIER_VERSION, tier: 4, kind: 'performances', notes: [], performances: 0 }
  if (tier === 5) return { version: SCENARIO_MODIFIER_VERSION, tier: 5, kind: 'goddess-fragments', fragments: 0, bursts: 0 }
  if (tier === 6) return { version: SCENARIO_MODIFIER_VERSION, tier: 6, kind: 'expedition', stamps: 0, completed: 0, upgraded: 0 }
  return null
}

function assertRawGains(gains: Partial<Record<GainKey, number>>): void {
  for (const value of Object.values(gains)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Scenario modifier received invalid Training gains')
  }
}

export function projectScenarioTrainingModifier(input: {
  state: ScenarioModifierState | null
  rawGains: Partial<Record<GainKey, number>>
  presentCardCount: number
  useClimaxItem?: boolean
  facility?: StatKey
}): ScenarioTrainingModifierProjection {
  assertRawGains(input.rawGains)
  if (!Number.isSafeInteger(input.presentCardCount) || input.presentCardCount < 0) throw new Error('Scenario modifier received an invalid card count')
  const useClimaxItem = input.useClimaxItem ?? false
  if (!input.state) {
    if (useClimaxItem) throw new Error('No Climax item is available for this scenario')
    return { rawGains: { ...input.rawGains }, nextState: null, effect: null }
  }
  if (input.state.kind === 'team-spirit') {
    if (useClimaxItem) throw new Error('Climax items are unavailable in Unity Cup')
    const triggered = input.presentCardCount >= TEAM_SPIRIT_CARD_THRESHOLD
    const bonusGains: Partial<Record<GainKey, number>> = triggered
      ? Object.fromEntries(STATS.map((stat) => [stat, TEAM_SPIRIT_STAT_BONUS]))
      : {}
    const rawGains = { ...input.rawGains }
    if (triggered) for (const stat of STATS) rawGains[stat] = (rawGains[stat] ?? 0) + TEAM_SPIRIT_STAT_BONUS
    return {
      rawGains,
      nextState: triggered ? { ...input.state, bursts: input.state.bursts + 1 } : input.state,
      effect: { kind: 'team-spirit', triggered, presentCardCount: input.presentCardCount, bonusGains },
    }
  }
  if (input.state.kind === 'climax' && !useClimaxItem) {
    return {
      rawGains: { ...input.rawGains },
      nextState: input.state,
      effect: { kind: 'climax', triggered: false, multiplier: CLIMAX_TRAINING_MULTIPLIER, itemConsumed: false },
    }
  }
  if (input.state.kind === 'climax') {
    if (input.state.stock < 1) throw new Error('No Climax item is available')
    const rawGains = multiplyRawGains(input.rawGains, CLIMAX_TRAINING_MULTIPLIER)
    return {
      rawGains,
      nextState: { ...input.state, stock: input.state.stock - 1, used: input.state.used + 1 },
      effect: { kind: 'climax', triggered: true, multiplier: CLIMAX_TRAINING_MULTIPLIER, itemConsumed: true },
    }
  }
  if (useClimaxItem) throw new Error('Climax items are unavailable in this scenario')
  if (input.state.kind === 'performances') {
    if (!input.facility) throw new Error('Grand Concert Training requires a facility note')
    const collected = !input.state.notes.includes(input.facility)
    const collectedNotes = new Set(input.state.notes)
    if (collected) collectedNotes.add(input.facility)
    const notes = collected ? STATS.filter((note) => collectedNotes.has(note)) : input.state.notes
    const completed = collected && notes.length === PERFORMANCE_NOTE_COUNT
    const bonusGains: Partial<Record<GainKey, number>> = completed
      ? Object.fromEntries(STATS.map((stat) => [stat, PERFORMANCE_STAT_BONUS]))
      : {}
    const rawGains = { ...input.rawGains }
    if (completed) for (const stat of STATS) rawGains[stat] = (rawGains[stat] ?? 0) + PERFORMANCE_STAT_BONUS
    return {
      rawGains,
      nextState: completed
        ? { ...input.state, notes: [], performances: input.state.performances + 1 }
        : collected ? { ...input.state, notes } : input.state,
      effect: { kind: 'performances', note: input.facility, collected, completed, bonusGains },
    }
  }
  if (input.state.kind === 'goddess-fragments') {
    const burst = input.state.fragments + 1 === GODDESS_FRAGMENT_THRESHOLD
    return {
      rawGains: burst ? multiplyRawGains(input.rawGains, GODDESS_BURST_MULTIPLIER) : { ...input.rawGains },
      nextState: burst
        ? { ...input.state, fragments: 0, bursts: input.state.bursts + 1 }
        : { ...input.state, fragments: input.state.fragments + 1 },
      effect: {
        kind: 'goddess-fragments',
        fragmentGranted: true,
        fragmentCount: burst ? 0 : input.state.fragments + 1,
        burst,
        multiplier: GODDESS_BURST_MULTIPLIER,
      },
    }
  }
  const stampGranted = input.state.stamps < EXPEDITION_STAMP_THRESHOLD
  const stamps = stampGranted ? input.state.stamps + 1 : input.state.stamps
  return {
    rawGains: { ...input.rawGains },
    nextState: stampGranted ? { ...input.state, stamps } : input.state,
    effect: { kind: 'expedition', stampGranted, stampCount: stamps, ready: stamps === EXPEDITION_STAMP_THRESHOLD },
  }
}

function multiplyRawGains(
  rawGains: Partial<Record<GainKey, number>>,
  multiplier: number,
): Partial<Record<GainKey, number>> {
  return Object.fromEntries(
    Object.entries(rawGains).map(([key, value]) => [key, value! * multiplier]),
  ) as Partial<Record<GainKey, number>>
}

const ALL_APTITUDE_CATEGORIES: AptitudeCategory[] = [
  ...SURFACES.map((key) => `surface:${key}` as const),
  ...DISTANCE_CATEGORIES.map((key) => `distance:${key}` as const),
  ...STRATEGIES.map((key) => `strategy:${key}` as const),
]

function readAptitude(aptitudes: Aptitudes, category: AptitudeCategory): Grade {
  const [group, key] = category.split(':') as [keyof Aptitudes, string]
  if (group === 'surface') return aptitudes.surface[key as keyof Aptitudes['surface']]
  if (group === 'distance') return aptitudes.distance[key as keyof Aptitudes['distance']]
  return aptitudes.strategy[key as keyof Aptitudes['strategy']]
}

function writeAptitude(aptitudes: Aptitudes, category: AptitudeCategory, grade: Grade): void {
  const [group, key] = category.split(':') as [keyof Aptitudes, string]
  if (group === 'surface') aptitudes.surface[key as keyof Aptitudes['surface']] = grade
  else if (group === 'distance') aptitudes.distance[key as keyof Aptitudes['distance']] = grade
  else aptitudes.strategy[key as keyof Aptitudes['strategy']] = grade
}

export function expeditionAptitudeOptions(aptitudes: Aptitudes): AptitudeCategory[] {
  return ALL_APTITUDE_CATEGORIES.filter((category) => GRADES.indexOf(readAptitude(aptitudes, category)) > GRADES.indexOf('A'))
}

export interface ExpeditionCompletionResult {
  state: ExpeditionModifierState
  aptitudes: Aptitudes
  category: AptitudeCategory | null
  before: Grade | null
  after: Grade | null
}

export function completeExpedition(input: {
  state: ScenarioModifierState | null
  aptitudes: Aptitudes
  category: AptitudeCategory | null
}): ExpeditionCompletionResult {
  if (!input.state || input.state.kind !== 'expedition') throw new Error('No Project L\'Arc expedition is active')
  if (input.state.stamps !== EXPEDITION_STAMP_THRESHOLD) throw new Error('The expedition is not ready')
  const options = expeditionAptitudeOptions(input.aptitudes)
  if (options.length === 0) {
    if (input.category !== null) throw new Error('Every aptitude is already capped for Expedition')
    return {
      state: { ...input.state, stamps: 0, completed: input.state.completed + 1 },
      aptitudes: cloneAptitudes(input.aptitudes),
      category: null,
      before: null,
      after: null,
    }
  }
  if (input.category === null || !options.includes(input.category)) throw new Error('Choose an eligible Expedition aptitude')
  const aptitudes = cloneAptitudes(input.aptitudes)
  const before = readAptitude(aptitudes, input.category)
  const after = GRADES[Math.max(GRADES.indexOf('A'), GRADES.indexOf(before) - 1)]!
  writeAptitude(aptitudes, input.category, after)
  return {
    state: { ...input.state, stamps: 0, completed: input.state.completed + 1, upgraded: input.state.upgraded + 1 },
    aptitudes,
    category: input.category,
    before,
    after,
  }
}

function cloneAptitudes(aptitudes: Aptitudes): Aptitudes {
  return {
    surface: { ...aptitudes.surface },
    distance: { ...aptitudes.distance },
    strategy: { ...aptitudes.strategy },
  }
}

export function awardClimaxItem(input: {
  state: ScenarioModifierState | null
  won: boolean
  closesTier: boolean
}): { state: ScenarioModifierState | null; awarded: number } {
  if (!input.state || input.state.kind !== 'climax' || !input.won || input.closesTier) {
    return { state: input.state, awarded: 0 }
  }
  return {
    state: {
      ...input.state,
      earned: input.state.earned + CLIMAX_ITEMS_PER_WIN,
      stock: input.state.stock + CLIMAX_ITEMS_PER_WIN,
    },
    awarded: CLIMAX_ITEMS_PER_WIN,
  }
}
