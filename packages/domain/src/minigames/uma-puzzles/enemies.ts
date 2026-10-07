// Finite intent reducer: warning, countdown, formation-order execution (docs/design/uma-puzzles.md §5).
import type { PuzzleBattleEvent, PuzzleBattleStateV1, PuzzleIntentView } from './battle-types'
import { convertPuzzleBoard } from './board'
import { puzzleIncomingDamage } from './combat'
import { puzzleSafe } from './validation'

export function puzzleEnemyIntentViews(state: PuzzleBattleStateV1): PuzzleIntentView[] {
  return state.enemies.flatMap((e, i) => {
    if (e.hp === 0) return []
    const def = state.input.enemies[i]!, intent = def.intents[e.intentIndex]!, damageMultiplier = e.phaseFired ? def.phase!.damageMultiplier : 1
    const displayedDamage = intent.type === 'attack' ? puzzleSafe(Math.round(intent.damage * damageMultiplier), 'Displayed attack') : null
    return [{ enemyId: e.id, countdown: e.countdown, intent: { ...intent }, ragePending: !!def.phase && !e.phaseFired,
      damageMultiplier, displayedDamage, mitigatedDamage: displayedDamage === null ? null : puzzleIncomingDamage(displayedDamage, state.shield, state.guard),
      delayImmune: def.delayImmune, phase: def.phase ? { ...def.phase } : null }]
  })
}
export function resolvePuzzleEnemies(state: PuzzleBattleStateV1, events: PuzzleBattleEvent[]): void {
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i]!, def = state.input.enemies[i]!, phase = def.phase
    if (e.hp > 0 && phase && !e.phaseFired && BigInt(e.hp) * 100n < BigInt(def.maxHp) * BigInt(phase.atHpPercent)) {
      e.phaseFired = true; e.element = phase.element ?? def.element
      // The current tick is not part of the warned interval. Preserve a pending End delay.
      e.countdown = phase.countdown + 1 + Number(e.delayed)
      events.push({ type: 'phase', enemyId: e.id, element: e.element, countdown: e.countdown - 1, damageMultiplier: phase.damageMultiplier })
    }
  }
  for (const e of state.enemies) if (e.hp > 0) e.countdown = Math.max(0, e.countdown - 1)
  let damagingPhase = false
  for (let i = 0; i < state.enemies.length && state.hp > 0; i++) {
    const e = state.enemies[i]!, def = state.input.enemies[i]!
    if (e.hp === 0 || e.countdown > 0) continue
    const intent = def.intents[e.intentIndex]!
    let amount = 0, targetId: string | null = null, hpBefore = state.hp, hpAfter = state.hp
    if (intent.type === 'attack') {
      damagingPhase = true
      const displayed = puzzleSafe(Math.round(intent.damage * (e.phaseFired ? def.phase!.damageMultiplier : 1)), 'Displayed attack')
      amount = puzzleIncomingDamage(displayed, state.shield, state.guard)
      state.hp = Math.max(0, state.hp - amount); hpAfter = state.hp
    } else if (intent.type === 'heal') {
      const allies = state.enemies.map((ally, index) => ({ ally, index })).filter(a => a.index !== i && a.ally.hp > 0)
        .sort((a, b) => {
          const difference = BigInt(a.ally.hp) * BigInt(state.input.enemies[b.index]!.maxHp) -
            BigInt(b.ally.hp) * BigInt(state.input.enemies[a.index]!.maxHp)
          return difference < 0n ? -1 : difference > 0n ? 1 : a.index - b.index
        })
      const target = allies[0]
      if (target) {
        targetId = target.ally.id; hpBefore = target.ally.hp
        amount = Math.min(intent.amount, state.input.enemies[target.index]!.maxHp - target.ally.hp)
        target.ally.hp += amount; hpAfter = target.ally.hp
      }
    } else if (intent.type === 'guard' || intent.type === 'ward') {
      const value = { reduction: intent.reduction, comboThreshold: intent.comboThreshold, expiresAfterTurn: state.turn + intent.durationDrags }
      e[intent.type] = value; events.push({ type: 'barrier', enemyId: e.id, barrier: intent.type, value: { ...value } })
    } else {
      const before = [...state.board], converted = convertPuzzleBoard(before, before.flatMap((orb, index) => orb === intent.from ? [index] : []),
        intent.to, intent.count, state.rng.enemyConversion)
      state.board = converted.board; state.rng.enemyConversion = converted.state
      events.push({ type: 'conversion', actor: 'enemy', actorId: e.id, indices: converted.indices, before, after: [...state.board] })
    }
    events.push({ type: 'enemy-intent', enemyId: e.id, intent: { ...intent }, targetId, amount, hpBefore, hpAfter })
    e.delayed = false; e.intentIndex = (e.intentIndex + 1) % def.intents.length
    e.countdown = e.phaseFired ? def.phase!.countdown : def.intents[e.intentIndex]!.countdown
  }
  if (damagingPhase && state.shield > 0) { events.push({ type: 'shield', reduction: state.shield, consumed: true }); state.shield = 0 }
}
