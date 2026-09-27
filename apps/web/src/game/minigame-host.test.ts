import { describe, expect, it, vi } from 'vitest'
import { sparkRivalStateHash } from './minigames/spark-rival'
import { MinigameHostTestDouble, type RunOutcome, type RunTicket } from './minigame-host'

async function terminalClaim(host: MinigameHostTestDouble, ticket: RunTicket): Promise<Extract<RunOutcome, { kind: 'spark-match' }>> {
  let view = await host.loadSpark(ticket.runId)
  while (!view.replay.outcome) {
    view = await host.appendSpark(ticket.runId, view.actions.length, {
      type: 'drag',
      path: [{ row: 0, column: 0 }, { row: 0, column: 1 }],
      movementMs: 250,
    })
  }
  return {
    kind: 'spark-match',
    engine: 'spark-rival-v1',
    actionCount: view.actions.length,
    stateHash: sparkRivalStateHash(view.replay.state),
  }
}

describe('MinigameHostTestDouble', () => {
  it('restores an open run and journal with the same deterministic identity', async () => {
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
    expect((await host.loadSpark(first.runId)).actions).toEqual([])
  })

  it('returns one structured replay reward when the same completed run is committed twice', async () => {
    const reward = vi.fn((_ticket, _target, _outcome, replay) => ({
      ticketsSpent: 1,
      trainingExpEarned: replay?.outcome?.trainingExp,
      trainingLevelBefore: 2,
      trainingLevelAfter: 3,
      nodesUnlocked: [{ id: 'synthetic-node', label: 'Card node 2 · upper center' }],
    }))
    const host = new MinigameHostTestDouble({ reward })
    const ticket = await host.beginRun('spark-match', { kind: 'spark-match', umaId: 'synthetic-uma' })
    const outcome = await terminalClaim(host, ticket)
    const first = await host.commitRun(ticket.runId, outcome)
    expect(await host.commitRun(ticket.runId, outcome)).toEqual(first)
    expect(first.nodesUnlocked).toEqual([{ id: 'synthetic-node', label: 'Card node 2 · upper center' }])
    expect(reward).toHaveBeenCalledTimes(1)
    expect(host.commitCalls).toHaveLength(2)
  })

  it('advances a card once when its completed Friendship Training run is committed twice', async () => {
    const reward = vi.fn(() => ({ ticketsSpent: 1, starsBefore: 0, starsAfter: 1, couponGranted: false }))
    const host = new MinigameHostTestDouble({ reward })
    const ticket = await host.beginRun('friendship-training', { kind: 'friendship-training', cardId: 'synthetic-card', tier: 1 })
    const outcome = { kind: 'friendship-training' as const, cleared: true, actions: [] }
    expect(await host.commitRun(ticket.runId, outcome)).toMatchObject({ starsBefore: 0, starsAfter: 1 })
    expect(await host.commitRun(ticket.runId, outcome)).toMatchObject({ starsBefore: 0, starsAfter: 1 })
    expect(reward).toHaveBeenCalledTimes(1)
  })

  it('rejects stale and nonterminal Spark replay claims', async () => {
    const host = new MinigameHostTestDouble()
    await expect(host.beginRun('friendship-training', { kind: 'spark-match', umaId: 'synthetic-uma' })).rejects.toThrow(/do not match/)
    const ticket = await host.beginRun('spark-match', { kind: 'spark-match', umaId: 'synthetic-uma' })
    await expect(host.commitRun(ticket.runId, {
      kind: 'spark-match', engine: 'spark-rival-v1', actionCount: 0, stateHash: '00000000',
    })).rejects.toThrow(/not finished/)
    const claim = await terminalClaim(host, ticket)
    await expect(host.commitRun(ticket.runId, { ...claim, stateHash: '00000000' })).rejects.toThrow(/stale/)
  })
})
