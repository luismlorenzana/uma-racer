// The job sheet's Uma strip (docs/game/07-farm.md §3, §5, §10; D366): one 44 pt face per **Free** Uma, scrolling
// sideways, each with her Farm Level as a badge and a star when her aptitude suits what she'd make here. Umas working
// anywhere, in a session or Ready with a finished job are never listed. The chosen one is ringed, and one line under the
// strip names her with her aptitude ("Sprint A · Farm EXP ×1.6"). VoiceOver reads each as a radio: "Amber Sprint, Farm Lv
// 10, suited, Front Runner A · Farm EXP ×1.6".
import { useState } from 'react'
import { ChevronRightIcon, StarIcon } from '@luismlorenzana/uma-kit/ui'
import { FaceTile } from '@luismlorenzana/uma-kit/album'
import { RacerUmaPicker } from '../../../ui/racerAlbum'
import { farmWords } from '../words'
import type { SheetUma } from './model'

function Face({ uma, chosen }: { uma: SheetUma; chosen: boolean }) {
  return (
    <span aria-hidden className="relative block size-11">
      <span className={`block size-11 overflow-hidden rounded-full bg-sunken ring-2 ring-offset-1 ring-offset-panel ${chosen ? 'ring-accent' : 'ring-transparent'}`}>
        <FaceTile round label="" outfitId={uma.outfitId} size={44} />
      </span>
      <span className="font-display absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-scrim px-1 text-[10px] leading-4 font-bold text-ink-on-dark tabular-nums">
        {uma.farmLevel}
      </span>
      {uma.suited && (
        <span data-suited className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-accent text-accent-ink">
          <StarIcon size={16} variant="solid" className="scale-75" />
        </span>
      )}
    </span>
  )
}

export function umaLabel(uma: SheetUma): string {
  return [farmWords('uma-chip-label', { name: uma.name, level: uma.farmLevel }), uma.suited ? farmWords('uma-suited') : null, uma.aptitude]
    .filter(Boolean).join(', ')
}

/** The chosen Uma's line under the strip, or the queued job's Uma alone. */
export function UmaLine({ uma }: { uma: SheetUma }) {
  return (
    <p data-chosen-uma={uma.outfitId} className="truncate text-[12px] text-ink-soft">
      <span className="font-semibold text-ink">{farmWords('uma-line', { name: uma.name, level: uma.farmLevel })}</span>
      {uma.aptitude !== null && <> · {uma.aptitude}</>}
    </p>
  )
}

export function UmaStrip({ rows, chosen, onPick, labelledBy }: {
  rows: readonly SheetUma[]
  chosen: string | null
  onPick: (outfitId: string) => void
  labelledBy: string
}) {
  const picked = rows.find((row) => row.outfitId === chosen)
  const [open, setOpen] = useState(false)
  const byId = new Map(rows.map((row, i) => [row.outfitId, { row, rank: i }]))
  return (
    <div className="space-y-1">
      <button type="button" onClick={() => setOpen(true)} aria-labelledby={labelledBy} aria-describedby={picked === undefined ? undefined : `${labelledBy}-chosen`}
        className="flex min-h-13 w-full items-center gap-3 rounded-sm border border-hairline bg-panel px-2 py-1.5 text-left" data-g2="farm-uma-control">
        {picked !== undefined && <Face uma={picked} chosen />}
        <span id={`${labelledBy}-chosen`} className="min-w-0 flex-1">
          {picked !== undefined && <span className="block truncate text-[13px] font-semibold">{picked.name} · Farm Lv {picked.farmLevel}</span>}
          <span className="block text-[12px] text-ink-soft">{picked?.aptitude ?? farmWords('uma-title')}</span>
        </span>
        <ChevronRightIcon size={20} className="shrink-0 text-ink-soft" />
      </button>
      <RacerUmaPicker open={open} onClose={() => setOpen(false)} title={farmWords('uma-title')} work
        candidateIds={rows.map((row) => row.outfitId)} selectedIds={chosen === null ? [] : [chosen]}
        workTie={(left, right) => (byId.get(left.id)?.rank ?? 0) - (byId.get(right.id)?.rank ?? 0)}
        describe={(entry) => { const row = byId.get(entry.id)?.row; return row === undefined ? null : umaLabel(row) }}
        onPick={onPick} />
    </div>
  )
}
