// @vitest-environment jsdom
// The Scenario Gate's ceremony on T136's real device save (fake IndexedDB, and the fake server running the server's own
// rules), not the in-memory port: the save never folds a confirmed tap's `operations` row into the state, so the
// ceremony reads it through the port's logs. Advance plays its ceremony while the tap is queued and after the server
// confirms it, a reload of the ceremony reads the confirmed row, and each leaves for her profile; Promote takes the same
// path; a ceremony whose tap the device can't find still offers its way out and leaves. The Advance sheet takes a sync's
// equal copy of her as no change, so Advance works on the first tap, and still redraws first after a real change.
import 'fake-indexeddb/auto'
import { initialSave, sameData, type SaveState } from '@racer/domain/save'
import { devGrant, OPERATIONS } from '@racer/domain/check-in'
import { isRefusal, type OpResult } from '@racer/domain/state'
import { EXPEDITION_WINS, isLastScenario, recordExpeditionRace } from '@racer/domain/tiers'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSaveApi } from '../../save/api'
import { createSaveGame, type SaveGame } from '../../save/index'
import { ENV, FakeServer, fakeSignals, freshDb, memoryStorage, nextId, noWipe, umaId } from '../../save/__fixtures__/server'
import { renderG2, stubStorage } from '../../__fixtures__/testing'

const UMA = umaId(1)
const PROFILE = `/town/stable/outfit/${UMA}`
const games: SaveGame[] = []

