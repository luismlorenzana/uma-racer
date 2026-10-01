// Invented combat fixtures for tests and headless simulation only (docs/design/uma-rpg.md).
import { RPG_ELEMENTS, rpgWeaponsForStyle, type RpgCoreStats, type RpgElement,
  type RpgSkillRef, type RpgWeapon } from '../rules'
import type { EncounterInput, FrozenAlly, FrozenEnemy } from './types'

const STYLE: Record<RpgWeapon, FrozenAlly['style']> = {
  greatsword: 'front', spear: 'pace', 'sword-shield': 'pace',
  'wizard-staff': 'late', 'cleric-staff': 'late', tome: 'end',
}
export function syntheticStats(offense = 70, hp = 350): RpgCoreStats {
  return { speed: offense, stamina: 70, power: 55, guts: 50, wit: 55,
    atk: offense, matk: offense, initiative: 70, pdef: 55, mdef: 55,
    dexterity: 50, hp, mp: 140 }
}
export function syntheticAlly(index: number, weapon: RpgWeapon, element: RpgElement): FrozenAlly {
  if (!rpgWeaponsForStyle(STYLE[weapon]).includes(weapon)) throw new RangeError('Invalid synthetic weapon')
  const foundation: RpgSkillRef = { tier: 1, weapon, element, depth: 1, branch: 'foundation' }
  const focused: RpgSkillRef = { tier: 1, weapon, element, depth: 2, branch: 'focused' }
  const area: RpgSkillRef = { tier: 1, weapon, element, depth: 2, branch: 'area' }
  const committed: RpgSkillRef = { tier: 1, weapon, element, depth: 3, branch: 'committed' }
  const role: RpgSkillRef = { tier: 1, weapon, element, depth: 4, branch: 'role' }
  const tree = [foundation, focused, area, committed, role].map((ref) => ({ ...ref, level: 2 }))
  return { id: `ally-${index}`, style: STYLE[weapon], weapon, tier: 1, level: 35,
    stats: syntheticStats(70 + index * 2), affinities: { [element]: 'A' }, signature: element,
    tree, legacy: [], loadout: [foundation, focused, area, committed, role] }
}
export function syntheticEnemy(id: string, element: RpgElement, boss = false): FrozenEnemy {
  const hp = boss ? 2_800 : 650
  return { id, element, stats: syntheticStats(boss ? 100 : 75, hp),
    moves: [
      { id: 'strike', kind: 'damage', channel: 'physical', element: null, power: boss ? 175 : 135,
        target: 'front', intentText: 'Strike front' },
      { id: 'hex', kind: 'damage', channel: 'magical', element, power: boss ? 155 : 125,
        target: 'seeded', status: 'weaken', intentText: 'Hex a marked ally' },
    ],
    ...(boss ? { phaseTwo: { thresholdPercent: 50, moves: [
      { id: 'surge', kind: 'damage' as const, channel: 'magical' as const, element,
        power: 190, target: 'lowest-hp' as const, status: 'burn' as const,
        intentText: 'Surge at the weakest ally' },
      { id: 'mend', kind: 'heal' as const, channel: 'magical' as const, element: null,
        power: 65, target: 'self' as const, intentText: 'Mend self' },
    ] } } : {}),
  }
}
export function syntheticEncounter(weapon: RpgWeapon = 'spear', element: RpgElement = 'fire',
  enemyElement: RpgElement = 'ice', seed = 17, boss = false,
  weaknessFollowUp: EncounterInput['weaknessFollowUp'] = 'bounded'): EncounterInput {
  if (!RPG_ELEMENTS.includes(element)) throw new RangeError('Invalid synthetic element')
  return { version: 1, contentVersion: 'invented-v1', seed,
    weaknessFollowUp,
    allies: Array.from({ length: 5 }, (_, index) => syntheticAlly(index, weapon, element)),
    enemies: boss ? [syntheticEnemy('boss', enemyElement, true)] : [
      syntheticEnemy('foe-a', enemyElement), syntheticEnemy('foe-b', enemyElement),
      syntheticEnemy('foe-c', enemyElement),
    ] }
}
