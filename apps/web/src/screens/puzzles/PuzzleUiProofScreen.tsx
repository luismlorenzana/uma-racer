// DEV route only; one resumable synthetic store, no auth/provider/runtime or real rewards (T112).
import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { PUZZLE_ENTITY_KINDS, resolvePuzzleOperations, resolvePuzzleTakeover, type PuzzleStoredEntity, type PuzzleStoredLog } from '@racer/domain'
import { RacerDb } from '../../game/db'
import { PersistentPuzzleHost, type PuzzleHostOptions } from '../../game/puzzles/host'
import { createIsolatedPuzzleProof } from '../../game/puzzles/proof'
import { PuzzleGate, PuzzleProvider, type PuzzleEnvironment } from './PuzzleContext'
import { proofCast, proofIdentity, puzzleUiProofData } from './ui-proof-data'
const PROOF_DATABASE = 'puzzle-proof-t117-empty-picker-v1'
const boots = new Map<string, Promise<PuzzleEnvironment>>()
export async function createPuzzleUiProofEnvironment(name = PROOF_DATABASE, variant: 'default' | 'setup' | 'first-use' = 'default', root = '/dev/puzzles-ui-proof'): Promise<PuzzleEnvironment & { database: RacerDb }> {
  if (!/^puzzle-proof-[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Proof storage must be isolated')
  const fixture = puzzleUiProofData(variant), probe = new RacerDb(name); await probe.open()
  let database = probe, host: PersistentPuzzleHost
  const acquire: PuzzleHostOptions['acquire'] = async identity => {
    if (identity && JSON.stringify(identity) !== JSON.stringify(proofIdentity)) throw new Error('Invented retained pack unavailable')
    return { identity: proofIdentity, cast: proofCast, release: () => {} }
  }
  const options: Omit<PuzzleHostOptions, 'database' | 'enabled'> = { deviceId: 'invented-ui-device', source: id => {
    const source = fixture.sources.find(s => s.templateId === id); if (!source) throw new Error('Outfit unavailable'); return source
  }, acquire, content: fixture.content, schedule: () => {} }
  if (!await probe.constellationBank.count()) {
    if ((await Promise.all(probe.tables.map(t => t.count()))).some(Boolean)) { probe.close(); throw new Error('Incomplete proof store retained; use a new isolated namespace') }
    probe.close(); const created = await createIsolatedPuzzleProof(name, fixture.rows, options); database = created.database; host = created.host
  } else host = new PersistentPuzzleHost({ ...options, database, enabled: true })
  // In-memory synthetic authority only. It never calls an API or reads the owner database.
  const entities = new Map<string, PuzzleStoredEntity>(), logs = new Map<string, PuzzleStoredLog>()
  for (const kind of [...PUZZLE_ENTITY_KINDS, 'umas', 'items']) for (const row of await database.table(kind).toArray()) {
    const r: PuzzleStoredEntity = { kind, id: row.id as string, data: row.data, version: row.version as number, deleted: false, updatedAt: 1 }
    entities.set(`${kind}/${r.id}`, r)
  }
  // Reload may see optimistic projections. Simulated authority starts from their retained canonical bases.
  for (const base of await database.puzzleBases.toArray()) {
    if (base.record) entities.set(base.id, base.record); else entities.delete(base.id)
  }
  for (const kind of ['puzzleOperations', 'puzzleResults', 'itemLedger']) for (const row of await database.table(kind).toArray()) {
    const r: PuzzleStoredLog = { kind, id: row.id as string, data: row.data, createdAt: row.createdAt as number }; logs.set(`${kind}/${r.id}`, r)
  }
  const online: NonNullable<PuzzleHostOptions['online']> = { available: () => navigator.onLine, flush: async () => {
    for (let batch = await host.coordinator.nextBatch(); batch.length; batch = await host.coordinator.nextBatch()) {
      const result = resolvePuzzleOperations({ enabled: true, accountSeed: 'invented-ui-cutover', now: 10, entities, logs }, batch)
      result.writes.forEach(r => entities.set(`${r.kind}/${r.id}`, r)); result.appends.forEach(r => logs.set(`${r.kind}/${r.id}`, r))
      await host.coordinator.adopt(batch, result.responses, 10)
    }
    await database.outbox.clear()
  }, takeover: async request => {
    const result = resolvePuzzleTakeover({ enabled: true, accountSeed: 'invented-ui-cutover', now: 11, entities, logs }, request)
    result.writes.forEach(r => entities.set(`${r.kind}/${r.id}`, r)); return result.response
  }, snapshot: async () => ({ serverTime: 12, entities: [...entities.values()], logs: [...logs.values()] }) }
  host = new PersistentPuzzleHost({ ...options, database, enabled: true, online })
  return { host, database, content: fixture.content, ownedIds: fixture.sources.map(s => s.templateId), root, isolated: true, acquire }
}
export function PuzzleUiProofShell() {
  const { pathname } = useLocation()
  const variant = pathname.startsWith('/dev/puzzles-ui-proof/first-use') ? 'first-use' : pathname.startsWith('/dev/puzzles-ui-proof/setup') ? 'setup' : 'default'
  const root = variant === 'default' ? '/dev/puzzles-ui-proof' : `/dev/puzzles-ui-proof/${variant}`
  const name = variant === 'default' ? PROOF_DATABASE : `puzzle-proof-t117-${variant}-v1`
  const [environment, setEnvironment] = useState<PuzzleEnvironment | null>(null), [error, setError] = useState<string | null>(null)
  useEffect(() => { let cancelled = false; const boot = boots.get(name) ?? createPuzzleUiProofEnvironment(name, variant, root); boots.set(name, boot)
    void boot.then(v => { if (!cancelled) setEnvironment(v) }).catch(e => { if (!cancelled) setError(String(e)) }); return () => { cancelled = true }
  }, [name, variant, root])
  if (!environment) return <PuzzleGate title={error ? 'Isolated proof unavailable' : 'Preparing isolated proof'}>{error ?? 'Original invented portraits, enemies and account only. No sign-in, real save, tickets or rewards.'}</PuzzleGate>
  return <PuzzleProvider environment={environment}><Outlet /></PuzzleProvider>
}
