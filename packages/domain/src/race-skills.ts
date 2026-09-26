// Safe R2.5 race-skill compiler and loadout rules (docs/design/racing.md#basic-race-skills-r25).

import type { SkillTemplate, UmaTemplate } from './content'
import type { SkillUnlock, UmaSave } from './save'

export const RACE_SKILL_SCALE = 10_000
export const SKILL_ACTIVATION_MIN = 0.2
export const SKILL_ACTIVATION_WIT_DIVISOR = 90
export const CONDITION_PATTERN = /^([a-zA-Z0-9_]+)(<=|>=|==|!=|<|>)(-?[0-9]+(?:\.[0-9]+)?)$/

export type RaceConditionOperator = '<=' | '>=' | '==' | '!=' | '<' | '>'

export interface RaceConditionAtom {
  variable: string
  operator: RaceConditionOperator
  value: number
}

/** OR groups containing AND comparisons. */
export type RaceCondition = RaceConditionAtom[][]

export type RaceSkillEffectKind =
  | 'recovery' | 'current-speed' | 'current-speed-natural' | 'target-speed' | 'acceleration'
  /** Engine v5 "green" skills: a flat stat gain applied at the gate (M018). */
  | 'passive-speed' | 'passive-stamina' | 'passive-power' | 'passive-guts' | 'passive-wit'
  /** Engine v5 gate skills: multiplies the start delay. */
  | 'start-delay'

export const RACE_SKILL_EFFECT_KINDS: readonly RaceSkillEffectKind[] = [
  'recovery', 'current-speed', 'current-speed-natural', 'target-speed', 'acceleration',
  'passive-speed', 'passive-stamina', 'passive-power', 'passive-guts', 'passive-wit', 'start-delay',
]

/** Effects resolved once at the gate rather than during the race. */
export const GATE_EFFECT_KINDS: ReadonlySet<RaceSkillEffectKind> = new Set([
  'passive-speed', 'passive-stamina', 'passive-power', 'passive-guts', 'passive-wit', 'start-delay',
])

export interface RaceSkillEffect {
  kind: RaceSkillEffectKind
  amount: number
}

export interface CompiledRaceSkillGroup {
  precondition: RaceCondition | null
  condition: RaceCondition
  duration: number
  cooldown: number
  effects: RaceSkillEffect[]
  unsupportedVariables: string[]
  unsupportedEffects: number[]
}

export interface CompiledRaceSkill {
  id: string
  activation: 'guaranteed' | 'wit'
  groups: CompiledRaceSkillGroup[]
  inherited: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function parseCompiledCondition(value: unknown): RaceCondition | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 16) return null
  const groups: RaceCondition = []
  for (const group of value) {
    if (!Array.isArray(group) || group.length === 0 || group.length > 16) return null
    const atoms: RaceConditionAtom[] = []
    for (const atom of group) {
      if (!isRecord(atom) || !exactKeys(atom, ['variable', 'operator', 'value'])) return null
      if (
        typeof atom.variable !== 'string' || !/^[a-zA-Z0-9_]+$/.test(atom.variable) ||
        !['<=', '>=', '==', '!=', '<', '>'].includes(String(atom.operator)) ||
        typeof atom.value !== 'number' || !Number.isFinite(atom.value)
      ) return null
      atoms.push({ variable: atom.variable, operator: atom.operator as RaceConditionOperator, value: atom.value })
    }
    groups.push(atoms)
  }
  return groups
}

