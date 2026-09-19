import { describe, expect, it } from 'vitest'
import type { RaceTemplate, SkillTemplate, UmaTemplate } from './content'
import {
  grandparentWhitePickCap,
  parentFingerprint,
  projectGrandparents,
  projectParentCandidates,
  projectPinkSparks,
  resolveScenarioInheritance,
  type ScenarioStartSelection,
} from './inheritance'
import { createUmaSave, type ParentSnapshot } from './save'
import { startNewUmaScenario } from './scenario-promotion'

const aptitudes = {
  surface: { turf: 'A', dirt: 'G' },
  distance: { sprint: 'B', mile: 'A', medium: 'B', long: 'C' },
  strategy: { front: 'A', pace: 'B', late: 'C', end: 'D' },
} as const

function template(id: string, charaId = `chara-${id}`): UmaTemplate {
  return {
    id, charaId, name: `Synthetic ${id}`, outfit: null, jpRelease: '2000-01-01', globalRelease: null, starter: true,
    baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
    growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }, aptitudes,
    uniqueSkillId: `unique-${id}`, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [], imageSource: 'https://invalid.test/synthetic.png',
  }
}

function skill(id: string, kind: SkillTemplate['kind']): SkillTemplate {
  return { id, kind, name: `Synthetic ${id}`, description: '', costSp: kind === 'unique' ? null : 100, iconId: null, conditions: [], inheritedSkillId: kind === 'unique' ? `gene-${id.slice(7)}` : null, normalSkillId: null }
}

const templates = [template('child'), template('parent-a'), template('parent-b'), template('parent-b-outfit', 'chara-parent-b'), template('grand-a'), template('grand-b')]
const umaTemplates = new Map(templates.map((item) => [item.id, item]))
const skillRows = [
  ...templates.map((item) => skill(item.uniqueSkillId!, 'unique')),
  ...templates.map((item) => skill(`gene-${item.id}`, 'inherited-unique')),
  ...['white-a', 'white-b', 'white-c', 'white-d', 'white-e'].map((id) => skill(id, 'white')),
]
const skills = new Map(skillRows.map((item) => [item.id, item]))
const races: RaceTemplate[] = [
  ['race-a', 'pre-op', '101'], ['race-b', 'op', '102'], ['race-c', 'g1', '103'],
].map(([id, grade, familyId], index) => ({
  id: id!, familyId: familyId!, name: `Synthetic Race ${index + 1}`, grade: grade as RaceTemplate['grade'],
  surface: 'turf', distance: 1600 + index * 200, distanceCategory: index < 2 ? 'mile' : 'medium',
  direction: 'left', venue: 'Synthetic', venueKey: 'synthetic-venue', venueTags: [], series: [], seriesLegs: [],
  courseId: `course-${index + 1}`, season: 1, fieldSize: 8,
}))

function frozen(id: string, options: Partial<ParentSnapshot> = {}): ParentSnapshot {
  return {
    umaId: id,
    charaId: umaTemplates.get(id)?.charaId ?? `chara-${id}`,
    completedTier: 1,
    takenAt: 10,
    inheritedUniqueSkillId: `gene-${id}`,
    inheritableWhiteSkillIds: [],
    aptitudes,
    parents: [],
    ...options,
  }
}

function owned(id: string, snapshot: ParentSnapshot | null) {
  return { ...createUmaSave(umaTemplates.get(id)!), parentSnapshot: snapshot }
}

describe('parent and grandparent projections', () => {
  it('uses character identity, reports no snapshot, and detects stale fingerprints', () => {
    const child = {
      ...createUmaSave(umaTemplates.get('child')!),
      aptitudes: { ...aptitudes, surface: { ...aptitudes.surface, turf: 'B' as const }, distance: { ...aptitudes.distance, medium: 'C' as const } },
    }
    const parent = frozen('parent-b')
    const rows = projectParentCandidates({
      child,
      childTemplate: umaTemplates.get('child')!,
      ownedUmas: [owned('child', frozen('child')), owned('parent-a', null), owned('parent-b', parent), owned('parent-b-outfit', frozen('parent-b-outfit'))],
      umaTemplates,
      skills,
      selected: [{ ...parentFingerprint(parent), takenAt: 9 }, parentFingerprint(parent)],
    })
    expect(rows.find((row) => row.umaId === 'child')?.issues).toContain('self-character')
    expect(rows.find((row) => row.umaId === 'parent-a')?.issues).toContain('no-snapshot')
    expect(rows.find((row) => row.umaId === 'parent-b')?.issues).toContain('stale-fingerprint')
    expect(rows.find((row) => row.umaId === 'parent-b-outfit')?.issues).toContain('already-selected-character')
  })

  it('excludes circular/closest contributors and deterministically keeps the newest duplicate', () => {
    const oldGrand = frozen('grand-a', { takenAt: 4, completedTier: 3, inheritableWhiteSkillIds: ['white-a'] })
    const newGrand = frozen('grand-a', { takenAt: 8, completedTier: 1, inheritableWhiteSkillIds: ['white-b'] })
    const parentA = frozen('parent-a', { parents: [oldGrand, frozen('child')] })
    const parentB = frozen('parent-b', { parents: [newGrand, { ...frozen('parent-a'), charaId: parentA.charaId }] })
    const projection = projectGrandparents({ childCharaId: 'chara-child', parents: [parentA, parentB], skills, excludedSkillIds: new Set() })
    expect(projection.contributors.find((item) => item.snapshot.umaId === 'child')?.issues).toContain('child-character')
    expect(projection.contributors.find((item) => item.snapshot.umaId === 'parent-a')?.issues).toContain('chosen-parent-character')
    expect(projection.contributors.filter((item) => item.snapshot.charaId === 'chara-grand-a' && item.eligible)).toHaveLength(1)
    expect(projection.whitePool).toEqual([{ skillId: 'white-b', sourceUmaId: 'grand-a' }])
  })

  it('uses ceil half for distinct grandparent whites', () => {
    expect([0, 1, 2, 3, 5].map(grandparentWhitePickCap)).toEqual([0, 1, 1, 2, 3])
  })
})

