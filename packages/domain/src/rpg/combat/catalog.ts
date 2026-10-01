// Composed synthetic RPG skill catalog (docs/design/uma-rpg.md, D229).
import { RPG_ELEMENTS, RPG_WEAPONS, rpgSkillKey, type RpgBranch, type RpgElement,
  type RpgSkillRef, type RpgWeapon } from '../rules'
import type { CombatChannel, CombatStatusKind, CombatTarget } from './types'

export const RPG_ADVANTAGE = 1.5
export const RPG_RESISTANCE = 0.75
export const RPG_DEFENSE_FACTOR = 0.45
export const RPG_GUARD_FACTOR = 0.5
export const RPG_FOLLOW_UP_FACTOR = 0.25
export const RPG_WEAK_FOLLOW_UP_LIMIT = 1
export const RPG_MAX_ROUNDS = 40
export const RPG_STATUS_TURNS = 2
export const RPG_BURN_PERCENT = 0.02
export const RPG_REGEN_PERCENT = 0.04
export const RPG_MARK_PERCENT = 0.1
export const RPG_POWER_PERCENT = 0.15
export const RPG_WARD_PERCENT = 0.15
export const RPG_SLOW_PERCENT = 0.15
export const RPG_STATUS_STACK_CAP = 3
export const RPG_SKILL_LEVEL_STEP = 0.08
export const RPG_BASIC_ATTACK_FACTOR = 1.5
export const RPG_SKILL_DEPTH_STEP = 0.16
export const RPG_AREA_FACTOR = 0.62
export const RPG_MULTI_HIT_FACTOR = 0.58
export const RPG_PHYSICAL_BASE_SHARE = 0.72
export const RPG_ROLE_HEAL_BASE = 1.25
export const RPG_ROLE_HEAL_DEPTH_STEP = 0.2
export const RPG_HYBRID_HEAL_FACTOR = 0.45
export const RPG_SKILL_MP_BASE = 4
export const RPG_SKILL_MP_PER_DEPTH = 3
export const RPG_SKILL_MP_AREA_ADD = 3
export const RPG_ENEMY_MOVE_DENOMINATOR = 100

export interface SkillDefinition {
  id: string
  weapon: RpgWeapon
  element: RpgElement
  channel: CombatChannel
  target: CombatTarget
  mp: number
  /** Multiplier on offense after a single physical/magical defense deduction. */
  base: number
  /** Physical-only elemental part; the matchup changes this part, not the base. */
  rider: number
  heal: number
  status: CombatStatusKind | null
  duration: number
  stack: 'refresh' | 'stack-3' | 'none'
  depth: number
  branch: RpgBranch
  minAffinity: 'A' | 'B'
  intentText: string
}

export interface BasicActionDefinition {
  id: string
  weapon: RpgWeapon
  kind: 'attack' | 'guard'
  channel: CombatChannel
  element: null
  target: 'enemy' | 'ally'
  mp: 0
  base: number
  rider: 0
  duration: number
  stack: 'none'
  gate: 'always'
  intentText: string
}

const PHYSICAL = new Set<RpgWeapon>(['greatsword', 'spear', 'sword-shield'])
const SUPPORT = new Set<RpgWeapon>(['sword-shield', 'cleric-staff'])
const motif: Record<RpgElement, CombatStatusKind> = {
  fire: 'burn', ice: 'slow', lightning: 'mark', light: 'ward', dark: 'weaken',
}
const BRANCHES: readonly (readonly RpgBranch[])[] = [
  ['foundation'], ['focused', 'area'], ['committed', 'multi'], ['role', 'hybrid'], ['signature'],
]
export const RPG_WEAPON_POWER: Readonly<Record<RpgWeapon, number>> = {
  greatsword: 1.2, spear: 1.05, 'sword-shield': 0.82,
  'wizard-staff': 1.12, 'cleric-staff': 0.78, tome: 1.15,
}

