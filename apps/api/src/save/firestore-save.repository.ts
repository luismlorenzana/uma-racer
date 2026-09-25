import { Logger } from '@nestjs/common'
import * as admin from 'firebase-admin'
import { isDeepStrictEqual } from 'node:util'
import { fromStored, toStored } from './firestore-codec'
import type { SaveRepository } from './save.repository'
import {
  ENTITY_KINDS,
  LOG_KINDS,
  resolveUpserts,
  type EntityRecord,
  type LogRecord,
  type SaveSnapshot,
  type SyncRequest,
  type SyncResponse,
} from './save.types'

// Production persistence: players/{uid}/{kind}/{id}, one small doc per entity or log record
// (docs/technical/architecture.md#firestore-data-model-saves). On Cloud Run, initializeApp() uses
// Application Default Credentials automatically.
export class FirestoreSaveRepository implements SaveRepository {
  private readonly logger = new Logger('SaveSync')

  private get db(): admin.firestore.Firestore {
    if (admin.apps.length === 0) admin.initializeApp()
    return admin.firestore()
  }

  private player(uid: string) {
    return this.db.collection('players').doc(uid)
  }

  async load(uid: string): Promise<SaveSnapshot> {
    const player = this.player(uid)
    const [entitySnaps, logSnaps] = await Promise.all([
      Promise.all(ENTITY_KINDS.map((kind) => player.collection(kind).get())),
      Promise.all(LOG_KINDS.map((kind) => player.collection(kind).get())),
    ])
    return {
      entities: entitySnaps.flatMap((snap) => snap.docs.map((d) => fromStored<EntityRecord>(d.data()))),
      logs: logSnaps.flatMap((snap) => snap.docs.map((d) => fromStored<LogRecord>(d.data()))),
      serverTime: Date.now(),
    }
  }

  async sync(uid: string, request: SyncRequest): Promise<SyncResponse> {
    const player = this.player(uid)
    const now = Date.now()
    return this.db.runTransaction(async (tx) => {
      const entityRefs = request.upserts.map((u) => player.collection(u.kind).doc(u.id))
      const logRefs = request.appends.map((a) => player.collection(a.kind).doc(a.id))
      const [entityDocs, logDocs] = await Promise.all([
        entityRefs.length ? tx.getAll(...entityRefs) : Promise.resolve([]),
        logRefs.length ? tx.getAll(...logRefs) : Promise.resolve([]),
      ])

      const existing = new Map<string, EntityRecord>()
      for (const doc of entityDocs) {
        if (doc.exists) {
          const record = fromStored<EntityRecord>(doc.data()!)
          existing.set(`${record.kind}/${record.id}`, record)
        }
      }
      const { writes, conflicts } = resolveUpserts(existing, request.upserts, now)
      for (const record of writes) tx.set(player.collection(record.kind).doc(record.id), toStored(record))

      let appended = 0
      request.appends.forEach((a, i) => {
        const record: LogRecord = { kind: a.kind, id: a.id, data: a.data, createdAt: a.createdAt }
        if (logDocs[i]?.exists) {
          // A log id names one event, so the first write wins (D149). Two devices recording the same event, such as
          // the same day's grant, differ only in when; failing the whole batch over that froze sync for five days.
          if (!isDeepStrictEqual(fromStored<LogRecord>(logDocs[i]!.data()!), record)) this.logger.warn(`Kept the first copy of ${a.kind}/${a.id}`)
          return
        }
        tx.set(logRefs[i]!, toStored(record))
        appended++
      })

      return {
        applied: writes.map((w) => ({ kind: w.kind, id: w.id, version: w.version })),
        conflicts,
        appended,
        serverTime: now,
      }
    })
  }
}
