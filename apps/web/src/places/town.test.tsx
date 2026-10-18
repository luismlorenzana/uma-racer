// @vitest-environment jsdom
// The Town Hall's places on screen (T138): the real routes over the in-memory port on the dev seeds, and T136's device
// save over fake IndexedDB for a reload. A new account unlocks from the Locked tab into the reveal and the profile, three
// at once, and turns five Shards into a ticket; a dish sells only after its question, reserved stock is never offered,
// and a stale price reads "Price changed."; Speed Tickets move Prize Money and the Tickets shelf; Bond goes on to the
// Dojo session, and its picker offers no saved views; a card's page clears its NEW mark; Feature another Uma changes the
// plaza; Account's dev section runs `dev-grant`; and an offline phone and a reload keep every change.
import 'fake-indexeddb/auto'
import { SPEED_TICKET_PRICE } from '@racer/domain/economy'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { G2Game } from '../app/game'
import { createSaveApi } from '../save/api'
import { createSaveGame } from '../save/index'
import { FakeServer, fakeSignals, freshDb, memoryStorage, nextId, noWipe, ENV as SAVE_ENV } from '../save/__fixtures__/server'
import { renderG2, seedGame, stubStorage } from '../__fixtures__/testing'
import { ALBUM_KEY_PREFIX } from '../ui/albumPrefs'
import { setReducedMotion } from '../ui/devicePrefs'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(stubStorage)

const ticketsOf = (game: G2Game) => game.getSnapshot().state!.profile.umaTickets
const click = (element: Element) => fireEvent.click(element)
/** A stack's row on uma-kit's shelves, or a good's row in its buy rows (SD4): the kit marks each with its id. */
const itemRow = (itemId: string) => document.querySelector(`[data-kit="shelf-rows"] [data-item="${itemId}"]`) as HTMLElement | null
const need = (element: HTMLElement | null): HTMLElement => {
  if (element === null) throw new Error('Not on screen yet')
  return element
}
const exchangeRow = (key: string) => {
  const row = document.querySelector(`[data-kit="exchange-rows"] [data-row="${key}"]`) as HTMLElement | null
  if (row === null) throw new Error(`No Exchange row ${key}`)
  return row
}

async function freshWith(umas: number, extra?: (game: G2Game) => Promise<void>): Promise<G2Game> {
  const game = seedGame('fresh')
  for (let i = 1; i <= umas; i += 1) expect((await game.run('unlock-uma', { outfitId: `sim-uma-${String(i).padStart(2, '0')}` })).kind).toBe('done')
  await extra?.(game)
  return game
}

