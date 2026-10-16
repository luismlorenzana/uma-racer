// @vitest-environment jsdom
// The check-in on screen (docs/game/02-check-ins-and-notifications.md §1–§5, §8, §9, §12; T142), through the real
// routes and the in-memory port on synthetic seeds: Collect all from the pill, once, its receipt kept through a reload
// and replaced in place by the server's; Repeat all, per-Uma Repeat, Same/Fit, the shrink and Switch notes and every
// skip's fixes; Start suggestions line by line; Queue stopped's buttons; Speed up all and Best use; stale screens,
// double taps, offline and plain words; and the clock moved either way.
import { hubView } from '@racer/domain/hub'
import { sellPrice } from '@racer/domain/economy'
import { CHECK_IN_WORDS, hasBannedWord, repeatable, type CollectAllReceipt, type OperationName } from '@racer/domain/check-in'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { G2Answer, G2Game, G2Snapshot } from '../../app/game'
import { createMemoryGame } from '../../dev/memory'
import { seedAt, type G2Seed } from '../../dev/seed'
import { appliedNames, renderG2, seed, stubStorage } from '../../__fixtures__/testing'
import { workView } from '../../ui/work/view'
import { placeName } from '../../ui/work/words'
import { apply, farmAccount, farmSeed, HOUR, uma, withFarmLevel } from '../farm/__fixtures__/farm'
import { SHOWN_AT_KEY } from './device'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(stubStorage)

interface Call {
  readonly name: OperationName
  readonly input: unknown
}

/** The in-memory port on `made`, its clock held, with every tap recorded; `before` runs ahead of a tap (another device). */
function spied(made: G2Seed, before?: (name: OperationName, input: unknown, game: G2Game) => Promise<G2Answer | void> | G2Answer | void) {
  const base = createMemoryGame(made, () => 0)
  const calls: Call[] = []
  const game: G2Game = {
    ...base,
    async run(name, input, busyKey, options) {
      calls.push({ name, input })
      const instead = await before?.(name, input, base)
      if (instead) return instead as G2Answer<typeof name>
      return base.run(name, input, busyKey, options)
    },
  }
  return { game, calls, names: () => calls.map((call) => call.name) }
}

const state = (game: G2Game) => game.getSnapshot().state!
const settledOf = (game: G2Game) => workView(state(game), game.now(), game.getSnapshot().env!).settled
const nameOf = (made: G2Seed, outfitId: string) => made.env.content.umas.get(outfitId)!.name

async function openSheet(game: G2Game, collect: boolean, path = '/farm') {
  const rendered = renderG2({ pathname: path, search: '?sheet=check-in', state: { back: true, collect } }, game)
  const sheet = await screen.findByRole('dialog', { name: 'Check-in' })
  return { ...rendered, sheet }
}

const section = (sheet: HTMLElement, kind: string) => sheet.querySelector<HTMLElement>(`[data-section="${kind}"]`)

/** Repeat all once Collect all has answered: the button waits for it. */
async function repeatAllButton(sheet: HTMLElement, name: string | RegExp = /^Repeat all \(\d+\)$/): Promise<HTMLElement> {
  const button = await within(sheet).findByRole('button', { name })
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false))
  return button
}

