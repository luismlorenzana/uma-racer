// The Expedition Map, a placeholder until phase 9 (T141; docs/rework/10-expeditions.md "Entry", "Places and screens";
// 13 §4; 04 §11.7): open from day one, it lists each Uma's distance to entry, and an Uma who could start says so and
// that nothing is lost. It never shows Start, a pool, a region, a fit, an Expedition, a prize or a date, and writes no
// Expedition state. Every sub-route (`/:expeditionId`) goes back to the Map. An Uma who already holds a completed run
// (only the dev proof, before phase 9) opens her Promote sheet from here (04 §9).
import { Link, Navigate } from 'react-router'
import { useGame } from '../../app/game'
import { BuildingSprite } from '../../ui/BuildingSprite'
import { PlacePageHeader } from '../PlacePageHeader'
import { UmaFace } from '../../ui/UmaArt'
import type { PageProps } from '../registry'
import { useRaceContent } from './content'
import { mapRows } from './gate'
import { racingWords } from './words'

export default function ExpeditionMap({ place, rest }: PageProps) {
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const content = useRaceContent()
  if (rest !== '') return <Navigate to={place.route} replace />
  const rows = state && env ? mapRows(state, (umaId) => content?.umas.byId.get(umaId)?.name ?? umaId, env) : []
  const anyone = rows.some((row) => row.ready || row.complete)
  return (
    <div data-place-page="expedition-map" className="pb-6">
      <PlacePageHeader place={place} />
      <div className="flex justify-center pt-4"><BuildingSprite frame={place.frame} page={place.page} /></div>
      <div className="flex flex-col gap-2 p-3">
        {!anyone && <h2 className="font-display text-center text-[17px] font-semibold" data-g2="map-empty">{racingWords('map-empty')}</h2>}
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.umaId} className="rounded-md border border-hairline bg-panel p-3 shadow-1" data-map-uma={row.umaId}>
              <div className="flex items-center gap-3">
                <UmaFace outfitId={row.umaId} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{row.name}</p>
                  <p className="text-[12px] text-ink-soft">{row.distance}</p>
                </div>
              </div>
              {row.complete ? (
                <div className="mt-2 flex items-center gap-2">
                  <p className="min-w-0 flex-1 text-[13px] font-semibold text-accent-strong">{racingWords('map-promote')}</p>
                  <Link to={`/racing/scenario-gate/${encodeURIComponent(row.umaId)}?sheet=promote`} state={{ back: true }} className="font-display flex min-h-11 items-center rounded-sm bg-accent px-4 font-bold text-accent-ink shadow-1">
                    {racingWords('promote')}
                  </Link>
                </div>
              ) : row.ready && <p className="mt-2 text-[13px] text-ink">{racingWords('map-ready')}</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
