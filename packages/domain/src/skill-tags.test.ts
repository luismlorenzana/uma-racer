import { describe, expect, it } from 'vitest'
import { skillTags } from './skill-tags'

const skill = (condition: string, effects: { type: number; value: number; target?: number }[] = [{ type: 27, value: 3500 }], precondition: string | null = null) => ({
  conditions: [{ condition, precondition, baseTime: 30000, cooldown: 5000000, effects }],
})

describe('skill tags', () => {
  it('reads running style, distance and surface from the conditions', () => {
    expect(skillTags(skill('running_style==1&distance_type==2&ground_type==1'))).toMatchObject({
      strategies: ['front'], distances: ['mile'], surfaces: ['turf'],
    })
    // Alternatives are OR-ed, so both styles apply.
    expect(skillTags(skill('running_style==3&phase==2@running_style==4&phase==2')).strategies).toEqual(['late', 'end'])
  })

  it('leaves style and distance empty for a skill that suits anyone', () => {
    expect(skillTags(skill('is_finalcorner==1'))).toMatchObject({ strategies: [], distances: [], places: ['final-corner'] })
  })

  it('reads phases, including ranges, and places', () => {
    expect(skillTags(skill('phase>=2&is_last_straight_onetime==1')).phases).toEqual(['late', 'spurt'])
    expect(skillTags(skill('phase<=1&corner_random==1')).phases).toEqual(['early', 'mid'])
    expect(skillTags(skill('phase_random==1&up_slope_random==1')).places).toEqual(['uphill'])
    expect(skillTags(skill('phase>=2&corner!=0')).places).toEqual(['corner'])
  })

  it('names what it does, and marks effects aimed at rivals as debuffs', () => {
    expect(skillTags(skill('phase==1', [{ type: 9, value: 350 }])).effects).toEqual(['recovery'])
    expect(skillTags(skill('phase==2', [{ type: 31, value: 2000 }, { type: 27, value: 1500 }])).effects).toEqual(['speed', 'acceleration'])
    expect(skillTags(skill('phase==1', [{ type: 9, value: -100, target: 9 }])).effects).toEqual(['debuff'])
  })
})
