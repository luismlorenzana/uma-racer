// What a skill is for, read off its Global conditions and effects, so a skill list can say which runners, races and
// moments it suits (docs/design/skills-and-inheritance.md#skill-tags). Modelled on uma-planner's tag derivation, which
// reads the same GameTora condition language.

import type { SkillTemplate } from './content'
import type { DistanceCategory, Strategy, Surface } from './types'

export type SkillPhase = 'early' | 'mid' | 'late' | 'spurt'
export type SkillPlace = 'start' | 'corner' | 'straight' | 'final-corner' | 'final-straight' | 'uphill' | 'downhill'
export type SkillEffectTag = 'speed' | 'acceleration' | 'recovery' | 'stats' | 'start' | 'lane' | 'vision' | 'debuff'

export interface SkillTags {
  /** Empty means any running style. */
  strategies: Strategy[]
  /** Empty means any distance. */
  distances: DistanceCategory[]
  surfaces: Surface[]
  phases: SkillPhase[]
  places: SkillPlace[]
  effects: SkillEffectTag[]
}

const STRATEGY_CODE: Record<number, Strategy> = { 1: 'front', 2: 'pace', 3: 'late', 4: 'end' }
const DISTANCE_CODE: Record<number, DistanceCategory> = { 1: 'sprint', 2: 'mile', 3: 'medium', 4: 'long' }
const SURFACE_CODE: Record<number, Surface> = { 1: 'turf', 2: 'dirt' }
const PHASE_CODE: readonly SkillPhase[] = ['early', 'mid', 'late', 'spurt']

// Effect ids are undocumented; these follow the race engine's own reading (race-skills.ts) and uma-planner's.
const EFFECT_CODE: Record<number, SkillEffectTag> = {
  1: 'stats', 2: 'stats', 3: 'stats', 4: 'stats', 5: 'stats',
  8: 'vision', 29: 'vision',
  9: 'recovery',
  10: 'start',
  13: 'debuff',
  21: 'speed', 22: 'speed', 27: 'speed', 37: 'speed', 42: 'speed',
  28: 'lane',
  31: 'acceleration', 48: 'acceleration',
}

const PLACE_PATTERNS: readonly [SkillPlace, RegExp][] = [
  ['start', /is_badstart==1/],
  ['final-corner', /is_finalcorner(_random|_laterhalf)?==1/],
  ['final-straight', /is_last_straight(_onetime)?==1/],
  ['corner', /\bcorner(_random)?(==[1-4]|!=0)|all_corner_random==1/],
  ['straight', /straight_random==1|straight_front_type==[12]|is_straight_front==1/],
  ['uphill', /\bslope==1|up_slope_random==1/],
  ['downhill', /\bslope==2|down_slope_random==1/],
]

const sorted = <T>(values: Set<T>, order: readonly T[]): T[] => order.filter((value) => values.has(value))

/** Tags for one skill, in a stable order. */
export function skillTags(skill: Pick<SkillTemplate, 'conditions'>): SkillTags {
  const text = skill.conditions.flatMap((group) => [group.condition ?? '', group.precondition ?? '']).join(' ')
  const codes = (key: string) => [...text.matchAll(new RegExp(`\\b${key}==(\\d+)`, 'g'))].map((match) => Number(match[1]))

  const strategies = new Set(codes('running_style').map((code) => STRATEGY_CODE[code]).filter(Boolean) as Strategy[])
  const distances = new Set(codes('distance_type').map((code) => DISTANCE_CODE[code]).filter(Boolean) as DistanceCategory[])
  const surfaces = new Set(codes('ground_type').map((code) => SURFACE_CODE[code]).filter(Boolean) as Surface[])

  const phases = new Set<SkillPhase>()
  for (const key of ['phase', 'phase_random', 'phase_laterhalf_random', 'phase_firsthalf_random', 'phase_corner_random', 'phase_straight_random']) {
    for (const code of codes(key)) if (PHASE_CODE[code]) phases.add(PHASE_CODE[code]!)
  }
  // phase>=N means every phase from N on, and phase<=N every phase up to it.
  for (const match of text.matchAll(/\bphase>=(\d+)/g)) PHASE_CODE.slice(Number(match[1])).forEach((phase) => phases.add(phase))
  for (const match of text.matchAll(/\bphase<=(\d+)/g)) PHASE_CODE.slice(0, Number(match[1]) + 1).forEach((phase) => phases.add(phase))

  const places = new Set(PLACE_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([place]) => place))

  const effects = new Set<SkillEffectTag>()
  for (const group of skill.conditions) {
    for (const effect of group.effects) {
      // An effect aimed at someone else, or one that lowers a value, works against rivals (D141).
      if (effect.target !== undefined || effect.value < 0) effects.add('debuff')
      else if (EFFECT_CODE[effect.type]) effects.add(EFFECT_CODE[effect.type]!)
    }
  }

  return {
    strategies: sorted(strategies, ['front', 'pace', 'late', 'end']),
    distances: sorted(distances, ['sprint', 'mile', 'medium', 'long']),
    surfaces: sorted(surfaces, ['turf', 'dirt']),
    phases: sorted(phases, PHASE_CODE),
    places: sorted(places, PLACE_PATTERNS.map(([place]) => place)),
    effects: sorted(effects, ['speed', 'acceleration', 'recovery', 'stats', 'start', 'lane', 'vision', 'debuff']),
  }
}