describe('Collect all (02 §2, §9, §12)', () => {
  it('runs one collect-all from the pill, keeps its id, and a reload shows the same receipt without collecting again', async () => {
    const made = seed('busy')
    const view = hubView(made.state, made.at, made.env)
    const { game, calls } = spied(made)
    const { state: nav } = renderG2('/farm', game)
    fireEvent.click(await screen.findByRole('link', { name: `Collect all · ${view.ready} ready` }))
    const sheet = await screen.findByRole('dialog', { name: 'Check-in' })
    await waitFor(() => expect((nav() as { collectId?: string }).collectId).toBeDefined())
    expect(calls).toEqual([{ name: 'collect-all', input: { shown: view.readySlots } }])
    const id = (nav() as { collectId: string }).collectId
    const receipt = game.getSnapshot().receipts[id]!.local as CollectAllReceipt
    const totals = within(sheet).getByText(/^\d+ items · \d+ (dish|dishes) · \d+ unlocks?$/).textContent
    expect(totals).toContain(`${receipt.totals.items} items`)
    expect(nav()).toEqual({ back: true, collect: false, collectId: id })

    // Opened again without the entry's state, nothing was collected by it; the reload keeps the entry's state.
    cleanup()
    const again = await openSheet(game, false)
    expect(within(again.sheet).queryByText(totals!)).toBeNull()
    cleanup()
    const reload = renderG2({ pathname: '/farm', search: '?sheet=check-in', state: { back: true, collect: false, collectId: id } }, game)
    const reopened = await screen.findByRole('dialog', { name: 'Check-in' })
    await within(reopened).findByText(totals!)
    expect(calls.filter((call) => call.name === 'collect-all')).toHaveLength(1)
    expect(reload.where()).toBe('/farm?sheet=check-in')
  })

  it("reads a shown slot the other device collected as \"Already collected.\", and the server's receipt replaces the local lines", async () => {
    const made = seed('busy')
    const view = hubView(made.state, made.at, made.env)
    const other = view.readySlots[0]!
    const holder = Object.values(workView(made.state, made.at, made.env).settled.work).find((row) => row.slot !== null && row.slot.building === other.building && row.slot.slot === other.slot && (row.slot.room ?? null) === (other.room ?? null))!
    // The other device collects her first.
    const { game } = spied(made, async (name, _input, base) => {
      if (name === 'collect-all') await base.run('collect', { outfitId: holder.outfitId })
    })
    const { sheet, state: nav } = await openSheet(game, true)
    const place = placeName(other.building)
    await within(sheet).findByText(`${place}: ${CHECK_IN_WORDS['already-collected']}`)

    // The server answers: one slot failed there; the line changes in place.
    const id = (nav() as { collectId: string }).collectId
    const local = game.getSnapshot().receipts[id]!.local as CollectAllReceipt
    const failed = local.lines.find((line) => line.status === 'collected')!
    const server: CollectAllReceipt = {
      ...local,
      lines: local.lines.map((line) => (line === failed ? { ...line, status: 'failed', items: [], unlocks: [], words: { text: CHECK_IN_WORDS.unexpected } } : line)),
    }
    const snapshot = game.getSnapshot()
    const answered: G2Snapshot = { ...snapshot, receipts: { ...snapshot.receipts, [id]: { local, server } } }
    cleanup()
    renderG2({ pathname: '/farm', search: '?sheet=check-in', state: { collectId: id } }, { ...game, getSnapshot: () => answered })
    const reopened = await screen.findByRole('dialog', { name: 'Check-in' })
    await within(reopened).findByText(`${nameOf(made, failed.outfitId!)}: ${CHECK_IN_WORDS.unexpected}`)
    within(reopened).getByText(`${place}: ${CHECK_IN_WORDS['already-collected']}`)
  })

  it('with the clock moved forward the pill reads Collect all and the sheet collects; moved back, nothing reads negative', async () => {
    const quiet = seed('quiet')
    expect(hubView(quiet.state, quiet.at, quiet.env).ready).toBe(0)
    const later = seedAt(quiet, '14:00')
    const view = hubView(later.state, later.at, later.env)
    expect(view.ready).toBeGreaterThan(0)
    const { game, calls } = spied(later)
    renderG2('/farm', game)
    fireEvent.click(await screen.findByRole('link', { name: `Collect all · ${view.ready} ready` }))
    await waitFor(() => expect(calls.map((call) => call.name)).toEqual(['collect-all']))
    cleanup()

    const earlier = seedAt(seed('busy'), '06:00')
    const back = spied(earlier)
    renderG2('/farm', back.game)
    const sheetLink = await screen.findByRole('link', { name: /^(Collect all|Check-in) · / })
    fireEvent.click(sheetLink)
    const sheet = await screen.findByRole('dialog', { name: 'Check-in' })
    await waitFor(() => expect(within(sheet).queryByText(/Collecting/)).toBeNull())
    expect(document.body.textContent).not.toMatch(/-\d|NaN|Infinity/)
    for (const ring of document.querySelectorAll<HTMLElement>('[data-ring]')) expect(ring.dataset.ring === 'ready' || Number(ring.dataset.ring) >= 0).toBe(true)
  })
})

