// Synthetic device-local queues plus the pure authority; no account, network or production flag mutation.
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolvePuzzlePreservation, resolveLegacySpark, parseSaveSnapshotOrThrow, type PuzzleStoredEntity, type PuzzleStoredLog } from '@racer/domain'
import { preservationFixture, preservationSparkProof } from '@racer/domain/puzzles-preservation-fixtures'
import { RacerDb, type MinigameRunRow } from '../db'
import { preparePuzzlesOnce, type PuzzlePreparationPorts } from './preparation'
import { locksLegacyTraining, usePuzzlePreparation } from './preparation-store'
import { parsePuzzleBackup, PUZZLE_BACKUP_ID } from './backup'
let sequence = 0
const row = (terminal = false): MinigameRunRow => {
  const proof = preservationSparkProof(terminal)
  return { ...proof, kind: 'spark-match', targetKey: 'spark-match:invented-0:1', target: { kind: 'spark-match', umaId: proof.outfitId },
    status: 'open', outcome: null, reward: null, createdAt: 1, completedAt: null }
}
describe('idle preparation coordinator', () => {
  let database: RacerDb, f: ReturnType<typeof preservationFixture>, ports: PuzzlePreparationPorts
  const apply = (result: { writes: PuzzleStoredEntity[]; appends: PuzzleStoredLog[] }) => {
    result.writes.forEach(r => f.entities.set(`${r.kind}/${r.id}`, r)); result.appends.forEach(r => f.logs.set(`${r.kind}/${r.id}`, r))
  }
  beforeEach(async () => {
    vi.stubGlobal('navigator', { onLine: true }); database = new RacerDb(`preparation-test-${++sequence}`); await database.open(); f = preservationFixture(2)
    for (const r of f.entities.values()) await database.table(r.kind).put({ id: r.id, version: r.version, data: r.data })
    usePuzzlePreparation.setState({ phase: 'unavailable', busy: false, message: null, summary: null, preview: false })
    ports = { prepare: vi.fn(async request => { const r = resolvePuzzlePreservation({ enabled: true, now: 10, ...f }, request); apply(r); return r.response }),
      retire: vi.fn(async request => { const r = resolveLegacySpark(request, f.entities, f.logs, 10); apply(r); return r.response }),
      snapshot: vi.fn(async () => ({ serverTime: 10, entities: [...f.entities.values()], logs: [...f.logs.values()] })),
      verifyReplacement: vi.fn(async () => undefined), commitTerminal: vi.fn(async () => undefined), publish: vi.fn(async () => undefined),
      schedule: vi.fn(), today: () => '2000-01-01' }
  })
  afterEach(async () => { await database.delete(); vi.unstubAllGlobals() })
  it('disabled startup invokes nothing, even if the database is unopened', async () => {
    database.close(); expect(await preparePuzzlesOnce(database, ports, false)).toBe(false)
    expect(ports.prepare).not.toHaveBeenCalled(); expect(ports.verifyReplacement).not.toHaveBeenCalled(); expect(database.isOpen()).toBe(false)
  })
  it('locks legacy spending after an uncertain reply without changing capability-off play', () => {
    usePuzzlePreparation.setState({ phase: 'recoverable-error' })
    expect(locksLegacyTraining(usePuzzlePreparation.getState(), true)).toBe(true)
    expect(locksLegacyTraining(usePuzzlePreparation.getState(), false)).toBe(false)
    usePuzzlePreparation.setState({ phase: 'needs-sync' })
    expect(locksLegacyTraining(usePuzzlePreparation.getState(), true)).toBe(false)
  })
  it('waits for ordinary migration/terminal queues and verifies replacement before any request', async () => {
    await database.outbox.add({ kind: 'umas', id: 'invented-0', op: 'upsert', queuedAt: 1 })
    expect(await preparePuzzlesOnce(database, ports, true)).toBe(false); expect(usePuzzlePreparation.getState().phase).toBe('needs-sync')
    expect(ports.verifyReplacement).not.toHaveBeenCalled(); await database.outbox.clear()
    ports.verifyReplacement = vi.fn(async () => { throw new Error('Missing replacement art') })
    await preparePuzzlesOnce(database, ports, true); expect(usePuzzlePreparation.getState().message).toMatch(/Missing replacement/)
    expect(ports.prepare).not.toHaveBeenCalled(); expect(await database.constellationBank.count()).toBe(0)
  })
  it('retains all canonical entities/logs and local old journals before any retirement or freeze, once across reload', async () => {
    const run = row(); await database.minigameRuns.put(run)
    const retire = ports.retire
    ports.retire = async request => {
      const saved = (await database.puzzleArchives.get(PUZZLE_BACKUP_ID))!
      const backup = parsePuzzleBackup(saved.data)
      expect(backup.stage).toBe('pre-cutover'); expect(backup.snapshot.entities).toHaveLength(f.entities.size)
      expect(backup.snapshot.logs).toHaveLength(f.logs.size); expect(backup.minigameRuns).toEqual([run])
      return retire(request)
    }
    await preparePuzzlesOnce(database, ports, true)
    const before = await database.puzzleArchives.get(PUZZLE_BACKUP_ID)
    database.close(); await database.open(); await preparePuzzlesOnce(database, ports, true)
    expect(await database.puzzleArchives.get(PUZZLE_BACKUP_ID)).toEqual(before)
  })
  it('failed or racing backup capture blocks all protected changes without erasing the save', async () => {
    ports.snapshot = vi.fn(async () => { throw new Error('Backup unavailable') })
    await preparePuzzlesOnce(database, ports, true)
    expect(usePuzzlePreparation.getState().message).toMatch(/Backup/); expect(ports.prepare).not.toHaveBeenCalled(); expect(ports.retire).not.toHaveBeenCalled()
    ports.snapshot = async () => {
      await database.outbox.add({ kind: 'umas', id: 'invented-0', op: 'upsert', queuedAt: 1 })
      return { serverTime: 10, entities: [...f.entities.values()], logs: [...f.logs.values()] }
    }
    await preparePuzzlesOnce(database, ports, true); expect(usePuzzlePreparation.getState().message).toMatch(/New progress/)
    expect(await database.puzzleArchives.count()).toBe(0); expect(await database.umas.count()).toBe(2)
  })
  it('adopts a lost freeze acknowledgement on retry without another cohort or credit, including reopen', async () => {
    await preparePuzzlesOnce(database, ports, true); expect(usePuzzlePreparation.getState().preview).toBe(true)
    const real = ports.prepare; ports.prepare = async r => { await real(r); throw new Error('Lost reply') }
    await preparePuzzlesOnce(database, ports, true); expect(await database.constellationBank.count()).toBe(0)
    database.close(); await database.open(); ports.prepare = real
    for (let n = 0; n < 4; n++) await preparePuzzlesOnce(database, ports, true)
    expect(usePuzzlePreparation.getState().phase).toBe('active'); expect(await database.puzzleCohort.count()).toBe(2)
    expect((await database.profile.get('main'))!.data.schemaVersion).toBe(16); expect((await database.items.get('training:level-up-ticket'))!.data.quantity).toBe(4)
    expect(await database.itemLedger.count()).toBe(1); expect(ports.retire).not.toHaveBeenCalled()
  })
  it('a failed archive write or wrong-account retained backup blocks cutover and retains recovery evidence', async () => {
    const write = vi.spyOn(database.puzzleArchives, 'add').mockRejectedValueOnce(new Error('Disk full'))
    await preparePuzzlesOnce(database, ports, true)
    expect(ports.prepare).not.toHaveBeenCalled(); expect(ports.retire).not.toHaveBeenCalled()
    expect(usePuzzlePreparation.getState().message).toMatch(/Disk full/); write.mockRestore()
    await preparePuzzlesOnce(database, ports, true)
    const saved = (await database.puzzleArchives.get(PUZZLE_BACKUP_ID))!
    const profile = (await database.profile.get('main'))!; profile.data.createdAt++
    await database.profile.put(profile); vi.mocked(ports.prepare).mockClear()
    await preparePuzzlesOnce(database, ports, true)
    expect(ports.prepare).not.toHaveBeenCalled(); expect(usePuzzlePreparation.getState().message).toMatch(/identity changed/)
    expect(await database.puzzleArchives.get(PUZZLE_BACKUP_ID)).toEqual(saved)
  })
  it('preserves concurrent racing/config edits while adopting receipt-owned level/schema', async () => {
    await preparePuzzlesOnce(database, ports, true); await preparePuzzlesOnce(database, ports, true)
    const real = ports.prepare; ports.prepare = async r => {
      const ack = await real(r), u = (await database.umas.get('invented-0'))!
      u.data.exp = 72; u.data.activePreset = 'long'; await database.umas.put(u); return ack
    }
    await preparePuzzlesOnce(database, ports, true)
    expect((await database.umas.get('invented-0'))!.data).toMatchObject({ schemaVersion: 16, exp: 72, activePreset: 'long' })
  })
  it('reconciles a lost batch and final reply from canonical fields without wiping unrelated local progress', async () => {
    const u = (await database.umas.get('invented-0'))!; u.data.scenarios[0]!.trainingExp = 700; await database.umas.put(u)
    ;(f.entities.get('umas/invented-0')!.data.scenarios as { trainingExp: number }[])[0]!.trainingExp = 700
    await preparePuzzlesOnce(database, ports, true); await preparePuzzlesOnce(database, ports, true)
    const real = ports.prepare; ports.prepare = async r => { await real(r); throw new Error('Lost batch') }
    await preparePuzzlesOnce(database, ports, true); expect((await database.umas.get('invented-0'))!.data.scenarios[0]!.trainingExp).toBe(700)
    const changed = (await database.umas.get('invented-0'))!; changed.data.exp = 72; changed.data.activePreset = 'long'; await database.umas.put(changed)
    await database.items.put({ id: 'invented:unrelated', version: 1, data: { itemId: 'invented:unrelated', quantity: 7, updatedAt: 1 } })
    ports.prepare = real; await preparePuzzlesOnce(database, ports, true)
    expect(usePuzzlePreparation.getState().message).toBeNull()
    expect(f.entities.get('umas/invented-0')!.data).toMatchObject({ schemaVersion: 16, scenarios: [{ trainingExp: 0 }] })
    const canonical = parseSaveSnapshotOrThrow({ serverTime: 10, entities: [...f.entities.values()], logs: [...f.logs.values()] }).entities.find(r => r.kind === 'umas' && r.id === 'invented-0')!
    expect(canonical.data).toMatchObject({ scenarios: [{ trainingExp: 0 }] })
    expect((await database.umas.get('invented-0'))!.version).toBeLessThanOrEqual(canonical.version)
    expect(ports.snapshot).toHaveBeenCalledTimes(2); expect((await database.umas.get('invented-0'))!.data.scenarios[0]!.trainingExp).toBe(0)
    expect((await database.umas.get('invented-0'))!.data).toMatchObject({ exp: 72, activePreset: 'long' })
    expect((await database.items.get('invented:unrelated'))!.data.quantity).toBe(7)
    ports.prepare = async r => { await real(r); throw new Error('Lost finalization') }; await preparePuzzlesOnce(database, ports, true)
    ports.prepare = real
    const snapshot = ports.snapshot; ports.snapshot = async () => {
      const canonical = await snapshot(), future = structuredClone((await database.umas.get('invented-1'))!)
      future.id = 'future-outfit'; future.data.templateId = 'future-outfit'; future.data.schemaVersion = 15
      await database.umas.put(future); return canonical
    }
    await preparePuzzlesOnce(database, ports, true)
    expect(usePuzzlePreparation.getState().phase).toBe('active'); expect(snapshot).toHaveBeenCalledTimes(3)
    expect(await database.itemLedger.count()).toBe(1); expect((await database.items.get('training:level-up-ticket'))!.data.quantity).toBe(4)
    expect((await database.umas.get('future-outfit'))!.data.schemaVersion).toBe(16)
    expect(await database.puzzleCohort.count()).toBe(2)
    expect(await database.outbox.toArray()).toMatchObject([{ kind: 'umas', id: 'future-outfit' }])
  })
  it('commits terminal pending through the old host before freeze and leaves unknown journals untouched', async () => {
    await database.minigameRuns.put(row(true)); await preparePuzzlesOnce(database, ports, true)
    expect(ports.commitTerminal).toHaveBeenCalledOnce(); expect(ports.prepare).not.toHaveBeenCalled(); expect(ports.retire).not.toHaveBeenCalled()
    const bad = row(); delete bad.journal; await database.minigameRuns.put(bad)
    await preparePuzzlesOnce(database, ports, true); expect(usePuzzlePreparation.getState().phase).toBe('recoverable-error')
    expect(await database.minigameRuns.get(bad.id)).toEqual(bad)
  })
  it('adopts exact stable refund and closes only unfinished Spark, leaving Friendship untouched', async () => {
    const run = row(); await database.minigameRuns.put(run)
    const paid = { resource: 'tickets', delta: -5, reason: 'training', localDay: '2000-01-01', createdAt: 1 }
    f.entities.get('profile/main')!.data.tickets = 60
    const local = (await database.profile.get('main'))!; local.data.tickets = 60; await database.profile.put(local)
    f.logs.set(`ledger/${run.id}`, { kind: 'ledger', id: run.id, data: paid, createdAt: 1 })
    const friendship = { ...run, id: 'friendship-history', kind: 'friendship-training', target: { kind: 'friendship-training', cardId: 'invented-card' } } as MinigameRunRow
    await database.minigameRuns.put(friendship); await preparePuzzlesOnce(database, ports, true)
    expect((await database.profile.get('main'))!.data.tickets).toBe(65)
    expect((await database.minigameRuns.get(run.id))!).toMatchObject({ status: 'completed', seed: run.seed, journal: run.journal })
    expect(await database.minigameRuns.get(friendship.id)).toEqual(friendship)
    await preparePuzzlesOnce(database, ports, true); expect(ports.retire).toHaveBeenCalledOnce()
  })
  it('preserves another-device terminal journal after freeze, without applying EXP or refund', async () => {
    await preparePuzzlesOnce(database, ports, true); await preparePuzzlesOnce(database, ports, true)
    const run = row(true); await database.minigameRuns.put(run); await preparePuzzlesOnce(database, ports, true)
    expect(usePuzzlePreparation.getState().message).toMatch(/forward recovery/); expect(ports.commitTerminal).not.toHaveBeenCalled(); expect(ports.retire).not.toHaveBeenCalled()
    expect(await database.minigameRuns.get(run.id)).toEqual(run)
  })
  it('rejects unrelated/malformed acknowledgements and clears busy even after generation changes', async () => {
    ports.prepare = async () => ({ status: 'active', message: null, summary: null, entities: [], logs: [] })
    await preparePuzzlesOnce(database, ports, true); expect(await database.constellationBank.count()).toBe(0); expect(usePuzzlePreparation.getState().busy).toBe(false)
    let current = true; ports.current = () => current; ports.verifyReplacement = async () => { current = false }
    await preparePuzzlesOnce(database, ports, true); expect(usePuzzlePreparation.getState().busy).toBe(false)
  })
})