export function parseCompiledRaceSkill(value: unknown): CompiledRaceSkill | null {
  if (!isRecord(value) || !exactKeys(value, ['id', 'activation', 'groups', 'inherited'])) return null
  if (
    typeof value.id !== 'string' || !/^[A-Za-z0-9_.:-]{1,120}$/.test(value.id) ||
    !['guaranteed', 'wit'].includes(String(value.activation)) || typeof value.inherited !== 'boolean' ||
    !Array.isArray(value.groups) || value.groups.length === 0 || value.groups.length > 16
  ) return null
  const groups: CompiledRaceSkillGroup[] = []
  for (const raw of value.groups) {
    if (!isRecord(raw) || !exactKeys(raw, [
      'precondition', 'condition', 'duration', 'cooldown', 'effects', 'unsupportedVariables', 'unsupportedEffects',
    ])) return null
    const precondition = raw.precondition === null ? null : parseCompiledCondition(raw.precondition)
    const condition = parseCompiledCondition(raw.condition)
    if (
      (raw.precondition !== null && !precondition) || !condition ||
      typeof raw.duration !== 'number' || !Number.isFinite(raw.duration) || raw.duration < -1 ||
      typeof raw.cooldown !== 'number' || !Number.isFinite(raw.cooldown) || raw.cooldown < 0 ||
      !Array.isArray(raw.effects) || !Array.isArray(raw.unsupportedVariables) || !Array.isArray(raw.unsupportedEffects)
    ) return null
    const effects: RaceSkillEffect[] = []
    for (const effect of raw.effects) {
      if (!isRecord(effect) || !exactKeys(effect, ['kind', 'amount'])) return null
      if (
        !RACE_SKILL_EFFECT_KINDS.includes(effect.kind as RaceSkillEffectKind) ||
        typeof effect.amount !== 'number' || !Number.isFinite(effect.amount)
      ) return null
      effects.push({ kind: effect.kind as RaceSkillEffectKind, amount: effect.amount })
    }
    if (
      raw.unsupportedVariables.some((item) => typeof item !== 'string' || !/^[a-zA-Z0-9_]+$/.test(item)) ||
      raw.unsupportedEffects.some((item) => !Number.isSafeInteger(item))
    ) return null
    groups.push({
      precondition,
      condition,
      duration: raw.duration,
      cooldown: raw.cooldown,
      effects,
      unsupportedVariables: [...raw.unsupportedVariables] as string[],
      unsupportedEffects: [...raw.unsupportedEffects] as number[],
    })
  }
  return { id: value.id, activation: value.activation as 'guaranteed' | 'wit', inherited: value.inherited, groups }
}

export const BASIC_RACE_VARIABLES = new Set([
  'always',
  'base_guts',
  'base_power',
  'base_speed',
  'base_stamina',
  'base_wiz',
  'course_distance',
  'distance_rate',
  'distance_type',
  'furlong',
  'ground_type',
  'hp_per',
  'is_badstart',
  'is_goodstart',
  'is_lastspurt',
  'lastspurt',
  'order',
  'order_rate',
  'phase',
  'phase_firsthalf',
  'phase_firsthalf_random',
  'phase_laterhalf',
  'phase_laterhalf_random',
  'phase_random',
  'post_number',
  'remain_distance',
  'running_style',
  'season',
  'time',
])

/** Dynamic pack/course facts needed by every launch unique in engine R3. */
export const PACK_RACE_VARIABLES = new Set([
  'bashin_diff_behind',
  'bashin_diff_infront',
  'blocked_front',
  'blocked_side_continuetime',
  'change_order_onetime',
  'change_order_up_end_after',
  'corner',
  'distance_diff_rate',
  'is_finalcorner',
  'is_finalcorner_laterhalf',
  'is_overtake',
  'near_count',
  'temptation_count',
])

/**
 * Engine v5 conditions (M018): the race clock, course facts and simple counters. Ground condition, weather and mood
 * are fixed at Good, sunny and normal until the game models them.
 */
