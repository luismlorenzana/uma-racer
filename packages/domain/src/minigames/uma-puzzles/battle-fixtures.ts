// Entirely invented fixtures for tests/sim. Not imported game rows, private cast or production scaling.
import type { Aptitudes, Strategy } from '../../types'
import type { PuzzleBattleInputV1, PuzzleBattleKind, PuzzleEnemy } from './battle-types'
import { defaultPuzzleKit } from './catalogue'
import { createPuzzleSource } from './identity'
import { puzzleStats } from './progression'
import type { PuzzleElement } from './types'

export const PUZZLE_SYNTHETIC_PARTIES = ['basic', 'light-dark', 'mono', 'starter-shaped'] as const
export type PuzzleSyntheticParty = typeof PUZZLE_SYNTHETIC_PARTIES[number]
export function syntheticPuzzleBattle(seed = 'fixture-1', kind: PuzzleBattleKind = 'ordinary', shape: PuzzleSyntheticParty = 'basic', level = 5): PuzzleBattleInputV1 {
  const elements: Record<PuzzleSyntheticParty, PuzzleElement[]> = { basic: ['fire', 'water', 'wood', 'fire', 'water'],
    'light-dark': ['light', 'dark', 'light', 'dark', 'water'], mono: ['fire', 'fire', 'fire', 'fire', 'fire'],
    'starter-shaped': ['light', 'fire', 'wood', 'water', 'dark'] }
  const styles: Strategy[] = ['front', 'pace', 'late', 'end', 'pace']
  const entrants = styles.map((style, index) => {
    const source = createPuzzleSource({ id: `invented-outfit-${index}`, baseStats: { speed: 110, stamina: 170, power: 90, guts: 70, wit: 90 },
      growthRates: { speed: 0.1, stamina: 0.1, power: 0, guts: 0, wit: 0.1 }, aptitudes: {
        surface: { turf: 'A', dirt: 'A' }, distance: { sprint: 'B', mile: 'A', medium: 'B', long: 'C' },
        strategy: { front: style === 'front' ? 'A' : 'B', pace: style === 'pace' ? 'A' : 'B', late: style === 'late' ? 'A' : 'B', end: style === 'end' ? 'A' : 'B' },
      } as Aptitudes }, 'invented-source-v1')
    return { outfitId: source.templateId, source, level, element: elements[shape][index]!, stats: puzzleStats(source, level),
      kit: { ...defaultPuzzleKit(source)!, patternId: level >= 5 ? 'puzzle:four' as const : null } }
  })
  const striker = (index: number): PuzzleEnemy => ({ id: `invented-foe-${index}`, castId: `invented-art-${index}`, recipeId: 'puzzle:striker',
    element: (['wood', 'fire', 'dark'] as const)[index % 3]!, maxHp: 1100, defense: 10, openingCountdown: 2 + index,
    intents: [{ type: 'attack', countdown: 2, damage: 750 }], delayImmune: false, phase: null })
  let enemies = [striker(0), striker(1), striker(2)]
  if (kind === 'guardian') enemies = [{ ...striker(0), recipeId: 'puzzle:guardian', maxHp: 2000,
    intents: [{ type: 'guard', countdown: 2, reduction: 0.5, durationDrags: 1, comboThreshold: 3 }, { type: 'attack', countdown: 2, damage: 1200 }] },
  { ...striker(1), maxHp: 1700, recipeId: 'puzzle:ally-healer', intents: [{ type: 'heal', countdown: 2, amount: 350 }, { type: 'attack', countdown: 2, damage: 750 }] }]
  if (kind === 'champion') enemies = [{ ...striker(0), recipeId: 'puzzle:champion', maxHp: 6500, openingCountdown: 2,
    intents: [{ type: 'ward', countdown: 2, reduction: 0.5, durationDrags: 2, comboThreshold: 4 }, { type: 'attack', countdown: 2, damage: 1500 }],
    phase: { atHpPercent: 50, damageMultiplier: 1.5, countdown: 2, element: 'dark' } }]
  return { schemaVersion: 1, engineVersion: 1, rulesVersion: 1, battleId: 'invented-battle', partyId: 'puzzle-party-1', checkpointId: 'invented-node',
    ownerEpoch: 0, seed, scenarioId: 'ura-finale', encounterLevel: 5, kind, entrants, leaderId: 'puzzle:combo-leader', enemies,
    rewards: [{ style: 'front', quantity: 1 }], content: { manifestVersion: 'invented-pack-v1', recipeHash: 'invented-rules-v1' } }
}
