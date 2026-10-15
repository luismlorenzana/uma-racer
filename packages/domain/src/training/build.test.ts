// Her build (docs/game/03-uma-progression.md §6, docs/game/05-training-hub.md §4–§6, docs/game/06-cards-and-bonds.md
// §3): what a commit writes in every preset, the carry at the advance, and each preset edit, both ways.
import { describe, expect, it } from 'vitest'
import { CONTENT, COLT, SPRINTER, placeUma } from '../__fixtures__/tiers'
import { DAD, GRAMPS, GRAN, MOM, MOM_ALT, STRANGER, GROWER, TIER_AND_TRAINING, TRAINING_CONTENT, cardOf } from '../__fixtures__/training'
import { DISTANCE_CATEGORIES, type DistanceCategory } from '../types'
import { newAccount, unlockUma } from '../tiers/roster'
import { emptyBuild, isRefusal, type OpResult, type Preset, type ReworkState, type ScenarioAt, type UmaBuild, type UmaState } from '../state/types'
import {
  advanceScenario, carryOnAdvance, commitUnlocks, fillCard, handOverNodes, loadoutSummary, setActiveNodes, setAssignments, setCardSet, setLineage,
  setLoadout,
} from './build'
import { deriveBuild } from './derive'
import { EXTRA_NODE_IDS } from './extra'
import { FIXED_UNLOCKS, bondUnlock, fixedUnlock, layerUnlocks, type Unlock } from './unlocks'

const S = (scenario: number): ScenarioAt => ({ tier: 1, scenario: scenario as 1 })
const fixed = (kind: Unlock['kind'], target: string): Unlock => fixedUnlock({ kind, target })!
const node = (k: number): Unlock => fixed('node', `n${k}`)
const bond = (id: string, at = S(5)): Unlock => {
  const entry = bondUnlock(cardOf(id), at.tier, at.scenario)
  if (isRefusal(entry)) throw new Error(entry.reason)
  return entry
}
const withPresets = (build: UmaBuild, fn: (distance: DistanceCategory, preset: Preset) => Partial<Preset>): UmaBuild => ({
  ...build,
  presets: Object.fromEntries(DISTANCE_CATEGORIES.map((d) => [d, { ...build.presets[d], ...fn(d, build.presets[d]) }])) as UmaBuild['presets'],
})
function ok<R, S2 extends ReworkState>(result: OpResult<R, S2>): { state: S2; receipt: R } {
  if (isRefusal(result)) throw new Error(`${result.code}: ${result.reason}`)
  return result
}