export const COURSE_RACE_VARIABLES = new Set([
  'accumulatetime',
  'activate_count_all',
  'activate_count_end_after',
  'activate_count_heal',
  'activate_count_later_half',
  'activate_count_middle',
  'activate_count_start',
  'behind_near_lane_time',
  'blocked_front_continuetime',
  'compete_fight_count',
  'corner_count',
  'distance_diff_top',
  'distance_diff_top_float',
  'ground_condition',
  'infront_near_lane_time',
  'is_basis_distance',
  'is_dirtgrade',
  'is_last_straight',
  'is_last_straight_onetime',
  'motivation',
  'overtake_target_time',
  'rotation',
  'running_style_count_nige_otherself',
  'running_style_count_oikomi_otherself',
  'running_style_count_sashi_otherself',
  'running_style_count_same',
  'running_style_count_same_rate',
  'running_style_count_senko_otherself',
  'slope',
  'track_id',
  'weather',
])

/** Random points on the course, drawn once per race from its snapshotted geometry (engine v5). */
export const RANDOM_COURSE_VARIABLES = new Set([
  'all_corner_random',
  'corner_random',
  'distance_rate_after_random',
  'down_slope_random',
  'is_finalcorner_random',
  'phase_corner_random',
  'phase_firstquarter_random',
  'phase_straight_random',
  'straight_random',
  'up_slope_random',
])

export const RACE_VARIABLES = new Set([
  ...BASIC_RACE_VARIABLES,
  ...PACK_RACE_VARIABLES,
  ...COURSE_RACE_VARIABLES,
  ...RANDOM_COURSE_VARIABLES,
])

export const RANDOM_PHASE_VARIABLES = new Set([
  'phase_random',
  'phase_firsthalf_random',
  'phase_laterhalf_random',
])

const EFFECT_KIND: Readonly<Record<number, RaceSkillEffectKind>> = {
  1: 'passive-speed',
  2: 'passive-stamina',
  3: 'passive-power',
  4: 'passive-guts',
  5: 'passive-wit',
  9: 'recovery',
  10: 'start-delay',
  21: 'current-speed',
  22: 'current-speed-natural',
  27: 'target-speed',
  31: 'acceleration',
  37: 'target-speed',
  42: 'target-speed',
  48: 'acceleration',
}

export function parseRaceCondition(value: string | null): RaceCondition | null {
  if (value === null) return null
  if (value.length === 0 || value.length > 2_000) throw new Error('Race skill condition is empty or too long')
  const alternatives = value.split('@')
  if (alternatives.length > 16) throw new Error('Race skill condition has too many alternatives')
  return alternatives.map((alternative) => {
    const comparisons = alternative.split('&')
    if (comparisons.length === 0 || comparisons.length > 16) throw new Error('Race skill condition has too many comparisons')
    return comparisons.map((comparison) => {
      const match = comparison.match(CONDITION_PATTERN)
      if (!match) throw new Error(`Unsupported race skill comparison: ${comparison}`)
      const numeric = Number(match[3])
      if (!Number.isFinite(numeric)) throw new Error(`Invalid race skill comparison: ${comparison}`)
      return { variable: match[1]!, operator: match[2] as RaceConditionOperator, value: numeric }
    })
  })
}

export function raceConditionVariables(condition: RaceCondition | null): string[] {
  return condition ? [...new Set(condition.flatMap((group) => group.map((atom) => atom.variable)))].sort() : []
}

function unsupportedConditionVariables(
  condition: RaceCondition | null,
  supportedVariables: ReadonlySet<string>,
): string[] {
  if (!condition) return []
  return condition.flatMap((alternative) => alternative.flatMap((atom) => {
    if (!supportedVariables.has(atom.variable)) return [atom.variable]
    if (
      RANDOM_PHASE_VARIABLES.has(atom.variable) &&
      (atom.operator !== '==' || !Number.isInteger(atom.value) || atom.value < 0 || atom.value > 3)
    ) return [atom.variable]
    if (RANDOM_COURSE_VARIABLES.has(atom.variable) && (atom.operator !== '==' || !Number.isInteger(atom.value) || atom.value < 0)) {
      return [atom.variable]
    }
    return []
  }))
}

