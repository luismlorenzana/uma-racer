// The owner's habits the loop simulation plays (T132's "Policies"). Policy code lives only here
// and in loop.ts: it decides what to do and in which order, and every change of state goes through the rules' own
// operations. Each policy cites the page that describes the habit.
import { careerComplete } from '../scenario-goals'
import type { ScenarioGoal, ScenarioJourney } from '../career-shapes'
import type { RaceGrade } from '../types'
import { BUILDING_IDS, MAX_BUILDING_LEVEL, upgradeCost, type BuildingId } from '../farm/buildings'
import { itemById, SPEED_TICKET_ID } from '../items/catalogue'
import { canWorkGrade } from '../items/grades'
import { remainingFor, unlocksLeft, type ChosenCards } from '../planner/targets'
import { DEFAULT_CHECK_INS } from '../check-in/schedule'
import { INITIAL_UMA_TICKETS } from '../tiers/roster'
import { gateLevel, scenariosInTier } from '../tiers/map'
import { SPEED_TICKET_MS, endsAt, remainingMs } from '../work/timeline'
import { SESSION_KIND, type WorkState } from '../work/types'
import type { Tier, UmaState } from '../state/types'
import type { SupportCardTemplate } from '../content'
import { dayStart, MS_PER_MINUTE, type LoopRng } from './clock'
import { deckCards, G1_BY_DISTANCE, SIM_CONTENT } from './fixtures'
import type { ScenarioOfTier } from '../state/types'

// ---- Configuration -------------------------------------------------------------------------------------------------

/** Racing (12 §8, §12; D336): the career once her layer is done; heavy evenings; no pay; or racing as unlocks land. */
export type RacingPolicy = 'target' | 'heavy' | 'no-pay' | 'as-unlocks-land'
/** The roster (12 §9, 04 §6): grow from Uma Shards up to a cap (none for the uncapped variant), or fixed from day 0. */
export type RosterPolicy = { readonly kind: 'grow'; readonly cap: number | null } | { readonly kind: 'fixed'; readonly size: number }
/** Buildings (12 §7, §12): the spending policy's upgrades, or frozen at Lv 1. */
export type BuildingPolicy = 'upgrade' | 'frozen'

/**
 * Whose needs the suggestions serve (02 §6): T131's automatic five (most unlocks left in their open layers), or the
 * owner's marks, five at a time, furthest behind first (T132's "furthest behind first" reading; D348).
 */
export type TargetPolicy = 'automatic' | 'furthest-behind'
/** Queues behind a craft that ends before the next check-in (02 §3): the rest of a fitted ×10 only, or fill the time. */
export type QueuePolicy = 'tens' | 'fill'
/** Job sizes: fitted to the next check-in (Repeat on Fit, 02 §3, §5), or ×1 (the first-day probe's owner, back at each finish). */
export type SizingPolicy = 'fit' | 'one'

export interface LoopConfig {
  readonly seed: number
  readonly targets: TargetPolicy
  readonly queues: QueuePolicy
  readonly sizing: SizingPolicy
  /** Check-in times, minutes after local midnight (02 §3). */
  readonly checkIns: readonly number[]
  readonly racing: RacingPolicy
  readonly roster: RosterPolicy
  readonly buildings: BuildingPolicy
  /** How many tiers the founding cohort plays: the run stops once 90% of it has left the last (the horizon). */
  readonly tiers: 1 | 2 | 3
  /** A safety stop in days, far past any tier the checks accept. */
  readonly maxDays: number
}

/** The founding cohort: the 20 Umas a new account's tickets unlock on day 0 (13 §5, 12 §9). */
export const FOUNDING_ROSTER = INITIAL_UMA_TICKETS
/** The baseline spends tickets until the roster is 25, then holds them (12 §1, §9; T132). */
export const ROSTER_CAP = 25
/** A heavy day holds 40 races (12 §8, 09 §3.4). */
export const HEAVY_RACES_PER_DAY = 40
/** The day's last check-in carries the heavy evening (22:30, T132). */
export const HEAVY_CHECK_IN = 1350
/** The placeholder Expedition: 18, 20 and 23 races in tiers 1–3, 10's 8 ÷ p at 45%, 40% and 35% (T132, M033). */
export const EXPEDITION_RACES: Readonly<Record<Tier, number>> = Object.freeze({ 1: 18, 2: 20, 3: 23 })
export const EXPEDITION_RACES_PER_DAY = 3
/** A guard on one Uma's races at one check-in; the report counts any check-in that hits it. */
export const MAX_RACES_PER_CHECK_IN = 60

