// SC5: Racer's data, content and vocabulary at the shared engine boundary. No clock, queue or reservation rules live
// here. Keep Racer's operation receipts stable for check-ins, sync retries and already-saved purchases.
import * as core from '@luismlorenzana/uma-work'
import { BUILDING_IDS, BUILDINGS, buildingSpeed, slotsPerRoom, upgradeCost, type BuildingId, type BuildingLevel } from '../farm/buildings'
import { addFarmExp } from '../farm/level'
import { SPEED_TICKET_ID, isItemGrade, type ItemGrade } from '../items/catalogue'
import { canWorkGrade, highestOpenGrade } from '../items/grades'
import { isRefusal, refuse, type LedgerEntry, type OpResult, type Refusal, type ReworkState } from '../state/types'
import { withUma } from '../tiers/ledger'
import { tierRefusal } from '../tiers/refusals'
import { WORK_KINDS, type PlannedItem, type WorkEnv } from './kinds'
import { WORK_REFUSALS, type WorkRefusalCode } from './refusals'
import type { Entry, SettleReport, SlotRef, WorkRequest, WorkRow, WorkState } from './types'

export const WORK_BUILDINGS = core.buildingTable(Object.fromEntries(BUILDING_IDS.map((id) => [id, {
  rooms: BUILDINGS[id].rooms,
  slots: ([1, 2, 3] as const).map((level) => slotsPerRoom(id, level)),
  speed: ([1, 2, 3] as const).map(buildingSpeed),
  upgrades: ([2, 3] as const).map((level) => { const cost = upgradeCost(id, level); return { money: cost.prizeMoney, items: cost.items } }),
}])))

export function racerRefusal(value: core.Refusal): Refusal {
  const code = value.code === 'money' ? 'prize-money' : value.code === 'unknown-worker' ? 'unknown-uma' : value.code
  if (code === 'unknown-uma') return tierRefusal(code, value.data)
  const reason = Object.hasOwn(WORK_REFUSALS, code) ? WORK_REFUSALS[code as WorkRefusalCode] : value.message
  return refuse(code, reason, value.data)
}

interface FarmPayment {
  readonly farmExp: number
  readonly farmLevel: { readonly from: number; readonly to: number }
  readonly gradesOpened: readonly ItemGrade[]
}

/** Native package environment, also consumed unchanged by uma-kit/work. Content stays private and game-owned. */
export function sharedWorkEnv<S extends WorkState = WorkState>(env: WorkEnv): core.WorkEnv<S> {
  const kinds = Object.fromEntries(Object.entries(env.kinds ?? WORK_KINDS).map(([key, rules]) => [key, {
    plan(state: S, id: string, request: WorkRequest, now: number, context: core.PlanContext<S>) {
      const plan = rules!.plan(state, id, request, now, { ...context, slot: context.slot as SlotRef, earlier: context.earlier, env })
      return isRefusal(plan) ? core.refuse(plan.code, plan.reason, plan.data) : plan
    },
    pay<T extends S>(state: T, id: string, outputs: readonly core.WorkOutput[], context: core.PayContext<S>) {
      return rules!.pay(state, id, outputs, { ...context, env })
    },
  } satisfies core.WorkKindRules<S>]))
  return {
    kinds, buildings: WORK_BUILDINGS, tickets: core.warehouseTickets(SPEED_TICKET_ID),
    isWorker: (state, id) => state.umas[id] !== undefined,
    exp: {
      grant(state, id, exp) {
        const uma = state.umas[id]
        if (!uma) throw new RangeError(`No Uma ${id} for her work`)
        const farm = addFarmExp(uma.farm, exp)
        const from = highestOpenGrade(uma.farm.level), to = highestOpenGrade(farm.level)
        const detail: FarmPayment = {
          farmExp: farm.exp - uma.farm.exp, farmLevel: { from: uma.farm.level, to: farm.level },
          gradesOpened: Array.from({ length: to - from }, (_, i) => (from + i + 1) as ItemGrade),
        }
        return { state: farm.exp === uma.farm.exp ? state : withUma(state, { ...uma, farm }), detail }
      },
      gradeOpen: (state, id, _kind, grade) => isItemGrade(grade) && canWorkGrade(state.umas[id]?.farm.level ?? 0, grade),
    },
    money: {
      balance: (state) => state.profile.prizeMoney,
      spend: (state, amount) => ({ ...state, profile: { ...state.profile, prizeMoney: state.profile.prizeMoney - amount } }),
    },
    // The engine already charged the balance. Append the audit row without charging it a second time.
    ledger: { record: (state, charge) => ({ ...state, ledger: [...state.ledger, chargeRow(charge)] }) },
  }
}

