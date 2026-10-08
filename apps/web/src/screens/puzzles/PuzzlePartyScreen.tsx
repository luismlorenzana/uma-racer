// Atomic five-slot edits and explicit revision-checked transfer (docs/design/uma-puzzles.md §9).
import { PUZZLE_LEADERS, type PuzzleOutfitSaveV1, type PuzzlePresetSaveV1 } from '@racer/domain'
import { useState } from 'react'
import { useParams } from 'react-router'
import { openPuzzleParty, puzzlePartySummary, puzzlePicker, replacePuzzleSlot } from '../../game/puzzles/presentation'
import { PuzzleButton, PuzzleCard, PuzzleModal, PuzzleOutfitIcon, PuzzleSelect } from '../../ui/puzzles/components'
import { PuzzleElementMark } from '../../ui/puzzles/ElementMark'
import { PuzzleKitEditor, puzzleLeaderLabel } from '../../ui/puzzles/kit'
import { ChevronLeftIcon, ChevronRightIcon } from '../../ui/icons'
import { PuzzleFrame, usePuzzleAccount, usePuzzles } from './PuzzleContext'
interface Transfer { outfit: PuzzleOutfitSaveV1; source: PuzzlePresetSaveV1; destination: PuzzlePresetSaveV1; slot: number }
export function PuzzlePartyScreen() {
  const { partyId = '' } = useParams(), { root, content, host, command, busy, notice } = usePuzzles(), account = usePuzzleAccount()
  const [slotIndex, setSlotIndex] = useState(0), [picker, setPicker] = useState<'free' | 'transfer' | null>(null), [transfer, setTransfer] = useState<Transfer | null>(null)
  const party = account?.parties.find(p => p.partyId === partyId), open = account && party && openPuzzleParty(account, partyId)
  const slot = party?.slots[slotIndex], outfit = account?.outfits.find(o => o.outfitId === slot?.outfitId)
  const save = async (next: PuzzlePresetSaveV1) => command(`party:${partyId}:${next.revision}:${JSON.stringify(next)}`, id => host.saveParty(next, id))
  const startPicker = async () => {
    if (!party || open) return
    // Transfer needs a saved destination revision, not a fabricated revision-zero record.
    if (!party.revision && !await save(party)) return
    setPicker('free')
  }
  const summary = party && account && puzzlePartySummary(party, account)
  const candidates = party && account ? puzzlePicker(account, party, picker === 'transfer') : []
  const name = (id: string) => content.umas.byId.get(id)?.name ?? id
  return <PuzzleFrame title={party?.name ?? 'Party unavailable'} back={root}><div className="grid gap-3">
    {!party || !account || !summary ? <PuzzleCard>Unknown party preset. Return to your five parties.</PuzzleCard> : <>
      {open && <PuzzleCard><p className="text-xs">An open battle locks this party. Resume it from the Hub; setup cannot replace or reroll it.</p></PuzzleCard>}
      <label className="text-xs text-ink-on-dark-soft">Party name<input key={`${partyId}:${party.name}`} defaultValue={party.name} maxLength={80} disabled={busy || Boolean(open)} aria-label="Party name"
        className="mt-1 min-h-11 w-full rounded-sm border border-hairline-dark bg-stage-soft px-3 text-sm text-ink-on-dark" onBlur={e => { const value = e.currentTarget.value.trim(); if (value && value !== party.name) void save({ ...party, name: value }) }} /></label>
      <div className="grid grid-cols-5 gap-2">{party.slots.map((s, i) => <button key={i} aria-label={`Select slot ${i + 1}${i === 0 ? ', leader' : ''}${s ? `, ${name(s.outfitId)}` : ', empty'}`} aria-pressed={slotIndex === i} className={`min-h-11 rounded-md border-2 ${slotIndex === i ? 'border-accent' : 'border-transparent'}`} onClick={() => setSlotIndex(i)}>
        {s ? <PuzzleOutfitIcon id={s.outfitId} name={name(s.outfitId)} content={content} outfit={account.outfits.find(o => o.outfitId === s.outfitId)} leader={i === 0} /> : <span className="flex aspect-square items-center justify-center rounded-md border border-dashed border-hairline-dark text-xs">{i + 1}</span>}
      </button>)}</div>
      <PuzzleCard><h2 className="text-sm font-semibold">Slot {slotIndex + 1}{slotIndex === 0 ? ' · Leader' : ''}</h2>
        {slot && outfit ? <><p className="mt-1 text-sm">{name(slot.outfitId)}</p><div className="mt-2"><PuzzleKitEditor outfit={outfit} kit={slot.kit} disabled={busy || Boolean(open)} onChange={kit => { void save({ ...party, slots: party.slots.map((s, i) => i === slotIndex ? { ...slot, kit } : s) }) }} /></div>
          <div className="mt-3 flex gap-2"><PuzzleButton secondary aria-label="Move slot left" disabled={slotIndex === 0 || busy || Boolean(open)} onClick={() => {
            const slots = [...party.slots]; [slots[slotIndex - 1], slots[slotIndex]] = [slots[slotIndex]!, slots[slotIndex - 1]!]; void save({ ...party, slots }).then(ok => { if (ok) setSlotIndex(i => i - 1) })
          }}><ChevronLeftIcon size={20} /></PuzzleButton><PuzzleButton secondary aria-label="Move slot right" disabled={slotIndex === 4 || busy || Boolean(open)} onClick={() => {
            const slots = [...party.slots]; [slots[slotIndex + 1], slots[slotIndex]] = [slots[slotIndex]!, slots[slotIndex + 1]!]; void save({ ...party, slots }).then(ok => { if (ok) setSlotIndex(i => i + 1) })
          }}><ChevronRightIcon size={20} /></PuzzleButton><PuzzleButton secondary className="flex-1" disabled={busy || Boolean(open)} onClick={() => { void save(replacePuzzleSlot(party, slotIndex, null)) }}>Remove from party</PuzzleButton></div>
        </> : <><p className="my-2 text-xs text-ink-on-dark-soft">Choose an enrolled outfit. No silent moves from other parties.</p><PuzzleButton className="w-full" disabled={busy || Boolean(open)} onClick={() => { void startPicker() }}>Add Uma</PuzzleButton></>}
      </PuzzleCard>
      <PuzzleSelect label={`Slot 1 leader · ${summary.leader ? name(summary.leader) : 'empty'}`} value={party.leaderId} disabled={busy || Boolean(open)} options={PUZZLE_LEADERS.map(l => ({ value: l.id, label: puzzleLeaderLabel(l.id) }))} onChange={leaderId => { void save({ ...party, leaderId }) }} />
      <PuzzleCard><div className="flex gap-1">{summary.coverage.map(e => <PuzzleElementMark key={e} element={e} />)}<p className="ml-auto text-xs">{summary.members.length}/5 filled</p></div><dl className="mt-3 grid grid-cols-3 gap-3">{Object.entries(summary.totals).map(([key, value]) => <div key={key}><dt className="text-[10px] uppercase text-ink-on-dark-soft">{key === 'maxHp' ? 'Shared HP' : key}</dt><dd>{value}</dd></div>)}</dl>
        <p className="mt-3 text-xs text-ink-on-dark-soft">{summary.average === null ? 'No enrolled members assigned.' : `Average PL ${summary.average.toFixed(1)} · range ${summary.min}–${summary.max}`}</p><p className="mt-1 text-xs text-ink-on-dark-soft">Chapter previews warn when average PL is low; they do not prohibit adventurous parties.</p>
      </PuzzleCard>
    </>}
  </div>{picker && party && <PuzzleModal title={picker === 'free' ? 'Add enrolled Uma' : 'Move from another party'} onClose={() => { if (!busy) { setPicker(null); setTransfer(null) } }}>
    {notice && <p role="alert" className="mb-3 rounded-sm border border-accent p-2 text-xs">{notice}</p>}
    {transfer ? <div className="grid gap-3"><p>Move <strong>{name(transfer.outfit.outfitId)}</strong> from <strong>{transfer.source.name}</strong> to <strong>{transfer.destination.name}</strong>, slot {transfer.slot + 1}?</p><p className="text-xs text-ink-on-dark-soft">The source slot becomes empty. Both parties keep their chapter checkpoints. An open battle or changed revision on either party blocks this move.</p>
      <PuzzleButton disabled={busy} onClick={() => { void command(`transfer:${transfer.outfit.outfitId}:${transfer.source.revision}:${transfer.destination.revision}:${transfer.slot}`, id => host.transfer({ outfitId: transfer.outfit.outfitId, fromPartyId: transfer.source.partyId, toPartyId: transfer.destination.partyId,
        slot: transfer.slot, fromRevision: transfer.source.revision, toRevision: transfer.destination.revision }, id)).then(ok => { if (ok) { setPicker(null); setTransfer(null) } }) }}>Confirm transfer</PuzzleButton><PuzzleButton secondary disabled={busy} onClick={() => setTransfer(null)}>Cancel transfer</PuzzleButton>
    </div> : <><p className="mb-3 text-xs text-ink-on-dark-soft">{picker === 'free' ? 'Only unassigned outfits are shown.' : 'Both source and destination must be idle. Pick an outfit to review the move.'}</p>
      <div className="grid grid-cols-5 gap-2">{candidates.map(c => <button key={c.outfit.outfitId} disabled={busy || c.blocked} className="min-h-11 rounded-sm disabled:opacity-40" aria-label={`Choose ${name(c.outfit.outfitId)}${c.source ? ` from ${c.source.name}${c.blocked ? ', open battle blocks transfer' : ''}` : ''}`} onClick={() => {
        if (c.source) setTransfer({ outfit: c.outfit, source: structuredClone(c.source), destination: structuredClone(party), slot: slotIndex })
        else void save(replacePuzzleSlot(party, slotIndex, c.outfit)).then(ok => { if (ok) setPicker(null) })
      }}><PuzzleOutfitIcon id={c.outfit.outfitId} name={name(c.outfit.outfitId)} content={content} outfit={c.outfit} /><p className="mt-1 truncate text-[9px]">{name(c.outfit.outfitId)}</p>{c.source && <p className="truncate text-[9px] text-ink-on-dark-soft">{c.source.name}</p>}</button>)}</div>
      {!candidates.length && <p className="py-3 text-xs">No outfits available here. Enroll more from the Roster or explicitly move an idle party member.</p>}
      <PuzzleButton secondary className="mt-4 w-full" disabled={busy} onClick={() => setPicker(picker === 'free' ? 'transfer' : 'free')}>{picker === 'free' ? 'Move from another party' : 'Unassigned outfits'}</PuzzleButton>
    </>}
  </PuzzleModal>}</PuzzleFrame>
}
