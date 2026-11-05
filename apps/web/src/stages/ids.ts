// Which journal a play keeps (docs/game/07-stages.md §4, D384), apart from the host's helpers so a screen can ask
// whether a play is open (the career page's Resume, D387) without loading the games' rules.
import type { StageKind } from '@racer/domain/stages'

/** How a host was opened: a career's plays (Play pays, Practice doesn't), or practice only. */
export type StageMode = 'career' | 'practice'

/** One open play per game and career, and one practice per game outside a career. */
export const journalId = (kind: StageKind, careerId: string | null, mode: StageMode): string =>
  `${kind}:${mode === 'career' && careerId !== null ? careerId : 'practice'}`
