import { createBrowserRouter } from 'react-router'
import { AppShell } from './AppShell'
import { HomeScreen } from '../screens/HomeScreen'
import { PlaceholderScreen } from '../screens/PlaceholderScreen'

// Tab screens live inside the shell (top bar + bottom tabs). Full-screen scenes (race, training, reveals) sit
// outside it and are code-split so PixiJS only loads when a scene opens.
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    hydrateFallbackElement: <div className="h-dvh bg-sky-100" aria-label="Loading Uma Racer" />,
    children: [
      { index: true, element: <HomeScreen /> },
      {
        path: 'stable',
        lazy: async () => ({ Component: (await import('../screens/StableScreen')).StableScreen }),
      },
      {
        path: 'stable/:umaId',
        lazy: async () => ({ Component: (await import('../screens/UmaProfileScreen')).UmaProfileScreen }),
      },
      {
        path: 'race',
        lazy: async () => ({ Component: (await import('../screens/RaceSelectScreen')).RaceSelectScreen }),
      },
      {
        path: 'cards',
        element: (
          <PlaceholderScreen
            title="Cards"
            emoji="🃏"
            lines={['SSR album by era', 'Limit breaks with tickets', 'Card Select Coupon reveals']}
          />
        ),
      },
      {
        path: 'badges',
        element: (
          <PlaceholderScreen
            title="Badges"
            emoji="🏅"
            lines={['Uma · Stable · Trainer scopes', 'Unlimited pins and showcase groups', 'Filters, sorting, saved views']}
          />
        ),
      },
      {
        path: 'settings',
        lazy: async () => ({ Component: (await import('../screens/SettingsScreen')).SettingsScreen }),
      },
    ],
  },
  {
    path: 'race/run',
    lazy: async () => ({ Component: (await import('../screens/race/RaceRunScreen')).RaceRunScreen }),
  },
])