describe('scenario inheritance', () => {
  it('orders collision precedence and freezes inherited sources', () => {
    const child = {
      ...createUmaSave(umaTemplates.get('child')!),
      aptitudes: { ...aptitudes, surface: { ...aptitudes.surface, turf: 'B' as const }, distance: { ...aptitudes.distance, medium: 'C' as const } },
    }
    const grand = frozen('grand-a', { inheritableWhiteSkillIds: ['white-c', 'white-d'] })
    const parentA = frozen('parent-a', { inheritableWhiteSkillIds: ['white-a', 'white-b'], parents: [grand] })
    const parentB = frozen('parent-b', {
      aptitudes: { ...aptitudes, distance: { ...aptitudes.distance, medium: 'A' } },
      inheritableWhiteSkillIds: ['white-a'], parents: [frozen('grand-b', { inheritableWhiteSkillIds: ['white-e'] })],
    })
    const selection: ScenarioStartSelection = {
      parents: [parentFingerprint(parentA), parentFingerprint(parentB)],
      grandparentUniqueSkillIds: ['gene-grand-a', 'gene-grand-b'],
      grandparentWhiteSkillIds: ['white-c', 'white-d'],
      pinkSparks: ['surface:turf', 'distance:medium'],
    }
    const result = resolveScenarioInheritance({
      child, childTemplate: umaTemplates.get('child')!, ownedUmas: [child, owned('parent-a', parentA), owned('parent-b', parentB)],
      umaTemplates, skills, permanentLibrary: child.skillLibrary, selection,
    })
    expect(result.skillLibrary.map((item) => item.skillId)).toEqual([
      'unique-child', 'gene-parent-a', 'gene-parent-b', 'white-a', 'white-b', 'gene-grand-a', 'gene-grand-b', 'white-c', 'white-d',
    ])
    expect(result.skillLibrary.find((item) => item.skillId === 'white-a')?.sourceId).toBe('parent-a')
    expect(result.skillLibrary.find((item) => item.skillId === 'white-c')).toMatchObject({ origin: 'inherited', sourceId: 'grand-a' })
    expect(result.aptitudes.surface.turf).toBe('A')
    expect(result.aptitudes.distance.medium).toBe('B')
    expect(result.currentParents[0]).not.toBe(parentA)
  })

  it('requires exactly one effective spark per parent and applies choices in order', () => {
    const low = { ...aptitudes, surface: { turf: 'B' as const, dirt: 'G' as const } }
    const parentA = frozen('parent-a', { aptitudes: { ...aptitudes, surface: { turf: 'A', dirt: 'G' } } })
    const parentB = frozen('parent-b', { aptitudes: { ...aptitudes, surface: { turf: 'S', dirt: 'G' } } })
    expect(() => projectPinkSparks(low, [parentA, parentB], [null, null])).toThrow(/requires/)
    const result = projectPinkSparks(low, [parentA, parentB], ['surface:turf', null])
    expect(result.aptitudes.surface.turf).toBe('A')
    expect(result.projections[1]?.options).toEqual([])
  })

  it('starts a new Uma for free without promotion changes', () => {
    const child = createUmaSave(umaTemplates.get('child')!)
    const result = startNewUmaScenario({
      uma: child, umaTemplate: umaTemplates.get('child')!, skills, races, ownedUmas: [child], umaTemplates,
      selection: { parents: [], grandparentUniqueSkillIds: [], grandparentWhiteSkillIds: [], pinkSparks: [] },
    })
    expect(result.uma).toMatchObject({ scenarioStarted: true, level: 1, stats: child.stats, trainingLevel: 1, currentParents: [] })
    expect(result.uma.skillLibrary).toEqual(child.skillLibrary)
    expect(result.uma).toEqual(expect.objectContaining({ scenarioStarted: true }))
  })
})