export function evaluateRaceCondition(condition: RaceCondition | null, context: Readonly<Record<string, number>>): boolean {
  if (condition === null) return true
  return condition.some((group) => group.every((atom) => {
    const actual = context[atom.variable]
    if (actual === undefined || !Number.isFinite(actual)) return false
    if (atom.operator === '<=') return actual <= atom.value
    if (atom.operator === '>=') return actual >= atom.value
    if (atom.operator === '==') return actual === atom.value
    if (atom.operator === '!=') return actual !== atom.value
    if (atom.operator === '<') return actual < atom.value
    return actual > atom.value
  }))
}

export function compileRaceSkill(
  template: SkillTemplate,
  supportedVariables: ReadonlySet<string> = RACE_VARIABLES,
): CompiledRaceSkill {
  const inherited = template.kind === 'inherited-unique'
  const magnitude = inherited ? 0.5 : 1
  return {
    id: template.id,
    activation: template.activation === 1 ? 'wit' : 'guaranteed',
    inherited,
    groups: template.conditions.map((group) => {
      const precondition = parseRaceCondition(group.precondition)
      const condition = parseRaceCondition(group.condition?.trim() ? group.condition : 'always==1')!
      const unsupportedVariables = [...new Set([
        ...unsupportedConditionVariables(precondition, supportedVariables),
        ...unsupportedConditionVariables(condition, supportedVariables),
      ])].sort()
      // Only a runner's own effects apply; ones aimed at anyone else are dropped, not deferred (D141).
      const own = group.effects.filter((effect) => effect.target === undefined)
      const unsupportedEffects = [...new Set(own.filter((effect) => !EFFECT_KIND[effect.type]).map((effect) => effect.type))].sort((a, b) => a - b)
      return {
        precondition,
        condition,
        duration: group.baseTime === -1 ? -1 : Math.max(0, (group.baseTime ?? 0) / RACE_SKILL_SCALE),
        cooldown: Math.max(0, (group.cooldown ?? 0) / RACE_SKILL_SCALE),
        effects: own.flatMap((effect) => {
          const kind = EFFECT_KIND[effect.type]
          // A gate multiplier is a ratio, not a magnitude, so inheriting a skill does not halve it.
          return kind ? [{ kind, amount: (effect.value / RACE_SKILL_SCALE) * (kind === 'start-delay' ? 1 : magnitude) }] : []
        }),
        unsupportedVariables,
        unsupportedEffects,
      }
    }),
  }
}

/** Every effect in the skill is aimed at someone else: in a one-Uma game it can never do anything (D141). */
export const skillAimsAtOthers = (template: SkillTemplate): boolean =>
  template.conditions.every((group) => group.effects.length > 0 && group.effects.every((effect) => effect.target !== undefined))

export const raceSkillSupported = (skill: CompiledRaceSkill): boolean =>
  skill.groups.some((group) => group.effects.length > 0 && group.unsupportedVariables.length === 0 && group.unsupportedEffects.length === 0)

export interface RaceSkillCourseFacts {
  distance: number
  surface: 'turf' | 'dirt'
  season?: number
}

function conditionPossibleOnCourse(condition: RaceCondition | null, context: Readonly<Record<string, number>>): boolean {
  if (condition === null) return true
  return condition.some((alternative) => alternative.every((atom) =>
    context[atom.variable] === undefined || evaluateRaceCondition([[atom]], context),
  ))
}

/** Static compatibility only; dynamic position/HP facts are intentionally treated as possible. */
export function raceSkillCompatibleWithCourse(skill: CompiledRaceSkill, course: RaceSkillCourseFacts): boolean {
  const context = {
    course_distance: course.distance,
    distance_type: course.distance <= 1_400 ? 1 : course.distance <= 1_800 ? 2 : course.distance <= 2_400 ? 3 : 4,
    ground_type: course.surface === 'turf' ? 1 : 2,
    season: course.season ?? 0,
  }
  return skill.groups.some((group) =>
    group.effects.length > 0 && group.unsupportedVariables.length === 0 && group.unsupportedEffects.length === 0 &&
    conditionPossibleOnCourse(group.precondition, context) && conditionPossibleOnCourse(group.condition, context),
  )
}

