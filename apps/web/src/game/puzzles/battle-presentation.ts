// Receipt/replay projections, no UI-authored rewards (Uma Puzzles §9).
import { puzzleKitChoices, puzzleStats, type PuzzleBattleTransition, type PuzzleResultSaveV1 } from '@racer/domain'
export interface PuzzleCombatSummary { combos: number; bestCombos: number; damage: number; healed: number; massHits: number }
export function puzzleCombatSummary(steps: readonly PuzzleBattleTransition[]): PuzzleCombatSummary {
  const counts = steps.map(s => s.events.reduce((n, e) => n + (e.type === 'cascade' ? e.cascade.groups.length : 0), 0))
  const events = steps.flatMap(s => s.events)
  return { combos: counts.reduce((a, b) => a + b, 0), bestCombos: Math.max(0, ...counts),
    damage: events.reduce((n, e) => n + (e.type === 'hit' ? e.amount : 0), 0),
    healed: events.reduce((n, e) => n + (e.type === 'heal' ? e.amount : 0), 0), massHits: events.filter(e => e.type === 'hit' && e.mass).length }
}
export function puzzleTurnAnnouncement(step: PuzzleBattleTransition) {
  const s = puzzleCombatSummary([step])
  return `Turn ${step.state.turn}: ${s.combos} combos, ${s.damage} damage, ${s.healed} HP restored.${s.massHits ? ' Mass attack.' : ''} ${step.state.hp} HP remaining.`
}
export function puzzleResultEntrants(receipt: PuzzleResultSaveV1) {
  return receipt.input.entrants.map(e => {
    const exp = receipt.exp.find(r => r.outfitId === e.outfitId)
    const before = exp?.before ?? { level: e.level, exp: 0 }, after = exp?.after ?? before
    const a = puzzleStats(e.source, before.level), b = puzzleStats(e.source, after.level)
    const old = puzzleKitChoices(e.source, before.level), next = puzzleKitChoices(e.source, after.level)
    return { entrant: e, amount: exp?.amount ?? 0, before, after,
      deltas: Object.fromEntries(Object.keys(a).map(k => [k, b[k as keyof typeof b] - a[k as keyof typeof a]])),
      unlocked: [...next.actives.filter(id => !old.actives.includes(id)), ...next.patterns.filter(id => !old.patterns.includes(id)),
        ...next.leaders.filter(id => !old.leaders.includes(id))] }
  })
}