describe('the Stable (04 §6, 11 §2.4, §6)', () => {
  it('opens a new account on the Locked tab with 20 tickets; Unlock leaves 19, reveals her, then opens her profile', async () => {
    const game = seedGame('fresh')
    const { where } = renderG2('/', game)
    await waitFor(() => expect(where()).toBe('/town/stable?tab=locked'))
    expect((await screen.findByText(/^Uma Tickets 20 · 0\/5$/)).textContent).toBe('Uma Tickets 20 · 0/5')
    click(await screen.findByRole('button', { name: 'Amber Sprint, locked' }))
    const sheet = await screen.findByRole('dialog', { name: 'Unlock Amber Sprint?' })
    expect(within(sheet).getByLabelText('Uma Tickets: 20 to 19')).toBeTruthy()
    click(within(sheet).getByRole('button', { name: 'Unlock for 1 Ticket' }))
    await waitFor(() => expect(where()).toBe('/collection/reveal/uma/sim-uma-01'))
    expect(ticketsOf(game)).toBe(19)
    expect(await screen.findByText('T1 · URA Finale · Racing Lv 1 · Farm Lv 1')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /^Next/ })).toBeNull()
    click(screen.getByRole('link', { name: 'Open profile' }))
    await waitFor(() => expect(where()).toBe('/town/stable/outfit/sim-uma-01'))
    expect(await screen.findByRole('heading', { name: 'Amber Sprint' })).toBeTruthy()
  })

  it('unlocks three at once from the Locked tab, leaving 17, and reveals them in turn', async () => {
    const game = seedGame('fresh')
    const { where } = renderG2('/town/stable?tab=locked', game)
    click(await screen.findByRole('button', { name: 'Select' }))
    for (const name of ['Amber Sprint', 'Bluebell Dash', 'Cinder Gale']) click(screen.getByRole('button', { name: `${name}, locked` }))
    click(screen.getByRole('button', { name: 'Unlock 3 · 3 Uma Tickets' }))
    await waitFor(() => expect(where()).toBe('/collection/reveal/uma/sim-uma-01?then=sim-uma-02%2Csim-uma-03&of=3'))
    expect(ticketsOf(game)).toBe(17)
    click(await screen.findByRole('link', { name: 'Next (2 of 3)' }))
    await waitFor(() => expect(where()).toBe('/collection/reveal/uma/sim-uma-02?then=sim-uma-03&of=3'))
    click(await screen.findByRole('link', { name: 'Skip all' }))
    await waitFor(() => expect(where()).toBe('/town/stable?tab=owned'))
  })

  it("clears her NEW mark on her profile, and only hers", async () => {
    const game = await freshWith(3)
    // A phone that has opened the Stable before and hasn't seen these three since they arrived.
    localStorage.setItem(`${ALBUM_KEY_PREFIX}stable`, JSON.stringify({ seen: [] }))
    const tile = (umaId: string) => document.querySelector(`[data-uma="${umaId}"]`) as HTMLElement | null
    const first = renderG2('/town/stable?tab=owned', game)
    await waitFor(() => expect(tile('sim-uma-01')).not.toBeNull())
    for (const umaId of ['sim-uma-01', 'sim-uma-02', 'sim-uma-03']) expect(within(tile(umaId)!).queryByText('NEW'), umaId).not.toBeNull()
    click(tile('sim-uma-01')!)
    expect(await screen.findByRole('heading', { name: 'Amber Sprint' })).toBeTruthy()
    first.unmount()
    renderG2('/town/stable?tab=owned', game)
    await waitFor(() => expect(tile('sim-uma-01')).not.toBeNull())
    expect(within(tile('sim-uma-01')!).queryByText('NEW')).toBeNull()
    for (const umaId of ['sim-uma-02', 'sim-uma-03']) expect(within(tile(umaId)!).queryByText('NEW'), umaId).not.toBeNull()
  })

  it('takes every owned Uma as seen when a phone opens a profile before the Stable, as the Stable would', async () => {
    const game = await freshWith(3)
    const { unmount } = renderG2('/town/stable/outfit/sim-uma-01', game)
    expect(await screen.findByRole('heading', { name: 'Amber Sprint' })).toBeTruthy()
    await waitFor(() => expect(localStorage.getItem(`${ALBUM_KEY_PREFIX}stable`)).toContain('sim-uma-03'))
    unmount()
    renderG2('/town/stable?tab=owned', game)
    await waitFor(() => expect(document.querySelectorAll('[data-uma]').length).toBe(3))
    expect(screen.queryByText('NEW')).toBeNull()
  })

  it("drops the reveal's flip under Account's reduced motion", async () => {
    const game = await freshWith(1)
    const { unmount } = renderG2('/collection/reveal/uma/sim-uma-01', game)
    expect((await screen.findByText('New Uma')).closest('[data-flip]')).not.toBeNull()
    unmount()
    act(() => setReducedMotion(true))
    renderG2('/collection/reveal/uma/sim-uma-01', game)
    expect((await screen.findByText('New Uma')).closest('[data-flip]')).toBeNull()
    act(() => setReducedMotion(false))
  })

  it('shows Exchange at five Shards, and one tap makes one ticket', async () => {
    const game = await freshWith(5, async (g) => {
      for (let i = 1; i <= 5; i += 1) expect((await g.run('dev-grant', { gate: `sim-uma-0${i}` })).kind).toBe('done')
    })
    expect(game.getSnapshot().state!.profile.umaShards).toBe(5)
    renderG2('/town/stable', game)
    click(await screen.findByRole('button', { name: 'Exchange' }))
    await waitFor(() => expect(ticketsOf(game)).toBe(16))
    expect(game.getSnapshot().state!.profile.umaShards).toBe(0)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Exchange' })).toBeNull())
  })
})

