// `pnpm sim:loop`'s core (D348, docs/game/12-economy-and-pacing.md §12): a deterministic,
// seeded, headless run of the whole economy from a fresh account, built only from the phase-2 modules. Time jumps from
// check-in to check-in (and midnight, for the weekly stock); T127's settle replays every queue start at its own moment,
// so nothing between check-ins needs a step. Every change of state goes through the rules' operations; the only
// policy device is a shelf: the next upgrade's items are kept back from Repeat and the suggestions, then put back, a
// net no-op on the state. It never multiplies by TIME_FACTOR.
import { setRepeatSizing } from '../check-in/repeat'
import { collectAll } from '../check-in/collect-all'
import { repeat } from '../check-in/repeat'
import { nextCheckIn, setCheckInTimes } from '../check-in/schedule'
import { buy, SPEED_TICKET_PRICE } from '../economy/exchange'
import { payFromPurse, PURSE_BANDS, PURSE_SHARE_DENOMINATOR } from '../economy/purse'
import { settleRacePrize } from '../economy/race-prize'
import { FAMILY_SITE, farmItemSeconds } from '../farm/jobs'
import { upgradeCost, type BuildingId } from '../farm/buildings'
import { heldFor, isKitchenItem, itemById, SPEED_TICKET_ID, type ItemId } from '../items/catalogue'
import { canWorkGrade } from '../items/grades'
import { recipeOf } from '../items/recipes'
import { planFrom, type Plan } from '../planner/needs'
import { projectWork } from '../planner/project'
import { Bench, freeUmas, jobFor, startSuggestions, suggest, type Suggestion } from '../planner/suggest'
import { MAX_TARGETS, remainingFor, setTargets, targetsOf, type ChosenCards } from '../planner/targets'
import { recordExpeditionRace } from '../tiers/expedition'
import { scenarioNumber } from '../tiers/map'
import { canStartExpedition, promote } from '../tiers/promotion'
import { applyRaceFinish } from '../tiers/racing'
import { exchangeShards, unlockUma, UMA_SHARDS_PER_TICKET } from '../tiers/roster'
import { writeLedger } from '../tiers/ledger'
import { advanceScenario, setCardSet } from '../training/build'
import { deriveUmaPreset, promotionPresetStats } from '../training/derive'
import { layerDone } from '../training/order'
import type { SessionPaid } from '../training/sessions'
import { newAccount } from '../tiers/roster'
import { isRefusal, type OpResult, type ReworkState, type Tier, type UmaState } from '../state/types'
import { isFree } from '../work/activity'
import type { WorkEnv } from '../work/kinds'
import { MAX_ITEMS_PER_ENTRY, MAX_QUEUE, queue, slotsOf, speedUp, start, upgrade, type StartReceipt } from '../work/operations'
import { settle } from '../work/settle'
import { newWorkState, slotHolder, speedAt } from '../work/state'
import { endsAt } from '../work/timeline'
import { SESSION_KIND, type WorkState } from '../work/types'
import { CARD_SET_SIZE } from '../constellation'
import { layerShare } from './build'
import { dayOf, localDay, LOOP_EPOCH, MS_PER_DAY, UTC_OFFSET_MIN, type LoopRng } from './clock'
import { SIM_CONTENT, SIM_UMAS } from './fixtures'
import {
  closeBucket, countRace, countUnlocks, emptyLogs, slotSample, stockSnapshot, summarize, type CheckInSample, type IdleReason, type LoopLogs, type LoopMetrics,
  type TierLog, type UmaLog,
} from './metrics'
import { drawLoss, drawPlace, placeShares } from './places'
import {
  allUpgraded, atGate, BASELINE_CONFIG, chosenCards, chunks, furthestBehind, EXPEDITION_RACES, expeditionRacesAt, expeditionWins, FOUNDING_ROSTER, HEAVY_CHECK_IN,
  HEAVY_RACES_PER_DAY, inLastScenario, levelShare, MAX_RACES_PER_CHECK_IN, nextCareerRace, nextUpgrade, ticketPlan, checkInsOn, type LoopConfig,
  type UpgradeStep,
} from './policies'
import { WIN_TABLE } from './win-table'

export const ENV: WorkEnv = Object.freeze({ content: SIM_CONTENT })
const TIER_ENV = Object.freeze({ content: SIM_CONTENT })
/** The Expedition the placeholder runs (10, phase 9 replaces it). */
const expeditionId = (tier: Tier): string => `sim-expedition-t${tier}`

