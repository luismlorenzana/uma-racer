// Shared shapes for the rework's rules (docs/tasks/M033-rework-rules.md). T125 completes the state skeleton here
// (docs/rework/13-removals-and-plan-changes.md §6); each later task adds its own part.

/** A refused operation: a stable code and plain words the screen shows, with `{name}` placeholders filled from data. */
export interface Refusal {
  readonly refused: true
  readonly code: string
  /** Plain words, never protocol names (docs/rework/02-check-ins-and-notifications.md §9). */
  readonly reason: string
  readonly data?: Readonly<Record<string, string | number>>
}

export const refuse = (code: string, reason: string, data?: Refusal['data']): Refusal =>
  data ? { refused: true, code, reason, data } : { refused: true, code, reason }

export const isRefusal = (value: unknown): value is Refusal =>
  typeof value === 'object' && value !== null && (value as { refused?: unknown }).refused === true

/** Tier 1–3 (D327). */
export type Tier = 1 | 2 | 3
/** Scenario 1–5 of a tier. */
export type ScenarioOfTier = 1 | 2 | 3 | 4 | 5

/** Where an Uma is: scenario *s* of tier *t* is the game's scenario T = 5(t − 1) + s. */
export interface ScenarioAt {
  readonly tier: Tier
  readonly scenario: ScenarioOfTier
}
