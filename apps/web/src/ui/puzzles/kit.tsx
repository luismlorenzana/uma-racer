// Finite choices read from the domain catalogue, never RPG skill trees (docs/design/uma-puzzles.md §5).
import { PUZZLE_ACTIVES, PUZZLE_LEADERS, PUZZLE_PATTERNS, puzzleKitChoices, type PuzzleKit, type PuzzleOutfitSaveV1 } from '@racer/domain'
import { PuzzleOptions, PUZZLE_STYLE_LABEL } from './components'
export function puzzleActiveLabel(id: string) {
  const a = PUZZLE_ACTIVES.find(a => a.id === id)
  if (!a) return 'Unavailable active'
  const effect = a.effect === 'convert' ? `convert ${a.count} orbs` : a.effect === 'shield' ? `${Math.round(a.reduction * 100)}% shield` : `delay ${a.steps} drag`
  return `${PUZZLE_STYLE_LABEL[a.style]} · ${effect} · ${a.charge} charge`
}
export function puzzleLeaderLabel(id: string) {
  const leader = PUZZLE_LEADERS.find(l => l.id === id)!
  return leader.stat === 'atk' ? `${leader.combos}+ combos · ATK ×${leader.multiplier}` : `${leader.stat.toUpperCase()} ×${leader.multiplier}`
}
export function puzzlePatternLabel(id: string | null) {
  if (!id) return 'No pattern'
  const p = PUZZLE_PATTERNS.find(p => p.id === id)!
  return `${p.id === 'puzzle:four' ? 'Four-orb' : 'Row'} · ×${p.multiplier} · PL ${p.level}+`
}
export function PuzzleKitEditor({ outfit, kit, onChange, disabled }: { outfit: PuzzleOutfitSaveV1; kit: PuzzleKit; onChange(kit: PuzzleKit): void; disabled?: boolean }) {
  const choices = puzzleKitChoices(outfit.enrollment.source, outfit.enrollment.level)
  return <div className="grid gap-2"><PuzzleOptions label="Active" value={kit.activeId} disabled={disabled} options={choices.actives.map(value => ({ value, label: puzzleActiveLabel(value) }))}
    onChange={activeId => onChange({ ...kit, activeId })} /><PuzzleOptions label="Pattern" value={kit.patternId ?? ''} disabled={disabled}
      options={[{ value: '', label: 'No pattern' }, ...choices.patterns.map(value => ({ value, label: puzzlePatternLabel(value) }))]}
      onChange={patternId => onChange({ ...kit, patternId: patternId === '' ? null : patternId as NonNullable<PuzzleKit['patternId']> })} /></div>
}
