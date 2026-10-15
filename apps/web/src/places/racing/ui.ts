// The Racing page's slots (T141; docs/rework/11-hub-and-places.md §1, §3.3, §6): each Page and Peek a lazy chunk, the
// full-screen flows (the run and its result; the Scenario Gate's ceremony), and the two counters the rework state
// can't give (`useCounter`). The Scenario Gate's and the Expedition Map's counters are the hub view's.
import type { PlaceId } from '@racer/domain/hub'
import { lazy } from 'react'
import type { PlaceUi } from '../registry'
import { useFeaturedOpen, useNewFlair } from './counters'

const peeks = () => import('./Peeks')

export const RACING_UI: Readonly<Partial<Record<PlaceId, PlaceUi>>> = {
  racecourse: {
    Page: lazy(() => import('./Racecourse')),
    fullScreen: (rest) => rest === 'run' || rest.startsWith('run/'),
    useCounter: useFeaturedOpen,
  },
  'scenario-gate': {
    Page: lazy(() => import('./ScenarioGate')),
    Peek: lazy(() => peeks().then((mod) => ({ default: mod.GatePeek }))),
    fullScreen: (rest) => /^[^/]+\/ceremony$/.test(rest),
  },
  'expedition-map': {
    Page: lazy(() => import('./ExpeditionMap')),
    Peek: lazy(() => peeks().then((mod) => ({ default: mod.MapPeek }))),
  },
  'trophy-hall': {
    Page: lazy(() => import('./TrophyHall')),
    Peek: lazy(() => peeks().then((mod) => ({ default: mod.TrophyPeek }))),
    useCounter: useNewFlair,
  },
}
