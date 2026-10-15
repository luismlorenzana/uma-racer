// Stats after the rework (docs/rework/03-uma-progression.md §8, docs/rework/04-tiers-and-promotion.md §8,
// docs/rework/06-cards-and-bonds.md §1, §4): exact invariance, every card at 100%, Extra Stats flat and unbuffed but for
// Foundation, each reviewed buff, aptitudes, uniques and golds only once opened, SP and the full Race Bonus.
import { describe, expect, it } from 'vitest'
import { COLT } from '../../__fixtures__/rework-tiers'
import { DAD, GRAN, GROWER, MOM, TRAINING_CONTENT, cardOf } from '../../__fixtures__/rework-training'
import { MAX_STARS, cardRaceBonus } from '../../cards'
import { CARD_TYPE_SHARES, eraPct } from '../../constellation'
import { treeCardNodesAt, perCardCap } from '../constellation/sizes'
import { tierAndScenario } from '../tiers/map'
import { capProfileAt, extraBudgetAt, nodeValue, spCapAt } from '../tiers/scaling'
import { emptyBuild, type ScenarioAt, type UmaBuild } from '../types'
import { STATS, type Stats } from '../../types'
import { commitUnlocks } from './build'
import { cardNodeSkills, cardPay, deriveBuild, lineagePays, type DeriveBuildInput } from './derive'
import { EXTRA_NODE_IDS, extraCapacity } from './extra'
import { reworkSpNodeValue } from './skill-points'
import { FIXED_UNLOCKS, fixedUnlock } from './unlocks'
import type { InspirationSlot } from '../../inspiration'

const atT = (T: number): ScenarioAt => tierAndScenario(T)

interface Setup {
  readonly T: number
  /** Card ids in set order; each is bonded. */
  readonly cards: readonly string[]
  /** Card per node in order n1, n2 …; null leaves a node empty. Defaults to the cards' fair shares in order. */
  readonly nodes?: readonly (string | null)[]
  readonly opened?: number
  readonly extra?: readonly string[]
  readonly lineage?: Partial<Record<InspirationSlot, string>>
  readonly slots?: readonly InspirationSlot[]
  readonly uniques?: readonly InspirationSlot[]
  readonly golds?: readonly string[]
}

function build(setup: Setup): UmaBuild {
  const N = treeCardNodesAt(setup.T)
  const opened = setup.opened ?? N
  const nodes = setup.nodes ?? Array.from({ length: opened }, (_, i) => setup.cards[i % Math.max(1, setup.cards.length)] ?? null)
  const assignments = Object.fromEntries(nodes.flatMap((cardId, i) => (cardId === null ? [] : [[`n${i + 1}`, cardId]])))
  const base = emptyBuild(null)
  return {
    ...base,
    constellationOpened: opened,
    bonds: [...setup.cards],
    extraNodes: [...(setup.extra ?? [])],
    inspiration: { slots: [...(setup.slots ?? [])], uniques: [...(setup.uniques ?? [])], golds: [...(setup.golds ?? [])] },
    presets: { ...base.presets, mile: { cardSetIds: [...setup.cards], assignments, lineage: setup.lineage ?? {}, activeExtraNodes: [...(setup.extra ?? [])], loadoutSkillIds: [] } },
  }
}

const derive = (setup: Setup, extra: Partial<DeriveBuildInput> = {}) =>
  deriveBuild({ at: atT(setup.T), build: build(setup), preset: 'mile', template: COLT, content: TRAINING_CONTENT, ...extra })
const sum = (stats: Stats) => STATS.reduce((total, stat) => total + stats[stat], 0)