describe('the Warehouse (09 §6.1)', () => {
  it('sells a dish only after its question', async () => {
    const game = await freshWith(1, async (g) => void (await g.run('dev-grant', { items: { 'dish-sweets-3': 2 } })))
    renderG2('/town/warehouse', game)
    click(await screen.findByRole('tab', { name: 'Dishes' }))
    click(await waitFor(() => need(itemRow('dish-sweets-3'))))
    const sheet = await screen.findByRole('dialog', { name: 'Sugar Beet Cake' })
    expect(within(sheet).getByText('Sugar Beet Cake · Speed · grade 3')).toBeTruthy()
    click(within(sheet).getByRole('button', { name: /^×1/ }))
    const question = await screen.findByRole('dialog', { name: 'Sell' })
    expect(within(question).getByText('Sell 1 Sugar Beet Cake (grade 3) for 349? Each took about 17 hours of work.')).toBeTruthy()
    expect(game.getSnapshot().state!.items['dish-sweets-3']).toBe(2)
    click(within(question).getByRole('button', { name: 'Sell' }))
    await waitFor(() => expect(game.getSnapshot().state!.items['dish-sweets-3']).toBe(1))
    expect(game.getSnapshot().state!.profile.prizeMoney).toBe(349)
    expect(await screen.findByText('Sold 1 for 349.')).toBeTruthy()
  })

  it('never offers reserved stock, and a stale price reads "Price changed."', async () => {
    const game = await freshWith(1, async (g) => {
      await g.run('dev-grant', { items: { 'chopped-carrot': 4, 'wheat-flour': 1, 'beet-sugar': 3 } })
      await g.run('start', { outfitId: 'sim-uma-01', slot: { building: 'kitchen', slot: 0 }, request: { kind: 'cook', item: 'dish-vegetables-1', count: 1 } })
    })
    // A port whose price moved since the screen read it: the rule refuses, the screen says so.
    const stale: G2Game = {
      ...game,
      subscribe: game.subscribe.bind(game),
      getSnapshot: game.getSnapshot.bind(game),
      run: (async (name: string, input: unknown, key?: string) => (name === 'sell'
        ? { kind: 'say', words: { text: 'Price changed.' }, id: 'stale' }
        : game.run(name as 'sell', input as never, key))) as G2Game['run'],
    }
    renderG2('/town/warehouse', stale)
    click(await screen.findByRole('tab', { name: 'Crafted' }))
    // The Chopped Carrot went into the Kitchen's job: none is held, so it isn't on the shelf to sell.
    click(await waitFor(() => need(itemRow('beet-sugar'))))
    expect(itemRow('chopped-carrot')).toBeNull()
    const sugar = await screen.findByRole('dialog', { name: 'Beet Sugar' })
    click(within(sugar).getByRole('button', { name: /^×1/ }))
    expect(await within(sugar).findByText('Price changed.')).toBeTruthy()
    expect(game.getSnapshot().state!.items['beet-sugar']).toBe(3)
  })
})

