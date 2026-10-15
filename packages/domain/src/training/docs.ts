// The Training Hub's live blocks (docs/game/architecture.md#the-rework-modules "The live manual"): the tables of rework/README,
// /04 §8, /05 §1–§3 and §6, and /06 §2 that these rules own, rendered from the code so the design can't drift from it.
// Registered in packages/domain/src/docs/rework.ts. Pure: no I/O, and nothing from the private packs.
import type { InspirationSlot } from '../inspiration'
import { BUILDINGS, BUILDING_LEVELS, BUILDING_SPEED, DOJO_ROOMS, FACILITY_IDS, GYM_ROOMS, type FacilityId } from '../farm/buildings'
import { DUO_GRADES, FEAST_GRADES, feastDish, planetDish, type FeastGrade, type ItemGrade } from '../items/catalogue'
import { FAMILIES } from '../items/families'
import { TREE_CARD_NODES } from './trees/sizes'
import { LAST_SCENARIO_NUMBER, TIERS, scenarioRow, tierOf } from '../tiers/map'
import { NODES_THAT_CAN_PAY, TIER_MULTIPLIER_PCT, extraNodeValues } from '../tiers/scaling'
import { TIME_FACTOR } from '../state/time'
import type { ScenarioOfTier, Tier } from '../state/types'
import { BOND_FAMILY, bondGrade } from './bonds'
import { REWORK_BUFFS, buffScenarioName } from './buffs'
import { EXTRA_CAPACITY, EXTRA_HELD, EXTRA_NODES, EXTRA_SINGLE_GRADES, EXTRA_STATS, LAYERS, higherGrade, lowerGrade } from './extra'
import { FACILITY_DISH_FAMILY, ROOM_NAMES } from './facilities'
import {
  BONDS_BY_SCENARIO, FIXED_UNLOCKS, LAYER_SIZES, SLOT_LETTER, UNLOCKS_PER_TIER, bondsThrough, facilityOf, goldPosition, isGrandparentSlot,
  layerUnlocks, sessionBaseMinutes, sessionSeconds, type Unlock,
} from './unlocks'

type Cell = string | number
/** A Markdown table; an empty cell renders as `| |`, as the hand-written pages have it. */
function table(head: readonly Cell[], rows: readonly (readonly Cell[])[]): string {
  const line = (cells: readonly Cell[]) => `|${cells.map((c) => (c === '' ? ' ' : ` ${String(c).replace(/\|/g, '\\|')} `)).join('|')}|`
  return [line(head), `|${head.map(() => '---').join('|')}|`, ...rows.map(line)].join('\n')
}
const bold = (value: Cell): string => `**${value}**`
const code = (id: string): string => `\`${id}\``
const capital = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1)
const plural = (count: number, one: string, many = `${one}s`): string => `${count} ${count === 1 ? one : many}`
/** "A", "A and B", "A, B and C". */
const list = (items: readonly string[]): string => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)
const GRADES = Array.from({ length: 10 }, (_, i) => (i + 1) as ItemGrade)
const at = (facility: FacilityId) => (entry: Unlock) => facilityOf(entry.kind) === facility
const multiplier = (pct: number): string => `×${pct / 100}`

/** The slot an Inspiration unlock belongs to. */
const slotOf = (entry: Unlock): InspirationSlot => (entry.kind === 'gold' ? goldPosition(entry.target)!.slot : (entry.target as InspirationSlot))
const generation = (entry: Unlock): string => (isGrandparentSlot(slotOf(entry)) ? 'grandparent' : 'parent')

/** Consecutive runs of entries that share a key, in order. */
function runs<T>(items: readonly T[], key: (item: T) => string): T[][] {
  const groups: T[][] = []
  for (const item of items) {
    const last = groups.at(-1)
    if (last && key(last[0]!) === key(item)) last.push(item)
    else groups.push([item])
  }
  return groups
}

