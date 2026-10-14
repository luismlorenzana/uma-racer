// `@racer/domain/rework/check-in` and `@racer/domain/rework/planner` export T131's contract
// (docs/tasks/M033-rework-rules.md): what T132's check-in and idle-Uma policies call, and what phase 3's screens read.
import { describe, expect, it } from 'vitest'
import * as planner from '../planner/index'
import * as checkIn from './index'

describe('the check-in and planner entries', () => {
  it('export the check-in', () => {
    for (const name of [
      'nextCheckIn', 'sizeChips', 'fitSize', 'chipWords', 'fitWords', 'clockTime', 'setCheckInTimes', 'collectAll', 'readyCount', 'repeat', 'repeatable',
      'setRepeatSizing', 'buyFor', 'restartDropped', 'dismissDropped', 'queueStopped', 'makeThem', 'checkInSummary', 'speedUpAll', 'speedUpAllPlan',
      'runOnce', 'recheck', 'hasBannedWord', 'say', 'fill',
    ] as const) expect(typeof checkIn[name], name).toBe('function')
    expect(checkIn.DEFAULT_CHECK_INS).toEqual([480, 780, 1350])
    expect(checkIn.MAX_CHECK_INS).toBe(4)
    expect(checkIn.BANNED_WORDS).toHaveLength(9)
    expect(Object.keys(checkIn.OPERATIONS)).toHaveLength(24)
  })

  it('export the planner', () => {
    for (const name of [
      'setTargets', 'automaticTargets', 'targetsOf', 'projectWork', 'queueWarnings', 'plan', 'planFrom', 'placeLines', 'facilityLines', 'bestUse',
      'neededFromStock', 'suggest', 'startSuggestions', 'needsFor', 'rosterTotals', 'freeUmas',
    ] as const) expect(typeof planner[name], name).toBe('function')
    expect([planner.MAX_TARGETS, planner.AUTO_TARGETS]).toEqual([5, 5])
  })
})
