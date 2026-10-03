// DEV/TEST ONLY. Small invented chapter, never a production fallback or content import.
import { parseRpgChapterPack, type RpgChapterPack, type RpgChapterNode } from './chapter'
import { syntheticEnemy } from './combat/synthetic'
import { enrollRpgOutfit, type RpgProfile, type RpgWeapon, type RpgElement } from './rules'

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
    { id: 'elite', name: 'Elite challenge', kind: 'elite', detail: 'An extra battle for future encounter EXP. No extra token or rewards in this proof.', enemies: [elite.id], exits: ['join'] },
    { id: 'join', name: 'Captain approach', kind: 'checkpoint', detail: 'Paths rejoin. Review your five-outfit party before the boss.', enemies: [], exits: ['boss'] },
    { id: 'boss', name: 'Captain finale', kind: 'boss', detail: 'The captain changes intent and heals below half HP.', enemies: [boss.id], exits: [] },
  ]
  return { schemaVersion: 1, version: 'invented-map-v1', actors, chapters: [
    { id: 'test-chapter', scenarioId: 'ura-finale', title: 'Invented crossroads', contentVersion: 'invented-map-v1',
      recommendedTier: 1, recommendedLevel: 10, surface: 'turf', distance: 'medium', startNodeId: 'opening', bossNodeId: 'boss', nodes },
    { id: 'test-second', scenarioId: 'unity-cup', title: 'Another invented route', contentVersion: 'invented-map-v1',
      recommendedTier: 1, recommendedLevel: 10, surface: 'dirt', distance: 'mile', startNodeId: 'opening', bossNodeId: 'boss', nodes: structuredClone(nodes) },
    { id: 'test-loss', scenarioId: 'ura-finale', title: 'Deliberate defeat probe', contentVersion: 'invented-map-v1',
      recommendedTier: 1, recommendedLevel: 50, surface: 'turf', distance: 'long', startNodeId: 'wall', bossNodeId: 'wall',
      nodes: [{ id: 'wall', name: 'Defeat rehearsal', kind: 'boss' as const, detail: 'Test only: an impossible fight checks KO, zero-reward loss and same-kit retry.', enemies: [wall.id], exits: [] }] },
  ] }
}
export function syntheticChapterPack(): RpgChapterPack {
  return parseRpgChapterPack(syntheticChapterJson(), { version: 'invented-map-v1', contentHash: SYNTHETIC_CHAPTER_HASH,
    artKeys: ['test-scout', 'test-elite', 'test-captain', 'test-wall'] })
}
export function syntheticChapterProfiles(): RpgProfile[] {
  const paths: Array<[RpgProfile['style'], RpgWeapon, RpgElement]> = [
    ['front', 'greatsword', 'fire'], ['pace', 'spear', 'ice'], ['pace', 'sword-shield', 'light'],
    ['late', 'cleric-staff', 'light'], ['end', 'tome', 'lightning'],
  ]
  return paths.map(([style, weapon, signature], index) => ({ ...enrollRpgOutfit({
    outfit: { id: `test-outfit-${index}`, baseStats: { speed: 400, stamina: 400, power: 400, guts: 400, wit: 400 },
      growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
      aptitudes: { surface: { turf: 'A', dirt: 'A' }, distance: { sprint: 'A', mile: 'A', medium: 'A', long: 'A' },
        strategy: { front: 'A', pace: 'A', late: 'A', end: 'A' } } },
    contentVersion: 'invented-map-v1', style, weapon, defaultSignature: signature }), level: 10,
    tree: [{ tier: 1, weapon, element: signature, depth: 1, branch: 'foundation', level: 1 }] }))
}
