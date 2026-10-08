import { describe, expect, it } from 'vitest'
import type { SkillTemplate, UmaTemplate } from './content'
import { cardNodeCap, constellationTemplate, type NodeAssignment } from './constellation'
import { INSPIRATION_SLOTS, inspirationGoldKey } from './inspiration'
import { carryConstellation, carryInspiration, carrySkillLoadout, presetCarrySource, presetPageComplete } from './preset-carry'
import { createScenarioTraining, createUmaSave, scenarioAt, scenarioView, type ScenarioTraining, type UmaSave } from './save'

// Invented Umas, cards and skills only (D288).
const uma = (id: string): UmaTemplate => ({
  id, charaId: `chara-${id}`, name: `Runner ${id}`, outfit: null, jpRelease: '2021-01-01', globalRelease: null, starter: true,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'C', mile: 'A', medium: 'A', long: 'B' },
    strategy: { front: 'A', pace: 'B', late: 'C', end: 'D' } },
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [], imageSource: 'https://invalid.test/uma.png',
})
const child = uma('child')
const parents = ['p0', 'p1', 'g00', 'g01', 'g10', 'g11'].map(uma)
const umas = new Map([child, ...parents].map((entry) => [entry.id, entry]))
const fullInspiration = { slots: [...INSPIRATION_SLOTS], golds: INSPIRATION_SLOTS.flatMap((slot) => [0, 1].map((i) => inspirationGoldKey(slot, i))) }

/** Card nodes in unlock order, each filled per `counts` (card id → nodes), in that order. */
function filled(tier: number, counts: Record<string, number>): Record<string, NodeAssignment> {
  const nodes = constellationTemplate(tier).nodes.filter((n) => n.kind === 'card').sort((a, b) => a.order - b.order)
  const ids = Object.entries(counts).flatMap(([cardId, n]) => Array<string>(n).fill(cardId))
  return Object.fromEntries(ids.map((cardId, i) => [nodes[i]!.id, { kind: 'card', cardId }]))
}

/** Her at `tier` with the tier below trained as `before` (Medium preset), and the current unit open to TL10. */
function twoScenarios(tier: number, before: Partial<ScenarioTraining>, current: Partial<ScenarioTraining> = {}): UmaSave {
  const save = createUmaSave(child)
  const unit = (t: number, view: Partial<ScenarioTraining>) => {
    const base = createScenarioTraining(t)
    const merged = { ...scenarioView(base, 'medium'), trainingLevel: 10, inspiration: fullInspiration, ...view }
    return { ...base, trainingLevel: merged.trainingLevel, inspiration: merged.inspiration,
      presets: { ...base.presets, medium: { cardSetIds: merged.cardSetIds, assignments: merged.assignments, activeExtraStats: [], loadoutSkillIds: merged.loadoutSkillIds } } }
  }
  return { ...save, activePreset: 'medium', unlockedTier: tier, scenarios: [unit(tier - 1, before), unit(tier, current)] }
}
const counts = (run: ScenarioTraining) => Object.values(run.assignments).reduce<Record<string, number>>((all, a) =>
  a.kind === 'card' ? { ...all, [a.cardId]: (all[a.cardId] ?? 0) + 1 } : all, {})

