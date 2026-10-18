// The loop simulation's live blocks (T132's "Live blocks and pages rewritten"): the pacing tables
// of game/12, the Farm and Training Hub slot tables of game/07 and /05, and game/08 §7's demand, rendered from
// `loopReport()` and `tierDemand` so the pages state what the rules measure. Registered in packages/domain/src/docs/
// render.ts. Pure: it returns text.
import { BUILDING_IDS, BUILDINGS, FACILITY_IDS, FARM_BUILDING_IDS, slotsPerRoom, totalSlots, type BuildingId } from '../farm/buildings'
import { farmExpAtLevel } from '../farm/level'
import { ITEM_GRADE_LIST, ITEM_GRADES, type ItemGrade } from '../items/catalogue'
import { FAMILIES, FAMILY_IDS, type FamilyId } from '../items/families'
import { gradeOpensAtFarmLevel } from '../items/grades'
import { workValueSeconds } from '../items/work'
import { LAYER_SIZES, sessionSeconds } from '../training/unlocks'
import { higherGrade, lowerGrade } from '../training/extra'
import type { ScenarioOfTier } from '../state/types'
import { daysSince, MS_PER_DAY } from './clock'
import { representativeDeck, tierDemand, type DishRow, type TierDemand } from './demand'
import type { LoopResult } from './loop'
import { median, type ScenarioRow } from './metrics'
import { loopReport } from './report'