/** The conservation logs' key for unlocks that take no item (D374). */
export const NO_ITEM = 'none'
/** Whether the Kitchen made `item`: a meal or a tonic. */
const fromKitchen = (item: ItemId): boolean => {
  const def = itemById(item)
  return def !== undefined && isKitchenItem(def)
}
/** The founding cohort's share that must leave the last tier before the run stops: 90%, so p90 is measured. */
const HORIZON_SHARE = 0.9

export interface LoopResult {
  readonly config: LoopConfig
  readonly metrics: LoopMetrics
  readonly logs: LoopLogs
  /** The account when the run stopped. */
  readonly state: WorkState
  readonly endedAt: number
}

function ok<R, S>(result: OpResult<R, S & ReworkState>, what: string): { state: S & ReworkState; receipt: R } {
  if (isRefusal(result)) throw new Error(`${what} refused: ${result.code} ${result.reason} ${JSON.stringify(result.data ?? {})}`)
  return result
}

/** A new account (13 §5) with Repeat on Fit (02 §5's toggle, kept on), on the Farm's day one; a fixed roster's extra tickets. */
export function initialState(config: LoopConfig): WorkState {
  let account: ReworkState = ok(setCheckInTimes(newAccount(LOOP_EPOCH), { times: config.checkIns }, LOOP_EPOCH), 'set-check-in-times').state
  if (config.sizing === 'fit') account = ok(setRepeatSizing(account, { sizing: 'fit' }, LOOP_EPOCH), 'set-repeat-sizing').state
  if (config.roster.kind === 'fixed' && config.roster.size > FOUNDING_ROSTER) {
    // A variant's premise, not a rule: the fixed roster starts with the tickets for its Umas (T132 "Other variants").
    account = writeLedger(account, { id: 'variant-uma-tickets', resource: 'uma-tickets', delta: config.roster.size - FOUNDING_ROSTER, reason: 'initial-uma-tickets' }, LOOP_EPOCH)
  }
  return newWorkState(account)
}

interface ExpeditionPlan {
  readonly tier: Tier
  readonly races: number
  readonly wins: ReadonlySet<number>
  raced: number
}

/** A suggestion at ×1: the first-day probe's owner picks the smallest chip, back at its finish (T132 "Probes"). */
function single(line: Suggestion): Suggestion {
  const request = line.request.kind === SESSION_KIND ? { ...line.request, unlocks: line.request.unlocks.slice(0, 1) } : { ...line.request, count: 1 }
  return { ...line, request, size: 1 }
}

/** The shelf: items kept back from Repeat and the suggestions for the next upgrade. */
type Shelf = Readonly<Record<ItemId, number>>
const shelve = (state: WorkState, shelf: Shelf, sign: 1 | -1): WorkState => {
  if (Object.keys(shelf).length === 0) return state
  const items: Record<string, number> = { ...state.items }
  for (const [id, qty] of Object.entries(shelf)) {
    const count = (items[id] ?? 0) - sign * qty
    if (count < 0) throw new Error(`The shelf holds more ${id} than the Warehouse`)
    if (count === 0) delete items[id]
    else items[id] = count
  }
  return { ...state, items }
}

/** The run's moving parts: its logs, the account, and one check-in at a time (the probes drive it themselves). */
export interface LoopEngine {
  readonly logs: LoopLogs
  state(): WorkState
  /** One check-in at `now`, the `index`-th of `perDay` that day; `next` is the next check-in, for queues. */
  checkIn(now: number, index: number, perDay: number, next: number): void
  /** The founding cohort's share past the last tier has reached the horizon. */
  horizonMet(): boolean
}

