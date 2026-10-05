// Campaign foes: roles and level scaling, tuned by `pnpm sim:rpg:campaign` (docs/design/uma-rpg.md#foes, D262).
import type { RpgElement } from '../rules'
import type { BattleEnemy, BattleEnemyMove, EnemyRank } from '../battle/types'

/** Average enrolled outfit core stat at a lifetime level: base ≈ 110 / 5 plus 1.5 × (1 + 0.06) per level. */
export const rpgReferenceStat = (lifetimeLevel: number): number => 22 + 1.59 * (lifetimeLevel - 1)

export const RPG_FOE_ROLES = ['striker', 'caster', 'guard', 'skirmisher'] as const
export type RpgFoeRole = typeof RPG_FOE_ROLES[number] | 'captain' | 'champion'
export const RPG_FOE_TUNING = {
  hpBase: 50, hpPerStat: 5, offense: 3, defense: 0.8,
  subBossHp: 5, bossHp: 8, subBossShield: 2, bossShield: 4,
} as const

interface RoleShape { hp: number; atk: number; matk: number; def: number; mdef: number; speed: number }
const ROLE: Readonly<Record<RpgFoeRole, RoleShape>> = {
  striker: { hp: 1, atk: 1, matk: 0.6, def: 1, mdef: 0.8, speed: 1 },
  caster: { hp: 0.8, atk: 0.6, matk: 1.1, def: 0.7, mdef: 1.1, speed: 1.05 },
  guard: { hp: 1.3, atk: 0.75, matk: 0.6, def: 1.3, mdef: 1.1, speed: 0.9 },
  skirmisher: { hp: 0.85, atk: 0.9, matk: 0.7, def: 0.9, mdef: 0.9, speed: 1.3 },
  captain: { hp: 1, atk: 0.85, matk: 0.85, def: 1, mdef: 1, speed: 1.1 },
  champion: { hp: 1, atk: 0.9, matk: 0.9, def: 1.05, mdef: 1.05, speed: 1.15 },
}
const ELEMENT_NAME: Readonly<Record<RpgElement, string>> = { fire: 'Flame', ice: 'Frost', lightning: 'Volt', light: 'Dawn', dark: 'Shade' }

function moves(role: RpgFoeRole, element: RpgElement): { moves: BattleEnemyMove[]; phaseTwo?: BattleEnemy['phaseTwo'] } {
  const e = ELEMENT_NAME[element]
  const m = (id: string, kind: BattleEnemyMove['kind'], channel: BattleEnemyMove['channel'], el: RpgElement | null,
    power: number, target: BattleEnemyMove['target'], label: string, status?: BattleEnemyMove['status']): BattleEnemyMove =>
    ({ id, kind, channel, element: el, power, target, label, ...(status ? { status } : {}) })
  switch (role) {
    case 'striker': return { moves: [m('strike', 'damage', 'physical', null, 100, 'front', 'Strike the front'),
      m('heavy', 'damage', 'physical', element, 130, 'seeded', `${e} blow`)] }
    case 'caster': return { moves: [m('bolt', 'damage', 'magical', element, 110, 'lowest-hp', `${e} bolt at the weakest`),
      m('hex', 'debuff', 'magical', element, 0, 'seeded', 'Hex: weaken', 'weaken')] }
    case 'guard': return { moves: [m('bash', 'damage', 'physical', null, 80, 'front', 'Shield bash'),
      m('cover', 'guard', 'physical', null, 0, 'ally', 'Guard an ally')] }
    case 'skirmisher': return { moves: [m('cut', 'damage', 'physical', element, 90, 'seeded', `${e} cut + mark`, 'mark'),
      m('strike', 'damage', 'physical', null, 100, 'front', 'Strike the front')] }
    case 'captain': return {
      moves: [m('smash', 'damage', 'physical', element, 150, 'front', `${e} smash`),
        m('rally', 'buff', 'physical', null, 0, 'self', 'Rally: power up', 'power-up'),
        m('sweep', 'damage', 'magical', element, 55, 'all', `${e} sweep (all)`)],
      phaseTwo: { thresholdPercent: 50, moves: [m('storm', 'damage', 'magical', element, 75, 'all', `${e} storm (all)`),
        m('crush', 'damage', 'physical', element, 190, 'lowest-hp', 'Crush the weakest')] } }
    case 'champion': return {
      moves: [m('smash', 'damage', 'physical', element, 160, 'front', `${e} smash`),
        m('sweep', 'damage', 'magical', element, 60, 'all', `${e} sweep (all)`),
        m('ward', 'buff', 'magical', null, 0, 'self', 'Ward: guard up', 'ward')],
      phaseTwo: { thresholdPercent: 50, moves: [m('storm', 'damage', 'magical', element, 85, 'all', `${e} storm (all)`, element === 'fire' ? 'burn' : undefined),
        m('crush', 'damage', 'physical', element, 210, 'lowest-hp', 'Crush the weakest'),
        m('focus', 'damage', 'physical', element, 170, 'front', `${e} lance`)] } }
  }
}

/** A foe's full frozen kit at a lifetime level. Stats are code, so a rebalance never needs a content publish. */
export function rpgFoe(input: { id: string; castId: string; element: RpgElement; role: RpgFoeRole; rank: EnemyRank; level: number }): BattleEnemy {
  const t = RPG_FOE_TUNING
  const s = rpgReferenceStat(input.level)
  const shape = ROLE[input.role]
  const scale = input.rank === 'boss' ? t.bossHp : input.rank === 'sub-boss' ? t.subBossHp : 1
  const kit = moves(input.role, input.element)
  return {
    id: input.id, castId: input.castId, element: input.element, rank: input.rank, level: input.level,
    stats: {
      hp: Math.round((t.hpBase + t.hpPerStat * s) * shape.hp * scale),
      atk: Math.round(s * t.offense * shape.atk), matk: Math.round(s * t.offense * shape.matk),
      pdef: Math.round(s * t.defense * shape.def), mdef: Math.round(s * t.defense * shape.mdef),
      initiative: Math.round(s * shape.speed),
    },
    shield: input.rank === 'boss' ? t.bossShield : input.rank === 'sub-boss' ? t.subBossShield : 0,
    ...kit,
  }
}