describe('loading a preset page from the scenario before (D288)', () => {
  it('offers the earlier preset only once this page has nothing left to unlock and there is something to load', () => {
    const save = twoScenarios(2, { cardSetIds: ['a'], loadoutSkillIds: ['w1'], assignments: { parent0: { kind: 'lineage', templateId: 'p0' } } })
    const run = scenarioAt(save, 2)!
    expect(presetCarrySource(save, run, 'constellation')?.tier).toBe(1)
    expect(presetCarrySource(save, run, 'inspiration')?.tier).toBe(1)
    expect(presetCarrySource(save, run, 'skills')?.tier).toBe(1)
    // Card nodes still closing (TL7), a gold moon still locked, nothing earlier, or nothing on that page: no button.
    expect(presetCarrySource(save, { ...run, trainingLevel: 7 }, 'constellation')).toBeNull()
    expect(presetCarrySource(save, { ...run, trainingLevel: 7 }, 'skills')).toBeNull()
    const goldMissing = { ...run, inspiration: { ...fullInspiration, golds: fullInspiration.golds.slice(1) } }
    expect(presetCarrySource(save, goldMissing, 'inspiration')).toBeNull()
    expect(presetPageComplete(goldMissing, 'constellation')).toBe(true)
    expect(presetCarrySource(save, scenarioAt(save, 1)!, 'constellation')).toBeNull()
    expect(presetCarrySource(twoScenarios(2, {}), run, 'constellation')).toBeNull()
  })

  it('copies the card set and gives each card its share of a bigger tree', () => {
    const set = ['a', 'b', 'c', 'd', 'e', 'f']
    const save = twoScenarios(2, { cardSetIds: set, assignments: filled(1, { a: 3, b: 3, c: 3, d: 3, e: 3, f: 3 }) },
      { assignments: { parent0: { kind: 'lineage', templateId: 'p0' } } })
    const next = carryConstellation(scenarioAt(save, 1)!, scenarioAt(save, 2)!)
    expect(next.cardSetIds).toEqual(set)
    expect(Object.values(counts(next)).reduce((s, n) => s + n, 0)).toBe(constellationTemplate(2).cardNodes)
    expect(Math.max(...Object.values(counts(next)))).toBeLessThanOrEqual(cardNodeCap(2))
    expect(next.assignments.parent0).toEqual({ kind: 'lineage', templateId: 'p0' })
  })

  it("hands nodes past a smaller tree's cap to the set's emptiest card, and leaves empty nodes empty", () => {
    const set = ['a', 'b', 'c', 'd', 'e', 'f']
    const save = twoScenarios(3, { cardSetIds: set, assignments: filled(2, { a: 5, b: 5, c: 4, d: 3, e: 3 }) })
    const next = carryConstellation(scenarioAt(save, 2)!, scenarioAt(save, 3)!)
    const held = counts(next)
    expect(Object.values(held).reduce((s, n) => s + n, 0)).toBe(constellationTemplate(3).cardNodes)
    expect(Math.max(...Object.values(held))).toBeLessThanOrEqual(cardNodeCap(3))
    expect(held.f).toBeGreaterThan(0)
    const half = twoScenarios(2, { cardSetIds: ['a'], assignments: filled(1, { a: 4 }) })
    expect(counts(carryConstellation(scenarioAt(half, 1)!, scenarioAt(half, 2)!)).a).toBeLessThanOrEqual(5)
  })

  it('copies the six lineage slots exactly and keeps card nodes; an unowned Uma only fits a Legends slot', () => {
    const lineage = { parent0: { kind: 'lineage', templateId: 'p0' }, 'parent0-gp1': { kind: 'lineage', templateId: 'g01' } } as const
    const save = twoScenarios(2, { assignments: lineage },
      { assignments: { parent1: { kind: 'lineage', templateId: 'p1' }, n0: { kind: 'card', cardId: 'a' } } })
    const context = { child, umas, owned: () => true }
    const next = carryInspiration(scenarioAt(save, 1)!, scenarioAt(save, 2)!, context)
    expect(next.assignments).toEqual({ ...lineage, n0: { kind: 'card', cardId: 'a' } })
    expect(() => carryInspiration(scenarioAt(save, 1)!, scenarioAt(save, 2)!, { ...context, owned: (id) => id !== 'p0' })).toThrow(/not owned/)
    const legends = twoScenarios(10, { assignments: lineage })
    expect(carryInspiration(scenarioAt(legends, 9)!, scenarioAt(legends, 10)!, { ...context, owned: (id) => id !== 'p0' }).assignments.parent0)
      .toEqual(lineage.parent0)
  })

  it('keeps the earlier loadout in order while this library has each skill and the SP lasts', () => {
    const skill = (id: string): SkillTemplate => ({ id, kind: 'white', name: id, description: '', costSp: 200, iconId: null,
      conditions: [{ precondition: null, condition: 'phase>=2', baseTime: 24000, cooldown: null, effects: [{ type: 31, value: 2000 }] }],
      inheritedSkillId: null, normalSkillId: null })
    const skills = new Map(['w1', 'w2', 'w3', 'gone'].map((id) => [id, skill(id)]))
    const library = ['w1', 'w2', 'w3'].map((skillId) => ({ skillId, origin: 'card' as const, sourceId: 'a' }))
    const source = { library, skillPoints: 450, loadoutSkillIds: [] }
    expect(carrySkillLoadout(source, child, skills, ['w2', 'gone', 'w1', 'w3'])).toEqual({ loadoutSkillIds: ['w2', 'w1'], skipped: 2 })
  })
})
