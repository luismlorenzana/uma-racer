// The four Training places' Page (docs/game/11-hub-and-places.md §3.2, §6, §7.1; T139): `/training/:facility` is the
// facility page (with the session sheet over it from its query), and `/training/:facility/:umaId` her build view
// there: the Observatory's tree and the Gym's Extra Stats map full screen, the Lineage Hall's map and the Dojo's bonds
// in the shell. Each view is its own lazy chunk.
import type { FacilityId } from '@racer/domain/farm'
import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import { Navigate } from 'react-router'
import type { PageProps } from '../registry'
import FacilityPage from './facility/FacilityPage'

export interface BuildViewProps {
  readonly place: PageProps['place']
  readonly umaId: string
}

const VIEWS: Readonly<Record<FacilityId, LazyExoticComponent<ComponentType<BuildViewProps>>>> = {
  observatory: lazy(() => import('./observatory/TreeView')),
  'lineage-hall': lazy(() => import('./lineage-hall/LineageView')),
  gym: lazy(() => import('./gym/ExtraStatsView')),
  dojo: lazy(() => import('./dojo/BondsView')),
}

export default function TrainingPage({ place, rest }: PageProps) {
  if (rest === '') return <FacilityPage place={place} />
  if (!/^[^/]+$/.test(rest)) return <Navigate to={place.route} replace />
  const View = VIEWS[place.id as FacilityId]
  return (
    <Suspense fallback={null}>
      <View place={place} umaId={decodeURIComponent(rest)} />
    </Suspense>
  )
}
