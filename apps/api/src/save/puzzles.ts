// The Puzzle rules, straight from the domain package (built CJS; rearchitecture/08 step 1.1).
export * from '@racer/domain/puzzles/records'
export * from '@racer/domain/puzzles/operations'
export * from '@racer/domain/puzzles/preservation'
export * from '@racer/domain/puzzles/preservation-records'
export * from '@racer/domain/puzzles/legacy-spark'
/** T116/D289 enables the verified-content/protected-preservation release; account guards still apply. */
export const PUZZLES_RELEASE_ENABLED = true