describe('commitUnlocks', () => {
  it('fills a new node in every preset with the set card holding the fewest nodes under its cap, ties to the earlier slot', () => {
    let build = withPresets({ ...emptyBuild(null), bonds: ['speed-e1', 'wit-e1', 'stamina-e1'] }, (d) => ({
      cardSetIds: d === 'sprint' ? ['speed-e1', 'wit-e1'] : d === 'mile' ? ['wit-e1', 'speed-e1'] : d === 'medium' ? ['stamina-e1'] : [],
    }))
    const first = commitUnlocks(build, S(1), [node(1), node(2), node(3)])
    build = first.build
    expect(build.constellationOpened).toBe(3)
    expect(build.presets.sprint.assignments).toEqual({ n1: 'speed-e1', n2: 'wit-e1', n3: 'speed-e1' })
    expect(build.presets.mile.assignments).toEqual({ n1: 'wit-e1', n2: 'speed-e1', n3: 'wit-e1' })
    expect(build.presets.medium.assignments).toEqual({ n1: 'stamina-e1', n2: 'stamina-e1', n3: 'stamina-e1' })
    // An empty set leaves its nodes empty.
    expect(build.presets.long.assignments).toEqual({})
    expect(first.receipt.assigned.long).toEqual({ n1: null, n2: null, n3: null })
    expect(first.receipt.assigned.sprint).toEqual({ n1: 'speed-e1', n2: 'wit-e1', n3: 'speed-e1' })
    // A card at its cap (3 on a tree of 12) takes no more: the medium set's one card is full.
    const fourth = commitUnlocks(build, S(1), [node(4)])
    expect(fourth.build.presets.medium.assignments.n4).toBeUndefined()
    expect(fourth.receipt.assigned.medium).toEqual({ n4: null })
    expect(fourth.build.presets.sprint.assignments.n4).toBe('wit-e1')
    expect(fourth.receipt.opened).toEqual([node(4)])
  })

  it('counts only the open nodes when it picks, and uses the cap of her scenario', () => {
    const build = withPresets({ ...emptyBuild(null), bonds: ['speed-e1', 'wit-e1'] }, () => ({ cardSetIds: ['speed-e1', 'wit-e1'] }))
    const twelve = commitUnlocks(build, S(2), Array.from({ length: 12 }, (_, i) => node(i + 1))).build
    expect(Object.values(twelve.presets.mile.assignments).filter((id) => id === 'speed-e1')).toHaveLength(4)
    // At scenario 2 the cap is 4, so a 13th node finds both cards full only once each holds 4.
    const thirteen = commitUnlocks(twelve, S(2), [node(13)])
    expect(thirteen.receipt.assigned.mile).toEqual({ n13: null })
    expect(fillCard(twelve.presets.mile, 12, 5)).toBe('speed-e1')
  })

  it('turns a new Extra Stats node on in every preset with room, and adds Inspiration in slot order', () => {
    let build = withPresets(emptyBuild(null), (d) => ({ activeExtraNodes: d === 'long' ? ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7'] : [] }))
    const committed = commitUnlocks(build, S(1), [fixed('single', 'speed-01'), fixed('slot', 'parent1'), fixed('slot', 'parent0'), fixed('unique', 'parent1')])
    build = committed.build
    expect(build.extraNodes).toEqual(['speed-01'])
    expect(build.presets.mile.activeExtraNodes).toEqual(['speed-01'])
    expect(build.presets.long.activeExtraNodes).toHaveLength(7)
    expect(committed.receipt.activated).toEqual({ sprint: ['speed-01'], mile: ['speed-01'], medium: ['speed-01'], long: [] })
    expect(build.inspiration).toEqual({ slots: ['parent0', 'parent1'], uniques: ['parent1'], golds: [] })
  })

  it('adds bonds and names them for the "ever bonded" record, and skips what is already open', () => {
    const build = commitUnlocks(emptyBuild(null), S(1), [bond('speed-e1', S(1)), node(1)])
    expect(build.build.bonds).toEqual(['speed-e1'])
    expect(build.receipt.bonded).toEqual(['speed-e1'])
    expect(build.receipt.opened.map((entry) => entry.target)).toEqual(['speed-e1', 'n1'])
    const again = commitUnlocks(build.build, S(1), [bond('speed-e1', S(1)), node(1)])
    expect(again.build).toBe(build.build)
    expect(again.receipt).toMatchObject({ opened: [], bonded: [] })
  })

  it('throws on what a plan would have refused: a later layer, or a missing dependency', () => {
    expect(() => commitUnlocks(emptyBuild(null), S(1), [node(13)])).toThrow(RangeError)
    expect(() => commitUnlocks(emptyBuild(null), S(1), [node(2)])).toThrow(/needs node:n1/)
    expect(() => commitUnlocks(emptyBuild(null), S(2), [fixed('duo', 'duo-power-speed-3')])).toThrow(RangeError)
  })

  it('opens the whole tier, 89 fixed unlocks, in canonical order', () => {
    const all = commitUnlocks(emptyBuild(null), S(5), FIXED_UNLOCKS).build
    expect(all.constellationOpened).toBe(28)
    expect(all.inspiration.slots).toHaveLength(6)
    expect(all.inspiration.uniques).toHaveLength(6)
    expect(all.inspiration.golds).toHaveLength(12)
    expect(all.extraNodes).toEqual(EXTRA_NODE_IDS)
    expect(all.presets.mile.activeExtraNodes).toEqual(EXTRA_NODE_IDS.slice(0, 15))
  })
})

describe('the advance', () => {
  /** Colt at scenario 2's gate with her career won, holding a full scenario 2 build in different sets per preset. */
  function atGate(): ReworkState {
    const unlocked = ok(unlockUma(newAccount(0), { outfitId: COLT.id }, 1, { content: CONTENT })).state
    const uma = placeUma(unlocked.umas[COLT.id]!, { tier: 1, scenario: 2, level: 20, careerWon: true })
    const sets: Record<DistanceCategory, string[]> = {
      sprint: ['speed-e1', 'speed-e1b', 'wit-e1', 'power-e1', 'guts-e1', 'friend-e1'],
      mile: ['speed-e1', 'wit-e1', 'stamina-e1', 'wit-e1b', 'friend-e1', 'power-e2'],
      medium: ['stamina-e1', 'stamina-e1b', 'speed-e2', 'wit-e1', 'guts-e1', 'friend-e1'],
      long: [],
    }
    let build = withPresets({ ...emptyBuild(uma.build.presets.mile.loadoutSkillIds[0]!), bonds: [...new Set(Object.values(sets).flat())] }, (d) => ({ cardSetIds: sets[d] }))
    build = commitUnlocks(build, S(2), [...layerUnlocks(1), ...layerUnlocks(2)]).build
    // Long turns its Extra Stats around: the last nine instead of the first.
    build = withPresets(build, (d, preset) => (d === 'long' ? { activeExtraNodes: build.extraNodes.slice(-9) } : { activeExtraNodes: preset.activeExtraNodes }))
    return { ...unlocked, umas: { [COLT.id]: { ...uma, build } } }
  }

  it('keeps every card on its node id in all four presets, and fills raised capacity with opened nodes, oldest first', () => {
    const state = atGate()
    const before = state.umas[COLT.id]!.build
    expect(before.extraNodes).toHaveLength(15)
    expect(before.presets.mile.activeExtraNodes).toEqual(before.extraNodes.slice(0, 9))
    const result = ok(advanceScenario(state, { umaId: COLT.id }, 500, { content: CONTENT }))
    const after = result.state.umas[COLT.id]!
    expect(after.scenario).toBe(3)
    for (const distance of DISTANCE_CATEGORIES) {
      expect(after.build.presets[distance].assignments).toEqual(before.presets[distance].assignments)
      expect(after.build.presets[distance].cardSetIds).toEqual(before.presets[distance].cardSetIds)
      expect(after.build.presets[distance].lineage).toEqual(before.presets[distance].lineage)
      expect(after.build.presets[distance].loadoutSkillIds).toEqual(before.presets[distance].loadoutSkillIds)
    }
    expect(after.build.presets.mile.activeExtraNodes).toEqual(before.extraNodes.slice(0, 11))
    expect(after.build.presets.long.activeExtraNodes).toEqual([...before.extraNodes.slice(-9), ...before.extraNodes.slice(0, 2)])
    expect(result.receipt.activated.mile).toEqual(before.extraNodes.slice(9, 11))
    expect(result.receipt).toMatchObject({ from: { tier: 1, scenario: 2 }, to: { tier: 1, scenario: 3 } })
    expect(after.build.constellationOpened).toBe(before.constellationOpened)
    expect(after.build.bonds).toBe(before.bonds)
  })

  it("refuses as the tier rules do, and carries nothing when there's no room", () => {
    const state = atGate()
    const notReady = { ...state, umas: { [COLT.id]: { ...state.umas[COLT.id]!, racing: { level: 19, exp: 0 } } } }
    expect(advanceScenario(notReady, { umaId: COLT.id }, 1, { content: CONTENT })).toMatchObject({ refused: true, code: 'not-at-gate' })
    const empty = emptyBuild(null)
    expect(carryOnAdvance(empty, S(3)).build).toBe(empty)
  })
})

describe('preset edits', () => {
  /** Colt in tier 1 at `scenario`, with Mom, Dad and Gran owned, these bonds and the first `nodes` nodes open. */
  function account(scenario: number, bonds: string[], nodes = 0, extra: Unlock[] = []): ReworkState {
    let state: ReworkState = newAccount(0)
    for (const id of [COLT.id, MOM.id, DAD.id, GRAN.id, GRAMPS.id, MOM_ALT.id, GROWER.id]) state = ok(unlockUma(state, { outfitId: id }, 1, { content: TIER_AND_TRAINING })).state
    const uma = placeUma(state.umas[COLT.id]!, { tier: 1, scenario: scenario as 1, level: 10 * (scenario - 1) + 1 }, TIER_AND_TRAINING)
    const build = commitUnlocks({ ...uma.build, bonds }, S(scenario), [...Array.from({ length: nodes }, (_, i) => node(i + 1)), ...extra]).build
    return { ...state, umas: { ...state.umas, [COLT.id]: { ...uma, build } } }
  }
  const colt = (state: ReworkState): UmaState => state.umas[COLT.id]!
  const content = { content: TRAINING_CONTENT }

  describe('set-card-set', () => {
    const bonds = ['speed-e1', 'speed-e1b', 'wit-e1', 'wit-e1-twin', 'stamina-e1', 'friend-e1', 'power-e2', 'guts-e1', 'speed-e3']
    it('takes up to six bonded cards of an era her scenario allows', () => {
      const state = account(2, bonds)
      const set = ok(setCardSet(state, { umaId: COLT.id, preset: 'mile', cardSetIds: ['speed-e1', 'wit-e1', 'power-e2'] }, 5, content))
      expect(colt(set.state).build.presets.mile.cardSetIds).toEqual(['speed-e1', 'wit-e1', 'power-e2'])
      expect(colt(set.state).build.presets.sprint.cardSetIds).toEqual([])
    })

    it('refuses an unbonded card, a card twice, a character twice, a past era and a seventh card', () => {
      const state = account(2, bonds)
      const set = (cardSetIds: string[]) => setCardSet(state, { umaId: COLT.id, preset: 'mile', cardSetIds }, 5, content)
      expect(set(['speed-e1', 'wit-e2'])).toEqual({ refused: true, code: 'not-bonded', reason: "{card} isn't bonded to {uma} yet.", data: { card: 'wit-e2', uma: COLT.id } })
      expect(set(['speed-e1', 'speed-e1'])).toMatchObject({ code: 'duplicate', data: { item: 'speed-e1' } })
      expect(set(['speed-e1', 'wit-e1-twin'])).toMatchObject({ code: 'duplicate-character', data: { card: 'wit-e1-twin', other: 'speed-e1' } })
      expect(set(['speed-e3'])).toMatchObject({ code: 'card-era', data: { scenario: 3, name: 'Trackblazer' } })
      expect(set(['speed-e1', 'speed-e1b', 'wit-e1', 'stamina-e1', 'friend-e1', 'power-e2', 'guts-e1'])).toMatchObject({ code: 'set-size', data: { max: 6 } })
      expect(setCardSet(state, { umaId: 'nobody', preset: 'mile', cardSetIds: [] }, 5, content)).toMatchObject({ code: 'unknown-uma' })
    })

    it('hands a replaced card its nodes and empties a removed one (D129), as today', () => {
      let state = account(2, bonds)
      state = ok(setCardSet(state, { umaId: COLT.id, preset: 'mile', cardSetIds: ['speed-e1', 'wit-e1', 'stamina-e1'] }, 5, content)).state
      const uma = colt(state)
      state = { ...state, umas: { ...state.umas, [COLT.id]: { ...uma, build: commitUnlocks(uma.build, S(2), Array.from({ length: 9 }, (_, i) => node(i + 1))).build } } }
      expect(colt(state).build.presets.mile.assignments).toEqual({ n1: 'speed-e1', n2: 'wit-e1', n3: 'stamina-e1', n4: 'speed-e1', n5: 'wit-e1', n6: 'stamina-e1', n7: 'speed-e1', n8: 'wit-e1', n9: 'stamina-e1' })
      const replaced = ok(setCardSet(state, { umaId: COLT.id, preset: 'mile', cardSetIds: ['speed-e1', 'power-e2'] }, 6, content))
      expect(colt(replaced.state).build.presets.mile.assignments).toEqual({ n1: 'speed-e1', n2: 'power-e2', n4: 'speed-e1', n5: 'power-e2', n7: 'speed-e1', n8: 'power-e2' })
      expect(replaced.receipt).toMatchObject({ handedOver: { 'wit-e1': 'power-e2' }, emptied: ['n3', 'n6', 'n9'] })
    })

    it('hands nodes over as D129 does: a slot replaced by a card new to the set hands its nodes over', () => {
      const cases: [string[], string[], Record<string, string>, Record<string, string>][] = [
        [['a', 'b', 'c'], ['a', 'd', 'c'], { n1: 'a', n2: 'b', n3: 'c', n4: 'b' }, { n1: 'a', n2: 'd', n3: 'c', n4: 'd' }],
        [['a', 'b', 'c'], ['a', 'c'], { n1: 'b', n2: 'c' }, { n2: 'c' }],
        [['a', 'b'], ['c', 'd', 'e'], { n1: 'a', n2: 'b', n5: 'a' }, { n1: 'c', n2: 'd', n5: 'c' }],
        [['a', 'b', 'c'], ['b', 'a'], { n1: 'a', n2: 'c' }, { n1: 'a' }],
        [[], ['a'], {}, {}],
      ]
      for (const [before, after, assignments, expected] of cases) {
        expect(handOverNodes(before, after, assignments).assignments).toEqual(expected)
      }
    })
  })

  describe('set-assignments', () => {
    it('places set cards on open nodes under the per-card cap', () => {
      let state = account(1, ['speed-e1', 'wit-e1'], 6)
      state = ok(setCardSet(state, { umaId: COLT.id, preset: 'sprint', cardSetIds: ['speed-e1', 'wit-e1'] }, 5, content)).state
      const done = ok(setAssignments(state, { umaId: COLT.id, preset: 'sprint', assignments: { n3: 'speed-e1', n1: 'speed-e1', n2: 'speed-e1', n6: 'wit-e1' } }, 6))
      expect(colt(done.state).build.presets.sprint.assignments).toEqual({ n1: 'speed-e1', n2: 'speed-e1', n3: 'speed-e1', n6: 'wit-e1' })
      const assign = (assignments: Record<string, string>) => setAssignments(state, { umaId: COLT.id, preset: 'sprint', assignments }, 6)
      expect(assign({ n7: 'speed-e1' })).toEqual({ refused: true, code: 'node-locked', reason: "{node} isn't open yet.", data: { node: 'node 7' } })
      expect(assign({ n0: 'speed-e1' })).toMatchObject({ code: 'node-locked' })
      expect(assign({ n1: 'stamina-e1' })).toMatchObject({ code: 'not-in-set', data: { card: 'stamina-e1' } })
      expect(assign({ n1: 'speed-e1', n2: 'speed-e1', n3: 'speed-e1', n4: 'speed-e1' })).toMatchObject({ code: 'node-cap', data: { card: 'speed-e1', cap: 3 } })
    })
  })

  describe('set-lineage', () => {
    const open = (scenario: number) => account(scenario, [], 0, [fixed('slot', 'parent0'), fixed('slot', 'parent1'), fixed('slot', 'parent0-gp0'), fixed('slot', 'parent1-gp0')])
    const lineage = (state: ReworkState, picks: Record<string, string>) =>
      setLineage(state, { umaId: COLT.id, preset: 'medium', lineage: picks }, 7, { content: TRAINING_CONTENT })

    it('seats owned Umas in open slots', () => {
      const done = ok(lineage(open(2), { parent0: MOM.id, parent1: DAD.id, 'parent0-gp0': GRAN.id }))
      expect(colt(done.state).build.presets.medium.lineage).toEqual({ parent0: MOM.id, parent1: DAD.id, 'parent0-gp0': GRAN.id })
    })

    it('refuses a closed slot, herself, an Uma never owned, and a repeated character', () => {
      const state = open(2)
      expect(lineage(state, { 'parent0-gp1': GRAN.id })).toMatchObject({ code: 'slot-not-open' })
      expect(lineage(state, { parent0: COLT.id })).toMatchObject({ code: 'lineage', data: { why: "that's her" } })
      expect(lineage(state, { parent0: STRANGER.id })).toMatchObject({ code: 'lineage', data: { why: "she isn't in your Stable" } })
      expect(lineage(state, { parent0: MOM.id, parent1: MOM_ALT.id })).toMatchObject({ code: 'lineage', data: { candidate: MOM_ALT.id } })
      expect(lineage(state, { parent0: MOM.id, 'parent0-gp0': MOM_ALT.id })).toMatchObject({ code: 'lineage' })
      // The same grandparent outfit may mirror once across sides (D250).
      expect(isRefusal(lineage(state, { 'parent0-gp0': GRAN.id, 'parent1-gp0': GRAN.id }))).toBe(false)
    })

    it('lets Legends seat any Uma in the first parent slot', () => {
      const tier2 = (() => {
        const state = open(2)
        const uma = colt(state)
        return { ...state, umas: { ...state.umas, [COLT.id]: { ...uma, tier: 2 as const, scenario: 5 as const } } }
      })()
      expect(isRefusal(lineage(tier2, { parent0: STRANGER.id }))).toBe(false)
      expect(lineage(tier2, { parent1: STRANGER.id })).toMatchObject({ code: 'lineage' })
      expect(SPRINTER.id in tier2.umas).toBe(false)
    })
  })

  describe('set-active-nodes', () => {
    const extra = ['stamina-01', 'wit-01', 'power-01', 'speed-01', 'guts-01', 'stamina-03', 'wit-03', 'power-03', 'speed-03', 'guts-03', 'duo-stamina-wit-3']
    it('turns opened nodes on up to the capacity, kept oldest opened first', () => {
      const state = account(2, [], 0, extra.map((id) => fixedUnlock({ kind: id.startsWith('duo') ? 'duo' : 'single', target: id })!))
      expect(colt(state).build.presets.long.activeExtraNodes).toEqual(extra.slice(0, 9))
      const done = ok(setActiveNodes(state, { umaId: COLT.id, preset: 'long', nodeIds: ['duo-stamina-wit-3', 'stamina-03', 'wit-01'] }, 8))
      expect(done.receipt.activeExtraNodes).toEqual(['wit-01', 'stamina-03', 'duo-stamina-wit-3'])
      const set = (nodeIds: string[]) => setActiveNodes(state, { umaId: COLT.id, preset: 'long', nodeIds }, 8)
      expect(set(extra.slice(0, 10))).toEqual({ refused: true, code: 'over-capacity', reason: 'Only {capacity} Extra Stats can be on at once.', data: { capacity: 9 } })
      expect(set(['speed-05'])).toMatchObject({ code: 'node-locked', data: { node: 'Speed grade 5' } })
      expect(set(['wit-01', 'wit-01'])).toMatchObject({ code: 'duplicate', data: { item: 'Wit grade 1' } })
    })
  })

  describe('set-loadout', () => {
    function grower(): ReworkState {
      const state = account(2, [])
      const uma = placeUma({ ...state.umas[GROWER.id]!, build: { ...emptyBuild(GROWER.uniqueSkillId) } }, { tier: 1, scenario: 2, level: 11 }, TIER_AND_TRAINING)
      return { ...state, umas: { ...state.umas, [GROWER.id]: { ...uma, build: commitUnlocks(uma.build, S(2), Array.from({ length: 16 }, (_, i) => node(i + 1))).build } } }
    }
    const loadout = (state: ReworkState, skillIds: string[]) => setLoadout(state, { umaId: GROWER.id, preset: 'mile', skillIds }, 9, { content: TRAINING_CONTENT })

    it("equips library skills after her unique, within her SP", () => {
      const state = grower()
      const sp = deriveBuild({ at: S(2), build: state.umas[GROWER.id]!.build, preset: 'mile', template: GROWER, content: TRAINING_CONTENT }).skillPoints
      expect(sp).toBe(960)
      const done = ok(loadout(state, []))
      expect(done.receipt).toMatchObject({ loadoutSkillIds: ['u-grower'], cost: 0, skillPoints: 960 })
      expect(ok(loadout(state, ['u-grower'])).receipt.loadoutSkillIds).toEqual(['u-grower'])
    })

    it('refuses a skill outside her library, one the races cannot run, a skill twice, and a loadout over her SP', () => {
      const state = grower()
      expect(loadout(state, ['hint1-speed-e1'])).toMatchObject({ code: 'skill-unavailable', data: { skill: 'hint1-speed-e1' } })
      expect(loadout(state, ['no-effect'])).toMatchObject({ code: 'skill-unavailable', data: { skill: 'no-effect' } })
      expect(loadout(state, ['expensive', 'expensive'])).toMatchObject({ code: 'duplicate' })
      expect(loadout(state, ['expensive'])).toEqual({ refused: true, code: 'over-sp', reason: 'That loadout needs {cost} SP. She has {sp}.', data: { cost: 5000, sp: 960 } })
    })

    it('lets an overdrawn loadout change when it costs no more (D196)', () => {
      const state = grower()
      const uma = state.umas[GROWER.id]!
      const overdrawn = { ...state, umas: { ...state.umas, [GROWER.id]: { ...uma, build: { ...uma.build, presets: { ...uma.build.presets, mile: { ...uma.build.presets.mile, loadoutSkillIds: ['u-grower', 'expensive'] } } } } } }
      expect(ok(loadout(overdrawn, ['expensive'])).receipt.cost).toBe(5000)
      expect(ok(loadout(overdrawn, [])).receipt.loadoutSkillIds).toEqual(['u-grower'])
    })

    it('prices a loadout as set-loadout does, before it is made, and names the skills no Equip can take (T138)', () => {
      const uma = grower().umas[GROWER.id]!
      expect(loadoutSummary(uma, 'mile', TRAINING_CONTENT)).toEqual({ cost: 0, skillPoints: 960, entries: [], unequippable: ['no-effect'] })
      const priced = loadoutSummary(uma, 'mile', TRAINING_CONTENT, ['u-grower', 'expensive'])
      expect(priced).toMatchObject({ cost: 5000, skillPoints: 960, entries: [{ skillId: 'expensive', cost: 5000 }] })
      expect(loadout(grower(), ['expensive'])).toMatchObject({ code: 'over-sp', data: { cost: priced.cost, sp: priced.skillPoints } })
    })
  })
})
