// Invented lineage/reward fixtures only (D250).
import { describe, expect, it } from 'vitest'
import { INSPIRATION_SLOTS, emptyInspiration, grandfatherInspiration, inspirationGoldKey, inspirationGrantId,
  inspirationTokenId, inspirationSpendId, openInspiration, parseInspiration, parseInspirationMovement } from './inspiration'
import { createCardSave, createUmaSave, migrateUmaSaveToCurrent } from './save'
import { CARD_EFFECTS } from './cards'
import { deriveUma } from './derived'
import { lineageSlotEligibility } from './lineage'
import { summarizeSkillLoadout, affordableLoadout } from './race-skills'
import { constellationTemplate, isNodeUnlocked, nodesUnlockedBetween } from './constellation'
import { rpgInspirationReward } from './rpg/chapter'
import { syntheticChapterPack } from './rpg/chapter.synthetic'
import { createInitialFarmState } from './farm/rules'
import { reconcileFarmEvidence } from './farm/reconciliation'
import type { SkillTemplate, UmaTemplate, SupportCardTemplate } from './content'

const skill = (id: string, kind: SkillTemplate['kind'], costSp = 100, normalSkillId: string | null = null): SkillTemplate => ({
  id, kind, name: `Invented ${id}`, description: 'Test only', costSp, iconId: null, inheritedSkillId: null, normalSkillId,
  conditions: [{ precondition: null, condition: 'phase>=1', baseTime: 20000, cooldown: null, effects: [{ type: 27, value: 1000 }] }],
})
const skills = new Map([
  { ...skill('unique', 'unique'), inheritedSkillId: 'inherited' }, skill('inherited', 'inherited-unique', 200),
  skill('white', 'white', 80), skill('gold', 'gold', 120, 'white'), skill('white2', 'white'), skill('gold2', 'gold', 200, 'white2'),
].map(s => [s.id, s]))
const outfit = (id: string): UmaTemplate => ({ id, charaId: `chara-${id}`, name: `Invented ${id}`, outfit: null,
  jpRelease: '2000-01-01', globalRelease: null, starter: true,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 }, growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'G', mile: 'A', medium: 'A', long: 'G' },
    strategy: { front: 'A', pace: 'G', late: 'G', end: 'G' } },
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [], imageSource: 'https://invalid.test/invented.png' })
const child = outfit('child'), parent = outfit('parent'), second = outfit('second'), grand = { ...outfit('grand'),
  uniqueSkillId: 'unique', awakeningSkillIds: ['white', 'gold', 'white2', 'gold2'] }
const templates = new Map([child, parent, second, grand].map(u => [u.id, u]))
const configured = (mirror = false, unlock = false) => {
  const save = createUmaSave(child), run = save.scenarios[0]!
  run.inspiration = { slots: [...INSPIRATION_SLOTS], golds: unlock ? [inspirationGoldKey('parent0-gp0', 0)] : [] }
  run.assignments = { parent0: { kind: 'lineage', templateId: parent.id }, parent1: { kind: 'lineage', templateId: second.id },
    'parent0-gp0': { kind: 'lineage', templateId: grand.id }, ...(mirror ? { 'parent1-gp1': { kind: 'lineage' as const, templateId: grand.id } } : {}) }
  return save
}
const derive = (save = configured()) => deriveUma({ uma: save, umaTemplate: child, cardSaves: new Map(), cardTemplates: new Map(), umaTemplates: templates, skillTemplates: skills })