describe('the summary sheet (02 §4)', () => {
  it("reads \"since\" from this device, written when the sheet closes, not when it opens", async () => {
    const made = seed('quiet')
    localStorage.setItem(SHOWN_AT_KEY, String(made.at - 5 * HOUR))
    const { game } = spied(made)
    // Opened by a link from outside the app, so Close replaces the entry rather than going back.
    renderG2({ pathname: '/farm', search: '?sheet=check-in' }, game)
    const sheet = await screen.findByRole('dialog', { name: 'Check-in' })
    within(sheet).getByRole('heading', { name: /^Check-in · last visit 5h ago$/ })
    expect(localStorage.getItem(SHOWN_AT_KEY)).toBe(String(made.at - 5 * HOUR))
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(localStorage.getItem(SHOWN_AT_KEY)).toBe(String(made.at)))
  })

  it('folds a section and remembers it on this device', async () => {
    const { game } = spied(seed('stopped'))
    const { sheet } = await openSheet(game, false)
    const toggle = within(section(sheet, 'queue-stopped')!).getByRole('button', { name: /^Queue stopped \(3\)$/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(JSON.parse(localStorage.getItem('uma-racer:g2:check-in:collapsed')!)).toEqual(['queue-stopped'])
  })

  it('on busy, Collect all, Repeat all, Start suggestions and close leave every Uma busy, or Free with a reason', async () => {
    const made = seed('busy')
    const { game } = spied(made)
    const { sheet } = await openSheet(game, true)
    const repeatAll = await repeatAllButton(sheet)
    expect(repeatAll.textContent).toBe(`Repeat all (${repeatable(settledOf(game)).length})`)
    fireEvent.click(repeatAll)
    await within(sheet).findByRole('button', { name: /^Repeated \(\d+\)$/ })
    fireEvent.click(await within(sheet).findByRole('button', { name: /^Start suggestions \(\d+\)$/ }))
    await waitFor(() => expect(within(sheet).queryByRole('button', { name: /^Start suggestions/ })).toBeNull())
    const after = hubView(state(game), game.now(), made.env)
    const freeRows = [...sheet.querySelectorAll<HTMLElement>('[data-free]')]
    expect(freeRows).toHaveLength(after.free)
    for (const row of freeRows) expect(row.textContent!.length).toBeGreaterThan(nameOf(made, row.dataset.free!).length)
    expect(after.ready).toBe(0)
  })
})

describe('Repeat (02 §5)', () => {
  /** Uma 1 crafted Chopped Carrot ×6 and only 3 Carrots are left; Uma 2, at Farm Lv 7, gathered Carrot ×2. */
  function repeatAccount() {
    const { state: account, at } = farmAccount(3)
    let next = withFarmLevel(withFarmLevel(account, uma(2), 7), uma(1), 3)
    next = apply(next, 'dev-grant', { items: { carrot: 6 }, prizeMoney: 1_000 }, at).state
    next = apply(next, 'start', { outfitId: uma(1), slot: { building: 'pantry', slot: 0 }, request: { kind: 'craft', item: 'chopped-carrot', count: 6 } }, at).state
    next = apply(next, 'start', { outfitId: uma(2), slot: { building: 'vegetable-garden', slot: 0 }, request: { kind: 'gather', item: 'carrot', count: 2 } }, at).state
    next = apply(next, 'dev-grant', { items: { carrot: 3 } }, at).state
    return farmSeed(next, at + 6 * HOUR)
  }

  it('Repeat all takes repeatable Umas; its notes read "×6 → ×3" and "grade 2 open" with Switch, which recalls and starts the higher grade', async () => {
    const made = repeatAccount()
    const { game, calls } = spied(made)
    const { sheet } = await openSheet(game, true)
    fireEvent.click(await repeatAllButton(sheet, 'Repeat all (2)'))
    const repeated = await within(sheet).findByRole('button', { name: 'Repeated (2)' })
    expect(calls.at(-1)).toEqual({ name: 'repeat', input: { utcOffsetMin: 0 } })
    const block = section(sheet, 'repeated')!
    // Collect all brought in Bluebell Dash's two Carrots, so five cover ×5 of the six.
    within(block).getByText(/^Amber Sprint: Craft Vegetables G1 ×5 → in \d+[dhm][\dhm ]* · ×6 → ×5$/)
    within(block).getByText(/^Bluebell Dash: Gather Vegetables G1 ×2 → in \d+[dhm][\dhm ]* · grade 2 open$/)
    expect(repeated).toBeTruthy()
    fireEvent.click(within(block).getByRole('button', { name: 'Switch Bluebell Dash to grade 2' }))
    await waitFor(() => expect(calls.slice(-2).map((call) => call.name)).toEqual(['recall', 'start']))
    expect(calls.at(-1)!.input).toMatchObject({ outfitId: uma(2), slot: { building: 'vegetable-garden', slot: 0 }, request: { kind: 'gather', item: 'potato', count: 2 } })
    expect(state(game).work[uma(2)]!.entries.at(-1)!.request).toMatchObject({ item: 'potato', count: 2 })
  })

  it("a Free line's Repeat takes her alone, and the Same/Fit toggle persists through set-repeat-sizing", async () => {
    const made = repeatAccount()
    const { game, calls } = spied(made)
    const { sheet } = await openSheet(game, true)
    const line = await within(sheet).findByRole('button', { name: 'Repeat Bluebell Dash’s last job' })
    fireEvent.click(line)
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: 'repeat', input: { outfitIds: [uma(2)], utcOffsetMin: 0 } }))
    const sizing = within(sheet).getByRole('tablist', { name: 'Repeat sizes' })
    const fit = within(sizing).getByRole('tab', { name: 'Fit size' })
    expect(state(game).profile.repeatSizing).toBe('same')
    fireEvent.click(fit)
    await waitFor(() => expect(state(game).profile.repeatSizing).toBe('fit'))
    expect(calls.at(-1)).toEqual({ name: 'set-repeat-sizing', input: { sizing: 'fit' } })
    expect(fit.getAttribute('aria-selected')).toBe('true')
  })

  it("Couldn't repeat's Buy asks once with its amount, buys, then repeats her; Make them starts makeThem's job; Pick another opens her place", async () => {
    const { state: account, at } = farmAccount(2)
    let next = apply(withFarmLevel(account, uma(2), 3), 'dev-grant', { items: { carrot: 1 }, prizeMoney: 500 }, at).state
    next = apply(next, 'start', { outfitId: uma(1), slot: { building: 'pantry', slot: 0 }, request: { kind: 'craft', item: 'chopped-carrot', count: 1 } }, at).state
    const made = farmSeed(next, at + HOUR)
    const { game, calls } = spied(made)
    const { sheet } = await openSheet(game, true)
    fireEvent.click(await repeatAllButton(sheet))
    const skips = await waitFor(() => {
      const found = section(sheet, 'couldnt-repeat')
      expect(found).not.toBeNull()
      return found!
    })
    const skip = within(skips).getByText('Short 1 Carrot.').closest('li')!
    expect(within(skip).getByRole('link', { name: 'Pick another' }).getAttribute('href')).toBe('/farm/pantry')
    fireEvent.click(within(skip).getByRole('button', { name: 'Buy 1 and repeat · 108' }))
    within(skip).getByText('Buy 1 Carrot for 108 Prize Money and repeat Amber Sprint’s job?')
    const before = calls.length
    fireEvent.click(within(skip).getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(calls.slice(before).map((call) => call.name)).toEqual(['buy', 'repeat']))
    expect(calls.slice(before).map((call) => call.input)).toEqual([
      { sku: 'carrot', qty: 1, unitPrice: 108 }, { outfitIds: [uma(1)], utcOffsetMin: 0 },
    ])
    await waitFor(() => expect(state(game).work[uma(1)]!.entries.at(-1)!.request).toMatchObject({ item: 'chopped-carrot', count: 1 }))
  })

  it("Couldn't repeat's Make them starts the missing input with another Free Uma", async () => {
    const { state: account, at } = farmAccount(2)
    let next = apply(withFarmLevel(account, uma(2), 3), 'dev-grant', { items: { carrot: 1 } }, at).state
    next = apply(next, 'start', { outfitId: uma(1), slot: { building: 'pantry', slot: 0 }, request: { kind: 'craft', item: 'chopped-carrot', count: 1 } }, at).state
    const { game, calls } = spied(farmSeed(next, at + HOUR))
    const { sheet } = await openSheet(game, true)
    fireEvent.click(await repeatAllButton(sheet))
    const skips = await waitFor(() => {
      const found = section(sheet, 'couldnt-repeat')
      expect(found).not.toBeNull()
      return found!
    })
    fireEvent.click(within(skips).getByRole('button', { name: 'Make them: Vegetable Garden ×1' }))
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ name: 'start', input: { outfitId: uma(2), request: { kind: 'gather', item: 'carrot', count: 1 } } }))
  })

  it("on stopped, a stopped Uma's skip points at her card, a Dojo skip opens her Dojo sheet, a finished facility starts the next suggestion", async () => {
    const made = seed('stopped')
    const { game, calls } = spied(made)
    const { sheet } = await openSheet(game, true)
    fireEvent.click(await repeatAllButton(sheet))
    const skips = await waitFor(() => {
      const found = section(sheet, 'couldnt-repeat')
      expect(found).not.toBeNull()
      return found!
    })
    const point = within(skips).getAllByRole('button', { name: 'See her stopped queue' })[0]!
    const outfit = point.closest('li')!.dataset.skip!
    fireEvent.click(point)
    expect(document.activeElement).toBe(document.getElementById(`stopped-${outfit}`))
    expect(within(skips).getByRole('link', { name: 'Pick cards' }).getAttribute('href')).toMatch(/^\/training\/dojo\?session=sim-uma-\d+&room=[\w-]+&back=/)
    const start = within(skips).getByRole('button', { name: /^Start: / })
    const before = calls.length
    fireEvent.click(start)
    await waitFor(() => expect(calls.slice(before).map((call) => call.name)).toEqual(['start']))
  })
})