type Cell = string | number
function table(head: readonly Cell[], rows: readonly (readonly Cell[])[]): string {
  const line = (cells: readonly Cell[]) => `|${cells.map((c) => (c === '' ? ' ' : ` ${String(c).replace(/\|/g, '\\|')} `)).join('|')}|`
  return [line(head), `|${head.map(() => '---').join('|')}|`, ...rows.map(line)].join('\n')
}
const num = (n: number) => n.toLocaleString('en-US')
const fixed = (n: number | null, digits = 1) => (n === null ? '–' : n.toFixed(digits))
const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)}%`)
const bold = (s: Cell) => `**${s}**`
const SCENARIOS: readonly ScenarioOfTier[] = [1, 2, 3, 4, 5]
/** The tiers' scenarios as 12 §5 names them: tier 3 has four until the 15th ships (04 §2). */
const row = (result: LoopResult, tier: number, scenario: number): ScenarioRow | undefined =>
  result.metrics.scenarios.find((entry) => entry.tier === tier && entry.scenario === scenario)
const days = (entry: ScenarioRow | undefined) => (entry ? fixed(entry.days.median) : '–')
const spread = (entry: ScenarioRow | undefined) => (entry ? `${fixed(entry.days.median)} (${fixed(entry.days.p10)}–${fixed(entry.days.p90)})` : '–')

// ---- 12 §5: the scenarios -------------------------------------------------------------------------------------------

/**
 * One Uma's listed work in a scenario (rules, at a Lv 1 building): the whole chains of her meals and tonics (none for
 * an unlock that takes nothing, D374) and her sessions, in hours.
 */
function umaHours(demand: TierDemand, s: ScenarioOfTier): { farm: number; sessions: number } {
  const here = demand.unlocks.filter((entry) => entry.layer === s)
  const farm = here.reduce((sum, entry) => sum + (entry.dishId === null ? 0 : workValueSeconds(entry.dishId)!), 0) / 3600
  const sessions = here.reduce((sum, entry) => sum + sessionSeconds(entry.grade), 0) / 3600
  return { farm, sessions }
}

function scenarios(): string {
  const { baseline } = loopReport()
  const demand = tierDemand(representativeDeck())
  let totalHours = 0
  const rows = SCENARIOS.map((s) => {
    const { farm, sessions } = umaHours(demand, s)
    totalHours += farm + sessions
    return [s, `${lowerGrade(s)}–${higherGrade(s)}`, LAYER_SIZES[s - 1]!.total, num(Math.round(farm + sessions)),
      `${num(Math.round(farm))} (${pct(farm / (farm + sessions))})`, num(Math.round(sessions)), bold(spread(row(baseline, 1, s))),
      `${days(row(baseline, 2, s))} · ${days(row(baseline, 3, s))}`]
  })
  const tiers = baseline.metrics.tiers
  return table(['Scenario of the tier', 'Grades', 'Unlocks', 'Uma-hours', 'Farm work', 'Sessions', 'Days, tier 1 (p10–p90)', 'Days, tier 2 · tier 3'], [
    ...rows,
    [bold('Tier'), '', bold(LAYER_SIZES.reduce((sum, size) => sum + size.total, 0)), bold(num(Math.round(totalHours))), '', '',
      bold(`${fixed(tiers[0]?.weeks ?? null)} weeks`), `${fixed(tiers[1]?.weeks ?? null)} · ${fixed(tiers[2]?.weeks ?? null)} weeks`],
  ])
}

// ---- 12 §6, 07 §4: Farm Levels ---------------------------------------------------------------------------------------

/** The average Uma's Farm minutes a day (12 §6): 80% of her 75% of the day. */
const FARM_MINUTES_A_DAY = 864
const RATES = [1, 1.3, 1.6] as const

function farmLevels(): string {
  const { baseline, farmLevels: probes } = loopReport()
  const founders = Object.values(baseline.logs.umas).filter((uma) => uma.founding)
  const cohortDay = (g: ItemGrade) => median(founders.flatMap((uma) => {
    const tier = uma.tiers.find((entry) => entry.tier === 1)
    const at = tier?.gradeOpenedAt[g - 1]
    return tier && at !== null && at !== undefined ? [(at - tier.enteredAt) / MS_PER_DAY] : []
  }))
  const dayAt = (exp: number, rate: number) => Math.round(exp / (FARM_MINUTES_A_DAY * rate))
  const rows = ITEM_GRADE_LIST.map((g) => {
    const level = gradeOpensAtFarmLevel(g)
    const exp = farmExpAtLevel(level)
    return [g, level, num(exp), ...RATES.map((rate) => dayAt(exp, rate)), fixed(cohortDay(g))]
  })
  const top = farmExpAtLevel(50)
  const probe = (letter: string) => fixed(probes.find((entry) => entry.letter === letter)?.levelsPerDay ?? null, 2)
  return [
    table(['Grade', 'Farm Lv', 'EXP', 'Day at C (×1.0)', 'Mixed (×1.3)', 'Always suited (×1.6)', 'Founding cohort, measured (median day)'], [
      ...rows, ['(Lv 50)', 50, num(top), ...RATES.map((rate) => dayAt(top, rate)), ''],
    ]),
    '',
    `The day columns are ${FARM_MINUTES_A_DAY} Farm minutes a day. Working without a break, from Farm Lv 1 to 21 at a Lv 1`,
    `building, an Uma gains ${probe('C')} levels a day at C, ${probe('A')} at A and ${probe('S')} at S (the probe).`,
  ].join('\n')
}

// ---- 12 §7, 07 §6, 05 §7: slots --------------------------------------------------------------------------------------

const slotsCell = (id: BuildingId) => {
  const rooms = BUILDINGS[id].rooms.length
  return rooms > 0 ? `${rooms} rooms × ${slotsPerRoom(id, 1)} / ${slotsPerRoom(id, 2)} / ${slotsPerRoom(id, 3)}` : `${totalSlots(id, 1)} / ${totalSlots(id, 2)} / ${totalSlots(id, 3)}`
}
const upgradeDays = (result: LoopResult, id: BuildingId) => [2, 3].map((level) => {
  const step = result.logs.upgrades.find((entry) => entry.building === id && entry.level === level)
  return step ? fixed(daysSince(step.at), 0) : '–'
}).join(' / ')

function capacity(): string {
  const { baseline } = loopReport()
  return table(['Building', 'Slots Lv 1 / 2 / 3', 'Hours a day held, tier 1', 'Running', 'Peak use (scenario)', 'Bottleneck hours', 'Lv 2 / Lv 3 on day'],
    BUILDING_IDS.map((id) => {
      const slot = baseline.metrics.slots.find((entry) => entry.building === id)!
      return [BUILDINGS[id].name, slotsCell(id), fixed(slot.hoursHeldTier1), fixed(slot.hoursRunningTier1),
        `${pct(slot.peakHeld)} (${slot.peakScenario})`, num(Math.round(slot.bottleneckHours)), upgradeDays(baseline, id)]
    }))
}

/** 07 §6 and 05 §7: hours a day, slots needed at 75% (hours ÷ 18) and use per tier-1 scenario window. */
function slotTable(ids: readonly BuildingId[]): string {
  const { baseline } = loopReport()
  const tier1 = baseline.metrics.scenarios.map((entry, i) => ({ entry, i })).filter(({ entry }) => entry.tier === 1)
  return table(['Building', 'Slots Lv 1 / 2 / 3', 'Hours a day held, tier 1', 'Slots needed (÷ 18)', ...tier1.map(({ entry }) => `Use in ${entry.tier}·${entry.scenario}`), 'Peak, all tiers'],
    ids.map((id) => {
      const slot = baseline.metrics.slots.find((entry) => entry.building === id)!
      return [BUILDINGS[id].name, slotsCell(id), fixed(slot.hoursHeldTier1), fixed(slot.hoursHeldTier1 / 18), ...tier1.map(({ i }) => pct(slot.held[i] ?? null)),
        `${pct(slot.peakHeld)} (${slot.peakScenario})`]
    }))
}

// ---- 12 §8: racing ----------------------------------------------------------------------------------------------------

function racing(): string {
  const { baseline, heavy } = loopReport()
  const line = (name: string, result: LoopResult) => {
    const m = result.metrics
    const tier1Days = (m.tiers[0]?.weeks ?? 0) * 7
    const tickets = result.logs.ticketBuys.filter((buy) => daysSince(buy.at) <= tier1Days).reduce((sum, buy) => sum + buy.qty, 0)
    return [name, fixed(m.racesPerDay), num(Math.round(m.prizePerDay)), tier1Days > 0 ? fixed(tickets / tier1Days, 0) : '–',
      bold(`${(100 * m.racingShare).toFixed(1)}%`), `${fixed(m.tiers[0]?.weeks ?? null)} weeks`]
  }
  return table(['Racing day', 'Races a day, tier 1', 'Prize Money a day', 'Speed Tickets bought a day, tier 1', 'Time saved', 'Tier 1'],
    [line('Target: her career once her layer is done', baseline), line('Heavy: G1s at 22:30 to 40 races a day', heavy)])
}

// ---- 12 §9: the roster -----------------------------------------------------------------------------------------------

function roster(): string {
  const { baseline } = loopReport()
  const logs = baseline.logs
  const day = (at: number) => fixed(daysSince(at), 0)
  const changes = logs.roster.filter((entry, i, all) => i === 0 || entry.umas !== all[i - 1]!.umas)
  const founders = Object.values(logs.umas).filter((uma) => uma.founding)
  const tierAt = (tier: number, read: (log: NonNullable<ReturnType<typeof founders[number]['tiers']['find']>>) => number | null) =>
    median(founders.flatMap((uma) => {
      const log = uma.tiers.find((entry) => entry.tier === tier)
      const at = log ? read(log) : null
      return at === null ? [] : [at]
    }))
  const rows: Cell[][] = [[`Day ${day(changes[0]!.at)}`, changes[0]!.umas, 'The founding cohort: a new account\'s 20 Uma Tickets, all spent']]
  for (const entry of changes.slice(1)) rows.push([`Day ${day(entry.at)}`, entry.umas, 'An Uma Ticket from five Uma Shards (a Shard a gate)'])
  for (const tier of [1, 2, 3]) {
    const expedition = tierAt(tier, (log) => log.expeditionStartedAt)
    const finished = tierAt(tier, (log) => log.finishedAt)
    if (expedition !== null) rows.push([`Day ${day(expedition)}`, '', `Tier ${tier}: the cohort's median Uma starts her Expedition`])
    if (finished !== null) rows.push([`Day ${day(finished)}`, '', tier < 3 ? `Tier ${tier}: the cohort's median promotion` : 'Tier 3: the cohort\'s median Hall of Fame'])
  }
  rows.push(['End of the run', Object.keys(baseline.state.umas).length, `${baseline.state.profile.umaTickets} Uma Tickets held: the roster stays at 25`])
  return table(['When', 'Roster', 'What'], rows.sort((a, b) => Number(String(a[0]).replace(/\D/g, '') || Infinity) - Number(String(b[0]).replace(/\D/g, '') || Infinity)))
}

