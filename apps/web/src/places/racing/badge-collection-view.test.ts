import { emptySubject } from './__fixtures__/save'
import {
  createUmaBadgeState,
  createUmaSave,
  evaluateUmaFlair,
  buildUmaFlairCatalog,
  type ContentAtlas,
  type RaceTemplate,
  type RaceResultRecord,
  type UmaBadgeStateV1,
  type UmaTemplate,
} from '@racer/domain'
import { describe, expect, it } from 'vitest'
import type { LoadedContent } from '../../content/view'
import {
  buildStableBadgeCollection,
  buildTimelineItems,
  buildTrophyWall,
  buildUmaBadgeCollection,
  filterBadgeItems,
  parseBadgeRoute,
  resolveBadgeUmaId,
  serializeBadgeRoute,
  sortBadgeItems,
} from './badge-collection-view'

const uma = (id: string, name: string): UmaTemplate => ({
  id, charaId: `character-${id}`, name, outfit: null, jpRelease: '2000-01-01', globalRelease: null, starter: false,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: { surface: { turf: 'A', dirt: 'B' }, distance: { sprint: 'A', mile: 'A', medium: 'A', long: 'A' }, strategy: { front: 'A', pace: 'A', late: 'A', end: 'A' } },
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [],
})
const race: RaceTemplate = {
  id: 'synthetic-race', familyId: 'synthetic-family', name: 'Synthetic Grand Prix', grade: 'g1', surface: 'turf',
  distance: 2_000, distanceCategory: 'medium', direction: 'right', venue: 'Synthetic Park', venueKey: 'synthetic-park',
  venueTags: ['jra-main'], series: [], seriesLegs: [], courseId: 'synthetic-course', season: 1, fieldSize: 12,
}
const result = (sequence: number): RaceResultRecord => ({
  contentVersion: 'synthetic', umaId: 'alpha', raceId: race.id, sequence, seed: sequence, strategy: 'pace',
  startLevel: 1, startExp: 0, startStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 }, raceBonus: 0,
  playerPlacement: 1, expGained: 1, levelsGained: [], shardReward: 0, field: [{
    umaId: 'alpha', isPlayer: true, strategy: 'pace', gate: 1,
    stats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
    aptitude: { distance: 'A', surface: 'A', strategy: 'A' }, placement: 1, finishTime: 100, marginLengths: 0,
  }], createdAt: 100 + sequence,
})

function content(umas: UmaTemplate[]): LoadedContent {
  const atlas = (kind: ContentAtlas['kind']): ContentAtlas => ({
    schemaVersion: 1, kind, frameWidth: 128, frameHeight: 128, pages: [{ path: `${kind}.webp`, width: 128, height: 128 }], frames: {},
  })
  return {
    manifest: { version: 'synthetic' }, origin: 'network',
    umas: { items: umas, byId: new Map(umas.map((entry) => [entry.id, entry])) }, cards: { items: [], byId: new Map() },
    skills: { items: [], byId: new Map() }, races: { items: [race], byId: new Map([[race.id, race]]) },
    art: { has: () => false, load: async () => null },
    courses: { items: [], byId: new Map() }, atlases: {
      'uma-icons': { descriptor: atlas('uma-icons'), pageUrls: [] }, 'card-icons': { descriptor: atlas('card-icons'), pageUrls: [] },
    },
  }
}

function winningState(template: UmaTemplate, wins: number, at: number): { state: UmaBadgeStateV1; events: ReturnType<typeof eventRows> } {
  const base = createUmaBadgeState(createUmaSave(template), emptySubject(), 1)
  const facts = { ...base, sourceWatermarks: { ...base.sourceWatermarks, raceSequence: wins - 1 }, facts: { ...base.facts, starts: wins, wins } }
  const evaluated = evaluateUmaFlair(buildUmaFlairCatalog({ state: facts, races: [race] }), facts, {
    source: { kind: 'race', id: `race:${template.id}:0`, tier: 1 }, earnedAt: at, retroactive: false,
  })
  return { state: evaluated.state, events: eventRows(evaluated.events) }
}

function eventRows(rows: ReturnType<typeof evaluateUmaFlair>['events']) {
  return rows.map((row) => ({ id: row.id, ...row.data }))
}