describe('Start suggestions (02 §4, §6)', () => {
  it('runs one start per line, in order; a line the state refuses shows its words while the others start', async () => {
    const made = seed('busy')
    let starts = 0
    const { game, calls } = spied(made, (name) => {
      if (name !== 'start') return
      starts += 1
      if (starts === 2) return { kind: 'say', words: { text: 'Needs Farm Lv {level}.', data: { level: 16 } }, id: 'refused' } satisfies G2Answer
    })
    const { sheet } = await openSheet(game, true)
    const button = await within(sheet).findByRole('button', { name: /^Start suggestions \((\d+)\)$/ })
    const lines = [...section(sheet, 'free')!.querySelectorAll<HTMLElement>('[data-free]')]
    const suggested = lines.filter((line) => !line.textContent!.includes('Nothing she can start')).map((line) => line.dataset.free)
    fireEvent.click(button)
    await waitFor(() => expect(calls.filter((call) => call.name === 'start')).toHaveLength(suggested.length))
    expect(calls.filter((call) => call.name === 'start').map((call) => (call.input as { outfitId: string }).outfitId)).toEqual(suggested)
    const refused = suggested[1]!
    await within(sheet).findByText('Needs Farm Lv 16.')
    expect(sheet.querySelector(`[data-free="${refused}"]`)!.textContent).toContain('Needs Farm Lv 16.')
    for (const id of suggested.filter((outfitId) => outfitId !== refused)) expect(state(game).work[id!]?.entries.length).toBeGreaterThan(0)
  })
})

