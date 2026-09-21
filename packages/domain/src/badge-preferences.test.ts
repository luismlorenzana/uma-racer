import { subject } from './__fixtures__/subject'
import { describe, expect, it } from 'vitest'
import {
  createTrainerBadgeState,
  createUmaBadgeState,
  createUmaSave,
  decodeBadgeFilters,
  encodeBadgeFilters,
  flattenShowcase,
  moveItem,
  moveShowcaseRefs,
  parseBadgeState,
  rebaseBadgePreferences,
  removeShowcaseGroup,
  stableBadgeRarity,
  TRAINER_SAVED_VIEW_ID_PREFIX,
  replaceTrainerPreferences,
  replaceUmaPreferences,
  type UmaTemplate,
} from './index'

const template: UmaTemplate = {
  id: 'synthetic-badge-uma', charaId: 'synthetic-badge-character', name: 'Synthetic Badge Runner', outfit: null,
  jpRelease: '2000-01-01', globalRelease: null, starter: false,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: {
    surface: { turf: 'A', dirt: 'B' },
    distance: { sprint: 'A', mile: 'A', medium: 'A', long: 'A' },
    strategy: { front: 'A', pace: 'A', late: 'A', end: 'A' },
  },
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [],
  imageSource: 'https://invalid.test/synthetic-badge.png',
}

function awardedState() {
  const state = createUmaBadgeState(createUmaSave(template), subject(), 1)
  return {
    ...state,
    awards: {
      ...state.awards,
      badges: [{
        awardKey: 'badge:winner', stage: 'bronze' as const, earnedAt: 2, history: 'exact' as const,
        source: { kind: 'race' as const, id: 'race:synthetic-badge-uma:0', tier: 1 }, frozenKeys: [],
      }],
      titles: [{
        awardKey: 'title:synthetic', earnedAt: 3, history: 'exact' as const,
        source: { kind: 'race' as const, id: 'race:synthetic-badge-uma:0', tier: 1 }, frozenKeys: [],
      }],
    },
  }
}

describe('badge filter persistence', () => {
  it('round-trips typed filters in stable order and rejects unknown, duplicate, and malformed rows', () => {
    const encoded = encodeBadgeFilters([
      { kind: 'status', value: 'earned' },
      { kind: 'earned-after', value: 100 },
      { kind: 'category', value: 'victories' },
    ])
    expect(encoded.map((row) => row.key)).toEqual(['category:victories', 'earned-after', 'status:earned'])
    expect(decodeBadgeFilters(encoded)).toEqual([
      { kind: 'category', value: 'victories' },
      { kind: 'earned-after', value: 100 },
      { kind: 'status', value: 'earned' },
    ])
    expect(() => encodeBadgeFilters([{ kind: 'status', value: 'earned' }, { kind: 'status', value: 'locked' }])).toThrow(/duplicate/)
    expect(decodeBadgeFilters([{ key: 'status:anything', count: 1 }])).toBeNull()
    expect(decodeBadgeFilters([{ key: 'category:victories', count: 2 }])).toBeNull()
    const trainer = createTrainerBadgeState(1)
    expect(parseBadgeState({ ...trainer, preferences: { ...trainer.preferences, savedViews: [{
      id: 'bad', name: 'Bad', filters: [{ key: 'status:anything', count: 1 }], sort: 'recent',
    }] } })).toBeNull()
  })

  it('pins local Stable rarity buckets at universal, partial, minority, and unique/unheld', () => {
    expect(stableBadgeRarity(8, 8)).toBe('common')
    expect(stableBadgeRarity(4, 8)).toBe('uncommon')
    expect(stableBadgeRarity(2, 8)).toBe('rare')
    expect(stableBadgeRarity(1, 8)).toBe('elite')
    expect(stableBadgeRarity(0, 8)).toBe('elite')
  })
})