// ---- 12 §11: utilisation ---------------------------------------------------------------------------------------------

function utilisation(): string {
  const { baseline, heavy, oneCheckIn, twoCheckIns } = loopReport()
  const line = (name: string, racingDay: string, result: LoopResult) => {
    const m = result.metrics
    return [name, racingDay, pct(m.utilisation), bold(`${fixed(m.tiers[0]?.weeks ?? null)} weeks`), fixed(m.racesPerDay), `${(100 * m.racingShare).toFixed(1)}%`]
  }
  return table(['Check-ins', 'Racing', 'Utilisation, tier 1', 'Tier 1', 'Races a day', 'Time saved by racing'], [
    line('One (08:00)', 'Target', oneCheckIn),
    line('Two (08:00, 22:30)', 'Target', twoCheckIns),
    line('Three (08:00, 13:00, 22:30)', 'Target', baseline),
    line('Three', 'Heavy', heavy),
  ])
}

// ---- 12 §12: the checks ----------------------------------------------------------------------------------------------

function checks(): string {
  const { checks: results } = loopReport()
  return table(['Check', 'Range', 'Measured', 'Result'], results.map(({ check, values, pass }) => {
    const range = check.min !== null && check.max !== null ? `${check.min}–${check.max}` : check.max !== null ? `≤ ${check.max}` : `≥ ${check.min}`
    const shown = (value: number | null) => (value === null ? 'never' : check.unit === 'share' ? `${(100 * value).toFixed(1)}%` : fixed(value, check.unit === 'levels a day' ? 2 : 1))
    const unit = check.unit === 'share' ? '' : ` ${check.unit}`
    const rangeText = check.unit === 'share'
      ? (check.min !== null && check.max !== null ? `${100 * check.min}–${100 * check.max}%` : `≤ ${100 * check.max!}%`)
      : `${range}${unit}`
    return [check.label, rangeText, values.map(shown).join(', '), pass ? 'pass' : check.knownMiss ? '**miss** (known, D348)' : '**FAIL**']
  }))
}

