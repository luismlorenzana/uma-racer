import 'fake-indexeddb/auto'

import {
  createUmaBadgeState,
  createUmaSave,
  encodeBadgeFilters,
  replaceUmaPreferences,
  type EntityRecord,
  type UmaBadgeStateV1,
  type UmaTemplate,
} from '@racer/domain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  bootstrapTrainerBadgeState,
  pageMemoryFlairTimeline,
  persistBadgePreferences,
  readFlairTimelinePage,
  replaceMemoryBadgePreferences,
} from './badge-preferences'
import { putConflict } from './persistence'

const template: UmaTemplate = {
  id: 'synthetic-preference-uma', charaId: 'synthetic-preference-character', name: 'Preference Runner', outfit: null,
  jpRelease: '2000-01-01', globalRelease: null, starter: false,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: { surface: { turf: 'A', dirt: 'B' }, distance: { sprint: 'A', mile: 'A', medium: 'A', long: 'A' }, strategy: { front: 'A', pace: 'A', late: 'A', end: 'A' } },
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [], imageSource: 'https://invalid.test/preference.png',
}

function awardedState(): UmaBadgeStateV1 {
  const state = createUmaBadgeState(createUmaSave(template), 1)
  return { ...state, awards: { ...state.awards, badges: [{
    awardKey: 'badge:winner', stage: 'bronze', earnedAt: 2, history: 'exact',
    source: { kind: 'race', id: 'race:synthetic-preference-uma:0', tier: 1 }, frozenKeys: [],
  }] } }
}

async function resetDatabase() {
  db.close()
  await db.delete()
  await db.open()
}

describe('Badge preference persistence', () => {
  beforeEach(resetDatabase)
  afterEach(async () => { db.close(); await db.delete() })

  it('bootstraps the trainer shell once and persists one coalesced preference write', async () => {
    expect(await bootstrapTrainerBadgeState(10)).toBe(true)
    expect(await bootstrapTrainerBadgeState(11)).toBe(false)
    const trainer = await db.badges.get('trainer')
    expect(trainer?.data).toMatchObject({ scope: 'trainer', awards: { achievements: [] } })
    expect(await db.outbox.where('[kind+id]').equals(['badges', 'trainer']).count()).toBe(1)
    await db.outbox.clear()
    if (!trainer || trainer.data.scope !== 'trainer') throw new Error('Trainer missing')
    const desired = { ...trainer.data.preferences, savedViews: [{
      id: 'rare', name: 'Rare', filters: encodeBadgeFilters([{ kind: 'rarity', value: 'rare' }]), sort: 'rarest' as const,
    }] }
    await expect(persistBadgePreferences('trainer', desired, 12)).resolves.toMatchObject({ changed: true })
    expect(await db.outbox.where('[kind+id]').equals(['badges', 'trainer']).count()).toBe(1)
    await expect(persistBadgePreferences('trainer', desired, 13)).resolves.toMatchObject({ changed: false })
    expect((await db.outbox.where('[kind+id]').equals(['badges', 'trainer']).first())?.queuedAt).toBe(12)
  })

  it('re-reads ownership/award truth atomically and rejects stale or corrupt preferences', async () => {
    const save = createUmaSave(template)
    const state = awardedState()
    await db.umas.put({ id: save.templateId, data: save, version: 0 })
    await db.badges.put({ id: `uma:${save.templateId}`, data: state, version: 3 })
    const desired = { ...state.preferences, showcaseGroups: [{ id: 'default', name: null, awardRefs: ['badge:winner'] }] }
    const result = await persistBadgePreferences(`uma:${save.templateId}`, desired, 20)
    expect(result).toMatchObject({ changed: true, state: { awards: state.awards } })
    expect((await db.badges.get(`uma:${save.templateId}`))?.version).toBe(3)
    await expect(persistBadgePreferences(`uma:${save.templateId}`, {
      ...desired, showcaseGroups: [{ id: 'default', name: null, awardRefs: ['badge:not-earned'] }],
    }, 21)).rejects.toThrow(/not earned/)
    await db.umas.delete(save.templateId)
    await expect(persistBadgePreferences(`uma:${save.templateId}`, desired, 22)).rejects.toThrow(/not owned/)
  })

  it('rebases preferences over newer server facts and queues the preserved preference', async () => {
    const state = awardedState()
    const local = replaceUmaPreferences(state, { ...state.preferences,
      showcaseGroups: [{ id: 'default', name: null, awardRefs: ['badge:winner'] }] })
    await db.badges.put({ id: `uma:${template.id}`, data: local, version: 1 })
    const server: UmaBadgeStateV1 = { ...state, sourceWatermarks: { ...state.sourceWatermarks, raceSequence: 9 },
      facts: { ...state.facts, wins: 10, starts: 10 }, awards: { ...state.awards,
      badges: [...state.awards.badges, { ...state.awards.badges[0]!, stage: 'silver', earnedAt: 30 }] } }
    const conflict: EntityRecord = { kind: 'badges', id: `uma:${template.id}`, version: 4, updatedAt: 35, deleted: false, data: server as unknown as Record<string, unknown> }
    await putConflict(conflict, false, 40)
    const saved = await db.badges.get(`uma:${template.id}`)
    expect(saved).toMatchObject({ version: 4, data: { facts: { wins: 10 }, preferences: { showcaseGroups: [{ awardRefs: ['badge:winner'] }] } } })
    expect(await db.outbox.where('[kind+id]').equals(['badges', `uma:${template.id}`]).count()).toBe(1)
  })

  it('paginates one Uma timeline identically in IndexedDB and memory', async () => {
    const rows = [3, 2, 1].map((earnedAt) => ({
      id: `flair-${earnedAt}`, createdAt: earnedAt, data: {
        version: 1 as const, scope: 'uma' as const, umaId: template.id, kind: earnedAt === 2 ? 'title' as const : 'badge-tier' as const,
        awardKey: `badge:synthetic-${earnedAt}`, stage: 'bronze' as const, earnedAt,
        source: { kind: 'migration' as const, id: null, tier: null }, retroactive: true,
      },
    }))
    await db.flairEvents.bulkAdd([...rows, { ...rows[0]!, id: 'other', data: { ...rows[0]!.data, umaId: 'other' } }])
    const all = rows.map((row) => ({ id: row.id, ...row.data }))
    const diskFirst = await readFlairTimelinePage(template.id, null, null, 2)
    const memoryFirst = pageMemoryFlairTimeline(all, template.id, null, null, 2)
    expect(diskFirst).toEqual(memoryFirst)
    expect((await readFlairTimelinePage(template.id, diskFirst.nextCursor, null, 2)).items.map((row) => row.id)).toEqual(['flair-1'])
    expect((await readFlairTimelinePage(template.id, null, 'title', 10)).items.map((row) => row.id)).toEqual(['flair-2'])
  })

  it('allows validated memory-only edits without mutating the original object', () => {
    const state = awardedState()
    const desired = { ...state.preferences, showcaseGroups: [{ id: 'default', name: null, awardRefs: ['badge:winner'] }] }
    const result = replaceMemoryBadgePreferences(state, desired)
    expect(result.changed).toBe(true)
    expect(state.preferences.showcaseGroups[0]?.awardRefs).toEqual([])
    expect(result.state.preferences.showcaseGroups[0]?.awardRefs).toEqual(['badge:winner'])
  })
})
