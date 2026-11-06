// `sim:careers`' bot and pacing on the invented content (D383, D391). The races need the engine, which the domain never
// imports, so they run in `pnpm sim:careers -- --synthetic` (CI's test:ci); here the careers play without them, and
// a stand-in engine checks the sim counts every first try.
import { describe, expect, it } from 'vitest'
import type { RaceEngine } from '../race-attempt'
import { syntheticCareerContent } from './synthetic'
import { careerFailures, goldPairPrice, INVENTED_TARGETS, mainGameDrills, simulateCareers } from './sim'

const content = syntheticCareerContent()

describe('sim:careers', () => {
  it('plays every invented career once at A within the invented content\'s pacing bands', () => {
    const report = simulateCareers(content, { attempts: 0, replay: true, targets: INVENTED_TARGETS })
    expect(report.failures).toEqual([])
    const median = report.decks.find((deck) => deck.label === 'median')!
    expect(median.careers).toBe(content.umas.length)
    expect(median.curve).toHaveLength(13)
    expect(median.curve.every((value, season) => season === 0 || value >= median.curve[season - 1]!)).toBe(true)
    expect(median.replayTree).toBeGreaterThan(median.tree)
  })

  it('races each objective and URA Finals round the given number of first tries', () => {
    const gateOrder: RaceEngine = {
      version: 9,
      simulate: (setup) => ({ results: setup.runners.map((_, runner) => ({ runner, placement: runner + 1, finishTime: 100 + runner, marginLengths: 0 })) }),
    }
    const report = simulateCareers(content, { attempts: 2, race: gateOrder, sample: 2 })
    const median = report.decks.find((deck) => deck.label === 'median')!
    expect(median.rates.g3.races).toBe(2 * 2)
    expect(median.rates.final.races).toBe(2 * 2)
    expect(median.rates.g1.races + median.rates.g2.races + median.rates.g3.races).toBe(2 * 2 * 6)
  })

  it('splits a play\'s drills as Furlong Hand\'s cards run, a Friend or Group card\'s in the focus, and prices a gold with its white', () => {
    const drills = mainGameDrills(200, [{ type: 'speed' }, { type: 'speed' }, { type: 'power' }, { type: 'friend' }], 'wit')
    expect(Object.values(drills).reduce((a, b) => a + b, 0)).toBe(200)
    // Weights 3 + 4 a card: Speed 11, Stamina 3, Power 7, Guts 3, Wit 7 (the Friend card's), of 31.
    expect(drills).toEqual({ speed: 71, stamina: 20, power: 45, guts: 19, wit: 45 })
    expect(goldPairPrice(content.skills)).toBe(Math.round(180 * 0.9) + Math.round(150 * 0.9))
  })

  it('says which target a report misses', () => {
    const report = simulateCareers(content, { attempts: 0, sample: 1 })
    expect(careerFailures(report.decks, { ...INVENTED_TARGETS, tree: { min: 0.99, max: 1 } }, false)[0]).toMatch(/buys .* of the tree/)
  })
})
