// Campaign skills: every technique is an elemental attack; there is no healing (D261).
import { RPG_SIGNATURE_MULTIPLIER, type RpgBranch, type RpgElement, type RpgSkillRef, type RpgWeapon } from '../rules'
import type { BattleChannel, BattleStatusKind } from './types'

export const BATTLE_WEAK = 1.5
export const BATTLE_RESIST = 0.5
export const BATTLE_DEFENSE_SHARE = 0.5
export const BATTLE_MIN_OFFENSE_SHARE = 0.2
export const BATTLE_ATTACK_POWER = 1
export const BATTLE_GUARD_FACTOR = 0.5
export const BATTLE_SHIELDED_FACTOR = 0.4
export const BATTLE_BROKEN_FACTOR = 2
export const BATTLE_ALL_OUT_POWER = 1
export const BATTLE_MAX_ROUNDS = 40
export const BATTLE_STATUS_TURNS = 2
export const BATTLE_STATUS_STACK_CAP = 3
export const BATTLE_BURN_PERCENT = 0.04
export const BATTLE_MARK_PERCENT = 0.1
export const BATTLE_BUFF_PERCENT = 0.15
export const BATTLE_SKILL_LEVEL_STEP = 0.08
export const BATTLE_PHASE_TWO_PERCENT = 50

const PHYSICAL = new Set<RpgWeapon>(['greatsword', 'spear', 'sword-shield'])
export const battleChannel = (weapon: RpgWeapon): BattleChannel => PHYSICAL.has(weapon) ? 'physical' : 'magical'
export const BATTLE_WEAPON_POWER: Readonly<Record<RpgWeapon, number>> = {
  greatsword: 1.15, spear: 1, 'sword-shield': 0.85, 'wizard-staff': 1.1, 'cleric-staff': 0.8, tome: 1.1,
}
/** Support weapons lift the whole party with every technique instead of healing it. */
export const BATTLE_SUPPORT_STATUS: Readonly<Partial<Record<RpgWeapon, BattleStatusKind>>> = {
  'sword-shield': 'ward', 'cleric-staff': 'power-up',
}
const MOTIF: Readonly<Record<RpgElement, BattleStatusKind | null>> = {
  fire: 'burn', ice: 'slow', lightning: 'mark', light: null, dark: 'weaken',
}
const SHAPE: Readonly<Record<RpgBranch, { power: number; hits: number; area: boolean; shield: number }>> = {
  foundation: { power: 1.6, hits: 1, area: false, shield: 1 },
  focused: { power: 2, hits: 1, area: false, shield: 1 },
  area: { power: 1.1, hits: 1, area: true, shield: 1 },
  committed: { power: 2.6, hits: 1, area: false, shield: 1 },
  multi: { power: 1.4, hits: 2, area: false, shield: 1 },
  role: { power: 3, hits: 1, area: false, shield: 1 },
  hybrid: { power: 1.6, hits: 1, area: true, shield: 1 },
  signature: { power: 3.8, hits: 1, area: false, shield: 2 },
}

export interface BattleSkill {
  ref: RpgSkillRef
  label: string
  channel: BattleChannel
  element: RpgElement
  /** Offense multiplier per hit before matchup, statuses and skill level. */
  power: number
  hits: number
  area: boolean
  /** Shield points one weakness hit removes. */
  shield: number
  mp: number
  status: BattleStatusKind | null
  support: BattleStatusKind | null
}

const BRANCH_LABEL: Readonly<Record<RpgBranch, string>> = {
  foundation: 'Strike', focused: 'Focus', area: 'Sweep', committed: 'Burst', multi: 'Flurry',
  role: 'Mastery', hybrid: 'Storm', signature: 'Finale',
}
const ELEMENT_LABEL: Readonly<Record<RpgElement, string>> = {
  fire: 'Flame', ice: 'Frost', lightning: 'Volt', light: 'Dawn', dark: 'Shade',
}
export const battleSkillLabel = (ref: Pick<RpgSkillRef, 'element' | 'branch'>): string =>
  `${ELEMENT_LABEL[ref.element]} ${BRANCH_LABEL[ref.branch]}`

/** Tier-scaled cost keeps a full pool worth roughly the same number of casts as stats grow. */
export function battleSkillMp(ref: Pick<RpgSkillRef, 'tier' | 'depth' | 'branch'>): number {
  const shape = SHAPE[ref.branch]
  return (6 + 4 * ref.depth + (shape.area ? 4 : 0)) * ref.tier
}

export function battleSkill(ref: RpgSkillRef): BattleSkill {
  const shape = SHAPE[ref.branch]
  return {
    ref, label: battleSkillLabel(ref), channel: battleChannel(ref.weapon), element: ref.element,
    power: shape.power * BATTLE_WEAPON_POWER[ref.weapon], hits: shape.hits, area: shape.area, shield: shape.shield,
    mp: battleSkillMp(ref), status: MOTIF[ref.element], support: BATTLE_SUPPORT_STATUS[ref.weapon] ?? null,
  }
}

export function battleMatchup(attack: RpgElement | null, defend: RpgElement): 'weak' | 'resist' | 'neutral' {
  if (!attack) return 'neutral'
  if ((attack === 'fire' && defend === 'ice') || (attack === 'ice' && defend === 'lightning') ||
    (attack === 'lightning' && defend === 'fire') ||
    (attack === 'light' && defend === 'dark') || (attack === 'dark' && defend === 'light')) return 'weak'
  if ((defend === 'fire' && attack === 'ice') || (defend === 'ice' && attack === 'lightning') ||
    (defend === 'lightning' && attack === 'fire')) return 'resist'
  return 'neutral'
}
/** The element that breaks a foe of this element. */
export function battleWeakness(element: RpgElement): RpgElement {
  return ({ fire: 'lightning', ice: 'fire', lightning: 'ice', light: 'dark', dark: 'light' } as const)[element]
}
export const battleSignatureFactor = (signature: RpgElement, element: RpgElement | null): number =>
  element === signature ? RPG_SIGNATURE_MULTIPLIER : 1
