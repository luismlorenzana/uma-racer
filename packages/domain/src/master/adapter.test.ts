// Invented master rows only; the numeric track codes are the racer's existing catalogue allowlist, not source rows.
import { syntheticMasterData } from '@luismlorenzana/uma-data/testing'
import { describe, expect, it } from 'vitest'
import { adaptMaster, masterSkills, scenarioCoverage } from './adapter'
import { parseOverlayIndex, parseRacerOverlays } from './overlays'

function fixture() {
  const data = syntheticMasterData()
  data.tracks[0]!.id = 10001
  data.races[0]!.trackId = 10001
  data.courses[0]!.trackId = 10001
  data.outfits.push({ ...structuredClone(data.outfits[0]!), id: 900102, title: { ja: '試作', en: 'Other prototype', global: null } })
  return data
}

describe('the racer master adapter', () => {
  it('keeps ids stable, outfit identity, objective order, five-star stats and Global preference without mutating input', () => {
    const data = fixture(), before = structuredClone(data)
    const result = adaptMaster(data).content
    expect(result.umas).toHaveLength(2)
    expect(result.umas[0]).toMatchObject({ id: '900101', charaId: '9001', outfit: '[Prototype Dress]', baseStats: { speed: 100 }, growthRates: { speed: 0.1 } })
    expect(result.umas[1]).toMatchObject({ id: '900102', charaId: '9001', outfit: 'Other prototype' })
    expect(result.races[0]).toMatchObject({ id: '990101', familyId: '9901', venue: 'Prototype Park', fieldSize: 16, distanceCategory: 'mile' })
    expect(result.courses[0]).toMatchObject({ id: '990011', distance: 2 })
    expect(JSON.stringify(result)).not.toContain('imageSource')
    expect(data).toEqual(before)
  })

  it('keeps SSR effects/rarity, Global event skills, obtain rules and unknown character/track handling', () => {
    const data = fixture()
    data.supportCards.push({ ...structuredClone(data.supportCards[0]!), id: 99002, rarity: 2 })
    data.supportCards[0]!.obtain = 'story_event'
    data.supportCards[0]!.globalEventSkillIds = [990010]
    const card = adaptMaster(data).content.cards[0]!
    expect(card).toMatchObject({ starter: true, obtain: 'event', eventSkillIds: ['990010'], effectProfile: { friendshipBonus: 1 } })
    expect(adaptMaster(data).content.cards).toHaveLength(1)
    data.outfits[0]!.characterId = 9999
    data.races[0]!.trackId = 88888
    const result = adaptMaster(data).content
    expect(result.umas.map((uma) => uma.id)).toEqual(['900102'])
    expect(result.races).toEqual([])
  })

  it('preserves Global mechanics, inherited unique links, white counterparts and excludes evolved skills', () => {
    const data = fixture()
    const unique = data.skills[0]!, inherited = data.skills[1]!, gold = data.skills[3]!
    unique.globalConditionGroups = [{ ...structuredClone(unique.conditionGroups[0]!), condition: 'running_style==1' }]
    inherited.globalIconId = 777
    inherited.rarity = 6 // A gene is retained by its non-evolved parent, not by its own rarity.
    gold.description.global = 'Leader and Chaser'
    const skills = new Map(masterSkills(data.skills).map((skill) => [skill.id, skill]))
    expect(skills.get('990001')).toMatchObject({ inheritedSkillId: '990002', conditions: [{ condition: 'running_style==1' }] })
    expect(skills.get('990002')).toMatchObject({ kind: 'inherited-unique', iconId: 777, inheritedSkillId: null })
    expect(skills.get('990020')).toMatchObject({ normalSkillId: '990010', description: 'Pace Chaser and End Closer' })
    expect(skills.has('990030')).toBe(false)
    inherited.parentSkillIds = [123456]
    expect(masterSkills(data.skills).some((skill) => skill.id === '990002')).toBe(false)
  })

  it('drops unsupported race grades and new international tracks rather than changing the regular catalogue', () => {
    const data = fixture()
    data.races.push({ ...structuredClone(data.races[0]!), id: 990102, grade: 999 })
    data.tracks.push({ id: 88999, name: 'Invented Overseas', courseIds: [] })
    data.races.push({ ...structuredClone(data.races[0]!), id: 990103, trackId: 88999 })
    expect(adaptMaster(data).content.races.map((race) => race.id)).toEqual(['990101'])
  })

  it('maps scenario art by release date and reports freshness without private row names', () => {
    const data = fixture()
    data.scenarios[0]!.startsAt.jp = '2021-02-24T00:00:00.000Z'
    expect(adaptMaster(data).scenarioIds.get('99')).toBe('ura-finale')
    expect(scenarioCoverage(data, '2099-01-01')).toBeNull()
  })
})

describe('private overlay envelopes', () => {
  it('requires both authored inputs, and a bounded hash-named immutable file', () => {
    expect(() => parseRacerOverlays({ schema: 1, flair: null, cardFocus: {} })).toThrow()
    expect(parseRacerOverlays({ schema: 1, flair: {}, cardFocus: {} }).schema).toBe(1)
    const sha256 = 'a'.repeat(64)
    const index = { version: sha256.slice(0, 12), file: { path: `overlays/racer.${sha256.slice(0, 16)}.json`, bytes: 99, sha256 } }
    expect(parseOverlayIndex(index)).toEqual(index)
    for (const path of ['../secret.json', 'overrides/card-focus.json', 'overlays/racer.bbbbbbbbbbbbbbbb.json']) {
      expect(() => parseOverlayIndex({ ...index, file: { ...index.file, path } })).toThrow()
    }
  })
})
