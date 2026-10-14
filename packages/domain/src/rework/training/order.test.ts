// The unlock order (docs/rework/05-training-hub.md §3): every rule both ways, later layers refused by name, earlier
// layers open for the whole tier, the next unlocks at a facility, what is left of her layers, and a layer done.
import { describe, expect, it } from 'vitest'
import { cardOf } from '../../__fixtures__/rework-training'
import { emptyBuild, isRefusal, type ScenarioAt, type UmaBuild } from '../types'
import { commitUnlocks } from './build'
import { layerDone, nextUnlocks, remainingUnlocks, unlockStatus } from './order'
import { bondUnlock, fixedUnlock, layerUnlocks, unlockLabel, type Unlock, type UnlockRef } from './unlocks'

const S = (scenario: number): ScenarioAt => ({ tier: 1, scenario: scenario as 1 })
const fixed = (kind: Unlock['kind'], target: string): Unlock => {
  const entry = fixedUnlock({ kind, target })
  if (!entry) throw new Error(`No ${kind} ${target}`)
  return entry
}
/** A build with these unlocks open, written by the commit rule at scenario 5. */
const opened = (...refs: [Unlock['kind'], string][]): UmaBuild => commitUnlocks(emptyBuild(null), S(5), refs.map(([kind, target]) => fixed(kind, target))).build
const nodes = (count: number): [Unlock['kind'], string][] => Array.from({ length: count }, (_, i) => ['node', `n${i + 1}`])
const status = (build: UmaBuild, at: ScenarioAt, kind: Unlock['kind'], target: string, pending: readonly UnlockRef[] = []) => {
  const result = unlockStatus(build, at, fixed(kind, target), pending)
  return isRefusal(result) ? result.reason.replace(/\{(\w+)\}/g, (_, key: string) => String(result.data?.[key])) : result.status
}

describe('the Observatory', () => {
  it('opens the lowest locked node only, unless the ones before are pending', () => {
    const build = opened(...nodes(5))
    expect(status(build, S(1), 'node', 'n5')).toBe('open')
    expect(status(build, S(1), 'node', 'n6')).toBe('available')
    expect(status(build, S(1), 'node', 'n7')).toBe('Needs node 6 first.')
    expect(status(build, S(1), 'node', 'n7', [{ kind: 'node', target: 'n6' }])).toBe('available')
    expect(status(build, S(1), 'node', 'n6', [{ kind: 'node', target: 'n6' }])).toBe('pending')
  })
})

describe('the Lineage Hall', () => {
  it("opens a grandparent slot after its parent's slot, never the other side's", () => {
    const build = opened(['slot', 'parent0'])
    expect(status(build, S(2), 'slot', 'parent0-gp0')).toBe('available')
    expect(status(build, S(2), 'slot', 'parent1-gp0')).toBe('Needs slot B first.')
    expect(status(build, S(2), 'slot', 'parent1-gp0', [{ kind: 'slot', target: 'parent1' }])).toBe('available')
  })

  it('opens a unique or a gold once its own slot is open, filled or not; gold 2 needs no gold 1, B needs no A', () => {
    const build = opened(['slot', 'parent1'])
    expect(status(build, S(1), 'unique', 'parent1')).toBe('available')
    expect(status(build, S(1), 'unique', 'parent0')).toBe('Needs slot A first.')
    expect(status(build, S(2), 'gold', 'parent1:gold1')).toBe('available')
    expect(status(build, S(2), 'gold', 'parent0:gold0')).toBe('Needs slot A first.')
    expect(build.presets.mile.lineage).toEqual({})
  })
})

describe('the Gym', () => {
  it('opens each stat in grade order, a Duo after both its singles, a Sun after its five', () => {
    const build = opened(['single', 'speed-01'], ['single', 'power-01'], ['single', 'speed-03'])
    expect(status(build, S(2), 'single', 'power-03')).toBe('available')
    expect(status(build, S(2), 'single', 'wit-03')).toBe('Needs Wit grade 1 first.')
    expect(status(build, S(2), 'duo', 'duo-power-speed-3')).toBe('Needs Power grade 3 first.')
    expect(status(build, S(2), 'duo', 'duo-power-speed-3', [{ kind: 'single', target: 'power-03' }])).toBe('available')
    expect(status(build, S(2), 'sun', 'sun-4')).toBe('Needs Stamina grade 3 first.')
    const five = opened(...(['stamina', 'wit', 'power', 'speed', 'guts'] as const).flatMap((stat): [Unlock['kind'], string][] => [['single', `${stat}-01`], ['single', `${stat}-03`]]))
    expect(status(five, S(2), 'sun', 'sun-4')).toBe('available')
    expect(status(five, S(2), 'duo', 'duo-stamina-wit-3')).toBe('available')
  })
})

