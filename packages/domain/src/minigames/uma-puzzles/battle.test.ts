import { describe, expect, it } from 'vitest'
import { applyBattleAction, createBattle } from './battle'
import { syntheticPuzzleBattle } from './battle-fixtures'
import { parsePuzzleBattleAction, parsePuzzleBattleInput, parsePuzzleBattleResult, parsePuzzleBattleState, parsePuzzleEnemy } from './battle-parse'
import type { PuzzleBattleAction, PuzzleBattleStateV1 } from './battle-types'
import { PUZZLE_ORBS } from './board'
import { defaultPuzzleKit, parsePuzzleKit, puzzleKitChoices } from './catalogue'
import { battleStateHash, puzzleBattleResult, replayBattle } from './replay'
import { puzzleError, syntheticPuzzleSource } from './test-fixtures'

const loop: PuzzleBattleAction = { type: 'drag', elapsedMs: 0, focusId: null, path: [{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 0 }] }
function ready(): PuzzleBattleStateV1 {
  const input = syntheticPuzzleBattle('active-tests', 'ordinary', 'starter-shaped')
  input.enemies.forEach(e => { e.openingCountdown = 30; e.intents = [{ type: 'attack', countdown: 30, damage: 1 }] })
  let s = createBattle(input)
  for (let i = 0; i < 7; i++) s = applyBattleAction(s, loop).state
  return s
}
describe('v1 Puzzle battle lifecycle and strict boundary', () => {
  it('starts full, uncharged and detached from caller input, without changing the save', () => {
    const input = syntheticPuzzleBattle(), s = createBattle(input)
    expect(s.hp).toBe(s.maxHp); expect(s.turn).toBe(0); expect(s.members.map(m => m.charge)).toEqual([0, 0, 0, 0, 0])
    input.enemies[0]!.maxHp = 1; input.entrants[0]!.source.baseStats.speed = 1
    expect(s.input.enemies[0]!.maxHp).toBe(1100); expect(s.input.entrants[0]!.source.baseStats.speed).toBe(110)
  })
  it('applies just one leader to party totals and never stacks outfit leaders', () => {
    const input = syntheticPuzzleBattle(), base = createBattle(input)
    input.leaderId = 'puzzle:durable-leader'
    expect(createBattle(input).maxHp).toBe(Math.round(base.maxHp * 1.15))
    input.leaderId = 'puzzle:recovery-leader'
    expect(createBattle(input).rcv).toBe(Math.round(base.rcv * 1.2))
    expect(createBattle(input).maxHp).toBe(base.maxHp)
  })
  it('costs a turn for a moved zero-match loop; ticks each charge once, not per cell', () => {
    const s = createBattle(syntheticPuzzleBattle()), step = applyBattleAction(s, loop)
    expect(step.state.turn).toBe(1); expect(step.state.actionCount).toBe(1); expect(step.state.board).toEqual(s.board)
    expect(step.state.members.map(m => m.charge)).toEqual([1, 1, 1, 1, 1])
    expect(step.state.rng).toEqual(s.rng); expect(s.turn).toBe(0)
  })
  it('validates illegal actions before any mutation or RNG consumption', () => {
    const s = ready(), before = JSON.stringify(s)
    const invalid = [{ ...loop, elapsedMs: NaN }, { ...loop, elapsedMs: 7001 }, { ...loop, elapsedMs: -1 },
      { ...loop, path: [{ row: 0, column: 0 }] }, { ...loop, path: [{ row: 0, column: 0 }, { row: 4, column: 5 }] },
      { type: 'use-active', slot: 5, focusId: null }, { type: 'poison' }, { ...loop, extra: 1 }]
    for (const a of invalid) puzzleError(() => applyBattleAction(s, a as PuzzleBattleAction), 'invalid')
    puzzleError(() => applyBattleAction(s, { ...loop, focusId: 'unknown' }), 'unknown')
    expect(JSON.stringify(s)).toBe(before)
  })
  it('accepts the exact duration/path boundary and rejects future/prototype/malformed payloads', () => {
    const path = Array.from({ length: 256 }, (_, i) => ({ row: 0, column: i % 2 }))
    expect(parsePuzzleBattleAction({ ...loop, path, elapsedMs: 7000 })).not.toBeNull()
    const input = syntheticPuzzleBattle()
    for (const v of [{ ...input, engineVersion: 2 }, { ...input, rulesVersion: 2 }, { ...input, entrants: input.entrants.slice(1) },
      { ...input, enemies: Array(6).fill(input.enemies[0]) }, { ...input, partyId: 'puzzle-party-11' }, { ...input, ownerEpoch: Infinity },
      { ...input, surprise: 1 }, Object.assign(Object.create({}), input), JSON.parse('{"__proto__":{},"engineVersion":1}')]) expect(parsePuzzleBattleInput(v)).toBeNull()
    const duplicate = syntheticPuzzleBattle(); duplicate.entrants[1] = duplicate.entrants[0]!
    expect(parsePuzzleBattleInput(duplicate)).toBeNull()
    const staleStats = syntheticPuzzleBattle(); staleStats.entrants[0]!.stats.atk++
    expect(parsePuzzleBattleInput(staleStats)).toBeNull()
    const wrongElement = syntheticPuzzleBattle(); wrongElement.entrants[0]!.source.aptitudes.surface.dirt = 'B'
    expect(parsePuzzleBattleInput(wrongElement)).toBeNull()
    const sparse = syntheticPuzzleBattle(); delete sparse.entrants[0]
    expect(parsePuzzleBattleInput(sparse)).toBeNull()
    const sparseState = ready(); delete sparseState.board[0]
    expect(parsePuzzleBattleState(sparseState)).toBeNull()
    const sparseIntent = syntheticPuzzleBattle(); delete sparseIntent.enemies[0]!.intents[0]
    expect(parsePuzzleBattleInput(sparseIntent)).toBeNull()
  })
  it('publishes a finite source-A kit with exact default and PL5/10 gates, not B-style choices', () => {
    const source = syntheticPuzzleSource(['pace', 'late'])
    expect(defaultPuzzleKit(source)).toEqual({ activeId: 'puzzle:pace-shield', patternId: null })
    expect(puzzleKitChoices(source, 1).actives).toEqual(['puzzle:pace-shield', 'puzzle:late-convert'])
    expect(puzzleKitChoices(source, 4).patterns).toEqual([])
    expect(puzzleKitChoices(source, 5).patterns).toEqual(['puzzle:four'])
    expect(puzzleKitChoices(source, 1000).patterns).toEqual(['puzzle:four', 'puzzle:row'])
    expect(parsePuzzleKit({ activeId: 'puzzle:front-convert', patternId: null }, source, 100)).toBeNull()
    expect(parsePuzzleKit({ activeId: 'puzzle:pace-shield', patternId: 'puzzle:row' }, source, 9)).toBeNull()
  })
  it('converts bounded non-Heart off-colours without auto-clearing, charging or ticking foes', () => {
    const s = ready(), step = applyBattleAction(s, { type: 'use-active', slot: 0, focusId: null })
    const conversion = step.events.find(e => e.type === 'conversion')!
    expect(conversion.type === 'conversion' && conversion.indices.length).toBe(4)
    expect(step.state.board.filter(o => o === 'heart')).toHaveLength(s.board.filter(o => o === 'heart').length)
    expect(step.state.turn).toBe(s.turn); expect(step.state.enemies).toEqual(s.enemies)
    expect(step.state.rng.refill).toBe(s.rng.refill); expect(step.state.rng.enemyConversion).toBe(s.rng.enemyConversion)
    expect(step.state.members[0]).toEqual({ charge: 0, usedInGap: true }); expect(step.state.members[1]).toEqual(s.members[1])
    puzzleError(() => applyBattleAction(step.state, { type: 'use-active', slot: 0, focusId: null }), 'locked')
    const noop = ready(); noop.board = Array(30).fill('heart')
    puzzleError(() => applyBattleAction(noop, { type: 'use-active', slot: 0, focusId: null }), 'locked')
    expect(noop.members[0]!.charge).toBe(5)
  })
  it('rejects delay immunity and repeated delays without consuming a different End member’s charge', () => {
    const s = ready(); s.input.enemies[0]!.delayImmune = true
    puzzleError(() => applyBattleAction(s, { type: 'use-active', slot: 3, focusId: s.enemies[0]!.id }), 'locked')
    s.input.enemies[0]!.delayImmune = false
    const delayed = applyBattleAction(s, { type: 'use-active', slot: 3, focusId: s.enemies[0]!.id }).state
    expect(delayed.enemies[0]!.countdown).toBe(s.enemies[0]!.countdown + 1)
    delayed.members[3] = { charge: 7, usedInGap: false }
    puzzleError(() => applyBattleAction(delayed, { type: 'use-active', slot: 3, focusId: s.enemies[0]!.id }), 'locked')
    delayed.enemies[0]!.countdown = 1
    const acted = applyBattleAction(delayed, loop).state
    expect(acted.enemies[0]!.delayed).toBe(false)
  })
  it('does not stack shields or waste charge, and covers the whole next damaging phase only', () => {
    const s = ready(), first = applyBattleAction(s, { type: 'use-active', slot: 1, focusId: null }).state
    puzzleError(() => applyBattleAction(first, { type: 'use-active', slot: 4, focusId: null }), 'locked')
    expect(first.members[4]!.charge).toBe(6)
    const empty = applyBattleAction(first, loop).state
    expect(empty.shield).toBe(0.35)
    empty.enemies.forEach(e => { e.countdown = 1 })
    empty.input.enemies.forEach(e => { e.intents[0] = { type: 'attack', countdown: 30, damage: 100 } })
    const incoming = applyBattleAction(empty, loop)
    expect(incoming.state.hp).toBe(empty.hp - 3 * Math.max(25, 65 - empty.guard))
    expect(incoming.state.shield).toBe(0)
    expect(incoming.events.filter(e => e.type === 'shield' && e.consumed)).toHaveLength(1)
  })
  it('preserves shield across a support-only phase and gives Guard exactly the following drag', () => {
    const input = syntheticPuzzleBattle('barriers', 'guardian'), s = createBattle(input)
    s.shield = 0.35; s.enemies.forEach(e => { e.countdown = 1 })
    const support = applyBattleAction(s, loop)
    expect(support.state.shield).toBe(0.35); expect(support.state.enemies[0]!.guard?.expiresAfterTurn).toBe(2)
    const next = applyBattleAction(support.state, loop)
    expect(next.state.enemies[0]!.guard).toBeNull()
  })
  it('runs enemy conversions on a separate stream, leaves their matches for the next drag', () => {
    const input = syntheticPuzzleBattle('converter'), foe = input.enemies[0]!
    foe.recipeId = 'puzzle:converter'; foe.openingCountdown = 1
    foe.intents = [{ type: 'convert', countdown: 2, from: 'water', to: 'fire', count: 4 }, { type: 'attack', countdown: 2, damage: 1 }]
    const s = createBattle(input), step = applyBattleAction(s, loop)
    expect(step.state.rng.refill).toBe(s.rng.refill); expect(step.state.rng.playerConversion).toBe(s.rng.playerConversion)
    expect(step.state.rng.enemyConversion).not.toBe(s.rng.enemyConversion)
    expect(step.events.some(e => e.type === 'cascade')).toBe(false)
    expect(step.events.find(e => e.type === 'conversion')).toMatchObject({ actor: 'enemy', actorId: foe.id })
  })
  it('rejects unsupported recipes, unbounded converters and invalid phase/guard parameters', () => {
    const foe = syntheticPuzzleBattle().enemies[0]!
    for (const v of [{ ...foe, recipeId: 'poison' }, { ...foe, intents: [{ type: 'poison', countdown: 1, damage: 1 }] },
      { ...foe, recipeId: 'puzzle:converter', intents: [{ type: 'convert', countdown: 1, from: 'fire', to: 'wood', count: 5 }, foe.intents[0]] },
      { ...foe, recipeId: 'puzzle:guard', intents: [{ type: 'guard', countdown: 1, reduction: 0.5, durationDrags: 2, comboThreshold: 3 }, foe.intents[0]] },
      { ...foe, recipeId: 'puzzle:champion', phase: { atHpPercent: 60, damageMultiplier: 2, countdown: 2, element: null } }]) expect(parsePuzzleEnemy(v)).toBeNull()
  })
  it('wins on drag30 before the turn limit, and otherwise loses at30 without a partial turn', () => {
    const s = ready(); s.turn = 29; s.actionCount = 29; s.enemies.forEach(e => { e.countdown = 30 })
    expect(applyBattleAction(s, loop).state).toMatchObject({ turn: 30, outcome: 'loss', reason: 'turn-limit' })
    s.enemies.forEach(e => { e.hp = 1 }); s.board = Array.from({ length: 30 }, (_, i) => PUZZLE_ORBS[(Math.floor(i / 6) + i % 6) % 6]!)
    for (let i = 0; i < 5; i++) s.board[i] = 'light'
    const win = applyBattleAction(s, loop).state
    expect(win).toMatchObject({ turn: 30, outcome: 'win', reason: 'cleared' })
    expect(parsePuzzleBattleResult(puzzleBattleResult(win))).toEqual(puzzleBattleResult(win))
    puzzleError(() => applyBattleAction(win, loop), 'locked')
  })
  it('terminates death and abandon, gives no late heal, and derives results from state only', () => {
    const s = ready(); s.hp = 1; s.enemies[0]!.countdown = 1; s.input.enemies[0]!.intents[0] = { type: 'attack', countdown: 30, damage: 10000 }
    const loss = applyBattleAction(s, loop)
    expect(loss.state).toMatchObject({ outcome: 'loss', reason: 'hp-zero', hp: 0 })
    puzzleError(() => applyBattleAction(loss.state, loop), 'locked')
    puzzleError(() => puzzleBattleResult(s), 'locked')
    const abandoned = applyBattleAction(ready(), { type: 'abandon' }).state
    expect(abandoned).toMatchObject({ outcome: 'abandon', reason: 'abandoned', turn: 7, actionCount: 8 })
    expect(puzzleBattleResult(abandoned).outcome).toBe('abandon')
    expect(parsePuzzleBattleResult({ ...puzzleBattleResult(abandoned), engineVersion: 2 })).toBeNull()
    expect(parsePuzzleBattleResult({ ...puzzleBattleResult(abandoned), hpRemaining: 0 })).toBeNull()
    expect(parsePuzzleBattleResult({ ...puzzleBattleResult(abandoned), claimedExp: 100 })).toBeNull()
  })
  it('enforces the 181-action transport bound, valid state identities and terminal consistency', () => {
    const s = ready()
    for (const v of [{ ...s, actionCount: 182 }, { ...s, rng: { ...s.rng, refill: 0 } }, { ...s, hp: s.maxHp + 1 },
      { ...s, turn: 31 }, { ...s, outcome: 'win', reason: 'cleared' }, { ...s, engineVersion: 2 },
      { ...s, members: [{ charge: 8, usedInGap: false }, ...s.members.slice(1)] }]) expect(parsePuzzleBattleState(v)).toBeNull()
    puzzleError(() => replayBattle(s.input, Array(182).fill(loop)), 'overflow')
  })
  it('hashes every rules cursor/status, excludes cosmetic joins and ignores input object key order', () => {
    const s = ready(), original = battleStateHash(s), cosmetic = JSON.parse(JSON.stringify(s)) as PuzzleBattleStateV1
    cosmetic.input.content.manifestVersion = 'invented-art-v2'; cosmetic.input.enemies[0]!.castId = 'different-art'
    expect(battleStateHash(cosmetic)).toBe(original)
    const changed = JSON.parse(JSON.stringify(s)) as PuzzleBattleStateV1; changed.rng.refill++
    expect(battleStateHash(changed)).not.toBe(original)
    expect(battleStateHash(Object.fromEntries(Object.entries(s).reverse()) as unknown as PuzzleBattleStateV1)).toBe(original)
    expect(replayBattle(s.input, Array(7).fill(loop)).state).toEqual(s)
  })
})
