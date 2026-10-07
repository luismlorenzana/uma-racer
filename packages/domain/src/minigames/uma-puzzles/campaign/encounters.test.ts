import { describe, expect, it } from 'vitest'
import { SCENARIOS } from '../../../scenarios'
import { createBattle, applyBattleAction } from '../battle'
import { parsePuzzleBattleInput } from '../battle-parse'
import { puzzleBotAction } from '../bots'
import { battleStateHash, replayBattle } from '../replay'
import { puzzleStats, puzzleWinExp } from '../progression'
import { parsePuzzleMaterialId } from '../materials'
import type { PuzzleBattleAction, PuzzleBattleInputV1 } from '../battle-types'
import { puzzleChapter } from './chapters'
import { parsePuzzleCast, resolvePuzzleEncounter, freezePuzzleEncounter } from './encounters'
import { syntheticPuzzleCast, syntheticPuzzleEntrants } from './fixtures'
import { createPuzzleCheckpoint, applyPuzzleTerminal } from './progress'
import { puzzleBattleGrants } from './rewards'
import { reachedFinals } from './test-helpers'

function entered(localId = 'o1a', level = 30, darkVariant: 'pace' | 'late' | null = null) {
  const chapter = puzzleChapter(SCENARIOS[0]!.id), checkpoint = localId.startsWith('c-') ? reachedFinals(chapter) : createPuzzleCheckpoint(chapter, 'puzzle-party-1')
  const nodeId = chapter.nodes.find(n => n.localId === localId)!.id
  return { chapter, checkpoint, nodeId, entrants: syntheticPuzzleEntrants(level), leaderId: 'puzzle:combo-leader' as const,
    cast: syntheticPuzzleCast(), accountSeed: 'invented-account', ownerEpoch: 0, darkVariant }
}
const played = (input: PuzzleBattleInputV1) => {
  let state = createBattle(input); const actions: PuzzleBattleAction[] = []
  while (state.outcome === 'active') { const action = puzzleBotAction(state, 'competent'); actions.push(action); state = applyBattleAction(state, action).state }
  expect(battleStateHash(replayBattle(input, actions).state)).toBe(battleStateHash(state)); return state
}
describe('frozen campaign encounters and once-account rewards', () => {
  it('uses exactly the preview coefficients regardless of entrants, and cosmetic cast versions do not change the semantic state hash', () => {
    const entry = entered(), preview = resolvePuzzleEncounter(entry.chapter, entry.nodeId, entry.cast), input = freezePuzzleEncounter(entry)
    expect(input.enemies).toEqual(preview.enemies); expect(input.rewards).toEqual(preview.rewards)
    expect(freezePuzzleEncounter({ ...entry, entrants: syntheticPuzzleEntrants(1) }).enemies).toEqual(input.enemies)
    const cosmetic = freezePuzzleEncounter({ ...entry, cast: { ...entry.cast, manifestVersion: 'invented-new-art-v2',
      members: entry.cast.members.map(m => ({ ...m, id: `updated-${m.id}` })).reverse() } })
    expect(battleStateHash(createBattle(cosmetic))).toBe(battleStateHash(createBattle(input)))
    // Literal semantic recipe/seed pin. T107's established two journal fixtures remain untouched.
    expect(battleStateHash(createBattle(input))).toBe('27209b7145e3a389')
  })
  it.each(SCENARIOS.map(s => s.id))('resolves every %s node with fixed recipes and per-kind special bounds', id => {
    const chapter = puzzleChapter(id)
    for (const node of chapter.nodes) {
      const encounter = resolvePuzzleEncounter(chapter, node.id, syntheticPuzzleCast(), node.localId === 'c-dark' ? 'pace' : null)
      expect(encounter.enemies).toHaveLength(node.kind === 'ordinary' ? 3 : 1)
      expect(encounter.rewards.reduce((n, r) => n + r.quantity, 0)).toBe(node.kind === 'ordinary' ? 3 : node.kind === 'guardian' ? 4 : 12)
      for (const foe of encounter.enemies) {
        expect(foe.openingCountdown).toBeGreaterThanOrEqual(1); expect(foe.delayImmune).toBe(false)
        expect(foe.intents.filter(i => i.type !== 'attack').length + Number(foe.phase !== null)).toBeLessThanOrEqual(node.kind === 'ordinary' ? 1 : 2)
      }
      for (const r of encounter.rewards) expect(parsePuzzleMaterialId(`constellation:${id}:${r.style}`)).toEqual({ scenarioId: id, style: r.style })
    }
  })
  it('rejects missing cast coverage rather than fabricating enemies, and parses only exact ID/tag contracts', () => {
    const entry = entered()
    expect(() => freezePuzzleEncounter({ ...entry, cast: { ...entry.cast, members: entry.cast.members.slice(1) } })).toThrow('Missing verified')
    for (const v of [{ ...entry.cast, images: [] }, { ...entry.cast, members: new Array(1) }, { ...entry.cast, members: [entry.cast.members[0], entry.cast.members[0]] },
      { ...entry.cast, members: [{ ...entry.cast.members[0], roles: ['unknown'] }] }, { ...entry.cast, members: [{ ...entry.cast.members[0], elements: ['fire', 'fire'] }] }])
      expect(parsePuzzleCast(v)).toBeNull()
  })
  it('has equal Dark variant counts but different frozen families and rejects irrelevant variant selection', () => {
    const pace = freezePuzzleEncounter(entered('c-dark', 30, 'pace')), late = freezePuzzleEncounter(entered('c-dark', 30, 'late'))
    expect(pace.rewards).toEqual([{ style: 'pace', quantity: 12 }]); expect(late.rewards).toEqual([{ style: 'late', quantity: 12 }])
    expect(pace.seed).toBe(late.seed); expect(pace.enemies).toEqual(late.enemies)
    expect(() => freezePuzzleEncounter(entered('c-dark'))).toThrow('variant')
    expect(() => freezePuzzleEncounter(entered('c-fire', 30, 'pace'))).toThrow('variant')
  })
  it('grants one material vector for the account, EXP to five frozen entrants, and repeats with a new seed/attempt', () => {
    const entry = entered(), input = freezePuzzleEncounter(entry), state = played(input), grants = puzzleBattleGrants(state)
    expect(state.outcome).toBe('win'); expect(grants.materials.reduce((n, r) => n + r.quantity, 0)).toBe(3)
    expect(grants.exp).toHaveLength(5); expect(grants.exp.every(e => e.amount === puzzleWinExp(1, 30, 'ordinary'))).toBe(true)
    const checkpoint = applyPuzzleTerminal(entry.chapter, entry.checkpoint, grants.fact)
    const repeat = freezePuzzleEncounter({ ...entry, checkpoint })
    expect(repeat.battleId).not.toBe(input.battleId); expect(repeat.seed).not.toBe(input.seed)
    expect(puzzleBattleGrants(played(repeat)).materials).toEqual(grants.materials)
    const changed = { ...state, input: { ...state.input, rewards: [{ style: 'front' as const, quantity: 99 }] } }
    expect(() => puzzleBattleGrants(changed)).toThrow('reward vector')
  })
  it('rejects active/non-campaign results; abandon and partial-kill loss grant nothing', () => {
    const input = freezePuzzleEncounter(entered()), state = createBattle(input)
    expect(() => puzzleBattleGrants(state)).toThrow('terminal')
    const abandoned = applyBattleAction(state, { type: 'abandon' }).state
    const partialLoss = { ...state, outcome: 'loss' as const, reason: 'hp-zero' as const, hp: 0,
      enemies: state.enemies.map((e, i) => ({ ...e, hp: i === 0 ? 0 : e.hp })) }
    for (const terminal of [abandoned, partialLoss]) {
      const grants = puzzleBattleGrants(terminal)
      expect(grants.materials).toEqual([]); expect(grants.exp.every(e => e.amount === 0)).toBe(true)
    }
    expect(() => puzzleBattleGrants({ ...abandoned, input: { ...input, battleId: 'non-campaign' } })).toThrow('canonical')
  })
  it('keeps Dark drops through a colour-changing rage and uses entrant PL frozen at entry', () => {
    const input = freezePuzzleEncounter(entered('c-dark', 13, 'pace'))
    input.enemies[0]!.phase!.element = 'fire' // Invented phase variant of the existing T107 contract.
    const state = played(input)
    expect(state.enemies[0]!.phaseFired).toBe(true); expect(state.enemies[0]!.element).toBe('fire')
    const grants = puzzleBattleGrants(state)
    expect(grants.materials).toEqual([{ itemId: 'constellation:ura-finale:pace', style: 'pace', quantity: 12 }])
    expect(grants.exp[0]).toEqual({ outfitId: input.entrants[0]!.outfitId, frozenLevel: 13, amount: puzzleWinExp(10, 13, 'champion') })
  })
  it('supports a trusted future registry throughout create/actions/hash/replay/result, but not by an injected input field', () => {
    const registry = [...SCENARIOS, { id: 'invented-next', name: 'Invented next', tier: 15 }], chapter = puzzleChapter('invented-next', registry)
    const input = freezePuzzleEncounter({ ...entered(), chapter, checkpoint: createPuzzleCheckpoint(chapter, 'puzzle-party-1', registry),
      nodeId: chapter.nodes[0]!.id, entrants: syntheticPuzzleEntrants(141) }, registry)
    expect(parsePuzzleBattleInput(input)).toBeNull(); expect(parsePuzzleBattleInput(input, registry)).toEqual(input)
    expect(parsePuzzleBattleInput({ ...input, registry }, registry)).toBeNull()
    const state = applyBattleAction(createBattle(input, registry), { type: 'abandon' }, registry).state
    expect(battleStateHash(replayBattle(input, [{ type: 'abandon' }], registry).state, registry)).toBe(battleStateHash(state, registry))
    expect(puzzleBattleGrants(state, registry).exp.every(e => e.amount === 0)).toBe(true)
    expect(input.entrants[0]!.stats).toEqual(puzzleStats(input.entrants[0]!.source, 141))
  })
})
