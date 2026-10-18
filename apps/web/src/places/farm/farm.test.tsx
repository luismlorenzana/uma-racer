// @vitest-environment jsdom
// The Farm places on screen (docs/game/07-farm.md §2, §7, §8, §10, §11, §15; T140, D366), through the real routes and
// the in-memory port on synthetic accounts, its clock held and moved by hand: gather, Queue next, Collect, −30m and the
// queued start; cook, reserve and Recall with its preview; an upgrade's slots at once; a fresh account's shortfall and
// its link; a Make more link returning to `back`; twelve hours away; a reopen; offline taps; and D366's compact screens:
// rows that read how long is left, never a clock time; Free Umas only in the sheet, everything preselected; the size
// chips' durations; a target's icon filled in; and the tap paths from the Hub: a free slot's "+" in the side panel opens
// the sheet over the map and Start starts the job (3 taps), and a finished row's Repeat restarts it (2 taps).
import { CHECK_IN_WORDS, durationText, say, type OperationInput } from '@racer/domain/check-in'
import { farmItemSeconds } from '@racer/domain/farm'
import { craftedItem, FAMILY_IDS } from '@racer/domain/items'
import { endsAt, finishedCount } from '@racer/domain/work'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { G2Answer, G2Game } from '../../app/game'
import { createMemoryGame } from '../../dev/memory'
import type { G2Seed } from '../../dev/seed'
import { appliedNames, renderG2, stubPointerEvents, stubStorage } from '../../__fixtures__/testing'
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
const GATHER_1 = farmItemSeconds('gather', 1) * 1000
const GATHER_2 = farmItemSeconds('gather', 2) * 1000
const COOK_1 = farmItemSeconds('cook', 1) * 1000
const CLOCK = /\b\d\d:\d\d\b/

/** Close the app and open it again on `path`: a new render reads the port afresh. */
function reopen(path: string, game: G2Game) {
  cleanup()
  return renderG2(path, game)
}