export const RPG_BASIC_ACTION_CATALOG: readonly BasicActionDefinition[] = RPG_WEAPONS.flatMap((weapon) => {
  const channel = PHYSICAL.has(weapon) ? 'physical' : 'magical'
  return [
    { id: `${weapon}:attack`, weapon, kind: 'attack', channel, element: null,
      target: 'enemy', mp: 0, base: RPG_BASIC_ATTACK_FACTOR, rider: 0,
      duration: 0, stack: 'none', gate: 'always', intentText: 'Attack' },
    { id: `${weapon}:guard`, weapon, kind: 'guard', channel, element: null,
      target: 'ally', mp: 0, base: 0, rider: 0,
      duration: 1, stack: 'none', gate: 'always', intentText: 'Guard ally' },
  ] as BasicActionDefinition[]
})

function definition(weapon: RpgWeapon, element: RpgElement, depth: number, branch: RpgBranch): SkillDefinition {
  const channel = PHYSICAL.has(weapon) ? 'physical' : 'magical'
  const support = SUPPORT.has(weapon)
  const isArea = branch === 'area'
  const isRole = support && branch === 'role'
  const isHybrid = support && branch === 'hybrid'
  const isHealing = isRole || (support && (branch === 'focused' || branch === 'area')) ||
    (support && element === 'light' && depth === 1)
  const power = RPG_WEAPON_POWER[weapon] * (1 + (depth - 1) * RPG_SKILL_DEPTH_STEP) *
    (isArea ? RPG_AREA_FACTOR : 1)
  const status = isHealing ? (element === 'fire' ? 'regen' : element === 'light' ? 'ward' : 'power-up')
    : element === 'light' ? null : motif[element]
  return {
    id: `${weapon}:${element}:${depth}:${branch}`, weapon, element, channel,
    target: isHealing ? (isArea ? 'all-allies' : 'ally') : isArea ? 'all-enemies' : 'enemy',
    mp: RPG_SKILL_MP_BASE + depth * RPG_SKILL_MP_PER_DEPTH + (isArea ? RPG_SKILL_MP_AREA_ADD : 0),
    base: isHealing ? 0 : channel === 'physical' ? power * RPG_PHYSICAL_BASE_SHARE : power,
    rider: isHealing ? 0 : channel === 'physical' ? power * (1 - RPG_PHYSICAL_BASE_SHARE) : 0,
    heal: isHealing ? (RPG_ROLE_HEAL_BASE + (depth - 1) * RPG_ROLE_HEAL_DEPTH_STEP) *
      (isArea ? RPG_AREA_FACTOR : 1)
      : isHybrid ? RPG_HYBRID_HEAL_FACTOR : 0,
    status, duration: RPG_STATUS_TURNS,
    stack: status === 'burn' || status === 'mark' ? 'stack-3' : status ? 'refresh' : 'none',
    depth, branch, minAffinity: depth > 3 ? 'A' : 'B',
    intentText: `${weapon} ${element} ${branch}`,
  }
}

/** 6 weapons × 5 elements × 8 branches; tier and purchased level live on the skill reference. */
export const RPG_SKILL_CATALOG: readonly SkillDefinition[] = RPG_WEAPONS.flatMap((weapon) =>
  RPG_ELEMENTS.flatMap((element) => BRANCHES.flatMap((branches, index) =>
    branches.map((branch) => definition(weapon, element, index + 1, branch)))))
const CATALOG_BY_ID = new Map(RPG_SKILL_CATALOG.map((skill) => [skill.id, skill]))
export function combatSkill(ref: RpgSkillRef): SkillDefinition | null {
  // The tier is part of the learned-id, while the catalog effects are a tier-independent template.
  if (!Number.isSafeInteger(ref.tier) || ref.tier < 1) return null
  const id = `${ref.weapon}:${ref.element}:${ref.depth}:${ref.branch}`
  return CATALOG_BY_ID.get(id) ?? null
}
export function combatSkillId(ref: RpgSkillRef): string { return rpgSkillKey(ref) }

export function elementMatchup(attack: RpgElement | null, defend: RpgElement): 'weak' | 'resist' | 'neutral' {
  if (!attack) return 'neutral'
  if ((attack === 'fire' && defend === 'ice') || (attack === 'ice' && defend === 'lightning') ||
    (attack === 'lightning' && defend === 'fire') ||
    (attack === 'light' && defend === 'dark') || (attack === 'dark' && defend === 'light')) return 'weak'
  if ((defend === 'fire' && attack === 'ice') || (defend === 'ice' && attack === 'lightning') ||
    (defend === 'lightning' && attack === 'fire')) return 'resist'
  return 'neutral'
}
