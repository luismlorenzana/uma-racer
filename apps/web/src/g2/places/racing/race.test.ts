// The race on `finish-race` (T141 "Tests"): a prepared attempt is reproducible; it races with her finished unlocks
// collected; the device's receipt equals the server's; a retried Start pays once; a second device's same-day race
// shows the server's re-priced prize after sync; a featured first win pays its bonus once; and the committed row
// replays the same race. Synthetic seeds only.
import { deriveUmaPreset } from '@racer/domain/rework/training'
import { collectBeforeRace } from '@racer/domain/rework/work'
import type { RaceRun } from '@racer/domain'
import { commitOperation, type OperationEnvelope } from '@racer/domain/save-g2'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { G2Game } from '../../app/game'
import { createMemoryGame } from '../../dev/memory'
import { seed, stubStorage } from '../../testing'
import { devRaceContent } from './content'
import { prepareRace, raceRunOf, replayOf, simulate, placementOf } from './prepare'
import { raceDevice, startRace, takeFanfare } from './race'
import { featuredView, localDayAt, prizeLines } from './view'

beforeEach(stubStorage)
afterEach(() => vi.unstubAllGlobals())

const busy = () => seed('busy')
const content = () => devRaceContent(busy().env)
const day = () => localDayAt(busy().at, busy().utcOffsetMin)
const G1 = () => busy().env.content.races.find((race) => race.grade === 'g1')!.id

function attempt(umaId: string, raceId = G1(), sequence = 0, state = busy().state) {
  return prepareRace({ state, env: busy().env, content: content(), now: busy().at, umaId, raceId, strategy: 'pace', sequence })
}

/** Her run with her moved to `place`: the server trusts the placement and never re-runs the race (09 §8). */
function placed(run: RaceRun, place: number): RaceRun {
  const her = run.field.find((runner) => runner.isPlayer)!
  const other = run.field.find((runner) => runner.placement === place)!
  const field = run.field.map((runner) => (runner === her ? { ...runner, placement: place } : runner === other ? { ...runner, placement: her.placement } : runner))
  return { ...run, field: field.sort((a, b) => a.placement - b.placement) }
}

describe('preparing a race (T141 "Prepare")', () => {
  it('is identical for the same state, race, strategy and n: seed, field and stats', () => {
    const a = attempt('sim-uma-01')
    const b = attempt('sim-uma-01')
    expect(b).toEqual(a)
    expect(attempt('sim-uma-01', G1(), 1).seed).not.toBe(a.seed)
    expect(a.input.runners).toHaveLength(12)
    expect(a.input.runners[a.playerIndex]!.stats).toEqual(a.derived.stats)
  })

  it('races with her session’s finished unlocks collected first (01 §2)', () => {
    const { state, env, at } = busy()
    const inSession = Object.values(state.work).filter((row) => row.entries.some((entry) => entry.request.kind === 'session'))
    const ready = inSession.map((row) => row.outfitId).find((umaId) => collectBeforeRace(state, umaId, at, env).receipt.outputs.length > 0)
    expect(ready).toBeDefined()
    const race = env.content.races.find((entry) => entry.grade === 'g1')!
    const prepared = attempt(ready!, race.id)
    const collected = collectBeforeRace(state, ready!, at, env).state.umas[ready!]!
    expect(prepared.collects).toBeGreaterThan(0)
    expect(prepared.derived).toEqual(deriveUmaPreset(collected, race.distanceCategory, env.content))
    expect(prepared.derived.openNodes + prepared.derived.activeExtraNodes.length + prepared.derived.library.length)
      .toBeGreaterThanOrEqual(deriveUmaPreset(state.umas[ready!]!, race.distanceCategory, env.content).openNodes)
  })

  it('replays from the committed run alone: the same input, the same timeline', () => {
    const prepared = attempt('sim-uma-02')
    const timeline = simulate(prepared)
    const run = raceRunOf(content(), prepared, timeline)
    const replay = replayOf({ umaId: prepared.umaId, raceId: prepared.raceId, run })
    expect(replay.input).toEqual(prepared.input)
    expect(simulate(replay).results).toEqual(timeline.results)
    expect(placementOf(replay, simulate(replay))).toBe(placementOf(prepared, timeline))
  })
})

