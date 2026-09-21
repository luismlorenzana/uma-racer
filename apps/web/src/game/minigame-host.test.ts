import { describe, expect, it, vi } from 'vitest'
import { MinigameHostTestDouble } from './minigame-host'

describe('MinigameHostTestDouble', () => {
  it('restores an open run with the same id and deterministic seed', async () => {
    const host = new MinigameHostTestDouble({ seedPrefix: 'fixture' })
    const target = { kind: 'spark-match' as const, umaId: 'synthetic-uma' }
    const first = await host.beginRun('spark-match', target)
    const restored = await host.beginRun('spark-match', target)
    expect(first).toEqual({
      runId: 'test:spark-match:synthetic-uma:0',
      seed: 'fixture:spark-match:synthetic-uma:0',
      attemptIndex: 0,
    })
    expect(restored).toEqual(first)
  })

  it('returns one reward when the same completed run is committed twice', async () => {
    const reward = vi.fn(() => ({
      ticketsSpent: 5,
      trainingLevelBefore: 2,
      trainingLevelAfter: 3,
      nodesUnlocked: ['Synthetic Arc'],
    }))
    const host = new MinigameHostTestDouble({ reward })
    const ticket = await host.beginRun('spark-match', { kind: 'spark-match', umaId: 'synthetic-uma' })
    const outcome = { kind: 'spark-match' as const, score: 1_500, moves: 25 }
    expect(await host.commitRun(ticket.runId, outcome)).toEqual({
      ticketsSpent: 5,
      trainingLevelBefore: 2,
      trainingLevelAfter: 3,
      nodesUnlocked: ['Synthetic Arc'],
    })
    expect(await host.commitRun(ticket.runId, outcome)).toEqual({
      ticketsSpent: 5,
      trainingLevelBefore: 2,
      trainingLevelAfter: 3,
      nodesUnlocked: ['Synthetic Arc'],
    })
    expect(reward).toHaveBeenCalledTimes(1)
    expect(host.commitCalls).toHaveLength(2)
  })

  it('advances Bond Recall once when its completed run is committed twice', async () => {
    const reward = vi.fn(() => ({
      ticketsSpent: 10,
      limitBreakBefore: 0,
      limitBreakAfter: 1,
      couponGranted: false,
    }))
    const host = new MinigameHostTestDouble({ reward })
    const ticket = await host.beginRun('bond-recall', { kind: 'bond-recall', cardId: 'synthetic-card' })
    const outcome = { kind: 'bond-recall' as const, cleared: true, mismatches: 4 }
    expect(await host.commitRun(ticket.runId, outcome)).toMatchObject({ limitBreakBefore: 0, limitBreakAfter: 1 })
    expect(await host.commitRun(ticket.runId, outcome)).toMatchObject({ limitBreakBefore: 0, limitBreakAfter: 1 })
    expect(reward).toHaveBeenCalledTimes(1)
    expect(host.commitCalls).toHaveLength(2)
  })

  it('spends the Bond Recall ticket without advancing after a loss', async () => {
    const host = new MinigameHostTestDouble()
    const ticket = await host.beginRun('bond-recall', { kind: 'bond-recall', cardId: 'synthetic-card' })
    expect(await host.commitRun(ticket.runId, { kind: 'bond-recall', cleared: false, mismatches: 10 })).toEqual({
      ticketsSpent: 10,
      limitBreakBefore: 0,
      limitBreakAfter: 0,
      couponGranted: false,
    })
  })

  it('rejects mismatched targets and incomplete Spark Match outcomes', async () => {
    const host = new MinigameHostTestDouble()
    await expect(host.beginRun('bond-recall', { kind: 'spark-match', umaId: 'synthetic-uma' })).rejects.toThrow(/do not match/)
    const ticket = await host.beginRun('spark-match', { kind: 'spark-match', umaId: 'synthetic-uma' })
    await expect(host.commitRun(ticket.runId, { kind: 'spark-match', score: 100, moves: 24 })).rejects.toThrow(/exactly 25/)
  })
})
