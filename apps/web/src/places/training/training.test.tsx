// @vitest-environment jsdom
// The Training places on screen (docs/game/05-training-hub.md §2, §6–§8; docs/game/06-cards-and-bonds.md §6;
// docs/game/09-racing-rewards-and-exchange.md §5.1; T139), through the real routes and the in-memory port on synthetic
// accounts, its clock held and moved by hand: a three-node session from the sheet, its Collect chip and fill, Recall;
// −30m and "Buy N and finish"; an upgrade's slot at once; the Card Library's Dojo link and Queue; the Extra Stats
// switches over capacity; and a reopen keeping every change.
import { durationText } from '@racer/domain/check-in'
import { craftedItem } from '@racer/domain/items'
import { sessionSeconds } from '@racer/domain/training'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { G2Game } from '../../app/game'
import { createMemoryGame } from '../../dev/memory'
import type { G2Seed } from '../../dev/seed'
import { renderG2, stubStorage } from '../../__fixtures__/testing'
import { advanced, apply, content, farmSeed, granted, MINUTE, trainingAccount, uma, withCommitted, withLayers, withSetCard } from './__fixtures__/training'
import { layerUnlocks } from '@racer/domain/training'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(stubStorage)

function clocked(seed: G2Seed): { game: G2Game; advance: (ms: number) => void } {
  let real = 0
  const game = createMemoryGame(seed, () => real)
  return { game, advance: (ms) => { real += ms } }
}

const state = (game: G2Game) => game.getSnapshot().state!
const name = (outfitId: string) => content.umas.get(outfitId)!.name
const ONE = sessionSeconds(1) * 1000

function reopen(path: string, game: G2Game) {
  cleanup()
  return renderG2(path, game)
}

describe('a session from the sheet (05 §2, §8)', () => {
  it('three nodes take three dishes; two finishes later the Collect chip opens two nodes holding the set card; Recall returns the third dish', async () => {
    const { state: account, at } = trainingAccount(1)
    const preset = account.umas[uma(1)]!.raceDefaults.selectedPreset
    const { state: withCard, cardId } = withSetCard(granted(account, at, { 'dish-vegetables-1': 3 }), uma(1), 'speed', 1, preset, at)
    const { game, advance } = clocked(farmSeed(withCard, at))
    const { where } = renderG2(`/training/observatory?session=${uma(1)}`, game)
    const sheet = await screen.findByRole('dialog', { name: 'Start a session · Observatory' })
    // The fitted pre-pick is one node before the 13:00 check-in; two more take the other dishes.
    expect(within(sheet).getByRole('checkbox', { name: /^Node 1,/ }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(within(sheet).getByRole('checkbox', { name: /^Node 2,/ }))
    fireEvent.click(within(sheet).getByRole('checkbox', { name: /^Node 3,/ }))
    within(sheet).getByText('Reserves 3 Carrot Salad')
    // Each finish reads how long until it lands (D366), never its clock time.
    within(sheet).getByText(`Node 3 · in ${durationText(3 * ONE)}`)
    fireEvent.click(within(sheet).getByRole('button', { name: 'Start' }))
    await waitFor(() => expect(where()).toBe('/training/observatory'))
    expect(state(game).items['dish-vegetables-1'] ?? 0).toBe(0)
    await screen.findByRole('article', { name: `${name(uma(1))}. Node 1 · Carrot Salad, 0 of 3 made, ${durationText(3 * ONE)} left` })

    advance(2 * ONE + MINUTE)
    reopen(`/training/observatory/${uma(1)}`, game)
    fireEvent.click(await screen.findByRole('button', { name: '2 unlocks finished' }))
    await waitFor(() => expect(state(game).umas[uma(1)]!.build.constellationOpened).toBe(2))
    expect(state(game).umas[uma(1)]!.build.presets[preset].assignments).toEqual({ n1: cardId, n2: cardId })

    reopen('/training/observatory', game)
    const card = await screen.findByRole('article', { name: new RegExp(`^${name(uma(1))}\\. Node 3 · Carrot Salad, 2 of 3 made`) })
    fireEvent.click(within(card).getByRole('button', { name: `More for ${name(uma(1))}: Queue next and Recall` }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: `${name(uma(1))} · Node 3 · Carrot Salad ×3` })).getByRole('button', { name: 'Recall' }))
    const recall = await screen.findByRole('dialog', { name: `Recall ${name(uma(1))}` })
    within(recall).getByText('1 Carrot Salad comes back')
    fireEvent.click(within(recall).getByRole('button', { name: 'Recall' }))
    await waitFor(() => expect(state(game).items['dish-vegetables-1']).toBe(1))
    expect(state(game).umas[uma(1)]!.build.constellationOpened).toBe(2)
  })
})

