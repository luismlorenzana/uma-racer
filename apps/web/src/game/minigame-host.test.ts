import { describe, expect, it, vi } from 'vitest'
import { ftStateHash, sparkRivalStateHash, type FtSetup } from '@racer/domain'
import { MinigameHostTestDouble, type RunOutcome, type RunTicket } from './minigame-host'

async function terminalClaim(host: MinigameHostTestDouble, ticket: RunTicket): Promise<Extract<RunOutcome, { kind: 'spark-match' }>> {
  const loaded = await host.load(ticket.runId)
  if (loaded.engine !== 'spark-rival-v1') throw new Error('Expected a Spark Rival fixture')
  let view = loaded
  while (!view.replay.outcome) {
    const next = await host.append(ticket.runId, view.actions.length, {
      type: 'drag',
      path: [{ row: 0, column: 0 }, { row: 0, column: 1 }],
      movementMs: 250,
    })
    if (next.engine !== 'spark-rival-v1') throw new Error('Expected a Spark Rival fixture')
    view = next
  }
  return {
    kind: 'spark-match',
    engine: 'spark-rival-v1',
    actionCount: view.actions.length,
    stateHash: sparkRivalStateHash(view.replay.state),
  }
}

const friendshipSetup: FtSetup = {
  version: 1,
  seed: 1,
  tier: 1,
  twist: 'foundation',
  earning: 1,
  mainCardId: 'synthetic-card',
  deck: ['synthetic-card'],
  cards: {
    'synthetic-card': {
      id: 'synthetic-card', charaId: 'synthetic-character', name: 'Synthetic Card', title: 'Practice Notes',
      type: 'speed', trait: 'trainingBonus', signature: ['trainingBonus'], stars: 0,
    },
  },
  rewardPool: ['synthetic-card'],
  skills: {},
  skillSources: { main: [], deck: [], pool: [] },
  races: [{ id: 'synthetic-race', name: 'Synthetic Race', grade: 'g3', distance: 1_600, distanceCategory: 'mile', surface: 'turf' }],
  legendsCardId: null,
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
    expect((await host.load(first.runId)).actions).toEqual([])
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

  it('returns one reward when a completed Friendship Training run is committed twice', async () => {
    const reward = vi.fn(() => ({ ticketsSpent: 1, starsBefore: 0, starsAfter: 1, couponGranted: false }))
    const host = new MinigameHostTestDouble({ reward })
    const ticket = await host.beginRun('friendship-training', { kind: 'friendship-training', cardId: 'synthetic-card', tier: 1 })
    host.setups.set(ticket.runId, friendshipSetup)
    const view = await host.append(ticket.runId, 0, { type: 'give-up' })
    if (view.engine !== 'friendship-training-v1') throw new Error('Expected a Friendship Training fixture')
    const outcome = {
      kind: 'friendship-training' as const,
      engine: 'friendship-training-v1' as const,
      actionCount: view.actions.length,
      stateHash: ftStateHash(view.replay),
    }
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
