// A Hub page (docs/game/11-hub-and-places.md §1–§5, §12; T145, T147): uma-kit's map, built from the hub view. The kit
// draws the page's pixel map on a lazy Phaser canvas with one DOM link per place over it, and moves to the next or
// previous page on a mostly sideways drag of more than 60 px, with the scene's fade; the bottom bar's tabs still do. This
// adapter hands it each racer page's ground (`racerHub.ts`), every place's link, counter, Ready badge and pips, the Town
// Hall plaza, the floating pill (§2.3), and the quick look as the kit's side panel (`?peek=:place`, `PlacePeek.tsx`).
// The scene pauses while the panel or a global sheet covers it. Dev builds take `?canvas` (the Canvas renderer, so a
// preview screenshot captures the map) and expose `window.__hub`.
import { HubMap, type HubMapPlace } from '@luismlorenzana/uma-kit/hub'
import { FloatingPill, peekPath, withParam } from '@luismlorenzana/uma-kit/shell'
import { useKitArt, useReducedMotionSetting } from '@luismlorenzana/uma-kit/ui'
import { HUB_PAGE_NAMES, HUB_PAGES, hubWords, pillWords, PLAZA_AT, placesOn, tileLabel, type HubPage as HubPageId, type HubView } from '@racer/domain/hub'
import type { BuildingId } from '@racer/domain/farm'
import { Suspense, useMemo } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useGame, useHub } from '../app/game'
import { TOWN_PLAZA } from '../places/registry'
import { UmaFace } from '../ui/UmaArt'
import { shownCount, usePlaceCounts } from './counts'
import { isGlobalSheet } from './nav'
import { PlacePeek } from './PlacePeek'
import { pageGround, pipModels, plazaCrowd } from './racerHub'

const face = (outfitId: string) => <UmaFace outfitId={outfitId} size={16} />
const Figure = TOWN_PLAZA.Figure
const NO_FRAMES: Readonly<Record<string, unknown>> = {}

/** The Town Hall plaza's crowd (§5, SA7): the featured Uma in front, then the highest lifetime levels; five at most. */
function useCrowd(): readonly string[] {
  const view = useHub()
  const umas = useGame((snapshot) => snapshot.state?.umas ?? null)
  const content = useGame((snapshot) => snapshot.env?.content ?? null)
  const featured = view?.featured ?? null
  return useMemo(() => (umas === null || content === null ? [] : plazaCrowd(umas, featured, (umaId) => {
    const template = content.umas.get(umaId)
    return { name: template?.name ?? umaId, release: template?.jpRelease ?? '' }
  })), [umas, content, featured])
}

/** The floating pill (§2.3), right thumb zone above the bar: Collect all, else Check-in, else nothing. */
function Pill({ view }: { view: HubView | null }) {
  const location = useLocation()
  const words = pillWords(view)
  if (words === null) return null
  return <FloatingPill to={withParam(location, 'sheet', 'check-in')} state={{ back: true, collect: words.collect }} text={words.text} emphasis={words.collect} />
}

export default function HubPage({ page }: { page: HubPageId }) {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const view = useHub()
  const reducedMotion = useReducedMotionSetting()
  const frames = useKitArt().tiles?.index.frames ?? NO_FRAMES
  const ground = useMemo(() => pageGround(page, frames), [page, frames])
  const places = useMemo(() => placesOn(page), [page])
  const counts = usePlaceCounts(view, (place) => place.page === page)
  const countKey = places.map((place) => counts[place.id] ?? '').join()
  const targets = useMemo<HubMapPlace[]>(() => places.map((place) => {
    const count = counts[place.id] ?? null
    const building = place.pips && view !== null ? view.buildings[place.id as BuildingId] : undefined
    return {
      id: place.id,
      name: place.name,
      at: place.at!,
      frame: place.frame ?? place.id,
      to: place.direct ? place.route : peekPath(place.page, place.id),
      label: tileLabel(place, view, count),
      count: shownCount(count),
      ready: building !== undefined && building.ready > 0 ? hubWords('ready-badge', { n: building.ready }) : undefined,
      pips: building === undefined ? undefined : pipModels(building, face),
      more: building?.more,
    }
    // `counts` is a new object each render; its values for this page are `countKey`.
  }), [places, view, countKey])
  // The crowd stands round the plaza's spot in uma-kit's V (`CROWD_SPOTS`), each figure 44 pt and bobbing (SA7).
  const crowd = useCrowd()
  const crowdKey = crowd.join('|')
  const plaza = useMemo(() => (page === 'town' && Figure !== undefined
    ? { at: PLAZA_AT, figures: crowd.map((umaId, i) => ({ key: umaId, node: <Suspense fallback={null}><Figure umaId={umaId} front={i === 0} /></Suspense> })) }
    : undefined),
  // `crowd` is a new array when any Uma changes; who stands there is `crowdKey`.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [page, crowdKey])
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
      <Pill view={view} />
      {peek !== undefined && <PlacePeek key={peek.id} place={peek} view={view} />}
    </HubMap>
  )
}
