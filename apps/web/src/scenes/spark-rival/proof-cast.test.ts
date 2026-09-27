import type { UmaTemplate } from '@racer/domain'
import { describe, expect, it } from 'vitest'
import { sparkProofCast } from './proof-cast'

const strategies = ['front', 'pace', 'late', 'end'] as const
const uma = (id: string, best: (typeof strategies)[number], starter = false): UmaTemplate => ({
  id,
  charaId: `character-${id}`,
  name: `Synthetic ${id}`,
  outfit: null,
  jpRelease: '2000-01-01',
  globalRelease: null,
  starter,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: {
    surface: { turf: 'A', dirt: 'G' },
    distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
    strategy: Object.fromEntries(strategies.map((strategy) => [strategy, strategy === best ? 'A' : 'C'])) as UmaTemplate['aptitudes']['strategy'],
  },
  uniqueSkillId: null,
  awakeningSkillIds: [],
  realHorseSex: null,
  signatureRaceFamilyIds: [],
  imageSource: 'https://example.invalid/synthetic.png',
})

describe('Spark proof Chibi cast', () => {
  it('picks one best distinct representative per style, the trainee for Spark, and a fifth support face for Recovery', () => {
    const items = [uma('trainee', 'pace', true), uma('front', 'front'), uma('pace', 'pace'), uma('late', 'late'), uma('end', 'end'), uma('recovery', 'front')]
    const cast = sparkProofCast(items.reverse(), 'trainee')!
    expect(cast.rivals).toEqual({ front: 'front', pace: 'pace', late: 'late', end: 'end' })
    expect(cast.orbs).toEqual({ front: 'front', pace: 'pace', late: 'late', end: 'end', spark: 'trainee', recovery: 'recovery' })
  })

  it('falls back deterministically when a synthetic catalogue is tiny', () => {
    const cast = sparkProofCast([uma('only', 'front', true)], null)!
    expect(new Set(Object.values(cast.orbs))).toEqual(new Set(['only']))
    expect(sparkProofCast([], null)).toBeNull()
  })
})
