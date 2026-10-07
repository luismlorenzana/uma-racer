// Self-contained CommonJS adapter, checked byte-for-byte against pure rules; see implementation §3.
export * from './puzzle-domain/minigames/uma-puzzles/records'
export * from './puzzle-domain/minigames/uma-puzzles/operations'
/** Only T116 may enable this checked-in release capability. Synthetic repository tests inject true. */
export const PUZZLES_RELEASE_ENABLED = false