describe('explicit Inspiration and migration', () => {
  it('opens six independent slots and twelve independent gold positions, preserving parent gates', () => {
    expect(() => openInspiration(emptyInspiration(), 'parent0-gp0', null)).toThrow(/parent/)
    expect(() => openInspiration(emptyInspiration(), 'parent0', 0)).toThrow(/open/)
    let state = emptyInspiration()
    for (const slot of INSPIRATION_SLOTS) {
      state = openInspiration(state, slot, null)
      for (const index of [0, 1]) state = openInspiration(state, slot, index)
    }
    expect(state.slots).toHaveLength(6); expect(state.golds).toHaveLength(12)
    expect(() => openInspiration(state, 'parent0', null)).toThrow(/already/)
    expect(() => openInspiration(state, 'parent0', 1)).toThrow(/already/)
    expect(parseInspiration({ ...state, slots: [...state.slots, 'parent0'] })).toBeNull()
    expect(parseInspiration({ slots: ['parent0'], golds: ['parent1:gold0'] })).toBeNull()
    expect(parseInspiration({ ...state, future: true })).toBeNull()
  })
  it.each([8, 9, 10])('grandfathers TL%s without altering EXP, assignments or Extra stats and stays idempotent', level => {
    const current = createUmaSave(child)
    const legacy = { ...current, schemaVersion: 13, scenarios: current.scenarios.map(({ inspiration: _i, ...run }) => ({ ...run, trainingLevel: level })) }
    const migrated = migrateUmaSaveToCurrent(legacy)!
    expect(migrated.scenarios[0]!.inspiration.slots).toHaveLength(level === 10 ? 6 : level === 9 ? 3 : 0)
    expect(migrated.scenarios[0]!.inspiration.golds).toHaveLength(level === 10 ? 12 : level === 9 ? 6 : 0)
    const { inspiration: _i, ...run } = migrated.scenarios[0]!
    expect(run).toEqual(legacy.scenarios[0]); expect(migrated.exp).toBe(current.exp)
    expect(migrateUmaSaveToCurrent(migrated)).toEqual(migrated)
  })
  it('retains a filled branch below its old gate but never reopens a fresh explicit TL10 row', () => {
    expect(grandfatherInspiration(1, { 'parent1-gp1': { kind: 'lineage', templateId: grand.id } }).slots).toEqual(['parent1', 'parent1-gp0', 'parent1-gp1'])
    const save = createUmaSave(child); save.scenarios[0]!.trainingLevel = 10
    expect(migrateUmaSaveToCurrent(save)?.scenarios[0]!.inspiration).toEqual(emptyInspiration())
    const t = constellationTemplate(1)
    expect(isNodeUnlocked(t, t.nodes.find(n => n.id === 'parent0')!, 10, save.scenarios[0]!.inspiration)).toBe(false)
    expect(nodesUnlockedBetween(t, 8, 10).some(n => n.kind !== 'card')).toBe(false)
  })
})
describe('grandparent eligibility and SP', () => {
  it('allows only exact opposite-side mirrors, not a parent, child or same-side character repeat', () => {
    const held = new Map([['parent0-gp0', grand]])
    expect(lineageSlotEligibility(grand, child, 'parent1-gp1', held).eligible).toBe(true)
    for (const slot of ['parent0-gp1', 'parent1']) expect(lineageSlotEligibility(grand, child, slot, held).eligible).toBe(false)
    expect(lineageSlotEligibility({ ...grand, id: 'another-outfit' }, child, 'parent1-gp1', held).eligible).toBe(false)
    expect(lineageSlotEligibility(child, child, 'parent1', held).eligible).toBe(false)
  })
  it('a slot lends unique/whites but not locked golds; independent gold positions remain separate', () => {
    const locked = derive()
    expect(locked.library.map(s => s.skillId)).toEqual(['white', 'white2', 'inherited'])
    const open = derive(configured(false, true))
    expect(open.library.some(s => s.skillId === 'gold')).toBe(true)
    expect(open.library.some(s => s.skillId === 'gold2')).toBe(false)
    expect(open.skillCostMultipliers.get('white')).toBe(1)
    expect(open.skillCostMultipliers.get('gold')).toBe(2)
  })
  it('doubles the entire single-side chain, including explicitly equipped whites, and race budget agrees', () => {
    const derived = { ...derive(configured(false, true)), loadoutSkillIds: ['white', 'gold', 'inherited'], skillPoints: 800 }
    const summary = summarizeSkillLoadout(derived, child, skills)
    expect(summary.cost).toBe(800)
    expect(affordableLoadout(summary.entries, 800).map(s => s.id)).toEqual(['gold', 'inherited'])
    expect(affordableLoadout(summary.entries, 799).map(s => s.id)).toEqual(['gold'])
  })
  it('mirrored slots count twice for aptitudes but deduplicate the library and restore normal SP', () => {
    const single = derive(configured(false, true)), mirrored = derive(configured(true, true))
    expect(mirrored.lineage).toHaveLength(single.lineage.length + 1)
    expect(mirrored.library.filter(s => s.skillId === 'inherited')).toHaveLength(1)
    expect(mirrored.skillCostMultipliers.get('inherited')).toBe(1)
    expect(mirrored.skillCostMultipliers.get('gold')).toBe(1)
    expect(summarizeSkillLoadout({ ...mirrored, loadoutSkillIds: ['gold', 'inherited'] }, child, skills).cost).toBe(400)
  })
  it('a cheaper parent source wins for a shared gold', () => {
    const save = configured(false, true)
    save.scenarios[0]!.assignments.parent0 = { kind: 'lineage', templateId: grand.id }
    save.scenarios[0]!.inspiration.golds.push(inspirationGoldKey('parent0', 0))
    expect(derive(save).skillCostMultipliers.get('gold')).toBe(1)
  })
  it('an own natural-gold source beats the doubled grandparent source', () => {
    const own = { ...child, awakeningSkillIds: ['white', 'gold'] }
    const result = deriveUma({ uma: configured(false, true), umaTemplate: own, cardSaves: new Map(), cardTemplates: new Map(), umaTemplates: templates, skillTemplates: skills })
    expect(result.skillCostMultipliers.get('gold')).toBe(1)
    expect(summarizeSkillLoadout({ ...result, loadoutSkillIds: ['gold'] }, own, skills).cost).toBe(200)
  })
  it('a live card source beats the doubled grandparent source, even with its lineage gold locked', () => {
    const card: SupportCardTemplate = { id: 'invented-card', charaId: 'invented-card-character', charName: 'Invented', title: 'Test card', type: 'speed', era: 1,
      jpRelease: '2000-01-01', obtain: 'gacha', starter: true, hintSkillIds: ['white'], eventSkillIds: ['gold'],
      effectProfile: Object.fromEntries(CARD_EFFECTS.map(effect => [effect, 1])) as SupportCardTemplate['effectProfile'],
      uniqueEffect: null, imageSource: 'https://invalid.test/invented-card.png' }
    const save = configured(), run = save.scenarios[0]!
    run.cardSetIds = [card.id]
    const node = constellationTemplate(1).nodes.find(n => n.kind === 'card')!
    run.assignments[node.id] = { kind: 'card', cardId: card.id }
    const result = deriveUma({ uma: save, umaTemplate: child, cardSaves: new Map([[card.id, createCardSave(card)]]), cardTemplates: new Map([[card.id, card]]), umaTemplates: templates, skillTemplates: skills })
    expect(result.library.find(s => s.skillId === 'gold')?.origin).toBe('card')
    expect(result.skillCostMultipliers.get('gold')).toBe(1)
  })
})
describe('reward budget and Item evidence', () => {
  it('ordinary/optional fights fund 60 golds on the shortest route; boss funds 30 slots; missing EXP pays zero', () => {
    const chapter = syntheticChapterPack().chapters[0]!
    expect(rpgInspirationReward(chapter, chapter.nodes.find(n => n.id === 'opening')!)).toEqual({ tier: 1, slot: 0, skill: 60 })
    expect(rpgInspirationReward(chapter, chapter.nodes.find(n => n.id === 'elite')!).skill).toBe(60)
    expect(rpgInspirationReward(chapter, chapter.nodes.find(n => n.id === 'boss')!)).toEqual({ tier: 1, slot: 30, skill: 0 })
    expect(rpgInspirationReward(chapter, { ...chapter.nodes[0]!, baseExp: 0 }).skill).toBe(0)
    const solo = syntheticChapterPack().chapters[2]!
    expect(rpgInspirationReward(solo, solo.nodes[0]!)).toEqual({ tier: 1, slot: 30, skill: 60 })
  })
  it('validates typed scenario evidence and reconciles duplicate grants once', () => {
    const itemId = inspirationTokenId(1, 'slot')
    const grant = { id: inspirationGrantId('rpg-entry:test:1:boss', 'slot'), itemId, delta: 30, reason: 'rpg-inspiration', createdAt: 1,
      source: { kind: 'rpg-inspiration', entryId: 'rpg-entry:test:1:boss', attemptId: 'rpg-attempt:test:1', tier: 1, tokenKind: 'slot' } }
    const parsed = parseInspirationMovement(grant)!
    expect(parsed).not.toBeNull()
    expect(parseInspirationMovement({ ...grant, itemId: inspirationTokenId(2, 'slot') })).toBeNull()
    const repaired = reconcileFarmEvidence(createInitialFarmState(), [{ itemId, quantity: 99, updatedAt: 0 }], [parsed, parsed])
    expect(repaired.stacks[0]!.quantity).toBe(30)
    expect(reconcileFarmEvidence(repaired.farm, repaired.stacks, [parsed]).changedItemIds).toEqual([])
  })
  it('reconciles accepted cross-device grants/spends despite clock skew, but rejects an overspend', () => {
    const itemId = inspirationTokenId(1, 'skill'), entryId = 'rpg-entry:test:1:opening'
    const grant = parseInspirationMovement({ id: inspirationGrantId(entryId, 'skill'), itemId, delta: 60, reason: 'rpg-inspiration', createdAt: 1000,
      source: { kind: 'rpg-inspiration', entryId, attemptId: 'rpg-attempt:test:1', tier: 1, tokenKind: 'skill' } })!
    const spend = parseInspirationMovement({ id: inspirationSpendId('child', 1, 'parent0', 0), itemId, delta: -1, reason: 'inspiration-unlock', createdAt: 1,
      source: { kind: 'inspiration-unlock', umaId: 'child', tier: 1, nodeId: 'parent0', goldIndex: 0 } })!
    expect(reconcileFarmEvidence(createInitialFarmState(), [], [spend, grant]).stacks[0]!.quantity).toBe(59)
    expect(() => reconcileFarmEvidence(createInitialFarmState(), [], [spend])).toThrow(/invalid quantity/)
  })
})
