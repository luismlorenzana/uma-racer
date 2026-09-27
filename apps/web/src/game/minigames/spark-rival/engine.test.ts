import { SPARK_RIVAL_SHIFT_CHARGE } from '@racer/domain'
import { describe, expect, it } from 'vitest'
import { createSparkRivalState, reduceSparkRival, replaySparkRival, SparkRivalEngineError, sparkRivalStateHash } from './engine'
import { syntheticSparkEncounter } from './fixtures'
import { SPARK_ORBS, type SparkCell, type SparkOrb, type SparkRivalEncounterV1, type SparkRivalState } from './types'

const noMatchBoard = (): SparkOrb[] => Array.from(
  { length: 30 },
  (_, index) => SPARK_ORBS[(Math.floor(index / 6) * 2 + index % 6) % SPARK_ORBS.length]!,
)
const noMatchDrag = (from: SparkCell = { row: 0, column: 0 }, to: SparkCell = { row: 0, column: 1 }) => ({
  type: 'drag' as const,
  path: [from, to],
  movementMs: 500,
})
const withFirstWave = (
  encounter: SparkRivalEncounterV1,
  patch: Partial<SparkRivalEncounterV1['waves'][number]>,
): SparkRivalEncounterV1 => ({
  ...encounter,
  waves: [{ ...encounter.waves[0], ...patch }, encounter.waves[1], encounter.waves[2]],
})
const withState = (state: SparkRivalState, patch: Partial<SparkRivalState>): SparkRivalState => ({ ...state, ...patch })

