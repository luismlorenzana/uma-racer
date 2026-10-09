// Revision-checked five-slot edits, free-only assignment (docs/design/uma-puzzles.md §9, D293).
import { PUZZLE_LEADERS, type PuzzlePresetSaveV1 } from '@racer/domain'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { openPuzzleParty, puzzlePartySummary, puzzlePartyCandidates, replacePuzzleSlot } from '../../game/puzzles/presentation'
import { PuzzleButton, PuzzleCard, PuzzleModal, PuzzleOutfitIcon, PuzzleOptions } from '../../ui/puzzles/components'
import { PuzzleElementMark } from '../../ui/puzzles/ElementMark'
import { PuzzleKitEditor, puzzleLeaderLabel } from '../../ui/puzzles/kit'
import { ChevronLeftIcon, ChevronRightIcon } from '../../ui/icons'
import { PuzzleFrame, usePuzzleAccount, usePuzzles } from './PuzzleContext'
export function PuzzlePartyScreen() {
  const { partyId = '' } = useParams(), { root, content, host, command, busy, notice, ownedIds } = usePuzzles(), account = usePuzzleAccount()
  // Capture the revision when opening the sheet; a concurrent edit must reject, not replace a different member.
  const [picker, setPicker] = useState<{ party: PuzzlePresetSaveV1; slot: number } | null>(null)
  const party = account?.parties.find(p => p.partyId === partyId), open = account && party && openPuzzleParty(account, partyId)
  const save = async (next: PuzzlePresetSaveV1) => command(`party:${partyId}:${next.revision}:${JSON.stringify(next)}`, id => host.saveParty(next, id))
  const name = (id: string) => content.umas.byId.get(id)?.name ?? id
  const summary = party && account && puzzlePartySummary(party, account)
  const candidates = account ? puzzlePartyCandidates(account, name, ownedIds) : []
  const disabled = busy || Boolean(open)
  const move = (index: number, delta: number) => {
    if (!party || disabled) return
    const slots = [...party.slots]; [slots[index], slots[index + delta]] = [slots[index + delta]!, slots[index]!]
    void save({ ...party, slots })
  }
  return <PuzzleFrame title={party?.name ?? 'Party unavailable'} back={root}><div className="grid gap-3">
    {!party || !account || !summary ? <PuzzleCard>Unknown party preset. Return to your ten parties.</PuzzleCard> : <>
      {open && <PuzzleCard><p className="text-xs">An open battle locks this party. Resume it from the Hub; setup cannot replace or reroll it.</p></PuzzleCard>}
      <label className="text-xs text-ink-on-dark-soft">Party name<input key={`${partyId}:${party.name}`} defaultValue={party.name} maxLength={80} disabled={disabled} aria-label="Party name"
        className="mt-1 min-h-11 w-full rounded-sm border border-hairline-dark bg-stage-soft px-3 text-sm text-ink-on-dark" onBlur={e => { const value = e.currentTarget.value.trim(); if (value && value !== party.name) void save({ ...party, name: value }) }} /></label>
      {party.slots.map((slot, index) => {
        const outfit = account.outfits.find(o => o.outfitId === slot?.outfitId)
        const profile = slot ? `${root}/roster/${encodeURIComponent(slot.outfitId)}?party=${partyId}` : ''
        return <PuzzleCard key={index}><section aria-label={`Slot ${index + 1}${index === 0 ? ' · Leader' : ''}`}>
          <h2 className="mb-2 text-xs text-ink-on-dark-soft">Slot {index + 1}{index === 0 ? ' · Leader' : ''}</h2>
          {slot && outfit ? <>
            <div className="flex items-center gap-3"><Link to={profile} className="w-14 shrink-0" aria-label={`Profile: ${name(slot.outfitId)}`}><PuzzleOutfitIcon id={slot.outfitId} name={name(slot.outfitId)} content={content} outfit={outfit} leader={index === 0} /></Link>
              <Link to={profile} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center"><span className="flex items-center gap-1 text-sm"><span className="truncate">{name(slot.outfitId)}</span><ChevronRightIcon size={16} /></span>
                <span className="text-xs capitalize text-ink-on-dark-soft">PL {outfit.enrollment.level} · {outfit.enrollment.element}</span></Link></div>
            <div className="my-2 flex gap-2"><PuzzleButton secondary className="flex-1" disabled={disabled} onClick={() => setPicker({ party: structuredClone(party), slot: index })}>Swap</PuzzleButton>
              <PuzzleButton secondary className="flex-1" disabled={disabled} onClick={() => { void save(replacePuzzleSlot(party, index, null)) }}>Remove</PuzzleButton>
              <PuzzleButton secondary aria-label={`Move slot ${index + 1} left`} disabled={disabled || index === 0} onClick={() => move(index, -1)}><ChevronLeftIcon size={20} /></PuzzleButton>
              <PuzzleButton secondary aria-label={`Move slot ${index + 1} right`} disabled={disabled || index === 4} onClick={() => move(index, 1)}><ChevronRightIcon size={20} /></PuzzleButton></div>
            <PuzzleKitEditor outfit={outfit} kit={slot.kit} disabled={disabled} onChange={kit => { void save({ ...party, slots: party.slots.map((s, i) => i === index ? { ...slot, kit } : s) }) }} />
          </> : <PuzzleButton className="w-full" disabled={disabled} onClick={() => setPicker({ party: structuredClone(party), slot: index })}>Add Uma</PuzzleButton>}
        </section></PuzzleCard>
      })}
      <PuzzleOptions label={`Slot 1 leader · ${summary.leader ? name(summary.leader) : 'empty'}`} value={party.leaderId} disabled={disabled} options={PUZZLE_LEADERS.map(l => ({ value: l.id, label: puzzleLeaderLabel(l.id) }))} onChange={leaderId => { void save({ ...party, leaderId }) }} />
      <PuzzleCard><div className="flex gap-1">{summary.coverage.map(e => <PuzzleElementMark key={e} element={e} />)}<p className="ml-auto text-xs">{summary.members.length}/5 filled</p></div><dl className="mt-3 grid grid-cols-3 gap-3">{Object.entries(summary.totals).map(([key, value]) => <div key={key}><dt className="text-[10px] uppercase text-ink-on-dark-soft">{key === 'maxHp' ? 'Shared HP' : key}</dt><dd>{value}</dd></div>)}</dl>
        <p className="mt-3 text-xs text-ink-on-dark-soft">{summary.average === null ? 'No enrolled members assigned.' : `Average PL ${summary.average.toFixed(1)} · range ${summary.min}–${summary.max}`}</p><p className="mt-1 text-xs text-ink-on-dark-soft">Chapter previews warn when average PL is low; they do not prohibit adventurous parties.</p>
      </PuzzleCard>
    </>}
  </div>{picker && <PuzzleModal title={picker.party.slots[picker.slot] ? 'Swap enrolled Uma' : 'Add enrolled Uma'} onClose={() => { if (!busy) setPicker(null) }}>
    {notice && <p role="alert" className="mb-3 rounded-sm border border-accent p-2 text-xs">{notice}</p>}
    <p className="mb-3 text-xs text-ink-on-dark-soft">Only enrolled Umas that no party holds, highest Puzzle Level first.</p>
    <div className="grid grid-cols-5 gap-2">{candidates.map(outfit => <button key={outfit.outfitId} disabled={disabled} className="min-h-11 rounded-sm disabled:opacity-40" aria-label={`Choose ${name(outfit.outfitId)}, Puzzle Level ${outfit.enrollment.level}`} onClick={() => {
      void save(replacePuzzleSlot(picker.party, picker.slot, outfit)).then(ok => { if (ok) setPicker(null) })
    }}><PuzzleOutfitIcon id={outfit.outfitId} name={name(outfit.outfitId)} content={content} outfit={outfit} /><p className="mt-1 truncate text-[10px]">{name(outfit.outfitId)}</p><p className="text-[10px] text-ink-on-dark-soft">PL {outfit.enrollment.level}</p></button>)}</div>
    {!candidates.length && <><p className="py-3 text-xs">Every enrolled Uma is already in a party. Enroll more in the Roster, or remove one from another party first.</p>
      <Link to={`${root}/roster`} className="flex min-h-11 items-center justify-center rounded-sm bg-accent text-sm font-semibold text-ink">Open Roster</Link></>}
  </PuzzleModal>}</PuzzleFrame>
}