// ---- 08 §7: demand ---------------------------------------------------------------------------------------------------

/** 08 §7's rows: each stat family's meals, then Duos, Feasts and tonics (the salads, soups and breads are retired, D374). */
const DISH_ROWS: readonly DishRow[] = ['sweets', 'fruits', 'fish', 'nuts-seeds', 'herbs-spices', 'duos', 'feasts', 'tonics']
const ROW_LABELS: Readonly<Record<'duos' | 'feasts' | 'tonics', string>> = { duos: 'Duos', feasts: 'Feasts', tonics: 'Tonics' }
const label = (key: DishRow) => (key === 'duos' || key === 'feasts' || key === 'tonics' ? ROW_LABELS[key] : `${FAMILIES[key].name} meals`)
const GRADE_HEAD = ['*g*1', ...ITEM_GRADE_LIST.slice(1).map(String)]

function demandDishes(): string {
  const demand = tierDemand(representativeDeck())
  const sparse = (key: DishRow, n: number) => (n === 0 && (key === 'duos' || key === 'feasts' || key === 'tonics') ? '' : n)
  const total = Object.values(demand.dishes).reduce((a, b) => a + b, 0)
  return table(['Meal or tonic', ...GRADE_HEAD, 'Total'], [
    ...DISH_ROWS.map((key) => [label(key), ...demand.dishTable[key].map((n) => sparse(key, n)), bold(demand.dishTable[key].reduce((a, b) => a + b, 0))]),
    [bold('All'), ...Array.from({ length: ITEM_GRADES }, () => ''), bold(total)],
  ])
}

function demandCrafted(): string {
  const { crafted } = tierDemand(representativeDeck())
  const order = [...FAMILY_IDS].sort((a, b) => crafted.families[b].total - crafted.families[a].total)
  return table(['Family', ...GRADE_HEAD, bold('Total'), 'Own meals and tonics', 'Sides'], [
    ...order.map((family) => {
      const row = crafted.families[family]
      return [FAMILIES[family].name, ...row.byGrade, bold(row.total), row.own, row.sides]
    }),
    [bold('All'), ...Array.from({ length: ITEM_GRADES }, () => ''), bold(crafted.total), crafted.own, crafted.sides],
  ])
}

function demandByScenario(): string {
  const { byScenario } = tierDemand(representativeDeck())
  const share = (n: number, of: number) => pct(n / of)
  const statFamilies = FAMILY_IDS.filter((family) => !['grains', 'vegetables', 'mushrooms'].includes(family))
  return table(['Scenario', 'Unlocks', 'Crafted items', 'Vegetables', 'Mushrooms', 'Grains', 'Each stat family'], byScenario.map(({ scenario, unlocks, crafted }) => {
    const shares = statFamilies.map((family) => crafted.families[family].total / crafted.total)
    return [scenario, unlocks, crafted.total, share(crafted.families.vegetables.total, crafted.total), share(crafted.families.mushrooms.total, crafted.total),
      share(crafted.families.grains.total, crafted.total), `${pct(Math.min(...shares))}–${pct(Math.max(...shares))}`]
  }))
}

export const LIVE_BLOCKS: Readonly<Record<string, () => string>> = Object.freeze({
  'loop-scenarios': scenarios,
  'loop-farm-levels': farmLevels,
  'loop-capacity': capacity,
  'loop-racing': racing,
  'loop-roster': roster,
  'loop-utilisation': utilisation,
  'loop-checks': checks,
  'loop-farm-slots': () => slotTable(FARM_BUILDING_IDS),
  'loop-hub-slots': () => slotTable(FACILITY_IDS),
  'demand-dishes': demandDishes,
  'demand-crafted': demandCrafted,
  'demand-by-scenario': demandByScenario,
})

