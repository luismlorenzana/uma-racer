// Production persistence for generation 2 (docs/rework/13-removals-and-plan-changes.md §6; docs/rearchitecture/07-data-
// reset.md §3; T135): `saves/{uid}/{kind}/{id}`, one small document per row, stored through the codec (a work row's
// arrays of arrays become `dataJson`, D151). A sync is one transaction, every read before the first write. Historical
// `meta` audit records are not save kinds: neither sync nor pulls read or change them (T144, D362).
import * as admin from 'firebase-admin'
import { KIND_ORDER, rowKey, RULE_LEDGER_REASONS, SAVE_LIMITS, type SaveSnapshotV2,
  type SyncRequestV2, type SyncResponseV2 } from '@racer/domain/save'
import { fromStored, toStored } from './firestore-codec'
import { needsOperationEnv, NO_SAVE, parseCursor, pullFloor, resolveSync, selectReadSet, snapshotPage, syncReadSet, type NoSave,
  type SaveRow } from './resolve'
import type { OperationEnvLoader, SaveRepository } from './save.repository'

type Firestore = admin.firestore.Firestore
type Data = Record<string, unknown>

export class FirestoreSaveRepository implements SaveRepository {
  constructor(private readonly injectedDb?: Firestore, private readonly clock: () => number = Date.now) {}

  private get db(): Firestore {
    if (this.injectedDb) return this.injectedDb
    if (admin.apps.length === 0) admin.initializeApp()
    return admin.firestore()
  }

  private save(uid: string) {
    return this.db.collection('saves').doc(uid)
  }

  async snapshot(uid: string, since: number, cursor: string | null): Promise<SaveSnapshotV2> {
    const after = cursor === null ? null : parseCursor(cursor)
    if (cursor !== null && after === null) throw new RangeError('an invalid cursor')
    const save = this.save(uid)
    const now = this.clock()
    // One row past a full page is enough to know another page follows.
    const rows: SaveRow[] = []
    for (const kind of KIND_ORDER.slice(after === null ? 0 : KIND_ORDER.indexOf(after.kind))) {
      const room = SAVE_LIMITS.pageRows + 1 - rows.length
      if (room <= 0) break
      let query = save.collection(kind).where('savedAt', '>', pullFloor(kind, since, now))
        .orderBy('savedAt').orderBy(admin.firestore.FieldPath.documentId())
      if (after?.kind === kind) query = query.startAfter(after.savedAt, after.id)
      const snap = await query.limit(room).get()
      for (const doc of snap.docs) rows.push(fromStored<SaveRow>(doc.data()))
    }
    return snapshotPage(rows, since, cursor, now)
  }

  async sync(uid: string, request: SyncRequestV2, env: OperationEnvLoader): Promise<SyncResponseV2 | NoSave> {
    // Content loads before the transaction: a missing pack throws here, and nothing is read or written.
    const operationEnv = needsOperationEnv(request) ? await env() : undefined
    const readSet = syncReadSet(request)
    const save = this.save(uid)
    const ref = (key: string) => {
      const slash = key.indexOf('/')
      return save.collection(key.slice(0, slash)).doc(key.slice(slash + 1))
    }
    return this.db.runTransaction(async (tx) => {
      const [collections, ledger, documents] = await Promise.all([
        Promise.all(readSet.collections.map((kind) => tx.get(save.collection(kind)))),
        readSet.ruleLedger ? tx.get(save.collection('ledger').where('data.reason', 'in', [...RULE_LEDGER_REASONS])) : Promise.resolve(null),
        readSet.documents.length > 0 ? tx.getAll(...readSet.documents.map(ref)) : Promise.resolve([]),
      ])
      const rows: SaveRow[] = []
      for (const snap of collections) for (const doc of snap.docs) rows.push(fromStored<SaveRow>(doc.data()))
      for (const doc of ledger?.docs ?? []) rows.push(fromStored<SaveRow>(doc.data()))
      for (const doc of documents) if (doc.exists) rows.push(fromStored<SaveRow>(doc.data() as Data))
      // Every read has completed; nothing is read after the first write.
      const resolved = resolveSync(selectReadSet(rows, readSet), request, this.clock(), operationEnv)
      if (resolved === NO_SAVE) return NO_SAVE
      for (const row of [...resolved.entities, ...resolved.logs]) tx.set(ref(rowKey(row)), toStored(row))
      return resolved.response
    })
  }

}