describe('gather, Queue next, Collect and −30m (07 §2, §8; D366)', () => {
  it('Gather Potato × 10, a queued Carrot × 6, three outputs collected, −30m off the time left, and the queue starting when the first ends', async () => {
    const { state: account, at } = farmAccount(1)
    const ready = apply(withFarmLevel(account, uma(1), 7), 'dev-grant', { items: { 'speed-ticket': 5 } }, at).state
    const { game, advance } = clocked(farmSeed(ready, at))

    const { where } = renderG2(`/farm/vegetable-garden?job=potato&uma=${uma(1)}&count=10`, game)
    const sheet = await screen.findByRole('dialog', { name: 'Start a job · Vegetable Garden' })
    expect(within(sheet).getByRole('radio', { name: /^×10,/ }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(within(sheet).getByRole('button', { name: `Start · ×10 · ${durationText(10 * GATHER_2)}` }))
    await waitFor(() => expect(where()).toBe('/farm/vegetable-garden'))
    expect(state(game).work[uma(1)]!.entries[0]!.request).toEqual({ kind: 'gather', item: 'potato', count: 10 })
    const row = await screen.findByRole('article', { name: `${AMBER}. Potato, 0 of 10 made, ${durationText(10 * GATHER_2)} left` })
    expect(row.textContent).not.toMatch(CLOCK)

    // ⋯ → Queue next: her job here takes the queue, with her named and no Uma to pick; Carrot × 6 behind it.
    fireEvent.click(within(row).getByRole('button', { name: `More for ${AMBER}: Queue next and Recall` }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: `${AMBER} · Potato ×10` })).getByRole('link', { name: 'Queue next' }))
    const queueSheet = await screen.findByRole('dialog', { name: 'Queue a job · Vegetable Garden' })
    within(queueSheet).getByText(`Next job for ${AMBER}`)
    expect(within(queueSheet).queryByRole('radiogroup', { name: /Free Umas/ })).toBeNull()
    fireEvent.click(within(queueSheet).getByRole('button', { name: /^Carrot, grade 1/ }))
    fireEvent.click(await within(queueSheet).findByRole('radio', { name: /^×6,/ }))
    fireEvent.click(within(queueSheet).getByRole('button', { name: `Queue · ×6 · ${durationText(6 * GATHER_1)}` }))
    await waitFor(() => expect(state(game).work[uma(1)]!.queue).toEqual([{ kind: 'gather', item: 'carrot', count: 6 }]))

    // Three outputs later, Collect pays three Potatoes and their Farm EXP; the queue reads its own duration.
    advance(3 * GATHER_2 + MINUTE)
    reopen('/farm/vegetable-garden', game)
    const later = await screen.findByRole('article', { name: new RegExp(`^${AMBER}\\. Potato, 3 of 10 made, `) })
    within(later).getByRole('listitem', { name: `then Carrot ×6 · ${durationText(6 * GATHER_1)}` })
    const before = state(game).umas[uma(1)]!.farm.exp
    const entry = state(game).work[uma(1)]!.entries[0]!
    fireEvent.click(within(later).getByRole('button', { name: 'Collect 3 Potato' }))
    await waitFor(() => expect(state(game).items['potato']).toBe(3))
    expect(state(game).umas[uma(1)]!.farm.exp - before).toBe(3 * entry.farmExp[0]!)

    // −30m, from the Speed Ticket's sheet, takes 30 minutes off the time left.
    const end = endsAt(entry)
    const now = at + 3 * GATHER_2 + MINUTE
    fireEvent.click(within(later).getByRole('button', { name: 'Speed Tickets for Potato ×10' }))
    const speed = await screen.findByRole('dialog', { name: 'Speed up Potato ×10' })
    fireEvent.click(within(speed).getByRole('button', { name: 'Take 30 minutes off with one Speed Ticket' }))
    await waitFor(() => expect(state(game).work[uma(1)]!.entries[0]!.acceleratedMs).toBe(30 * MINUTE))
    await screen.findByRole('article', { name: `${AMBER}. Potato, 3 of 10 made, ${durationText(end - 30 * MINUTE - now)} left` })
    expect(state(game).items['speed-ticket']).toBe(4)

    // The queued job starts the moment the first ends.
    advance(end - 30 * MINUTE - now + MINUTE)
    reopen('/farm/vegetable-garden', game)
    await screen.findByRole('article', { name: new RegExp(`^${AMBER}\\. Carrot, 0 of 6 made`) })
    const settled = workView(state(game), game.now(), game.getSnapshot().env!).settled
    expect(settled.work[uma(1)]!.entries.map((e) => [e.request.kind === 'session' ? '' : e.request.item, e.startedAt])).toEqual([
      ['potato', at], ['carrot', end - 30 * MINUTE],
    ])
  })
})

describe('cook and Recall (07 §2, §5)', () => {
  it('Brew Warm-Up Tonic × 3 reserves its inputs; recalled after one and a half tonics it pays one and returns two of each input', async () => {
    const { state: account, at } = farmAccount(1)
    const stocked = apply(account, 'dev-grant', { items: { 'chopped-carrot': 3, 'dried-button-mushroom': 3, 'wheat-flour': 3 } }, at).state
    const { game, advance } = clocked(farmSeed(stocked, at))
    const { where } = renderG2(`/farm/kitchen?job=tonic-1&uma=${uma(1)}&count=3`, game)
    const sheet = await screen.findByRole('dialog', { name: 'Start a job · Kitchen' })
    within(sheet).getByLabelText('Chopped Carrot 3 of 3')
    within(sheet).getByLabelText('Dried Button Mushroom 3 of 3')
    within(sheet).getByLabelText('Wheat Flour 3 of 3')
    fireEvent.click(within(sheet).getByRole('button', { name: /^Start · ×3 · / }))
    await waitFor(() => expect(where()).toBe('/farm/kitchen'))
    expect(state(game).items).toEqual({})

    advance(Math.round(1.5 * COOK_1))
    reopen('/farm/kitchen', game)
    const row = await screen.findByRole('article', { name: new RegExp(`^${AMBER}\\. Warm-Up Tonic, 1 of 3 made`) })
    fireEvent.click(within(row).getByRole('button', { name: `More for ${AMBER}: Queue next and Recall` }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: `${AMBER} · Warm-Up Tonic ×3` })).getByRole('button', { name: 'Recall' }))
    const recall = await screen.findByRole('dialog', { name: `Recall ${AMBER}` })
    within(recall).getByText('1 Warm-Up Tonic collected')
    within(recall).getByText('2 Chopped Carrot, 2 Dried Button Mushroom and 2 Wheat Flour come back')
    within(recall).getByText(`${Math.round(COOK_1 / 2 / MINUTE)} minutes of progress lost`)
    fireEvent.click(within(recall).getByRole('button', { name: 'Recall' }))
    await waitFor(() => expect(state(game).items).toEqual({ 'tonic-1': 1, 'chopped-carrot': 2, 'dried-button-mushroom': 2, 'wheat-flour': 2 }))
    expect(state(game).work[uma(1)]).toBeUndefined()
  })
})