describe('Queue stopped (02 §3, §4)', () => {
  it('Buy and restart asks once with the price, buys the shortfall, then puts her whole queue back', async () => {
    const made = seed('stopped')
    const { game, calls } = spied(made)
    const { sheet } = await openSheet(game, false)
    const card = within(sheet).getByRole('article', { name: /^Tidal Charm’s queue stopped: Pantry ×10 · stopped 35m ago$/ })
    within(card).getByText('Short 10 Carrot.')
    within(card).getByText('then Chopped Carrot ×5')
    fireEvent.click(within(card).getByRole('button', { name: 'Buy 10 and restart · 1,080' }))
    within(card).getByText('Buy 10 Carrot for 1,080 Prize Money and restart her queue?')
    expect(calls).toEqual([])
    fireEvent.click(within(card).getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(calls.map((call) => call.name)).toEqual(['buy', 'start']))
    expect(calls.map((call) => call.input)).toEqual([{ sku: 'carrot', qty: 10, unitPrice: 108 }, { outfitId: 'sim-uma-20', from: 'dropped' }])
    const row = settledOf(game).work['sim-uma-20']!
    expect(row.dropped).toBeNull()
    expect(row.entries.at(-1)!.request).toEqual({ kind: 'craft', item: 'chopped-carrot', count: 10 })
    expect(row.queue).toEqual([{ kind: 'craft', item: 'chopped-carrot', count: 5 }])
    await waitFor(() => expect(within(sheet).queryByRole('article', { name: /^Tidal Charm’s queue stopped/ })).toBeNull())
  })

  it('Start ×6, Make them and Dismiss each issue their operation', async () => {
    const made = seed('stopped')
    const { game, calls } = spied(made)
    const { sheet } = await openSheet(game, false)
    const basil = within(sheet).getByRole('article', { name: /^Bluebell Dash’s queue stopped/ })
    fireEvent.click(within(basil).getByRole('button', { name: 'Start ×6' }))
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: 'start', input: { outfitId: 'sim-uma-02', from: 'dropped', count: 6 } }))
    const dish = within(sheet).getByRole('article', { name: /^Willow Drift’s queue stopped/ })
    const make = within(dish).getByRole('button', { name: /^Make them: Pantry ×4, by / })
    fireEvent.click(make)
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ name: 'start', input: { request: { kind: 'craft', item: 'apple-preserve', count: 4 } } }))
    fireEvent.click(within(sheet).getByRole('button', { name: 'Dismiss Willow Drift’s stopped queue' }))
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: 'queue', input: { outfitId: 'sim-uma-23', dismiss: true } }))
    await waitFor(() => expect(settledOf(game).work['sim-uma-23']!.dropped).toBeNull())
  })

  it('a stale card asks again with the new numbers, and says the rule when another device already acted', async () => {
    const made = seed('stopped')
    // Another device sells four Basil, and dismisses Tidal Charm's queue, between this screen's drawing and the tap.
    const { game } = spied(made, async (name, input, base) => {
      if (name !== 'start' || (input as { from?: string }).from !== 'dropped') return
      const { outfitId } = input as { outfitId: string }
      if (outfitId === 'sim-uma-02' && (state(base).items['basil'] ?? 0) === 6) await base.run('sell', { itemId: 'basil', qty: 4, unitPrice: sellPrice('basil')! })
      if (outfitId === 'sim-uma-20') await base.run('queue', { outfitId, dismiss: true })
    })
    const { sheet } = await openSheet(game, false)
    const basil = within(sheet).getByRole('article', { name: /^Bluebell Dash’s queue stopped/ })
    fireEvent.click(within(basil).getByRole('button', { name: 'Start ×6' }))
    await within(sheet).findByText('Only 2 left now. Start ×2?')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(settledOf(game).work['sim-uma-02']!.entries.at(-1)!.request).toMatchObject({ item: 'dried-basil', count: 2 }))

    const carrot = within(sheet).getByRole('article', { name: /^Tidal Charm’s queue stopped/ })
    fireEvent.click(within(carrot).getByRole('button', { name: 'Buy 10 and restart · 1,080' }))
    fireEvent.click(within(carrot).getByRole('button', { name: 'Yes' }))
    await within(sheet).findByText('Nothing to restart.')
  })
})

