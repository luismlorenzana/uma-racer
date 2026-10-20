// SC5's kit callbacks always use Racer's real operation port. Synthetic only, no network or browser save.
import { describe, expect, it } from 'vitest'
import { SPEED_TICKET_PRICE } from '@racer/domain/economy'
import { endsAt } from '@racer/domain/work'
import { createMemoryGame } from '../../dev/memory'
import { apply, farmAccount, farmSeed, MINUTE, uma } from '../../places/farm/__fixtures__/farm'
import { checkRacerRestart, racerWorkActions, ticketOffer } from './actions'

const context = { umaName: () => 'Amber Sprint', utcOffsetMin: 0, now: farmAccount(1).at }

function running() {
  const { state, at } = farmAccount(1)
  const rich = apply(state, 'dev-grant', { prizeMoney: 10_000 }, at).state
  const started = apply(rich, 'start', { outfitId: uma(1), slot: { building: 'fields', slot: 0 }, request: { kind: 'gather', item: 'wheat', count: 1 } }, at).state
  let elapsed = 0
  const game = createMemoryGame(farmSeed(started, at), () => elapsed)
  return { game, at, advance: (ms: number) => { elapsed += ms }, actions: racerWorkActions(game, context) }
}

describe('the kit’s Racer operation callbacks', () => {
  it('rechecks the latest ticket shortfall before buying, re-asks with new numbers and charges only once', async () => {
    const { game, actions, advance, at } = running()
    const state = game.getSnapshot().state!
    const need = Math.ceil((endsAt(state.work[uma(1)]!.entries[0]!) - at) / (30 * MINUTE))
    const quote = ticketOffer(state, need, at, context)
    advance(31 * MINUTE)
    const answer = await actions.buyAndFinish!({ outfitId: uma(1), startedAt: at, tickets: need, quote })
    expect(answer).toMatchObject({ kind: 'ask', message: `Buy ${need - 1} Speed Tickets for ${(need - 1) * SPEED_TICKET_PRICE} Prize Money and finish now?` })
    expect(game.getSnapshot().state!.profile.prizeMoney).toBe(10_000)
    if (answer === undefined || !('kind' in answer) || answer.kind !== 'ask') throw new Error('Expected a new quote')
    expect(await answer.confirm()).toMatchObject({ kind: 'done' })
    const after = game.getSnapshot().state!
    expect(after.profile.prizeMoney).toBe(10_000 - (need - 1) * SPEED_TICKET_PRICE)
    expect(endsAt(after.work[uma(1)]!.entries[0]!)).toBe(game.now())
    await answer.confirm()
    expect(game.getSnapshot().state!.profile.prizeMoney).toBe(after.profile.prizeMoney)
  })

  it('never buys for a finished or recalled entry whose confirmation was left open', async () => {
    const { game, actions, at, advance } = running()
    const quote = ticketOffer(game.getSnapshot().state!, 6, at, context)
    await game.run('recall', { outfitId: uma(1) })
    expect(await actions.buyAndFinish!({ outfitId: uma(1), startedAt: at, tickets: 6, quote })).toMatchObject({ kind: 'say' })
    expect(game.getSnapshot().state!.profile.prizeMoney).toBe(10_000)
    const second = running()
    advance(24 * 60 * MINUTE)
    second.advance(24 * 60 * MINUTE)
    expect(await second.actions.buyAndFinish!({ outfitId: uma(1), startedAt: at, tickets: 6, quote })).toMatchObject({ kind: 'say' })
    expect(second.game.getSnapshot().state!.profile.prizeMoney).toBe(10_000)
  })

  it('keeps the three-entry queue limit and game words through the real port', async () => {
    const { game, actions } = running()
    const add = { outfitId: uma(1), add: { building: 'fields', request: { kind: 'gather', item: 'wheat', count: 1 } } }
    for (let i = 0; i < 3; i += 1) expect(await actions.queue!(add)).toMatchObject({ kind: 'done' })
    expect(await actions.queue!(add)).toMatchObject({ kind: 'say', message: 'Three are already queued.' })
    expect(game.getSnapshot().state!.work[uma(1)]!.queue).toHaveLength(3)
    expect(await actions.unqueue!({ outfitId: uma(1), index: 1 })).toMatchObject({ kind: 'done' })
    expect(game.getSnapshot().state!.work[uma(1)]!.queue).toHaveLength(2)
  })

  it('previews and restarts a whole dropped queue in the next free slot without mutating the preview', async () => {
    const { state, at, env } = farmAccount(2)
    const slot = { building: 'fields' as const, slot: 0 }
    const request = { kind: 'gather' as const, item: 'wheat', count: 1 }
    const held = apply(state, 'start', { outfitId: uma(2), slot, request }, at).state
    const stopped = { ...held, work: { ...held.work, [uma(1)]: {
      outfitId: uma(1), slot: null, entries: [], queue: [], last: null,
      dropped: { at, slot, requests: [request, { ...request, count: 2 }], short: [], refused: null },
    } } }
    expect(checkRacerRestart(stopped, uma(1), at, env)).toBeNull()
    expect(stopped.work[uma(1)]!.dropped).not.toBeNull()
    const game = createMemoryGame(farmSeed(stopped, at), () => 0)
    expect(await racerWorkActions(game, context).restart!({ outfitId: uma(1) })).toMatchObject({ kind: 'done' })
    expect(game.getSnapshot().state!.work[uma(1)]).toMatchObject({ slot: { building: 'fields', slot: 1 }, queue: [{ ...request, count: 2 }], dropped: null })
  })
})
