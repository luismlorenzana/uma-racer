// The career's four operations through `commitOperation` on invented content (D383): starting a career, racing an
// objective (won and lost), the next season, and the URA Finals with the build's freeze and the rewards. Races run on a
// stand-in engine that places her where the test says; the rows they write parse as generation 3's.
import { describe, expect, it } from 'vitest'
import { CONTENT_ENV, careerSave, fakeEngine, race, UMAS, withEngine } from '../__fixtures__/career'
import { clock, deepFreeze, opId } from '../__fixtures__/g3'
import { deriveRacingBuild } from '../build/racing-build'
import { commitOperation, type Commit } from '../save/commit'
import { FINALE_SEASON, careerId, parseCareerRecord, parseRaceResultRecord, type CareerRecord } from '../save/records'
import type { OperationEnv } from '../save/registry'
import type { SaveState } from '../save/state'
import { seasonName } from './calendar'
import { deckRaceBonus, FINALE_REWARD, OBJECTIVE_SP } from './rewards'

const UMA = UMAS[0]!
const ID = careerId(UMA.id, 1)
const op = (n: number, name: string, input: unknown) => ({ id: opId(n), name, input, at: clock('08:00') })
const applied = (commit: Commit) => {
  if (commit.status !== 'applied') throw new Error(commit.status === 'refused' ? commit.refusal.reason : commit.status)
  return commit
}
const refusal = (commit: Commit) => (commit.status === 'refused' ? commit.refusal.code : commit.status)
const written = (commit: Commit) => (commit.status === 'applied' ? [...commit.entities, ...commit.logs].map((row) => `${row.kind}/${row.id}`) : [])

/** Her career, started through the operation. */
function started(): { state: SaveState; career: CareerRecord } {
  const commit = applied(commitOperation(deepFreeze(careerSave(UMA.id)), op(1, 'start-career', { umaId: UMA.id, T: 1 }), CONTENT_ENV))
  return { state: commit.state, career: commit.state.careers[ID]! }
}

/** The save with her career changed. */
const withCareer = (state: SaveState, change: Partial<CareerRecord>): SaveState =>
  deepFreeze({ ...state, careers: { ...state.careers, [ID]: { ...state.careers[ID]!, ...change } } })

const placing = (placement: number): OperationEnv => withEngine(fakeEngine(UMA.id, () => placement))

describe('start-career', () => {
  it('freezes her objectives on the calendar and opens an empty tree, deck and wallet', () => {
    const commit = applied(commitOperation(deepFreeze(careerSave(UMA.id)), op(1, 'start-career', { umaId: UMA.id, T: 1 }), CONTENT_ENV))
    const career = commit.state.careers[ID]!
    expect(parseCareerRecord(career)).toEqual(career)
    expect(career).toMatchObject({ season: 0, startedAt: clock('08:00'), deck: [], skills: [], spSpent: 0, completedAt: null, racingBuild: null })
    expect(career.wallet).toEqual({ drills: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }, bond: 0, sp: 0 })
    expect(career.objectives.map((objective) => objective.stage)).toEqual(['maiden', 'trials', 'trials', 'main', 'main', 'main'])
    expect(career.objectives.every((objective) => objective.status === 'open' && objective.wonAt === null)).toBe(true)
    expect(seasonName(career.objectives[0]!.season)).toMatch(/^Junior/)
    expect(career.objectives.filter((objective) => objective.stage === 'trials').every((objective) => seasonName(objective.season).startsWith('Classic'))).toBe(true)
    expect(commit.receipt).toEqual({ careerId: ID, objectives: career.objectives.map(({ raceId, stage, season }) => ({ raceId, stage, season })) })
    expect(written(commit)).toEqual([`careers/${ID}`, `operations/${opId(1)}`])
  })

  it('refuses a locked Uma, another scenario, a second career and an unknown Uma, and applies an id once', () => {
    const { state } = started()
    const locked = deepFreeze({ ...careerSave(UMA.id), umas: {} })
    expect(refusal(commitOperation(locked, op(2, 'start-career', { umaId: UMA.id, T: 1 }), CONTENT_ENV))).toBe('uma-locked')
    expect(refusal(commitOperation(deepFreeze(careerSave(UMA.id)), op(2, 'start-career', { umaId: UMA.id, T: 2 }), CONTENT_ENV))).toBe('scenario-closed')
    expect(refusal(commitOperation(state, op(2, 'start-career', { umaId: UMA.id, T: 1 }), CONTENT_ENV))).toBe('career-running')
    const done = withCareer(state, { completedAt: clock('09:00'), racingBuild: deriveRacingBuild(state.careers[ID]!, UMA, CONTENT_ENV.content.cards, {}) })
    expect(refusal(commitOperation(done, op(2, 'start-career', { umaId: UMA.id, T: 1 }), CONTENT_ENV))).toBe('career-done')
    expect(refusal(commitOperation(deepFreeze(careerSave('nobody')), op(2, 'start-career', { umaId: 'nobody', T: 1 }), CONTENT_ENV))).toBe('unknown-uma')
    expect(commitOperation(state, op(1, 'start-career', { umaId: UMA.id, T: 1 }), CONTENT_ENV).status).toBe('repeated')
    expect(() => commitOperation(state, op(3, 'start-career', { umaId: UMA.id }), CONTENT_ENV)).toThrow(/Malformed/)
  })
})