export interface RaceSkillCoverage {
  total: number
  supported: number
  unsupported: number
  byKind: Record<string, { total: number; supported: number }>
  unsupportedVariables: Record<string, number>
  unsupportedEffects: Record<string, number>
}

/** Validate every private skill field consumed by the compiler before race preparation. */
export function assertRaceSkillContent(skills: readonly SkillTemplate[]): void {
  const ids = new Set<string>()
  for (const skill of skills) {
    if (
      !isRecord(skill) || !exactKeys(skill, [
        'id', 'kind', 'name', 'description', 'costSp', 'iconId', 'activation', 'conditions', 'inheritedSkillId', 'normalSkillId',
      ]) || typeof skill.id !== 'string' || !/^[A-Za-z0-9_.:-]{1,120}$/.test(skill.id) || ids.has(skill.id) ||
      !['white', 'gold', 'unique-upgraded', 'inherited-unique', 'unique'].includes(String(skill.kind)) ||
      typeof skill.name !== 'string' || skill.name.length === 0 || typeof skill.description !== 'string' ||
      (skill.costSp !== null && (!Number.isSafeInteger(skill.costSp) || skill.costSp < 0)) ||
      (skill.iconId !== null && (!Number.isSafeInteger(skill.iconId) || skill.iconId < 0)) ||
      ![undefined, null, 0, 1].includes(skill.activation) ||
      (skill.inheritedSkillId !== null && (typeof skill.inheritedSkillId !== 'string' || !/^[A-Za-z0-9_.:-]{1,120}$/.test(skill.inheritedSkillId))) ||
      (skill.normalSkillId !== null && (typeof skill.normalSkillId !== 'string' || !/^[A-Za-z0-9_.:-]{1,120}$/.test(skill.normalSkillId))) ||
      !Array.isArray(skill.conditions) || skill.conditions.length < 1 || skill.conditions.length > 16
    ) throw new Error(`Skill ${String(skill.id)} has invalid race data`)
    for (const group of skill.conditions) {
      if (
        !isRecord(group) || !exactKeys(group, ['precondition', 'condition', 'baseTime', 'cooldown', 'effects']) ||
        (group.precondition !== null && typeof group.precondition !== 'string') ||
        (group.condition !== null && typeof group.condition !== 'string') ||
        (group.baseTime !== null && (typeof group.baseTime !== 'number' || !Number.isFinite(group.baseTime) || group.baseTime < -1)) ||
        (group.cooldown !== null && (typeof group.cooldown !== 'number' || !Number.isFinite(group.cooldown) || group.cooldown < 0)) ||
        !Array.isArray(group.effects) || group.effects.length < 1 || group.effects.length > 16 ||
        group.effects.some((effect) => !isRecord(effect) ||
          !(exactKeys(effect, ['type', 'value']) || (exactKeys(effect, ['type', 'value', 'target']) && Number.isSafeInteger(effect.target))) ||
          !Number.isSafeInteger(effect.type) || typeof effect.value !== 'number' || !Number.isFinite(effect.value))
      ) throw new Error(`Skill ${skill.id} has an invalid race condition group`)
    }
    compileRaceSkill(skill)
    ids.add(skill.id)
  }
}