/** "2 parent slots, 4 grandparent golds": an Inspiration layer by kind and generation. */
const inspirationCounts = (entries: readonly Unlock[]): string =>
  runs(entries, (entry) => `${generation(entry)} ${entry.kind}`).map((run) => plural(run.length, `${generation(run[0]!)} ${run[0]!.kind}`)).join(', ')

/** "Slots A and B", "A's and B's uniques", "A gold 1, B gold 2": an Inspiration grade by name. */
const inspirationNames = (entries: readonly Unlock[]): string => runs(entries, (entry) => entry.kind).map((run) => {
  const letters = run.map((entry) => SLOT_LETTER[slotOf(entry)])
  if (run[0]!.kind === 'slot') return `${run.length === 1 ? 'Slot' : 'Slots'} ${list(letters)}`
  if (run[0]!.kind === 'unique') return `${list(letters.map((letter) => `${letter}'s`))} ${run.length === 1 ? 'unique' : 'uniques'}`
  return run.map((entry) => `${SLOT_LETTER[slotOf(entry)]} gold ${goldPosition(entry.target)!.index + 1}`).join(', ')
}).join(', ')

const extraCounts = (entries: readonly Unlock[]): Readonly<Record<'single' | 'duo' | 'sun', number>> => ({
  single: entries.filter((entry) => entry.kind === 'single').length,
  duo: entries.filter((entry) => entry.kind === 'duo').length,
  sun: entries.filter((entry) => entry.kind === 'sun').length,
})
const EXTRA_WORDS = { single: 'single', duo: 'Duo', sun: 'Sun' } as const

// --- README "Unlocks per scenario layer" ----------------------------------------------------------------------------

function trainingLayers(): string {
  const all = FIXED_UNLOCKS
  const hall = all.filter(at('lineage-hall'))
  const gym = extraCounts(all.filter(at('gym')))
  return table(['Scenario of the tier', 'Constellation nodes', 'Inspiration', 'Extra Stats nodes', 'Card bonds', 'Total'], [
    ...LAYERS.map((s) => {
      const layer = layerUnlocks(s)
      const extra = extraCounts(layer.filter(at('gym')))
      return [s, `${layer.filter(at('observatory')).length} (tree of ${TREE_CARD_NODES[s - 1]})`, inspirationCounts(layer.filter(at('lineage-hall'))),
        (['single', 'duo', 'sun'] as const).filter((kind) => extra[kind] > 0).map((kind) => plural(extra[kind], EXTRA_WORDS[kind])).join(' + '),
        BONDS_BY_SCENARIO[s - 1]!, bold(LAYER_SIZES[s - 1]!.total)]
    }),
    [bold('Tier'), bold(all.filter(at('observatory')).length),
      `${bold(hall.length)} (${['slot', 'unique', 'gold'].map((kind) => plural(hall.filter((entry) => entry.kind === kind).length, kind)).join(', ')})`,
      `${bold(gym.single + gym.duo + gym.sun)} (${gym.single} + ${gym.duo} + ${gym.sun})`, bold(bondsThrough(5)), bold(UNLOCKS_PER_TIER)],
  ])
}

// --- 05 §1 ----------------------------------------------------------------------------------------------------------