beforeEach(() => {
  stubStorage()
  // The ceremony's leave timer moves with the test; real time still passes, for the save's own work and `waitFor`.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
})
afterEach(() => {
  cleanup()
  for (const game of games.splice(0)) game.stop()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function deviceOn(server: FakeServer): Promise<SaveGame> {
  const game = createSaveGame({
    env: ENV, wipe: false, purge: false, wipeDeps: noWipe, newId: nextId, db: freshDb(), storage: memoryStorage(), signals: fakeSignals().signals,
    api: createSaveApi({ fetch: server.fetch as unknown as typeof fetch, base: '', token: async () => 't' }),
  })
  games.push(game)
  await game.session.opened
  await waitFor(() => expect(game.getSnapshot().status).toBe('ready'))
  return game
}

/** The element `selector` names, once it has rendered. */
const rendered = <T extends Element>(selector: string) => waitFor(() => {
  const element = document.querySelector<T>(selector)
  expect(element).not.toBeNull()
  return element!
})

/** Sync now (a flush and a pull, as Account's button runs it) has finished: every queued tap is confirmed. */
const synced = (game: SaveGame) => act(async () => {
  await game.syncNow!()
  await game.session.lane.idle()
})

/** The ceremony's leave timer, at its longest (6 s), has passed. */
const timerPassed = () => act(async () => { await vi.advanceTimersByTimeAsync(6_100) })

function done<S extends SaveState>(result: OpResult<unknown, S>): S {
  if (isRefusal(result)) throw new Error(`Refused: ${result.code}`)
  return result.state
}

/** Her tier's every scenario left, then the stand-in Expedition's eight wins: ready to promote (04 §3), as the promote seed builds it. */
function promoteReady(at: number): SaveState {
  let state: SaveState = done(OPERATIONS['unlock-uma'](initialSave(at).state, { outfitId: UMA }, at, ENV))
  for (let step = 0; !isLastScenario(state.umas[UMA]!); step += 1) {
    state = done(devGrant(state, { gate: UMA }, at, ENV, `held-gate-${step}`))
    state = done(OPERATIONS['advance-scenario'](state, { umaId: UMA }, at, ENV))
  }
  state = done(devGrant(state, { gate: UMA }, at, ENV, 'held-gate-last'))
  for (let win = 0; win < EXPEDITION_WINS; win += 1) state = done(recordExpeditionRace(state, { umaId: UMA, expeditionId: 'dev-stand-in', won: true }, at))
  return state
}

/** A device with her unlocked and at her gate, every tap confirmed, on the Advance sheet. */
async function onAdvanceSheet() {
  const game = await deviceOn(new FakeServer())
  for (const [name, input] of [['unlock-uma', { outfitId: UMA }], ['dev-grant', { gate: UMA }]] as const) {
    expect((await game.run(name, input as never)).kind).toBe('done')
  }
  await synced(game)
  const view = renderG2(`/racing/scenario-gate/${UMA}?sheet=advance`, game)
  const button = await rendered<HTMLButtonElement>('[data-advance]')
  return { game, view, button }
}

const CEREMONY = new RegExp(`^/racing/scenario-gate/${UMA}/ceremony\\?op=`)

describe('the Advance sheet after a sync (03 §10.8)', () => {
  it('advances on the first tap when a sync hands the store an equal copy of her', async () => {
    const { game, view, button } = await onAdvanceSheet()
    const before = game.getSnapshot().state!.umas[UMA]!
    await synced(game)
    const after = game.getSnapshot().state!.umas[UMA]!
    // A pull folds her afresh: another object, the same data.
    expect(after).not.toBe(before)
    expect(sameData(after, before)).toBe(true)
    fireEvent.click(button)
    await waitFor(() => expect(view.where()).toMatch(CEREMONY))
    expect(screen.queryByText('Her build changed.')).toBeNull()
  })

  it('still redraws under "Her build changed." after a real change, and advances on the next tap', async () => {
    const { game, view, button } = await onAdvanceSheet()
    const preset = game.getSnapshot().state!.umas[UMA]!.raceDefaults.selectedPreset === 'sprint' ? 'mile' : 'sprint'
    await act(async () => { await game.run('set-race-defaults', { umaId: UMA, selectedPreset: preset }) })
    fireEvent.click(button)
    expect(await screen.findByText('Her build changed.')).toBeTruthy()
    expect(view.where()).toBe(`/racing/scenario-gate/${UMA}?sheet=advance`)
    fireEvent.click(button)
    await waitFor(() => expect(view.where()).toMatch(CEREMONY))
  })
})

describe("the ceremony on the device save (03 §5, 04 §9)", () => {
  it('plays after Advance while queued and once confirmed, then leaves for her profile; a reload reads the confirmed tap', async () => {
    const game = await deviceOn(new FakeServer())
    for (const [name, input] of [['unlock-uma', { outfitId: UMA }], ['dev-grant', { gate: UMA }]] as const) {
      expect((await game.run(name, input as never)).kind).toBe('done')
    }
    await synced(game)
    const first = renderG2(`/racing/scenario-gate/${UMA}?sheet=advance`, game)
    fireEvent.click(await rendered<HTMLButtonElement>('[data-advance]'))
    await waitFor(() => expect(first.where()).toMatch(new RegExp(`^/racing/scenario-gate/${UMA}/ceremony\\?op=`)))
    const ceremony = first.where()
    expect(await screen.findByRole('heading', { name: 'URA Finale Graduate' })).toBeTruthy()
    // The server confirms the tap: the state no longer holds its operations row, and the ceremony stays.
    await synced(game)
    expect(game.getSnapshot().state!.operations).toBeUndefined()
    expect(screen.getByRole('heading', { name: 'URA Finale Graduate' })).toBeTruthy()
    await timerPassed()
    await waitFor(() => expect(first.where()).toBe(PROFILE))
    first.unmount()

    const again = renderG2(ceremony, game)
    expect(await screen.findByRole('heading', { name: 'URA Finale Graduate' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open her profile' })).toBeTruthy()
    await timerPassed()
    await waitFor(() => expect(again.where()).toBe(PROFILE))
  })

  it('plays after Promote and leaves for her profile', async () => {
    const server = new FakeServer()
    server.holdAccount(promoteReady(Date.now() - 60_000), Date.now() - 60_000)
    const game = await deviceOn(server)
    expect(game.getSnapshot().state!.umas[UMA]!.tier).toBe(1)
    const view = renderG2(`/racing/scenario-gate/${UMA}?sheet=promote`, game)
    const promote = await waitFor(() => {
      const button = document.querySelector<HTMLButtonElement>('[data-promote]')
      expect(button?.disabled).toBe(false)
      return button!
    })
    fireEvent.click(promote)
    await waitFor(() => expect(view.where()).toMatch(new RegExp(`^/racing/scenario-gate/${UMA}/ceremony\\?op=`)))
    expect(await screen.findByRole('heading', { name: 'Promoted to Tier 2' })).toBeTruthy()
    await synced(game)
    expect(game.getSnapshot().state!.umas[UMA]!.tier).toBe(2)
    expect(screen.getByRole('heading', { name: 'Promoted to Tier 2' })).toBeTruthy()
    await timerPassed()
    await waitFor(() => expect(view.where()).toBe(PROFILE))
  })

  it("never leaves a blank screen: a ceremony whose tap the device can't find offers its way out and leaves", async () => {
    const game = await deviceOn(new FakeServer())
    expect((await game.run('unlock-uma', { outfitId: UMA })).kind).toBe('done')
    const view = renderG2(`/racing/scenario-gate/${UMA}/ceremony?op=op-unknown`, game)
    expect(await screen.findByRole('button', { name: 'Open her profile' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Skip' })).toBeTruthy()
    await rendered('[data-g2="ceremony"][data-op="missing"]')
    await timerPassed()
    await waitFor(() => expect(view.where()).toBe(PROFILE))
  })
})