describe('layers', () => {
  it('refuse a later layer with its scenario and name, and keep every earlier one open', () => {
    const build = opened(...nodes(12))
    expect(status(build, S(1), 'node', 'n13')).toBe('Opens in scenario 2 · Unity Cup')
    expect(status(build, S(2), 'node', 'n13')).toBe('available')
    expect(status(build, S(1), 'gold', 'parent0:gold0')).toBe('Opens in scenario 2 · Unity Cup')
    expect(status(build, S(2), 'single', 'speed-05')).toBe('Opens in scenario 3 · Trackblazer')
    // An earlier layer stays open after the advance: she skipped node 11 and can open it in scenario 3.
    const skipped = opened(...nodes(10))
    expect(status(skipped, S(3), 'node', 'n11')).toBe('available')
    expect(status(skipped, S(3), 'node', 'n12')).toBe('Needs node 11 first.')
    // Tier 2 names its own scenarios.
    expect(status(emptyBuild(null), { tier: 2, scenario: 1 }, 'node', 'n13')).toBe('Opens in scenario 2 · U.A.F. Ready GO!')
  })

  it("refuse a bond whose card's era is past her scenario", () => {
    const entry = bondUnlock(cardOf('wit-e3'), 1, 5)
    if (isRefusal(entry)) throw new Error(entry.reason)
    expect(unlockStatus(emptyBuild(null), S(2), entry)).toMatchObject({ refused: true, code: 'card-era', data: { scenario: 3, name: 'Trackblazer' } })
    expect(unlockStatus(emptyBuild(null), S(3), entry)).toEqual({ status: 'available' })
  })
})

describe('nextUnlocks', () => {
  it("is the next N nodes at the Observatory: 05 §2's night is nodes 6, 7 and 8", () => {
    const next = nextUnlocks(opened(...nodes(5)), S(1), 'observatory', null, 3)
    expect(next.map((entry) => [entry.target, entry.grade, entry.dishId])).toEqual([
      ['n6', 1, 'dish-vegetables-1'], ['n7', 2, 'dish-vegetables-2'], ['n8', 2, 'dish-vegetables-2'],
    ])
    expect(nextUnlocks(opened(...nodes(5)), S(1), 'observatory', null, 3, [{ kind: 'node', target: 'n6' }]).map((entry) => entry.target)).toEqual(['n7', 'n8', 'n9'])
    expect(nextUnlocks(opened(...nodes(12)), S(1), 'observatory', null, 3)).toEqual([])
  })

  it("follows 05 §3's table at the Lineage Hall", () => {
    expect(nextUnlocks(emptyBuild(null), S(2), 'lineage-hall', null, 10).map(unlockLabel)).toEqual([
      'slot A', 'slot B', "A's unique", "B's unique", 'A gold 1', 'A gold 2', 'B gold 1', 'B gold 2', 'slot A1', 'slot B1',
    ])
  })

  it('takes a Gym room by layer, grade, single, Duos in ring order, then the Sun, passing over what still waits', () => {
    const base = opened(['single', 'power-01'])
    expect(nextUnlocks(base, S(2), 'gym', 'power', 5).map(unlockLabel)).toEqual(['Power grade 3'])
    const neighbours = opened(['single', 'power-01'], ['single', 'wit-01'], ['single', 'wit-03'], ['single', 'speed-01'], ['single', 'speed-03'])
    expect(nextUnlocks(neighbours, S(3), 'gym', 'power', 10).map(unlockLabel))
      .toEqual(['Power grade 3', 'Wit–Power Duo grade 3', 'Power–Speed Duo grade 3', 'Power grade 5'])
    expect(nextUnlocks(emptyBuild(null), S(1), 'gym', 'speed', 3).map(unlockLabel)).toEqual(['Speed grade 1'])
  })

  it('gives nothing at the Dojo, where a bond names its card, and refuses a room the facility lacks', () => {
    expect(nextUnlocks(emptyBuild(null), S(1), 'dojo', 'speed', 3)).toEqual([])
    expect(() => nextUnlocks(emptyBuild(null), S(1), 'gym', null, 3)).toThrow(RangeError)
    expect(() => nextUnlocks(emptyBuild(null), S(1), 'observatory', 'speed', 3)).toThrow(RangeError)
  })
})

