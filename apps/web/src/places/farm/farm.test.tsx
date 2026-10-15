// @vitest-environment jsdom
// The Farm places on screen (docs/rework/07-farm.md §2, §7, §8, §10, §11, §15; T140), through the real routes and the
// in-memory port on synthetic accounts, its clock held and moved by hand: gather, queue, Collect, −30m and the queued
// start; cook, reserve and Recall with its preview; an upgrade's slots at once; a fresh account's shortfall and its
// link; a Make more link returning to `back`; twelve hours away; a reopen; and offline taps.
import { CHECK_IN_WORDS, clockTime, say, type OperationInput } from '@racer/domain/check-in'
import { farmItemSeconds } from '@racer/domain/farm'
import { craftedItem, FAMILY_IDS } from '@racer/domain/items'
import { endsAt, finishedCount } from '@racer/domain/work'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { G2Answer, G2Game } from '../../app/game'
import { createMemoryGame } from '../../dev/memory'
import type { G2Seed } from '../../dev/seed'
import { renderG2, stubStorage } from '../../__fixtures__/testing'
import { slotCards } from '../../ui/work/model'
import { workView } from '../../ui/work/view'
import { apply, farmAccount, farmSeed, HOUR, MINUTE, uma, withFarmLevel } from './__fixtures__/farm'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(stubStorage)

/** The port on a seed with a hand-moved clock: `advance` moves the game's time. */
function clocked(seed: G2Seed): { game: G2Game; advance: (ms: number) => void } {
  let real = 0
  const game = createMemoryGame(seed, () => real)
  return { game, advance: (ms) => { real += ms } }
}

const state = (game: G2Game) => game.getSnapshot().state!
const AMBER = 'Amber Sprint'
const BLUEBELL = 'Bluebell Dash'
const GATHER_2 = farmItemSeconds('gather', 2) * 1000
const COOK_1 = farmItemSeconds('cook', 1) * 1000

/** Close the app and open it again on `path`: a new render reads the port afresh. */
function reopen(path: string, game: G2Game) {
  cleanup()
  return renderG2(path, game)
}