describe('Spark Rival engine', () => {
  it('pins the v1 initial board, first skyfall draws, three actions, and full replay state', () => {
    const encounter = syntheticSparkEncounter()
    const actions = [
      { type: 'drag' as const, path: [{ row: 2, column: 3 }, { row: 3, column: 2 }], movementMs: 320 },
      { type: 'drag' as const, path: [{ row: 0, column: 3 }, { row: 1, column: 3 }], movementMs: 320 },
      { type: 'drag' as const, path: [{ row: 1, column: 4 }, { row: 2, column: 3 }], movementMs: 320 },
    ]
    const initial = createSparkRivalState(encounter, 'pinned-replay-v1')
    const replay = replaySparkRival(encounter, 'pinned-replay-v1', actions)
    expect(initial.board).toEqual([
      'end', 'front', 'front', 'spark', 'late', 'front',
      'pace', 'recovery', 'spark', 'front', 'pace', 'recovery',
      'spark', 'end', 'pace', 'pace', 'end', 'late',
      'late', 'spark', 'end', 'end', 'front', 'recovery',
      'recovery', 'late', 'pace', 'spark', 'late', 'recovery',
    ])
    const firstSkyfalls = replay.turns[0]!.cascades.map((cascade) => {
      const draws: SparkOrb[] = []
      for (let column = 0; column < 6; column += 1) {
        const count = cascade.cleared.filter((index) => index % 6 === column).length
        for (let row = count - 1; row >= 0; row -= 1) draws.push(cascade.after[row * 6 + column]!)
      }
      return draws
    })
    expect(firstSkyfalls).toEqual([
      ['end', 'pace', 'late'],
      ['front', 'recovery', 'late', 'pace'],
    ])
    expect(replay.state).toEqual({
      board: [
        'end', 'front', 'spark', 'front', 'recovery', 'front',
        'pace', 'front', 'late', 'end', 'end', 'recovery',
        'spark', 'recovery', 'recovery', 'spark', 'front', 'late',
        'late', 'spark', 'front', 'end', 'front', 'recovery',
        'recovery', 'late', 'spark', 'spark', 'late', 'recovery',
      ],
      boardRngState: 4_051_894_173,
      rivalRngState: 2_292_797_102,
      waveIndex: 0,
      waveTurn: 3,
      drive: 88,
      maxDrive: 100,
      sparkCharge: 0,
      sparkTarget: 9,
      totalDrags: 3,
      totalCombos: 4,
      waveDamage: [208, 0, 0],
      rival: {
        strategy: 'front', resolve: 292, maxResolve: 500, countdown: 1, intentIndex: 0,
        pressureMultiplier: 1, guard: null, firedPhases: [],
      },
      outcome: null,
    })
  })

  it('replays the same JSON-round-tripped seed and actions byte-for-byte', () => {
    const encounter = syntheticSparkEncounter()
    const actions = [noMatchDrag(), noMatchDrag({ row: 2, column: 2 }, { row: 3, column: 3 }), noMatchDrag({ row: 4, column: 5 }, { row: 3, column: 4 })]
    const first = replaySparkRival(encounter, 'replay-seed', actions)
    const second = replaySparkRival(
      JSON.parse(JSON.stringify(encounter)) as SparkRivalEncounterV1,
      'replay-seed',
      JSON.parse(JSON.stringify(actions)) as typeof actions,
    )
    expect(second).toEqual(first)
    expect(sparkRivalStateHash(second.state)).toBe(sparkRivalStateHash(first.state))
    expect(first.state.totalDrags).toBe(3)
  })

  it('counts a no-match drag as a turn and executes the displayed Pressure at countdown zero', () => {
    const base = syntheticSparkEncounter({ recipes: ['rush-pressure', 'surge-convert', 'circuit-boss'] })
    const encounter = withFirstWave(base, { openingCountdown: 1, intents: [{ type: 'pressure', amount: 12 }], phases: [] })
    const initial = createSparkRivalState(encounter, 'no-match-turn')
    const state = withState(initial, { board: noMatchBoard(), rival: { ...initial.rival, countdown: 1 } })
    const reduced = reduceSparkRival(encounter, state, noMatchDrag())
    expect(reduced.resolution.combos).toBe(0)
    expect(reduced.state).toMatchObject({ waveTurn: 1, totalDrags: 1, drive: 88 })
    expect(reduced.resolution.steps.map((step) => step.type)).toEqual(['path', 'totals', 'countdown', 'rival-intent'])
  })

  it('wins before the rival can act and carries board, Drive, and Spark into the next wave', () => {
    const encounter = syntheticSparkEncounter()
    const initial = createSparkRivalState(encounter, 'wave-clear')
    const board = noMatchBoard()
    board.splice(0, 4, 'front', 'front', 'pace', 'front')
    const state = withState(initial, {
      board,
      drive: 73,
      sparkCharge: 4,
      rival: { ...initial.rival, resolve: 1, strategy: 'end', countdown: 1 },
    })
    const reduced = reduceSparkRival(encounter, state, noMatchDrag({ row: 0, column: 2 }, { row: 0, column: 3 }))
    expect(reduced.state.waveIndex).toBe(1)
    expect(reduced.state.waveTurn).toBe(0)
    expect(reduced.state.drive).toBe(73)
    expect(reduced.state.sparkCharge).toBe(4)
    expect(reduced.state.rival.resolve).toBe(encounter.waves[1].maxResolve)
    expect(reduced.resolution.steps.some((step) => step.type === 'rival-intent')).toBe(false)
    expect(reduced.resolution.steps.some((step) => step.type === 'wave-clear')).toBe(true)
  })

  it('loses after exactly the eighth unresolved drag and never begins a ninth', () => {
    const encounter = withFirstWave(syntheticSparkEncounter(), { openingCountdown: 8, intents: [{ type: 'pressure', amount: 1 }], phases: [] })
    const initial = createSparkRivalState(encounter, 'turn-limit')
    const state = withState(initial, { board: noMatchBoard(), waveTurn: 7, totalDrags: 7, rival: { ...initial.rival, countdown: 8 } })
    const reduced = reduceSparkRival(encounter, state, noMatchDrag())
    expect(reduced.state.outcome).toMatchObject({ kind: 'loss', reason: 'turn-limit' })
    expect(reduced.state.waveTurn).toBe(8)
    expect(() => reduceSparkRival(encounter, reduced.state, noMatchDrag())).toThrow(SparkRivalEngineError)
  })

  it('allows damage on the eighth drag to win before the turn bound is checked', () => {
    const encounter = syntheticSparkEncounter()
    const initial = createSparkRivalState(encounter, 'eighth-turn-win')
    const board = noMatchBoard()
    board.splice(0, 4, 'front', 'front', 'pace', 'front')
    const state = withState(initial, {
      board,
      waveIndex: 2,
      waveTurn: 7,
      totalDrags: 23,
      rival: { ...initial.rival, strategy: 'front', resolve: 1, maxResolve: encounter.waves[2].maxResolve, countdown: 1 },
    })
    const reduced = reduceSparkRival(encounter, state, noMatchDrag({ row: 0, column: 2 }, { row: 0, column: 3 }))
    expect(reduced.state.waveTurn).toBe(8)
    expect(reduced.state.outcome).toMatchObject({ kind: 'clear', reason: 'circuit-cleared' })
  })

  it('clamps Pressure to zero Drive and reports a drive-depleted loss', () => {
    const base = syntheticSparkEncounter()
    const encounter = withFirstWave(base, { openingCountdown: 1, intents: [{ type: 'pressure', amount: 20 }], phases: [] })
    const initial = createSparkRivalState(encounter, 'drive-loss')
    const state = withState(initial, { board: noMatchBoard(), drive: 5, rival: { ...initial.rival, countdown: 1 } })
    const reduced = reduceSparkRival(encounter, state, noMatchDrag())
    expect(reduced.state.drive).toBe(0)
    expect(reduced.state.outcome).toMatchObject({ kind: 'loss', reason: 'drive-depleted' })
  })

  it('converts Spark with a charged Shift without consuming a turn or resolving the board', () => {
    const encounter = syntheticSparkEncounter({ traineeBest: 'pace' })
    const initial = createSparkRivalState(encounter, 'shift')
    const board = noMatchBoard(); board[0] = 'spark'; board[7] = 'spark'
    const state = withState(initial, { board, sparkCharge: SPARK_RIVAL_SHIFT_CHARGE })
    const reduced = reduceSparkRival(encounter, state, { type: 'spark-shift' })
    expect(reduced.state.board[0]).toBe('pace')
    expect(reduced.state.board[7]).toBe('pace')
    expect(reduced.state.sparkCharge).toBe(0)
    expect(reduced.state.waveTurn).toBe(0)
    expect(reduced.resolution).toMatchObject({ turnConsumed: false, combos: 0 })
    expect(() => reduceSparkRival(encounter, initial, { type: 'spark-shift' })).toThrow('not charged')
  })

  it('applies Guard, Convert, Delay, Enrage, and Change style as deterministic visible state', () => {
    const recipes = ['tracker-guard', 'surge-convert', 'finisher-delay'] as const
    for (const recipe of recipes) {
      const base = syntheticSparkEncounter({ recipes: [recipe, 'rush-pressure', 'circuit-boss'] })
      const encounter = withFirstWave(base, { openingCountdown: 1 })
      const initial = createSparkRivalState(encounter, `intent-${recipe}`)
      const state = withState(initial, { board: noMatchBoard(), rival: { ...initial.rival, countdown: 1 } })
      const reduced = reduceSparkRival(encounter, state, noMatchDrag())
      const intent = encounter.waves[0].intents[0]!
      if (intent.type === 'guard') expect(reduced.state.rival.guard).toEqual({ reduction: 0.5, comboThreshold: 4 })
      if (intent.type === 'convert') expect(reduced.state.board.filter((orb) => orb === intent.target).length).toBeGreaterThan(state.board.filter((orb) => orb === intent.target).length)
      if (intent.type === 'delay') expect(reduced.state.sparkTarget).toBe(12)
      expect(reduced.resolution.steps.some((step) => step.type === 'rival-intent')).toBe(true)
    }

    const enrageEncounter = syntheticSparkEncounter({ recipes: ['rush-pressure', 'tracker-guard', 'circuit-boss'] })
    const enrageInitial = createSparkRivalState(enrageEncounter, 'enrage')
    const enraged = reduceSparkRival(enrageEncounter, withState(enrageInitial, {
      board: noMatchBoard(),
      rival: { ...enrageInitial.rival, resolve: Math.floor(enrageInitial.rival.maxResolve / 2) },
    }), noMatchDrag())
    expect(enraged.state.rival.pressureMultiplier).toBe(1.5)

    const adaptiveEncounter = syntheticSparkEncounter({ traineeBest: 'front', recipes: ['adaptive-duel', 'tracker-guard', 'circuit-boss'] })
    const adaptiveInitial = createSparkRivalState(adaptiveEncounter, 'adaptive')
    const adapted = reduceSparkRival(adaptiveEncounter, withState(adaptiveInitial, {
      board: noMatchBoard(),
      rival: { ...adaptiveInitial.rival, resolve: Math.floor(adaptiveInitial.rival.maxResolve / 2) },
    }), noMatchDrag())
    expect(adapted.state.rival.strategy).toBe('pace')
  })

  it('adds Delay to the remaining Shift requirement without removing accumulated charge', () => {
    const base = syntheticSparkEncounter({ recipes: ['finisher-delay', 'surge-convert', 'circuit-boss'] })
    const encounter = withFirstWave(base, { openingCountdown: 1 })
    const initial = createSparkRivalState(encounter, 'charged-delay')
    const state = withState(initial, {
      board: noMatchBoard(), sparkCharge: 10, sparkTarget: 9, rival: { ...initial.rival, countdown: 1 },
    })
    const reduced = reduceSparkRival(encounter, state, noMatchDrag())
    expect(reduced.state.sparkCharge).toBe(10)
    expect(reduced.state.sparkTarget).toBe(13)
  })

  it('rejects malformed input and any action after a terminal replay', () => {
    const encounter = syntheticSparkEncounter()
    expect(() => replaySparkRival(encounter, 'bad-actions', [{ type: 'drag', path: [], movementMs: 1 }])).toThrow(SparkRivalEngineError)
    expect(() => createSparkRivalState({ ...encounter, version: 2 } as unknown as SparkRivalEncounterV1, 'bad')).toThrow(SparkRivalEngineError)
  })
})