describe('Badge collection projections', () => {
  it('projects truthful progress, hides secret text, searches safely, and keeps deterministic sort ties', () => {
    const template = uma('alpha', 'Alpha Runner')
    const loaded = content([template])
    const won = winningState(template, 1, 100)
    const view = buildUmaBadgeCollection(loaded, won.state, won.events)
    expect(view.items.find((item) => item.awardKey === 'badge:winner')).toMatchObject({ tier: 'bronze', status: 'progress', earnedAt: 100 })
    expect(view.items.some((item) => item.awardKey === 'badge:impossible-ground')).toBe(false)
    expect(filterBadgeItems(view.items, 'impossible ground', [])).toEqual([])
    expect(filterBadgeItems(view.items, '', [{ kind: 'category', value: 'victories' }, { kind: 'status', value: 'earned' }])
      .map((item) => item.awardKey)).toContain('badge:winner')
    const alphabetical = sortBadgeItems(view.items, 'alphabetical')
    expect(alphabetical).toEqual([...alphabetical].sort((left, right) => left.label.localeCompare(right.label) || left.awardKey.localeCompare(right.awardKey)))
    expect(sortBadgeItems(view.items, 'closest')[0]?.nextThreshold).not.toBeNull()
  })

  it('aggregates Stable holders, rarity, highest tier, and excludes invalid owned entities', () => {
    const alpha = uma('alpha', 'Alpha Runner')
    const beta = uma('beta', 'Beta Runner')
    const loaded = content([alpha, beta])
    const first = winningState(alpha, 1, 100)
    const second = winningState(beta, 10, 200)
    const stable = buildStableBadgeCollection(loaded, [
      { save: createUmaSave(alpha), state: first.state },
      { save: createUmaSave(beta), state: second.state },
      { save: createUmaSave(uma('orphan', 'Orphan')), state: null },
    ], [...first.events, ...second.events])
    expect(stable).toMatchObject({ ownedUmaCount: 2, orphanedUmaIds: ['orphan'] })
    expect(stable.items.find((item) => item.awardKey === 'badge:winner')).toMatchObject({ holderCount: 2, ownedUmaCount: 2, tier: 'silver', rarityPercent: 100, rarity: 'common' })
    const oneHolder = stable.items.find((item) => item.awardKey === 'badge:g1-champion')
    expect(oneHolder?.holderCount).toBe(0)
    expect(sortBadgeItems(stable.items, 'rarest').at(-1)?.rarityPercent).toBeGreaterThanOrEqual(sortBadgeItems(stable.items, 'rarest')[0]!.rarityPercent)
  })

  it('preserves missing earned refs and builds safe trophy/timeline source links', () => {
    const template = uma('alpha', 'Alpha Runner')
    const loaded = content([template])
    const won = winningState(template, 1, 100)
    const state: UmaBadgeStateV1 = {
      ...won.state,
      awards: { ...won.state.awards, trophies: [{ familyId: 'synthetic-family', count: 2, firstEarnedAt: 100, lastEarnedAt: 200,
        firstResultId: 'race:alpha:0', lastResultId: 'race:alpha:1' }], badges: [...won.state.awards.badges, {
        awardKey: 'badge:removed-content', stage: 'one-off', earnedAt: 90, history: 'exact', source: { kind: 'migration', id: null, tier: null }, frozenKeys: [],
      }] },
      preferences: { ...won.state.preferences, showcaseGroups: [{ id: 'default', name: null, awardRefs: ['badge:removed-content'] }] },
    }
    // Each record carries its `raceResults` row's id, which the live run route plays.
    const history = [result(0), result(1)].map((record) => ({ ...record, resultId: `op-alpha-${record.sequence}` }))
    const view = buildUmaBadgeCollection(loaded, state, won.events, history)
    expect(view.items.find((item) => item.awardKey === 'badge:removed-content')).toMatchObject({ status: 'missing', pinned: true })
    expect(buildTrophyWall(loaded, state, history)[0]).toMatchObject({ label: 'Synthetic Grand Prix', count: 2, lastSource: { to: '/racing/racecourse/run?result=op-alpha-1' } })
    expect(buildTimelineItems(loaded, state, won.events, history)[0]).toMatchObject({ source: { to: '/racing/racecourse/run?result=op-alpha-0' } })
    // A goal's or a scenario's flair opens her profile on its live route, whose Overview holds her career's goals.
    const sourced = (source: { kind: 'goal' | 'scenario'; id: string; tier: number }) =>
      buildTimelineItems(loaded, state, [{ ...won.events[0]!, source }], history)[0]!.source
    expect(sourced({ kind: 'goal', id: 'goal:alpha:1', tier: 1 })).toMatchObject({ to: '/town/stable/outfit/alpha' })
    expect(sourced({ kind: 'scenario', id: 'scenario:alpha:1', tier: 1 })).toMatchObject({ to: '/town/stable/outfit/alpha' })
  })

  it('round-trips valid URL state, reports rejected values, and resolves an owned fallback', () => {
    const parsed = parseBadgeRoute('?scope=stable&uma=alpha&q=winner&filter=category%3Dvictories&filter=rarity%3Drare&sort=rarest&detail=badge%3Awinner', new Set(['alpha']))
    expect(parsed).toMatchObject({ scope: 'stable', umaId: 'alpha', query: 'winner', sort: 'rarest', detail: 'badge:winner', unavailable: [] })
    expect(parseBadgeRoute(serializeBadgeRoute(parsed), new Set(['alpha']))).toEqual(parsed)
    expect(parseBadgeRoute('?scope=uma&filter=rarity%3Drare&sort=rarest&uma=missing', new Set(['alpha'])).unavailable).toEqual(expect.arrayContaining(['rarity:rare', 'sort:rarest', 'uma:missing']))
    expect(resolveBadgeUmaId('missing', ['beta', 'alpha'], 'beta')).toBe('beta')
    // Otherwise the first in the caller's order, which is highest level first (D181).
    expect(resolveBadgeUmaId(null, ['beta', 'alpha'], null)).toBe('beta')
    const trainer = parseBadgeRoute('?scope=trainer&filter=category%3Dcollection&filter=surface%3Dturf&filter=rarity%3Drare&sort=rarest', new Set(['alpha']))
    expect(trainer).toMatchObject({ scope: 'trainer', sort: 'recent', filters: [{ kind: 'category', value: 'collection' }] })
    expect(trainer.unavailable).toEqual(expect.arrayContaining(['surface:turf', 'rarity:rare', 'sort:rarest']))
  })
})
