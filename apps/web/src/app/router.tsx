import { Navigate, createBrowserRouter, useLocation, useParams } from 'react-router'
import { AppShell } from './AppShell'

/** The card set moved into the Training scene (M016); old links still land there. */
function CardSetRedirect() {
  const { umaId = '' } = useParams()
  return <Navigate to={`/constellation/${encodeURIComponent(umaId)}/cards`} replace />
}

/** Scenario start and advance live on the Uma profile now; the old scenario screen's links land there. */
function ScenarioRedirect() {
  const { umaId = '' } = useParams()
  return <Navigate to={`/stable/${encodeURIComponent(umaId)}`} replace />
}

/** Training is the constellation (D120); the old turn screen's links land there. */
function TrainingRedirect() {
  const { umaId = '' } = useParams()
  return <Navigate to={`/constellation/${encodeURIComponent(umaId)}`} replace />
}

/** Bond Recall retired (D177): its links open Friendship Training for the same card, scenario and way back. */
function BondRecallRedirect() {
  const { cardId } = useParams()
  const { search } = useLocation()
  return <Navigate to={cardId ? `/minigames/friendship-training/${encodeURIComponent(cardId)}${search}` : '/cards'} replace />
}

// Tab screens live inside the shell (top bar + bottom tabs). Full-screen scenes (race, constellation, reveals) sit
// outside it and are code-split so PixiJS only loads when a scene opens.
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    hydrateFallbackElement: <div className="h-dvh bg-page" aria-label="Loading Uma Racer" />,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import('../screens/HomeScreen')).HomeScreen }),
      },
      {
        path: 'stable',
        lazy: async () => ({ Component: (await import('../screens/StableScreen')).StableScreen }),
      },
      {
        path: 'stable/:umaId',
        lazy: async () => ({ Component: (await import('../screens/UmaProfileScreen')).UmaProfileScreen }),
      },
      {
        path: 'stable/:umaId/skills',
        lazy: async () => ({ Component: (await import('../screens/UmaSkillsScreen')).UmaSkillsScreen }),
      },
      {
        path: 'stable/:umaId/deck',
        Component: CardSetRedirect,
      },
      {
        path: 'scenario/:umaId/start',
        Component: ScenarioRedirect,
      },
      {
        path: 'training/:umaId',
        Component: TrainingRedirect,
      },
      {
        path: 'race',
        lazy: async () => ({ Component: (await import('../screens/RaceSelectScreen')).RaceSelectScreen }),
      },
      {
        path: 'cards',
        lazy: async () => ({ Component: (await import('../screens/CardsScreen')).CardsScreen }),
      },
      {
        // Coupons are spent on a card's own page now (M016).
        path: 'cards/redeem',
        element: <Navigate to="/cards" replace />,
      },
      {
        path: 'cards/:cardId',
        lazy: async () => ({ Component: (await import('../screens/CardPage')).CardPage }),
      },
      {
        path: 'badges',
        lazy: async () => ({ Component: (await import('../screens/BadgesScreen')).BadgesScreen }),
      },
      {
        path: 'trainer',
        lazy: async () => ({ Component: (await import('../screens/TrainerProfileScreen')).TrainerProfileScreen }),
      },
      {
        path: 'settings',
        lazy: async () => ({ Component: (await import('../screens/SettingsScreen')).SettingsScreen }),
      },
    ],
  },
  {
    // The Training scene: Constellation and Card set as tabs under one header (M016).
    path: 'constellation/:umaId',
    hydrateFallbackElement: <div className="h-dvh bg-page" aria-label="Loading training" />,
    lazy: async () => ({ Component: (await import('../screens/TrainingScene')).TrainingScene }),
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import('../screens/ConstellationScreen')).ConstellationScreen }),
      },
      {
        path: 'cards',
        lazy: async () => ({ Component: (await import('../screens/CardSetScreen')).CardSetScreen }),
      },
    ],
  },
  {
    path: 'minigames/spark-match/:umaId',
    hydrateFallbackElement: <div className="h-dvh bg-stage" aria-label="Loading Spark Match" />,
    lazy: async () => ({ Component: (await import('../screens/minigames/SparkMatchScreen')).SparkMatchScreen }),
  },
  {
    path: 'minigames/friendship-training/:cardId',
    hydrateFallbackElement: <div className="h-dvh bg-stage" aria-label="Loading Friendship Training" />,
    lazy: async () => ({ Component: (await import('../screens/minigames/friendship/FriendshipTrainingScreen')).FriendshipTrainingScreen }),
  },
  {
    path: 'minigames/bond-recall/:cardId?',
    element: <BondRecallRedirect />,
  },
  {
    path: 'race/run',
    hydrateFallbackElement: <div className="h-dvh bg-page" aria-label="Loading Race" />,
    lazy: async () => ({ Component: (await import('../screens/race/RaceRunScreen')).RaceRunScreen }),
  },
  {
    path: 'collection/reveal/:kind/:id',
    hydrateFallbackElement: <div className="h-dvh bg-stage" aria-label="Loading collection reveal" />,
    lazy: async () => ({ Component: (await import('../screens/CollectionRevealScreen')).CollectionRevealScreen }),
  },
])