export function createLoop(config: LoopConfig, rng: LoopRng): LoopEngine {
  const logs = emptyLogs()
  let state = initialState(config)
  let nextUma = 0
  let resultSeq = 0
  let opSeq = 0
  const expeditions = new Map<string, ExpeditionPlan>()
  const raceBonusCache = new Map<string, number>()
  let sample: CheckInSample | null = null

  // ---- Logs --------------------------------------------------------------------------------------------------------
  const tierLog = (uma: UmaState): TierLog => {
    const log = logs.umas[uma.outfitId]!
    const entry = log.tiers.find((t) => t.tier === uma.tier)
    if (!entry) throw new Error(`No tier ${uma.tier} log for ${uma.outfitId}`)
    return entry
  }
  const enterTier = (outfitId: string, tier: Tier, at: number) => {
    logs.umas[outfitId]!.tiers.push({ tier, enteredAt: at, scenarios: { 1: { enteredAt: at, layerDoneAt: null, doneAt: null } }, expeditionStartedAt: null, finishedAt: null, gradeOpenedAt: [at, ...Array.from({ length: 9 }, () => null)] })
  }
  const busy = (building: BuildingId): number => {
    let held = 0, capacity = 0
    for (let i = logs.buckets.length - 1; i >= 0; i -= 1) {
      const bucket = logs.buckets[i]!
      if (logs.buckets.length - i > 21) break
      held += bucket.held[building]
      capacity += bucket.capacity[building]
    }
    return capacity > 0 ? held / capacity : 0
  }

  // ---- The roster (12 §9, 04 §6) -----------------------------------------------------------------------------------
  const rosterCap = (): number => (config.roster.kind === 'fixed' ? config.roster.size : config.roster.cap ?? Number.POSITIVE_INFINITY)
  const growRoster = (now: number, founding: boolean) => {
    if (config.roster.kind === 'grow' || founding) {
      while (config.roster.kind === 'grow' && state.profile.umaShards >= UMA_SHARDS_PER_TICKET) {
        state = ok(exchangeShards(state, {}, now), 'exchange-shards').state
      }
    }
    if (config.roster.kind === 'fixed' && !founding) return
    while (state.profile.umaTickets > 0 && Object.keys(state.umas).length < rosterCap() && nextUma < SIM_UMAS.length) {
      const template = SIM_UMAS[nextUma]!
      nextUma += 1
      state = ok(unlockUma(state, { outfitId: template.id }, now, TIER_ENV), 'unlock-uma').state
      logs.umas[template.id] = { outfitId: template.id, founding, unlockedAt: now, tiers: [] } satisfies UmaLog
      enterTier(template.id, 1, now)
    }
    logs.roster.push({ at: now, umas: Object.keys(state.umas).length, tickets: state.profile.umaTickets, shards: state.profile.umaShards })
  }

  // ---- Racing (12 §8, §12; 03 §2, §4; 09 §2–§3) --------------------------------------------------------------------
  const raceBonus = (uma: UmaState): number => {
    const preset = uma.build.presets[uma.raceDefaults.selectedPreset]
    const key = `${uma.tier}.${uma.scenario}:${preset.cardSetIds.join(',')}:${uma.build.bonds.length}`
    let bonus = raceBonusCache.get(key)
    if (bonus === undefined) {
      bonus = deriveUmaPreset(uma, uma.raceDefaults.selectedPreset, SIM_CONTENT).raceBonus
      raceBonusCache.set(key, bonus)
    }
    return bonus
  }
  const pay = (resultId: string, raceId: string, grade: 'g1' | 'g2' | 'g3', place: number, now: number, expedition: boolean) => {
    if (config.racing === 'no-pay') return
    const day = localDay(now)
    const input = { resultId, raceId, grade, place, localDay: day, board: [] as string[], ...(expedition ? { expedition: { familyWon: false } } : {}) }
    const settled = settleRacePrize(state.profile, input, now)
    if (isRefusal(settled)) throw new Error(`settleRacePrize refused: ${settled.code}`)
    // The purse's split by band, read from T130's own rule on the purse as it stood (a query, not a change).
    const split = payFromPurse(state.profile.purse, day, settled.prize.gross).split
    for (const band of ['full', 'tired', 'spent'] as const) logs.prize.gross[band] += split[band]
    // What each band paid: the full band in full, the rest of the race's one rounded payment to the tired band first.
    const beyond = settled.prize.paid - split.full
    const tiredRule = PURSE_BANDS.find((band) => band.band === 'tired')!
    const tired = Math.min(beyond, Math.floor((split.tired * tiredRule.paidTwentieths) / PURSE_SHARE_DENOMINATOR))
    logs.prize.paid.full += split.full
    logs.prize.paid.tired += tired
    logs.prize.paid.spent += beyond - tired
    state = { ...state, profile: settled.profile, ledger: [...state.ledger, ...settled.ledger] }
    if (settled.prize.paid > 0) logs.prizeAt.push({ at: now, paid: settled.prize.paid })
  }
  const runRace = (umaId: string, race: { raceId: string; grade: 'g1' | 'g2' | 'g3' }, now: number): number => {
    const uma = state.umas[umaId]!
    const shares = placeShares(WIN_TABLE, scenarioNumber(uma), race.grade, layerShare(uma.build, uma.scenario))
    const place = drawPlace(shares, rng)
    resultSeq += 1
    const resultId = `sim-race-${resultSeq}`
    state = ok(applyRaceFinish(state, { umaId, raceId: race.raceId, resultId, grade: race.grade, placement: place, raceBonus: raceBonus(uma) }, now), 'race').state
    pay(resultId, race.raceId, race.grade, place, now, false)
    countRace(logs, now)
    return place
  }
  /** Her career races at one check-in: next goal race in stage order, then G1s, until `keepGoing` stops (T132). */
  const raceCareer = (umaId: string, now: number, keepGoing: (uma: UmaState) => boolean, after: (place: number) => void = () => {}) => {
    let k = 0
    while (keepGoing(state.umas[umaId]!)) {
      if (k >= MAX_RACES_PER_CHECK_IN) { logs.raceGuardHits += 1; return }
      after(runRace(umaId, nextCareerRace(state.umas[umaId]!, k) as { raceId: string; grade: 'g1' | 'g2' | 'g3' }, now))
      k += 1
    }
  }
  const raceExpedition = (umaId: string, races: number, now: number) => {
    for (let n = 0; n < races; n += 1) {
      const uma = state.umas[umaId]!
      const run = uma.expedition.runs.find((entry) => entry.expeditionId === expeditionId(uma.tier))
      if (run?.completed) return
      if (!run && !canStartExpedition(uma)) return
      let plan = expeditions.get(umaId)
      if (!plan || plan.tier !== uma.tier) {
        plan = { tier: uma.tier, races: EXPEDITION_RACES[uma.tier], wins: expeditionWins(EXPEDITION_RACES[uma.tier], 8, rng), raced: 0 }
        expeditions.set(umaId, plan)
        tierLog(uma).expeditionStartedAt = now
      }
      const won = plan.wins.has(plan.raced)
      plan.raced += 1
      const place = won ? 1 : drawLoss(placeShares(WIN_TABLE, scenarioNumber(uma), 'g1', layerShare(uma.build, uma.scenario)), rng)
      resultSeq += 1
      const resultId = `sim-expedition-${resultSeq}`
      const recorded = ok(recordExpeditionRace(state, { umaId, expeditionId: expeditionId(uma.tier), won }, now), 'expedition race')
      state = recorded.state
      pay(resultId, `${expeditionId(uma.tier)}-race-${plan.raced}`, 'g1', place, now, true)
      countRace(logs, now)
      if (recorded.receipt.inducted) tierLog(state.umas[umaId]!).finishedAt = now
    }
  }
  const readyForPromotion = (uma: UmaState): boolean => uma.tier < 3 && uma.expedition.runs.some((run) => run.completed)

  const racing = (now: number, index: number, perDay: number) => {
    const ids = Object.keys(state.umas).sort()
    for (const umaId of ids) {
      const uma = state.umas[umaId]!
      if (uma.hallOfFame || readyForPromotion(uma)) continue
      if (config.racing === 'as-unlocks-land') {
        // While her levels trail her layer she races, and stops at her first loss until the next check-in.
        const share = layerShare(uma.build, uma.scenario)
        let lost = false
        raceCareer(umaId, now, (her) => !lost && !atGate(her) && (layerDone(her.build, her.scenario) ? true : levelShare(her) < share), (place) => { lost = place > 1 })
      } else if (layerDone(uma.build, uma.scenario)) {
        raceCareer(umaId, now, (her) => !atGate(her))
      }
      const her = state.umas[umaId]!
      if (inLastScenario(her) && atGate(her) && layerDone(her.build, her.scenario)) raceExpedition(umaId, expeditionRacesAt(index, perDay), now)
    }
    const minute = Math.round(((now - LOOP_EPOCH) % MS_PER_DAY) / 60_000)
    if (config.racing === 'heavy' && minute === HEAVY_CHECK_IN) {
      const day = dayOf(now)
      // Layer-complete Umas: her current layer done first, then any Uma with a layer of this tier done (D348).
      const done = (umaId: string) => {
        const uma = state.umas[umaId]!
        return uma.hallOfFame === null && layerDone(uma.build, uma.scenario)
      }
      const trained = (umaId: string) => {
        const uma = state.umas[umaId]!
        return uma.hallOfFame === null && !done(umaId) && (uma.scenario > 1 || layerDone(uma.build, 1))
      }
      const eligible = [...ids.filter(done), ...ids.filter(trained)]
      for (let k = 0; eligible.length > 0 && (logs.racesByDay[day] ?? 0) < HEAVY_RACES_PER_DAY; k += 1) {
        const umaId = eligible[k % eligible.length]!
        const uma = state.umas[umaId]!
        const g1s = SIM_CONTENT.races.filter((race) => race.grade === 'g1' && race.distanceCategory === uma.raceDefaults.selectedPreset)
        runRace(umaId, { raceId: g1s[k % g1s.length]!.id, grade: 'g1' }, now)
      }
    }
  }

  // ---- Scenario bookkeeping and the advance (03 §5, 04 §3) ---------------------------------------------------------
  const bookkeep = (now: number) => {
    for (const uma of Object.values(state.umas)) {
      const log = tierLog(uma).scenarios[uma.scenario]
      if (!log) continue
      if (log.layerDoneAt === null && layerDone(uma.build, uma.scenario)) log.layerDoneAt = now
      if (log.doneAt === null && log.layerDoneAt !== null && atGate(uma)) log.doneAt = now
    }
  }
  const advance = (now: number) => {
    for (const umaId of Object.keys(state.umas).sort()) {
      const uma = state.umas[umaId]!
      if (inLastScenario(uma) || !layerDone(uma.build, uma.scenario) || !atGate(uma)) continue
      state = ok(advanceScenario(state, { umaId }, now, TIER_ENV), 'advance-scenario').state
      const moved = state.umas[umaId]!
      tierLog(moved).scenarios[moved.scenario] = { enteredAt: now, layerDoneAt: null, doneAt: null }
    }
  }
  const promotions = (now: number) => {
    for (const umaId of Object.keys(state.umas).sort()) {
      const uma = state.umas[umaId]!
      if (!readyForPromotion(uma) || !isFree(state, umaId)) continue
      const presets = promotionPresetStats(uma, SIM_CONTENT)
      tierLog(uma).finishedAt = now
      state = ok(promote(state, { umaId, presets }, now, TIER_ENV), 'promote').state
      enterTier(umaId, state.umas[umaId]!.tier, now)
    }
  }

  // ---- Bonds into her race preset (06 §2, T132) --------------------------------------------------------------------
  const fillPresets = (paid: readonly SessionPaid[], now: number) => {
    for (const { umaId, bonded } of paid) {
      for (const cardId of bonded) {
        const uma = state.umas[umaId]!
        const preset = uma.raceDefaults.selectedPreset
        const set = uma.build.presets[preset].cardSetIds
        if (set.length >= CARD_SET_SIZE || set.includes(cardId)) continue
        state = ok(setCardSet(state, { umaId, preset, cardSetIds: [...set, cardId] }, now, TIER_ENV), 'set-card-set').state
      }
    }
  }

  // ---- Spending (12 §12) -------------------------------------------------------------------------------------------
  const spend = (now: number): UpgradeStep | null => {
    if (config.buildings === 'upgrade') {
      for (let next = nextUpgrade(state, busy); next !== null; next = nextUpgrade(state, busy)) {
        const result = upgrade(state, { building: next.building }, now, ENV)
        if (isRefusal(result)) return next
        state = result.state
        logs.spent.upgrades += result.receipt.prizeMoney
        logs.upgrades.push({ building: next.building, level: result.receipt.to, at: now })
      }
      if (!allUpgraded(state)) return null
    }
    const qty = Math.floor(state.profile.prizeMoney / SPEED_TICKET_PRICE)
    if (qty > 0) {
      opSeq += 1
      const bought = ok(buy(state, { opId: `sim-buy-${opSeq}`, sku: SPEED_TICKET_ID, qty, unitPrice: SPEED_TICKET_PRICE }, now), 'buy')
      state = bought.state
      logs.spent.tickets += bought.receipt.total
      logs.ticketsBought += qty
      logs.ticketBuys.push({ at: now, qty })
    }
    return null
  }

  // ---- Work (02 §3–§6, 01 §4, 12 §12) ------------------------------------------------------------------------------
  const timing = (now: number) => ({ now, times: state.profile.checkIns, utcOffsetMin: UTC_OFFSET_MIN })
  const excludedIds = (): Set<string> => new Set(Object.values(state.umas).filter(readyForPromotion).map((uma) => uma.outfitId))

  /** The next upgrade's crafted items: start what's missing with Free Umas, and shelve what's made (T132 "Spending"). */
  const upgradeWork = (step: UpgradeStep, now: number, excluded: ReadonlySet<string>): { shelf: Shelf; started: StartReceipt[] } => {
    const started: StartReceipt[] = []
    const coming = new Map<string, number>()
    for (const item of projectWork(state, now, ENV).coming) coming.set(item.item, (coming.get(item.item) ?? 0) + 1)
    const needs = upgradeCost(step.building, step.to).items
    for (const { item, qty } of needs) {
      const crafted = itemById(item)
      if (crafted?.kind !== 'crafted') continue
      const missing = qty - (state.items[item] ?? 0) - (coming.get(item) ?? 0)
      if (missing <= 0) continue
      const raw = crafted.pair
      const rawHave = state.items[raw] ?? 0
      const jobs: { item: ItemId; count: number }[] = []
      if (rawHave > 0) jobs.push({ item, count: Math.min(missing, rawHave) })
      const toGather = missing - rawHave - (coming.get(raw) ?? 0)
      if (toGather > 0) jobs.push({ item: raw, count: toGather })
      for (const job of jobs) {
        const bench = new Bench(state, state.items)
        for (const uma of freeUmas(state)) {
          if (excluded.has(uma.outfitId)) continue
          const line = jobFor(state, bench, uma, job.item, Math.min(10, job.count), timing(now))
          if (line === null) continue
          const result = start(state, { outfitId: uma.outfitId, slot: line.slot, request: line.request }, now, ENV)
          if (isRefusal(result)) continue
          state = result.state
          started.push(result.receipt)
          coming.set(job.item, (coming.get(job.item) ?? 0) + line.size)
          break
        }
      }
    }
    // What the shelf keeps: the crafted items in stock, then the raw still to craft into the rest.
    const shelf: Record<string, number> = {}
    for (const { item, qty } of needs) {
      const crafted = itemById(item)
      if (crafted?.kind !== 'crafted') continue
      const have = Math.min(qty, state.items[item] ?? 0)
      if (have > 0) shelf[item] = have
      const rawFor = Math.min(state.items[crafted.pair] ?? 0, Math.max(0, qty - have - (coming.get(item) ?? 0)))
      if (rawFor > 0) shelf[crafted.pair] = rawFor
    }
    return { shelf, started }
  }

  /** A Free Uma left idle: no slot when a line she could start was at a full place, else no inputs. */
  const idleReason = (planned: Plan, uma: UmaState, chosen: ChosenCards): { reason: IdleReason; building: BuildingId | null } => {
    const full = (building: BuildingId, room: string | null) =>
      slotsOf(state, building).filter((slot) => (slot.room ?? null) === room).every((slot) => slotHolder(state, slot) !== undefined)
    for (const line of [...planned.dishes, ...planned.crafted, ...planned.raw]) {
      if (line.short <= 0 || !canWorkGrade(uma.farm.level, line.grade)) continue
      const inputs = recipeOf(line.item)?.inputs ?? []
      if (inputs.some(({ item, qty }) => (state.items[item] ?? 0) < qty)) continue
      const def = itemById(line.item)!
      const building: BuildingId = def.kind === 'raw' ? FAMILY_SITE[def.family] : def.kind === 'crafted' ? 'pantry' : 'kitchen'
      if (full(building, null)) return { reason: 'no-slot', building }
    }
    for (const entry of remainingFor(state, uma.outfitId, chosen)) {
      if (entry.kind !== 'unlock' || (entry.dishId !== null && heldFor(state.items, entry.dishId) < 1)) continue
      if (entry.rooms.length > 0 ? entry.rooms.every((room) => full(entry.facility, room)) : full(entry.facility, null)) {
        return { reason: 'no-slot', building: entry.facility }
      }
    }
    return { reason: 'no-inputs', building: null }
  }

  const work = (now: number, next: number): { idle: Map<string, IdleReason>; bottleneck: Set<BuildingId> } => {
    const excluded = excludedIds()
    const chosen = chosenCards(state)
    const bottleneck = new Set<BuildingId>()
    const started: StartReceipt[] = []
    let shelf: Shelf = {}
    const step = config.buildings === 'upgrade' ? nextUpgrade(state, busy) : null
    if (step !== null) {
      const made = upgradeWork(step, now, excluded)
      shelf = made.shelf
      started.push(...made.started)
    }
    state = shelve(state, shelf, 1)

    // Repeat what the planner still needs (02 §5's Switch is the owner's when it isn't), then the suggestions.
    const before = planFrom(projectWork(state, now, ENV), config.targets === 'automatic' ? targetsOf(state, chosen) : furthestBehind(state, chosen, excluded), chosen)
    const needed = new Set([...before.dishes, ...before.crafted, ...before.raw].filter((line) => line.short > 0).map((line) => line.item))
    const ids = Object.values(state.work).filter((row) => {
      if (row.last === null || excluded.has(row.outfitId) || !isFree(state, row.outfitId)) return false
      const request = row.last.request
      return request.kind === SESSION_KIND ? row.last.slot.building !== 'dojo' : needed.has(request.item)
    }).map((row) => row.outfitId)
    if (ids.length > 0 && config.sizing === 'fit') {
      const repeated = repeat(state, { outfitIds: ids, utcOffsetMin: UTC_OFFSET_MIN }, now, ENV)
      state = repeated.state
      for (const skip of repeated.receipt.skipped) if (skip.code === 'place-full') {
        const last = state.work[skip.outfitId]?.last
        if (last) bottleneck.add(last.slot.building)
      }
      for (const line of repeated.receipt.started) {
        const row = state.work[line.outfitId]!
        const entry = row.entries[row.entries.length - 1]!
        started.push({ outfitId: line.outfitId, slot: line.slot, request: line.request, startedAt: entry.startedAt, endsAt: line.endsAt, collected: null, movements: [], settled: { started: [], dropped: [], movements: [] } })
      }
      for (const movement of repeated.receipt.movements) if (movement.kind === 'reserve' && fromKitchen(movement.item)) {
        logs.reservedDishes[movement.item] = (logs.reservedDishes[movement.item] ?? 0) + movement.qty
      }
    }
    // The suggestions, pass by pass: the automatic targets once, or the owner's marks five at a time, furthest behind
    // first, until no Free Uma is left without a line (T132 "Check-ins and idle Umas"; 02 §6's targets).
    const passes = config.targets === 'automatic' ? [null] : chunks(furthestBehind(state, chosen, excluded), MAX_TARGETS)
    for (const marked of passes) {
      if (marked !== null) state = ok(setTargets(state, { outfitIds: marked }, now), 'set-targets').state
      const suggestions = suggest(state, now, { env: ENV, chosen, utcOffsetMin: UTC_OFFSET_MIN })
      const lines = suggestions.suggestions.filter((line) => !excluded.has(line.outfitId)).map((line) => (config.sizing === 'one' ? single(line) : line))
      const ran = startSuggestions(state, lines, now, ENV)
      state = ran.state
      started.push(...ran.started)
      for (const receipt of ran.started) for (const movement of receipt.movements) {
        if (movement.kind === 'reserve' && fromKitchen(movement.item)) logs.reservedDishes[movement.item] = (logs.reservedDishes[movement.item] ?? 0) + movement.qty
      }
      if (suggestions.idle.every((id) => excluded.has(id))) break
    }

    // Queues (02 §3): a craft that ends before the next check-in queues up to three more entries behind it, each fitted
    // to the time left and to the free stock the queues before it leave. `tens` queues only the rest of a fitted ×10, as
    // 02 §3's craft row does; `fill` also queues the planner's other short crafted lines behind a smaller craft.
    const budget = new Map(Object.entries(state.items))
    const shortCrafted = before.crafted.filter((line) => line.short > 0).sort((a, b) => b.short - a.short || a.grade - b.grade)
    for (const receipt of started) {
      const request = receipt.request
      if (config.sizing === 'one' || request.kind !== 'craft' || receipt.endsAt >= next) continue
      if (config.queues === 'tens' && request.count !== 10) continue
      let at = receipt.endsAt
      const lines = config.queues === 'tens' ? [request.item] : [request.item, ...shortCrafted.map((line) => line.item).filter((item) => item !== request.item)]
      let added = 0
      for (const item of lines) {
        if (added >= MAX_QUEUE) break
        const def = itemById(item)
        if (def?.kind !== 'crafted' || !canWorkGrade(state.umas[receipt.outfitId]!.farm.level, def.grade)) continue
        const seconds = farmItemSeconds('craft', def.grade, speedAt(state, 'pantry')) * 1000
        const have = budget.get(def.pair) ?? 0
        const count = Math.min(MAX_ITEMS_PER_ENTRY, Math.floor((next - at) / seconds), have)
        if (count < 1) continue
        const queued = queue(state, { outfitId: receipt.outfitId, add: { request: { kind: 'craft', item, count }, building: 'pantry' } }, now, ENV)
        if (isRefusal(queued)) break
        state = queued.state
        budget.set(def.pair, have - count)
        at += count * seconds
        added += 1
      }
    }
    state = shelve(state, shelf, -1)

    // Who is left idle, and why (T132 "Report").
    const idle = new Map<string, IdleReason>()
    for (const uma of Object.values(state.umas)) {
      if (!isFree(state, uma.outfitId)) continue
      if (excluded.has(uma.outfitId) || uma.hallOfFame) { idle.set(uma.outfitId, 'held'); continue }
      const why = idleReason(before, uma, chosen)
      idle.set(uma.outfitId, why.reason)
      if (why.building !== null) bottleneck.add(why.building)
    }
    return { idle, bottleneck }
  }

  // ---- Speed Tickets (T132 "Spending") -----------------------------------------------------------------------------
  const spendTickets = (now: number) => {
    for (const line of ticketPlan(state, now)) {
      const result = speedUp(state, line, now, ENV)
      if (isRefusal(result)) continue
      state = result.state
      logs.ticketMinutes += result.receipt.savedMinutes
    }
  }

  // ---- One check-in ------------------------------------------------------------------------------------------------
  const checkIn = (now: number, index: number, perDay: number, next: number) => {
    if (sample !== null) closeBucket(logs, sample, settle(state, now, ENV).state, now)
    if (now === checkInsOn(0, config.checkIns)[0]) growRoster(now, true)

    const collected = collectAll(state, {}, now, ENV)
    state = collected.state
    const paid: SessionPaid[] = []
    for (const receipt of collected.receipt.collected) {
      for (const output of receipt.outputs) if ('item' in output && fromKitchen(output.item)) logs.cooked[output.item] = (logs.cooked[output.item] ?? 0) + 1
      if (receipt.gradesOpened.length > 0) { const opened = tierLog(state.umas[receipt.outfitId]!).gradeOpenedAt; for (const g of receipt.gradesOpened) opened[g - 1] ??= now }
      for (const detail of receipt.paid) {
        const session = detail as SessionPaid
        paid.push(session)
        logs.unlocks += session.opened.length
        countUnlocks(logs, now, session.opened.length)
        for (const unlock of session.opened) {
          const key = unlock.dishId ?? NO_ITEM
          logs.unlockDishes[key] = (logs.unlockDishes[key] ?? 0) + 1
        }
      }
    }
    fillPresets(paid, now)
    promotions(now)
    growRoster(now, false)
    racing(now, index, perDay)
    growRoster(now, false)
    bookkeep(now)
    advance(now)
    spend(now)
    const { idle, bottleneck } = work(now, next)
    spendTickets(now)

    const { held, slots } = slotSample(state)
    const working = new Set(Object.values(state.work).filter((row) => row.slot !== null && row.entries.length > 0 && endsAt(row.entries[row.entries.length - 1]!) > now).map((row) => row.outfitId))
    sample = { at: now, held, slots, working, idle, bottleneck: [...bottleneck] }
  }

  const horizonMet = (): boolean => {
    const founders = Object.values(logs.umas).filter((uma) => uma.founding)
    const done = founders.filter((uma) => uma.tiers.some((tier) => tier.tier === config.tiers && tier.finishedAt !== null)).length
    return founders.length > 0 && done >= Math.ceil(HORIZON_SHARE * founders.length)
  }

  return {
    logs,
    state: () => state,
    checkIn: (now, index, perDay, next) => {
      const day = dayOf(now)
      while (logs.stock.length * 7 <= day) stockSnapshot(logs, state, logs.stock.length)
      checkIn(now, index, perDay, next)
    },
    horizonMet,
  }
}

