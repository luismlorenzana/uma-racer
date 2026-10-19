// Invented lineage fixtures only (D250).
import { describe, expect, it } from 'vitest'
import { lineageSlotEligibility } from './lineage'
import type { UmaTemplate } from './content'

const outfit = (id: string): UmaTemplate => ({ id, charaId: `chara-${id}`, name: `Invented ${id}`, outfit: null,
  jpRelease: '2000-01-01', globalRelease: null, starter: true,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 }, growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'G', mile: 'A', medium: 'A', long: 'G' },
    strategy: { front: 'A', pace: 'G', late: 'G', end: 'G' } },
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [], })
const child = outfit('child'), grand = { ...outfit('grand'),
  uniqueSkillId: 'unique', awakeningSkillIds: ['white', 'gold', 'white2', 'gold2'] }

describe('grandparent eligibility', () => {
  it('allows only exact opposite-side mirrors, not a parent, child or same-side character repeat', () => {
    const held = new Map([['parent0-gp0', grand]])
    expect(lineageSlotEligibility(grand, child, 'parent1-gp1', held).eligible).toBe(true)
    for (const slot of ['parent0-gp1', 'parent1']) expect(lineageSlotEligibility(grand, child, slot, held).eligible).toBe(false)
    expect(lineageSlotEligibility({ ...grand, id: 'another-outfit' }, child, 'parent1-gp1', held).eligible).toBe(false)
    expect(lineageSlotEligibility(child, child, 'parent1', held).eligible).toBe(false)
  })
})
