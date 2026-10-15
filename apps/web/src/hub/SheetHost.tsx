// The global sheets' host (docs/rework/11-hub-and-places.md §2.2–§2.3, §5): `?sheet=menu | featured | check-in` on any
// shell route opens today's modal BottomSheet, so Back closes it. The sheets load in their own chunk the first time one
// opens, and stay mounted after, so a closing sheet can slide away.
import { lazy, Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { isGlobalSheet } from './nav'

const GlobalSheets = lazy(() => import('./GlobalSheets'))

export function SheetHost() {
  const [params] = useSearchParams()
  const asked = params.get('sheet')
  const sheet = isGlobalSheet(asked) ? asked : null
  const [loaded, setLoaded] = useState(sheet !== null)
  useEffect(() => {
    if (sheet !== null) setLoaded(true)
  }, [sheet])
  if (!loaded) return null
  return (
    <Suspense fallback={null}>
      <GlobalSheets sheet={sheet} />
    </Suspense>
  )
}
