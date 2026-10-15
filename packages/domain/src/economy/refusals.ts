// Every rule failure of a race's prize, `buy` and `sell`, in plain words (docs/rework/02-check-ins-and-notifications.md
// §9, docs/rework/09-racing-rewards-and-exchange.md §5.5, §6, §8). `{name}` placeholders are filled from the refusal's
// data. One table, keyed by what refused, so T131's banned-word test reads every sentence the Exchange can show. The
// two `quantity` codes differ by operation, which is why the table is keyed by operation first.
import { refuse, type Refusal } from '../state/types'

export const EXCHANGE_REFUSALS = {
  prize: {
    place: "{place} isn't a finishing place.",
  },
  buy: {
    'not-sold': 'The Exchange sells raw ingredients and Speed Tickets.',
    'not-stocked': 'In stock once an Uma reaches Farm Lv {level}.',
    /** The 99 is `RAW_PER_PURCHASE`; a test keeps them equal. */
    quantity: 'Buy 1 to 99 at a time.',
    'price-changed': 'Price changed.',
    'prize-money': 'Need {n} more.',
  },
  sell: {
    'not-sellable': "Speed Tickets can't be sold.",
    quantity: 'Sell at least one.',
    'sell-short': 'Only {n} can be sold now.',
    'price-changed': 'Price changed.',
  },
} as const

export type PrizeRefusalCode = keyof typeof EXCHANGE_REFUSALS.prize
export type BuyRefusalCode = keyof typeof EXCHANGE_REFUSALS.buy
export type SellRefusalCode = keyof typeof EXCHANGE_REFUSALS.sell

export const prizeRefusal = (code: PrizeRefusalCode, data?: Refusal['data']): Refusal => refuse(code, EXCHANGE_REFUSALS.prize[code], data)
export const buyRefusal = (code: BuyRefusalCode, data?: Refusal['data']): Refusal => refuse(code, EXCHANGE_REFUSALS.buy[code], data)
export const sellRefusal = (code: SellRefusalCode, data?: Refusal['data']): Refusal => refuse(code, EXCHANGE_REFUSALS.sell[code], data)