describe('Start race commits finish-race (09 §8–§9)', () => {
  const start = (game = createMemoryGame(busy(), () => 0), umaId = 'sim-uma-03', raceId = G1(), board: readonly string[] = []) => {
    const snapshot = game.getSnapshot()
    return {
      game,
      answer: startRace({
        game, state: snapshot.state!, env: snapshot.env!, content: content(), records: snapshot.records, umaId, raceId,
        strategy: 'pace', localDay: day(), board,
      }),
    }
  }

  it('writes the raceResults row, its flair in the same transaction, and plays its fanfare once', async () => {
    const { game, answer } = start()
    const done = await answer
    expect(done.kind).toBe('done')
    const id = (done as { id: string }).id
    const { records, state, receipts } = game.getSnapshot()
    const row = records.raceResults[id]!
    expect(row).toMatchObject({ umaId: 'sim-uma-03', raceId: G1(), opId: id, tier: 1 })
    expect(row.commit).toEqual(receipts[id]!.local)
    expect(state!.operations![id]!.name).toBe('finish-race')
    expect(records.badges['uma:sim-uma-03']?.scope).toBe('uma')
    expect(records.badges.trainer?.scope).toBe('trainer')
    expect(Object.keys(records.badges).filter((key) => key.startsWith('uma:'))).toHaveLength(25)
    expect(takeFanfare(id)).toBe(true)
    expect(takeFanfare(id)).toBe(false)
  })

  it('pays once for a double tap: the second gets the first one’s answer', async () => {
    const game = createMemoryGame(busy(), () => 0)
    const first = start(game)
    const second = start(game)
    const [a, b] = await Promise.all([first.answer, second.answer])
    expect(a).toEqual(b)
    expect(Object.keys(game.getSnapshot().records.raceResults)).toHaveLength(1)
  })

  it("equals the server's receipt when the server re-runs it on the same copy (02 §8)", async () => {
    const { game, answer } = start()
    const done = await answer as { id: string }
    const row = game.getSnapshot().records.raceResults[done.id]!
    const input = { umaId: row.umaId, raceId: row.raceId, placement: row.run.field.find((r) => r.isPlayer)!.placement, localDay: day(), board: [], run: row.run }
    const server = commitOperation(busy().state, { id: done.id, name: 'finish-race', input, at: row.at }, busy().env)
    expect(server.status).toBe('applied')
    expect(server.status === 'applied' && server.receipt).toEqual(row.commit)
    expect(server.status === 'applied' && server.logs.find((log) => log.kind === 'raceResults')?.data).toEqual(row)
  })

  it("shows the server's re-priced prize after a second device's same-day race (09 §8)", () => {
    const base = busy().state
    const near = { ...base, profile: { ...base.profile, purse: { day: day(), gross: 4_400, featuredPaid: [] } } }
    const run = (umaId: string) => placed(raceRunOf(content(), attempt(umaId, G1(), 0, near), simulate(attempt(umaId, G1(), 0, near))), 1)
    const envelope = (id: string, umaId: string): OperationEnvelope<'finish-race'> =>
      ({ id, name: 'finish-race', input: { umaId, raceId: G1(), placement: 1, localDay: day(), board: [], run: run(umaId) }, at: busy().at })
    const env = busy().env
    // Each device, offline, sees its own race first.
    const phone = commitOperation(near, envelope('device-a-race-01', 'sim-uma-04'), env)
    const tablet = commitOperation(near, envelope('device-b-race-01', 'sim-uma-05'), env)
    // The server commits the phone's first, then the tablet's on top.
    const first = commitOperation(near, envelope('device-a-race-01', 'sim-uma-04'), env)
    if (phone.status !== 'applied' || tablet.status !== 'applied' || first.status !== 'applied') throw new Error('refused')
    const second = commitOperation(first.state, envelope('device-b-race-01', 'sim-uma-05'), env)
    if (second.status !== 'applied') throw new Error(second.status)
    expect(tablet.receipt.prize).toMatchObject({ paid: 150, band: 'tired', dayGross: 4_700 })
    expect(second.receipt.prize).toMatchObject({ paid: 75, band: 'tired', dayGross: 5_000 })
    const synced = second.logs.find((log) => log.kind === 'raceResults')!.data as { commit: { prize: typeof second.receipt.prize } }
    expect(prizeLines(synced.commit.prize, 'g1', 1)).toMatchObject({ total: 75, main: '+75 · 1st in a G1', lines: ['Tired purse: paid a quarter (5,000 of 12,000)'] })
  })

  it('pays a featured race’s bonus on the day’s first win only', () => {
    const base = { ...busy().state, profile: { ...busy().state.profile, purse: { day: day(), gross: 0, featuredPaid: [] } } }
    const featured = featuredView(base.profile, day(), content().races.items)
    const g1 = featured.cards.find((card) => card.race.grade === 'g1')!
    const envelope = (id: string, umaId: string): OperationEnvelope<'finish-race'> => {
      const prepared = attempt(umaId, g1.race.id)
      return { id, name: 'finish-race', input: { umaId, raceId: g1.race.id, placement: 1, localDay: day(), board: featured.board, run: placed(raceRunOf(content(), prepared, simulate(prepared)), 1) }, at: busy().at }
    }
    const first = commitOperation(base, envelope('featured-race-01', 'sim-uma-06'), busy().env)
    if (first.status !== 'applied') throw new Error(first.status)
    const second = commitOperation(first.state, envelope('featured-race-02', 'sim-uma-07'), busy().env)
    if (second.status !== 'applied') throw new Error(second.status)
    expect([first.receipt.prize.featuredBonus, second.receipt.prize.featuredBonus]).toEqual([g1.bonus, 0])
    expect(featuredView(second.state.profile, day(), content().races.items).cards.find((card) => card.race.id === g1.race.id)!.paid).toBe(true)
  })

  it('writes nothing and plays nothing when the commit fails', async () => {
    const game = createMemoryGame(busy(), () => 0)
    const snapshot = game.getSnapshot()
    const failing = vi.fn(() => { throw new Error('flair failed') })
    const answer = await startRace({
      game: { ...game, run: ((name, input, key) => game.run(name, input, key, { device: failing })) as G2Game['run'] }, state: snapshot.state!, env: snapshot.env!,
      content: content(), records: snapshot.records, umaId: 'sim-uma-08', raceId: G1(), strategy: 'pace', localDay: day(), board: [],
    })
    expect(answer).toEqual({ kind: 'failed' })
    expect(game.getSnapshot().records.raceResults).toEqual({})
    expect(game.getSnapshot().state).toBe(snapshot.state)
    expect(raceDevice).toBeTypeOf('function')
  })
})