describe('card nodes', () => {
  it('pay nodeValue × eraPct × share at 100%, with no stars, and a full build of current-era stat cards reaches N × node + E', () => {
    for (const T of [1, 5, 8, 14]) {
      const N = treeCardNodesAt(T)
      const cards = ['speed', 'stamina', 'power', 'guts', 'wit'].map((type) => `${type}-e${T}`)
      const nodes = Array.from({ length: N }, (_, i) => cards[i % cards.length]!)
      const fullExtra = EXTRA_NODE_IDS.slice(0, extraCapacity(atT(T).scenario)).filter((id) => fixedUnlock({ kind: id.startsWith('duo') ? 'duo' : id.startsWith('sun') ? 'sun' : 'single', target: id })!.layer <= atT(T).scenario)
      const derived = derive({ T, cards, nodes, extra: fullExtra }, { buffs: false })
      expect(derived.cardRawTotal).toBe(N * nodeValue(T))
      expect(sum(derived.extra)).toBe(extraBudgetAt(T))
    }
    const one = derive({ T: 3, cards: ['speed-e1'], nodes: ['speed-e1'] }, { buffs: false })
    // 173 × 90% × 70% and × 30%, exact.
    expect(one.cardRaw).toEqual({ speed: (nodeValue(3) * eraPct(1, 3) * 70) / 10_000, stamina: 0, power: (nodeValue(3) * eraPct(1, 3) * 30) / 10_000, guts: 0, wit: 0 })
    expect(one.cardRaw).toEqual({ speed: 108.99, stamina: 0, power: 46.71, guts: 0, wit: 0 })
  })

  it('never change a raw total when a card moves between nodes (D126), under every buff', () => {
    for (let T = 1; T <= 15; T += 1) {
      const N = treeCardNodesAt(T)
      const cards = ['speed', 'wit', 'stamina', 'power', 'guts', 'friend'].map((type) => `${type}-e${Math.max(1, T - 2)}`)
      const cap = perCardCap(N)
      const nodes = Array.from({ length: N }, (_, i) => (i < cards.length * cap ? cards[Math.floor(i / cap)]! : null)).slice(0, N)
      const shuffled = [...nodes].reverse()
      const rotated = [...nodes.slice(5), ...nodes.slice(0, 5)]
      const a = derive({ T, cards, nodes, extra: ['speed-01'] }, { goalsWon: 2 })
      for (const moved of [shuffled, rotated]) {
        const b = derive({ T, cards, nodes: moved, extra: ['speed-01'] }, { goalsWon: 2 })
        expect(b.cardRaw, `T${T}`).toEqual(a.cardRaw)
        expect(b.skillPoints).toBe(a.skillPoints)
        expect(b.stats).toEqual(a.stats)
      }
    }
  })

  it('pay nothing past a card\'s cap, on a locked node, or from an unbonded or too-new card', () => {
    const cap = perCardCap(12)
    const capped = derive({ T: 1, cards: ['speed-e1'], nodes: Array(cap + 1).fill('speed-e1') }, { buffs: false })
    expect(capped.filledNodes).toBe(cap)
    expect(derive({ T: 1, cards: ['speed-e1'], nodes: ['speed-e1', 'speed-e1'], opened: 1 }, { buffs: false }).filledNodes).toBe(1)
    const unbonded = build({ T: 1, cards: ['speed-e1'], nodes: ['speed-e1'] })
    expect(deriveBuild({ at: atT(1), build: { ...unbonded, bonds: [] }, preset: 'mile', template: COLT, content: TRAINING_CONTENT }).cardRawTotal).toBe(0)
    expect(derive({ T: 1, cards: ['speed-e2'], nodes: ['speed-e2'] }).cardRawTotal).toBe(0)
  })

  it('grow card points only; Extra Stats add flat after growth; caps clamp', () => {
    const setup: Setup = { T: 2, cards: ['speed-e2'], nodes: ['speed-e2'], extra: ['speed-01'] }
    const derived = deriveBuild({ at: atT(2), build: build(setup), preset: 'mile', template: GROWER, content: TRAINING_CONTENT, buffs: false })
    expect(derived.stats.speed).toBe(Math.round(100 + derived.cardRaw.speed * 1.2 + 40))
    expect(derived.stats.power).toBe(Math.round(100 + derived.cardRaw.power))
    const huge = { ...GROWER, baseStats: { ...GROWER.baseStats, speed: 5000 } }
    expect(deriveBuild({ at: atT(2), build: build(setup), preset: 'mile', template: huge, content: TRAINING_CONTENT }).stats.speed).toBe(capProfileAt(2).speed)
  })
})

