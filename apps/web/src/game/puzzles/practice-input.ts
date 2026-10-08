// Invented free lesson, no account host, persistence, assets or network.
import { PUZZLE_ELEMENTS, createPuzzleSource, puzzleStats, type PuzzleBattleInputV1, type UmaTemplate } from '@racer/domain'
export function puzzlePracticeInput(): PuzzleBattleInputV1 {
  const entrants = PUZZLE_ELEMENTS.map((element, i) => {
    const template: UmaTemplate = { id: `practice-${i}`, charaId: `practice-${i}`, name: `Practice Uma ${i + 1}`, outfit: 'Invented',
      jpRelease: '2000-01-01', globalRelease: null, starter: true, baseStats: { speed: 120, stamina: 180, power: 90, guts: 80, wit: 100 },
      growthRates: { speed: 0.1, stamina: 0.1, power: 0, guts: 0, wit: 0 }, aptitudes: { surface: { turf: 'A', dirt: 'A' },
        distance: { sprint: 'A', mile: 'A', medium: 'A', long: 'A' }, strategy: { front: 'A', pace: 'A', late: 'A', end: 'A' } },
      uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [], imageSource: 'https://invalid.test/invented' }
    const source = createPuzzleSource(template, 'practice-v1')
    return { outfitId: template.id, source, level: 10, element, stats: puzzleStats(source, 10), kit: {
      activeId: (['puzzle:front-convert', 'puzzle:pace-shield', 'puzzle:late-convert', 'puzzle:end-delay', 'puzzle:pace-shield'] as const)[i]!, patternId: null } }
  })
  return { schemaVersion: 1, engineVersion: 1, rulesVersion: 1, battleId: 'practice-battle', partyId: 'puzzle-party-1', checkpointId: 'practice-map',
    ownerEpoch: 0, seed: 'invented-practice-v1', scenarioId: 'ura-finale', encounterLevel: 10, kind: 'champion', entrants,
    leaderId: 'puzzle:combo-leader', enemies: (['fire', 'water', 'wood'] as const).map((element, i) => ({ id: `practice-foe-${i}`,
      castId: `practice-monster-${i}`, recipeId: i === 0 ? 'puzzle:champion' : i === 1 ? 'puzzle:combo-ward' : 'puzzle:striker', element, maxHp: 12000, defense: 20,
      openingCountdown: 2 + i, intents: i === 1 ? [{ type: 'ward', countdown: 2, reduction: 0.5, durationDrags: 1, comboThreshold: 4 }, { type: 'attack', damage: 400, countdown: 2 }] : [{ type: 'attack', damage: 400, countdown: 2 }], delayImmune: i === 2,
      phase: i === 0 ? { atHpPercent: 50, damageMultiplier: 1.4, countdown: 2, element: 'water' } : null })),
    rewards: [], content: { manifestVersion: 'invented-practice-v1', recipeHash: 'a'.repeat(16) } }
}