function trainingFacilities(): string {
  const tier = (facility: FacilityId) => (facility === 'dojo' ? bondsThrough(5) : FIXED_UNLOCKS.filter(at(facility)).length)
  const hall = FIXED_UNLOCKS.filter(at('lineage-hall'))
  const familyName = (family: keyof typeof FAMILIES) => FAMILIES[family].name
  const rows: Record<FacilityId, readonly Cell[]> = {
    observatory: ['Constellation card nodes', familyName(FACILITY_DISH_FAMILY.observatory)],
    'lineage-hall': [`Inspiration: ${inspirationCounts(hall.filter((entry) => entry.kind === 'slot'))}, ${plural(hall.filter((entry) => entry.kind === 'unique').length, 'inherited unique skill')}, ${plural(hall.filter((entry) => entry.kind === 'gold').length, 'gold skill')}`,
      familyName(FACILITY_DISH_FAMILY['lineage-hall'])],
    gym: ['Extra Stats nodes', `${GYM_ROOMS.map((room) => `${familyName(FACILITY_DISH_FAMILY.gym[room])} (${ROOM_NAMES[room]})`).join(', ')}; Duos; Feasts`],
    dojo: ['Card bonds ([06](06-cards-and-bonds.md) owns the rules)', `By card type: the five stat families, and ${familyName(FACILITY_DISH_FAMILY.dojo['friend-group'])} for Friend and Group`],
  }
  const rooms = (facility: FacilityId) => {
    const list = BUILDINGS[facility].rooms
    if (list.length === 0) return 'None'
    return `${list.length}, one per ${facility === 'gym' ? 'stat' : 'card type'}: ${list.map((room) => ROOM_NAMES[room]).join(', ')}`
  }
  return table(['Facility', 'Unlocks', 'Dish family', 'Rooms', 'Unlocks per Uma per tier'], [
    ...FACILITY_IDS.map((facility) => [bold(BUILDINGS[facility].name), ...rows[facility], rooms(facility),
      facility === 'dojo' ? `${tier(facility)} (a pacing assumption, not a cap)` : tier(facility)]),
    [bold('Tier'), '', '', '', bold(UNLOCKS_PER_TIER)],
  ])
}

// --- 05 §2 ----------------------------------------------------------------------------------------------------------

function trainingSessionTimes(): string {
  const levels = (speed: number) => BUILDING_LEVELS.filter((level) => BUILDING_SPEED[level] === speed)
  const label = (speed: number) => {
    const at = levels(speed)
    return at.length === 1 ? `Lv ${at[0]}` : `Lv ${at[0]}–${at.at(-1)}`
  }
  const [slow, fast] = [...new Set(BUILDING_LEVELS.map((level) => BUILDING_SPEED[level]))] as [number, number]
  return table(['Grade', ...GRADES], [
    [`Base minutes, ${label(slow)} facility`, ...GRADES.map((g) => sessionBaseMinutes(g) / slow)],
    [`Base minutes, ${label(fast)} facility (×${fast} speed)`, ...GRADES.map((g) => sessionBaseMinutes(g) / fast)],
    [`Real minutes at *k* = ${TIME_FACTOR}, ${label(slow)}`, ...GRADES.map((g) => sessionSeconds(g, slow) / 60)],
  ])
}

// --- 05 §3 ----------------------------------------------------------------------------------------------------------

/** "5 singles and 4 Duos at g3, 1 Sun at g4": a layer's entries by grade, each grade's kinds counted in order. */
function byGrade(entries: readonly Unlock[], phrase: (group: readonly Unlock[]) => string): string {
  return runs(entries.slice().sort((a, b) => a.grade - b.grade), (entry) => String(entry.grade)).map((group) => `${phrase(group)} at g${group[0]!.grade}`).join(', ')
}

