// One career as a 44 pt-plus row (docs/game/11-hub-and-places.md §3.2; D386): her face, her name, where she stands and
// her next objective, a link to the career (or, once complete, to her profile's racing build).
import { FaceTile } from '@luismlorenzana/uma-kit/album'
import { ChevronRightIcon, TrophyIcon } from '@luismlorenzana/uma-kit/ui'
import { Link } from 'react-router'
import type { CareerRow } from './model'

export function CareerRowLink({ row, to }: { row: CareerRow; to: string }) {
  return (
    <Link to={to} state={{ back: true }} data-career={row.id}
      className="flex min-h-14 items-center gap-3 rounded-md border border-hairline bg-panel p-2 active:bg-sunken">
      <span className="w-12 shrink-0"><FaceTile outfitId={row.umaId} size={48} label={row.name} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">{row.name}</span>
        <span className="block truncate text-[12px] text-ink-soft">{row.where}</span>
        {row.next !== null && <span className="block truncate text-[12px] text-ink">{row.next}</span>}
      </span>
      {row.completed ? <TrophyIcon size={20} className="text-tier-gold" /> : <ChevronRightIcon size={20} className="text-ink-faint" />}
    </Link>
  )
}
