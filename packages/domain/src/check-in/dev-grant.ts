// `dev-grant`: the rehearsal's one shortcut (M034 "Dev shortcuts are dev-only"; docs/rearchitecture/07-data-reset.md §5;
// docs/game/09-racing-rewards-and-exchange.md §9's `dev-grant` reason; T134). A fresh account reaches what takes days
// for real: items into the Warehouse, Prize Money, Uma Tickets, an Uma's running work finished now, and a jump to her
// scenario's gate with her career won. It runs only where the env says `dev: true`: dev builds, and an API started with
// `DEV_OPERATIONS=true` (T135). Everywhere else it is refused and changes nothing. Every grant is a ledger row, so the
// audit still holds (09 §9): the balances' rows read `dev-grant`, the items' rows too, and a gate pays its Shard once
// under the same id a race would.
import { GATE_SHARD_REWARD, umaGateShardLedgerId } from '../progression'
import { goalRaceIds } from '../scenario-goals'
import type { ItemLedgerEntry } from '../economy/ledger'
import { itemById, type ItemId } from '../items/catalogue'
import { settleGoalWin } from '../tiers/career'
import { assertNow, payOnce, withUma, writeLedger } from '../tiers/ledger'
import { gateLevel, lifetimeLevel } from '../tiers/map'
import { tierRefusal } from '../tiers/refusals'
import type { LedgerEntry, OpResult } from '../state/types'
import { settle } from '../work/settle'
import { withRow } from '../work/state'
import { endsAt, remainingMs } from '../work/timeline'
import type { ItemMovement, WorkState } from '../work/types'
import type { OperationEnv } from './once'
import { checkInRefusal } from './words'

export interface DevGrantInput {
  /** Items added to the Warehouse, by catalogue id. */
  readonly items?: Readonly<Record<ItemId, number>>
  readonly prizeMoney?: number
  readonly umaTickets?: number
  /** Her running job or session ends now, without Speed Tickets; its queue moves on. Collecting it is the next tap. */
  readonly finish?: string
  /** She jumps to her scenario's gate with every goal of her career won, so she can advance at once. */
  readonly gate?: string
}

export interface DevGrantReceipt {
  /** The Prize Money and Uma Tickets rows, and a gate's Shard. */
  readonly ledger: readonly LedgerEntry[]
  /** The items' rows, for phase 3's `itemLedger`. */
  readonly itemLedger: readonly ItemLedgerEntry[]
  /** The entry that ended now, or null when nothing of hers was running. */
  readonly finished: { readonly outfitId: string; readonly startedAt: number } | null
  readonly gate: { readonly umaId: string; readonly level: number; readonly shardsPaid: number } | null
  /** Queue starts the finish set off. */
  readonly movements: readonly ItemMovement[]
}

/** A grant's ledger id: `dev-grant:<opId>:<what>`. */
export const devGrantLedgerId = (opId: string, what: string): string => `dev-grant:${opId}:${what}`

function assertAmount(what: string, n: number | undefined): void {
  if (n !== undefined && (!Number.isSafeInteger(n) || n < 1)) throw new RangeError(`A dev grant of ${what} is a whole number ≥ 1: ${n}`)
}

/** `dev-grant` at `now`, under the operation's `id`. Refused unless `env.dev` is true; a malformed grant throws. */
export function devGrant<S extends WorkState>(state: S, input: DevGrantInput, now: number, env: OperationEnv, id: string): OpResult<DevGrantReceipt, S> {
  assertNow(now)
  if (env.dev !== true) return checkInRefusal('dev-only')
  assertAmount('Prize Money', input.prizeMoney)
  assertAmount('Uma Tickets', input.umaTickets)
  const items = Object.entries(input.items ?? {})
  for (const [item, qty] of items) {
    if (itemById(item) === undefined) throw new RangeError(`No item ${item}`)
    assertAmount(item, qty)
  }
  for (const umaId of [input.finish, input.gate]) {
    if (umaId !== undefined && !state.umas[umaId]) return tierRefusal('unknown-uma', { uma: umaId })
  }

  let next = state
  const ledgerFrom = next.ledger.length
  if (input.prizeMoney !== undefined) {
    next = writeLedger(next, { id: devGrantLedgerId(id, 'prize-money'), resource: 'prize-money', delta: input.prizeMoney, reason: 'dev-grant' }, now)
  }
  if (input.umaTickets !== undefined) {
    next = writeLedger(next, { id: devGrantLedgerId(id, 'uma-tickets'), resource: 'uma-tickets', delta: input.umaTickets, reason: 'dev-grant' }, now)
  }
  const stock: Record<ItemId, number> = { ...next.items }
  const itemLedger: ItemLedgerEntry[] = []
  for (const [item, qty] of items) {
    stock[item] = (stock[item] ?? 0) + qty
    itemLedger.push({ id: devGrantLedgerId(id, item), itemId: item, delta: qty, reason: 'dev-grant', at: now })
  }
  next = { ...next, items: stock }

  let finished: DevGrantReceipt['finished'] = null
  const movements: ItemMovement[] = []
  if (input.finish !== undefined) {
    const before = settle(next, now, env)
    next = before.state
    movements.push(...before.report.movements)
    const row = next.work[input.finish]
    const entry = row?.entries[row.entries.length - 1]
    if (row !== undefined && entry !== undefined && endsAt(entry) > now) {
      const ended = { ...entry, acceleratedMs: entry.acceleratedMs + remainingMs(entry, now) }
      const after = settle(withRow(next, { ...row, entries: [...row.entries.slice(0, -1), ended] }), now, env)
      next = after.state
      movements.push(...after.report.movements)
      finished = { outfitId: input.finish, startedAt: entry.startedAt }
    }
  }

  let gate: DevGrantReceipt['gate'] = null
  if (input.gate !== undefined) {
    const uma = next.umas[input.gate]!
    const level = gateLevel(uma.scenario)
    let career = uma.career
    for (const raceId of career.goals.flatMap(goalRaceIds)) career = settleGoalWin(career, raceId, id, now).career
    const racing = uma.racing.level >= level ? uma.racing : { level, exp: 0 }
    const paid = payOnce(withUma(next, { ...uma, career, racing }), {
      id: umaGateShardLedgerId(uma.outfitId, lifetimeLevel(uma.tier, level)), resource: 'uma-shards', delta: GATE_SHARD_REWARD, reason: 'uma-gate-shard',
    }, now)
    next = paid.state
    gate = { umaId: uma.outfitId, level, shardsPaid: paid.paid }
  }

  return { state: next, receipt: { ledger: next.ledger.slice(ledgerFrom), itemLedger, finished, gate, movements } }
}
