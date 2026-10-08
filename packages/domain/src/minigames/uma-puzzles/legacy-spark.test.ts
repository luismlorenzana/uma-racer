import { describe, expect, it } from 'vitest'
import { syntheticSparkEncounter } from '../spark-rival/fixtures'
import { replaySparkRival } from '../spark-rival/engine'
import { preservationFixture } from './preservation.synthetic'
import { legacySparkSeed, parseLegacySparkRequest, resolveLegacySpark, type LegacySparkProof, type LegacySparkRequest } from './legacy-spark'
function sparkProof(terminal = false): LegacySparkProof {
  const encounter = syntheticSparkEncounter(); encounter.trainee.templateId = 'invented-0'
  const proof: LegacySparkProof = { id: 'spark-match:invented-0:1:0', outfitId: 'invented-0', tier: 1, attemptIndex: 0, seed: '',
    snapshot: { version: 1, contentVersion: 'invented-v1', source: 'fallback', encounter }, journal: { format: 1, engine: 'spark-rival-v1', actions: [] } }
  proof.seed = legacySparkSeed(1, proof)
  if (terminal) for (let i = 0; i < 180 && !replaySparkRival(encounter, proof.seed, proof.journal.actions).outcome; i++)
    proof.journal.actions.push({ type: 'drag', path: [{ row: 0, column: 0 }, { row: 0, column: 1 }], movementMs: 500 })
  return proof
}
describe('versioned Spark retirement evidence', () => {
  const request = (terminal = false): LegacySparkRequest => ({ schemaVersion: 1, disposition: terminal ? 'committed' : 'unfinished', localDay: '2000-01-01', run: sparkProof(terminal) })
  function paid() {
    const f = preservationFixture(1), run = request().run
    f.entities.get('profile/main')!.data.tickets = 60
    f.logs.set(`ledger/${run.id}`, { kind: 'ledger', id: run.id, data: { resource: 'tickets', delta: -5, reason: 'training', localDay: '2000-01-01', createdAt: 1 }, createdAt: 1 })
    const resolve = (req = request()) => {
      const result = resolveLegacySpark(req, f.entities, f.logs, 5)
      result.writes.forEach(r => f.entities.set(`${r.kind}/${r.id}`, r)); result.appends.forEach(r => f.logs.set(`${r.kind}/${r.id}`, r)); return result
    }
    return { ...f, resolve }
  }
  it('returns the original paid cost once even above the daily storage cap, with stable evidence on another device', () => {
    const f = paid(); expect(f.resolve().response.status).toBe('refunded'); expect(f.entities.get('profile/main')!.data.tickets).toBe(65)
    expect(f.resolve().writes).toEqual([]); expect(f.logs.size).toBe(2)
    const older = request(); older.localDay = '2000-01-02'; expect(f.resolve(older).writes).toEqual([])
  })
  it('distinguishes terminal pending from unfinished, retains committed evidence, and never applies EXP plus a refund', () => {
    const f = paid(), terminal = request(true)
    expect(parseLegacySparkRequest({ ...terminal, disposition: 'unfinished' })).toBeNull()
    expect(f.resolve(terminal).response.status).toBe('committed')
    expect(f.resolve().response.status).toBe('committed'); expect(f.entities.get('profile/main')!.data.tickets).toBe(60)
    const g = paid(); g.resolve(); expect(() => g.resolve(terminal)).toThrow(/Never apply EXP/)
  })
  it('requires original paid evidence and the save-derived seed; malformed/unknown engines never invent a refund', () => {
    const f = paid(), invalid = request(); invalid.run.seed = 'not-the-original'
    expect(() => f.resolve(invalid)).toThrow(/seed/)
    f.logs.clear(); expect(() => f.resolve()).toThrow(/reservation/)
    expect(parseLegacySparkRequest({ ...request(), run: { ...request().run, journal: { format: 2, engine: 'unknown', actions: [] } } })).toBeNull()
  })
  it('refuses late terminal settlement after freeze, but unfinished retirement remains exact-once', () => {
    const f = paid(); f.apply()
    expect(() => f.resolve(request(true))).toThrow(/before freezing/)
    expect(f.resolve().response.status).toBe('refunded'); expect(f.resolve().writes).toEqual([])
  })
  it('adopts valid existing refund evidence without returning another ticket', () => {
    const f = paid(), id = `${request().run.id}:refund`
    f.logs.set(`ledger/${id}`, { kind: 'ledger', id, createdAt: 2, data: { resource: 'tickets', delta: 5, reason: 'minigame-refund', localDay: '2000-01-01', createdAt: 2 } })
    expect(f.resolve().appends).toEqual([]); expect(f.entities.get('profile/main')!.data.tickets).toBe(60)
  })
})
