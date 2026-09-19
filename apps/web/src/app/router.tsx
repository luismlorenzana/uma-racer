import { createBrowserRouter } from 'react-router'
import { AppShell } from './AppShell'

// Tab screens live inside the shell (top bar + bottom tabs). Full-screen scenes (race, training, reveals) sit
// outside it and are code-split so PixiJS only loads when a scene opens.
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    hydrateFallbackElement: <div className="h-dvh bg-sky-100" aria-label="Loading Uma Racer" />,
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
        path: 'stable/:umaId/deck',
        lazy: async () => ({ Component: (await import('../screens/DeckEditorScreen')).DeckEditorScreen }),
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
        path: 'cards/redeem',
        lazy: async () => ({ Component: (await import('../screens/CardRedeemScreen')).CardRedeemScreen }),
      },
      {
        path: 'badges',
        lazy: async () => ({ Component: (await import('../screens/BadgesScreen')).BadgesScreen }),
      },
      {
        path: 'settings',
        lazy: async () => ({ Component: (await import('../screens/SettingsScreen')).SettingsScreen }),
      },
    ],
  },
  {
    path: 'training/:umaId',
    hydrateFallbackElement: <div className="h-dvh bg-sky-100" aria-label="Loading Training" />,
    lazy: async () => ({ Component: (await import('../screens/training/TrainingScreen')).TrainingScreen }),
  },
  {
    path: 'scenario/:umaId/start',
    hydrateFallbackElement: <div className="h-dvh bg-sky-100" aria-label="Loading Scenario Start" />,
    lazy: async () => ({ Component: (await import('../screens/ScenarioStartScreen')).ScenarioStartScreen }),
  },
  {
    path: 'race/run',
    hydrateFallbackElement: <div className="h-dvh bg-sky-100" aria-label="Loading Race" />,
    lazy: async () => ({ Component: (await import('../screens/race/RaceRunScreen')).RaceRunScreen }),
  },
  {
    path: 'collection/reveal/:kind/:id',
    hydrateFallbackElement: <div className="h-dvh bg-violet-950" aria-label="Loading collection reveal" />,
    lazy: async () => ({ Component: (await import('../screens/CollectionRevealScreen')).CollectionRevealScreen }),
  },
])
