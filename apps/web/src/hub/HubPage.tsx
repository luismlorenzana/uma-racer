// A Hub page (docs/game/11-hub-and-places.md §1–§5, §12; T145, T147, T152): uma-kit's map, built from the hub view. The
// kit draws the page's pixel map on a lazy Phaser canvas with one DOM link per place over it, and moves to the next or
// previous page on a mostly sideways drag of more than 60 px, with the scene's fade; the bottom bar's tabs still do. This
// adapter hands it each racer page's ground (`racerHub.ts`), every place's link and counter, the Town Hall plaza's crowd
// (the owned Umas, newest first, five at most), and the quick look as the kit's side panel (`?peek=:place`,
// `PlacePeek.tsx`). The scene pauses while the panel or the menu covers it. Dev builds take `?canvas` (the Canvas
// renderer, so a preview screenshot captures the map) and expose `window.__hub`.
import { HubMap, type HubMapPlace } from '@luismlorenzana/uma-kit/hub'
import { peekPath, withParam } from '@luismlorenzana/uma-kit/shell'
import { useReducedMotionSetting } from '@luismlorenzana/uma-kit/ui'
import { HUB_PAGE_NAMES, HUB_PAGES, hubWords, PLAZA_AT, placesOn, tileLabel, type HubPage as HubPageId } from '@racer/domain/hub'
import { useMemo } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useHub } from '../app/game'
import { placeCounts, shownCount } from './counts'
import { isGlobalSheet } from './nav'
import { PlacePeek } from './PlacePeek'
import { PlazaFigure } from './PlazaFigure'
import { pageGround, plazaCrowd } from './racerHub'

export default function HubPage({ page }: { page: HubPageId }) {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const view = useHub()
  const reducedMotion = useReducedMotionSetting()
  const ground = useMemo(() => pageGround(page), [page])
  const places = useMemo(() => placesOn(page), [page])
  const counts = placeCounts(view)
  const countKey = places.map((place) => counts[place.id] ?? '').join()
  const targets = useMemo<HubMapPlace[]>(() => places.map((place) => {
    const count = counts[place.id] ?? null
    return {
      id: place.id,
      name: place.name,
      at: place.at!,
      frame: place.frame ?? place.id,
      to: place.direct ? place.route : peekPath(place.page, place.id),
      label: tileLabel(place, count),
      count: shownCount(count),
    }
    // `counts` is a new object each render; its values for this page are `countKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [places, countKey])
  // The crowd stands round the plaza's spot in uma-kit's V (`CROWD_SPOTS`), each figure 44 pt (SA7).
  const crowdKey = plazaCrowd(view?.owned ?? []).join('|')
  const plaza = useMemo(() => (page === 'town'
    ? { at: PLAZA_AT, figures: (crowdKey === '' ? [] : crowdKey.split('|')).map((umaId) => ({ key: umaId, node: <PlazaFigure umaId={umaId} /> })) }
    : undefined), [page, crowdKey])
  const peekId = params.get('peek')
  const peek = peekId === null ? undefined : places.find((place) => place.id === peekId && !place.direct)
  const sheet = isGlobalSheet(params.get('sheet'))
  if (peekId !== null && peek === undefined) return <Navigate to={withParam(location, 'peek', null)} replace />

  return (
    <HubMap
      label={hubWords('map', { page: HUB_PAGE_NAMES[page] })}
      page={page}
      pages={HUB_PAGES}
      onPage={(next) => navigate(`/${next}`)}
      ground={ground}
      places={targets}
      plaza={plaza}
      covered={peek !== undefined || sheet}
      reducedMotion={reducedMotion}
      canvas={import.meta.env.DEV && params.has('canvas')}
      debug={import.meta.env.DEV}
    >
      {peek !== undefined && <PlacePeek key={peek.id} place={peek} count={counts[peek.id] ?? null} />}
    </HubMap>
  )
}