describe('upgrades and empty stock (07 §7, §11)', () => {
  it('upgrading the Kitchen to Lv 2 from its header button shows nine slot rows at once', async () => {
    const { state: account, at } = farmAccount(1)
    const paid = apply(account, 'dev-grant', { prizeMoney: 3_000, items: Object.fromEntries(FAMILY_IDS.map((family) => [craftedItem(family, 1).id, 2])) }, at).state
    const { game } = clocked(farmSeed(paid, at))
    renderG2('/farm/kitchen', game)
    await screen.findByText('Lv 1 · 0 of 6 slots in use')
    expect(document.querySelectorAll('[data-slot-card]')).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Lv 2 for 3,000 Prize Money' }))
    const sheet = await screen.findByRole('dialog', { name: 'Upgrade to Lv 2' })
    within(sheet).getByText('9 slots at Lv 2')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(document.querySelectorAll('[data-slot-card]')).toHaveLength(9))
    screen.getByText('Lv 2 · 0 of 9 slots in use')
    screen.getByText('The Kitchen is Lv 2 now.')
    expect(state(game).profile.prizeMoney).toBe(0)
  })

  it("says why it can't be paid in the rule's words, and its Yes is off", async () => {
    const { state: account, at } = farmAccount(1)
    const { game } = clocked(farmSeed(account, at))
    renderG2('/farm/orchard', game)
    fireEvent.click(await screen.findByRole('button', { name: 'Upgrade to Lv 2 for 1,200 Prize Money. Needs 1,200 Prize Money.' }))
    const sheet = await screen.findByRole('dialog', { name: 'Upgrade to Lv 2' })
    within(sheet).getByText('Needs 1,200 Prize Money.')
    expect(within(sheet).getByRole('button', { name: 'Yes' }).hasAttribute('disabled')).toBe(true)
  })

  it("a fresh account's Kitchen sheet names the shortfall and links to the Pantry; a site's offers grade 1 to any Uma", async () => {
    const { state: account, at } = farmAccount(1)
    const { game } = clocked(farmSeed(account, at))
    renderG2(`/farm/kitchen?job=tonic-1&uma=${uma(1)}`, game)
    const sheet = await screen.findByRole('dialog', { name: 'Start a job · Kitchen' })
    expect(within(sheet).getByRole('button', { name: /^Start · ×1 · / }).hasAttribute('disabled')).toBe(true)
    within(sheet).getByText('Short 1 Chopped Carrot.')
    within(sheet).getByLabelText('Chopped Carrot 0 of 1 · 1 short')
    const make = within(sheet).getByRole('link', { name: 'Make Chopped Carrot at the Pantry' })
    expect(make.getAttribute('href')).toBe(`/farm/pantry?job=chopped-carrot&count=1&back=${encodeURIComponent(`/farm/kitchen?job=tonic-1&uma=${uma(1)}`)}`)

    reopen(`/farm/fields?job=wheat&uma=${uma(1)}`, game)
    const site = await screen.findByRole('dialog', { name: 'Start a job · Fields' })
    expect(within(site).getByRole('button', { name: /^Start · / }).hasAttribute('disabled')).toBe(false)
  })

  it('a Make more link opens the sheet on its item with a Free Uma preselected, and Start returns to `back`', async () => {
    const { state: account, at } = farmAccount(2)
    const stocked = apply(account, 'dev-grant', { items: { carrot: 4 } }, at).state
    const { game } = clocked(farmSeed(stocked, at))
    const { where } = renderG2(`/farm/pantry?job=chopped-carrot&back=${encodeURIComponent('/town/warehouse')}`, game)
    const sheet = await screen.findByRole('dialog', { name: 'Start a job · Pantry' })
    expect(within(sheet).getByRole('button', { name: /^Chopped Carrot, grade 1/ }).getAttribute('aria-pressed')).toBe('true')
    // Amber suits Vegetables (Front Runner A), so she is preselected; the owner picks Bluebell instead.
    expect(sheet.querySelector('[data-g2="farm-uma-control"]')?.textContent).toContain('Amber Sprint · Farm Lv 1')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Free Umas' }))
    fireEvent.click(await within(await screen.findByRole('dialog', { name: 'Free Umas' })).findByRole('button', { name: BLUEBELL }))
    fireEvent.click(within(sheet).getByRole('button', { name: /^Start · / }))
    await waitFor(() => expect(where()).toBe('/town/warehouse'))
    expect(state(game).work[uma(2)]!.entries[0]!.request).toMatchObject({ kind: 'craft', item: 'chopped-carrot' })
  })
})

