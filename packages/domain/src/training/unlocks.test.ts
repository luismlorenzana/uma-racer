// Pins the layers (docs/game/05-training-hub.md §3, README "Unlocks per scenario layer", D338, D374): every fixed
// unlock's layer, grade, item (a meal, a tonic or none) and what it waits on, the session minutes and seconds, and bonds'
// unlocks (06 §2).
import { describe, expect, it } from 'vitest'
import { cardOf } from '../__fixtures__/training'
import { itemById } from '../items/catalogue'
import { isRefusal } from '../state/types'
import { dependenciesOf } from './order'
import {
  BONDS_BY_SCENARIO, FIXED_UNLOCKS, LAYER_SIZES, SESSION_BASE_MINUTES, SESSION_MAX_UNLOCKS, SESSION_MINUTES_PER_GRADE, UNLOCKS_PER_TIER,
  bondUnlock, bondsThrough, fixedUnlock, layerUnlocks, sessionBaseMinutes, sessionSeconds, unlockLabel, type Unlock,
} from './unlocks'

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const
const row = (entry: Unlock) => [unlockLabel(entry), entry.layer, entry.grade, entry.dishId]

describe('layer sizes', () => {
  it('are 27, 23, 21, 19 and 17, 107 a tier, per facility as 05 §3 lists them', () => {
    expect(LAYER_SIZES).toEqual([
      { observatory: 12, 'lineage-hall': 4, gym: 5, dojo: 6, total: 27 },
      { observatory: 4, 'lineage-hall': 6, gym: 10, dojo: 3, total: 23 },
      { observatory: 4, 'lineage-hall': 4, gym: 10, dojo: 3, total: 21 },
      { observatory: 4, 'lineage-hall': 6, gym: 6, dojo: 3, total: 19 },
      { observatory: 4, 'lineage-hall': 4, gym: 6, dojo: 3, total: 17 },
    ])
    expect(UNLOCKS_PER_TIER).toBe(107)
    expect(FIXED_UNLOCKS).toHaveLength(89)
    expect(BONDS_BY_SCENARIO).toEqual([6, 3, 3, 3, 3])
    expect([1, 2, 3, 4, 5].map((s) => bondsThrough(s as 1))).toEqual([6, 9, 12, 15, 18])
  })
})

describe('the Observatory (05 §3)', () => {
  it('opens n1 … n28, the first half of each layer at its lower grade, with that grade\'s tonic', () => {
    const nodes = FIXED_UNLOCKS.filter((entry) => entry.kind === 'node')
    const expected = [[1, 6, 1, 1], [7, 12, 1, 2], [13, 14, 2, 3], [15, 16, 2, 4], [17, 18, 3, 5], [19, 20, 3, 6], [21, 22, 4, 7], [23, 24, 4, 8],
      [25, 26, 5, 9], [27, 28, 5, 10]].flatMap(([from, to, layer, grade]) =>
      Array.from({ length: to! - from! + 1 }, (_, i) => [`node ${from! + i}`, layer, grade, `tonic-${grade}`]))
    expect(nodes.map(row)).toEqual(expected)
    expect(nodes.map((entry) => entry.target)).toEqual(Array.from({ length: 28 }, (_, i) => `n${i + 1}`))
  })
})