describe('run-race', () => {
  const ready = () => {
    const { state, career } = started()
    const first = career.objectives[0]!
    return { state: withCareer(state, { season: first.season }), objective: first }
  }

  it('refuses without an engine, off-season, a race that isn\'t hers, and at the Finale', () => {
    const { state, objective } = ready()
    const input = { careerId: ID, raceId: objective.raceId, attempt: 0 }
    expect(refusal(commitOperation(state, op(2, 'run-race', input), CONTENT_ENV))).toBe('no-engine')
    expect(refusal(commitOperation(withCareer(state, { season: objective.season + 1 }), op(2, 'run-race', input), placing(1)))).toBe('not-this-season')
    expect(refusal(commitOperation(state, op(2, 'run-race', { ...input, raceId: 'sim-dirt-long-g1-1' }), placing(1)))).toBe('not-an-objective')
    expect(refusal(commitOperation(withCareer(state, { season: FINALE_SEASON }), op(2, 'run-race', input), placing(1)))).toBe('at-finale')
    expect(() => commitOperation(state, op(2, 'run-race', { ...input, strategy: 'sideways' }), placing(1))).toThrow(/Malformed/)
  })

  it('a loss keeps the objective open, pays nothing and writes the race; a retry is a new race', () => {
    const { state, objective } = ready()
    const engine = fakeEngine(UMA.id, () => 4)
    const commit = applied(commitOperation(state, op(2, 'run-race', { careerId: ID, raceId: objective.raceId, attempt: 0 }), withEngine(engine)))
    expect(commit.receipt).toMatchObject({ placement: 4, won: false, reward: null, canAdvance: false, attempt: 0 })
    expect(commit.state.careers[ID]!.objectives[0]).toEqual(objective)
    expect(commit.state.account).toEqual(state.account)
    expect(written(commit)).toEqual([`raceResults/${opId(2)}`, `operations/${opId(2)}`])
    const row = commit.logs[0]!.data
    expect(parseRaceResultRecord(row)).toEqual(row)
    expect(row).toMatchObject({ careerId: ID, umaId: UMA.id, raceId: objective.raceId, kind: 'objective', placement: 4, at: clock('08:00') })
    applied(commitOperation(state, op(3, 'run-race', { careerId: ID, raceId: objective.raceId, attempt: 1 }), withEngine(engine)))
    applied(commitOperation(state, op(4, 'run-race', { careerId: ID, raceId: objective.raceId, attempt: 0 }), withEngine(engine)))
    expect(engine.runs[1]!.seed).not.toBe(engine.runs[0]!.seed)
    expect(engine.runs[2]).toEqual(engine.runs[0])
  })

  it('a win marks the objective, pays a Card Ticket and SP by grade × (1 + Race Bonus), and can\'t run again', () => {
    const { state, objective } = ready()
    const deck = ['sim-speed-2', 'sim-stamina-2', 'sim-friend-2']
    const decked = withCareer(state, { deck, posts: { 'sim-speed-2': 'speed', 'sim-stamina-2': 'stamina', 'sim-friend-2': 'wit' } })
    const commit = applied(commitOperation(decked, op(2, 'run-race', { careerId: ID, raceId: objective.raceId, attempt: 0 }), placing(1)))
    const sp = Math.round(OBJECTIVE_SP[race(objective.raceId).grade]! * (1 + deckRaceBonus(deck, CONTENT_ENV.content.cards)))
    expect(sp).toBeGreaterThan(OBJECTIVE_SP[race(objective.raceId).grade]!)
    expect(commit.receipt).toMatchObject({ placement: 1, won: true, reward: { cardTickets: 1, umaTickets: 0, sp } })
    const career = commit.state.careers[ID]!
    expect(career.objectives[0]).toEqual({ ...objective, status: 'won', wonAt: clock('08:00') })
    expect(career.wallet.sp).toBe(sp)
    expect(commit.state.account.cardTickets).toBe(state.account.cardTickets + 1)
    expect(parseCareerRecord(career)).toEqual(career)
    expect(written(commit)).toEqual(['account/main', `careers/${ID}`, `raceResults/${opId(2)}`, `operations/${opId(2)}`])
    expect(refusal(commitOperation(commit.state, op(3, 'run-race', { careerId: ID, raceId: objective.raceId, attempt: 1 }), placing(1)))).toBe('already-won')
  })
})

