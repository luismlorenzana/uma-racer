import * as admin from 'firebase-admin'
import { fromStored, toStored } from './firestore-codec'
import { freezeAdvance, advanceOutfit, bankData } from './inspiration-advance'
import { resolveRpgCommand, type RpgCommandRequest, type RpgCommandResponse } from './rpg-command'
import type { SaveRepository } from './save.repository'
import { puzzleSyncReadSet, resolveSyncWithPuzzles, resolveTakeover } from './puzzle-sync'
import { protectFarmSync } from './farm-sync'
import { FARM_KITCHEN_RELEASE_ENABLED } from './farms'
import { PUZZLES_RELEASE_ENABLED, type PuzzleTakeoverRequest, type PuzzleTakeoverResponse } from './puzzles'
import { preservationHeader, preservationPageIndexes, preservationPageId, preservationBatch, puzzleCohortId,
  type PuzzlePreservationRequest, type PuzzlePreservationResponse, type VerifiedPuzzlePreservationContent } from './puzzles'
import { disabledPreservation, unavailablePreservation, resolvePreservation } from './puzzle-preservation'
import { resolveLegacySpark, legacySparkReceiptId, type LegacySparkRequest, type LegacySparkResponse } from './puzzles'
import {
  ENTITY_KINDS,
  LOG_KINDS,
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

  constructor(private readonly injectedDb?: admin.firestore.Firestore, private readonly puzzlesEnabled: boolean = PUZZLES_RELEASE_ENABLED,
    private readonly preservationContent?: (frozenHash?: string) => Promise<VerifiedPuzzlePreservationContent>, private readonly farmEnabled: boolean = FARM_KITCHEN_RELEASE_ENABLED) {}

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
    const readSet = puzzleSyncReadSet(request)
    const player = this.player(uid)
    const now = Date.now()
    return this.db.runTransaction(async (tx) => {
      const reference = (key: string) => { const [kind, id] = key.split('/'); return player.collection(kind!).doc(id!) }
      const entityRefs = readSet.entities.map(reference)
      const logRefs = readSet.logs.map(reference)
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
      const logs = new Map<string, LogRecord>()
      for (const doc of logDocs) if (doc.exists) { const row = fromStored<LogRecord>(doc.data()!); logs.set(`${row.kind}/${row.id}`, row) }
      const resolved = resolveSyncWithPuzzles(uid, request, existing, logs, now, this.puzzlesEnabled, this.farmEnabled)
      // All reads have completed. Coalesce intermediate changes when multiple groups share a document.
      const writes = new Map(resolved.writes.map(row => [`${row.kind}/${row.id}`, row]))
      for (const row of writes.values()) tx.set(player.collection(row.kind).doc(row.id), toStored(row))
      for (const row of resolved.appends) tx.set(player.collection(row.kind).doc(row.id), toStored(row))
      return resolved.response
    })
  }

  async puzzleTakeover(uid: string, request: PuzzleTakeoverRequest): Promise<PuzzleTakeoverResponse> {
    const player = this.player(uid)
    return this.db.runTransaction(async tx => {
      const [checkpoint, result, bank] = await tx.getAll(player.collection('puzzleCheckpoints').doc(request.checkpointId), player.collection('puzzleResults').doc(request.battleId), player.collection('constellationBank').doc('main'))
      const entities = new Map<string, EntityRecord>(), logs = new Map<string, LogRecord>()
      if (checkpoint?.exists) { const row = fromStored<EntityRecord>(checkpoint.data()!); entities.set(`${row.kind}/${row.id}`, row) }
      if (bank?.exists) { const row = fromStored<EntityRecord>(bank.data()!); entities.set(`${row.kind}/${row.id}`, row) }
      if (result?.exists) { const row = fromStored<LogRecord>(result.data()!); logs.set(`${row.kind}/${row.id}`, row) }
      const resolved = resolveTakeover(uid, request, entities, logs, Date.now(), this.puzzlesEnabled)
      for (const row of resolved.writes) tx.set(player.collection(row.kind).doc(row.id), toStored(row))
      return resolved.response
    })
  }

  async preparePuzzles(uid: string, request: PuzzlePreservationRequest): Promise<PuzzlePreservationResponse> {
    if (!this.puzzlesEnabled) return disabledPreservation()
    try {
      if (!this.preservationContent) return unavailablePreservation('Compatible replacement content is unavailable; no progression was changed')
      const player = this.player(uid), saved = await player.collection('puzzlePreservation').doc('main').get()
      const initial = new Map<string, EntityRecord>()
      if (saved.exists) initial.set('puzzlePreservation/main', fromStored<EntityRecord>(saved.data()!))
      const content = await this.preservationContent(preservationHeader(initial)?.contentHash)
      return await this.db.runTransaction(async tx => {
        const entities = new Map<string, EntityRecord>(), logs = new Map<string, LogRecord>()
        const read = async (keys: string[]) => {
          if (!keys.length) return
          const docs = await tx.getAll(...keys.map(k => { const [kind, id] = k.split('/'); return player.collection(kind!).doc(id!) }))
          for (const doc of docs) if (doc.exists) {
            const row = fromStored<EntityRecord>(doc.data()!); entities.set(`${row.kind}/${row.id}`, row)
          }
        }
        await read(['constellationBank/main', 'puzzlePreservation/main', 'profile/main', 'items/training:level-up-ticket'])
        const header = preservationHeader(entities)
        if (!header) {
          const owned = await tx.get(player.collection('umas'))
          for (const doc of owned.docs) { const row = fromStored<EntityRecord>(doc.data()); entities.set(`${row.kind}/${row.id}`, row) }
        } else if (header.phase !== 'active') {
          await read(preservationPageIndexes(header).map(i => `puzzlePreservation/${preservationPageId(i)}`))
          const batch = preservationBatch(entities, header)
          await read([...new Set(batch.flatMap(u => [`umas/${u.outfitId}`, `puzzleCohort/${puzzleCohortId(u.outfitId, u.scenarioId)}`]))])
          const [credit] = await tx.getAll(player.collection('itemLedger').doc(`puzzle-preservation:${header.cutoverId}`))
          if (credit?.exists) { const row = fromStored<LogRecord>(credit.data()!); logs.set(`${row.kind}/${row.id}`, row) }
        }
        const result = resolvePreservation(entities, logs, content, request, Date.now())
        // No read is possible below this line. Freeze pages and each subsequent batch are indivisible.
        for (const row of result.writes) tx.set(player.collection(row.kind).doc(row.id), toStored(row))
        for (const row of result.appends) tx.set(player.collection(row.kind).doc(row.id), toStored(row))
        return result.response
      })
    } catch (error) { return unavailablePreservation(error instanceof Error ? error.message : 'Preparation failed; retry with preserved receipts') }
  }

  async retireSpark(uid: string, request: LegacySparkRequest): Promise<LegacySparkResponse> {
    if (!this.puzzlesEnabled) return { status: 'disabled', message: null, entities: [], logs: [] }
    try {
      const player = this.player(uid)
      if (!this.preservationContent) throw new Error('Compatible replacement content is unavailable; keep the journal')
      const saved = await player.collection('puzzlePreservation').doc('main').get(), initial = new Map<string, EntityRecord>()
      if (saved.exists) initial.set('puzzlePreservation/main', fromStored<EntityRecord>(saved.data()!))
      await this.preservationContent(preservationHeader(initial)?.contentHash)
      return await this.db.runTransaction(async tx => {
        const entityKeys = ['profile/main', 'constellationBank/main', `puzzlePreservation/${legacySparkReceiptId(request.run.id)}`],
          logKeys = [`ledger/${request.run.id}`, `ledger/${request.run.id}:refund`], refs = [...entityKeys, ...logKeys].map(k => {
            const [kind, id] = k.split('/'); return player.collection(kind!).doc(id!) })
        const docs = await tx.getAll(...refs), entities = new Map<string, EntityRecord>(), logs = new Map<string, LogRecord>()
        docs.forEach((doc, i) => {
          if (!doc.exists) return
          if (i < entityKeys.length) { const row = fromStored<EntityRecord>(doc.data()!); entities.set(`${row.kind}/${row.id}`, row) }
          else { const row = fromStored<LogRecord>(doc.data()!); logs.set(`${row.kind}/${row.id}`, row) }
        })
        const result = resolveLegacySpark(request, entities, logs, Date.now())
        for (const row of result.writes) tx.set(player.collection(row.kind).doc(row.id), toStored(row))
        for (const row of result.appends) tx.set(player.collection(row.kind).doc(row.id), toStored(row))
        return result.response
      })
    } catch (error) { return { status: 'recoverable-error', message: error instanceof Error ? error.message : 'Keep the journal and retry retirement', entities: [], logs: [] } }
  }

  async rpgCommand(uid: string, request: RpgCommandRequest): Promise<RpgCommandResponse> {
    const player = this.player(uid)
    const now = Date.now()
    return this.db.runTransaction(async (tx) => {
      const entityKeys = new Map<string, { kind: EntityRecord['kind']; id: string }>(request.expected.map((row) => [`${row.kind}/${row.id}`, row]))
      for (const row of request.upserts) entityKeys.set(`${row.kind}/${row.id}`, row)
      entityKeys.set('farmCutover/main', { kind: 'farmCutover', id: 'main' })
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
      protectFarmSync({ upserts: resolved.writes.map(row => ({ ...row, baseVersion: row.version - 1 })), appends: [], farmProtocolVersion: 1 }, entities, logs)
      for (const row of resolved.writes) tx.set(player.collection(row.kind).doc(row.id), toStored(row))
      for (const row of resolved.appends) tx.set(player.collection(row.kind).doc(row.id), toStored(row))
      return resolved.response
    })
  }
}
