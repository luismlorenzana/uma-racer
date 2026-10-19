// `pnpm sim:loop` in CI (docs/game/architecture.md#the-rework-modules cross-task acceptance #2 and #3; docs/game/12-economy-and-
// pacing.md §12): the baseline's three tiers, the heavy, one- and two-check-in variants for tier 1 and both probes, once
// per worker through `loopReport()`. Every 12 §12 range is checked; a known miss (D348) is `it.fails` with its measured
// value, so the day it passes this file says so. Then determinism, a second seed, conservation, the policies and the
// representative deck's demand.
import { describe, expect, it, vi } from 'vitest'
import { ledgerTotal } from '../economy/ledger'
import { DUOS, FEASTS, itemById, planetDish } from '../items/catalogue'
import { FAMILY_IDS, type FamilyId } from '../items/families'
import { FIXED_UNLOCKS } from '../training/unlocks'
import { SESSION_KIND } from '../work/types'
import { evaluateChecks, LOOP_CHECKS } from './checks'
import { dayOf, LOOP_EPOCH, localDay, loopRng, MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from './clock'
import { representativeDeck, tierDemand } from './demand'
import { deckCards, SIM_UMAS } from './fixtures'
import { BASELINE, LOOP_VARIANTS, NO_ITEM, simulateLoop } from './loop'
import {
  checkInsOn, EXPEDITION_RACES, expeditionRacesAt, expeditionWins, FOUNDING_ROSTER, HEAVY_RACES_PER_DAY, ROSTER_CAP, ticketPlan, upgradeOrder,
} from './policies'
import { loopReport } from './report'

// The whole file runs within a minute on a GitHub runner; each test may take up to two (T132 "Time budget").
vi.setConfig({ testTimeout: 120_000 })
const report = loopReport()
const SECOND_SEED = 7

describe("12 §12's checks (cross-task acceptance #3)", () => {
  for (const check of LOOP_CHECKS) {
    const test = check.knownMiss ? it.fails : it
    test(`${check.label}${check.knownMiss ? ` — known miss (D348): ${check.knownMiss}` : ''}`, () => {
      const result = report.checks.find((entry) => entry.check.id === check.id)!
      for (const value of result.values) {
        expect(value, check.label).not.toBeNull()
        if (check.min !== null) expect(value!).toBeGreaterThanOrEqual(check.min)
        if (check.max !== null) expect(value!).toBeLessThanOrEqual(check.max)
      }
      if (check.also) expect(check.also.holds(report), check.also.label).toBe(true)
    })
  }

  it('reads the founding cohort: 20 Umas, the roster growing to 25, three tiers, every scenario measured', () => {
    const founders = Object.values(report.baseline.logs.umas).filter((uma) => uma.founding)
    expect(founders).toHaveLength(FOUNDING_ROSTER)
    expect(Object.keys(report.baseline.state.umas)).toHaveLength(ROSTER_CAP)
    expect(report.baseline.metrics.scenarios.map((row) => `${row.tier}·${row.scenario}`)).toEqual([
      '1·1', '1·2', '1·3', '1·4', '1·5', '2·1', '2·2', '2·3', '2·4', '2·5', '3·1', '3·2', '3·3', '3·4',
    ])
    for (const row of report.baseline.metrics.scenarios) expect(row.days.n).toBe(FOUNDING_ROSTER)
    expect(report.baseline.logs.raceGuardHits).toBe(0)
  })
})

describe('determinism', () => {
  it('gives the same run for the same seed', () => {
    expect(simulateLoop(BASELINE, loopRng(BASELINE.seed))).toEqual(report.baseline)
  })

  it('meets the tier-1 checks on a second seed as on the first', () => {
    const baseline = simulateLoop({ ...LOOP_VARIANTS.baseline!, seed: SECOND_SEED }, loopRng(SECOND_SEED))
    const heavy = simulateLoop({ ...LOOP_VARIANTS.heavy!, seed: SECOND_SEED }, loopRng(SECOND_SEED))
    expect(baseline.metrics).not.toEqual(report.baseline.metrics)
    const results = evaluateChecks({ ...report, baseline, heavy })
    // Scenarios 2–5 of tier 1 vary by seed (about 20–30 days, D351); the committed seed pins them, these hold on every seed.
    for (const id of ['first-scenario', 'tier-1-weeks', 'slot-use', 'racing-target', 'racing-heavy']) {
      expect(results.find((entry) => entry.check.id === id)!.pass, id).toBe(true)
    }
  })
})

describe('conservation', () => {
  const { logs, state } = report.baseline

  it('never holds a negative stock', () => {
    for (const [id, count] of Object.entries(state.items)) expect(count, id).toBeGreaterThan(0)
  })

  it('cooks every dish a session took, and holds the rest', () => {
    for (const [id, reserved] of Object.entries(logs.reservedDishes)) expect(logs.cooked[id] ?? 0, id).toBeGreaterThanOrEqual(reserved)
    for (const [id, cooked] of Object.entries(logs.cooked)) expect(state.items[id] ?? 0, id).toBe(cooked - (logs.reservedDishes[id] ?? 0))
  })

  it('pays every unlock with exactly the one item it takes, or none (D375)', () => {
    const pending: Record<string, number> = {}
    for (const row of Object.values(state.work)) {
      for (const entry of row.entries) {
        if (entry.request.kind !== SESSION_KIND) continue
        for (const inputs of entry.inputs.slice(entry.collected)) for (const { item } of inputs) pending[item] = (pending[item] ?? 0) + 1
      }
    }
    const ids = new Set([...Object.keys(logs.reservedDishes), ...Object.keys(logs.unlockDishes)].filter((id) => id !== NO_ITEM))
    for (const id of ids) expect((logs.unlockDishes[id] ?? 0) + (pending[id] ?? 0), id).toBe(logs.reservedDishes[id] ?? 0)
    expect(logs.unlockDishes[NO_ITEM] ?? 0).toBeGreaterThan(0)
    expect(Object.values(logs.unlockDishes).reduce((a, b) => a + b, 0)).toBe(logs.unlocks)
  })

  it('balances Prize Money: in less out is the balance, and the ledger agrees', () => {
    const paid = logs.prize.paid.full + logs.prize.paid.tired + logs.prize.paid.spent
    expect(ledgerTotal(state.ledger, 'prize-money')).toBe(state.profile.prizeMoney)
    expect(paid - logs.spent.upgrades - logs.spent.tickets).toBe(state.profile.prizeMoney)
    expect(logs.prizeAt.reduce((sum, entry) => sum + entry.paid, 0)).toBe(paid)
  })
})

describe('the policies', () => {
  it('checks in at 08:00, 13:00 and 22:30 local time, which is UTC', () => {
    expect(checkInsOn(3, BASELINE.checkIns).map((at) => (at - LOOP_EPOCH - 3 * MS_PER_DAY) / MS_PER_MINUTE)).toEqual([480, 780, 1350])
    expect(dayOf(checkInsOn(3, BASELINE.checkIns)[2]!)).toBe(3)
  })

  it('names the purse day from the race start', () => {
    expect(localDay(checkInsOn(0, BASELINE.checkIns)[0]!)).toBe('2027-01-04')
    expect(localDay(LOOP_EPOCH + 31 * MS_PER_DAY + 23 * MS_PER_HOUR)).toBe('2027-02-04')
  })

  it('buys every Lv 2, then every Lv 3, busiest building first', () => {
    const fresh = report.baseline.state
    const levels = Object.fromEntries(Object.keys(fresh.buildings).map((id) => [id, { level: 1 as const }]))
    const order = upgradeOrder({ buildings: levels as typeof fresh.buildings }, (id) => (id === 'kitchen' ? 0.9 : id === 'pantry' ? 0.8 : 0))
    expect(order).toHaveLength(28)
    expect(order.slice(0, 3)).toEqual([{ building: 'kitchen', to: 2 }, { building: 'pantry', to: 2 }, { building: 'sugar-grove', to: 2 }])
    expect(order.slice(14, 16)).toEqual([{ building: 'kitchen', to: 3 }, { building: 'pantry', to: 3 }])
    expect(order.slice(0, 14).every((step) => step.to === 2)).toBe(true)
    // Measured: every Lv 2 before the first Lv 3, and Speed Tickets only once all 28 are bought.
    const upgrades = report.baseline.logs.upgrades
    expect(upgrades).toHaveLength(28)
    expect(Math.max(...upgrades.filter((step) => step.level === 2).map((step) => step.at)))
      .toBeLessThanOrEqual(Math.min(...upgrades.filter((step) => step.level === 3).map((step) => step.at)))
    expect(Math.min(...report.baseline.logs.ticketBuys.map((buy) => buy.at))).toBeGreaterThanOrEqual(Math.max(...upgrades.map((step) => step.at)))
  })

  it('spends Speed Tickets on running sessions first, then jobs, latest finish first, in whole 30-minute steps', () => {
    const at = LOOP_EPOCH
    const entry = (kind: 'session' | 'gather', startedAt: number, seconds: number) => ({
      request: kind === 'session' ? { kind: SESSION_KIND, unlocks: [] } : { kind, item: 'carrot', count: 1 },
      seconds: [seconds], inputs: [[]], outputs: [{ item: 'carrot' }], farmExp: [0], startedAt, acceleratedMs: 0, collected: 0, speed: 1, fromQueue: false,
    })
    const row = (outfitId: string, building: string, e: ReturnType<typeof entry>) => ({ outfitId, slot: { building, slot: 0 }, entries: [e], queue: [], last: null, dropped: null })
    const state = {
      ...report.baseline.state,
      items: { 'speed-ticket': 7 },
      work: {
        a: row('a', 'vegetable-garden', entry('gather', at, 4 * 3600)),
        b: row('b', 'observatory', entry('session', at, 2 * 3600 + 600)),
        c: row('c', 'kitchen', entry('gather', at, 3 * 3600)),
      },
    } as unknown as typeof report.baseline.state
    expect(ticketPlan(state, at)).toEqual([
      { outfitId: 'b', startedAt: at, tickets: 4 },
      { outfitId: 'a', startedAt: at, tickets: 3 },
    ])
  })

  it('runs the placeholder Expedition: 18, 20 and 23 races, three a day, eight wins, the last race a win', () => {
    expect(EXPEDITION_RACES).toEqual({ 1: 18, 2: 20, 3: 23 })
    expect([0, 1, 2].map((i) => expeditionRacesAt(i, 3))).toEqual([1, 1, 1])
    expect(expeditionRacesAt(0, 1)).toBe(3)
    expect([0, 1].map((i) => expeditionRacesAt(i, 2))).toEqual([1, 2])
    for (const races of [18, 20, 23]) {
      const wins = expeditionWins(races, 8, loopRng(races))
      expect(wins.size).toBe(8)
      expect(wins.has(races - 1)).toBe(true)
      expect([...wins].every((k) => k >= 0 && k < races)).toBe(true)
    }
    const runs = Object.values(report.baseline.state.umas).flatMap((uma) => uma.tierHistory.flatMap((entry) => entry.runs))
    expect(runs.length).toBeGreaterThan(0)
    for (const run of runs) expect(run).toMatchObject({ wins: 8, completed: true })
  })

  it('races heavy days to 40, and target days far fewer', () => {
    const heavyDays = report.heavy.logs.racesByDay.filter((n) => n >= HEAVY_RACES_PER_DAY).length
    expect(heavyDays).toBeGreaterThan(report.heavy.logs.racesByDay.length / 2)
    expect(report.baseline.metrics.racesPerDay).toBeLessThan(report.heavy.metrics.racesPerDay / 2)
  })

  it('holds the first unlock to 12 hours on the probe and Farm Levels to the owner\'s rates', () => {
    expect(report.firstUnlock.hours).toBeLessThanOrEqual(12)
    expect(report.farmLevels.map((probe) => probe.letter)).toEqual(['C', 'A', 'S'])
  })

  it('uses invented Umas only, each A at one distance and one style, rotated evenly', () => {
    const founders = SIM_UMAS.slice(0, 16)
    for (const distance of ['sprint', 'mile', 'medium', 'long'] as const) expect(founders.filter((uma) => uma.aptitudes.distance[distance] === 'A')).toHaveLength(4)
    for (const style of ['front', 'pace', 'late', 'end'] as const) expect(founders.filter((uma) => uma.aptitudes.strategy[style] === 'A')).toHaveLength(4)
  })
})

describe('the demand of a tier (cross-task acceptance #2, 08 §7)', () => {
  const demand = tierDemand(representativeDeck())
  const family = (id: FamilyId) => demand.dishTable[id].reduce((a, b) => a + b, 0)

  it('takes 37 meals, 34 tonics and 291 crafted items for the representative deck (D375)', () => {
    expect(Object.values(demand.dishes).reduce((a, b) => a + b, 0)).toBe(71)
    expect([family('vegetables'), family('mushrooms'), family('grains')]).toEqual([0, 0, 0])
    for (const id of ['sweets', 'fruits', 'fish', 'nuts-seeds', 'herbs-spices'] as const) expect(family(id), id).toBe(5)
    expect(demand.dishTable.duos.reduce((a, b) => a + b, 0)).toBe(8)
    expect(demand.dishTable.feasts.reduce((a, b) => a + b, 0)).toBe(4)
    expect(demand.dishTable.tonics).toEqual([8, 6, 2, 4, 4, 2, 2, 2, 2, 2])
    // A tonic is three crafted items and no side; a single four and a side, a Duo four and a side, a Feast five and a side.
    expect([demand.crafted.total, demand.crafted.own, demand.crafted.sides]).toEqual([291, 254, 37])
    expect(demand.byScenario.map((entry) => entry.unlocks)).toEqual([27, 23, 21, 19, 17])
  })

  it("bonds each card at its era's odd grade, 2s − 1 (06 §2)", () => {
    const bonds = demand.unlocks.filter((entry) => entry.kind === 'bond')
    expect(bonds).toHaveLength(18)
    for (const bond of bonds) expect(bond.grade).toBe(2 * bond.layer - 1)
    expect(deckCards(1, 3).map((card) => card.era)).toEqual([3, 3, 3])
  })

  it("gives the 89 fixed unlocks 08 §7's cells: 71 take a meal or tonic, the 18 uniques and golds nothing", () => {
    const fixed: Record<string, number> = {}
    for (const entry of FIXED_UNLOCKS) if (entry.dishId !== null) fixed[entry.dishId] = (fixed[entry.dishId] ?? 0) + 1
    expect(FIXED_UNLOCKS).toHaveLength(89)
    expect(Object.values(fixed).reduce((a, b) => a + b, 0)).toBe(71)
    expect(FIXED_UNLOCKS.filter((entry) => entry.dishId === null).map((entry) => entry.kind).sort()).toEqual(
      FIXED_UNLOCKS.filter((entry) => entry.kind === 'unique' || entry.kind === 'gold').map((entry) => entry.kind).sort())
    const grades = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const
    const cells = (id: FamilyId) => grades.map((g) => fixed[planetDish(id, g).id] ?? 0)
    expect(grades.map((g) => fixed[`tonic-${g}`] ?? 0)).toEqual([8, 6, 2, 4, 4, 2, 2, 2, 2, 2])
    for (const id of FAMILY_IDS.filter((f) => !['vegetables', 'mushrooms', 'grains'].includes(f))) expect(cells(id), id).toEqual([1, 0, 1, 0, 1, 0, 1, 0, 1, 0])
    for (const id of ['vegetables', 'mushrooms', 'grains'] as const) expect(cells(id), id).toEqual(Array(10).fill(0))
    expect(DUOS.map((duo) => fixed[duo.id] ?? 0)).toEqual(Array(8).fill(1))
    expect(FEASTS.map((feast) => fixed[feast.id] ?? 0)).toEqual([1, 1, 1, 1])
    // The deck's bonds add nothing: the tier's items are the fixed unlocks' alone.
    expect(demand.dishes).toEqual(fixed)
    expect(demand.unlocks.filter((entry) => entry.kind === 'bond').every((entry) => entry.dishId === null)).toBe(true)
    // A retired dish stays a valid id, so a salad or soup already cooked keeps paying.
    expect(itemById('dish-grains-1')).toMatchObject({ kind: 'dish', retired: true })
  })
})