function trainingLayerGrades(): string {
  const all = FIXED_UNLOCKS
  const hall = all.filter(at('lineage-hall'))
  const gym = extraCounts(all.filter(at('gym')))
  return table(['Scenario of the tier', 'Grades', 'Observatory', 'Lineage Hall', 'Gym', 'Dojo (pacing)', 'Total'], [
    ...LAYERS.map((s) => {
      const layer = layerUnlocks(s)
      const nodes = layer.filter(at('observatory'))
      const extra = layer.filter(at('gym'))
      return [s, `${lowerGrade(s)}–${higherGrade(s)}`,
        `${plural(nodes.length, 'node')}: ${byGrade(nodes, (group) => String(group.length))}`,
        byGrade(layer.filter(at('lineage-hall')), (group) => runs(group, (entry) => `${generation(entry)} ${entry.kind}`)
          .map((run) => plural(run.length, `${generation(run[0]!)} ${run[0]!.kind}`)).join(' and ')),
        byGrade(extra, (group) => {
          const counts = extraCounts(group)
          return (['single', 'duo', 'sun'] as const).filter((kind) => counts[kind] > 0).map((kind) => plural(counts[kind], EXTRA_WORDS[kind])).join(' and ')
        }),
        plural(BONDS_BY_SCENARIO[s - 1]!, 'bond'), bold(LAYER_SIZES[s - 1]!.total)]
    }),
    [bold('Tier'), '', bold(all.filter(at('observatory')).length),
      `${bold(hall.length)} (${['slot', 'unique', 'gold'].map((kind) => plural(hall.filter((entry) => entry.kind === kind).length, kind)).join(', ')})`,
      `${bold(gym.single + gym.duo + gym.sun)} (${plural(gym.single, 'single')}, ${plural(gym.duo, 'Duo')}, ${plural(gym.sun, 'Sun')})`,
      bold(bondsThrough(5)), bold(UNLOCKS_PER_TIER)],
  ])
}

const span = (entries: readonly Unlock[]): string => `${entries[0]!.target}–${entries.at(-1)!.target}`
const gradeCell = (entries: readonly Unlock[], name: string): string => `${name} at ${bold(`g${entries[0]!.grade}`)} (${code(entries[0]!.dishId)})`

function trainingNodeGrades(): string {
  return table(['Scenario', 'Nodes', 'Lower grade', 'Higher grade'], LAYERS.map((s) => {
    const nodes = layerUnlocks(s).filter(at('observatory'))
    const [low, high] = [nodes.filter((entry) => entry.grade === lowerGrade(s)), nodes.filter((entry) => entry.grade === higherGrade(s))]
    return [s, span(nodes), gradeCell(low, span(low)), gradeCell(high, span(high))]
  }))
}

function trainingInspirationGrades(): string {
  return table(['Scenario', 'Lower grade', 'Higher grade'], LAYERS.map((s) => {
    const hall = layerUnlocks(s).filter(at('lineage-hall'))
    const [low, high] = [hall.filter((entry) => entry.grade === lowerGrade(s)), hall.filter((entry) => entry.grade === higherGrade(s))]
    return [s, gradeCell(low, inspirationNames(low)), gradeCell(high, inspirationNames(high))]
  }))
}

function trainingExtraGrades(): string {
  const pairs = (entries: readonly Unlock[]) => EXTRA_NODES.filter((node) => entries.some((entry) => entry.target === node.id) && node.kind === 'duo')
  return table(['Scenario', 'Singles', 'Duos', 'Sun'], LAYERS.map((s) => {
    const gym = layerUnlocks(s).filter(at('gym'))
    const duos = pairs(gym)
    const sun = gym.find((entry) => entry.kind === 'sun')
    return [s, `Each stat at ${bold(`g${lowerGrade(s)}`)}`,
      duos.length === 0 ? '—' : `${duos.map((node) => node.stats.map(capital).join('–')).join(', ')} at ${bold(`g${duos[0]!.grade}`)}`,
      sun ? `${feastDish(sun.grade as FeastGrade).name} (${code(sun.dishId)}) at ${bold(`g${sun.grade}`)}` : '—']
  }))
}

// --- 05 §6 ----------------------------------------------------------------------------------------------------------