describe('Extra Stats', () => {
  it('pay up to the capacity, opened nodes only, oldest first', () => {
    const opened = EXTRA_NODE_IDS.slice(0, 15)
    const derived = derive({ T: 2, cards: [], extra: opened }, { buffs: false })
    expect(derived.activeExtraNodes).toEqual(opened.slice(0, 9))
    expect(sum(derived.extra)).toBe(9 * 40)
    const closed = build({ T: 2, cards: [], extra: ['speed-01'] })
    expect(deriveBuild({ at: atT(2), build: { ...closed, extraNodes: [] }, preset: 'mile', template: COLT, content: TRAINING_CONTENT }).extra.speed).toBe(0)
  })

  it('are buffed by Foundation alone: ×1.5 in URA Finale, untouched by Research or Shared Light', () => {
    expect(derive({ T: 1, cards: [], extra: ['speed-01', 'wit-01'] }).extra).toMatchObject({ speed: 60, wit: 60 })
    expect(derive({ T: 9, cards: ['speed-e9'], nodes: ['speed-e9'], extra: ['speed-01'] }).extra.speed).toBe(50)
    const light = derive({ T: 13, cards: ['speed-e13'], nodes: ['speed-e13'], extra: ['stamina-01', 'guts-01'] })
    expect(light.extra).toMatchObject({ stamina: 60, guts: 60 })
  })
})

describe('the reviewed buffs (04 §8)', () => {
  /** A buff's percentage on one card's nodes: its raw with the buff ÷ without, minus one. */
  const lift = (setup: Setup, extra: Partial<DeriveBuildInput> = {}, cardId = setup.cards[0]!): number => {
    const on = derive(setup, extra)
    const off = derive(setup, { ...extra, buffs: false })
    const card = cardOf(cardId)
    const main = Object.entries(CARD_TYPE_SHARES[card.type]).sort((a, b) => b[1]! - a[1]!)[0]![0] as keyof Stats
    return Math.round((on.cardRaw[main] / off.cardRaw[main] - 1) * 1000) / 10
  }

  it('Team Spirit: +1% per filled open slot (D346)', () => {
    const base: Setup = { T: 2, cards: ['speed-e2'], nodes: ['speed-e2'], slots: ['parent0', 'parent1', 'parent0-gp0'] }
    expect(lift({ ...base, lineage: { parent0: MOM.id, parent1: DAD.id, 'parent0-gp0': GRAN.id } })).toBe(3)
    expect(lift({ ...base, lineage: { parent0: MOM.id, 'parent1-gp1': DAD.id } })).toBe(1)
  })

  it('Climax: +2% per goal won, up to +8%', () => {
    const base: Setup = { T: 3, cards: ['speed-e3'], nodes: ['speed-e3'] }
    expect(lift(base, { goalsWon: 3 })).toBe(6)
    expect(lift(base, { goalsWon: 6 })).toBe(8)
  })

  it('Performance: +5% with a Speed, Stamina, Power, Guts and Wit card', () => {
    const five = ['speed', 'stamina', 'power', 'guts', 'wit'].map((type) => `${type}-e4`)
    expect(lift({ T: 4, cards: five })).toBe(5)
    expect(lift({ T: 4, cards: five.slice(0, 4) })).toBe(0)
  })

  it('Fragments: cards of era 4 or older +8%', () => {
    expect(lift({ T: 5, cards: ['speed-e4', 'stamina-e5'] })).toBe(8)
    expect(lift({ T: 5, cards: ['speed-e4', 'stamina-e5'] }, {}, 'stamina-e5')).toBe(0)
    expect(lift({ T: 5, cards: ['speed-e1'] })).toBe(8)
  })

  it('New Wave: era 6 or newer +5%', () => {
    expect(lift({ T: 6, cards: ['speed-e6'] })).toBe(5)
    expect(lift({ T: 6, cards: ['speed-e5'] })).toBe(0)
  })

  it('Genres: a type held twice +6% on those cards', () => {
    expect(lift({ T: 7, cards: ['speed-e6', 'speed-e6b'] })).toBe(6)
    expect(lift({ T: 7, cards: ['speed-e6', 'wit-e6'] })).toBe(0)
  })

  it('Full Course: a card on its full cap +10%; Construction: a card on exactly its fair share +8%', () => {
    const cap = perCardCap(20)
    expect(lift({ T: 8, cards: ['speed-e8'], nodes: Array(cap).fill('speed-e8') })).toBe(10)
    expect(lift({ T: 8, cards: ['speed-e8'], nodes: Array(cap - 1).fill('speed-e8') })).toBe(0)
    expect(lift({ T: 11, cards: ['speed-e11'], nodes: ['speed-e11', 'speed-e11'] })).toBe(8)
    expect(lift({ T: 11, cards: ['speed-e11'], nodes: ['speed-e11', 'speed-e11', 'speed-e11'] })).toBe(0)
  })

  it('Research, Soak and Encore: their card types +10%', () => {
    expect(lift({ T: 9, cards: ['power-e9'] })).toBe(10)
    expect(lift({ T: 9, cards: ['wit-e9'] })).toBe(0)
    expect(lift({ T: 12, cards: ['guts-e12'] })).toBe(10)
    expect(lift({ T: 12, cards: ['speed-e12'] })).toBe(0)
    expect(lift({ T: 15, cards: ['wit-e15'] })).toBe(10)
    expect(lift({ T: 15, cards: ['speed-e15'] })).toBe(0)
  })

  it('Legends pays no stats; Foundation no card points', () => {
    expect(lift({ T: 10, cards: ['speed-e10'] })).toBe(0)
    expect(lift({ T: 1, cards: ['speed-e1'] })).toBe(0)
  })

  it('Shared Light: the two lowest stats from card nodes +8%', () => {
    const on = derive({ T: 13, cards: ['speed-e13', 'stamina-e13'], nodes: ['speed-e13', 'stamina-e13'] })
    const off = derive({ T: 13, cards: ['speed-e13', 'stamina-e13'], nodes: ['speed-e13', 'stamina-e13'] }, { buffs: false })
    // Speed and Stamina pay 70% of a node, Power and Guts 30%, Wit nothing: Wit and the first of the tied two are lifted.
    expect(on.cardRaw.wit).toBe(0)
    expect(on.cardRaw.speed).toBe(off.cardRaw.speed)
    expect(on.cardRaw.stamina).toBe(off.cardRaw.stamina)
    expect(on.cardRaw.power).toBe((off.cardRaw.power * 108) / 100)
    expect(on.cardRaw.guts).toBe(off.cardRaw.guts)
  })

  it('Orders: Friend and Group cards also pay a quarter of a node as stats', () => {
    const on = derive({ T: 14, cards: ['friend-e14'], nodes: ['friend-e14'] })
    const off = derive({ T: 14, cards: ['friend-e14'], nodes: ['friend-e14'] }, { buffs: false })
    expect(off.cardRawTotal).toBe(0)
    expect(on.cardRawTotal).toBe(nodeValue(14) / 4)
    expect(on.skillPoints).toBe(off.skillPoints)
  })
})