const chargeRow = (charge: core.UpgradeCharge): LedgerEntry => ({
  id: charge.id, resource: 'prize-money', delta: charge.delta, reason: 'upgrade', at: charge.at,
})

export type PaidWork = Omit<core.PaidWork, 'exp' | 'expDetail'> & FarmPayment
export type CollectReceipt = PaidWork & { readonly settled: SettleReport }
export type StartInput = Omit<core.StartInput<WorkRequest>, 'slot'> & { readonly slot: SlotRef }
export type StartReceipt = Omit<core.StartReceipt<WorkRequest>, 'slot' | 'collected' | 'settled'> & {
  readonly slot: SlotRef; readonly collected: PaidWork | null; readonly settled: SettleReport
}
export type QueueInput = core.QueueInput<WorkRequest>
export type QueueEdit = core.QueueEdit<WorkRequest>
export type QueueReceipt = core.QueueReceipt<WorkRequest> & { readonly settled: SettleReport }
export type RecallReceipt = CollectReceipt & Pick<core.RecallReceipt<WorkRequest>, 'recalled' | 'returned' | 'droppedQueue' | 'lostMinutes'>
export type SpeedUpInput = core.SpeedUpInput
export type SpeedUpReceipt = core.SpeedUpReceipt<WorkRequest> & { readonly settled: SettleReport }
export type UpgradeReceipt = Omit<core.UpgradeReceipt<WorkRequest>, 'building' | 'from' | 'to' | 'money' | 'charge' | 'settled'> & {
  readonly building: BuildingId; readonly from: BuildingLevel; readonly to: BuildingLevel
  readonly prizeMoney: number; readonly ledger: readonly LedgerEntry[]; readonly settled: SettleReport
}

function paidReceipt(paid: core.PaidWork, state: WorkState): PaidWork {
  const { exp: _exp, expDetail, ...rest } = paid
  const level = state.umas[paid.outfitId]?.farm.level ?? 1
  return { ...rest, ...(expDetail as FarmPayment | null ?? { farmExp: 0, farmLevel: { from: level, to: level }, gradesOpened: [] }) }
}

export function newWorkState<S extends ReworkState>(account: S): S & WorkState {
  if (Object.keys(account.work).length > 0) throw new RangeError('A new Farm starts with no work rows')
  return { ...account, ...core.newWorkState(WORK_BUILDINGS, account.items ?? {}) } as S & WorkState
}

// Narrow ids below are safe at this boundary: only WORK_BUILDINGS and Racer's validated request/save parsers create
// slots and requests. Wider game state passes through the package's generic operations untouched.
export const buildingLevel = (state: Pick<WorkState, 'buildings'>, building: BuildingId): BuildingLevel => core.buildingLevel(state, building) as BuildingLevel
export const speedAt = (state: Pick<WorkState, 'buildings'>, building: BuildingId): number => core.speedAt(state, building, WORK_BUILDINGS)
export const slotExists = (state: Pick<WorkState, 'buildings'>, slot: SlotRef): boolean => core.slotExists(state, slot, WORK_BUILDINGS)
export const slotOrder = (a: SlotRef, b: SlotRef): number => core.slotOrder(a, b, WORK_BUILDINGS)
export const slotsOf = (state: Pick<WorkState, 'buildings'>, building: BuildingId): SlotRef[] => core.slotsOf(state, building, WORK_BUILDINGS) as SlotRef[]
export const emptyRow = (id: string): WorkRow => core.emptyRow(id) as WorkRow
export const entryFrom = (request: WorkRequest, items: readonly PlannedItem[], at: number, speed: number, queued: boolean): Entry => core.entryFrom(request, items, at, speed, queued) as Entry
export const EMPTY_SETTLE = core.EMPTY_SETTLE as SettleReport
export const joinSettles = core.joinSettles
export {
  applyTickets, chainTimes, endsAt, finishedCount, itemEnds, itemProgress, progress, remainingMs, ticketsToFinish,
  MS_PER_SECOND, SPEED_TICKET_MS, MIN_ITEMS_PER_ENTRY, MAX_ITEMS_PER_ENTRY, MAX_QUEUE, requestCount,
  holdsSlot, slotHolder, samePlace, sameSlot, withRow, stockOf, sumInputs, shortfall, largestCoverable, moveStock, movements,
  statusOf, isFree, reservedStock,
} from '@luismlorenzana/uma-work'
export type { WorkStatus, Timed, ChainLink, ChainTimes, AppliedTickets } from '@luismlorenzana/uma-work'

