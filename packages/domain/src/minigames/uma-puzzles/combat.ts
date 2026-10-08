// Ordered player combat and mitigation; no renderer decisions (docs/design/uma-puzzles.md §5).
import { PUZZLE_BOARD_WIDTH, PUZZLE_COMBO_PER_GROUP, PUZZLE_DAMAGE_FLOOR, PUZZLE_MASS_MIN, PUZZLE_MATCH_MIN, PUZZLE_MATCHUP,
  PUZZLE_PATTERN_RULES, PUZZLE_SHAPE_PER_ORB } from './battle-rules'
import type { PuzzleBattleEvent, PuzzleBattleStateV1 } from './battle-types'
import type { PuzzleMatch } from './board'
import { PUZZLE_LEADERS } from './catalogue'
import { PUZZLE_ELEMENTS, type PuzzleElement } from './types'
import { puzzleSafe } from './validation'

const beats: Record<PuzzleElement, PuzzleElement> = { fire: 'wood', wood: 'water', water: 'fire', light: 'dark', dark: 'light' }
export function puzzleElementMultiplier(attack: PuzzleElement, defense: PuzzleElement): number {
  if (beats[attack] === defense) return PUZZLE_MATCHUP.advantage
  return !['light', 'dark'].includes(attack) && !['light', 'dark'].includes(defense) && beats[defense] === attack
    ? PUZZLE_MATCHUP.disadvantage : PUZZLE_MATCHUP.neutral
}
export const puzzleShape = (orbs: number): number => 1 + PUZZLE_SHAPE_PER_ORB * (orbs - PUZZLE_MATCH_MIN)
export const puzzleCombo = (groups: number): number => 1 + PUZZLE_COMBO_PER_GROUP * Math.max(0, groups - 1)
export function puzzleFocus(state: PuzzleBattleStateV1, requested: string | null): string | null {
  if (requested && state.enemies.some(e => e.id === requested && e.hp > 0)) return requested
  return state.enemies.map((e, index) => ({ ...e, index })).filter(e => e.hp > 0)
    .sort((a, b) => a.countdown - b.countdown || a.index - b.index)[0]?.id ?? null
}
export function puzzleIncomingDamage(displayed: number, shield: number, guard: number): number {
  return puzzleSafe(Math.max(Math.ceil(displayed * PUZZLE_DAMAGE_FLOOR), Math.round(displayed * (1 - shield)) - guard), 'Enemy hit')
}
function patternMultiplier(state: PuzzleBattleStateV1, slot: number, group: PuzzleMatch): number {
  const id = state.input.entrants[slot]!.kit.patternId
  if (id === 'puzzle:four' && group.indices.length === PUZZLE_PATTERN_RULES.fourCount) return PUZZLE_PATTERN_RULES.multiplier
  if (id === 'puzzle:row' && group.indices.some(i => i % PUZZLE_BOARD_WIDTH === 0 &&
    Array.from({ length: PUZZLE_BOARD_WIDTH }, (_, c) => i + c).every(cell => group.indices.includes(cell)))) return PUZZLE_PATTERN_RULES.multiplier
  return 1
}
/** Mutates only the detached transition draft. All groups (including Hearts/cascades) count for combo. */
export function resolvePuzzlePlayerCombat(state: PuzzleBattleStateV1, groups: PuzzleMatch[], requested: string | null, events: PuzzleBattleEvent[]): void {
  const combo = puzzleCombo(groups.length), heartShape = groups.filter(g => g.orb === 'heart').reduce((n, g) => n + puzzleShape(g.indices.length), 0)
  if (heartShape > 0) {
    const attempted = puzzleSafe(Math.round(state.rcv * heartShape * combo), 'Heart heal'), hpBefore = state.hp
    state.hp += Math.min(attempted, state.maxHp - state.hp)
    events.push({ type: 'heal', attempted, amount: state.hp - hpBefore, hpBefore, hpAfter: state.hp })
  }
  let focus = puzzleFocus(state, requested)
  if (focus !== requested) events.push({ type: 'retarget', from: requested, to: focus })
  const leader = PUZZLE_LEADERS.find(l => l.id === state.input.leaderId)!
  const leaderAtk = leader.stat === 'atk' && groups.length >= leader.combos ? leader.multiplier : 1
  for (const element of PUZZLE_ELEMENTS) for (let slot = 0; slot < state.input.entrants.length; slot++) {
    const entrant = state.input.entrants[slot]!
    if (entrant.element !== element) continue
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const group = groups[groupIndex]!
      if (group.orb !== element) continue
      const next = puzzleFocus(state, focus)
      if (next !== focus) { events.push({ type: 'retarget', from: focus, to: next }); focus = next }
      const mass = group.indices.length >= PUZZLE_MASS_MIN
      for (let index = 0; index < state.enemies.length; index++) {
        const enemy = state.enemies[index]!, definition = state.input.enemies[index]!
        if (enemy.hp === 0 || (!mass && enemy.id !== focus)) continue
        const raw = puzzleSafe(Math.round(entrant.stats.atk * puzzleShape(group.indices.length) * combo * leaderAtk *
          patternMultiplier(state, slot, group) * puzzleElementMultiplier(element, enemy.element)), 'Player hit')
        // Defense first; strongest qualifying barrier second, never multiplicative guard+ward stacking.
        const reduction = Math.max(...[enemy.guard, enemy.ward].map(b => b && groups.length < b.comboThreshold ? b.reduction : 0))
        const amount = Math.max(1, Math.round(Math.max(1, raw - definition.defense) * (1 - reduction))), hpBefore = enemy.hp
        enemy.hp = Math.max(0, enemy.hp - amount)
        events.push({ type: 'hit', slot, element, group: groupIndex, enemyId: enemy.id, amount, mass, hpBefore, hpAfter: enemy.hp })
      }
    }
  }
}