describe('Speed up all and Best use (02 §4)', () => {
  it('offers three spans with their counts, confirms once, refuses short tickets with the Exchange row, and lists Best use', async () => {
    const made = seed('stopped')
    const { game, calls } = spied(made)
    const { sheet } = await openSheet(game, false)
    fireEvent.click(within(sheet).getByRole('button', { name: 'Speed up' }))
    await within(sheet).findByRole('heading', { name: 'Speed up all' })
    const one = within(sheet).getByRole('button', { name: /^1 h · \d+ Speed Tickets$/ })
    within(sheet).getByRole('button', { name: /^2 h · \d+ Speed Tickets$/ })
    const late = within(sheet).getByRole('button', { name: /^to 22:30 · \d+ Speed Tickets$/ })
    expect(late.hasAttribute('disabled')).toBe(true)
    const tickets = /· (\d+) Speed/.exec(late.textContent!)![1]
    within(sheet).getByText(`Needs ${tickets} Speed Tickets.`)
    expect(within(sheet).getByRole('link', { name: 'Buy Speed Tickets at the Exchange' }).getAttribute('href')).toBe('/town/exchange?row=speed-tickets')
    const n = /· (\d+) Speed/.exec(one.textContent!)![1]
    fireEvent.click(one)
    within(sheet).getByText(`Use ${n} Speed Tickets to take 1 h off every running job?`)
    expect(calls).toEqual([])
    fireEvent.click(within(sheet).getByRole('button', { name: 'Yes' }))
    await within(sheet).findByText(`${n} Speed Tickets used.`)
    expect(calls).toEqual([{ name: 'speed-up', input: { all: true, span: 60, utcOffsetMin: 0 } }])
    expect(state(game).items['speed-ticket']).toBe(12 - Number(n))
    const best = sheet.querySelectorAll('[data-best-use]')
    expect(best.length).toBeLessThanOrEqual(3)
    fireEvent.click(within(sheet).getByRole('button', { name: 'Back to the check-in' }))
    await within(sheet).findByRole('heading', { name: /^Check-in/ })
  })
})