describe('skill points', () => {
  it('pay the open-tree baseline plus Friend and Group nodes at era and buff, up to the cap', () => {
    const plain = derive({ T: 1, cards: ['speed-e1'], nodes: [] })
    expect(plain.skillPoints).toBe(800)
    expect(derive({ T: 1, cards: ['friend-e1'], nodes: ['friend-e1', 'friend-e1'] }).skillPoints).toBe(2000)
    expect(derive({ T: 1, cards: ['friend-e1'], nodes: ['friend-e1', 'friend-e1', 'friend-e1'] }).skillPoints).toBe(spCapAt(1))
    expect(derive({ T: 1, cards: ['speed-e1'], nodes: [], opened: 6 }).skillPoints).toBe(400)
    // An era-1 Friend card in Unity Cup pays 95%, and Team Spirit's +1% a slot reaches its SP too (D165).
    const at2 = derive({ T: 2, cards: ['friend-e1'], nodes: ['friend-e1'], opened: 16, slots: ['parent0'], lineage: { parent0: MOM.id } })
    expect(at2.skillPoints).toBe(960 + Math.round(reworkSpNodeValue(2) * 0.95 * 1.01))
  })
})

describe('lineage', () => {
  const lineage = { parent0: MOM.id, parent1: DAD.id, 'parent0-gp0': GRAN.id, 'parent1-gp0': GRAN.id }
  const slots: InspirationSlot[] = ['parent0', 'parent1', 'parent0-gp0', 'parent1-gp0']

  it('pays aptitudes from filled open slots only', () => {
    const open = derive({ T: 2, cards: [], slots, lineage })
    expect(Object.keys(open.lineage)).toEqual(slots)
    expect(derive({ T: 2, cards: [], slots: ['parent0'], lineage }).lineage).toEqual({ parent0: MOM })
    const dirt = derive({ T: 2, cards: [], slots, lineage: { parent0: 'dirt-a', parent1: 'dirt-b', 'parent0-gp0': 'dirt-c' } })
    expect(dirt.aptitudes.surface.dirt).toBe('E')
    expect(derive({ T: 2, cards: [], slots: ['parent0'], lineage: { parent0: 'dirt-a' } }).aptitudes.surface.dirt).toBe('G')
  })

  it('pays whites at once, golds through opened positions and the inherited unique once opened', () => {
    const library = (setup: Partial<Setup>) => derive({ T: 2, cards: [], slots, lineage, ...setup }).library.map((skill) => skill.skillId)
    const none = library({})
    expect(none).toEqual(expect.arrayContaining(['w1-mom', 'w2-mom', 'w1-dad', 'w1-gran']))
    expect(none).not.toContain('g1-mom')
    expect(none).not.toContain('i-mom')
    const opened = library({ golds: ['parent0:gold1', 'parent1:gold0'], uniques: ['parent0'] })
    expect(opened).toEqual(expect.arrayContaining(['g2-mom', 'g1-dad', 'i-mom']))
    expect(opened).not.toContain('g1-mom')
    expect(opened).not.toContain('i-dad')
  })

  it("names what a slot pays (lineagePays): gold position k pays her k-th natural gold, and her inherited unique (T139)", () => {
    const pays = lineagePays(MOM, TRAINING_CONTENT.skills)
    expect(pays).toEqual({ golds: ['g1-mom', 'g2-mom'], unique: 'i-mom' })
    for (const [index, skillId] of pays.golds.entries()) {
      const paid = derive({ T: 2, cards: [], slots, lineage, golds: [`parent0:gold${index}`] }).library.map((skill) => skill.skillId)
      expect(paid).toContain(skillId)
      expect(paid).not.toContain(pays.golds[1 - index])
    }
    expect(derive({ T: 2, cards: [], slots, lineage, uniques: ['parent0'] }).library.map((skill) => skill.skillId)).toContain(pays.unique)
    expect(lineagePays({ ...MOM, awakeningSkillIds: ['w1-mom', 'g2-mom'], uniqueSkillId: null }, TRAINING_CONTENT.skills)).toEqual({ golds: ['g2-mom'], unique: null })
  })

  it("prices a single-side grandparent's golds and unique 2×, and a mirror's at normal SP (D250)", () => {
    const mirrored = derive({ T: 2, cards: [], slots, lineage, golds: ['parent0-gp0:gold0'], uniques: ['parent0-gp0'] })
    expect(mirrored.skillCostMultipliers.get('g1-gran')).toBe(1)
    expect(mirrored.skillCostMultipliers.get('i-gran')).toBe(1)
    const single = derive({ T: 2, cards: [], slots, lineage: { parent0: MOM.id, parent1: DAD.id, 'parent0-gp0': GRAN.id }, golds: ['parent0-gp0:gold0'], uniques: ['parent0-gp0'] })
    expect(single.skillCostMultipliers.get('g1-gran')).toBe(2)
    expect(single.skillCostMultipliers.get('i-gran')).toBe(2)
    expect(single.skillCostMultipliers.get('w1-gran')).toBe(1)
  })
})

