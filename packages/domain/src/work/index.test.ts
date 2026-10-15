// `@racer/domain/work` and `@racer/domain/farm` export T127's contract (docs/game/architecture.md#the-rework-modules).
import { describe, expect, it } from 'vitest'
import * as farm from '../farm/index'
import * as work from './index'

describe('the work and farm entries', () => {
  it('export the engine', () => {
    for (const name of [
      'itemEnds', 'finishedCount', 'endsAt', 'remainingMs', 'progress', 'chainTimes', 'ticketsToFinish', 'applyTickets',
      'settle', 'start', 'queue', 'collect', 'recall', 'speedUp', 'finish', 'upgrade', 'workState', 'freeAt', 'isFree', 'collectBeforeRace',
      'reservedStock', 'newWorkState', 'kindRules',
    ] as const) expect(typeof work[name], name).toBe('function')
    expect(work.SPEED_TICKET_MS).toBe(1_800_000)
    expect(work.SESSION_KIND).toBe('session')
    expect(Object.keys(work.WORK_KINDS)).toEqual(['gather', 'craft', 'cook', 'session'])
    expect(Object.keys(work.WORK_REFUSALS)).toHaveLength(12)
  })

  it('export the Farm', () => {
    for (const name of ['farmExpToNext', 'farmLevel', 'farmExpMultiplier', 'farmExpAtLevel', 'upgradeCost', 'slotsPerRoom', 'farmItemSeconds'] as const) {
      expect(typeof farm[name], name).toBe('function')
    }
    expect(Object.keys(farm.FAMILY_SITE)).toHaveLength(8)
    expect(Object.keys(farm.FAMILY_APTITUDE)).toHaveLength(8)
    expect(farm.BUILDING_IDS).toHaveLength(14)
  })
})