describe('gather, queue, Collect and −30m (07 §2, §8)', () => {
  it('Gather Potato × 10, a queued Carrot × 6, three outputs collected, −30m, and the queue starting when the first ends', async () => {
    const { state: account, at } = farmAccount(1)
    const ready = apply(withFarmLevel(account, uma(1), 7), 'dev-grant', { items: { 'speed-ticket': 5 } }, at).state
    const { game, advance } = clocked(farmSeed(ready, at))

    const { where } = renderG2(`/farm/vegetable-garden?job=potato&uma=${uma(1)}&count=10`, game)
    const sheet = await screen.findByRole('dialog', { name: 'Start a job · Vegetable Garden' })
    expect(within(sheet).getByRole('radio', { name: /^×10,/ }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Start' }))
    await waitFor(() => expect(where()).toBe('/farm/vegetable-garden'))
    expect(state(game).work[uma(1)]!.entries[0]!.request).toEqual({ kind: 'gather', item: 'potato', count: 10 })
    const card = await screen.findByRole('article', { name: new RegExp(`^${AMBER}\\. Potato, 0 of 10 made, next at `) })

    // + Queue: her running job here takes the queue; Carrot × 6 behind it.
    fireEvent.click(within(card).getByRole('link', { name: '+ Queue' }))
    const queueSheet = await screen.findByRole('dialog', { name: 'Queue a job · Vegetable Garden' })
    fireEvent.click(within(queueSheet).getByRole('button', { name: 'Change what to make' }))
    fireEvent.click(within(queueSheet).getByRole('button', { name: /^Carrot · G1/ }))
    fireEvent.click(await within(queueSheet).findByRole('radio', { name: /^×6,/ }))
    fireEvent.click(within(queueSheet).getByRole('button', { name: 'Add to queue' }))
    await waitFor(() => expect(state(game).work[uma(1)]!.queue).toEqual([{ kind: 'gather', item: 'carrot', count: 6 }]))

    // Three outputs later, Collect pays three Potatoes and their Farm EXP.
    advance(3 * GATHER_2 + MINUTE)
    reopen('/farm/vegetable-garden', game)
    const later = await screen.findByRole('article', { name: new RegExp(`^${AMBER}\\. Potato, 3 of 10 made`) })
    const before = state(game).umas[uma(1)]!.farm.exp
    const entry = state(game).work[uma(1)]!.entries[0]!
    fireEvent.click(within(later).getByRole('button', { name: 'Collect · 3' }))
    await waitFor(() => expect(state(game).items['potato']).toBe(3))
    expect(state(game).umas[uma(1)]!.farm.exp - before).toBe(3 * entry.farmExp[0]!)

    // −30m moves the job's end and the queued start 30 minutes earlier.
    const end = endsAt(entry)
    const carrot = farmItemSeconds('gather', 1) * 1000 * 6
    const chip = () => screen.getByText(/^then Carrot ×6 → /).textContent
    expect(chip()).toBe(`then Carrot ×6 → ${clockTime(end + carrot, 0)}`)
    fireEvent.click(screen.getByRole('button', { name: 'Take 30 minutes off with one Speed Ticket' }))
    await waitFor(() => expect(state(game).work[uma(1)]!.entries[0]!.acceleratedMs).toBe(30 * MINUTE))
    await waitFor(() => expect(chip()).toBe(`then Carrot ×6 → ${clockTime(end - 30 * MINUTE + carrot, 0)}`))
    expect(state(game).items['speed-ticket']).toBe(4)

    // The queued job starts the moment the first ends.
    advance(end - 30 * MINUTE - (at + 3 * GATHER_2 + MINUTE) + MINUTE)
    reopen('/farm/vegetable-garden', game)
    await screen.findByRole('article', { name: new RegExp(`^${AMBER}\\. Carrot, 0 of 6 made`) })
    const settled = workView(state(game), game.now(), game.getSnapshot().env!).settled
    expect(settled.work[uma(1)]!.entries.map((e) => [e.request.kind === 'session' ? '' : e.request.item, e.startedAt])).toEqual([
      ['potato', at], ['carrot', end - 30 * MINUTE],
    ])
  })
})

describe('cook and Recall (07 §2, §5)', () => {
  it('Cook Carrot Salad × 3 reserves its inputs; recalled after one and a half salads it pays one and returns 8 Chopped Carrot and 2 Wheat Flour', async () => {
    const { state: account, at } = farmAccount(1)
    const stocked = apply(account, 'dev-grant', { items: { 'chopped-carrot': 12, 'wheat-flour': 3 } }, at).state
    const { game, advance } = clocked(farmSeed(stocked, at))
    const { where } = renderG2(`/farm/kitchen?job=dish-vegetables-1&uma=${uma(1)}&count=3`, game)
    const sheet = await screen.findByRole('dialog', { name: 'Start a job · Kitchen' })
    within(sheet).getByText('Chopped Carrot 12 of 12')
    within(sheet).getByText('Wheat Flour 3 of 3')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Start' }))
    await waitFor(() => expect(where()).toBe('/farm/kitchen'))
    expect(state(game).items).toEqual({})

    advance(Math.round(1.5 * COOK_1))
    reopen('/farm/kitchen', game)
    const card = await screen.findByRole('article', { name: new RegExp(`^${AMBER}\\. Carrot Salad, 1 of 3 made`) })
    fireEvent.click(within(card).getByRole('button', { name: 'Recall' }))
    const recall = await screen.findByRole('dialog', { name: `Recall ${AMBER}` })
    within(recall).getByText('1 Carrot Salad collected')
    within(recall).getByText('8 Chopped Carrot and 2 Wheat Flour come back')
    within(recall).getByText(`${Math.round(COOK_1 / 2 / MINUTE)} minutes of progress lost`)
    fireEvent.click(within(recall).getByRole('button', { name: 'Recall' }))
    await waitFor(() => expect(state(game).items).toEqual({ 'dish-vegetables-1': 1, 'chopped-carrot': 8, 'wheat-flour': 2 }))
    expect(state(game).work[uma(1)]).toBeUndefined()
  })
})

describe('upgrades and empty stock (07 §7, §11)', () => {
  it('upgrading the Kitchen to Lv 2 shows eight slot cards at once', async () => {
    const { state: account, at } = farmAccount(1)
    const paid = apply(account, 'dev-grant', { prizeMoney: 3_000, items: Object.fromEntries(FAMILY_IDS.map((family) => [craftedItem(family, 1).id, 2])) }, at).state
    const { game } = clocked(farmSeed(paid, at))
    renderG2('/farm/kitchen', game)
    await screen.findByText('0 of 6 in use')
    expect(document.querySelectorAll('[data-slot-card]')).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Lv 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(document.querySelectorAll('[data-slot-card]')).toHaveLength(8))
    screen.getByText('Lv 2')
    screen.getByText('The Kitchen is Lv 2 now.')
    expect(state(game).profile.prizeMoney).toBe(0)
  })

  it("a fresh account's Kitchen sheet names the shortfall and links to the Pantry; a site's offers grade 1 to any Uma", async () => {
    const { state: account, at } = farmAccount(1)
    const { game } = clocked(farmSeed(account, at))
    renderG2(`/farm/kitchen?job=dish-vegetables-1&uma=${uma(1)}`, game)
    const sheet = await screen.findByRole('dialog', { name: 'Start a job · Kitchen' })
    expect(within(sheet).getByRole('button', { name: 'Start' }).hasAttribute('disabled')).toBe(true)
    within(sheet).getByText('Short 4 Chopped Carrot.')
    within(sheet).getByText('Chopped Carrot 0 of 4 · 4 short')
    const make = within(sheet).getByRole('link', { name: 'Make Chopped Carrot at the Pantry' })
    expect(make.getAttribute('href')).toBe(`/farm/pantry?job=chopped-carrot&count=4&back=${encodeURIComponent(`/farm/kitchen?job=dish-vegetables-1&uma=${uma(1)}`)}`)

    reopen(`/farm/fields?job=wheat&uma=${uma(1)}`, game)
    const site = await screen.findByRole('dialog', { name: 'Start a job · Fields' })
    expect(within(site).getByRole('button', { name: 'Start' }).hasAttribute('disabled')).toBe(false)
  })

  it('a Make more link opens the sheet on its item, and Start returns to `back`', async () => {
    const { state: account, at } = farmAccount(2)
    const stocked = apply(account, 'dev-grant', { items: { carrot: 4 } }, at).state
    const { game } = clocked(farmSeed(stocked, at))
    const { where } = renderG2(`/farm/pantry?job=chopped-carrot&back=${encodeURIComponent('/town/warehouse')}`, game)
    const sheet = await screen.findByRole('dialog', { name: 'Start a job · Pantry' })
    within(sheet).getByText('Chopped Carrot', { selector: 'span' })
    within(sheet).getByText('Pick an Uma.')
    fireEvent.click(within(sheet).getByRole('button', { name: new RegExp(`^${BLUEBELL}`) }))
    fireEvent.click(within(sheet).getByRole('button', { name: 'Start' }))
    await waitFor(() => expect(where()).toBe('/town/warehouse'))
    expect(state(game).work[uma(2)]!.entries[0]!.request).toMatchObject({ kind: 'craft', item: 'chopped-carrot' })
  })
})

describe('offline, away and reopened (07 §11, 02 §8)', () => {
  it('twelve hours away, every output and queue start sits where the timestamps put it; a reopen keeps everything', async () => {
    const { state: account, at } = farmAccount(1)
    let working = apply(account, 'start', { outfitId: uma(1), slot: { building: 'fields', slot: 0 }, request: { kind: 'gather', item: 'wheat', count: 10 } }, at).state
    working = apply(working, 'queue', { outfitId: uma(1), add: { request: { kind: 'gather', item: 'wheat', count: 3 }, building: 'fields' } }, at).state
    const { game, advance } = clocked(farmSeed(working, at, { sync: 'offline' }))
    const check = async (hours: number) => {
      const now = game.now()
      const view = workView(state(game), now, game.getSnapshot().env!)
      const [card] = slotCards(view.settled, 'fields', now)
      if (card?.kind !== 'held') throw new Error('free')
      const last = view.settled.work[uma(1)]!.entries.at(-1)!
      expect(card.made).toBe(finishedCount(last, now))
      const label = card.running ? `${card.made} of ${card.count} made, next at` : `${card.made} of ${card.count} made, ready to collect`
      await screen.findByRole('article', { name: new RegExp(`^${AMBER}\\. Wheat, ${label}`) })
      return { hours, card, entries: view.settled.work[uma(1)]!.entries }
    }

    advance(12 * HOUR)
    reopen('/farm/fields', game)
    const twelve = await check(12)
    expect(twelve.card).toMatchObject({ made: 6, count: 10, running: true, queue: [{ item: 'wheat', count: 3 }] })

    reopen('/farm/fields', game)
    expect((await check(12)).card).toEqual(twelve.card)

    advance(12 * HOUR)
    reopen('/farm/fields', game)
    const day = await check(24)
    const first = endsAt(working.work[uma(1)]!.entries[0]!)
    expect(day.entries.map((entry) => entry.startedAt)).toEqual([at, first])
    expect(day.card).toMatchObject({ made: 3, count: 3, running: false, waiting: 13 })

    // Offline, a tap still applies on this phone.
    fireEvent.click(screen.getByRole('button', { name: 'Collect here · 1' }))
    await waitFor(() => expect(state(game).items['wheat']).toBe(13))
    screen.getByText(`${AMBER}: 13 Wheat · Farm EXP +${Math.round((13 * day.entries[0]!.farmExp[0]!) / 4).toLocaleString('en-US')}`)
  })
})

describe('Collect here and Repeat here (07 §9, §10)', () => {
  it("collect this building only, then Repeat here lists each start and each skip with its reason", async () => {
    const { state: account, at } = farmAccount(2)
    let working = apply(account, 'dev-grant', { items: { 'chopped-carrot': 4, 'wheat-flour': 1 } }, at).state
    working = apply(working, 'start', { outfitId: uma(1), slot: { building: 'kitchen', slot: 0 }, request: { kind: 'cook', item: 'dish-vegetables-1', count: 1 } }, at).state
    working = apply(working, 'start', { outfitId: uma(2), slot: { building: 'fields', slot: 0 }, request: { kind: 'gather', item: 'wheat', count: 1 } }, at).state
    const { game, advance } = clocked(farmSeed(working, at))
    advance(COOK_1)
    renderG2('/farm/kitchen', game)
    fireEvent.click(await screen.findByRole('button', { name: 'Collect here · 1' }))
    await screen.findByText(new RegExp(`^${AMBER}: 1 Carrot Salad · Farm EXP \\+\\d+$`))
    expect(state(game).items['dish-vegetables-1']).toBe(1)
    expect(state(game).items['wheat']).toBeUndefined()
    fireEvent.click(screen.getByRole('button', { name: 'Repeat here · 1' }))
    await screen.findByText(`${AMBER}: Short 4 Chopped Carrot.`)
    expect(state(game).work[uma(1)]!.entries).toEqual([])
  })
})

describe('a stale screen (02 §9)', () => {
  it('re-offers the covered size in one sentence, and its yes starts that size', async () => {
    const { state: account, at } = farmAccount(1)
    const stocked = apply(account, 'dev-grant', { items: { 'chopped-carrot': 12, 'wheat-flour': 3 } }, at).state
    const base = createMemoryGame(farmSeed(stocked, at), () => 0)
    let stale = true
    // The other device cooked one salad's worth first: this phone's Start is answered as `recheck` would.
    const game: G2Game = {
      ...base,
      run: (name, input, busyKey) => {
        if (stale && name === 'start') {
          stale = false
          const asked = input as OperationInput<'start'>
          const retry = 'request' in asked && asked.request.kind !== 'session' ? { ...asked, request: { ...asked.request, count: 2 } } : asked
          return Promise.resolve({ kind: 'ask', question: say(CHECK_IN_WORDS['only-left'], { n: 2 }), input: retry, id: 'stale' } as G2Answer<typeof name>)
        }
        return base.run(name, input, busyKey)
      },
    }
    const { where } = renderG2(`/farm/kitchen?job=dish-vegetables-1&uma=${uma(1)}&count=3`, game)
    const sheet = await screen.findByRole('dialog', { name: 'Start a job · Kitchen' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Start' }))
    await within(sheet).findByText('Only 2 left now. Start ×2?')
    expect(state(game).work[uma(1)]).toBeUndefined()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(where()).toBe('/farm/kitchen'))
    expect(state(game).work[uma(1)]!.entries[0]!.request).toEqual({ kind: 'cook', item: 'dish-vegetables-1', count: 2 })
  })
})

describe('Speed Tickets on a card (09 §5.1)', () => {
  it('"Buy 3 and finish · 90" asks once, then buys and finishes as two taps in order', async () => {
    const { state: account, at } = farmAccount(1)
    let ready = apply(account, 'dev-grant', { prizeMoney: 1_000, items: { 'speed-ticket': 5 } }, at).state
    ready = apply(ready, 'start', { outfitId: uma(1), slot: { building: 'fields', slot: 0 }, request: { kind: 'gather', item: 'wheat', count: 2 } }, at).state
    const { game } = clocked(farmSeed(ready, at))
    renderG2('/farm/fields', game)
    fireEvent.click(await screen.findByRole('button', { name: 'Buy 3 and finish · 90' }))
    screen.getByText('Buy 3 Speed Tickets for 90 Prize Money and finish now?')
    expect(state(game).profile.prizeMoney).toBe(1_000)
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    await screen.findByRole('article', { name: new RegExp(`^${AMBER}\\. Wheat, 2 of 2 made, ready to collect`) })
    expect(state(game).profile.prizeMoney).toBe(910)
    expect(state(game).items['speed-ticket']).toBeUndefined()
    const names = Object.values(state(game).operations ?? {}).map((record) => record.name)
    expect(names.slice(-2)).toEqual(['buy', 'finish'])
  })
})

describe('the Peek and the Counter (11 §3.4)', () => {
  it("shows the slots with faces and times, the family's stock by grade and the targets' lines; the tile counts who is ready", async () => {
    const { state: account, at } = farmAccount(2)
    let working = apply(account, 'dev-grant', { items: { carrot: 3 } }, at).state
    working = apply(working, 'start', { outfitId: uma(1), slot: { building: 'vegetable-garden', slot: 0 }, request: { kind: 'gather', item: 'carrot', count: 2 } }, at).state
    const { game, advance } = clocked(farmSeed(working, at))
    renderG2('/farm?peek=vegetable-garden', game)
    const peek = await screen.findByRole('dialog', { name: 'Vegetable Garden' })
    await within(peek).findByText(`next ${clockTime(at + farmItemSeconds('gather', 1) * 1000, 0)}`)
    within(peek).getByText('3 free')
    within(peek).getByLabelText('Carrot: 3')
    within(peek).getByText('For your targets')

    advance(farmItemSeconds('gather', 1) * 1000)
    reopen('/farm', game)
    await screen.findByRole('link', { name: /^Vegetable Garden\. \d of 4 slots busy, 1 ready\.$/ })
    expect(document.querySelector('[data-place="vegetable-garden"] [data-counter]')?.textContent).toBe('1')
  })
})
