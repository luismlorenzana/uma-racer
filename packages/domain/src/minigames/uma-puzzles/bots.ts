// Modest board-only public-action bots; no hidden RNG look-ahead (docs/design/uma-puzzles.md balance).
import type { PuzzleBattleAction, PuzzleBattleStateV1 } from './battle-types'
import { applyPuzzlePath, puzzleAdjacent, puzzleIndexCell, puzzleMatchGroups, type PuzzleCell } from './board'
import { PUZZLE_ACTIVES } from './catalogue'
import { puzzleFocus } from './combat'

export type PuzzleBot = 'novice' | 'competent'
export const PUZZLE_BOT_SEARCH = { depth: 6, width: 8 } as const
function score(state: PuzzleBattleStateV1, path: PuzzleCell[]): number {
  const groups = puzzleMatchGroups(applyPuzzlePath(state.board, path))
  return groups.reduce((n, g) => n + g.indices.length * (g.orb === 'heart' ? (state.hp < state.maxHp * 0.75 ? 2 : 0.3) :
    state.input.entrants.filter(e => e.element === g.orb).length + 0.1), 0) + groups.length * 3
}
export function puzzleBotAction(state: PuzzleBattleStateV1, bot: PuzzleBot): PuzzleBattleAction {
  const focusId = puzzleFocus(state, null)
  if (bot === 'competent') for (let slot = 0; slot < state.members.length; slot++) {
    const member = state.members[slot]!, entrant = state.input.entrants[slot]!, recipe = PUZZLE_ACTIVES.find(a => a.id === entrant.kit.activeId)!
    if (member.usedInGap || member.charge !== recipe.charge) continue
    const focus = state.enemies.find(e => e.id === focusId)!, definition = state.input.enemies.find(e => e.id === focusId)!
    if (recipe.effect === 'shield' ? state.shield >= recipe.reduction : recipe.effect === 'delay' ? definition.delayImmune || focus.delayed :
      !state.board.some(orb => orb !== 'heart' && orb !== entrant.element)) continue
    return { type: 'use-active', slot, focusId }
  }
  const cells = state.board.map((_, i) => puzzleIndexCell(i))
  let beam = cells.flatMap(a => cells.filter(b => puzzleAdjacent(a, b)).map(b => ({ path: [a, b], score: score(state, [a, b]) })))
    .sort((a, b) => b.score - a.score).slice(0, PUZZLE_BOT_SEARCH.width)
  let best = beam[0]!
  if (bot === 'competent') for (let depth = 2; depth < PUZZLE_BOT_SEARCH.depth; depth++) {
    beam = beam.flatMap(route => cells.filter(c => puzzleAdjacent(route.path.at(-1)!, c)).map(c => {
      const path = [...route.path, c]; return { path, score: score(state, path) }
    })).sort((a, b) => b.score - a.score).slice(0, PUZZLE_BOT_SEARCH.width)
    if (beam[0]!.score > best.score) best = beam[0]!
  }
  return { type: 'drag', path: best.path, focusId, elapsedMs: 0 }
}
