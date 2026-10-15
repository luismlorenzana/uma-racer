// The job sheet's Uma rows (docs/rework/07-farm.md §3, §5, §10): Farm Level, the highest grade she can work, her tier,
// her aptitude line ("Sprint A · Farm EXP ×1.6") and what she is doing. A session greys her with its end; her running
// job here offers Add to queue; one elsewhere, Recall and start here. T138 owns the one Uma picker (`ui/UmaPicker`,
// D181's sorts and filters); until it lands this sheet keeps its own short list, in 07 §10's order, which the picker
// can replace with these rows as its `describe` and `disabledReason`.
import { useState } from 'react'
import { UmaFace } from '../../../ui/UmaArt'
import { farmWords } from '../words'
import { umaNote, type UmaRow } from './model'

/** Rows shown before **Show all**, so What and How many stay in reach at 390 × 844. */
export const SHOWN_FIRST = 6

function Row({ row, chosen, onPick, time }: { row: UmaRow; chosen: boolean; onPick?: () => void; time: (at: number) => string }) {
  const note = umaNote(row, time)
  const body = (
    <>
      <span className="block size-9 shrink-0 overflow-hidden rounded-full bg-sunken">
        <UmaFace outfitId={row.outfitId} size={36} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">{row.name}</span>
        <span className="block text-[12px] text-ink-soft">{farmWords('uma-row', { level: row.farmLevel, grade: row.highestGrade, tier: row.tier })}</span>
        {row.aptitude !== null && <span className="block text-[12px] text-ink-soft">{row.aptitude}</span>}
        {note !== null && <span data-uma-note className="block text-[12px] font-semibold text-ink-soft">{note}</span>}
      </span>
    </>
  )
  if (onPick === undefined) return <div className="flex items-center gap-2">{body}</div>
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={!row.pickable}
      aria-pressed={chosen}
      data-uma={row.outfitId}
      data-status={row.status}
      className={`flex min-h-12 w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left disabled:opacity-45 ${chosen ? 'bg-accent-wash ring-1 ring-accent' : 'bg-sunken/50'}`}
    >
      {body}
    </button>
  )
}

export function UmaList({ rows, chosen, onPick, time }: {
  rows: readonly UmaRow[]
  chosen: string | null
  onPick: (outfitId: string) => void
  time: (at: number) => string
}) {
  const [open, setOpen] = useState(chosen === null)
  const [all, setAll] = useState(false)
  const picked = rows.find((row) => row.outfitId === chosen)
  if (!open && picked !== undefined) {
    return (
      <div data-chosen-uma={picked.outfitId} className="flex items-center gap-2 rounded-sm bg-accent-wash px-2 py-1.5">
        <span className="min-w-0 flex-1"><Row row={picked} chosen time={time} /></span>
        <button type="button" onClick={() => setOpen(true)} aria-label={farmWords('change-uma')} className="min-h-11 shrink-0 px-2 text-[13px] font-semibold text-accent-strong">{farmWords('change')}</button>
      </div>
    )
  }
  const shown = all ? rows : rows.slice(0, SHOWN_FIRST)
  return (
    <ul data-g2="uma-list" className="space-y-1">
      {shown.map((row) => (
        <li key={row.outfitId}>
          <Row
            row={row}
            chosen={row.outfitId === chosen}
            time={time}
            onPick={() => {
              onPick(row.outfitId)
              setOpen(false)
            }}
          />
        </li>
      ))}
      {shown.length < rows.length && (
        <li>
          <button type="button" onClick={() => setAll(true)} className="min-h-11 w-full rounded-sm text-[13px] font-semibold text-accent-strong">
            {farmWords('show-all', { n: rows.length })}
          </button>
        </li>
      )}
    </ul>
  )
}
