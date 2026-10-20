// What the loop simulation records and reports (T132's "Report", "Measures";
// docs/game/12-economy-and-pacing.md §12). The recorder samples the state at every check-in: slots held only change
// at a check-in (a slot is held from start to Collect, 12 §7), and what ran in between is read back from the entries'
// timestamps, so nothing is stepped minute by minute. The summary turns the logs into the report's numbers. Pure.
import { BUILDING_IDS, totalSlots, type BuildingId, type BuildingLevel } from '../farm/buildings'
import { itemById } from '../items/catalogue'
import { FAMILY_IDS, type FamilyId } from '../items/families'
import type { PurseBand } from '../economy/purse'
import { endsAt } from '../work/adapter'
import type { WorkState } from '../work/types'
import type { ScenarioOfTier, Tier } from '../state/types'
import { dayOf, LOOP_EPOCH, MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from './clock'
import type { LoopConfig } from './policies'

// ---- Logs ----------------------------------------------------------------------------------------------------------

export interface ScenarioLog {
  readonly enteredAt: number
  layerDoneAt: number | null
  /** Her layer and career both done (T132 "Measures"). */
  doneAt: number | null
}

export interface TierLog {
  readonly tier: Tier
  readonly enteredAt: number
  readonly scenarios: Partial<Record<ScenarioOfTier, ScenarioLog>>
  expeditionStartedAt: number | null
  /** When each grade opened to her (index g − 1): her Farm Level reached 5g − 4 (07 §4). */
  readonly gradeOpenedAt: (number | null)[]
  /** Promoted, or inducted into the Hall of Fame. */
  finishedAt: number | null
}

export interface UmaLog {
  readonly outfitId: string
  readonly founding: boolean
  readonly unlockedAt: number
  readonly tiers: TierLog[]
}

export type IdleReason = 'no-inputs' | 'no-slot' | 'waiting' | 'held'
export const IDLE_REASONS: readonly IdleReason[] = Object.freeze(['no-inputs', 'no-slot', 'waiting', 'held'])

/** One stretch between two check-ins: what the slots held and ran, and how the Umas spent it. */
export interface Bucket {
  readonly from: number
  readonly to: number
  /** Slot-milliseconds held (start to Collect) per building. */
  readonly held: Readonly<Record<BuildingId, number>>
  /** Slot-milliseconds of work running per building. */
  readonly running: Readonly<Record<BuildingId, number>>
  /** Slot-milliseconds the building had (slots × length). */
  readonly capacity: Readonly<Record<BuildingId, number>>
  /** Buildings a suggestion or Repeat wanted with every slot taken, at the check-in that opened the stretch. */
  readonly bottleneck: readonly BuildingId[]
  /** Uma-milliseconds idle, by reason. */
  readonly idle: Readonly<Record<IdleReason, number>>
  /** Uma-milliseconds of work done: jobs and sessions running. */
  readonly work: number
}

export interface PrizeFlow {
  /** Gross Prize Money that fell in each band, and what each band paid. */
  readonly gross: Record<PurseBand, number>
  readonly paid: Record<PurseBand, number>
}

export interface LoopLogs {
  readonly umas: Record<string, UmaLog>
  readonly buckets: Bucket[]
  /** Races run each day (career, Expedition and heavy), by day index. */
  readonly racesByDay: number[]
  /** Unlocks committed each day, roster-wide, by day index. */
  readonly unlocksByDay: number[]
  /** Prize Money paid, by check-in time. */
  readonly prizeAt: { at: number; paid: number }[]
  readonly prize: PrizeFlow
  /** Prize Money spent on upgrades and on Speed Tickets. */
  readonly spent: { upgrades: number; tickets: number }
  ticketsBought: number
  /** Each Speed Ticket purchase: when, and how many. */
  readonly ticketBuys: { at: number; qty: number }[]
  ticketMinutes: number
  readonly upgrades: { building: BuildingId; level: BuildingLevel; at: number }[]
  readonly roster: { at: number; umas: number; tickets: number; shards: number }[]
  /** The Warehouse's free stock at each week's start: family → grade (index g − 1) → count; dishes apart. */
  readonly stock: { week: number; raw: Record<FamilyId, number[]>; crafted: Record<FamilyId, number[]>; dishes: number[] }[]
  /** Conservation: dishes cooked and dishes reserved by sessions, by id; unlocks committed. */
  readonly cooked: Record<string, number>
  readonly reservedDishes: Record<string, number>
  /** Unlocks committed by the dish each one took. */
  readonly unlockDishes: Record<string, number>
  unlocks: number
  /** Check-ins where an Uma hit the race guard. */
  raceGuardHits: number
  races: number
}

const perBuilding = (value = 0): Record<BuildingId, number> => Object.fromEntries(BUILDING_IDS.map((id) => [id, value])) as Record<BuildingId, number>
const perReason = (): Record<IdleReason, number> => ({ 'no-inputs': 0, 'no-slot': 0, waiting: 0, held: 0 })

export function emptyLogs(): LoopLogs {
  return {
    umas: {}, buckets: [], racesByDay: [], unlocksByDay: [], prizeAt: [], prize: { gross: { full: 0, tired: 0, spent: 0 }, paid: { full: 0, tired: 0, spent: 0 } },
    spent: { upgrades: 0, tickets: 0 }, ticketsBought: 0, ticketBuys: [], ticketMinutes: 0, upgrades: [], roster: [], stock: [], cooked: {},
    reservedDishes: {}, unlockDishes: {}, unlocks: 0, raceGuardHits: 0, races: 0,
  }
}

/** What the check-in that opens a stretch says about it: each Uma's state when it ended and the bottlenecks. */
export interface CheckInSample {
  readonly at: number
  readonly held: Readonly<Record<BuildingId, number>>
  readonly slots: Readonly<Record<BuildingId, number>>
  /** Umas that were working when the check-in ended (idle after their chain ends is waiting for a check-in). */
  readonly working: ReadonlySet<string>
  /** Umas left without work, and why. */
  readonly idle: ReadonlyMap<string, IdleReason>
  readonly bottleneck: readonly BuildingId[]
}

/** Slots held and slots there are, per building, on a state after a check-in's operations. */
export function slotSample(state: WorkState): { held: Record<BuildingId, number>; slots: Record<BuildingId, number> } {
  const held = perBuilding()
  for (const row of Object.values(state.work)) if (row.slot !== null && row.entries.length > 0) held[row.slot.building] += 1
  const slots = perBuilding()
  for (const id of BUILDING_IDS) slots[id] = totalSlots(id, state.buildings[id]?.level ?? 1)
  return { held, slots }
}

/**
 * Closes the stretch from the last sample to `now`, reading what ran from the state settled to `now` (before Collect,
 * so every entry that ran is still on its row).
 */
export function closeBucket(logs: LoopLogs, last: CheckInSample, settled: WorkState, now: number): void {
  const length = now - last.at
  if (length <= 0) return
  const running = perBuilding()
  const ranBy = new Map<string, number>()
  for (const row of Object.values(settled.work)) {
    if (row.slot === null) continue
    for (const entry of row.entries) {
      const ran = Math.max(0, Math.min(endsAt(entry), now) - Math.max(entry.startedAt, last.at))
      if (ran <= 0) continue
      running[row.slot.building] += ran
      ranBy.set(row.outfitId, (ranBy.get(row.outfitId) ?? 0) + ran)
    }
  }
  const held = perBuilding(), capacity = perBuilding()
  for (const id of BUILDING_IDS) {
    held[id] = last.held[id] * length
    capacity[id] = last.slots[id] * length
  }
  const idle = perReason()
  let work = 0
  for (const outfitId of Object.keys(settled.umas)) {
    const ran = Math.min(length, ranBy.get(outfitId) ?? 0)
    work += ran
    const reason: IdleReason = last.working.has(outfitId) ? 'waiting' : last.idle.get(outfitId) ?? 'waiting'
    idle[reason] += length - ran
  }
  logs.buckets.push({ from: last.at, to: now, held, running, capacity, bottleneck: last.bottleneck, idle, work })
}

/** The Warehouse at a week's start, by family and grade (T132 "Report"). */
export function stockSnapshot(logs: LoopLogs, state: WorkState, week: number): void {
  const raw = Object.fromEntries(FAMILY_IDS.map((family) => [family, Array.from({ length: 10 }, () => 0)])) as Record<FamilyId, number[]>
  const crafted = Object.fromEntries(FAMILY_IDS.map((family) => [family, Array.from({ length: 10 }, () => 0)])) as Record<FamilyId, number[]>
  const dishes = Array.from({ length: 10 }, () => 0)
  for (const [id, count] of Object.entries(state.items)) {
    const item = itemById(id)
    if (item?.kind === 'raw') raw[item.family][item.grade - 1]! += count
    else if (item?.kind === 'crafted') crafted[item.family][item.grade - 1]! += count
    else if (item?.kind === 'dish' || item?.kind === 'tonic') dishes[item.grade - 1]! += count
  }
  logs.stock.push({ week, raw, crafted, dishes })
}

export const countUnlocks = (logs: LoopLogs, at: number, n: number): void => {
  const day = dayOf(at)
  while (logs.unlocksByDay.length <= day) logs.unlocksByDay.push(0)
  logs.unlocksByDay[day]! += n
}

export const countRace = (logs: LoopLogs, at: number): void => {
  const day = dayOf(at)
  while (logs.racesByDay.length <= day) logs.racesByDay.push(0)
  logs.racesByDay[day]! += 1
  logs.races += 1
}

// ---- Summary -------------------------------------------------------------------------------------------------------

/** p-th percentile (0–100) of a list by nearest rank on the sorted values; null for an empty list. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[rank]!
}
export const median = (values: readonly number[]): number | null => percentile(values, 50)

export interface Spread {
  readonly n: number
  readonly p10: number | null
  readonly median: number | null
  readonly p90: number | null
}
const spread = (values: readonly number[]): Spread => ({ n: values.length, p10: percentile(values, 10), median: median(values), p90: percentile(values, 90) })

export interface ScenarioRow {
  readonly tier: Tier
  readonly scenario: ScenarioOfTier
  /** Days from her entry to her layer and career both done, founding cohort. */
  readonly days: Spread
  /** Days from her entry to her layer done. */
  readonly layerDays: Spread
  /** The window slot use is read over: the cohort's median entry to its median finish. */
  readonly window: { readonly from: number; readonly to: number } | null
}

