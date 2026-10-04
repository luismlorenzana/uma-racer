import { Logger } from '@nestjs/common'
import * as admin from 'firebase-admin'
import { isDeepStrictEqual } from 'node:util'
import { fromStored, toStored } from './firestore-codec'
import { freezeAdvance, advanceOutfit, bankData } from './inspiration-advance'
import { resolveRpgCommand, type RpgCommandRequest, type RpgCommandResponse } from './rpg-command'
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

  constructor(private readonly injectedDb?: admin.firestore.Firestore) {}

  private get db(): admin.firestore.Firestore {
    if (this.injectedDb) return this.injectedDb
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

  async advanceInspiration(uid: string): Promise<SaveSnapshot> {
    const player = this.player(uid), bankRef = player.collection('inspirationBank').doc('main')
    const initial = await this.db.runTransaction(async tx => {
      const [doc] = await tx.getAll(bankRef)
      if (doc!.exists) return fromStored<EntityRecord>(doc!.data()!)
      const owned = await tx.get(player.collection('umas'))
      const bank = freezeAdvance(owned.docs.map(d => fromStored<EntityRecord>(d.data())), Date.now())
      if (bank) tx.set(bankRef, toStored(bank))
      return bank
    })
    if (!initial) return { entities: [], logs: [], serverTime: Date.now() }
    const initialBank = bankData(initial), ids = Object.keys(initialBank.cohort)
    for (const id of ids.filter(id => !initialBank.opened.includes(id))) {
      await this.db.runTransaction(async tx => {
        const [bankDoc, umaDoc] = await tx.getAll(bankRef, player.collection('umas').doc(id))
        const bank = fromStored<EntityRecord>(bankDoc!.data()!)
        const uma = umaDoc!.exists ? fromStored<EntityRecord>(umaDoc!.data()!) : undefined
        for (const row of advanceOutfit(bank, uma, id, Date.now())) tx.set(player.collection(row.kind).doc(row.id), toStored(row))
      })
    }
    const rows = await this.db.getAll(bankRef, ...ids.map(id => player.collection('umas').doc(id)))
    return { entities: rows.filter(d => d.exists).map(d => fromStored<EntityRecord>(d.data()!)), logs: [], serverTime: Date.now() }
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

  async rpgCommand(uid: string, request: RpgCommandRequest): Promise<RpgCommandResponse> {
    const player = this.player(uid)
    const now = Date.now()
    return this.db.runTransaction(async (tx) => {
      const entityKeys = new Map<string, { kind: EntityRecord['kind']; id: string }>(request.expected.map((row) => [`${row.kind}/${row.id}`, row]))
      for (const row of request.upserts) entityKeys.set(`${row.kind}/${row.id}`, row)
      // Read independently of client dependencies: older clients must not bypass an account's advance.
      if (request.action === 'choose-node' || request.action === 'clear-chapter') entityKeys.set('inspirationBank/main', { kind: 'inspirationBank', id: 'main' })
      const entityRefs = [...entityKeys.values()].map((row) => player.collection(row.kind).doc(row.id))
      const logRows = [...request.appends, { kind: 'rpgReceipts' as const, id: request.commandId }]
      const logRefs = logRows.map((row) => player.collection(row.kind).doc(row.id))
      const [entityDocs, logDocs] = await Promise.all([
        entityRefs.length ? tx.getAll(...entityRefs) : Promise.resolve([]),
        tx.getAll(...logRefs),
      ])
      const entities = new Map<string, EntityRecord>()
      const logs = new Map<string, LogRecord>()
      entityDocs.forEach((doc) => {
        if (doc.exists) {
          const record = fromStored<EntityRecord>(doc.data()!)
          entities.set(`${record.kind}/${record.id}`, record)
        }
      })
      // Advance/clear consumes existing accepted evidence, never a new client claim.
      if (request.action === 'choose-node' || request.action === 'clear-chapter') {
        const target = request.upserts.find((row) => row.kind === 'rpgCheckpoints')
        const current = target && entities.get(`rpgCheckpoints/${target.id}`)?.data
        const entry = current?.frozenEntry as { entryId: string; retryOrdinal: number } | null | undefined
        if (entry) {
          const [result] = await tx.getAll(player.collection('rpgResults').doc(`${entry.entryId}:retry-${entry.retryOrdinal}`))
          if (result?.exists) {
            const row = fromStored<LogRecord>(result.data()!)
            logs.set(`${row.kind}/${row.id}`, row)
          }
        }
      }
      logDocs.forEach((doc) => {
        if (doc.exists) {
          const record = fromStored<LogRecord>(doc.data()!)
          logs.set(`${record.kind}/${record.id}`, record)
        }
      })
      const resolved = resolveRpgCommand(uid, request, entities, logs, now)
      if (resolved.response.status !== 'applied') return resolved.response
      for (const row of resolved.writes) tx.set(player.collection(row.kind).doc(row.id), toStored(row))
      for (const row of resolved.appends) tx.set(player.collection(row.kind).doc(row.id), toStored(row))
      return resolved.response
    })
  }
}
