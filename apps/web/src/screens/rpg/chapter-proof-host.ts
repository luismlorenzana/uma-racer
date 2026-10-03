// DEV ONLY: real chapter/battle hosts, separate client + simulated-account Dexie databases, invented content.
import { type EntityRecord, type LogRecord, type RpgCommandRequest, type RpgCommandReceiptV1, type RpgPresetSaveV1 } from '@racer/domain'
import { syntheticChapterPack, syntheticChapterProfiles } from '../../../../../packages/domain/src/rpg/chapter.synthetic'
import { RacerDb } from '../../game/db'
import { RpgChapterHost } from '../../game/rpg-chapter-host'
import { flushOneRpgCommand } from '../../game/rpg-sync'
import type { saveApi } from '../../api/client'
import Dexie, { type Table } from 'dexie'
import { RpgProgressionHost } from '../../game/rpg-progression-host'

type ProofServer = Dexie & { entities: Table<EntityRecord & { key: string }, string>; logs: Table<LogRecord & { key: string }, string> }
export class ChapterProof {
  readonly database: RacerDb
  readonly server: ProofServer
  readonly host: RpgChapterHost
  readonly progression: RpgProgressionHost
  readonly uid = 'chapter-proof'
  readonly ready: Promise<void>
  constructor(name = 'uma-rpg-chapter-proof-v1') {
    this.database = new RacerDb(name)
    this.server = new Dexie(`${name}-account`) as ProofServer
    this.server.version(1).stores({ entities: '&key', logs: '&key' })
    const pack = syntheticChapterPack()
    this.host = new RpgChapterHost(async () => pack, this.database, Date.now, this.transport)
    this.progression = new RpgProgressionHost(this.database)
    this.ready = this.seed()
  }
  private async seed() {
    if (await this.database.rpgPresets.count()) return
    const profiles = syntheticChapterProfiles()
    const preset: RpgPresetSaveV1 = { schemaVersion: 1, presetId: 'party-1', name: 'Crossroads party', foregroundChapterId: null,
      slots: profiles.map((p) => ({ outfitId: p.outfitId, signature: p.defaultSignature,
        loadout: p.tree.map(({ level: _level, ...ref }) => ref) })) as RpgPresetSaveV1['slots'] }
    await this.database.rpgPresets.put({ id: preset.presetId, data: preset, version: 1 })
    await this.server.entities.put({ key: `rpgPresets/${preset.presetId}`, kind: 'rpgPresets', id: preset.presetId,
      version: 1, deleted: false, updatedAt: 1, data: preset as unknown as Record<string, unknown> })
    for (const p of profiles) {
      const data = { schemaVersion: 1 as const, profile: p, projectionRevision: 0 }
      await this.database.rpgOutfits.put({ id: p.outfitId, data, version: 1 })
      await this.server.entities.put({ key: `rpgOutfits/${p.outfitId}`, kind: 'rpgOutfits', id: p.outfitId,
        version: 1, deleted: false, updatedAt: 1, data: data as unknown as Record<string, unknown> })
    }
  }
  private transport: Pick<typeof saveApi, 'rpgCommand' | 'load'> = {
    load: async () => ({ entities: (await this.server.entities.toArray()).map(({ key: _key, ...row }) => row),
      logs: (await this.server.logs.toArray()).map(({ key: _key, ...row }) => row), serverTime: Date.now() }),
    rpgCommand: async (body: RpgCommandRequest) => this.server.transaction('rw', this.server.entities, this.server.logs, async () => {
      const payloadHash = [...new Uint8Array(await Dexie.waitFor(crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(body)))))].map((v) => v.toString(16).padStart(2, '0')).join('')
      const previous = await this.server.logs.get(`rpgReceipts/${body.commandId}`)
      if (previous) return { status: 'duplicate' as const, receipt: previous.data, entities: [], logs: [] }
      const expected = await Promise.all(body.expected.map(async (e) => ({ ...e, row: await this.server.entities.get(`${e.kind}/${e.id}`) })))
      if (expected.some((e) => (e.row?.version ?? 0) !== e.version)) return { status: 'conflict' as const,
        authoritative: expected.map((e) => ({ kind: e.kind, id: e.id, record: e.row ?? null })) }
      const entities: EntityRecord[] = body.upserts.map((u) => ({ ...u, version: (expected.find((e) => e.kind === u.kind && e.id === u.id)?.version ?? 0) + 1, deleted: false, updatedAt: Date.now() }))
      const receipt: RpgCommandReceiptV1 = { schemaVersion: 1, commandId: body.commandId, action: body.action, payloadHash,
        applied: entities.map((e) => ({ kind: e.kind, id: e.id, version: e.version })), appendedIds: body.appends.map((a) => a.id), createdAt: Date.now() }
      const logs: LogRecord[] = [...body.appends, { kind: 'rpgReceipts', id: body.commandId,
        data: receipt as unknown as Record<string, unknown>, createdAt: receipt.createdAt }]
      for (const row of entities) await this.server.entities.put({ ...row, key: `${row.kind}/${row.id}` })
      for (const row of logs) await this.server.logs.put({ ...row, key: `${row.kind}/${row.id}` })
      return { status: 'applied' as const, receipt, entities, logs }
    }),
  }
  async sync() { await this.ready; while (await flushOneRpgCommand(this.database, this.transport)) { /* Drain dependency order. */ } }
  async staleDevice() {
    await this.ready
    const cps = (await this.server.entities.toArray()).filter((e) => e.kind === 'rpgCheckpoints')
    for (const cp of cps) await this.server.entities.put({ ...cp, version: cp.version + 1 })
  }
  async promotionProbe() {
    await this.reset()
    for (const row of await this.database.rpgOutfits.toArray()) {
      const data = { ...row.data, profile: { ...row.data.profile, level: 50, exp: 657 } }
      await this.database.rpgOutfits.put({ ...row, data })
      const server = (await this.server.entities.get(`rpgOutfits/${row.id}`))!
      await this.server.entities.put({ ...server, data: data as unknown as Record<string, unknown> })
    }
  }
  async reset() {
    // Only this named proof's rows; no account database is opened or deleted.
    await this.database.transaction('rw', this.database.tables, async () => { for (const table of this.database.tables) await table.clear() })
    await this.server.transaction('rw', this.server.tables, async () => { for (const table of this.server.tables) await table.clear() })
    await this.seed()
  }
}