/** Deterministic aggregate for importer diagnostics. It contains counts only, never private names or ids. */
export function summarizeRaceSkillCoverage(skills: readonly SkillTemplate[]): RaceSkillCoverage {
  const byKind: RaceSkillCoverage['byKind'] = {}
  const unsupportedVariables: Record<string, number> = {}
  const unsupportedEffects: Record<string, number> = {}
  let supported = 0
  for (const template of skills) {
    const compiled = compileRaceSkill(template)
    const isSupported = raceSkillSupported(compiled)
    supported += isSupported ? 1 : 0
    const kind = byKind[template.kind] ?? { total: 0, supported: 0 }
    kind.total += 1
    kind.supported += isSupported ? 1 : 0
    byKind[template.kind] = kind
    for (const variable of new Set(compiled.groups.flatMap((group) => group.unsupportedVariables))) {
      unsupportedVariables[variable] = (unsupportedVariables[variable] ?? 0) + 1
    }
    for (const effect of new Set(compiled.groups.flatMap((group) => group.unsupportedEffects))) {
      const key = String(effect)
      unsupportedEffects[key] = (unsupportedEffects[key] ?? 0) + 1
    }
  }
  const sortedRecord = <T>(value: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
  return {
    total: skills.length,
    supported,
    unsupported: skills.length - supported,
    byKind: sortedRecord(byKind),
    unsupportedVariables: sortedRecord(unsupportedVariables),
    unsupportedEffects: sortedRecord(unsupportedEffects),
  }
}

/**
 * The original's unique-skill level multipliers at Lv5, a fully starred Uma's own unique (D158): target speed ×1.10,
 * acceleration ×1.08 and every other race effect ×1.08. Gate effects (stats, start delay) are left as they are.
 */
export const UNIQUE_SKILL_LEVEL_5: Readonly<Record<'target-speed' | 'acceleration' | 'other', number>> = {
  'target-speed': 1.1,
  acceleration: 1.08,
  other: 1.08,
}

/** An Uma's own unique at Lv5 (engine v7, D158). Inherited uniques keep their own values. */
export function levelUniqueSkill(skill: CompiledRaceSkill): CompiledRaceSkill {
  const multiplier = (kind: RaceSkillEffectKind) => GATE_EFFECT_KINDS.has(kind) ? 1
    : kind === 'target-speed' || kind === 'acceleration' ? UNIQUE_SKILL_LEVEL_5[kind] : UNIQUE_SKILL_LEVEL_5.other
  return {
    ...skill,
    groups: skill.groups.map((group) => ({
      ...group,
      effects: group.effects.map((effect) => ({ ...effect, amount: effect.amount * multiplier(effect.kind) })),
    })),
  }
}

/**
 * Selects the four shared NPC whites without embedding private ids in source control.
 * Stable id ordering makes the result fixed for a content version.
 */
export function selectBaselineRaceSkills(skills: readonly SkillTemplate[]): CompiledRaceSkill[] {
  const excludedVariables = new Set(['running_style', 'distance_type', 'ground_type', 'season', 'course_distance'])
  const candidates = skills
    .filter((skill) => skill.kind === 'white' && Number.isSafeInteger(skill.costSp) && skill.costSp! > 0)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((template) => ({ template, compiled: compileRaceSkill(template) }))
    .filter(({ compiled }) => raceSkillSupported(compiled))
    .filter(({ compiled }) => !compiled.groups.some((group) =>
      [...raceConditionVariables(group.precondition), ...raceConditionVariables(group.condition)]
        .some((variable) => excludedVariables.has(variable)),
    ))
  const chosen: CompiledRaceSkill[] = []
  const hasEffect = (skill: CompiledRaceSkill, kind: RaceSkillEffectKind) =>
    skill.groups.some((group) => group.effects.some((effect) => effect.kind === kind))
  const hasPhase = (skill: CompiledRaceSkill, phases: ReadonlySet<number>) => skill.groups.some((group) =>
    [group.precondition, group.condition].some((condition) => condition?.some((alternative) => alternative.some((atom) =>
      (atom.variable === 'phase' || RANDOM_PHASE_VARIABLES.has(atom.variable)) &&
      phases.has(atom.value) && ['==', '>='].includes(atom.operator),
    ))),
  )
  const take = (label: string, predicate: (skill: CompiledRaceSkill) => boolean) => {
    const match = candidates.find(({ compiled }) =>
      !chosen.some((skill) => skill.id === compiled.id) && predicate(compiled),
    )
    if (!match) throw new Error(`Private content cannot supply the baseline NPC ${label} skill`)
    chosen.push(match.compiled)
  }
  take('recovery', (skill) => hasEffect(skill, 'recovery'))
  take('mid-race speed', (skill) => hasEffect(skill, 'target-speed') && hasPhase(skill, new Set([1])))
  take('late-race speed', (skill) => hasEffect(skill, 'target-speed') && hasPhase(skill, new Set([2, 3])))
  take('acceleration', (skill) => hasEffect(skill, 'acceleration'))
  return chosen
}

export interface SkillLoadoutSummary {
  valid: boolean
  cost: number
  cap: number
  errors: string[]
  skills: SkillTemplate[]
}

/** The derived shape a loadout is checked against; `deriveUma` produces one. */
export interface SkillLoadoutSource {
  library: readonly SkillUnlock[]
  skillPoints: number
  loadoutSkillIds: readonly string[]
}

export function summarizeSkillLoadout(
  source: SkillLoadoutSource,
  template: UmaTemplate,
  skillsById: ReadonlyMap<string, SkillTemplate>,
  ids: readonly string[] = source.loadoutSkillIds,
): SkillLoadoutSummary {
  const errors: string[] = []
  const library = new Map(source.library.map((skill) => [skill.skillId, skill]))
  if (new Set(ids).size !== ids.length) errors.push('The loadout contains a duplicate skill')
  const skills = ids.flatMap((id) => {
    const unlock = library.get(id)
    const skill = skillsById.get(id)
    if (!unlock || !skill) {
      errors.push(`Skill ${id} is not available in this Uma's library`)
      return []
    }
    if (id === template.uniqueSkillId || unlock.origin === 'own-unique') {
      errors.push('The own unique is equipped automatically')
      return []
    }
    if (!Number.isSafeInteger(skill.costSp) || (skill.costSp ?? 0) <= 0) {
      errors.push(`Skill ${id} has no valid SP cost`)
      return []
    }
    if (!raceSkillSupported(compileRaceSkill(skill))) {
      errors.push(skillAimsAtOthers(skill)
        ? `Skill ${id} only affects other runners, so it does nothing in this game`
        : `Skill ${id} needs race mechanics that are not available yet`)
      return []
    }
    return [skill]
  })
  const cost = skills.reduce((sum, skill) => sum + skill.costSp!, 0)
  if (cost > source.skillPoints) {
    errors.push(`Loadout costs ${cost} SP but only ${source.skillPoints} SP is available`)
  }
  return { valid: errors.length === 0, cost, cap: source.skillPoints, errors, skills }
}

/**
 * The equipped skills that race when the loadout costs more than the Uma now earns — moving a Friend or Group card
 * off its nodes can take SP away after skills were equipped. Kept in equip order, stopping at the first that no
 * longer fits, so a reconfiguration never blocks a race; the profile shows the overdraft.
 */
export function affordableLoadout(skills: readonly SkillTemplate[], skillPoints: number): SkillTemplate[] {
  const kept: SkillTemplate[] = []
  let spent = 0
  for (const skill of skills) {
    spent += skill.costSp ?? 0
    if (spent > skillPoints) break
    kept.push(skill)
  }
  return kept
}

/** Returns the validated loadout ids; the caller writes them onto the scenario they belong to. */
export function replaceSkillLoadout(
  source: SkillLoadoutSource,
  template: UmaTemplate,
  skillsById: ReadonlyMap<string, SkillTemplate>,
  ids: readonly string[],
): string[] {
  const summary = summarizeSkillLoadout(source, template, skillsById, ids)
  if (!summary.valid) throw new Error(summary.errors[0])
  return [...ids]
}
