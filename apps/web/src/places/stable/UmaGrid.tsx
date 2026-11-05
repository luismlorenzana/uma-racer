// The Stable's faces (docs/game/11-hub-and-places.md §3.1; D386): uma-kit's album primitives, its virtual grid of
// face tiles, five a row on the phone. A locked Uma's face is dimmed behind the kit's lock; an owned one carries a race
// mark while her career runs and a trophy once one is complete. Each tile is a 44 pt-plus button named for VoiceOver.
import { FaceTile, VirtualGrid } from '@luismlorenzana/uma-kit/album'
import { RaceIcon, TrophyIcon } from '@luismlorenzana/uma-kit/ui'
import type { ReactNode } from 'react'
import { stableWords, type StableRow } from './model'

function Badge({ children }: { children: ReactNode }) {
  return <span className="flex size-5 items-center justify-center rounded-full bg-accent text-accent-ink shadow-1 ring-1 ring-page">{children}</span>
}

/** Her tile's VoiceOver line: "Amber Sprint", "Amber Sprint, Locked", "Amber Sprint, In a career". */
export function tileLabel(row: StableRow): string {
  const status = !row.owned ? stableWords('locked') : row.inCareer ? stableWords('in-career') : row.finished ? stableWords('career-done') : null
  return status === null ? row.name : `${row.name}, ${status}`
}

export function UmaGrid({ rows, onOpen }: { rows: readonly StableRow[]; onOpen: (row: StableRow) => void }) {
  return (
    <VirtualGrid
      items={rows}
      columns={5}
      rowHeight={92}
      keyOf={(row) => row.id}
      renderItem={(row) => (
        <button
          type="button"
          aria-label={tileLabel(row)}
          onClick={() => onOpen(row)}
          data-uma={row.id}
          data-owned={row.owned}
          className="block min-h-11 w-full min-w-0 rounded-md p-0.5 text-center active:bg-sunken"
        >
          <FaceTile
            outfitId={row.id}
            size={64}
            locked={!row.owned}
            label={row.name}
            badges={{
              topRight: row.inCareer ? <Badge><RaceIcon size={16} /></Badge> : undefined,
              bottomRight: row.finished ? <Badge><TrophyIcon size={16} /></Badge> : undefined,
            }}
          />
          <span className="font-display mt-1 block truncate text-[11px] font-semibold">{row.name}</span>
        </button>
      )}
    />
  )
}