describe('stale screens, double taps, offline and plain words (02 §9)', () => {
  it('a double tap on Repeat all runs one operation', async () => {
    const made = seed('busy')
    const { game } = spied(made)
    const { sheet } = await openSheet(game, true)
    const button = await repeatAllButton(sheet)
    fireEvent.click(button)
    fireEvent.click(button)
    await within(sheet).findByRole('button', { name: /^Repeated/ })
    const repeats = (await appliedNames(game)).filter((name) => name === 'repeat')
    expect(repeats).toHaveLength(1)
  })

  it("offline, the footer says so in one line and links to Account's sync row; taps still apply", async () => {
    const made = { ...seed('stopped'), sync: 'offline' as const }
    const { game } = spied(made)
    const { sheet } = await openSheet(game, true)
    const line = await within(sheet).findByText(CHECK_IN_WORDS.offline)
    expect(line.closest('a')!.getAttribute('href')).toBe('/town/account?row=sync')
    fireEvent.click(await repeatAllButton(sheet))
    await within(sheet).findByRole('button', { name: /^Repeated/ })
  })

  it("shows the save's refused taps in plain words until dismissed", async () => {
    const made = seed('quiet')
    const base = createMemoryGame(made, () => 0)
    const dismissNotice = vi.fn()
    const snapshot = { ...base.getSnapshot(), notices: [{ id: 'n1', words: { text: 'Needs {n} Prize Money.', data: { n: 90 } }, text: 'Needs 90 Prize Money.' }] }
    renderG2({ pathname: '/farm', search: '?sheet=check-in' }, { ...base, getSnapshot: () => snapshot, dismissNotice })
    const sheet = await screen.findByRole('dialog', { name: 'Check-in' })
    within(sheet).getByText('Needs 90 Prize Money.')
    fireEvent.click(within(sheet).getByRole('button', { name: 'OK' }))
    expect(dismissNotice).toHaveBeenCalledWith('n1')
  })

  it('no sentence on the sheet holds a banned word, the numbers aside', async () => {
    for (const name of ['busy', 'stopped']) {
      const { game } = spied(seed(name))
      const { sheet } = await openSheet(game, true)
      fireEvent.click(await repeatAllButton(sheet))
      await within(sheet).findByRole('button', { name: /^Repeated/ })
      const text = (sheet.textContent ?? '').replace(/[\d,]+/g, '3')
      expect(hasBannedWord(text), text).toBe(false)
      cleanup()
    }
  })
})
