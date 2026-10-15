// The dev mount's synthetic accounts and its in-memory port (T137): `busy` has Ready, Free, queued and busy slots on 25
// Umas; `fresh` is a new account; `quiet` has every Uma Working and nothing to collect. The port runs every tap through
// `recheck`, keeps its receipt, applies a busy key's tap once, saves nothing, and its clock runs from the seed's time.
import { hubView } from '@racer/domain/hub'
import { readyCount } from '@racer/domain/rework/check-in'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { seed, stubStorage } from '../testing'
import { createMemoryGame } from './memory'
import { seedFor } from './seed'

beforeEach(stubStorage)
afterEach(() => vi.unstubAllGlobals())

describe('the seeds', () => {
  it('busy: 25 Umas with Ready, Free, queued and busy slots, and invented names', () => {
    const busy = seed('busy')
    const view = hubView(busy.state, busy.at, busy.env)
    const pips = Object.values(view.buildings).flatMap((building) => building.pips)
    expect(view.umas).toBe(25)
    expect(view.ready).toBe(readyCount(busy.state, busy.at, busy.env))
    expect(view.ready).toBeGreaterThan(0)
    expect(view.free).toBeGreaterThan(0)
    expect(view.needsATap).toBeGreaterThan(0)
    expect(view.tabs.training).toBeGreaterThan(0)
    expect(pips.filter((pip) => pip.state === 'busy').length).toBeGreaterThan(0)
    expect(pips.some((pip) => pip.state === 'busy' && pip.progress > 0 && pip.progress < 1)).toBe(true)
    expect(pips.filter((pip) => pip.queued > 0).length).toBeGreaterThan(0)
    expect(view.featured).toBe('sim-uma-01')
    expect(busy.env.content.umas.get('sim-uma-01')?.name).toBe('Amber Sprint')
    const initials = Object.keys(busy.state.umas).map((id) => busy.env.content.umas.get(id)!.name.charAt(0))
    expect(new Set(initials).size).toBe(25)
  })

  it('fresh: a new account with 20 Uma Tickets and nothing else (rework/13 §5)', () => {
    const fresh = seed('fresh')
    expect(Object.keys(fresh.state.umas)).toHaveLength(0)
    expect(fresh.state.profile.umaTickets).toBe(20)
    expect(hubView(fresh.state, fresh.at, fresh.env)).toMatchObject({ umas: 0, ready: 0, free: 0, needsATap: 0 })
  })

  it('quiet: every Uma Working, nothing to collect', () => {
    const quiet = seed('quiet')
    expect(hubView(quiet.state, quiet.at, quiet.env)).toMatchObject({ umas: 25, ready: 0, free: 0, needsATap: 0 })
  })

  it('is picked by ?seed=, remembered for the tab, busy by default; ?sync= previews the chip', () => {
    expect(seedFor('').name).toBe('busy')
    expect(seedFor('?seed=nothing').name).toBe('busy')
    expect(seedFor('?seed=quiet').name).toBe('quiet')
    expect(seedFor('').name).toBe('quiet')
    expect(seedFor('?seed=fresh&sync=offline')).toMatchObject({ name: 'fresh', sync: 'offline' })
    expect(seedFor('?sync=nonsense').sync).toBe('synced')
  })
})

describe('the in-memory port', () => {
  it('runs a tap through recheck, keeps its receipt, publishes, and saves nothing', async () => {
    const fresh = seed('fresh')
    const game = createMemoryGame(fresh, () => 0)
    const heard = vi.fn()
    game.subscribe(heard)
    expect(game.getSnapshot()).toMatchObject({ status: 'ready', trainerName: 'Hana', sync: 'synced' })
    const answer = await game.run('unlock-uma', { outfitId: 'sim-uma-03' })
    expect(answer.kind).toBe('done')
    expect(heard).toHaveBeenCalledTimes(1)
    const snapshot = game.getSnapshot()
    expect(Object.keys(snapshot.state!.umas)).toEqual(['sim-uma-03'])
    expect(snapshot.state!.profile.umaTickets).toBe(19)
    expect(snapshot.receipts[answer.id]?.local).toEqual(answer.kind === 'done' ? answer.receipt : null)
    expect(fresh.state.profile.umaTickets).toBe(20)
  })

  it("answers a rule in plain words and changes nothing", async () => {
    const game = createMemoryGame(seed('fresh'), () => 0)
    await game.run('unlock-uma', { outfitId: 'sim-uma-03' })
    const before = game.getSnapshot()
    const again = await game.run('unlock-uma', { outfitId: 'sim-uma-03' })
    expect(again.kind).toBe('say')
    expect(game.getSnapshot()).toBe(before)
  })

  it('applies a busy key once: a second tap while the first runs gets its answer', async () => {
    const game = createMemoryGame(seed('fresh'), () => 0)
    const first = game.run('unlock-uma', { outfitId: 'sim-uma-04' }, 'unlock')
    const second = game.run('unlock-uma', { outfitId: 'sim-uma-05' }, 'unlock')
    expect(second).toBe(first)
    await first
    expect(Object.keys(game.getSnapshot().state!.umas)).toEqual(['sim-uma-04'])
    await game.run('unlock-uma', { outfitId: 'sim-uma-05' }, 'unlock')
    expect(Object.keys(game.getSnapshot().state!.umas).sort()).toEqual(['sim-uma-04', 'sim-uma-05'])
  })

  it("starts its clock at the seed's time and runs with real time", () => {
    let real = 1_000
    const quiet = seed('quiet')
    const game = createMemoryGame(quiet, () => real)
    expect(game.now()).toBe(quiet.at)
    real += 90_000
    expect(game.now()).toBe(quiet.at + 90_000)
    expect(game.utcOffsetMin(game.now())).toBe(0)
  })
})
