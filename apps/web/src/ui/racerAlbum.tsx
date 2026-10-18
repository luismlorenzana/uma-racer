// Racer-only projections and callbacks for the shared album (SB6; docs/game/11-hub-and-places.md §3.1).
// Filtering, browsing, selection, layout and art are uma-kit's, not a second implementation here.
import { UmaPicker as KitUmaPicker, type FaceTileBadges, type UmaPickerRow, type UmaPickerSort } from '@luismlorenzana/uma-kit/album'
import { byLevel, formatLevel, workOrder, type AlbumRow } from '@luismlorenzana/uma-kit/roster'
import { Button, HonorsIcon, Sheet, TargetIcon, TierCrest } from '@luismlorenzana/uma-kit/ui'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { holdsSlot } from '@racer/domain/work'
import { useGame } from '../app/game'
import { buildStableAlbum, STABLE_FACETS, STABLE_SORTS, type StableAlbum, type StableEntry } from '../places/stable/model'
import { Crest } from './Crest'

export interface RacerUmaRow extends UmaPickerRow {
  readonly entry: StableEntry
  readonly lifetime: number | null
  readonly locked: boolean
}

/** Display the tier-local level, order by lifetime level. The game's tier and save shapes never leave this adapter. */
export function racerAlbumRows(album: StableAlbum): RacerUmaRow[] {
  return album.rows.map((row: AlbumRow) => {
    const entry = album.entries.get(row.id)!
    return {
      ...row, entry, name: entry.name, releasedAt: entry.template.jpRelease,
      level: entry.uma?.racing.level ?? null, tier: entry.uma?.tier, lifetime: entry.lifetime,
      workLevel: entry.uma?.farm.level ?? null, locked: !entry.owned,
    }
  })
}

export const racerLevelOrder = (left: RacerUmaRow, right: RacerUmaRow): number =>
  byLevel({ ...left, level: left.lifetime }, { ...right, level: right.lifetime })

export function racerBadges(row: RacerUmaRow): FaceTileBadges {
  const entry = row.entry
  return {
    topLeft: entry.uma === null ? undefined : <TierCrest tier={entry.uma.tier} />,
    topRight: <span className="flex items-center gap-0.5">
      {entry.ready !== null && <span role="img" aria-label={`Ready to ${entry.ready}`} data-ready-dot className="size-2.5 rounded-full bg-success shadow-1" />}
      {entry.target && <TargetIcon size={16} title="Planner target" className="rounded-full bg-panel/90 text-accent-strong" />}
    </span>,
    bottomLeft: entry.isNew ? <Crest tone="accent">NEW</Crest> : undefined,
    bottomRight: entry.hallOfFame ? <Crest tone="accent"><HonorsIcon size={16} title="Hall of Fame" /></Crest> : undefined,
  }
}

export interface RacerPickerSort {
  readonly key: string
  readonly label: string
  readonly direction: 'asc' | 'desc'
  readonly value: (entry: StableEntry) => number | string | null
  readonly describe?: (entry: StableEntry) => ReactNode
}

interface RacerUmaPickerProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly title: string
  readonly candidateIds?: readonly string[]
  readonly selectedIds?: readonly string[]
  readonly selectedLabel?: string
  readonly sorts?: readonly RacerPickerSort[]
  readonly describe?: (entry: StableEntry) => ReactNode
  readonly disabledReason?: (entry: StableEntry) => string | null
  /** Existing racer-only Queue / Recall / Cook actions, offered after choosing her, never inside a kit button. */
  readonly action?: (entry: StableEntry) => ReactNode
  readonly work?: boolean
  /** A work context may keep its tie-break (e.g. suited first), after Free and Farm Level. */
  readonly workTie?: (left: StableEntry, right: StableEntry) => number
  readonly onPick: (umaId: string) => void
}

export function RacerUmaPicker({ open, onClose, title, candidateIds, selectedIds = [], selectedLabel = 'Selected',
  sorts = [], describe, disabledReason, action, work = false, workTie, onPick }: RacerUmaPickerProps) {
  const state = useGame((snapshot) => snapshot.state)
  const content = useGame((snapshot) => snapshot.env?.content ?? null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [returning, setReturning] = useState(false)
  useEffect(() => { if (open) { setActionId(null); setReturning(false) } }, [open])
  const rows = useMemo(() => {
    if (state === null || content === null) return []
    const offered = new Set(candidateIds ?? Object.keys(state.umas))
    return racerAlbumRows(buildStableAlbum(state, content, Object.keys(state.umas)))
      .filter((row) => offered.has(row.id))
      .map((row) => ({ ...row, free: state.work[row.id] === undefined || !holdsSlot(state.work[row.id]!) }))
  }, [state, content, candidateIds])
  const contextKeys = new Set(sorts.map((sort) => sort.key))
  const sortOptions: UmaPickerSort<RacerUmaRow>[] = [
    ...sorts.map((sort) => ({ ...sort, value: (row: RacerUmaRow) => sort.value(row.entry),
      describe: sort.describe === undefined ? undefined : (row: RacerUmaRow) => sort.describe!(row.entry) })),
    ...STABLE_SORTS.filter((sort) => sort.key !== (work ? 'farm' : 'level') && !contextKeys.has(sort.key)).map((sort) => ({
      key: sort.key, label: sort.label, direction: sort.defaultDirection,
      value: (row: RacerUmaRow) => row.sorts[sort.key] ?? null,
    })),
  ]
  const chosen = rows.find((row) => row.id === actionId)
  const close = () => { setReturning(false); onClose() }
  const choose = (id: string) => { setActionId(null); setReturning(false); onPick(id); onClose() }
  const reason = chosen === undefined ? null : disabledReason?.(chosen.entry) ?? null
  return (
    <>
      <KitUmaPicker
        open={(open || returning) && actionId === null} title={title} rows={rows} facets={STABLE_FACETS}
        order={work ? (left, right) => left.free === right.free && left.workLevel === right.workLevel
          ? workTie?.(left.entry, right.entry) || workOrder(left, right) : workOrder(left, right)
          : racerLevelOrder} sorts={sortOptions} selectedIds={selectedIds}
        disabled={(row) => action?.(row.entry) == null ? disabledReason?.(row.entry) ?? null : null}
        describe={(row) => disabledReason?.(row.entry) ?? describe?.(row.entry) ?? row.entry.outfit}
        renderBadges={racerBadges}
        renderChips={(row) => <>
          <span className="tabular-nums">{formatLevel(row.level, row.tier)}</span>
          {selectedIds.includes(row.id) && <span className="text-accent-strong">{selectedLabel}</span>}
          {action?.(row.entry) != null && <span className="text-accent-strong">Options</span>}
        </>}
        words={work ? { level: 'Farm Level' } : undefined}
        onPick={([id]) => {
          if (id === undefined) return
          const row = rows.find((one) => one.id === id)
          if (row !== undefined && action?.(row.entry) != null) setActionId(id)
          else choose(id)
        }}
        onClose={close}
      />
      <Sheet open={chosen !== undefined} title={chosen?.name ?? title}
        onClose={() => { setActionId(null); setReturning(true) }}>
        {chosen !== undefined && <div className="space-y-3">
          <p className="text-[13px] text-ink-soft">{reason ?? describe?.(chosen.entry)}</p>
          <div onClick={() => { setActionId(null); close() }}>{action?.(chosen.entry)}</div>
          {reason === null && <Button className="w-full" onClick={() => choose(chosen.id)}>Choose {chosen.name}</Button>}
        </div>}
      </Sheet>
    </>
  )
}