export interface TierRow {
  readonly tier: Tier
  /** Weeks from the cohort's median tier entry (day 0 for tier 1) to its median promotion or induction. */
  readonly weeks: number | null
  readonly finished: Spread
  readonly enteredAt: number | null
  /** Every building at Lv 3 when the cohort's median Uma entered the tier. */
  readonly allLv3AtEntry: boolean
}

export interface SlotUse {
  readonly building: BuildingId
  /** Held and running use per scenario window, tier by tier, scenario by scenario: null where there is no window. */
  readonly held: readonly (number | null)[]
  readonly running: readonly (number | null)[]
  readonly peakHeld: number
  readonly peakScenario: string
  readonly bottleneckHours: number
  /** Hours a day held and running over tier 1, and slots needed at 75% (12 §7). */
  readonly hoursHeldTier1: number
  readonly hoursRunningTier1: number
}

export interface LoopMetrics {
  readonly days: number
  readonly scenarios: readonly ScenarioRow[]
  readonly tiers: readonly TierRow[]
  readonly slots: readonly SlotUse[]
  /** Idle Uma-hours over tier 1, by reason, and their shares. */
  readonly idle: Readonly<Record<IdleReason, number>>
  readonly utilisation: number
  /** Prize Money paid ÷ Uma-minutes of work over tier 1 (09 §3.4, 12 §8). */
  readonly racingShare: number
  readonly racesPerDay: number
  readonly prizePerDay: number
  readonly workHoursPerDay: number
  /** Unlocks committed a day, roster-wide, over tier 1. */
  readonly unlocksPerDay: number
}

