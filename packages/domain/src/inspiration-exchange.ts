// Inspiration token exchange between adjacent scenarios (docs/design/uma-rpg.md#inventory-and-exchange, D309).
// Two tokens of one kind make one of the next scenario's; one makes two of the scenario before. The output repays its
// own Inspiration advance first (D256), like an RPG reward, so repaid output never reaches Items.
import { repayInspiration, type InspirationBank } from './inspiration-bank'
import {
  INSPIRATION_EXCHANGE_MAX_BATCHES, inspirationExchangeDelta, inspirationExchangeMovementId, inspirationTokenId,
  type InspirationExchangeDirection, type InspirationMovement, type InspirationTokenKind,
} from './inspiration'
import { SCENARIOS } from './scenarios'

export interface InspirationExchangeRequest {
  kind: InspirationTokenKind
  /** The lower scenario of the pair; the higher one is the next tier. */
  lowerTier: number
  direction: InspirationExchangeDirection
  batches: number
}
export interface InspirationExchangePlan {
  from: string
  to: string
  spend: number
  gross: number
  debtPaid: number
  net: number
  bank: InspirationBank | null
  movements: [InspirationMovement, InspirationMovement]
  /** Items after the exchange. */
  after: { from: number; to: number }
}

export function validInspirationExchange(request: InspirationExchangeRequest): boolean {
  return (request.kind === 'slot' || request.kind === 'skill') && Number.isSafeInteger(request.lowerTier) &&
    request.lowerTier >= 1 && request.lowerTier < SCENARIOS.length && (request.direction === 'up' || request.direction === 'down') &&
    Number.isSafeInteger(request.batches) && request.batches >= 1 && request.batches <= INSPIRATION_EXCHANGE_MAX_BATCHES
}

/** The two ledger rows, the output's debt repayment and the stock after; throws when Items can't cover it. */
export function planInspirationExchange(request: InspirationExchangeRequest, stocks: Readonly<Record<string, number>>,
  bank: InspirationBank | null, exchangeId: string, now: number): InspirationExchangePlan {
  if (!validInspirationExchange(request)) throw new Error('Invalid token exchange')
  const { kind, lowerTier, direction, batches } = request
  const lower = inspirationTokenId(lowerTier, kind), higher = inspirationTokenId(lowerTier + 1, kind)
  const [from, to] = direction === 'up' ? [lower, higher] : [higher, lower]
  const spend = -inspirationExchangeDelta(direction, 'in', batches), gross = inspirationExchangeDelta(direction, 'out', batches)
  const owned = stocks[from] ?? 0
  if (owned < spend) throw new Error(`Needs ${spend} tokens; ${owned} in Items`)
  const repaid = repayInspiration(bank, to, gross)
  const side = (s: 'in' | 'out', itemId: string, delta: number, debtPaid?: number): InspirationMovement => ({
    id: inspirationExchangeMovementId(exchangeId, s), itemId, delta, createdAt: now, reason: 'inspiration-exchange',
    source: { kind: 'inspiration-exchange', exchangeId, tier: Number(/:t(\d+):/.exec(itemId)![1]), tokenKind: kind, direction, batches, side: s,
      ...(debtPaid ? { debtPaid } : {}) },
  })
  return { from, to, spend, gross, debtPaid: repaid.debtPaid, net: repaid.net, bank: repaid.bank,
    movements: [side('in', from, -spend), side('out', to, gross, repaid.debtPaid)],
    after: { from: owned - spend, to: (stocks[to] ?? 0) + repaid.net } }
}
