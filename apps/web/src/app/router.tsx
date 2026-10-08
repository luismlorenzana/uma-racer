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
    // Standalone synthetic practice bypasses the account shell and stays release-gated.
    path: 'puzzles/practice',
    lazy: async () => ({ Component: (await import('../screens/puzzles/PuzzlePracticeScreen')).PuzzlePracticeEntry }),
  },
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
      {
        path: 'inspiration',
        lazy: async () => ({ Component: (await import('../screens/ConstellationScreen')).InspirationScreen }),
      },
      {
        path: 'extra-stats',
        lazy: async () => ({ Component: (await import('../screens/ExtraStatsScreen')).ExtraStatsScreen }),
      },
    ],
  },
  {
    path: 'minigames/spark-match/:umaId',
    hydrateFallbackElement: <div className="h-dvh bg-stage" aria-label="Loading Spark Match" />,
    lazy: async () => ({ Component: (await import('../screens/minigames/SparkEntry')).SparkEntry }),
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
    // A lazy full-screen account activity: no sixth tab and no Farm screen code in the startup bundle (T084).
    path: 'farm',
    hydrateFallbackElement: <div className="h-dvh bg-page" aria-label="Loading Stable Farm" />,
    lazy: async () => ({ Component: (await import('../screens/farm/FarmScreen')).FarmShell }),
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import('../screens/farm/FarmScreen')).FarmSectionsScreen }),
      },
      {
        // Six plots at a time, one Farm Section per screen (D234).
        path: 'section/:section',
        lazy: async () => ({ Component: (await import('../screens/farm/FarmScreen')).FarmFieldScreen }),
      },
      {
        path: 'workers',
        lazy: async () => ({ Component: (await import('../screens/farm/FarmScreen')).FarmWorkersScreen }),
      },
      {
        path: 'crops',
        lazy: async () => ({ Component: (await import('../screens/farm/FarmScreen')).FarmCropsScreen }),
      },
      {
        path: 'items',
        lazy: async () => ({ Component: (await import('../screens/farm/ItemInventoryScreen')).ItemInventoryScreen }),
      },
    ],
  },
  {
    // Route-split campaign (D263): parties, roster, chapter launch pad, map and fights share one shell.
    path: 'rpg',
    hydrateFallbackElement: <div className="h-dvh bg-stage" aria-label="Loading Uma RPG" />,
    lazy: async () => ({ Component: (await import('../screens/rpg/RpgScreen')).RpgShell }),
    children: [
      { index: true, lazy: async () => ({ Component: (await import('../screens/rpg/RpgScreen')).RpgHubScreen }) },
      { path: 'roster', lazy: async () => ({ Component: (await import('../screens/rpg/RpgScreen')).RpgRosterScreen }) },
      { path: 'roster/:outfitId', lazy: async () => ({ Component: (await import('../screens/rpg/RpgScreen')).RpgProfileScreen }) },
      { path: 'party/:presetId', lazy: async () => ({ Component: (await import('../screens/rpg/RpgScreen')).RpgLaunchScreen }) },
      { path: 'party/:presetId/edit', lazy: async () => ({ Component: (await import('../screens/rpg/RpgScreen')).RpgPartyEditScreen }) },
      { path: 'party/:presetId/:chapterId', lazy: async () => ({ Component: (await import('../screens/rpg/RpgMapScreen')).RpgMapScreen }) },
      { path: 'party/:presetId/:chapterId/fight', lazy: async () => ({ Component: (await import('../screens/rpg/RpgFightScreen')).RpgFightScreen }) },
    ],
  },
  {
    // Read-only private-content preflight; no playable Home entry until T116.
    path: 'puzzles/content',
    lazy: async () => ({ Component: (await import('../screens/puzzles/PuzzleContentScreen')).PuzzleContentScreen }),
  },
  {
    // Saved setup and battle routes. The parent gate checks capability before host/account/content I/O.
    path: 'puzzles',
    hydrateFallbackElement: <div className="h-dvh bg-stage" aria-label="Loading Uma Puzzles" />,
    lazy: async () => ({ Component: (await import('../screens/puzzles/PuzzleContext')).PuzzleShell }),
    children: puzzleSetupRoutes(),
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
  ...(import.meta.env.DEV ? [{
    path: 'dev/puzzles-preservation-proof',
    lazy: async () => ({ Component: (await import('../screens/puzzles/PuzzlePreservationProofScreen')).PuzzlePreservationProofScreen }),
  }, {
    path: 'dev/puzzles-material-icons',
    lazy: async () => ({ Component: (await import('../screens/puzzles/PuzzleMaterialIconProofScreen')).PuzzleMaterialIconProofScreen }),
  }, {
    path: 'dev/puzzles-battle-proof/:proofCase?',
    lazy: async () => ({ Component: (await import('../screens/puzzles/PuzzleBattleProofScreen')).PuzzleBattleProofScreen }),
  }, {
    path: 'dev/puzzles-practice',
    lazy: async () => ({ Component: (await import('../screens/puzzles/PuzzlePracticeScreen')).PuzzlePracticeScreen }),
  }, {
    path: 'dev/puzzles-ui-proof',
    lazy: async () => ({ Component: (await import('../screens/puzzles/PuzzleUiProofScreen')).PuzzleUiProofShell }),
    children: puzzleSetupRoutes(),
  }, {
    path: 'dev/puzzles-content-proof',
    lazy: async () => ({ Component: (await import('../screens/puzzles/PuzzleContentProofScreen')).PuzzleContentProofScreen }),
  }, {
    path: 'dev/inspiration-advance-proof',
    lazy: async () => ({ Component: (await import('../screens/rpg/InspirationAdvanceProofScreen')).InspirationAdvanceProofScreen }),
  }, {
    path: 'dev/inspiration-proof',
    lazy: async () => ({ Component: (await import('../screens/rpg/InspirationProofScreen')).InspirationProofScreen }),
  }, {
    path: 'dev/spark-rival-proof',
    hydrateFallbackElement: <div className="h-dvh bg-stage" aria-label="Loading Spark Rival touch proof" />,
    lazy: async () => ({ Component: (await import('../screens/minigames/SparkRivalProofScreen')).SparkRivalProofScreen }),
  }] : []),
])

