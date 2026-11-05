// The games' views (docs/game/07-stages.md §5, D384): each game's view is its own lazy chunk, loaded by the host when a
// play opens, with its rule card's one verb and one sentence. A game without a view here isn't playable on the device.
import type { StageConfig, StageInput, StageKind } from '@racer/domain/stages'
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/** What a game's view draws from and sends back. */
export interface StageViewProps<S = unknown> {
  readonly config: StageConfig
  /** The play so far: the rules' state after every move. */
  readonly state: S
  /** A move; the host stamps its tick, and drops it when the rules call it illegal. */
  readonly onMove: (move: Omit<StageInput, 'tick'>) => void
  /** Keep the moves, drop the flourishes. */
  readonly reducedMotion: boolean
  /** No moves now (the play is settling). */
  readonly locked: boolean
}

export interface StageViewEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly View: LazyExoticComponent<ComponentType<StageViewProps<any>>>
  /** The rule card: one verb, and one sentence. */
  readonly verb: string
  readonly rule: string
  /** The bonus tasks' names, in the report's order. */
  readonly tasks: readonly string[]
}

export const STAGE_VIEWS: Readonly<Partial<Record<StageKind, StageViewEntry>>> = {
  'training-yard': {
    View: lazy(() => import('./yard/YardView')),
    verb: 'Merge',
    rule: 'Tap a cell to set the piece down: three touching of one colour and frame merge one frame up.',
    tasks: ['Gold in two colours', 'No Fatigue left', 'Every Partner merged'],
  },
}
