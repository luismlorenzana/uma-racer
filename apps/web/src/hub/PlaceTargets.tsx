// The tappable, accessible layer over the Phaser map (docs/game/11-hub-and-places.md §1, §4, §12; ported from uma-rpg's
// `hub/PlaceTargets.tsx`, its D33): one link per place, sitting on its building through the scene's own grid math, so
// the canvas underneath only draws. Each covers its building down to the ground line, then its name pill with the
// counter and its slot pips, and carries the Ready badge and its VoiceOver line. Every place is open (T137), so none
// shows a lock. Links read in map order, row by row, as the eye meets them.
import { hubWords, PLAZA_AT, tileLabel, type HubPage, type HubView, type Place, type PlaceAt } from '@racer/domain/hub'
import type { BuildingId } from '@racer/domain/farm'
import { Suspense, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { Link, useLocation } from 'react-router'
import { TOWN_PLAZA } from '../places/registry'
import { UmaArt } from '../ui/UmaArt'
import { useUmaName } from '../ui/uma'
import { shownCount, usePlaceCount } from './counts'
import { BUILDING, hubDpr, hubGrid, placeAnchor, TARGET_W, type HubGrid } from './grid'
import { peekPath, withParam } from './nav'
import { Pips } from './Pips'

/** Where a link sits over the map: its top centre on the building's top, or a fraction of the map before it's measured. */
function position(at: PlaceAt, grid: HubGrid | null, lift: number): CSSProperties {
  if (grid === null) return { left: `${at.x * 100}%`, top: `${at.y * 100}%`, transform: `translate(-50%, -${lift}px)` }
  const anchor = placeAnchor(at, grid)
  return { left: anchor.x, top: anchor.y, transform: `translate(-50%, -${lift}px)` }
}

/** The map's size, measured, so the links land on the scene's grid. */
export function useHubGrid(): [RefObject<HTMLDivElement | null>, HubGrid | null] {
  const root = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const el = root.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [root, size !== null && size.w > 0 && size.h > 0 ? hubGrid(size.w, size.h, hubDpr()) : null]
}

function PlaceTarget({ place, view, grid }: { place: Place; view: HubView | null; grid: HubGrid | null }) {
  const count = usePlaceCount(place, view)
  const shown = shownCount(count)
  const building = place.pips && view !== null ? view.buildings[place.id as BuildingId] : undefined
  // The tap area covers the building's sprite to its ground line; the name and pips hang below it.
  const tapH = grid === null ? 66 : BUILDING.anchorY * grid.scale
  const tapW = grid === null ? 72 : grid.tile * 3
  return (
    <Link
      to={place.direct ? place.route : peekPath(place)}
      state={{ back: true }}
      data-place={place.id}
      aria-label={tileLabel(place, view, count)}
      className="group absolute flex flex-col items-center"
      style={{ ...position(place.at!, grid, tapH), width: TARGET_W }}
    >
      <span className="relative block rounded-md transition-colors group-active:bg-white/15" style={{ width: tapW, height: tapH }}>
        {building !== undefined && building.ready > 0 && (
          <span aria-hidden data-ready-badge={building.ready} className="font-display absolute -top-1 -right-3 rounded-full bg-success px-1.5 text-[10px] leading-4 font-bold text-ink-on-dark shadow-2">
            {hubWords('ready-badge', { n: building.ready })}
          </span>
        )}
      </span>
      <span aria-hidden className="relative mt-0.5 max-w-full rounded-full border border-hairline bg-panel/95 px-1.5 py-0.5 text-[11px] leading-4 font-semibold text-ink shadow-2">
        <span className="block truncate">{place.name}</span>
        {shown !== null && (
          <span data-counter={shown} className="font-display absolute -top-2 -right-2.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 text-ink shadow-1">
            {shown}
          </span>
        )}
      </span>
      {building !== undefined && (
        <span className="mt-0.5 drop-shadow-sm">
          <Pips building={building} />
        </span>
      )}
    </Link>
  )
}

/** The Town Hall plaza (§5): T138's card standing on the road, else the featured Uma as still art; empty with no Umas. */
function Plaza({ view, grid }: { view: HubView | null; grid: HubGrid | null }) {
  const location = useLocation()
  const umaId = view?.featured ?? null
  const name = useUmaName(umaId)
  const Card = TOWN_PLAZA.Card
  // Her art (72 pt, under the card's 4 pt padding) stands on the plaza's ground line.
  return (
    <div className="absolute flex justify-center" style={{ ...position(PLAZA_AT, grid, 76), width: TARGET_W }} data-g2="plaza">
      {Card !== undefined ? (
        <Suspense fallback={null}><Card umaId={umaId} /></Suspense>
      ) : umaId !== null && (
        <Link
          to={withParam(location, 'sheet', 'featured')}
          state={{ back: true }}
          aria-label={hubWords('featured', { uma: name })}
          className="flex min-h-24 min-w-24 flex-col items-center justify-center gap-1 rounded-md p-1 active:bg-ink/5"
        >
          <UmaArt outfitId={umaId} size={72} />
          <span aria-hidden className="max-w-28 truncate rounded-full border border-accent/40 bg-accent-wash px-2 py-0.5 text-[11px] leading-4 font-semibold text-ink">{name}</span>
        </Link>
      )}
    </div>
  )
}

/** Map order: top to bottom, then left to right. */
const byMap = (a: { readonly at: PlaceAt }, b: { readonly at: PlaceAt }): number => a.at.y - b.at.y || a.at.x - b.at.x

export function PlaceTargets({ page, places, view }: { page: HubPage; places: readonly Place[]; view: HubView | null }) {
  const [root, grid] = useHubGrid()
  const items = [
    ...places.map((place) => ({ place, at: place.at! })),
    ...(page === 'town' ? [{ place: null, at: PLAZA_AT }] : []),
  ].sort(byMap)
  return (
    <div ref={root} className="absolute inset-0" data-g2="place-targets" data-grid={grid === null ? undefined : `${grid.cols}x${grid.rows}`}>
      {items.map((item) => (item.place === null
        ? <Plaza key="plaza" view={view} grid={grid} />
        : <PlaceTarget key={item.place.id} place={item.place} view={view} grid={grid} />))}
    </div>
  )
}
