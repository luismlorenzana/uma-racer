// Campaign skills and the break rules' numbers (docs/design/uma-rpg.md#battles, D265). Every technique is an elemental
// attack; nothing heals. Multi-hit skills chip a shield once per hit.
import { RPG_SIGNATURE_MULTIPLIER, type RpgBranch, type RpgElement, type RpgSkillRef, type RpgWeapon } from '../rules'
import type { BattleChannel, BattleStatusKind, BattleWeaponKind } from './types'

/** Octopath Traveler: a weakness hit ×1.3, a broken foe ×2 — here as ×0.5 before the break and ×1 after. */
export const BATTLE_WEAK = 1.3
export const BATTLE_UNBROKEN_FACTOR = 0.5
export const BATTLE_DEFENSE_SHARE = 0.5
export const BATTLE_MIN_OFFENSE_SHARE = 0.2
export const BATTLE_ATTACK_POWER = 1
export const BATTLE_GUARD_FACTOR = 0.5
/** A break lasts the round it happens in and the next one. */
export const BATTLE_BREAK_ROUNDS = 2
export const BATTLE_MAX_ROUNDS = 40
export const BATTLE_STATUS_TURNS = 2
export const BATTLE_STATUS_STACK_CAP = 3
export const BATTLE_BURN_PERCENT = 0.04
export const BATTLE_MARK_PERCENT = 0.1
export const BATTLE_BUFF_PERCENT = 0.15
export const BATTLE_SKILL_LEVEL_STEP = 0.08

const PHYSICAL = new Set<RpgWeapon>(['greatsword', 'spear', 'sword-shield'])
export const battleChannel = (weapon: RpgWeapon): BattleChannel => PHYSICAL.has(weapon) ? 'physical' : 'magical'
export const BATTLE_WEAPON_KINDS: readonly BattleWeaponKind[] = ['greatsword', 'spear', 'sword', 'staff', 'tome']
export function battleWeaponKind(weapon: RpgWeapon): BattleWeaponKind {
  return weapon === 'sword-shield' ? 'sword' : weapon === 'wizard-staff' || weapon === 'cleric-staff' ? 'staff' : weapon
}
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
export type BattleSkillTarget = 'one' | 'all' | 'random'
/** Power is per hit. The multi-hit line trades a little total power for shield chips. */
const SHAPE: Readonly<Record<RpgBranch, { power: number; hits: number; target: BattleSkillTarget }>> = {
  foundation: { power: 1.6, hits: 1, target: 'one' },
  focused: { power: 2, hits: 1, target: 'one' },
  area: { power: 1.1, hits: 1, target: 'all' },
  double: { power: 1.05, hits: 2, target: 'one' },
  committed: { power: 2.6, hits: 1, target: 'one' },
  multi: { power: 0.95, hits: 3, target: 'one' },
  role: { power: 3, hits: 1, target: 'one' },
  hybrid: { power: 1.6, hits: 1, target: 'all' },
  quad: { power: 0.85, hits: 4, target: 'one' },
  signature: { power: 3.8, hits: 1, target: 'one' },
  barrage: { power: 0.7, hits: 6, target: 'random' },
}

export interface BattleSkill {
  ref: RpgSkillRef
  label: string
  channel: BattleChannel
  element: RpgElement
  /** Offense multiplier per hit before weakness, break, statuses and skill level. */
  power: number
  hits: number
  target: BattleSkillTarget
  mp: number
  status: BattleStatusKind | null
  support: BattleStatusKind | null
}

const BRANCH_LABEL: Readonly<Record<RpgBranch, string>> = {
  foundation: 'Strike', focused: 'Focus', area: 'Sweep', double: 'Twin', committed: 'Burst', multi: 'Triple',
  role: 'Mastery', hybrid: 'Storm', quad: 'Quad', signature: 'Finale', barrage: 'Barrage',
}
const ELEMENT_LABEL: Readonly<Record<RpgElement, string>> = {
  fire: 'Flame', ice: 'Frost', lightning: 'Volt', light: 'Dawn', dark: 'Shade',
}
export const battleSkillLabel = (ref: Pick<RpgSkillRef, 'element' | 'branch'>): string =>
  `${ELEMENT_LABEL[ref.element]} ${BRANCH_LABEL[ref.branch]}`
export const battleSkillShape = (branch: RpgBranch) => SHAPE[branch]

/** Tier-scaled cost keeps a full pool worth roughly the same number of casts as stats grow. */
export function battleSkillMp(ref: Pick<RpgSkillRef, 'tier' | 'depth' | 'branch'>): number {
  return (6 + 4 * ref.depth + (SHAPE[ref.branch].target === 'all' ? 4 : 0)) * ref.tier
}

export function battleSkill(ref: RpgSkillRef): BattleSkill {
  const shape = SHAPE[ref.branch]
  return {
    ref, label: battleSkillLabel(ref), channel: battleChannel(ref.weapon), element: ref.element,
    power: shape.power * BATTLE_WEAPON_POWER[ref.weapon], hits: shape.hits, target: shape.target,
    mp: battleSkillMp(ref), status: MOTIF[ref.element], support: BATTLE_SUPPORT_STATUS[ref.weapon] ?? null,
  }
}

/** The element that a foe of this element is weak to: Fire > Ice > Lightning > Fire; Light ↔ Dark. */
export function battleWeakness(element: RpgElement): RpgElement {
  return ({ fire: 'lightning', ice: 'fire', lightning: 'ice', light: 'dark', dark: 'light' } as const)[element]
}
export const battleSignatureFactor = (signature: RpgElement, element: RpgElement | null): number =>
  element === signature ? RPG_SIGNATURE_MULTIPLIER : 1
