// Read-only setup guide; T113 adds the illustrated combat/practice pages (docs/design/uma-puzzles.md §9).
import { useMemo } from 'react'
import { PagedGuide } from '../../ui/PagedGuide'
import { createGuideMemory } from '../../ui/minigames/guide-memory'
import { RpgModalFocus } from '../../ui/rpg/RpgModalFocus'
import { PUZZLE_ELEMENTS, PUZZLE_MATCHUP } from '@racer/domain'
import { PuzzleElementMark } from '../../ui/puzzles/ElementMark'
export function PuzzleWeaknessLegend() {
  return <div className="rounded-sm border border-hairline-dark p-3 text-xs text-ink-on-dark-soft"><h3 className="mb-2 font-semibold text-ink-on-dark">Element advantage</h3>
    <p>Fire beats Wood. Wood beats Water. Water beats Fire. Light and Dark beat each other; neutral against the other three.</p>
    <p className="mt-1">Advantage ×{PUZZLE_MATCHUP.advantage}; disadvantage ×{PUZZLE_MATCHUP.disadvantage}. Glyphs identify colours as well as hue.</p>
    <div className="mt-2 flex justify-around">{PUZZLE_ELEMENTS.map(e => <span key={e} className="grid justify-items-center gap-1"><PuzzleElementMark element={e} /><span className="capitalize">{e}</span></span>)}</div>
  </div>
}
export function PuzzleGuide({ open, onClose, isolated }: { open: boolean; onClose(): void; isolated: boolean }) {
  const memory = useMemo(() => createGuideMemory(isolated ? 'puzzle-proof-guide-v1' : 'uma-racer:puzzle-guide-v1'), [isolated])
  const close = () => { memory.remember(); onClose() }
  if (!open) return null
  return <RpgModalFocus onClose={close}><PagedGuide open pages={[
    { id: 'roster', title: 'Your global Puzzle roster', body: <><p>Enroll owned outfits using their original A running styles. Puzzle Level and EXP are independent of racing, Farming and Uma RPG.</p><p>Choose an eligible element yourself. You may correct it until first battle entry; even a loss or abandonment locks it.</p><p>Five outfits form a party. Slot 1 is the leader. No rainbow or running-style quota is required.</p></> },
    { id: 'chapters', title: 'Choose your path', body: <><p>Every scenario is a separate 28-node chapter for each party. Clear either branch to advance, then all three guardians before choosing a colour Champion.</p><p>One Champion completes a chapter. Winning every node clears the full map. Replay reached nodes for more EXP and materials.</p><p>Preview exact enemies and drops first. The Dark Champion requires an explicit Pace or Late ticket choice.</p><PuzzleWeaknessLegend /></> },
    { id: 'progress', title: 'Preparation before combat', body: <><p>Parties remember their chapter and any open encounter. Moving an outfit between parties requires confirmation; neither party may have an open battle.</p><p>Rewards repay any matching negative constellation balance first. The preview separates gross drops, repayment and inventory gains.</p><p>Battle entry, illustrated combat practice and spending materials arrive in subsequent tasks. These setup screens cannot reserve a live fight yet.</p></> },
  ]} startAt="roster" titleId="puzzle-guide-heading" finishLabel="Got it" onClose={close} /></RpgModalFocus>
}