export function settle<S extends WorkState>(state: S, now: number, env: WorkEnv): { readonly state: S; readonly report: SettleReport } {
  return core.settle(state, now, sharedWorkEnv<S>(env)) as { state: S; report: SettleReport }
}
export const workState = (state: WorkState, id: string, now: number, env: WorkEnv): core.WorkStatus => core.workState(state, id, now, sharedWorkEnv(env))
export const chainEnd = (state: WorkState, row: WorkRow, now: number, env: WorkEnv): number => core.chainEnd(state, row, now, sharedWorkEnv(env))
export const freeAt = (state: WorkState, id: string, now: number, env: WorkEnv): number | null => core.freeAt(state, id, now, sharedWorkEnv(env))

export function payWork<S extends WorkState>(state: S, id: string, now: number, env: WorkEnv, only?: (entry: Entry) => boolean): { readonly state: S; readonly paid: PaidWork } {
  const result = core.payWork(state, id, now, sharedWorkEnv<S>(env), only)
  return { state: result.state, paid: paidReceipt(result.paid, state) }
}

export function start<S extends WorkState>(state: S, input: StartInput, now: number, env: WorkEnv): OpResult<StartReceipt, S> {
  const result = core.start(state, input, now, sharedWorkEnv<S>(env))
  if (core.isRefusal(result)) return racerRefusal(result)
  return { state: result.state, receipt: { ...result.receipt, collected: result.receipt.collected === null ? null : paidReceipt(result.receipt.collected, state) } as StartReceipt }
}
export function queue<S extends WorkState>(state: S, input: QueueInput, now: number, env: WorkEnv): OpResult<QueueReceipt, S> {
  const result = core.queue(state, input, now, sharedWorkEnv<S>(env))
  return core.isRefusal(result) ? racerRefusal(result) : result as { state: S; receipt: QueueReceipt }
}
export function collect<S extends WorkState>(state: S, input: { readonly outfitId: string }, now: number, env: WorkEnv): { readonly state: S; readonly receipt: CollectReceipt } {
  const result = core.collect(state, input, now, sharedWorkEnv<S>(env))
  return { state: result.state, receipt: { ...paidReceipt(result.receipt, state), settled: result.receipt.settled as SettleReport } }
}
export function recall<S extends WorkState>(state: S, input: { readonly outfitId: string }, now: number, env: WorkEnv): { readonly state: S; readonly receipt: RecallReceipt } {
  const result = core.recall(state, input, now, sharedWorkEnv<S>(env))
  return { state: result.state, receipt: { ...paidReceipt(result.receipt, state), settled: result.receipt.settled as SettleReport,
    recalled: result.receipt.recalled, returned: result.receipt.returned, droppedQueue: result.receipt.droppedQueue, lostMinutes: result.receipt.lostMinutes } }
}
export function speedUp<S extends WorkState>(state: S, input: SpeedUpInput, now: number, env: WorkEnv): OpResult<SpeedUpReceipt, S> {
  const result = core.speedUp(state, input, now, sharedWorkEnv<S>(env))
  return core.isRefusal(result) ? racerRefusal(result) : result as { state: S; receipt: SpeedUpReceipt }
}
export function finish<S extends WorkState>(state: S, input: { readonly outfitId: string; readonly startedAt: number }, now: number, env: WorkEnv): OpResult<SpeedUpReceipt, S> {
  const result = core.finish(state, input, now, sharedWorkEnv<S>(env))
  return core.isRefusal(result) ? racerRefusal(result) : result as { state: S; receipt: SpeedUpReceipt }
}
export const upgradeLedgerId = core.upgradeLedgerId
export function upgrade<S extends WorkState>(state: S, input: { readonly building: BuildingId }, now: number, env: WorkEnv): OpResult<UpgradeReceipt, S> {
  const result = core.upgrade(state, input, now, sharedWorkEnv<S>(env))
  if (core.isRefusal(result)) return racerRefusal(result)
  const { money, charge, ...receipt } = result.receipt
  return { state: result.state, receipt: { ...receipt, prizeMoney: money, ledger: charge === null ? [] : [chargeRow(charge)] } as UpgradeReceipt }
}