function trainingExtraNodes(): string {
  const tiers = Array.from({ length: TIERS }, (_, i) => (i + 1) as Tier)
  const count = (kind: 'single' | 'duo' | 'sun') => EXTRA_NODES.filter((node) => node.kind === kind).length
  const values = tiers.map(extraNodeValues)
  return table(['Node', 'Count', 'Pays at tier 1', ...tiers.slice(1).map((tier) => `Tier ${tier} (${multiplier(TIER_MULTIPLIER_PCT[tier - 1]!)})`)], [
    ['Single', `${count('single')} (${EXTRA_STATS.length} stats × one per scenario, grades ${EXTRA_SINGLE_GRADES.join(', ')})`, `+${values[0]!.single} to its stat`,
      ...values.slice(1).map((value) => `+${value.single}`)],
    ['Duo', `${count('duo')} (${count('duo') / DUO_GRADES.length} pairs × grades ${list(DUO_GRADES.map(String))})`, `+${values[0]!.duo} to each of its two stats`,
      ...values.slice(1).map((value) => `+${value.duo} each`)],
    ['Sun', `${count('sun')} (Feasts at grades ${FEAST_GRADES.join(', ')})`, `+${values[0]!.sun} to all five stats`, ...values.slice(1).map((value) => `+${value.sun}`)],
  ])
}

function trainingExtraCapacity(): string {
  return table(['Scenario of the tier', ...LAYERS], [
    ['Nodes the layers so far hold', ...EXTRA_HELD],
    ['Active capacity (README)', ...EXTRA_CAPACITY],
    ['Nodes that can pay', ...NODES_THAT_CAN_PAY],
  ])
}

// --- 06 §2 ----------------------------------------------------------------------------------------------------------

function bondDishes(): string {
  const types = (room: (typeof DOJO_ROOMS)[number]) => (Object.keys(BOND_FAMILY) as (keyof typeof BOND_FAMILY)[])
    .filter((type) => (room === 'friend-group' ? type === 'friend' || type === 'group' : type === room))
  return table(['Card type', 'Dojo room', 'Dish family', 'Dish id at grade *g* (grade 1 name)'], DOJO_ROOMS.map((room) => {
    const family = FACILITY_DISH_FAMILY.dojo[room]
    return [types(room).map(capital).join(', '), ROOM_NAMES[room], FAMILIES[family].name, `${code(`dish-${family}-<g>`)} (${planetDish(family, 1).name})`]
  }))
}

function bondGrades(): string {
  const tiers = Array.from({ length: TIERS }, (_, i) => (i + 1) as Tier)
  return table(['Card era (JP scenario)', ...tiers.map((tier) => `Tier ${tier} grade`)], Array.from({ length: LAST_SCENARIO_NUMBER }, (_, i) => {
    const era = i + 1
    return [`${era} · ${scenarioRow(era).name}`, ...tiers.map((tier) => {
      const grade = bondGrade(era, tier)
      return grade === null ? '—' : tierOf(era) === tier ? bold(grade) : grade
    })]
  }))
}

function bondCounts(): string {
  return table(['Scenario of the tier', ...LAYERS, 'Tier'], [
    ['Bonds in the layer (README)', ...BONDS_BY_SCENARIO, bold(bondsThrough(5))],
    ['Bonded by the end of the scenario', ...LAYERS.map((s) => bondsThrough(s as ScenarioOfTier)), ''],
  ])
}

// --- 04 §8 ----------------------------------------------------------------------------------------------------------

function reworkBuffs(): string {
  return table(['T', 'Scenario', 'Buff', 'Rule after the rework'], REWORK_BUFFS.map((buff) => [buff.T, buffScenarioName(buff.T), bold(buff.name), buff.rule]))
}

export const LIVE_BLOCKS: Readonly<Record<string, () => string>> = {
  'training-layers': trainingLayers,
  'training-facilities': trainingFacilities,
  'training-session-times': trainingSessionTimes,
  'training-layer-grades': trainingLayerGrades,
  'training-node-grades': trainingNodeGrades,
  'training-inspiration-grades': trainingInspirationGrades,
  'training-extra-grades': trainingExtraGrades,
  'training-extra-nodes': trainingExtraNodes,
  'training-extra-capacity': trainingExtraCapacity,
  'bond-dishes': bondDishes,
  'bond-grades': bondGrades,
  'bond-counts': bondCounts,
  'rework-buffs': reworkBuffs,
}
