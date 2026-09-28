import { afterEach, describe, expect, it } from 'vitest'
import { syntheticSparkEncounter } from '@racer/domain'
import { getMinigameJournal, installMinigameJournal } from './minigame-journal'
import { MinigameHostTestDouble } from './minigame-host'
import { parseSparkReplayJournal, parseSparkRunSnapshot } from './minigame-runs'

const cleanups: Array<() => void> = []
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup() })

describe('minigame journal boundary', () => {
  it('strictly parses bounded snapshots and journals', () => {
    const snapshot = {
      version: 1,
      contentVersion: 'synthetic-v1',
      source: 'fallback',
      encounter: syntheticSparkEncounter(),
    }
    expect(parseSparkRunSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot)
    expect(parseSparkRunSnapshot({ ...snapshot, extra: true })).toBeNull()
    expect(parseSparkRunSnapshot({ ...snapshot, contentVersion: 'x'.repeat(121) })).toBeNull()
    expect(parseSparkReplayJournal({ format: 1, engine: 'spark-rival-v1', actions: [] })).toEqual({ format: 1, engine: 'spark-rival-v1', actions: [] })
    expect(parseSparkReplayJournal({ format: 1, engine: 'spark-rival-v1', actions: Array.from({ length: 65 }, () => ({ type: 'spark-shift' })) })).toBeNull()
  })

  it('installs and tears down the runtime service without leaving a stale journal', async () => {
    const fake = new MinigameHostTestDouble()
    const uninstall = installMinigameJournal(fake)
    cleanups.push(uninstall)
    const ticket = await fake.beginRun('spark-match', { kind: 'spark-match', umaId: 'synthetic-uma' })
    expect((await getMinigameJournal().loadSpark(ticket.runId)).ticket).toEqual(ticket)
    uninstall()
    await expect(getMinigameJournal().loadSpark(ticket.runId)).rejects.toThrow(/not ready/)
  })

  it('compare-and-appends actions and restores the exact JSON replay boundary', async () => {
    const fake = new MinigameHostTestDouble({ seedPrefix: 'journal-fixture' })
    const ticket = await fake.beginRun('spark-match', { kind: 'spark-match', umaId: 'synthetic-uma' })
    const action = { type: 'drag' as const, path: [{ row: 0, column: 0 }, { row: 0, column: 1 }], movementMs: 200 }
    const first = await fake.appendSpark(ticket.runId, 0, action)
    expect(JSON.parse(JSON.stringify(await fake.loadSpark(ticket.runId)))).toEqual(JSON.parse(JSON.stringify(first)))
    await expect(fake.appendSpark(ticket.runId, 0, action)).rejects.toThrow(/action count changed/)
    expect((await fake.loadSpark(ticket.runId)).actions).toEqual([action])
    await expect(fake.appendSpark(ticket.runId, 1, { type: 'drag', path: [], movementMs: 0 } as never)).rejects.toThrow(/invalid/)
    expect((await fake.loadSpark(ticket.runId)).actions).toEqual([action])
  })
})