describe('next-season', () => {
  it('moves the calendar once the season\'s objectives are won, and names the season it leaves', () => {
    const { state, career } = started()
    const first = career.objectives[0]!
    const open = withCareer(state, { season: first.season })
    const blocked = commitOperation(open, op(2, 'next-season', { careerId: ID, season: first.season }), CONTENT_ENV)
    expect(blocked).toMatchObject({ refusal: { code: 'objectives-open', reason: 'Win this season\'s objective first.' } })
    const won = applied(commitOperation(open, op(2, 'run-race', { careerId: ID, raceId: first.raceId, attempt: 0 }), placing(1)))
    const moved = applied(commitOperation(won.state, op(3, 'next-season', { careerId: ID, season: first.season }), CONTENT_ENV))
    expect(moved.receipt).toEqual({ careerId: ID, season: first.season + 1 })
    expect(refusal(commitOperation(moved.state, op(4, 'next-season', { careerId: ID, season: first.season }), CONTENT_ENV))).toBe('season-moved')
  })

  it('walks an empty season at once, reaches the Finale after Senior Winter, and stops there', () => {
    const { state } = started()
    const allWon = (career: CareerRecord) => career.objectives.map((objective) => ({ ...objective, status: 'won' as const, wonAt: clock('07:30') }))
    const senior = withCareer(state, { season: 11, objectives: allWon(state.careers[ID]!) })
    const finale = applied(commitOperation(senior, op(2, 'next-season', { careerId: ID, season: 11 }), CONTENT_ENV))
    expect(finale.state.careers[ID]!.season).toBe(FINALE_SEASON)
    expect(refusal(commitOperation(finale.state, op(3, 'next-season', { careerId: ID, season: FINALE_SEASON }), CONTENT_ENV))).toBe('at-finale')
  })
})

describe('run-finale', () => {
  const atFinale = () => {
    const { state } = started()
    const objectives = state.careers[ID]!.objectives.map((objective) => ({ ...objective, status: 'won' as const, wonAt: clock('07:30') }))
    return withCareer(state, { season: FINALE_SEASON, objectives })
  }

  it('opens only at the Finale and only for the next round', () => {
    const { state } = started()
    expect(refusal(commitOperation(state, op(2, 'run-finale', { careerId: ID, round: 0, attempt: 0 }), placing(1)))).toBe('not-at-finale')
    expect(refusal(commitOperation(atFinale(), op(2, 'run-finale', { careerId: ID, round: 1, attempt: 0 }), placing(1)))).toBe('round-closed')
    expect(refusal(commitOperation(atFinale(), op(2, 'run-finale', { careerId: ID, round: 0, attempt: 0 }), CONTENT_ENV))).toBe('no-engine')
    expect(() => commitOperation(atFinale(), op(2, 'run-finale', { careerId: ID, round: 3, attempt: 0 }), placing(1))).toThrow(/Malformed/)
  })

  it('a loss stays on the round; wins climb to the final, which completes her career, freezes her build and pays', () => {
    let state = atFinale()
    const lost = applied(commitOperation(state, op(2, 'run-finale', { careerId: ID, round: 0, attempt: 0 }), placing(2)))
    expect(lost.receipt).toMatchObject({ round: 0, won: false, completed: false, reward: null })
    expect(lost.state.careers[ID]!.finale).toEqual({ step: 0, won: false })
    for (const round of [0, 1, 2]) {
      const commit = applied(commitOperation(state, op(3 + round, 'run-finale', { careerId: ID, round, attempt: 1 }), placing(1)))
      expect(commit.logs[0]!.data).toMatchObject({ kind: 'finale', placement: 1 })
      expect(parseRaceResultRecord(commit.logs[0]!.data)).not.toBeNull()
      state = commit.state
    }
    const career = state.careers[ID]!
    expect(career.finale).toEqual({ step: 3, won: true })
    expect(career.completedAt).toBe(clock('08:00'))
    expect(career.racingBuild).toEqual(deriveRacingBuild(atFinale().careers[ID]!, UMA, CONTENT_ENV.content.cards, {}))
    expect(parseCareerRecord(career)).toEqual(career)
    expect(state.account).toEqual({ ...atFinale().account, umaTickets: atFinale().account.umaTickets + FINALE_REWARD.umaTickets,
      cardTickets: atFinale().account.cardTickets + FINALE_REWARD.cardTickets })
    expect(refusal(commitOperation(state, op(9, 'run-finale', { careerId: ID, round: 2, attempt: 2 }), placing(1)))).toBe('career-complete')
    expect(refusal(commitOperation(state, op(9, 'buy-pips', { careerId: ID, branch: 'speed', count: 1 }), placing(1)))).toBe('career-complete')
  })

  it('runs the three rounds on one course against fields that strengthen', () => {
    let state = atFinale()
    const engine = fakeEngine(UMA.id, () => 1)
    for (const round of [0, 1, 2]) state = applied(commitOperation(state, op(2 + round, 'run-finale', { careerId: ID, round, attempt: 0 }), withEngine(engine))).state
    expect(new Set(engine.runs.map((setup) => setup.course.distance)).size).toBe(1)
    expect(engine.runs.map((setup) => setup.course.grade)).toEqual([200, 100, 100])
    const rivalMean = (index: number) => {
      const setup = engine.runs[index]!
      const rivals = setup.runners.filter((runner) => runner.id !== UMA.id)
      return rivals.reduce((sum, runner) => sum + Object.values(runner.stats).reduce((a, b) => a + b, 0), 0) / rivals.length
    }
    expect(rivalMean(0)).toBeLessThan(rivalMean(1))
    expect(rivalMean(1)).toBeLessThan(rivalMean(2))
  })
})