describe('Speed Tickets on a session (09 §5.1)', () => {
  it('−30m spends one ticket and takes 30 minutes off the time left; Finish with too few asks to buy, then buys and finishes', async () => {
    const { state: account, at } = trainingAccount(1)
    const stocked = granted(account, at, { 'dish-vegetables-1': 2, 'speed-ticket': 1 }, 5_000)
    const her = stocked.umas[uma(1)]!
    const started = apply(stocked, 'start', {
      outfitId: uma(1), slot: { building: 'observatory', slot: 0 },
      request: { kind: 'session', unlocks: layerUnlocks(1).slice(0, 2).map((entry) => ({ kind: entry.kind, target: entry.target })) },
    }, at).state
    expect(her.build.constellationOpened).toBe(0)
    const { game } = clocked(farmSeed(started, at))
    renderG2('/training/observatory', game)
    const card = await screen.findByRole('article', { name: new RegExp(`, ${durationText(2 * ONE)} left$`) })
    fireEvent.click(within(card).getByRole('button', { name: /^Speed Tickets for / }))
    const speed = await screen.findByRole('dialog', { name: /^Speed up / })
    fireEvent.click(within(speed).getByRole('button', { name: 'Take 30 minutes off with one Speed Ticket' }))
    await waitFor(() => expect(state(game).work[uma(1)]!.entries[0]!.acceleratedMs).toBe(30 * MINUTE))
    await screen.findByRole('article', { name: new RegExp(`, ${durationText(2 * ONE - 30 * MINUTE)} left$`) })
    expect(state(game).items['speed-ticket'] ?? 0).toBe(0)

    const left = 2 * ONE - 30 * MINUTE
    const buy = Math.ceil(left / (30 * MINUTE))
    fireEvent.click(await within(speed).findByRole('button', { name: new RegExp(`^Buy ${buy} and finish · `) }))
    fireEvent.click(within(speed).getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(state(game).work[uma(1)]!.entries[0]!.acceleratedMs).toBe(2 * ONE))
    expect(state(game).items['speed-ticket'] ?? 0).toBe(0)
    await screen.findByRole('button', { name: /^Collect 2 / })
  })
})

describe('upgrades (05 §7)', () => {
  it('upgrading the Observatory with its price in hand shows three slots at once', async () => {
    const { state: account, at } = trainingAccount(1)
    const paid = granted(account, at, { [craftedItem('vegetables', 1).id]: 4 }, 1_200)
    const { game } = clocked(farmSeed(paid, at))
    renderG2('/training/observatory', game)
    await screen.findByText('Lv 1 · 0 of 2 slots in use')
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Lv 2 for 1,200 Prize Money' }))
    const sheet = await screen.findByRole('dialog', { name: 'Upgrade to Lv 2' })
    within(sheet).getByText('3 slots at Lv 2')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(document.querySelectorAll('[data-slot-card]')).toHaveLength(3))
    screen.getByText('The Observatory is Lv 2 now.')
  })
})

