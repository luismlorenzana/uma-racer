// DEV/TEST ONLY. Small invented chapter, never a production fallback or content import.
import { parseRpgChapterPack, type FrozenEnemy, type RpgChapterPack, type RpgChapterNode } from './chapter'

const stats = (offense: number, hp: number) => ({ speed: offense, stamina: 70, power: 55, guts: 50, wit: 55,
  atk: offense, matk: offense, initiative: 70, pdef: 55, mdef: 55, dexterity: 50, hp, mp: 140 })
function syntheticEnemy(id: string, element: string, boss = false): FrozenEnemy {
  return { id, element, stats: stats(boss ? 100 : 75, boss ? 2_800 : 650),
    moves: [
      { id: 'strike', kind: 'damage', channel: 'physical', element: null, power: boss ? 175 : 135, target: 'front', intentText: 'Strike front' },
      { id: 'hex', kind: 'damage', channel: 'magical', element, power: boss ? 155 : 125, target: 'seeded', status: 'weaken', intentText: 'Hex a marked ally' },
    ],
    ...(boss ? { phaseTwo: { thresholdPercent: 50, moves: [
      { id: 'surge', kind: 'damage', channel: 'magical', element, power: 190, target: 'lowest-hp', status: 'burn', intentText: 'Surge at the weakest ally' },
      { id: 'mend', kind: 'heal', channel: 'magical', element: null, power: 65, target: 'self', intentText: 'Mend self' },
    ] } } : {}),
  }
}

export const SYNTHETIC_CHAPTER_HASH = 'a'.repeat(64)
export function syntheticChapterJson() {
  const scout = syntheticEnemy('test-scout', 'ice')
  const elite = syntheticEnemy('test-elite', 'fire')
  const boss = syntheticEnemy('test-captain', 'dark', true)
  const wall = syntheticEnemy('test-wall', 'fire')
  const actors = [
    { id: scout.id, name: 'Test scout', role: 'Physical vanguard', artKey: 'test-scout', combat: { ...scout, stats: { ...scout.stats, hp: 180 } } },
    { id: elite.id, name: 'Test elite', role: 'Debuff caster', artKey: 'test-elite', combat: { ...elite, stats: { ...elite.stats, hp: 320 } } },
    { id: boss.id, name: 'Test captain', role: 'Phase-changing healer', artKey: 'test-captain', combat: { ...boss, stats: { ...boss.stats, hp: 650 } } },
    { id: wall.id, name: 'Test wall', role: 'Deliberately unwinnable loss probe', artKey: 'test-wall', combat: {
      ...wall, stats: { ...wall.stats, hp: 100000, atk: 100000, matk: 100000, pdef: 100000, mdef: 100000 },
      moves: [{ id: 'probe-hit', kind: 'damage' as const, channel: 'physical' as const, element: null, power: 500,
        target: 'front' as const, intentText: 'Loss probe: strike front' }] } },
  ]
  const nodes: RpgChapterNode[] = [
    { id: 'opening', name: 'Opening challenge', kind: 'encounter', detail: 'An invented scout guards the crossroads.', enemies: [scout.id], exits: ['fork'] },
    { id: 'fork', name: 'Crossroads', kind: 'branch', detail: 'A safe setup stop or an optional elite fight. Both rejoin.', enemies: [], exits: ['rest', 'elite'] },
    { id: 'rest', name: 'Quiet camp', kind: 'recovery', detail: 'Skip the extra fight and prepare your loadout. Every encounter starts at full HP/MP.', enemies: [], exits: ['join'] },
    { id: 'elite', name: 'Elite challenge', kind: 'elite', detail: 'An extra battle for RPG EXP in this isolated test account. No extra clear token.', enemies: [elite.id], exits: ['join'] },
    { id: 'join', name: 'Captain approach', kind: 'checkpoint', detail: 'Paths rejoin. Review your five-outfit party before the boss.', enemies: [], exits: ['boss'] },
    { id: 'boss', name: 'Captain finale', kind: 'boss', detail: 'The captain changes intent and heals below half HP.', enemies: [boss.id], exits: [] },
  ]
  for (const node of nodes) if (node.kind === 'encounter' || node.kind === 'elite' || node.kind === 'boss') node.baseExp = node.kind === 'boss' ? 1600 : 1000
  return { schemaVersion: 1, version: 'invented-map-v1', actors, chapters: [
    { id: 'test-chapter', scenarioId: 'ura-finale', title: 'Invented crossroads', contentVersion: 'invented-map-v1',
      recommendedTier: 1, recommendedLevel: 10, surface: 'turf', distance: 'medium', startNodeId: 'opening', bossNodeId: 'boss', nodes },
    { id: 'test-second', scenarioId: 'unity-cup', title: 'Another invented route', contentVersion: 'invented-map-v1',
      recommendedTier: 1, recommendedLevel: 10, surface: 'dirt', distance: 'mile', startNodeId: 'opening', bossNodeId: 'boss', nodes: structuredClone(nodes) },
    { id: 'test-loss', scenarioId: 'ura-finale', title: 'Deliberate defeat probe', contentVersion: 'invented-map-v1',
      recommendedTier: 1, recommendedLevel: 50, surface: 'turf', distance: 'long', startNodeId: 'wall', bossNodeId: 'wall',
      nodes: [{ id: 'wall', name: 'Defeat rehearsal', kind: 'boss' as const, detail: 'Test only: an impossible fight checks KO, zero-reward loss and same-kit retry.', baseExp: 2000, enemies: [wall.id], exits: [] }] },
  ] }
}
export function syntheticChapterPack(): RpgChapterPack {
  return parseRpgChapterPack(syntheticChapterJson(), { version: 'invented-map-v1', contentHash: SYNTHETIC_CHAPTER_HASH,
    artKeys: ['test-scout', 'test-elite', 'test-captain', 'test-wall'] })
}