/** A whole run: check-ins day by day until the horizon (or the safety stop), then the summary. */
export function simulateLoop(config: LoopConfig, rng: LoopRng): LoopResult {
  const engine = createLoop(config, rng)
  let endedAt = LOOP_EPOCH
  outer: for (let day = 0; day <= config.maxDays; day += 1) {
    const times = checkInsOn(day, config.checkIns)
    for (let i = 0; i < times.length; i += 1) {
      const now = times[i]!
      engine.checkIn(now, i, times.length, nextCheckIn(now, config.checkIns, UTC_OFFSET_MIN))
      endedAt = now
      if (engine.horizonMet()) break outer
    }
  }
  return { config, metrics: summarize(engine.logs, config, endedAt), logs: engine.logs, state: engine.state(), endedAt }
}

/** The baseline (12 §12): three check-ins, target racing, the roster growing to 25, the spending policy, three tiers. */
export const BASELINE: LoopConfig = BASELINE_CONFIG

/**
 * The variants (T132 "Racing variants", "Other variants"), tier 1 each: the baseline's racing, check-ins, roster and
 * buildings, with one axis changed. `--matrix` runs them all.
 */
export const LOOP_VARIANTS: Readonly<Record<string, LoopConfig>> = Object.freeze({
  baseline: { ...BASELINE, tiers: 1 },
  heavy: { ...BASELINE, tiers: 1, racing: 'heavy' },
  'no-pay': { ...BASELINE, tiers: 1, racing: 'no-pay' },
  'as-unlocks-land': { ...BASELINE, tiers: 1, racing: 'as-unlocks-land' },
  'one-check-in': { ...BASELINE, tiers: 1, checkIns: [480] },
  'two-check-ins': { ...BASELINE, tiers: 1, checkIns: [480, 1350] },
  'roster-20': { ...BASELINE, tiers: 1, roster: { kind: 'fixed', size: 20 } },
  'roster-25': { ...BASELINE, tiers: 1, roster: { kind: 'fixed', size: 25 } },
  'roster-30': { ...BASELINE, tiers: 1, roster: { kind: 'fixed', size: 30 } },
  'roster-uncapped': { ...BASELINE, tiers: 1, roster: { kind: 'grow', cap: null } },
  'buildings-frozen': { ...BASELINE, tiers: 1, buildings: 'frozen' },
} satisfies Record<string, LoopConfig>)


