// Aggregate-only synthetic preservation rehearsal; never reads disk saves, private content or credentials.
import { preservationFixture, preservationSparkProof } from '../../packages/domain/src/minigames/uma-puzzles/preservation.synthetic'
import { resolveLegacySpark } from '../../packages/domain/src/minigames/uma-puzzles/legacy-spark'
import { preservationHeader } from '../../packages/domain/src/minigames/uma-puzzles/preservation'
const f = preservationFixture(40)
for (const [index, row] of [...f.entities.values()].filter(r => r.kind === 'umas').entries()) {
  const unit = (row.data.scenarios as { trainingLevel: number; trainingExp: number }[])[0]!
  unit.trainingLevel = 1 + index % 10; unit.trainingExp = unit.trainingLevel === 10 ? 0 : index * 23 % 1250
}
const proof = preservationSparkProof(), paid = { kind: 'ledger', id: proof.id, createdAt: 1,
  data: { resource: 'tickets', delta: -5, reason: 'training', localDay: '2000-01-01', createdAt: 1 } }
f.logs.set(`ledger/${proof.id}`, paid)
const refund = resolveLegacySpark({ schemaVersion: 1, disposition: 'unfinished', localDay: '2000-01-01', run: proof }, f.entities, f.logs, 5)
refund.writes.forEach(r => f.entities.set(`${r.kind}/${r.id}`, r)); refund.appends.forEach(r => f.logs.set(`${r.kind}/${r.id}`, r))
// Snapshot/restore only an in-memory invented account. Production backups are an explicit owner operation.
const backup = structuredClone({ entities: f.entities, logs: f.logs })
const preview = f.apply(f.request('preview')).response.summary!
f.apply(); const lostReply = f.request(); f.apply(lostReply)
if (f.apply(lostReply).writes.length) throw new Error('Lost-response retry advanced twice')
for (let n = 0; preservationHeader(f.entities)?.phase !== 'active' && n < 10; n++) f.apply()
const final = preservationHeader(f.entities)!
if (final.phase !== 'active' || f.apply().writes.length || !final.receipt || final.receipt.credited !== preview.credited) throw new Error('Rehearsal did not finalize once')
const completed = structuredClone({ entities: f.entities, logs: f.logs })
f.entities.clear(); backup.entities.forEach((r, k) => f.entities.set(k, r)); f.logs.clear(); backup.logs.forEach((r, k) => f.logs.set(k, r))
if (f.apply(f.request('preview')).response.summary?.rawExp !== preview.rawExp) throw new Error('Synthetic pre-freeze restore differs')
f.entities.clear(); completed.entities.forEach((r, k) => f.entities.set(k, r)); f.logs.clear(); completed.logs.forEach((r, k) => f.logs.set(k, r))
if (f.apply().writes.length) throw new Error('Restored completed account credited twice')
console.log(JSON.stringify({ syntheticOnly: true, units: preview.units, debt: Object.values(preview.debt).reduce((a, b) => a + b, 0),
  rawExp: preview.rawExp, originalStock: preview.originalStock, ...final.receipt, refundedDailyTickets: 5,
  interruptedRetry: 'pass', preFreezeRestore: 'pass', completedRestoreNoRecredit: 'pass' }, null, 2))
