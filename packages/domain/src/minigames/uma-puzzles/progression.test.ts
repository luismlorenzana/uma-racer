import { describe, expect, it } from 'vitest'
import { addPuzzleExp, nextPuzzleLevelExp, parsePuzzleProgress, puzzleBattleExp, puzzleLevelChanges, puzzleStats, puzzleWinExp } from './progression'
import { puzzleError, syntheticPuzzleSource } from './test-fixtures'

describe('independent lifetime Puzzle progression', () => {
  it('projects PL1 and fractional growth exactly, without racing stats', () => {
    const source = syntheticPuzzleSource()
    expect(puzzleStats(source, 1)).toEqual({ atk: 101, hp: 812, rcv: 57, guard: 4, resilience: 2 })
    expect(puzzleStats(source, 6)).toEqual({ atk: 173, hp: 1010, rcv: 78, guard: 5, resilience: 4 })
    expect(nextPuzzleLevelExp(1)).toBe(100)
    expect(nextPuzzleLevelExp(50)).toBe(590)
    expect(nextPuzzleLevelExp(141)).toBe(1500)
  })
  it('carries exact thresholds and multiple levels; no level 50/140 reset', () => {
    const source = syntheticPuzzleSource()
    expect(addPuzzleExp(source, { level: 1, exp: 99 }, 0).after).toEqual({ level: 1, exp: 99 })
    expect(addPuzzleExp(source, { level: 1, exp: 99 }, 1).after).toEqual({ level: 2, exp: 0 })
    const gain = addPuzzleExp(source, { level: 1, exp: 50 }, 300)
    expect(gain.after).toEqual({ level: 4, exp: 20 })
    expect(gain.levelRange).toEqual({ first: 2, last: 4 })
    for (const level of [50, 140, 1000]) expect(addPuzzleExp(source, { level, exp: 7 }, nextPuzzleLevelExp(level)).after).toEqual({ level: level + 1, exp: 7 })
  })
  it('matches a simple carry oracle across levels and grants', () => {
    const source = syntheticPuzzleSource()
    for (const start of [1, 49, 140, 501]) for (const grant of [0, 99, 100, 3210, 98765]) {
      let level = start, exp = 13 + grant
      while (exp >= nextPuzzleLevelExp(level)) { exp -= nextPuzzleLevelExp(level); level++ }
      expect(addPuzzleExp(source, { level: start, exp: 13 }, grant).after).toEqual({ level, exp })
    }
  })
  it('makes every crossed level/stat delta available in bounded pages', () => {
    const source = syntheticPuzzleSource(), gain = addPuzzleExp(source, { level: 1, exp: 0 }, 1100)
    const first = puzzleLevelChanges(source, gain, 0, 3), second = puzzleLevelChanges(source, gain, first.nextOffset!, 3)
    const all = [...first.changes, ...second.changes, ...puzzleLevelChanges(source, gain, second.nextOffset!, 3).changes]
    expect(all.map(c => c.level)).toEqual(Array.from({ length: gain.levelsGained }, (_, i) => i + 2))
    for (const c of all) for (const stat of ['atk', 'hp', 'rcv', 'guard', 'resilience'] as const)
      expect(c.delta[stat]).toBe(puzzleStats(source, c.level)[stat] - puzzleStats(source, c.level - 1)[stat])
    for (const stat of ['atk', 'hp', 'rcv', 'guard', 'resilience'] as const)
      expect(all.reduce((sum, c) => sum + c.delta[stat], 0)).toBe(gain.statDelta[stat])
    const huge = addPuzzleExp(source, { level: 1, exp: 0 }, Number.MAX_SAFE_INTEGER)
    expect(huge.after.level).toBeGreaterThan(1_000_000)
    expect(puzzleLevelChanges(source, huge).changes).toHaveLength(256)
    expect(puzzleLevelChanges(source, huge, huge.levelsGained - 1).nextOffset).toBeNull()
    puzzleError(() => puzzleLevelChanges(source, gain, 0, 257), 'invalid')
    puzzleError(() => puzzleLevelChanges(source, gain, gain.levelsGained + 1), 'invalid')
  })
  it('uses authored encounter and frozen entrant levels with floor/cap and zero loss rewards', () => {
    expect(puzzleWinExp(10, 10, 'ordinary')).toBe(95)
    expect(puzzleWinExp(10, 10, 'guardian')).toBe(190)
    expect(puzzleWinExp(10, 10, 'champion')).toBe(380)
    expect(puzzleWinExp(10, 1, 'ordinary')).toBe(181)
    expect(puzzleWinExp(20, 1, 'ordinary')).toBe(290)
    expect(puzzleWinExp(1, 100, 'ordinary')).toBe(13)
    expect(puzzleBattleExp('loss', 10, 10, 'champion')).toBe(0)
    expect(puzzleBattleExp('abandon', 10, 10, 'champion')).toBe(0)
    const frozenLevel = 10, current = { level: 12, exp: 0 }
    expect(addPuzzleExp(syntheticPuzzleSource(), current, puzzleWinExp(10, frozenLevel, 'ordinary')).gainedExp).toBe(95)
  })
  it('rejects unsafe arithmetic, malformed progress, invalid source and NaN', () => {
    const source = syntheticPuzzleSource()
    for (const p of [{ level: 0, exp: 0 }, { level: 1, exp: 100 }, { level: NaN, exp: 0 }, { level: 1, exp: -1 },
      { level: Number.MAX_SAFE_INTEGER, exp: 0 }, { level: 1, exp: 0, extra: true }]) expect(parsePuzzleProgress(p)).toBeNull()
    puzzleError(() => addPuzzleExp(source, { level: 1, exp: 1 }, Number.MAX_SAFE_INTEGER), 'overflow')
    puzzleError(() => addPuzzleExp(source, { level: 1, exp: 0 }, -1), 'invalid')
    puzzleError(() => nextPuzzleLevelExp(Number.MAX_SAFE_INTEGER), 'overflow')
    puzzleError(() => puzzleStats({ ...source, baseStats: { ...source.baseStats, stamina: Number.MAX_SAFE_INTEGER } }, 1), 'overflow')
    puzzleError(() => puzzleStats({ ...source, baseStats: { ...source.baseStats, power: Number.MAX_SAFE_INTEGER } }, 2), 'overflow')
    puzzleError(() => puzzleWinExp(500_000_000_000_000, 1, 'champion'), 'overflow')
  })
})
