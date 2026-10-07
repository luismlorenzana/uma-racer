// Pure public v1 reducer; invalid actions never mutate caller state or RNG (implementation §§4–5).
import { PUZZLE_ACTION_LIMIT, PUZZLE_ENGINE_VERSION, PUZZLE_TURN_LIMIT } from './battle-rules'
import { parsePuzzleBattleAction, parsePuzzleBattleInput, parsePuzzleBattleState, puzzlePartyStats } from './battle-parse'
import type { PuzzleBattleAction, PuzzleBattleEvent, PuzzleBattleInputV1, PuzzleBattleStateV1, PuzzleBattleTransition } from './battle-types'
import { applyPuzzlePath, convertPuzzleBoard, createPuzzleBoard, resolvePuzzleBoard } from './board'
import { PUZZLE_ACTIVES } from './catalogue'
import { puzzleFocus, resolvePuzzlePlayerCombat } from './combat'
import { puzzleEnemyIntentViews, resolvePuzzleEnemies } from './enemies'
import { createPuzzleRng } from './rng'
import { requirePuzzle } from './validation'

export function createBattle(value: PuzzleBattleInputV1): PuzzleBattleStateV1 {
  const input = parsePuzzleBattleInput(value)
  requirePuzzle(input, 'invalid', 'Invalid or unsupported frozen Puzzle battle input')
  const rng = createPuzzleRng(input.seed), opening = createPuzzleBoard(rng.opening), totals = puzzlePartyStats(input)
  rng.opening = opening.state
  return { engineVersion: PUZZLE_ENGINE_VERSION, input, board: opening.board, rng, turn: 0, actionCount: 0, ...totals, hp: totals.maxHp,
    members: input.entrants.map(() => ({ charge: 0, usedInGap: false })), enemies: input.enemies.map(e => ({ id: e.id, hp: e.maxHp,
      element: e.element, countdown: e.openingCountdown, intentIndex: 0, phaseFired: false, delayed: false, guard: null, ward: null })),
    shield: 0, outcome: 'active', reason: null }
}
function active(state: PuzzleBattleStateV1, action: Extract<PuzzleBattleAction, { type: 'use-active' }>, events: PuzzleBattleEvent[]): void {
  const member = state.members[action.slot]!, entrant = state.input.entrants[action.slot]!, recipe = PUZZLE_ACTIVES.find(a => a.id === entrant.kit.activeId)!
  requirePuzzle(!member.usedInGap && member.charge === recipe.charge, 'locked', 'Active is not ready in this gap')
  if (recipe.effect === 'convert') {
    const before = [...state.board], candidates = before.flatMap((orb, i) => orb !== 'heart' && orb !== entrant.element ? [i] : [])
    requirePuzzle(candidates.length, 'locked', 'No eligible off-colour cells; charge preserved')
    const converted = convertPuzzleBoard(before, candidates, entrant.element, recipe.count, state.rng.playerConversion)
    state.board = converted.board; state.rng.playerConversion = converted.state
    events.push({ type: 'conversion', actor: 'player', actorId: entrant.outfitId, indices: converted.indices, before, after: [...state.board] })
  } else if (recipe.effect === 'shield') {
    requirePuzzle(state.shield < recipe.reduction, 'locked', 'An equal or stronger shield is already pending')
    state.shield = Math.max(state.shield, recipe.reduction); events.push({ type: 'shield', reduction: state.shield, consumed: false })
  } else {
    const focus = puzzleFocus(state, action.focusId), index = state.enemies.findIndex(e => e.id === focus), e = state.enemies[index]!
    requirePuzzle(!state.input.enemies[index]!.delayImmune && !e.delayed, 'locked', 'Foe is immune or already delayed; charge preserved')
    e.delayed = true; e.countdown += recipe.steps
    events.push({ type: 'delay', enemyId: e.id, countdown: e.countdown })
  }
  member.charge = 0; member.usedInGap = true
  events.unshift({ type: 'active', slot: action.slot, activeId: recipe.id })
}
function tick(state: PuzzleBattleStateV1, events: PuzzleBattleEvent[]): void {
  for (const e of state.enemies) for (const barrier of ['guard', 'ward'] as const) {
    if (e[barrier] && e[barrier]!.expiresAfterTurn <= state.turn) { e[barrier] = null; events.push({ type: 'barrier', enemyId: e.id, barrier, value: null }) }
  }
  for (let slot = 0; slot < state.members.length; slot++) {
    const m = state.members[slot]!, recipe = PUZZLE_ACTIVES.find(a => a.id === state.input.entrants[slot]!.kit.activeId)!
    m.usedInGap = false; m.charge = Math.min(recipe.charge, m.charge + 1)
    events.push({ type: 'charge', slot, charge: m.charge, ready: m.charge === recipe.charge })
  }
}
export function applyBattleAction(value: PuzzleBattleStateV1, actionValue: PuzzleBattleAction): PuzzleBattleTransition {
  const state = parsePuzzleBattleState(value), action = parsePuzzleBattleAction(actionValue)
  requirePuzzle(state && action, 'invalid', 'Invalid Puzzle state/action')
  requirePuzzle(state.outcome === 'active', 'locked', 'Battle is terminal')
  requirePuzzle(state.actionCount < PUZZLE_ACTION_LIMIT, 'overflow', 'Journal action bound exceeded')
  if (action.type !== 'abandon') requirePuzzle(action.focusId === null || state.enemies.some(e => e.id === action.focusId), 'unknown', 'Unknown focus id')
  const events: PuzzleBattleEvent[] = []
  if (action.type === 'abandon') { state.outcome = 'abandon'; state.reason = 'abandoned' }
  else if (action.type === 'use-active') active(state, action, events)
  else {
    const before = [...state.board], moved = applyPuzzlePath(before, action.path), resolved = resolvePuzzleBoard(moved, state.rng.refill)
    events.push({ type: 'drag', path: action.path, before, after: moved }, ...resolved.cascades.map(cascade => ({ type: 'cascade' as const, cascade })))
    state.board = resolved.board; state.rng.refill = resolved.state; state.turn++
    resolvePuzzlePlayerCombat(state, resolved.cascades.flatMap(c => c.groups), action.focusId, events)
    resolvePuzzleEnemies(state, events); tick(state, events)
    if (state.enemies.every(e => e.hp === 0)) { state.outcome = 'win'; state.reason = 'cleared' }
    else if (state.hp === 0) { state.outcome = 'loss'; state.reason = 'hp-zero' }
    else if (state.turn === PUZZLE_TURN_LIMIT) { state.outcome = 'loss'; state.reason = 'turn-limit' }
  }
  state.actionCount++
  if (state.outcome === 'active') events.push({ type: 'intents', views: puzzleEnemyIntentViews(state) })
  else events.push({ type: 'terminal', outcome: state.outcome, reason: state.reason! })
  requirePuzzle(parsePuzzleBattleState(state), 'overflow', 'Transition produced an invalid state; restore the journal')
  return { state, events }
}