describe('skills and Race Bonus', () => {
  it('pay each node its card\'s next gold and white, and the full Race Bonus of every set card', () => {
    const derived = derive({ T: 1, cards: ['speed-e1', 'wit-e1'], nodes: ['speed-e1', 'wit-e1', 'speed-e1'] })
    expect(derived.cardSkillIds).toEqual(['gold-speed-e1', 'hint1-speed-e1', 'gold-wit-e1', 'hint1-wit-e1', 'hint2-speed-e1'])
    expect(derived.raceBonus).toBe(cardRaceBonus(cardOf('speed-e1'), MAX_STARS) + cardRaceBonus(cardOf('wit-e1'), MAX_STARS))
    expect(derived.raceBonus).toBeGreaterThan(0)
    expect(derived.library.slice(0, 1)).toEqual([{ skillId: 'unique-colt', origin: 'own-unique', sourceId: COLT.id }])
  })

  it("names each paying node's skills: its card's next gold and white, by node id (T139)", () => {
    const derived = derive({ T: 1, cards: ['speed-e1', 'wit-e1'], nodes: ['speed-e1', 'wit-e1', 'speed-e1', null] })
    expect(derived.nodeSkillIds).toEqual({
      n1: ['gold-speed-e1', 'hint1-speed-e1'],
      n2: ['gold-wit-e1', 'hint1-wit-e1'],
      n3: ['hint2-speed-e1'],
    })
    expect(Object.values(derived.nodeSkillIds).flat()).toEqual(derived.cardSkillIds)
  })

  it('keeps only loadout skills her library holds', () => {
    const base = build({ T: 1, cards: ['speed-e1'], nodes: ['speed-e1'] })
    const withLoadout = { ...base, presets: { ...base.presets, mile: { ...base.presets.mile, loadoutSkillIds: ['unique-colt', 'hint1-speed-e1', 'gone'] } } }
    expect(deriveBuild({ at: atT(1), build: withLoadout, preset: 'mile', template: COLT, content: TRAINING_CONTENT }).loadoutSkillIds).toEqual(['unique-colt', 'hint1-speed-e1'])
  })

  it('derives the whole tier opened by the commit rule', () => {
    const all = commitUnlocks(emptyBuild(null), atT(5), FIXED_UNLOCKS).build
    const derived = deriveBuild({ at: atT(5), build: all, preset: 'mile', template: COLT, content: TRAINING_CONTENT })
    expect(derived.openNodes).toBe(28)
    expect(derived.activeExtraNodes).toHaveLength(15)
    expect(derived.skillPoints).toBe(1280)
  })
})