describe('the Lineage Hall (05 §3)', () => {
  it('follows the grade-per-unlock table, in its order: a tonic for a slot, nothing for a unique or a gold', () => {
    const item = (label: string, g: number) => (label.startsWith('slot') ? `tonic-${g}` : null)
    const table: [string, number, number][] = [
      ['slot A', 1, 1], ['slot B', 1, 1], ["A's unique", 1, 2], ["B's unique", 1, 2],
      ['A gold 1', 2, 3], ['A gold 2', 2, 3], ['B gold 1', 2, 3], ['B gold 2', 2, 3], ['slot A1', 2, 4], ['slot B1', 2, 4],
      ['slot A2', 3, 5], ['slot B2', 3, 5], ["A1's unique", 3, 6], ["B1's unique", 3, 6],
      ["A2's unique", 4, 7], ["B2's unique", 4, 7], ['A1 gold 1', 4, 7], ['B1 gold 1', 4, 8], ['A2 gold 1', 4, 8], ['B2 gold 1', 4, 8],
      ['A1 gold 2', 5, 9], ['B1 gold 2', 5, 9], ['A2 gold 2', 5, 10], ['B2 gold 2', 5, 10],
    ]
    const hall = FIXED_UNLOCKS.filter((entry) => ['slot', 'unique', 'gold'].includes(entry.kind))
    expect(hall.map(row)).toEqual(table.map(([label, layer, grade]) => [label, layer, grade, item(label, grade)]))
    expect(hall.filter((entry) => entry.kind === 'slot').map((entry) => entry.target)).toEqual(['parent0', 'parent1', 'parent0-gp0', 'parent1-gp0', 'parent0-gp1', 'parent1-gp1'])
    expect(hall.filter((entry) => entry.kind === 'gold').map((entry) => entry.target).slice(0, 4))
      .toEqual(['parent0:gold0', 'parent0:gold1', 'parent1:gold0', 'parent1:gold1'])
    expect(hall.map((entry) => entry.layer).reduce((counts, s) => ({ ...counts, [s]: (counts[s] ?? 0) + 1 }), {} as Record<number, number>))
      .toEqual({ 1: 4, 2: 6, 3: 4, 4: 6, 5: 4 })
  })
})

describe('the Gym (05 §3, §6)', () => {
  it('takes a single per stat per scenario at 2s − 1, the ring Duos at 3 and 5, and a Feast\'s Sun at 4, 6, 8 and 10', () => {
    const family = { stamina: 'fruits', wit: 'herbs-spices', power: 'fish', speed: 'sweets', guts: 'nuts-seeds' }
    const singles = (g: number) => Object.entries(family).map(([stat, fam]) => [`${stat[0]!.toUpperCase()}${stat.slice(1)} grade ${g}`, (g + 1) / 2, g, `dish-${fam}-${g}`])
    const duos = (g: number) => ['Stamina–Wit', 'Wit–Power', 'Power–Speed', 'Speed–Guts'].map((pair) =>
      [`${pair} Duo grade ${g}`, (g + 1) / 2, g, `duo-${pair.toLowerCase().replace('–', '-')}-${g}`])
    const sun = (g: number, name: string) => [[`${name} Sun`, g / 2, g, `feast-${g}`]]
    const gym = FIXED_UNLOCKS.filter((entry) => ['single', 'duo', 'sun'].includes(entry.kind))
    expect(gym.map(row)).toEqual([
      ...singles(1),
      ...singles(3), ...duos(3), ...sun(4, 'Spring Feast'),
      ...singles(5), ...duos(5), ...sun(6, 'Summer Feast'),
      ...singles(7), ...sun(8, 'Harvest Feast'),
      ...singles(9), ...sun(10, 'Grand Feast'),
    ])
  })
})

describe('every fixed unlock', () => {
  it('names a meal or tonic of the catalogue whose grade is its own, or none for a unique or a gold', () => {
    for (const entry of FIXED_UNLOCKS) {
      if (entry.kind === 'unique' || entry.kind === 'gold') {
        expect(entry.dishId, `${entry.kind}:${entry.target}`).toBeNull()
      } else {
        const item = itemById(entry.dishId!)
        expect(item?.kind, entry.dishId!).toBe(['node', 'slot'].includes(entry.kind) ? 'tonic' : 'dish')
        expect(item && 'grade' in item ? item.grade : null).toBe(entry.grade)
      }
      expect([2 * entry.layer - 1, 2 * entry.layer]).toContain(entry.grade)
      expect(fixedUnlock(entry)).toBe(entry)
    }
    for (const s of [1, 2, 3, 4, 5] as const) expect(layerUnlocks(s).every((entry) => entry.layer === s)).toBe(true)
    expect(() => layerUnlocks(6 as 1)).toThrow(RangeError)
  })

  it('waits on exactly what 05 §3 says, always on an earlier unlock of the canonical order', () => {
    const order = new Map(FIXED_UNLOCKS.map((entry, i) => [`${entry.kind}:${entry.target}`, i]))
    const label = (refs: readonly { kind: string; target: string }[]) => refs.map((ref) => unlockLabel(ref as Unlock))
    for (const entry of FIXED_UNLOCKS) {
      for (const dep of dependenciesOf(entry)) expect(order.get(`${dep.kind}:${dep.target}`)! < order.get(`${entry.kind}:${entry.target}`)!).toBe(true)
    }
    const deps = (kind: Unlock['kind'], target: string) => label(dependenciesOf({ kind, target }))
    expect(deps('node', 'n1')).toEqual([])
    expect(deps('node', 'n13')).toEqual(['node 12'])
    expect(deps('slot', 'parent1')).toEqual([])
    expect(deps('slot', 'parent1-gp0')).toEqual(['slot B'])
    expect(deps('slot', 'parent0-gp1')).toEqual(['slot A'])
    expect(deps('unique', 'parent0-gp0')).toEqual(['slot A1'])
    expect(deps('gold', 'parent1:gold1')).toEqual(['slot B'])
    expect(deps('single', 'speed-01')).toEqual([])
    expect(deps('single', 'speed-03')).toEqual(['Speed grade 1'])
    expect(deps('single', 'wit-09')).toEqual(['Wit grade 7'])
    expect(deps('duo', 'duo-power-speed-3')).toEqual(['Power grade 3', 'Speed grade 3'])
    expect(deps('sun', 'sun-4')).toEqual(['Stamina grade 3', 'Wit grade 3', 'Power grade 3', 'Speed grade 3', 'Guts grade 3'])
    expect(deps('sun', 'sun-10')).toEqual(['Stamina grade 9', 'Wit grade 9', 'Power grade 9', 'Speed grade 9', 'Guts grade 9'])
    expect(deps('bond', 'speed-e1')).toEqual([])
  })
})

