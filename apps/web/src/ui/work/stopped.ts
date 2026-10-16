// A stopped queue's card, as a pure reading (docs/game/02-check-ins-and-notifications.md §3 "Queues", §4; T142): the
// entry that couldn't start, where and how long ago ("Pantry ×10 · stopped 7h 5m ago", D366), what came behind it, what was short in the rule's
// words, and the fixes `queueStopped` offers at today's stock and prices: Restart, Buy and restart, Start ×N, Make them
// and Dismiss. Every number is the domain's.
import { durationText, type StoppedQueue, type Words } from '@racer/domain/check-in'
import { SESSION_KIND } from '@racer/domain/work'
import { requestWords } from './QueueChips'
import { itemsList, placeName, workWords, type WordsContext } from './words'

export interface StoppedCardView {
  readonly outfitId: string
  /** "Pantry ×10 · stopped 7h 5m ago". */
  readonly line: string
  /** The entries that stopped behind it: "then Chopped Carrot ×5". */
  readonly behind: readonly string[]
  /** "Short 2 Carrot.", or the rule that refused it. */
  readonly words: Words
  /** **Restart**, when the stock covers it now. */
  readonly restart: boolean
  /** **Buy 2 and restart · 190**: the units to buy, their names and the total price. */
  readonly buy: { readonly n: number; readonly items: string; readonly price: number } | null
  /** **Start ×8**. */
  readonly smaller: number | null
  /** **Make them: Vegetable Garden ×2**, with who would make them. */
  readonly make: { readonly place: string; readonly n: number; readonly outfitId: string } | null
}

export function stoppedCardView(queue: StoppedQueue, context: WordsContext): StoppedCardView {
  const first = queue.dropped.requests[0]!
  const size = first.kind === SESSION_KIND ? first.unlocks.length : first.count
  return {
    outfitId: queue.outfitId,
    line: workWords('stopped-line', {
      place: placeName(queue.dropped.slot.building), n: size, time: durationText(Math.floor(Math.max(0, context.now - queue.dropped.at) / 60_000) * 60_000),
    }),
    behind: queue.dropped.requests.slice(1).map((request) => workWords('queue-then-unknown', { what: requestWords(request) })),
    words: queue.words,
    restart: queue.restart,
    buy: queue.buy === null ? null : {
      n: queue.buy.items.reduce((sum, line) => sum + line.qty, 0),
      items: itemsList(queue.buy.items.map((line) => ({ item: line.sku, qty: line.qty }))),
      price: queue.buy.total,
    },
    smaller: queue.startSmaller,
    make: queue.makeThem === null ? null : { place: placeName(queue.makeThem.slot.building), n: queue.makeThem.size, outfitId: queue.makeThem.outfitId },
  }
}