describe("the Card Library's Bond link (06 §6)", () => {
  it('opens the Dojo sheet with her, the room and the card; Start returns to `back`', async () => {
    const { state: account, at } = trainingAccount(1)
    const stocked = granted(account, at, { 'dish-sweets-1': 1 })
    const { game } = clocked(farmSeed(stocked, at))
    const back = '/town/card-library/card/sim-card-speed-e1'
    const { where } = renderG2(`/training/dojo?session=${uma(1)}&room=speed&unlocks=bond:sim-card-speed-e1&back=${encodeURIComponent(back)}`, game)
    const sheet = await screen.findByRole('dialog', { name: 'Start a session · Dojo' })
    expect(sheet.querySelector('[data-chosen-uma]')?.getAttribute('data-chosen-uma')).toBe(uma(1))
    expect(within(sheet).getByRole('radio', { name: 'Speed' }).getAttribute('aria-checked')).toBe('true')
    const bond = within(sheet).getByRole('checkbox', { name: new RegExp(`^${content.cards.get('sim-card-speed-e1')!.charName}`) })
    expect(bond.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Start' }))
    await waitFor(() => expect(where()).toBe(back))
    expect(state(game).work[uma(1)]!.entries[0]!.request).toEqual({ kind: 'session', unlocks: [{ kind: 'bond', target: 'sim-card-speed-e1' }] })
    expect(state(game).items['dish-sweets-1'] ?? 0).toBe(0)
  })

  it('with `queue=1` for her running bond session in that room, opens on Add to queue', async () => {
    const { state: account, at } = trainingAccount(1)
    // In scenario 2 an era-2 Speed card can bond too (06 §2), with a grade-3 dish.
    const stocked = granted(advanced(account, uma(1), at), at, { 'dish-sweets-1': 1, 'dish-sweets-3': 1 })
    const started = apply(stocked, 'start', {
      outfitId: uma(1), slot: { building: 'dojo', room: 'speed', slot: 0 }, request: { kind: 'session', unlocks: [{ kind: 'bond', target: 'sim-card-speed-e1' }] },
    }, at).state
    const { game } = clocked(farmSeed(started, at))
    renderG2(`/training/dojo?session=${uma(1)}&room=speed&unlocks=bond:sim-card-speed-e2&queue=1&back=%2Ftown%2Fcard-library`, game)
    const sheet = await screen.findByRole('dialog', { name: 'Queue a session · Dojo' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add to queue' }))
    await waitFor(() => expect(state(game).work[uma(1)]!.queue).toEqual([{ kind: 'session', unlocks: [{ kind: 'bond', target: 'sim-card-speed-e2' }] }]))
  })
})

describe('the Extra Stats map (05 §6)', () => {
  it('over capacity a switch reads the rule\'s words; switching one off and another on works, and a reopen keeps it', async () => {
    const { state: account, at } = trainingAccount(1)
    const two = withLayers(advanced(account, uma(1), at), uma(1), [1])
    const opened = withCommitted(two, uma(1), layerUnlocks(2).filter((entry) => entry.kind === 'single' || entry.kind === 'duo'))
    const preset = opened.umas[uma(1)]!.raceDefaults.selectedPreset
    const active = opened.umas[uma(1)]!.build.presets[preset].activeExtraNodes
    expect(active).toHaveLength(9)
    const { game } = clocked(farmSeed(opened, at))
    renderG2(`/training/gym/${uma(1)}`, game)
    await screen.findByText('9 of 9 on')
    const off = screen.getAllByRole('switch').find((entry) => entry.getAttribute('aria-checked') === 'false')!
    fireEvent.click(off)
    await screen.findByText('Only 9 Extra Stats can be on at once.')
    const on = screen.getByRole('switch', { name: /^Stamina grade 1, \+40, on$/ })
    fireEvent.click(on)
    await waitFor(() => expect(state(game).umas[uma(1)]!.build.presets[preset].activeExtraNodes).not.toContain('stamina-01'))
    fireEvent.click(screen.getByRole('switch', { name: off.getAttribute('aria-label')! }))
    await waitFor(() => expect(state(game).umas[uma(1)]!.build.presets[preset].activeExtraNodes).toHaveLength(9))
    reopen(`/training/gym/${uma(1)}`, game)
    expect((await screen.findByRole('switch', { name: /^Stamina grade 1, \+40, off$/ })).getAttribute('aria-checked')).toBe('false')
    screen.getByText('9 of 9 on')
  })
})
