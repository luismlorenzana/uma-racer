// Limit Breaks (docs/design/uma-rpg-classes.md#15-limit-breaks, D311), after Final Fantasy and Octopath Traveler: every
// attack and skill charges a bar, and a full bar buys one whole turn worth about twice her usual damage, at 0 MP.
import { RPG_SKILL_POWER, type RpgHit, type RpgSkillDef } from '../catalog'
import { RPG_DEPTH_GATES, rpgHand, type RpgDamageKind, type RpgHand, type RpgNodeRef, type RpgWeapon, type RpgWeaponKind } from '../rules'
import { battleSkillFor } from './skills'
import type { BattleAlly } from './types'

export const BATTLE_LIMIT_MAX = 12
/** An attack charges 1 and a skill 2; a one-action hand (Brawler, Cleric) charges double, so every class fills alike. */
export const BATTLE_LIMIT_CHARGE = { attack: 1, skill: 2 } as const
export const battleLimitGain = (hand: Pick<RpgHand, 'actions'>, kind: keyof typeof BATTLE_LIMIT_CHARGE): number =>
  BATTLE_LIMIT_CHARGE[kind] * (hand.actions === 1 ? 2 : 1)
/**
 * Limit Break power, as a multiple of a turn: a Brawler's skill twice, a Summoner's two summons twice each and a Spell
 * Blade's skill made big are 2× her turn; the fixed ones are multiples of the single-target power open at her level
 * (a Mage's six hits are four of her casts, 2.4; a Cleric's patrons 1.5, three of her casts).
 */
export const BATTLE_LIMIT_POWER = { turn: 2, mage: 2.4, cleric: 1.5, triad: 2 } as const
export const BATTLE_LIMIT_NAMES = { mage: 'Prismatic Nova', cleric: 'Divine Patrons', triad: 'Triad Blade', twin: 'Twin Strike' } as const

export interface BattleLimitChoice { skill?: RpgNodeRef; skills?: RpgNodeRef[]; weapon?: RpgWeapon }
export interface BattleLimitPlan { name: string; casts: { def: RpgSkillDef; scale: number }[] }

/** The deepest skill depth open at her level (Lv1/10/20/30/40). */
export const rpgOpenDepth = (level: number): number => RPG_DEPTH_GATES.filter((gate) => level >= gate).length
const round = (n: number) => Math.round(n * 1000) / 1000
const total = (def: RpgSkillDef) => def.hits.reduce((sum, hit) => sum + hit.power, 0)
const single = (hits: RpgHit[], primary: RpgDamageKind): RpgSkillDef => ({ target: 'one', hits, mp: 0, primary })
const even = (power: number, parts: RpgHit['parts'][]): RpgHit[] => parts.map((p) => ({ power: round(power / parts.length), parts: p }))

/** The casts this Limit Break makes, or null when the choice names something she can't use. */
export function battleLimitPlan(ally: BattleAlly, choice: BattleLimitChoice): BattleLimitPlan | null {
  const hand = rpgHand(ally)
  const level = RPG_SKILL_POWER[Math.max(1, rpgOpenDepth(ally.level)) - 1]!
  const known = (ref: unknown) => ref && typeof ref === 'object' ? battleSkillFor(ally, ref as RpgNodeRef) : null
  const { skill, skills, weapon } = choice
  switch (ally.classId) {
    case 'mage': {
      if (skill || skills || weapon) return null
      return { name: BATTLE_LIMIT_NAMES.mage, casts: [{ scale: 1, def: single(even(BATTLE_LIMIT_POWER.mage * level,
        (['fire', 'ice', 'lightning', 'light', 'dark', 'ultima'] as const).map((kind) => [{ kind, share: 1 }])), 'ultima') }] }
    }
    case 'cleric': {
      if (skill || skills || weapon) return null
      return { name: BATTLE_LIMIT_NAMES.cleric, casts: [{ scale: 1, def: single(even(BATTLE_LIMIT_POWER.cleric * level,
        [0, 1].map(() => [{ kind: 'light' as const, share: 0.5 }, { kind: 'dark' as const, share: 0.5 }])), 'light') }] }
    }
    case 'brawler': {
      if (skills) return null
      if (skill) {
        const k = known(skill)
        return k ? { name: k.label, casts: [{ def: k.def, scale: hand.power }, { def: k.def, scale: hand.power }] } : null
      }
      const kind = weapon ?? ally.weapons[0]!
      if (!ally.weapons.includes(kind)) return null
      const strike = single([{ power: hand.free.power, parts: [{ kind: kind as RpgWeaponKind, share: 1 }] }], kind as RpgWeaponKind)
      return { name: BATTLE_LIMIT_NAMES.twin, casts: [{ def: strike, scale: 1 }, { def: strike, scale: 1 }] }
    }
    case 'spellblade': {
      if (skills || weapon) return null
      if (!skill) return { name: BATTLE_LIMIT_NAMES.triad, casts: [{ scale: 1, def: single(even(BATTLE_LIMIT_POWER.triad * level,
        (['fire', 'ice', 'lightning'] as const).map((kind) => [{ kind: 'short-sword' as const, share: 0.5 }, { kind, share: 0.5 }])), 'fire') }] }
      const k = known(skill)
      if (!k) return null
      // Her turn is two casts at her hand; the Limit Break is one cast worth two turns.
      const power = BATTLE_LIMIT_POWER.turn * 2 * hand.power * total(k.def)
      const def: RpgSkillDef = k.node.tree === 'blade-elemental'
        ? { ...k.def, mp: 0, hits: even(power, [0, 1, 2].map(() => [{ kind: 'short-sword', share: 0.5 }, { kind: k.def.primary, share: 0.5 }])) }
        : { ...k.def, mp: 0, hits: [...k.def.hits, ...k.def.hits].map((hit) => ({ ...hit, power: round(hit.power * power / (2 * total(k.def))) })) }
      return { name: k.label, casts: [{ def, scale: 1 }] }
    }
    case 'summoner': {
      if (skill || weapon || !Array.isArray(skills) || skills.length !== 2) return null
      const picks = skills.map(known)
      if (picks.some((k) => !k)) return null
      const [a, b] = picks as NonNullable<ReturnType<typeof known>>[]
      return { name: a!.label === b!.label ? a!.label : `${a!.label} + ${b!.label}`,
        casts: [a!, a!, b!, b!].map((k) => ({ def: k.def, scale: hand.power })) }
    }
  }
}
