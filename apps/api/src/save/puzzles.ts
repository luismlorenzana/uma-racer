// Self-contained CommonJS adapter, checked byte-for-byte against pure rules; see implementation §3.
export * from './puzzle-domain/minigames/uma-puzzles/records'
export * from './puzzle-domain/minigames/uma-puzzles/operations'
export * from './puzzle-domain/minigames/uma-puzzles/preservation'
export * from './puzzle-domain/minigames/uma-puzzles/preservation-records'
export * from './puzzle-domain/minigames/uma-puzzles/legacy-spark'
/** T116/D289 enables the verified-content/protected-preservation release; account guards still apply. */
export const PUZZLES_RELEASE_ENABLED = true
