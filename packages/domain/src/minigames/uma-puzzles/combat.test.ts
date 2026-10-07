import { describe, expect, it } from 'vitest'
import { createBattle } from './battle'
import { syntheticPuzzleBattle } from './battle-fixtures'
import type { PuzzleBattleEvent } from './battle-types'
import { puzzleElementMultiplier, puzzleIncomingDamage, resolvePuzzlePlayerCombat } from './combat'
import { puzzleEnemyIntentViews, resolvePuzzleEnemies } from './enemies'
import { PUZZLE_ELEMENTS } from './types'

describe('ordered shared-HP Puzzle combat', () => {
  const matrix = [[1, 0.5, 2, 1, 1], [2, 1, 0.5, 1, 1], [0.5, 2, 1, 1, 1], [1, 1, 1, 1, 2], [1, 1, 1, 2, 1]]
  for (let a = 0; a < 5; a++) for (let d = 0; d < 5; d++) it(`${PUZZLE_ELEMENTS[a]} versus ${PUZZLE_ELEMENTS[d]}`, () => {
    expect(puzzleElementMultiplier(PUZZLE_ELEMENTS[a]!, PUZZLE_ELEMENTS[d]!)).toBe(matrix[a]![d])
  })
  it('heals first, caps HP and gives Heart groups combo credit to every attack', () => {
    const s = createBattle(syntheticPuzzleBattle()), events: PuzzleBattleEvent[] = []; s.hp -= 1
    resolvePuzzlePlayerCombat(s, [{ orb: 'heart', indices: [0, 1, 2] }, { orb: 'fire', indices: [6, 7, 8] }], s.enemies[0]!.id, events)
    expect(events[0]).toMatchObject({ type: 'heal', amount: 1, hpAfter: s.maxHp })
    expect(events.find(e => e.type === 'hit')).toMatchObject({ amount: Math.round(s.input.entrants[0]!.stats.atk * 1.25 * 2) - 10 })
  })
  it('gives an undivided five-orb hit to each living foe, but separate threes remain focused', () => {
    const input = syntheticPuzzleBattle(); input.enemies.forEach(e => { e.maxHp = 10000 })
    const mass = createBattle(input), single = createBattle(input), events: PuzzleBattleEvent[] = []
    resolvePuzzlePlayerCombat(mass, [{ orb: 'fire', indices: [0, 1, 2, 3, 4] }], input.enemies[0]!.id, events)
    expect(events.filter(e => e.type === 'hit')).toHaveLength(6) // two fire entrants × three foes
    const hits = events.filter(e => e.type === 'hit')
    expect(hits[0]).toMatchObject({ amount: Math.round(input.entrants[0]!.stats.atk * 1.5 * 2) - 10, mass: true })
    resolvePuzzlePlayerCombat(single, [{ orb: 'fire', indices: [0, 1, 2] }, { orb: 'fire', indices: [27, 28, 29] }], input.enemies[0]!.id, [])
    expect(single.enemies[1]!.hp).toBe(input.enemies[1]!.maxHp)
  })
  it('iterates element, slot, group, formation and retargets a defeated focus before later hits', () => {
    const s = createBattle(syntheticPuzzleBattle()), events: PuzzleBattleEvent[] = []; s.enemies[0]!.hp = 1
    resolvePuzzlePlayerCombat(s, [{ orb: 'water', indices: [6, 7, 8] }, { orb: 'fire', indices: [0, 1, 2] }], s.enemies[0]!.id, events)
    expect(events.filter(e => e.type === 'hit').map(e => e.type === 'hit' ? [e.element, e.slot, e.enemyId] : [])).toEqual([
      ['fire', 0, 'invented-foe-0'], ['fire', 3, 'invented-foe-1'], ['water', 1, 'invented-foe-1'], ['water', 4, 'invented-foe-1'],
    ])
    expect(events).toContainEqual({ type: 'retarget', from: 'invented-foe-0', to: 'invented-foe-1' })
    resolvePuzzleEnemies(s, events)
    expect(events.filter(e => e.type === 'enemy-intent').some(e => e.type === 'enemy-intent' && e.enemyId === 'invented-foe-0')).toBe(false)
  })
  it('uses strongest barrier after DEF, and bypasses it at the shown combo threshold', () => {
    const s = createBattle(syntheticPuzzleBattle()), e = s.enemies[0]!, events: PuzzleBattleEvent[] = []
    e.guard = { reduction: 0.5, comboThreshold: 2, expiresAfterTurn: 1 }; e.ward = { reduction: 0.3, comboThreshold: 2, expiresAfterTurn: 1 }
    resolvePuzzlePlayerCombat(s, [{ orb: 'fire', indices: [0, 1, 2] }], e.id, events)
    expect(events.find(v => v.type === 'hit')).toMatchObject({ amount: Math.round((s.input.entrants[0]!.stats.atk * 2 - 10) * 0.5) })
    const bypass: PuzzleBattleEvent[] = []
    resolvePuzzlePlayerCombat(s, [{ orb: 'fire', indices: [0, 1, 2] }, { orb: 'heart', indices: [6, 7, 8] }], e.id, bypass)
    expect(bypass.find(v => v.type === 'hit')).toMatchObject({ amount: Math.round(s.input.entrants[0]!.stats.atk * 2 * 1.25) - 10 })
  })
  it('applies one four-pattern or row-pattern, and never upgrades every ten levels', () => {
    const input = syntheticPuzzleBattle('patterns', 'ordinary', 'mono', 10), s = createBattle(input), events: PuzzleBattleEvent[] = []
    s.input.entrants[0]!.kit.patternId = 'puzzle:row'
    resolvePuzzlePlayerCombat(s, [{ orb: 'fire', indices: [0, 1, 2, 3, 4, 5] }], s.enemies[0]!.id, events)
    expect(events[0]).toMatchObject({ amount: Math.round(input.entrants[0]!.stats.atk * 1.75 * 1.25 * 2) - 10 })
    const four = createBattle(input), fourEvents: PuzzleBattleEvent[] = []
    resolvePuzzlePlayerCombat(four, [{ orb: 'fire', indices: [0, 1, 2, 3] }], four.enemies[0]!.id, fourEvents)
    expect(fourEvents[0]).toMatchObject({ amount: Math.round(input.entrants[0]!.stats.atk * 1.25 * 1.25 * 2) - 10 })
  })
  it('orders simultaneous intents by formation and stops immediately on party death', () => {
    const s = createBattle(syntheticPuzzleBattle()), events: PuzzleBattleEvent[] = []; s.hp = 1
    s.enemies.forEach(e => { e.countdown = 1 })
    resolvePuzzleEnemies(s, events)
    expect(s.hp).toBe(0); expect(events.filter(e => e.type === 'enemy-intent')).toHaveLength(1)
    expect(events.find(e => e.type === 'enemy-intent')).toMatchObject({ enemyId: s.enemies[0]!.id })
  })
  it('applies the incoming floor without party-element average resistance', () => {
    expect(puzzleIncomingDamage(100, 0.35, 9999)).toBe(25)
    expect(puzzleIncomingDamage(100, 0.35, 10)).toBe(55)
    const s = createBattle(syntheticPuzzleBattle()); s.shield = 0.35
    expect(puzzleEnemyIntentViews(s)[0]).toMatchObject({ displayedDamage: 750, mitigatedDamage: puzzleIncomingDamage(750, 0.35, s.guard), delayImmune: false })
  })
  it('cancels a dead healer and resolves equal proportional-HP allies in formation order', () => {
    const input = syntheticPuzzleBattle(), healer = input.enemies[2]!
    healer.recipeId = 'puzzle:ally-healer'; healer.intents = [{ type: 'heal', countdown: 2, amount: 100 }, { type: 'attack', countdown: 2, damage: 10 }]
    const s = createBattle(input), events: PuzzleBattleEvent[] = []
    s.enemies[0]!.hp = 550; s.enemies[1]!.hp = 550; s.enemies[2]!.countdown = 1
    resolvePuzzleEnemies(s, events)
    expect(events.find(e => e.type === 'enemy-intent')).toMatchObject({ targetId: s.enemies[0]!.id })
    const dead = createBattle(input), canceled: PuzzleBattleEvent[] = []; dead.enemies[2]!.hp = 0; dead.enemies[2]!.countdown = 1
    resolvePuzzleEnemies(dead, canceled); expect(canceled).toEqual([])
  })
  it('preserves a pending delay across the single rage warning and rounds rage damage before mitigation', () => {
    const s = createBattle(syntheticPuzzleBattle('rage-delay', 'champion')), events: PuzzleBattleEvent[] = [], foe = s.enemies[0]!
    foe.hp = 1000; foe.delayed = true; foe.intentIndex = 1
    resolvePuzzleEnemies(s, events)
    expect(foe.countdown).toBe(3); expect(events.some(e => e.type === 'enemy-intent')).toBe(false)
    expect(puzzleEnemyIntentViews(s)[0]).toMatchObject({ displayedDamage: 2250, mitigatedDamage: 2250 - s.guard })
  })
  it('heals lowest proportional living ally, breaking ties by formation and excluding itself', () => {
    const input = syntheticPuzzleBattle('healer', 'guardian'), s = createBattle(input), events: PuzzleBattleEvent[] = []
    s.enemies[0]!.hp = 100; s.enemies[1]!.hp = 1; s.enemies[1]!.countdown = 1
    resolvePuzzleEnemies(s, events)
    expect(events.find(e => e.type === 'enemy-intent' && e.intent.type === 'heal')).toMatchObject({ targetId: s.enemies[0]!.id, amount: 350 })
    const alone = createBattle(input), noop: PuzzleBattleEvent[] = []; alone.enemies[0]!.hp = 0; alone.enemies[1]!.countdown = 1
    resolvePuzzleEnemies(alone, noop)
    expect(noop.find(e => e.type === 'enemy-intent')).toMatchObject({ targetId: null, amount: 0 })
  })
  it('warns a phase only strictly below half HP, once, and preserves entry reward identity', () => {
    const s = createBattle(syntheticPuzzleBattle('rage', 'champion')), events: PuzzleBattleEvent[] = [], reward = JSON.stringify(s.input.rewards)
    s.enemies[0]!.hp = s.input.enemies[0]!.maxHp / 2
    resolvePuzzleEnemies(s, events); expect(s.enemies[0]!.phaseFired).toBe(false)
    s.enemies[0]!.hp--; resolvePuzzleEnemies(s, events)
    expect(s.enemies[0]).toMatchObject({ phaseFired: true, element: 'dark', countdown: 2 })
    expect(events.filter(e => e.type === 'phase')).toHaveLength(1)
    resolvePuzzleEnemies(s, events); expect(events.filter(e => e.type === 'phase')).toHaveLength(1)
    expect(JSON.stringify(s.input.rewards)).toBe(reward)
  })
})
