// The kit never edits Racer's store: every callback goes through its once-only operation port (SC5).
import type { TicketOffer, WorkActions, WorkAnswer } from '@luismlorenzana/uma-kit/work'
import type { Refusal as KitRefusal } from '@luismlorenzana/uma-work'
import { restartDropped } from '@racer/domain/check-in'
import { buy, SPEED_TICKET_PRICE } from '@racer/domain/economy'
import { isBuildingId } from '@racer/domain/farm'
import { SPEED_TICKET_ID } from '@racer/domain/items'
import { parseSlotRef, parseWorkRequest } from '@racer/domain/save'
import { isRefusal } from '@racer/domain/state'
import { endsAt, remainingMs, settle, stockOf, ticketsToFinish, type WorkEnv, type WorkState } from '@racer/domain/work'
import type { OperationInput, OperationName } from '@racer/domain/check-in'
import type { G2Answer, G2Game } from '../../app/game'
import { grouped, showWords, type WordsContext } from './words'

const unavailable = (): WorkAnswer => ({ kind: 'say', message: "That isn't made here." })
type PortAnswer = Exclude<WorkAnswer, void | { readonly refused: true }>

/** Preview the same whole-queue operation as Restart, including its alternate-free-slot rule. */
export function checkRacerRestart(state: WorkState, outfitId: string, now: number, env: WorkEnv): KitRefusal | null {
  const result = restartDropped(state, { outfitId, from: 'dropped' }, now, env)
  return isRefusal(result) ? { refused: true, code: result.code, message: result.reason, ...(result.data === undefined ? {} : { data: result.data }) } : null
}

export function ticketOffer(state: WorkState, count: number, now: number, context: WordsContext): TicketOffer {
  const result = buy(state, { opId: 'preview', sku: SPEED_TICKET_ID, qty: count, unitPrice: SPEED_TICKET_PRICE }, now)
  return { price: count * SPEED_TICKET_PRICE, label: `${grouped(count * SPEED_TICKET_PRICE)} Prize Money`,
    refusal: isRefusal(result) ? showWords({ text: result.reason, data: result.data ?? {} }, context) : null }
}

export function racerWorkActions(game: G2Game, context: WordsContext): WorkActions {
  const run = async <N extends OperationName>(name: N, input: OperationInput<N>): Promise<PortAnswer> => {
    const answer = await game.run(name, input, `work:${name}`)
    return convert(name, answer)
  }
  const convert = <N extends OperationName>(name: N, answer: G2Answer<N>): PortAnswer => {
    if (answer.kind === 'say') return { kind: 'say', message: showWords(answer.words, context) }
    if (answer.kind === 'ask') return { kind: 'ask', message: showWords(answer.question, context), confirm: () => run(name, answer.input) }
    return { kind: 'done' }
  }
  return {
    collect: (input) => run('collect', input),
    recall: (input) => run('recall', input),
    speedUp: (input) => run('speed-up', input),
    finish: (input) => run('finish', input),
    unqueue: ({ outfitId, index }) => run('queue', { outfitId, remove: index }),
    restart: ({ outfitId }) => run('start', { outfitId, from: 'dropped' }),
    dismiss: ({ outfitId }) => run('queue', { outfitId, dismiss: true }),
    upgrade: ({ building }) => isBuildingId(building) ? run('upgrade', { building }) : unavailable(),
    start: (input) => {
      const slot = parseSlotRef(input.slot), request = parseWorkRequest(input.request)
      return slot !== null && request !== null ? run('start', { outfitId: input.outfitId, slot, request }) : unavailable()
    },
    queue: (input) => {
      if (!('add' in input)) return run('queue', input)
      const { add } = input
      const slot = parseSlotRef({ building: add.building, ...(add.room === undefined ? {} : { room: add.room }), slot: 0 })
      const request = parseWorkRequest(add.request)
      return slot !== null && request !== null ? run('queue', { outfitId: input.outfitId, add: {
        request, building: slot.building, ...(slot.room === undefined ? {} : { room: slot.room }),
      } }) : unavailable()
    },
    async repeat({ outfitId }) {
      const collected = await run('collect', { outfitId })
      if (collected?.kind !== 'done') return collected
      const answer = await game.run('repeat', { outfitIds: [outfitId], utcOffsetMin: game.utcOffsetMin(game.now()) }, `work:repeat:${outfitId}`)
      if (answer.kind !== 'done') return convert('repeat', answer)
      const notes = [...answer.receipt.skipped.map((line) => line.words), ...answer.receipt.started.flatMap((line) => line.notes)]
      return { kind: 'done', message: notes.map((note) => showWords(note, context)).join(' · ') }
    },
    async buyAndFinish(input) {
      const { outfitId, startedAt, tickets, quote } = input
      // The confirmation may have waited on screen. Check the latest entry and quote before spending anything.
      const snapshot = game.getSnapshot(), now = game.now()
      if (snapshot.state === null || snapshot.env === null) return { kind: 'say', message: 'Opening save…' }
      const state = settle(snapshot.state, now, snapshot.env).state
      const entry = state.work[outfitId]?.entries.at(-1)
      if (entry === undefined || entry.startedAt !== startedAt || endsAt(entry) <= now) return run('finish', { outfitId, startedAt })
      const missing = Math.max(0, ticketsToFinish(remainingMs(entry, now)) - stockOf(state.items, SPEED_TICKET_ID))
      if (missing === 0) return run('finish', { outfitId, startedAt })
      const latest = ticketOffer(state, missing, now, context)
      if (latest.refusal) return { kind: 'say', message: latest.refusal }
      if (missing !== tickets || latest.price !== quote.price) return {
        kind: 'ask', message: `Buy ${missing} Speed Ticket${missing === 1 ? '' : 's'} for ${latest.label} and finish now?`,
        confirm: () => racerWorkActions(game, context).buyAndFinish!({ ...input, tickets: missing, quote: latest }),
      }
      const bought = await run('buy', { sku: SPEED_TICKET_ID, qty: missing, unitPrice: SPEED_TICKET_PRICE })
      if (bought?.kind !== 'done') return bought
      return run('finish', { outfitId, startedAt })
    },
  }
}