describe('the Exchange (09 §5.5)', () => {
  it('buys 10 Speed Tickets: Prize Money falls by 10 × SPEED_TICKET_PRICE and the Tickets shelf rises by 10', async () => {
    const game = await freshWith(0, async (g) => void (await g.run('dev-grant', { prizeMoney: 1_000 })))
    const { unmount } = renderG2('/town/exchange?row=speed-tickets', game)
    click(await waitFor(() => exchangeRow('speed-ticket')))
    const sheet = await screen.findByRole('dialog', { name: 'Buy Speed Ticket' })
    click(within(sheet).getByRole('button', { name: '×10' }))
    click(within(sheet).getByRole('button', { name: /^Buy 10/ }))
    await waitFor(() => expect(game.getSnapshot().state!.profile.prizeMoney).toBe(1_000 - 10 * SPEED_TICKET_PRICE))
    expect(game.getSnapshot().state!.items['speed-ticket']).toBe(10)
    // The open sheet reads the new count, not the one it opened with.
    await waitFor(() => expect(within(sheet).getByText(/^10 held/)).toBeTruthy())
    unmount()
    renderG2('/town/warehouse', game)
    click(await screen.findByRole('tab', { name: 'Tickets' }))
    expect((await waitFor(() => need(itemRow('speed-ticket')))).textContent).toContain('10')
  })

  it('keeps Buy off with "Need N more" when Prize Money is short', async () => {
    const game = await freshWith(0, async (g) => void (await g.run('dev-grant', { prizeMoney: 100 })))
    renderG2('/town/exchange', game)
    click(await waitFor(() => exchangeRow('speed-ticket')))
    const sheet = await screen.findByRole('dialog', { name: 'Buy Speed Ticket' })
    click(within(sheet).getByRole('button', { name: '×10' }))
    expect((within(sheet).getByRole('button', { name: /^Buy 10/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(within(sheet).getByText('Need 200 more')).toBeTruthy()
  })
})

describe('the Card Library and the featured Uma (06 §6, 11 §5)', () => {
  it('Bond on a card page goes on to the Dojo session with her, the card, its room and the way back', async () => {
    const game = await freshWith(1)
    const { where } = renderG2('/town/card-library/card/sim-card-speed-e1', game)
    click(await screen.findByRole('button', { name: 'Bond' }))
    const picker = await screen.findByRole('dialog', { name: /^Bond / })
    click(await within(picker).findByRole('button', { name: /^Amber Sprint/ }))
    await waitFor(() => expect(where()).toBe(
      `/training/dojo?session=sim-uma-01&room=speed&unlocks=bond%3Asim-card-speed-e1&back=${encodeURIComponent('/town/card-library/card/sim-card-speed-e1')}`,
    ))
  })

  it("clears a card's NEW mark once its page opens", async () => {
    const game = await freshWith(1)
    // A phone that has opened the Library before and hasn't seen any card since: every card reads NEW.
    localStorage.setItem(`${ALBUM_KEY_PREFIX}card-library`, JSON.stringify({ seen: [] }))
    const tile = (cardId: string) => document.querySelector(`[data-card="${cardId}"]`) as HTMLElement | null
    const first = renderG2('/town/card-library', game)
    await waitFor(() => expect(tile('sim-card-speed-e1')).not.toBeNull())
    expect(within(tile('sim-card-speed-e1')!).queryByText('NEW')).not.toBeNull()
    click(tile('sim-card-speed-e1')!)
    await waitFor(() => expect(first.where()).toBe('/town/card-library/card/sim-card-speed-e1'))
    await screen.findByRole('button', { name: 'Bond' })
    first.unmount()
    renderG2('/town/card-library', game)
    await waitFor(() => expect(tile('sim-card-speed-e1')).not.toBeNull())
    expect(within(tile('sim-card-speed-e1')!).queryByText('NEW')).toBeNull()
    // Only the card that was opened.
    const others = [...document.querySelectorAll<HTMLElement>('[data-card]')].filter((element) => element.dataset.card !== 'sim-card-speed-e1')
    expect(others.length).toBeGreaterThan(0)
    for (const other of others) expect(within(other).queryByText('NEW'), other.dataset.card).not.toBeNull()
  })

  it('takes every card as seen when a phone opens a card page before the Library, as the Library would', async () => {
    const game = await freshWith(1)
    const { unmount } = renderG2('/town/card-library/card/sim-card-speed-e1', game)
    await screen.findByRole('button', { name: 'Bond' })
    await waitFor(() => expect(localStorage.getItem(`${ALBUM_KEY_PREFIX}card-library`)).toContain('sim-card-speed-e1'))
    unmount()
    renderG2('/town/card-library', game)
    await waitFor(() => expect(document.querySelectorAll('[data-card]').length).toBeGreaterThan(1))
    expect(screen.queryByText('NEW')).toBeNull()
  })

  it("keeps saved views to the albums that keep them: the Library offers them, the Uma picker doesn't", async () => {
    const game = await freshWith(1)
    const { unmount } = renderG2('/town/card-library', game)
    click(await screen.findByRole('button', { name: 'Filters' }))
    expect(await screen.findByRole('button', { name: 'Saved views' })).toBeTruthy()
    unmount()
    renderG2('/town/card-library/card/sim-card-speed-e1', game)
    click(await screen.findByRole('button', { name: 'Bond' }))
    const picker = await screen.findByRole('dialog', { name: /^Bond / })
    click(within(picker).getByRole('button', { name: 'Filters' }))
    await screen.findByRole('button', { name: /^Show / })
    expect(screen.queryByRole('button', { name: /^Saved views/ })).toBeNull()
    expect(screen.queryByText('Quick picks')).toBeNull()
  })

  it('Feature another Uma changes the featured card', async () => {
    const game = await freshWith(2)
    renderG2('/town?sheet=featured', game)
    click(await screen.findByRole('button', { name: 'Feature another Uma' }))
    const picker = await screen.findByRole('dialog', { name: 'Feature an Uma' })
    click(await within(picker).findByRole('button', { name: /^Bluebell Dash/ }))
    await waitFor(() => expect(game.getSnapshot().state!.profile.featuredUmaId).toBe('sim-uma-02'))
    expect(await screen.findByRole('link', { name: 'Featured Uma: Bluebell Dash' })).toBeTruthy()
  })
})

describe('Account (02 §3, M034)', () => {
  it("changes a check-in time, and the dev section's grants run on a dev seed", async () => {
    const game = await freshWith(1)
    renderG2('/town/account', game)
    const first = await screen.findByLabelText('Check-in 1')
    fireEvent.change(first, { target: { value: '07:30' } })
    click(screen.getByRole('button', { name: 'Save times' }))
    await waitFor(() => expect(game.getSnapshot().state!.profile.checkIns).toEqual([450, 780, 1_350]))
    click(screen.getByRole('button', { name: '+5,000 Prize Money' }))
    await waitFor(() => expect(game.getSnapshot().state!.profile.prizeMoney).toBe(5_000))
    click(screen.getByRole('button', { name: 'Jump to her gate' }))
    await waitFor(() => expect(game.getSnapshot().state!.umas['sim-uma-01']!.racing.level).toBe(10))
    expect(game.getSnapshot().state!.ledger.filter((row) => row.reason === 'dev-grant')).toHaveLength(1)
  })
})

describe("Account's trainer name (SD4)", () => {
  it('saves a new name on the trainer badge row', async () => {
    const game = await freshWith(1)
    renderG2('/town/account', game)
    const field = await screen.findByRole('textbox', { name: 'Trainer name' })
    fireEvent.change(field, { target: { value: '  Invented   Trainer ' } })
    click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(game.getSnapshot().badges?.['trainer']).toMatchObject({ scope: 'trainer', preferences: { displayName: 'Invented Trainer' } }))
    expect(await screen.findByText('Saved.')).toBeTruthy()
  })
})

describe('Appearance (T147)', () => {
  it('offers System, Light and Dark on this phone, System first, and puts the choice on the page at once', async () => {
    renderG2('/town/account', seedGame('busy'))
    const group = await screen.findByRole('tablist', { name: 'Appearance' })
    const chips = within(group).getAllByRole('tab')
    expect(chips.map((chip) => [chip.textContent, chip.getAttribute('aria-selected')])).toEqual([['System', 'true'], ['Light', 'false'], ['Dark', 'false']])
    click(within(group).getByRole('tab', { name: 'Dark' }))
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('dark'))
    expect(localStorage.getItem('uma-racer:g2:appearance')).toBe('dark')
    expect(within(group).getByRole('tab', { name: 'Dark' }).getAttribute('aria-selected')).toBe('true')
    click(within(group).getByRole('tab', { name: 'System' }))
    await waitFor(() => expect(document.documentElement.hasAttribute('data-theme')).toBe(false))
    expect(localStorage.getItem('uma-racer:g2:appearance')).toBeNull()
  })
})

describe('offline and after a reload (02 §9)', () => {
  it('applies every tap offline, as it does online', async () => {
    const game = seedGame('fresh', { sync: 'offline' })
    renderG2('/town/stable?tab=locked', game)
    click(await screen.findByRole('button', { name: 'Amber Sprint, locked' }))
    click(within(await screen.findByRole('dialog', { name: 'Unlock Amber Sprint?' })).getByRole('button', { name: 'Unlock for 1 Ticket' }))
    await waitFor(() => expect(ticketsOf(game)).toBe(19))
    expect(await screen.findByText("Saved on this phone. It'll sync when you're back online.")).toBeTruthy()
  })

  it('keeps an unlock and a featured Uma through a reload of the device save', async () => {
    const server = new FakeServer()
    const db = freshDb()
    const storage = memoryStorage()
    const boot = () => createSaveGame({
      env: SAVE_ENV, wipe: false, purge: false, wipeDeps: noWipe, newId: nextId, db, storage, signals: fakeSignals().signals,
      api: createSaveApi({ fetch: server.fetch as unknown as typeof fetch, base: '', token: async () => 't' }),
    })
    const first = boot()
    await first.session.opened
    const { unmount, where } = renderG2('/town/stable?tab=locked', first)
    const name = SAVE_ENV.content.umas.get('sim-uma-02')!.name
    click(await screen.findByRole('button', { name: `${name}, locked` }))
    click(within(await screen.findByRole('dialog', { name: `Unlock ${name}?` })).getByRole('button', { name: 'Unlock for 1 Ticket' }))
    await waitFor(() => expect(where()).toBe('/collection/reveal/uma/sim-uma-02'))
    await act(async () => {
      await first.session.lane.idle()
    })
    unmount()
    first.stop()

    const again = boot()
    await again.session.opened
    await waitFor(() => expect(again.getSnapshot().status).toBe('ready'))
    expect(Object.keys(again.getSnapshot().state!.umas)).toEqual(['sim-uma-02'])
    expect(again.getSnapshot().state!.profile).toMatchObject({ umaTickets: 19, featuredUmaId: 'sim-uma-02' })
    renderG2('/town/stable', again)
    expect(await screen.findByRole('link', { name: `${name}, T1 · Lv 1, new` })).toBeTruthy()
    again.stop()
  })
})