describe('session time (README, 05 §2)', () => {
  it('is 180 + 15(g − 1) base minutes, 1–10 unlocks a session', () => {
    expect([SESSION_BASE_MINUTES, SESSION_MINUTES_PER_GRADE, SESSION_MAX_UNLOCKS]).toEqual([180, 15, 10])
    expect(GRADES.map(sessionBaseMinutes)).toEqual([180, 195, 210, 225, 240, 255, 270, 285, 300, 315])
    expect(() => sessionBaseMinutes(11 as 1)).toThrow(RangeError)
  })

  it('runs × 1.8 in whole seconds, ÷ the facility speed (D374)', () => {
    expect(GRADES.map((g) => sessionSeconds(g))).toEqual([19_440, 21_060, 22_680, 24_300, 25_920, 27_540, 29_160, 30_780, 32_400, 34_020])
    expect(GRADES.map((g) => sessionSeconds(g, 1.25))).toEqual([15_552, 16_848, 18_144, 19_440, 20_736, 22_032, 23_328, 24_624, 25_920, 27_216])
  })
})

describe('bondUnlock (06 §2)', () => {
  it("takes the era's grade and layer p, and no item (D374)", () => {
    expect(bondUnlock(cardOf('speed-e1'), 1, 1)).toEqual({ kind: 'bond', target: 'speed-e1', layer: 1, grade: 1, dishId: null })
    expect(bondUnlock(cardOf('friend-e2'), 1, 2)).toEqual({ kind: 'bond', target: 'friend-e2', layer: 2, grade: 3, dishId: null })
    expect(bondUnlock(cardOf('group-e3'), 1, 5)).toEqual({ kind: 'bond', target: 'group-e3', layer: 3, grade: 5, dishId: null })
    expect(bondUnlock(cardOf('wit-e3'), 1, 3)).toMatchObject({ grade: 5, dishId: null })
    expect(bondUnlock(cardOf('wit-e3'), 2, 1)).toMatchObject({ layer: 1, grade: 1, dishId: null })
    expect(bondUnlock(cardOf('stamina-e9'), 2, 4)).toMatchObject({ layer: 4, grade: 7, dishId: null })
  })

  it('refuses a card whose era is past her scenario, naming the scenario that opens it', () => {
    const later = bondUnlock(cardOf('wit-e3'), 1, 2)
    expect(later).toEqual({
      refused: true, code: 'card-era', reason: 'Opens in scenario {scenario} · {name}',
      data: { card: 'wit-e3', era: 3, tier: 1, scenario: 3, name: 'Trackblazer' },
    })
    const nextTier = bondUnlock(cardOf('speed-e6'), 1, 5)
    expect(isRefusal(nextTier) && nextTier.data).toEqual({ card: 'speed-e6', era: 6, tier: 2, scenario: 1, name: "Project L'Arc" })
  })
})