/** Same screens, different providers. No DEV parameter can switch a production account into a proof. */
function puzzleSetupRoutes() {
  return [
    { path: 'battle/:battleId', lazy: async () => ({ Component: (await import('../screens/puzzles/PuzzleBattleScreen')).PuzzleBattleScreen }) },
    { index: true, lazy: async () => ({ Component: (await import('../screens/puzzles/PuzzleHubScreen')).PuzzleHubScreen }) },
    { path: 'roster', lazy: async () => ({ Component: (await import('../screens/puzzles/PuzzleRosterScreen')).PuzzleRosterScreen }) },
    { path: 'roster/:outfitId', lazy: async () => ({ Component: (await import('../screens/puzzles/PuzzleRosterScreen')).PuzzleProfileScreen }) },
    { path: 'party/:partyId', lazy: async () => ({ Component: (await import('../screens/puzzles/PuzzlePartyScreen')).PuzzlePartyScreen }) },
    { path: 'chapters', lazy: async () => ({ Component: (await import('../screens/puzzles/PuzzleChaptersScreen')).PuzzleChaptersScreen }) },
    { path: 'party/:partyId/:scenarioId', lazy: async () => ({ Component: (await import('../screens/puzzles/PuzzleMapScreen')).PuzzleMapScreen }) },
    { path: 'exchange', lazy: async () => ({ Component: (await import('../screens/puzzles/PuzzleMaterialsScreen')).PuzzleExchangeScreen }) },
    { path: 'items', lazy: async () => ({ Component: (await import('../screens/puzzles/PuzzleMaterialsScreen')).PuzzleItemsScreen }) },
  ]
}