describe('the job sheet, one screen (D366)', () => {
  it('lists Free Umas only, every choice preselected, with each size read as how long it takes and the fitting one marked', async () => {
    const { state: account, at } = farmAccount(4)
    let working = withFarmLevel(account, uma(2), 9)
    // uma 3 works at the Fields; uma 4 finished a job there, still holding its slot.
    working = apply(working, 'start', { outfitId: uma(3), slot: { building: 'fields', slot: 0 }, request: { kind: 'gather', item: 'wheat', count: 3 } }, at).state
    working = apply(working, 'start', { outfitId: uma(4), slot: { building: 'fields', slot: 1 }, request: { kind: 'gather', item: 'wheat', count: 1 } }, at).state
    const { game, advance } = clocked(farmSeed(working, at))
    advance(GATHER_1 + MINUTE)
    const { where } = renderG2('/farm/orchard', game)
    fireEvent.click(await screen.findByRole('link', { name: 'Start a job in slot 1' }))
    const sheet = await screen.findByRole('dialog', { name: 'Start a job · Orchard' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Free Umas' }))
    const picker = await screen.findByRole('dialog', { name: 'Free Umas' })
    const umas = within(picker).getAllByRole('button').filter((button) => [AMBER, BLUEBELL].includes(button.getAttribute('aria-label') ?? ''))
    expect(umas.map((button) => button.getAttribute('aria-label'))).toEqual([BLUEBELL, AMBER])
    expect(within(picker).queryByRole('button', { name: /^Cinder Gale/ })).toBeNull()
    expect(within(picker).queryByRole('button', { name: /^Dawn Meadow/ })).toBeNull()
    fireEvent.click(within(picker).getByRole('button', { name: 'Close' }))
    // One is chosen, one item is chosen, and one size is chosen: Start is one tap away.
    expect(within(sheet).getAllByRole('radio', { checked: true }).length).toBe(1)
    expect(sheet.querySelector('[data-g2="farm-uma-control"]')?.textContent).toContain('Bluebell Dash · Farm Lv 9')
    expect(sheet.querySelectorAll('[data-item][aria-pressed="true"]')).toHaveLength(1)
    const chips = within(sheet).getAllByRole('radio').filter((radio) => radio.hasAttribute('data-size'))
    expect(chips.length).toBeGreaterThan(1)
    for (const chip of chips) expect(`${chip.textContent} ${chip.getAttribute('aria-label')}`).not.toMatch(CLOCK)
    expect(chips[0]!.textContent).toBe(`×1${durationText(GATHER_1)}`)
    const marked = sheet.querySelector('[data-marked]')!
    expect(marked.getAttribute('aria-checked')).toBe('true')
    expect(marked.getAttribute('aria-label')).toMatch(/, fits the next check-in$|, runs overnight$/)
    expect(marked.querySelector('[data-fit]')).not.toBeNull()
    const start = within(sheet).getByRole('button', { name: /^Start · ×\d+ · / })
    expect(start.textContent).not.toMatch(CLOCK)
    fireEvent.click(start)
    await waitFor(() => expect(where()).toBe('/farm/orchard'))
    expect(Object.values(state(game).work).some((row) => row.slot?.building === 'orchard' && row.slot.slot === 0)).toBe(true)
  })

  it('with no Free Uma says so, and nothing else but Collect here when a finished job here would free one', async () => {
    const { state: account, at } = farmAccount(1)
    const working = apply(account, 'start', { outfitId: uma(1), slot: { building: 'fields', slot: 0 }, request: { kind: 'gather', item: 'wheat', count: 1 } }, at).state
    const { game, advance } = clocked(farmSeed(working, at))
    renderG2('/farm/fields?job=&slot=1', game)
    let sheet = await screen.findByRole('dialog', { name: 'Start a job · Fields' })
    within(sheet).getByText('No free Uma')
    expect(within(sheet).queryByRole('button', { name: 'Collect here' })).toBeNull()
    expect(sheet.querySelectorAll('[data-item]')).toHaveLength(0)

    advance(GATHER_1)
    reopen('/farm/fields?job=&slot=1', game)
    sheet = await screen.findByRole('dialog', { name: 'Start a job · Fields' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Collect here' }))
    await waitFor(() => expect(state(game).items['wheat']).toBe(1))
    // Collected, she is Free: the sheet preselects her.
    await waitFor(() => expect(sheet.querySelector('[data-g2="farm-uma-control"]')?.textContent).toContain(`${AMBER} · Farm Lv 1`))
  })

  it("a target's icon opens the sheet filled in with its item, the planner's Uma and size: one more tap starts it", async () => {
    const { state: account, at } = farmAccount(1)
    const { game } = clocked(farmSeed(account, at))
    const { where } = renderG2('/farm/vegetable-garden', game)
    const target = await screen.findByRole('link', { name: /^Vegetables G1 · short \d+/ })
    expect(target.getAttribute('href')).toMatch(new RegExp(`^/farm/vegetable-garden\\?job=carrot&uma=${uma(1)}&count=\\d+$`))
    fireEvent.click(target)
    const sheet = await screen.findByRole('dialog', { name: 'Start a job · Vegetable Garden' })
    expect(within(sheet).getByRole('button', { name: /^Carrot, grade 1/ }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(sheet).getByRole('button', { name: /^Start · / }))
    await waitFor(() => expect(where()).toBe('/farm/vegetable-garden'))
    expect(state(game).work[uma(1)]!.entries[0]!.request).toMatchObject({ kind: 'gather', item: 'carrot' })
  })
})

describe('offline, away and reopened (07 §11, 02 §8)', () => {
  it('eighteen hours away, every output and queue start sits where the timestamps put it; a reopen keeps everything', async () => {
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
      const label = card.running ? `${card.made} of ${card.count} made, ${durationText(card.leftMs)} left` : `${card.made} of ${card.count} made, ready to collect`
      await screen.findByRole('article', { name: `${AMBER}. Wheat, ${label}` })
      return { hours, card, entries: view.settled.work[uma(1)]!.entries }
    }

    advance(18 * HOUR)
    reopen('/farm/fields', game)
    const eighteen = await check(18)
    expect(eighteen.card).toMatchObject({ made: 6, count: 10, running: true, queue: [{ item: 'wheat', count: 3 }] })

    reopen('/farm/fields', game)
    expect((await check(18)).card).toEqual(eighteen.card)

    advance(18 * HOUR)
    reopen('/farm/fields', game)
    const day = await check(36)
    const first = endsAt(working.work[uma(1)]!.entries[0]!)
    expect(day.entries.map((entry) => entry.startedAt)).toEqual([at, first])
    expect(day.card).toMatchObject({ made: 3, count: 3, running: false, waiting: 13 })

    // Offline, a tap still applies on this phone.
    fireEvent.click(screen.getByRole('button', { name: 'Collect here · 1' }))
    await waitFor(() => expect(state(game).items['wheat']).toBe(13))
    screen.getByText(`${AMBER}: 13 Wheat · Farm EXP +${Math.round((13 * day.entries[0]!.farmExp[0]!) / 4).toLocaleString('en-US')}`)
  })
})

describe('Collect here, Repeat here and a row\'s Repeat (07 §9, §10)', () => {
  it('collect this building only, then Repeat here lists each start and each skip with its reason', async () => {
    const { state: account, at } = farmAccount(2)
    let working = apply(account, 'dev-grant', { items: { 'chopped-carrot': 1, 'dried-button-mushroom': 1, 'wheat-flour': 1 } }, at).state
    working = apply(working, 'start', { outfitId: uma(1), slot: { building: 'kitchen', slot: 0 }, request: { kind: 'cook', item: 'tonic-1', count: 1 } }, at).state
    working = apply(working, 'start', { outfitId: uma(2), slot: { building: 'fields', slot: 0 }, request: { kind: 'gather', item: 'wheat', count: 1 } }, at).state
    const { game, advance } = clocked(farmSeed(working, at))
    advance(COOK_1)
    renderG2('/farm/kitchen', game)
    screen.getByRole('button', { name: 'Nobody to repeat' })
    fireEvent.click(await screen.findByRole('button', { name: 'Collect here · 1' }))
    await screen.findByText(new RegExp(`^${AMBER}: 1 Warm-Up Tonic · Farm EXP \\+\\d+$`))
    expect(state(game).items['tonic-1']).toBe(1)
    expect(state(game).items['wheat']).toBeUndefined()
    expect(screen.getByRole('button', { name: 'Nothing to collect' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Repeat here · 1' }))
    await screen.findByText(`${AMBER}: Short 1 Chopped Carrot.`)
    expect(state(game).work[uma(1)]!.entries).toEqual([])
  })

  it("a finished row's Repeat collects and restarts the same job for her, and says why when it can't", async () => {
    const { state: account, at } = farmAccount(1)
    let working = apply(account, 'set-repeat-sizing', { sizing: 'same' }, at).state
    working = apply(working, 'start', { outfitId: uma(1), slot: { building: 'fields', slot: 0 }, request: { kind: 'gather', item: 'wheat', count: 2 } }, at).state
    const { game, advance } = clocked(farmSeed(working, at))
    advance(2 * GATHER_1)
    renderG2('/farm/fields', game)
    const row = await screen.findByRole('article', { name: `${AMBER}. Wheat, 2 of 2 made, ready to collect` })
    fireEvent.click(within(row).getByRole('button', { name: 'Collect and repeat Wheat ×2' }))
    await waitFor(() => expect(state(game).items['wheat']).toBe(2))
    await waitFor(() => expect(state(game).work[uma(1)]!.entries.at(-1)!.request).toEqual({ kind: 'gather', item: 'wheat', count: 2 }))
    expect(state(game).work[uma(1)]!.entries.at(-1)!.startedAt).toBe(at + 2 * GATHER_1)
    const names = await appliedNames(game)
    expect(names.slice(-2)).toEqual(['collect', 'repeat'])
  })
})

describe('a stale screen (02 §9)', () => {
  it('re-offers the covered size in one sentence, and its yes starts that size', async () => {
    const { state: account, at } = farmAccount(1)
    const stocked = apply(account, 'dev-grant', { items: { 'chopped-carrot': 3, 'dried-button-mushroom': 3, 'wheat-flour': 3 } }, at).state
    const base = createMemoryGame(farmSeed(stocked, at), () => 0)
    let stale = true
    // The other device brewed one tonic's worth first: this phone's Start is answered as `recheck` would.
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
    const { where } = renderG2(`/farm/kitchen?job=tonic-1&uma=${uma(1)}&count=3`, game)
    const sheet = await screen.findByRole('dialog', { name: 'Start a job · Kitchen' })
    fireEvent.click(within(sheet).getByRole('button', { name: /^Start · ×3 · / }))
    await within(sheet).findByText('Only 2 left now. Start ×2?')
    expect(state(game).work[uma(1)]).toBeUndefined()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(where()).toBe('/farm/kitchen'))
    expect(state(game).work[uma(1)]!.entries[0]!.request).toEqual({ kind: 'cook', item: 'tonic-1', count: 2 })
  })
})

describe('Speed Tickets on a row (09 §5.1)', () => {
  it('"Buy 6 and finish · 180" in the ticket\'s sheet asks once, then buys and finishes as two taps in order', async () => {
    const { state: account, at } = farmAccount(1)
    let ready = apply(account, 'dev-grant', { prizeMoney: 1_000, items: { 'speed-ticket': 5 } }, at).state
    ready = apply(ready, 'start', { outfitId: uma(1), slot: { building: 'fields', slot: 0 }, request: { kind: 'gather', item: 'wheat', count: 2 } }, at).state
    const { game } = clocked(farmSeed(ready, at))
    renderG2('/farm/fields', game)
    fireEvent.click(await screen.findByRole('button', { name: 'Speed Tickets for Wheat ×2' }))
    const sheet = await screen.findByRole('dialog', { name: 'Speed up Wheat ×2' })
    within(sheet).getByText(`${durationText(2 * GATHER_1)} left`)
    fireEvent.click(within(sheet).getByRole('button', { name: 'Buy 6 and finish · 180' }))
    within(sheet).getByText('Buy 6 Speed Tickets for 180 Prize Money and finish now?')
    expect(state(game).profile.prizeMoney).toBe(1_000)
    fireEvent.click(within(sheet).getByRole('button', { name: 'Yes' }))
    await screen.findByRole('article', { name: `${AMBER}. Wheat, 2 of 2 made, ready to collect` })
    expect(state(game).profile.prizeMoney).toBe(820)
    expect(state(game).items['speed-ticket']).toBeUndefined()
    const names = await appliedNames(game)
    expect(names.slice(-2)).toEqual(['buy', 'finish'])
  })
})

describe('the side panel and the Counter (11 §2.6, §3.4; D366)', () => {
  it("shows a row per slot with faces and time left, the targets as icons and the family's stock; the tile counts who is ready", async () => {
    const { state: account, at } = farmAccount(2)
    let working = apply(account, 'dev-grant', { items: { carrot: 3 } }, at).state
    working = apply(working, 'start', { outfitId: uma(1), slot: { building: 'vegetable-garden', slot: 0 }, request: { kind: 'gather', item: 'carrot', count: 2 } }, at).state
    const { game, advance } = clocked(farmSeed(working, at))
    renderG2('/farm?peek=vegetable-garden', game)
    const peek = await screen.findByRole('dialog', { name: 'Vegetable Garden' })
    const row = await within(peek).findByRole('group', { name: `${AMBER}. Carrot, 0 of 2 made, ${durationText(2 * GATHER_1)} left` })
    within(row).getByText('Carrot ×2 · 0/2')
    within(row).getByText(durationText(2 * GATHER_1))
    expect(peek.textContent).not.toMatch(CLOCK)
    expect(within(peek).getAllByRole('link', { name: /^Start a job in slot \d$/ })).toHaveLength(3)
    within(peek).getByLabelText('Carrot: 3')
    within(peek).getByRole('heading', { name: 'For your targets' })
    within(peek).getByText('Lv 1 · 1 of 4 slots in use')
    expect(within(peek).queryByRole('button', { name: /^Collect here/ })).toBeNull()

    advance(GATHER_1)
    reopen('/farm', game)
    await screen.findByRole('link', { name: /^Vegetable Garden\. \d of 4 slots busy, 1 ready\.$/ })
    expect(document.querySelector('[data-place="vegetable-garden"] [data-counter]')?.textContent).toBe('1')
  })

  it('Hub to a started job in a free slot is three taps: the building, its "+" (the sheet over the map), Start', async () => {
    const { state: account, at } = farmAccount(1)
    const { game } = clocked(farmSeed(account, at))
    const { where } = renderG2('/farm', game)
    fireEvent.click(await screen.findByRole('link', { name: /^Fields\./ }))
    const peek = await screen.findByRole('dialog', { name: 'Fields' })
    fireEvent.click(within(peek).getByRole('link', { name: 'Start a job in slot 1' }))
    await waitFor(() => expect(where()).toBe('/farm?peek=fields&job=&slot=0'))
    const sheet = await screen.findByRole('dialog', { name: 'Start a job · Fields' })
    fireEvent.click(within(sheet).getByRole('button', { name: /^Start · ×\d+ · / }))
    await waitFor(() => expect(where()).toBe('/farm?peek=fields'))
    expect(state(game).work[uma(1)]!.entries[0]!.request).toMatchObject({ kind: 'gather', item: 'wheat' })
    await within(screen.getByRole('dialog', { name: 'Fields' })).findByRole('group', { name: new RegExp(`^${AMBER}\\. Wheat, 0 of \\d+ made, .+ left$`) })
  })

  it('closes the job sheet over the map before the side panel: Escape takes the sheet first, and a sideways drag on it is never the panel\'s swipe', async () => {
    stubPointerEvents()
    const { state: account, at } = farmAccount(1)
    const { game } = clocked(farmSeed(account, at))
    const { where } = renderG2('/farm', game)
    fireEvent.click(await screen.findByRole('link', { name: /^Fields\./ }))
    const peek = await screen.findByRole('dialog', { name: 'Fields' })
    fireEvent.click(await within(peek).findByRole('link', { name: 'Start a job in slot 1' }))
    await waitFor(() => expect(where()).toBe('/farm?peek=fields&job=&slot=0'))
    const sheet = await screen.findByRole('dialog', { name: 'Start a job · Fields' })
    fireEvent.pointerDown(sheet, { clientX: 100, clientY: 500 })
    fireEvent.pointerUp(sheet, { clientX: 260, clientY: 505 })
    expect(where()).toBe('/farm?peek=fields&job=&slot=0')
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(where()).toBe('/farm?peek=fields'))
    expect(screen.getByRole('dialog', { name: 'Fields' })).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(where()).toBe('/farm'))
    expect(screen.queryByRole('dialog', { name: 'Fields' })).toBeNull()
  })

  it('Hub to a finished job collected and restarted is two taps: the building, Repeat; Collect here is two too', async () => {
    const { state: account, at } = farmAccount(2)
    let working = apply(account, 'set-repeat-sizing', { sizing: 'same' }, at).state
    working = apply(working, 'start', { outfitId: uma(1), slot: { building: 'fields', slot: 0 }, request: { kind: 'gather', item: 'wheat', count: 1 } }, at).state
    working = apply(working, 'start', { outfitId: uma(2), slot: { building: 'fields', slot: 1 }, request: { kind: 'gather', item: 'wheat', count: 1 } }, at).state
    const { game, advance } = clocked(farmSeed(working, at))
    advance(GATHER_1)
    renderG2('/farm', game)
    fireEvent.click(await screen.findByRole('link', { name: /^Fields\./ }))
    const peek = await screen.findByRole('dialog', { name: 'Fields' })
    const done = within(peek).getByRole('group', { name: `${AMBER}. Wheat, 1 of 1 made, ready to collect` })
    within(done).getByText('Done')
    fireEvent.click(within(done).getByRole('button', { name: 'Collect and repeat Wheat ×1' }))
    await waitFor(() => expect(state(game).work[uma(1)]!.entries.at(-1)!.startedAt).toBe(at + GATHER_1))
    expect(state(game).items['wheat']).toBe(1)

    fireEvent.click(within(peek).getByRole('button', { name: 'Collect here · 1' }))
    await waitFor(() => expect(state(game).items['wheat']).toBe(2))
    expect(state(game).work[uma(2)]!.entries).toEqual([])
  })
})