export const BASELINE_CONFIG: LoopConfig = Object.freeze({
  seed: 132,
  targets: 'furthest-behind',
  queues: 'fill',
  sizing: 'fit',
  checkIns: DEFAULT_CHECK_INS,
  racing: 'target',
  roster: Object.freeze({ kind: 'grow', cap: ROSTER_CAP }),
  buildings: 'upgrade',
  tiers: 3,
  maxDays: 520,
})

// ---- Check-ins (12 §12, 02 §3) -------------------------------------------------------------------------------------

/** The check-in moments of `day`, in order: 08:00, 13:00 and 22:30 by default, local time = UTC. */
export function checkInsOn(day: number, times: readonly number[]): readonly number[] {
  return [...times].sort((a, b) => a - b).map((minute) => dayStart(day) + minute * MS_PER_MINUTE)
}

// ---- Bonds (06 §2, 08 §7) ------------------------------------------------------------------------------------------

/** The deck's cards for her tier up to her scenario, those not yet bonded: the planner's chosen cards (02 §6). */
export function chosenFor(uma: UmaState): readonly SupportCardTemplate[] {
  const cards: SupportCardTemplate[] = []
  for (let s = 1; s <= uma.scenario; s += 1) for (const card of deckCards(uma.tier, s as ScenarioOfTier)) if (!uma.build.bonds.includes(card.id)) cards.push(card)
  return cards
}

export function chosenCards(state: Pick<WorkState, 'umas'>): ChosenCards {
  return Object.fromEntries(Object.values(state.umas).map((uma) => [uma.outfitId, chosenFor(uma)]))
}

// ---- Targets (02 §6) -----------------------------------------------------------------------------------------------

/**
 * Every Uma with unlocks left, furthest behind first: the lower tier, then the lower scenario, then the most unlocks
 * left in her open layers (T131's measure), ties by outfit id. `excluded` (Ready for promotion) never count.
 */
export function furthestBehind(state: WorkState, chosen: ChosenCards, excluded: ReadonlySet<string>): string[] {
  return Object.values(state.umas)
    .filter((uma) => !excluded.has(uma.outfitId) && uma.hallOfFame === null)
    .map((uma) => ({ uma, left: unlocksLeft(remainingFor(state, uma.outfitId, chosen)) }))
    .filter(({ left }) => left > 0)
    .sort((a, b) => a.uma.tier - b.uma.tier || a.uma.scenario - b.uma.scenario || b.left - a.left || (a.uma.outfitId < b.uma.outfitId ? -1 : 1))
    .map(({ uma }) => uma.outfitId)
}

/** A list in runs of `size`. */
export const chunks = <T>(list: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size))

// ---- Racing (03 §2, §4; D336; T132) --------------------------------------------------------------------------------

export interface PlannedRace {
  readonly raceId: string
  readonly grade: RaceGrade
}

const goalRace = (goal: ScenarioGoal): string | null =>
  goal.series ? goal.series.legs.find((leg) => leg.status === 'active')?.raceId ?? null : goal.raceId

/** Her next race: her next unwon goal race in stage order, then a G1 at her distance (T132 "Racing"). */
export function nextCareerRace(uma: UmaState, k: number): PlannedRace {
  const career: ScenarioJourney = uma.career
  for (const goal of career.goals) {
    if (goal.status !== 'active') continue
    const raceId = goalRace(goal)
    const race = raceId === null ? undefined : SIM_CONTENT.races.find((entry) => entry.id === raceId)
    if (race) return { raceId: race.id, grade: race.grade }
  }
  const g1s = G1_BY_DISTANCE[uma.raceDefaults.selectedPreset]
  const race = g1s[k % g1s.length]!
  return { raceId: race.id, grade: race.grade }
}

/** At her gate with every goal won: the advance or the Expedition is next (03 §5). */
export const atGate = (uma: UmaState): boolean => uma.racing.level >= gateLevel(uma.scenario) && careerComplete(uma.career)

/** Her share of the scenario's nine paid levels (03 §2), for racing as unlocks land. */
export const levelShare = (uma: UmaState): number => Math.min(1, (uma.racing.level - (gateLevel(uma.scenario) - 9)) / 9)

/** Whether she is in her tier's last scenario (tier 3 has four until the 15th ships, 04 §2). */
export const inLastScenario = (uma: UmaState): boolean => uma.scenario >= scenariosInTier(uma.tier)