describe('badge preference mutations', () => {
  it('validates earned title and pins, normalizes names, and leaves award truth untouched', () => {
    const state = awardedState()
    const next = replaceUmaPreferences(state, {
      activeTitleId: 'title:synthetic',
      showcaseGroups: [
        { id: 'default', name: null, awardRefs: ['badge:winner'] },
        { id: 'favorites', name: '  Favorites  ', awardRefs: ['title:synthetic'] },
      ],
      savedViews: [{ id: 'wins', name: '  Wins  ', filters: encodeBadgeFilters([{ kind: 'category', value: 'victories' }]), sort: 'tier' }],
    })
    expect(next.awards).toEqual(state.awards)
    expect(next.preferences.activeTitleId).toBe('title:synthetic')
    expect(next.preferences.showcaseGroups[1]?.name).toBe('Favorites')
    expect(next.preferences.savedViews[0]?.name).toBe('Wins')
    expect(flattenShowcase(next.preferences.showcaseGroups)).toEqual(['badge:winner', 'title:synthetic'])
    expect(() => replaceUmaPreferences(state, { ...next.preferences, activeTitleId: 'title:unearned' })).toThrow(/earned/)
    expect(() => replaceUmaPreferences(state, {
      ...next.preferences,
      showcaseGroups: [{ id: 'default', name: null, awardRefs: ['badge:unearned'] }],
    })).toThrow(/not earned/)
  })

  it('moves/reorders pins deterministically and deletes a named group with either behavior', () => {
    const groups = [
      { id: 'default', name: null, awardRefs: ['a', 'b'] },
      { id: 'later', name: 'Later', awardRefs: ['c', 'd'] },
    ]
    expect(moveShowcaseRefs(groups, ['d', 'b'], 'default')).toEqual([
      { id: 'default', name: null, awardRefs: ['a', 'b', 'd'] },
      { id: 'later', name: 'Later', awardRefs: ['c'] },
    ])
    expect(removeShowcaseGroup(groups, 'later', 'move-to-default')[0]?.awardRefs).toEqual(['a', 'b', 'c', 'd'])
    expect(removeShowcaseGroup(groups, 'later', 'unpin')[0]?.awardRefs).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  })

  it('rebases local preferences onto newer server award truth and drops invalid refs', () => {
    const original = awardedState()
    const local = replaceUmaPreferences(original, {
      activeTitleId: 'title:synthetic',
      showcaseGroups: [{ id: 'default', name: null, awardRefs: ['badge:winner', 'title:synthetic'] }],
      savedViews: [{ id: 'earned', name: 'Earned', filters: encodeBadgeFilters([{ kind: 'status', value: 'earned' }]), sort: 'recent' }],
    })
    const server = { ...original, awards: { ...original.awards, titles: [] } }
    const rebased = rebaseBadgePreferences(server, local)
    expect(rebased.awards).toEqual(server.awards)
    expect(rebased.preferences.activeTitleId).toBeNull()
    expect(rebased.preferences.showcaseGroups[0]?.awardRefs).toEqual(['badge:winner'])
    expect(rebased.preferences.savedViews).toEqual(local.preferences.savedViews)
  })

  it('supports the trainer saved-view shell without creating achievements', () => {
    const state = createTrainerBadgeState(10)
    const next = replaceTrainerPreferences(state, {
      activeTitleId: null,
      showcaseGroups: [{ id: 'default', name: null, awardRefs: [] }],
      savedViews: [{ id: 'rare', name: 'Rare', filters: encodeBadgeFilters([{ kind: 'rarity', value: 'rare' }]), sort: 'rarest' }],
    })
    expect(next.awards.achievements).toEqual([])
    expect(next.preferences.savedViews[0]?.name).toBe('Rare')
    expect(next.preferences.displayName).toBe('Trainer')
  })

  it('keeps up to twenty Stable and Trainer saved views in separate namespaces', () => {
    const state = createTrainerBadgeState(10)
    const makeView = (id: string, name: string) => ({ id, name, filters: [], sort: 'recent' as const })
    const savedViews = [
      ...Array.from({ length: 20 }, (_, index) => makeView(`view-${index}`, `View ${index}`)),
      ...Array.from({ length: 20 }, (_, index) => makeView(`${TRAINER_SAVED_VIEW_ID_PREFIX}${index}`, `View ${index}`)),
    ]
    const next = replaceTrainerPreferences(state, { ...state.preferences, savedViews })
    expect(parseBadgeState(next)?.preferences.savedViews).toHaveLength(40)
    expect(() => replaceTrainerPreferences(state, {
      ...state.preferences,
      savedViews: [...savedViews, makeView(`${TRAINER_SAVED_VIEW_ID_PREFIX}overflow`, 'Overflow')],
    })).toThrow(/limit/)
  })
})