describe('remainingUnlocks', () => {
  it('lists the open layers oldest first, bonds for chosen cards and "pick cards" for the rest of the pacing count', () => {
    const fresh = remainingUnlocks(emptyBuild(null), S(1), [cardOf('speed-e1'), cardOf('wit-e1'), cardOf('wit-e2')])
    expect(fresh.filter((entry) => entry.kind === 'unlock' && entry.facility !== 'dojo')).toHaveLength(21)
    expect(fresh.filter((entry) => entry.kind === 'unlock' && entry.facility === 'dojo').map((entry) => entry.kind === 'unlock' && entry.unlock.target))
      .toEqual(['speed-e1', 'wit-e1'])
    expect(fresh.at(-1)).toEqual({ kind: 'pick-cards', layer: 1, facility: 'dojo', count: 4 })
    const first = fresh[0]!
    expect(first).toMatchObject({ kind: 'unlock', layer: 1, facility: 'observatory', room: null, grade: 1, dishId: 'dish-vegetables-1' })
    const duo = remainingUnlocks(emptyBuild(null), S(2), []).find((entry) => entry.kind === 'unlock' && entry.unlock.target === 'duo-power-speed-3')
    expect(duo).toMatchObject({ facility: 'gym', room: 'power', rooms: ['power', 'speed'] })
  })

  it('counts bonds made and pending toward the pacing, oldest layer first, and skips what is open or pending', () => {
    const build = { ...opened(...nodes(12)), bonds: ['speed-e1', 'stamina-e1', 'power-e1', 'guts-e1'] }
    const pending: UnlockRef[] = [{ kind: 'bond', target: 'wit-e1' }, { kind: 'node', target: 'n13' }]
    const left = remainingUnlocks(build, S(2), [cardOf('speed-e2')], pending)
    expect(left.some((entry) => entry.kind === 'unlock' && (entry.unlock.kind === 'node' && entry.unlock.target === 'n13'))).toBe(false)
    // Bonded 4 + pending 1 + chosen 1 = 6 cover layer 1's six; layer 2 still needs its 3.
    expect(left.filter((entry) => entry.kind === 'pick-cards')).toEqual([{ kind: 'pick-cards', layer: 2, facility: 'dojo', count: 3 }])
    expect(left.filter((entry) => entry.kind === 'unlock' && entry.facility === 'dojo').map((entry) => entry.kind === 'unlock' && entry.unlock.target)).toEqual(['speed-e2'])
    // A chosen card already bonded, pending or past her era is not listed.
    expect(remainingUnlocks(build, S(2), [cardOf('speed-e1'), cardOf('wit-e1'), cardOf('wit-e3')], pending)
      .filter((entry) => entry.kind === 'unlock' && entry.facility === 'dojo')).toEqual([])
  })
})

describe('layerDone', () => {
  it('needs every fixed unlock of the layer and the bonds counted by its end', () => {
    const layer1 = commitUnlocks(emptyBuild(null), S(1), layerUnlocks(1)).build
    expect(layerDone(layer1, 1)).toBe(false)
    const bonded = { ...layer1, bonds: ['a', 'b', 'c', 'd', 'e'] }
    expect(layerDone(bonded, 1)).toBe(false)
    expect(layerDone({ ...bonded, bonds: [...bonded.bonds, 'f'] }, 1)).toBe(true)
    expect(layerDone({ ...bonded, bonds: [...bonded.bonds, 'f'] }, 2)).toBe(false)
    expect(layerDone(emptyBuild(null), 1)).toBe(false)
  })
})