// ---- The Expedition (10 "Targets", M033 placeholder) ---------------------------------------------------------------

/** How many Expedition races the i-th of n check-ins runs, so a day holds three. */
export const expeditionRacesAt = (index: number, perDay: number): number =>
  Math.floor((EXPEDITION_RACES_PER_DAY * (index + 1)) / perDay) - Math.floor((EXPEDITION_RACES_PER_DAY * index) / perDay)

/** Which of a run's `races` are wins: the last, and seven more at seeded positions among the rest (T132). */
export function expeditionWins(races: number, wins: number, rng: LoopRng): ReadonlySet<number> {
  const before = Array.from({ length: races - 1 }, (_, i) => i)
  for (let i = before.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[before[i], before[j]] = [before[j]!, before[i]!]
  }
  return new Set([...before.slice(0, wins - 1), races - 1])
}

// ---- Spending (12 §12, 07 §7, 05 §7, 09 §5) ------------------------------------------------------------------------

export interface UpgradeStep {
  readonly building: BuildingId
  readonly to: 2 | 3
}

/**
 * The upgrades still to buy, in the policy's order: every Lv 2, then every Lv 3, each level's busiest building first
 * (slot use over the last week, `busy`), ties in building order (T132).
 */
export function upgradeOrder(state: Pick<WorkState, 'buildings'>, busy: (building: BuildingId) => number): readonly UpgradeStep[] {
  const steps: UpgradeStep[] = []
  for (const to of [2, 3] as const) {
    const at = BUILDING_IDS.filter((building) => (state.buildings[building]?.level ?? 1) < to)
      .map((building, index) => ({ building, index, use: busy(building) }))
      .sort((a, b) => b.use - a.use || a.index - b.index)
    for (const { building } of at) steps.push({ building, to })
  }
  return steps
}

/**
 * The next upgrade the account can buy: the first in order whose crafted items are in stock or of a grade some Uma's
 * Farm Level opens (T132: "saves toward the next upgrade the account can buy"). Null when none is left or possible.
 */
export function nextUpgrade(state: WorkState, busy: (building: BuildingId) => number): UpgradeStep | null {
  const levels = Object.values(state.umas).map((uma) => uma.farm.level)
  const top = levels.length === 0 ? 1 : Math.max(...levels)
  for (const step of upgradeOrder(state, busy)) {
    if ((state.buildings[step.building]?.level ?? 1) >= MAX_BUILDING_LEVEL) continue
    const { items } = upgradeCost(step.building, step.to)
    const makeable = items.every(({ item, qty }) => (state.items[item] ?? 0) >= qty || canWorkGrade(top, (itemById(item) as { grade: 1 }).grade))
    if (makeable) return step
  }
  return null
}

/** Whether every building and facility is at Lv 3: then Prize Money buys Speed Tickets (12 §12). */
export const allUpgraded = (state: Pick<WorkState, 'buildings'>): boolean =>
  BUILDING_IDS.every((building) => (state.buildings[building]?.level ?? 1) >= MAX_BUILDING_LEVEL)

/**
 * Where the Speed Tickets go at a check-in (T132): running sessions, then running jobs, each latest finish first, in
 * whole 30-minute steps, so no ticket is wasted.
 */
export function ticketPlan(state: WorkState, now: number): readonly { readonly outfitId: string; readonly startedAt: number; readonly tickets: number }[] {
  let left = state.items[SPEED_TICKET_ID] ?? 0
  if (left <= 0) return []
  const running = Object.values(state.work).flatMap((row) => {
    const entry = row.entries[row.entries.length - 1]
    return entry !== undefined && row.slot !== null && endsAt(entry) > now
      ? [{ outfitId: row.outfitId, entry, session: entry.request.kind === SESSION_KIND }]
      : []
  }).sort((a, b) => Number(b.session) - Number(a.session) || endsAt(b.entry) - endsAt(a.entry) || (a.outfitId < b.outfitId ? -1 : 1))
  const plan: { outfitId: string; startedAt: number; tickets: number }[] = []
  for (const { outfitId, entry } of running) {
    if (left <= 0) break
    const tickets = Math.min(left, Math.floor(remainingMs(entry, now) / SPEED_TICKET_MS))
    if (tickets <= 0) continue
    plan.push({ outfitId, startedAt: entry.startedAt, tickets })
    left -= tickets
  }
  return plan
}
