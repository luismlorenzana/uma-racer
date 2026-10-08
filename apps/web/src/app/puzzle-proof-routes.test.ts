import { describe, expect, it } from 'vitest'
import { isDevPuzzleProofPath } from './puzzle-proof-routes'
describe('DEV Puzzle account isolation', () => {
  it('isolates each existing synthetic proof and its nested cases', () => {
    for (const path of ['/dev/puzzles-ui-proof', '/dev/puzzles-battle-proof/pressure', '/dev/puzzles-practice',
      '/dev/puzzles-preservation-proof', '/dev/puzzles-material-icons']) expect(isDevPuzzleProofPath(path)).toBe(true)
  })
  it('never treats ordinary account or similar-looking routes as proofs', () => {
    for (const path of ['/', '/puzzles', '/puzzles/content', '/rpg', '/dev/puzzles-preservation-proof-extra',
      '/dev/puzzles-ui-proof-not-isolated', '/something/dev/puzzles-preservation-proof']) expect(isDevPuzzleProofPath(path)).toBe(false)
  })
})
