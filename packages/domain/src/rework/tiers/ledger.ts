// Once-only payments (docs/rework/04-tiers-and-promotion.md §3, §6): every ticket and Shard the tier rules pay is a
// ledger row whose id names it, so a second payment under the same id pays nothing.
import { LEDGER_BALANCE, type AccountProfile, type LedgerEntry, type LedgerReason, type ReworkState, type UmaState } from '../types'

export const hasLedgerEntry = (state: Pick<ReworkState, 'ledger'>, id: string): boolean => state.ledger.some((entry) => entry.id === id)

/** Move one balance and append its row. Callers check once-only ids first, or use `payOnce`. */
export function writeLedger<S extends ReworkState>(
  state: S,
  row: { id: string; resource: LedgerEntry['resource']; delta: number; reason: LedgerReason },
  at: number,
): S {
  const balance = LEDGER_BALANCE[row.resource]
  const profile: AccountProfile = { ...state.profile, [balance]: state.profile[balance] + row.delta }
  return { ...state, profile, ledger: [...state.ledger, { ...row, at }] }
}

/**
 * Pay `delta` of a resource once under `id`: the profile's balance moves and the row is appended. Already paid, the
 * state comes back as it was and `paid` is 0.
 */
export function payOnce<S extends ReworkState>(
  state: S,
  row: { id: string; resource: LedgerEntry['resource']; delta: number; reason: LedgerReason },
  at: number,
): { state: S; paid: number } {
  if (hasLedgerEntry(state, row.id)) return { state, paid: 0 }
  return { state: writeLedger(state, row, at), paid: row.delta }
}

/** The state with one Uma replaced, under her outfit id. */
export const withUma = <S extends ReworkState>(state: S, uma: UmaState): S => ({ ...state, umas: { ...state.umas, [uma.outfitId]: uma } })

/** Integer milliseconds since the epoch; anything else is a caller's bug that phase 3's parsers keep out. */
export function assertNow(now: number): void {
  if (!Number.isSafeInteger(now) || now < 0) throw new RangeError(`now must be integer milliseconds: ${now}`)
}