/** The level a building had at `at`, from the upgrade log. */
export function levelAt(logs: LoopLogs, building: BuildingId, at: number): BuildingLevel {
  let level: BuildingLevel = 1
  for (const step of logs.upgrades) if (step.building === building && step.at <= at && step.level > level) level = step.level
  return level
}

/** Sums a bucket field over [from, to], prorating the stretches at the edges. */
function over<T>(logs: LoopLogs, from: number, to: number, read: (bucket: Bucket) => T, add: (sum: T, value: T, share: number) => T, zero: T): T {
  let sum = zero
  for (const bucket of logs.buckets) {
    const a = Math.max(from, bucket.from), b = Math.min(to, bucket.to)
    if (b <= a) continue
    sum = add(sum, read(bucket), (b - a) / (bucket.to - bucket.from))
  }
  return sum
}
const sumNumber = (logs: LoopLogs, from: number, to: number, read: (bucket: Bucket) => number) =>
  over(logs, from, to, read, (sum, value, share) => sum + value * share, 0)

export const scenarioKey = (tier: Tier, scenario: number): string => `${tier}·${scenario}`

export function summarize(logs: LoopLogs, config: LoopConfig, endedAt: number): LoopMetrics {
  const founders = Object.values(logs.umas).filter((uma) => uma.founding)
  const tiers = Array.from({ length: config.tiers }, (_, i) => (i + 1) as Tier)
  const scenarios: ScenarioRow[] = []
  for (const tier of tiers) {
    for (const scenario of [1, 2, 3, 4, 5] as ScenarioOfTier[]) {
      const logsHere = founders.map((uma) => uma.tiers.find((entry) => entry.tier === tier)?.scenarios[scenario]).filter((log): log is ScenarioLog => log !== undefined)
      if (logsHere.length === 0) continue
      const done = logsHere.filter((log) => log.doneAt !== null)
      const entered = median(logsHere.map((log) => log.enteredAt))
      const finished = median(done.map((log) => log.doneAt!))
      scenarios.push({
        tier, scenario,
        days: spread(done.map((log) => (log.doneAt! - log.enteredAt) / MS_PER_DAY)),
        layerDays: spread(logsHere.filter((log) => log.layerDoneAt !== null).map((log) => (log.layerDoneAt! - log.enteredAt) / MS_PER_DAY)),
        window: entered !== null && finished !== null && finished > entered ? { from: entered, to: finished } : null,
      })
    }
  }
  const tierRows: TierRow[] = tiers.map((tier) => {
    const here = founders.map((uma) => uma.tiers.find((entry) => entry.tier === tier)).filter((log): log is TierLog => log !== undefined)
    const enteredAt = tier === 1 ? LOOP_EPOCH : median(here.map((log) => log.enteredAt))
    const finished = here.filter((log) => log.finishedAt !== null).map((log) => log.finishedAt!)
    const end = median(finished)
    return {
      tier,
      weeks: enteredAt !== null && end !== null && finished.length * 2 >= founders.length ? (end - enteredAt) / (7 * MS_PER_DAY) : null,
      finished: spread(finished.map((at) => (at - (enteredAt ?? LOOP_EPOCH)) / (7 * MS_PER_DAY))),
      enteredAt,
      allLv3AtEntry: enteredAt !== null && BUILDING_IDS.every((building) => levelAt(logs, building, enteredAt) === 3),
    }
  })

  const tier1End = tierRows[0]?.weeks !== null && tierRows[0]?.weeks !== undefined
    ? LOOP_EPOCH + tierRows[0].weeks * 7 * MS_PER_DAY
    : endedAt
  const windows = scenarios.map((row) => row.window)
  const slots: SlotUse[] = BUILDING_IDS.map((building) => {
    const use = (read: (bucket: Bucket) => number) => windows.map((window) => {
      if (window === null) return null
      const capacity = sumNumber(logs, window.from, window.to, (bucket) => bucket.capacity[building])
      return capacity > 0 ? sumNumber(logs, window.from, window.to, read) / capacity : null
    })
    const held = use((bucket) => bucket.held[building])
    const running = use((bucket) => bucket.running[building])
    let peak = 0, peakScenario = ''
    held.forEach((value, i) => {
      if (value !== null && value > peak) {
        peak = value
        peakScenario = scenarioKey(scenarios[i]!.tier, scenarios[i]!.scenario)
      }
    })
    const tier1Days = (tier1End - LOOP_EPOCH) / MS_PER_DAY
    return {
      building, held, running, peakHeld: peak, peakScenario,
      bottleneckHours: logs.buckets.reduce((sum, bucket) => sum + (bucket.bottleneck.includes(building) ? (bucket.to - bucket.from) / MS_PER_HOUR : 0), 0),
      hoursHeldTier1: sumNumber(logs, LOOP_EPOCH, tier1End, (bucket) => bucket.held[building]) / MS_PER_HOUR / tier1Days,
      hoursRunningTier1: sumNumber(logs, LOOP_EPOCH, tier1End, (bucket) => bucket.running[building]) / MS_PER_HOUR / tier1Days,
    }
  })

  const idle = Object.fromEntries(IDLE_REASONS.map((reason) => [reason, sumNumber(logs, LOOP_EPOCH, tier1End, (bucket) => bucket.idle[reason]) / MS_PER_HOUR])) as Record<IdleReason, number>
  const work = sumNumber(logs, LOOP_EPOCH, tier1End, (bucket) => bucket.work)
  const idleTotal = IDLE_REASONS.reduce((sum, reason) => sum + idle[reason], 0) * MS_PER_HOUR
  const paid = logs.prizeAt.filter((entry) => entry.at <= tier1End).reduce((sum, entry) => sum + entry.paid, 0)
  const days = (tier1End - LOOP_EPOCH) / MS_PER_DAY
  const racesTier1 = logs.racesByDay.slice(0, Math.ceil(days)).reduce((sum, n) => sum + n, 0)
  return {
    days: (endedAt - LOOP_EPOCH) / MS_PER_DAY,
    scenarios,
    tiers: tierRows,
    slots,
    idle,
    utilisation: work + idleTotal > 0 ? work / (work + idleTotal) : 0,
    racingShare: work > 0 ? paid / (work / MS_PER_MINUTE) : 0,
    racesPerDay: days > 0 ? racesTier1 / days : 0,
    prizePerDay: days > 0 ? paid / days : 0,
    workHoursPerDay: days > 0 ? work / MS_PER_HOUR / days : 0,
    unlocksPerDay: days > 0 ? logs.unlocksByDay.slice(0, Math.ceil(days)).reduce((sum, n) => sum + n, 0) / days : 0,
  }
}
