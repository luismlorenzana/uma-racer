// One illustrated, contextual, read-only guide (Uma Puzzles §9). Numbers come from domain.
import { useMemo } from 'react'
import { Link } from 'react-router'
import { PUZZLE_ELEMENTS, PUZZLE_MATCHUP, PUZZLE_BOARD_WIDTH, PUZZLE_BOARD_HEIGHT, PUZZLE_PARTY_SIZE,
  PUZZLE_MOVEMENT_MS, PUZZLE_MATCH_MIN, PUZZLE_MASS_MIN, PUZZLE_TURN_LIMIT, PUZZLE_MAP_NODES,
  PUZZLE_DROP_COUNTS, PUZZLE_EXCHANGE_RATIO, PUZZLE_CL_MAX, PUZZLE_ACTIVES, PUZZLE_PATTERNS } from '@racer/domain'
import { PagedGuide } from '../../ui/PagedGuide'
import { createGuideMemory } from '../../ui/minigames/guide-memory'
import { RpgModalFocus } from '../../ui/rpg/RpgModalFocus'
import { PuzzleElementMark } from '../../ui/puzzles/ElementMark'
import { puzzleActiveLabel, puzzlePatternLabel } from '../../ui/puzzles/kit'
import { HeartIcon, StableIcon, TicketIcon } from '../../ui/icons'
export const puzzleGuideMemory = (isolated: boolean) => createGuideMemory(isolated ? 'puzzle-proof-guide-v2' : 'uma-racer:puzzle-guide-v2')
export type PuzzleGuidePage = 'levels' | 'drag' | 'combos' | 'elements' | 'hp' | 'actives' | 'map' | 'materials'
export function PuzzleWeaknessLegend() {
  return <div className="rounded-sm border border-hairline-dark p-3 text-xs text-ink-on-dark-soft"><h3 className="mb-2 font-semibold text-ink-on-dark">Element advantage</h3>
    <div className="flex items-center justify-center gap-2 py-3" aria-label="Fire beats Wood, Wood beats Water, Water beats Fire">{(['fire', 'wood', 'water', 'fire'] as const).map((e, i) => <span key={i} className="flex items-center gap-2"><PuzzleElementMark element={e} size={28} />{i < 3 && <span>→</span>}</span>)}</div>
    <p>Fire beats Wood. Wood beats Water. Water beats Fire. Light and Dark beat each other; neutral against the other three.</p>
    <p className="mt-1">Advantage ×{PUZZLE_MATCHUP.advantage}; disadvantage ×{PUZZLE_MATCHUP.disadvantage}. Glyphs identify colours as well as hue.</p>
    <div className="mt-2 flex justify-around">{PUZZLE_ELEMENTS.map(e => <span key={e} className="grid justify-items-center gap-1"><PuzzleElementMark element={e} /><span className="capitalize">{e}</span></span>)}</div>
  </div>
}
function GuidePicture({ kind }: { kind: PuzzleGuidePage }) {
  if (kind === 'hp') return <div className="grid gap-3 rounded-md border border-hairline-dark bg-stage-soft p-5"><div className="flex items-center gap-3 text-puzzle-heart"><HeartIcon size={32} /><span>Heart match → Party HP</span></div><div className="h-3 rounded-full bg-stage"><div className="h-full w-3/4 rounded-full bg-puzzle-heart" /></div><p className="text-xs text-ink-on-dark-soft">Heal before the next countdown reaches zero.</p></div>
  if (kind === 'actives' || kind === 'levels') return <div className="rounded-md border border-hairline-dark bg-stage-soft p-4"><div className="grid grid-cols-5 gap-2">{Array.from({ length: PUZZLE_PARTY_SIZE }, (_, i) => <div key={i} className="grid justify-items-center gap-2 rounded-sm border border-accent p-2"><StableIcon size={24} /><PuzzleElementMark element={PUZZLE_ELEMENTS[i]!} /><span className="text-[10px]">{kind === 'actives' ? 'Ready' : 'PL + EXP'}</span></div>)}</div><p className="mt-3 text-center text-xs text-ink-on-dark-soft">{kind === 'actives' ? 'Preview first · Confirm to cast · Slot 1 leads' : 'Five outfits · Each keeps its own global progress'}</p></div>
  if (kind === 'materials') return <div className="flex items-center justify-around gap-2 rounded-md border border-hairline-dark bg-stage-soft p-5 text-xs"><span className="grid justify-items-center gap-2 text-accent"><TicketIcon size={32} />Gross</span><span>→</span><span className="grid gap-2 text-center"><span className="rounded-full border border-accent px-3 py-2">Debt</span>Repaid first</span><span>→</span><span className="grid justify-items-center gap-2 text-accent"><TicketIcon size={32} />Items</span></div>
  return <div className="rounded-md border border-hairline-dark bg-stage-soft p-4">
    {kind === 'drag' || kind === 'combos' ? <div className="relative mx-auto grid max-w-xs grid-cols-6 gap-1" aria-label="Illustrated elemental board">
      {Array.from({ length: PUZZLE_BOARD_WIDTH * PUZZLE_BOARD_HEIGHT }, (_, i) => <span key={i} className={`grid aspect-square place-items-center rounded-full border ${kind === 'combos' && i < PUZZLE_MASS_MIN ? 'border-accent bg-accent/15' : 'border-hairline-dark'}`}><PuzzleElementMark element={kind === 'combos' && i < PUZZLE_MASS_MIN ? 'fire' : PUZZLE_ELEMENTS[i % 5]!} /></span>)}
      {kind === 'drag' && <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 300 250"><path d="M25 225 75 175 125 125 175 125 225 75" fill="none" stroke="var(--color-accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray="9 5" /><circle cx="225" cy="75" r="22" fill="none" stroke="var(--color-accent)" strokeWidth="3" /></svg>}
    </div> : <svg role="img" aria-label={`${kind} illustration`} viewBox="0 0 320 125" className="mx-auto h-32 w-full">
      <path d="M30 90 100 40 170 90 250 30" fill="none" stroke="var(--color-accent)" strokeWidth="3" />
      {[30, 100, 170, 250].map((x, i) => <g key={x} transform={`translate(${x} ${i % 2 ? 35 : 85})`}><circle r="19" fill="var(--color-stage)" stroke="var(--color-accent)" strokeWidth="2" /><path d="m-7 0 5 5 10-11" fill="none" stroke="var(--color-ink-on-dark)" strokeWidth="2" /></g>)}
    </svg>}
  </div>
}
export function puzzleGuidePages(practiceTo: string) {
  return [
    { id: 'levels' as const, title: 'A global Puzzle roster', body: <><GuidePicture kind="levels" /><p>Puzzle Level and EXP belong to each outfit, independently of racing, Farming and Uma RPG. Levels keep growing; there is no lifetime level cap.</p><p>Enroll an owned outfit with an original A running style, then choose an eligible element. First battle entry locks that colour, even if you lose or abandon.</p><p>Fill all {PUZZLE_PARTY_SIZE} slots. Composition is your choice; no colour or running-style quota.</p></> },
{ id: 'drag' as const, title: 'One orb, one flowing path', body: <><GuidePicture kind="drag" /><p>The board is {PUZZLE_BOARD_WIDTH}×{PUZZLE_BOARD_HEIGHT}. Hold one orb and drag through neighbouring cells, including diagonals and revisits.</p><p>Your {PUZZLE_MOVEMENT_MS / 1000}-second clock starts on the first swap, not while holding still. Release or time expiry resolves one turn. No swap spends no turn.</p><p>Opening this guide, leaving the app or resizing cancels an unsaved drag. Each fight allows {PUZZLE_TURN_LIMIT} drags.</p><Link reloadDocument className="flex min-h-11 items-center justify-center rounded-sm bg-accent text-ink" to={practiceTo}>Try isolated touch practice</Link><p className="text-xs text-ink-on-dark-soft">Pointer gameplay, not keyboard-assisted dragging. Practice has no account, EXP, Items or save writes.</p></> },
    { id: 'combos' as const, title: 'Combos, cascades and mass attacks', body: <><GuidePicture kind="combos" /><p>Lines of {PUZZLE_MATCH_MIN}+ matching orbs clear. Falling orbs can form more matches: every group adds a combo.</p><p>A connected group of {PUZZLE_MASS_MIN}+ elemental orbs attacks every living enemy. Heart groups heal instead of attacking.</p><p>Resolution is replayed from the saved engine events. Animation speed never changes a battle.</p>{PUZZLE_PATTERNS.map(p => <p key={p.id}>{puzzlePatternLabel(p.id)} becomes an equip choice at PL {p.level}.</p>)}</> },
    { id: 'elements' as const, title: 'Read the elemental matchup', body: <><PuzzleWeaknessLegend /><p>Match your entrants’ elements for attacks. One Wood colour only; Hearts use pink. Colour is always paired with a glyph.</p><p>Chibi portraits are visual identity only. Plain orbs give the exact same board and results.</p></> },
    { id: 'hp' as const, title: 'Hearts and enemy intent', body: <><GuidePicture kind="hp" /><p>Shared party HP reaches zero: the fight ends. Hearts restore HP using the party’s recovery, capped at maximum HP.</p><p>Tap a living enemy to focus it or inspect its intent. The default target is the earliest countdown, then formation order. Each completed drag ticks the enemy countdown.</p><p>The next-hit value already includes your guard and shield. Read combo wards, delay immunity and the warned rage phase before moving.</p></> },
    { id: 'actives' as const, title: 'Five actives, one leader', body: <><GuidePicture kind="actives" /><p>Drags charge equipped actives. Tap a portrait for its preview, then confirm a ready skill. Only slot 1 contributes the equipped party leader.</p>{PUZZLE_ACTIVES.map(a => <p key={a.id}>{puzzleActiveLabel(a.id)}</p>)}<p>Conversion never consumes Hearts. A shield covers the next damaging enemy phase; delay immunity can prevent a cast without consuming charge.</p></> },
    { id: 'map' as const, title: 'Choose a route, repeat for loot', body: <><GuidePicture kind="map" /><p>Each party has its own {PUZZLE_MAP_NODES}-node chapter per scenario. Clear either branch at each row, then all three guardians to reach the colour Champions.</p><p>One Champion completes the chapter; all nodes completes the map. Reached nodes remain replayable. Ordinary/Guardian/Champion wins drop {PUZZLE_DROP_COUNTS.ordinary}/{PUZZLE_DROP_COUNTS.guardian}/{PUZZLE_DROP_COUNTS.champion} tickets respectively.</p><p>Entry and retries are free. Loss or abandonment gives no new EXP or materials, without removing previous progress.</p></> },
    { id: 'materials' as const, title: 'From rewards to Constellation Level', body: <><GuidePicture kind="materials" /><p>Material tickets belong to a scenario and running-style family. The Dark Champion asks you to choose Pace or Late before entry.</p><p>Matching negative balances are repaid first. Results show gross drops → repaid → Items. A pending receipt may be corrected by sync; never count the animation as a grant.</p><p>Unlocked adjacent-scenario exchange is {PUZZLE_EXCHANGE_RATIO}:1, within the same style. Material spending raises the chosen outfit’s scenario Constellation Level, up to CL {PUZZLE_CL_MAX}; it never spends automatically. Open Items for stocks, repayment balances and eligible recipients; Exchange previews any irreversible repayment before confirmation.</p><p>Preparation preserves earned levels and all four builds. Legacy Universal CL Tickets keep old stock plus one account-wide conversion; no new universals are minted afterward. Interrupted preparation retries its receipts: never clear app data.</p></> },
  ]
}
export function PuzzleGuide({ open, onClose, isolated, startAt = 'levels', practiceTo = '/dev/puzzles-practice' }: {
  open: boolean; onClose(): void; isolated: boolean; startAt?: PuzzleGuidePage; practiceTo?: string
}) {
  const memory = useMemo(() => puzzleGuideMemory(isolated), [isolated])
  const close = () => { memory.remember(); onClose() }
  if (!open) return null
  return <RpgModalFocus onClose={close}><PagedGuide open pages={puzzleGuidePages(practiceTo)} startAt={startAt} titleId="puzzle-guide-heading" finishLabel="Ready to play" onClose={close} /></RpgModalFocus>
}
