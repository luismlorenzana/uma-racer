// Canonical diagnostic state hash, not a security signature (implementation §4).
import { SCENARIOS } from '../../scenarios'
import type { PuzzleScenarioRegistry } from './materials'
import { PUZZLE_ACTION_LIMIT } from './battle-rules'
import { applyBattleAction, createBattle } from './battle'
import { parsePuzzleBattleState } from './battle-parse'
import type { PuzzleBattleAction, PuzzleBattleInputV1, PuzzleBattleResultV1, PuzzleBattleStateV1, PuzzleBattleTransition } from './battle-types'
import { puzzleArray, requirePuzzle } from './validation'

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (v !== null && typeof v === 'object') return `{${Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([k, value]) => `${JSON.stringify(k)}:${canonical(value)}`).join(',')}}`
  return JSON.stringify(v)
}
export function battleStateHash(value: PuzzleBattleStateV1, registry: PuzzleScenarioRegistry = SCENARIOS): string {
  const state = parsePuzzleBattleState(value, registry)
  requirePuzzle(state, 'invalid', 'Cannot hash an invalid Puzzle state')
  const { content, enemies, ...input } = state.input
  const text = canonical({ ...state, input: { ...input, recipeHash: content.recipeHash, enemies: enemies.map(e => {
    const { castId: _cosmetic, ...rules } = e; return rules
  }) } })
  let a = 2166136261, b = 0x9e3779b9
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619) >>> 0; b = Math.imul(b ^ text.charCodeAt(i), 2246822519) >>> 0 }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')
}
export function replayBattle(input: PuzzleBattleInputV1, actions: readonly PuzzleBattleAction[], registry: PuzzleScenarioRegistry = SCENARIOS):
  { state: PuzzleBattleStateV1; hashes: string[]; steps: PuzzleBattleTransition[] } {
  requirePuzzle(puzzleArray(actions, PUZZLE_ACTION_LIMIT), 'overflow', 'Invalid journal or transport bound exceeded')
  let state = createBattle(input, registry)
  const hashes = [battleStateHash(state, registry)], steps: PuzzleBattleTransition[] = []
  for (const action of actions) { const step = applyBattleAction(state, action, registry); state = step.state; steps.push(step); hashes.push(battleStateHash(state, registry)) }
  return { state, hashes, steps }
}
export function puzzleBattleResult(state: PuzzleBattleStateV1, registry: PuzzleScenarioRegistry = SCENARIOS): PuzzleBattleResultV1 {
  const checked = parsePuzzleBattleState(state, registry)
  requirePuzzle(checked && checked.outcome !== 'active' && checked.reason, 'locked', 'Only a terminal replay produces a result')
  return { engineVersion: 1, battleId: checked.input.battleId, ownerEpoch: checked.input.ownerEpoch, actionCount: checked.actionCount,
    stateHash: battleStateHash(checked, registry), outcome: checked.outcome, reason: checked.reason, drags: checked.turn, hpRemaining: checked.hp }
}