describe('cardPay: one card at a scenario, for the Card Library (06 §1, §4, §6; T138)', () => {
  it("times its nodes gives deriveBuild's cardRaw for that card alone with the buff off, at every era and node count", () => {
    for (const [cardId, T] of [['speed-e1', 1], ['speed-e1', 5], ['guts-e3', 4], ['power-e6', 9], ['wit-e11', 14]] as const) {
      const pay = cardPay(cardOf(cardId), T)
      const cap = perCardCap(treeCardNodesAt(T))
      expect(pay.nodeCap).toBe(cap)
      for (let n = 1; n <= cap; n += 1) {
        const nodes = Array.from({ length: n }, () => cardId)
        const derived = derive({ T, cards: [cardId], nodes, opened: n }, { buffs: false })
        for (const stat of STATS) expect(n * pay.perNode[stat]).toBeCloseTo(derived.cardRaw[stat], 9)
        expect(n * pay.perNodeTotal).toBeCloseTo(derived.cardRawTotal, 9)
      }
    }
  })

  it('splits a node by type at eraPct, largest share first', () => {
    const pay = cardPay(cardOf('speed-e1'), 3)
    expect(pay.eraPct).toBe(eraPct(1, 3))
    expect(pay.eraPct).toBe(90)
    expect(pay.split).toEqual([['speed', 70], ['power', 30]])
    expect(pay.perNode.speed).toBeCloseTo((nodeValue(3) * 90 * 70) / 10_000, 9)
    expect(pay.spPerNode).toBe(0)
    expect(cardPay(cardOf('guts-e1'), 1).split).toEqual([['guts', 60], ['speed', 20], ['power', 20]])
  })

  it("pays a Friend or Group card's SP per node as reworkSpNodeValue × eraPct, and no stats", () => {
    for (const [cardId, T] of [['friend-e1', 1], ['friend-e2', 5], ['group-e6', 8]] as const) {
      const pay = cardPay(cardOf(cardId), T)
      expect(pay.spPerNode).toBeCloseTo((reworkSpNodeValue(T) * eraPct(cardOf(cardId).era, T)) / 100, 9)
      expect(pay.split).toEqual([])
      expect(pay.perNodeTotal).toBe(0)
    }
  })

  it('carries the full Race Bonus, its eligibility, and the eraPct it keeps in each later playable scenario of the tier', () => {
    const pay = cardPay(cardOf('wit-e3'), 3)
    expect(pay.raceBonus).toBe(cardRaceBonus(cardOf('wit-e3'), MAX_STARS))
    expect(pay.eligible).toBe(true)
    expect(pay.later).toEqual([{ T: 4, eraPct: 95 }, { T: 5, eraPct: 90 }])
    expect(cardPay(cardOf('wit-e3'), 2).eligible).toBe(false)
    expect(cardPay(cardOf('wit-e3'), 5).later).toEqual([])
    // Tier 3 ends at the 14th until the 15th is in the catalogue (04 §2).
    expect(cardPay(cardOf('wit-e11'), 13).later).toEqual([{ T: 14, eraPct: 85 }])
  })

  it("lists the skills its nodes pay, golds first, each with the node that pays it (D182)", () => {
    expect(cardNodeSkills(cardOf('speed-e1'), TRAINING_CONTENT.skills)).toEqual([
      { skillId: 'gold-speed-e1', node: 1, gold: true },
      { skillId: 'hint1-speed-e1', node: 1, gold: false },
      { skillId: 'hint2-speed-e1', node: 2, gold: false },
    ])
  })
})
