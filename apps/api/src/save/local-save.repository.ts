import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { SaveRepository } from './save.repository'
import { BANK_KEY, freezeAdvance, advanceOutfit, bankData } from './inspiration-advance'
import type { EntityRecord, LogRecord, SaveSnapshot, SyncRequest, SyncResponse } from './save.types'
import { resolveRpgCommand, type RpgCommandRequest, type RpgCommandResponse } from './rpg-command'
import { puzzleSyncReadSet, resolveSyncWithPuzzles, resolveTakeover } from './puzzle-sync'
import { protectFarmSync } from './farm-sync'
import { FARM_KITCHEN_RELEASE_ENABLED } from './farms'
import { PUZZLES_RELEASE_ENABLED, type PuzzleTakeoverRequest, type PuzzleTakeoverResponse } from './puzzles'
import { type PuzzlePreservationRequest, type PuzzlePreservationResponse, type VerifiedPuzzlePreservationContent } from './puzzles'
import { disabledPreservation, unavailablePreservation, resolvePreservation } from './puzzle-preservation'
import { preservationHeader, resolveLegacySpark, type LegacySparkRequest, type LegacySparkResponse } from './puzzles'

interface FileShape {
  [uid: string]: { entities: Record<string, EntityRecord>; logs: Record<string, LogRecord> }
}

// Local dev persistence: one JSON file, written atomically (tmp + rename), with calls serialized in-process.
export class LocalSaveRepository implements SaveRepository {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly file: string, private readonly puzzlesEnabled: boolean = PUZZLES_RELEASE_ENABLED,
    private readonly preservationContent?: (frozenHash?: string) => Promise<VerifiedPuzzlePreservationContent>, private readonly farmEnabled: boolean = FARM_KITCHEN_RELEASE_ENABLED) {}

  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn)
    this.queue = run.catch(() => undefined)
    return run
  }

  private async read(): Promise<FileShape> {
    try {
      return JSON.parse(await readFile(this.file, 'utf8')) as FileShape
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {}
      throw err
    }
  }

  private async write(data: FileShape): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    await writeFile(tmp, JSON.stringify(data, null, 2))
    await rename(tmp, this.file)
  }

  load(uid: string): Promise<SaveSnapshot> {
    return this.serialize(async () => {
      const user = (await this.read())[uid]
      return {
        entities: Object.values(user?.entities ?? {}),
        logs: Object.values(user?.logs ?? {}),
        serverTime: Date.now(),
      }
    })
  }

  advanceInspiration(uid: string): Promise<SaveSnapshot> {
    return this.serialize(async () => {
      const all = await this.read(), user = all[uid] ??= { entities: {}, logs: {} }, now = Date.now()
      const bank = user.entities[BANK_KEY] ?? freezeAdvance(Object.values(user.entities), now)
      if (!bank) return { entities: [], logs: [], serverTime: now }
      user.entities[BANK_KEY] = bank
      for (const id of Object.keys(bankData(bank).cohort)) {
        for (const row of advanceOutfit(user.entities[BANK_KEY]!, user.entities[`umas/${id}`], id, now)) {
          user.entities[`${row.kind}/${row.id}`] = row
        }
      }
      await this.write(all)
      const ids = Object.keys(bankData(user.entities[BANK_KEY]!).cohort)
      return { entities: [user.entities[BANK_KEY]!, ...ids.map(id => user.entities[`umas/${id}`]!)], logs: [], serverTime: now }
    })
  }

  sync(uid: string, request: SyncRequest): Promise<SyncResponse> {
    puzzleSyncReadSet(request)
    return this.serialize(async () => {
      const all = await this.read()
      const user = (all[uid] ??= { entities: {}, logs: {} })
      const now = Date.now()
      const resolved = resolveSyncWithPuzzles(uid, request, new Map(Object.entries(user.entities)), new Map(Object.entries(user.logs)), now, this.puzzlesEnabled, this.farmEnabled)
      for (const record of resolved.writes) user.entities[`${record.kind}/${record.id}`] = record
      for (const record of resolved.appends) user.logs[`${record.kind}/${record.id}`] = record
      await this.write(all)
      return resolved.response
    })
  }

  puzzleTakeover(uid: string, request: PuzzleTakeoverRequest): Promise<PuzzleTakeoverResponse> {
    return this.serialize(async () => {
      const all = await this.read(), user = all[uid] ??= { entities: {}, logs: {} }
      const resolved = resolveTakeover(uid, request, new Map(Object.entries(user.entities)), new Map(Object.entries(user.logs)), Date.now(), this.puzzlesEnabled)
      for (const row of resolved.writes) user.entities[`${row.kind}/${row.id}`] = row
      if (resolved.writes.length) await this.write(all)
      return resolved.response
    })
  }

  preparePuzzles(uid: string, request: PuzzlePreservationRequest): Promise<PuzzlePreservationResponse> {
    if (!this.puzzlesEnabled) return Promise.resolve(disabledPreservation())
    return this.serialize(async () => {
      try {
        if (!this.preservationContent) return unavailablePreservation('Compatible replacement content is unavailable; no progression was changed')
        const all = await this.read(), user = all[uid] ??= { entities: {}, logs: {} }
        const content = await this.preservationContent(preservationHeader(new Map(Object.entries(user.entities)))?.contentHash)
        const result = resolvePreservation(new Map(Object.entries(user.entities)), new Map(Object.entries(user.logs)), content, request, Date.now())
        for (const row of result.writes) user.entities[`${row.kind}/${row.id}`] = row
        for (const row of result.appends) user.logs[`${row.kind}/${row.id}`] = row
        if (result.writes.length) await this.write(all)
        return result.response
      } catch (error) { return unavailablePreservation(error instanceof Error ? error.message : 'Preparation failed; retry with preserved receipts') }
    })
  }

  retireSpark(uid: string, request: LegacySparkRequest): Promise<LegacySparkResponse> {
    if (!this.puzzlesEnabled) return Promise.resolve({ status: 'disabled', message: null, entities: [], logs: [] })
    return this.serialize(async () => {
      try {
        const all = await this.read(), user = all[uid] ??= { entities: {}, logs: {} }
        if (!this.preservationContent) throw new Error('Compatible replacement content is unavailable; keep the journal')
        await this.preservationContent(preservationHeader(new Map(Object.entries(user.entities)))?.contentHash)
        const result = resolveLegacySpark(request, new Map(Object.entries(user.entities)), new Map(Object.entries(user.logs)), Date.now())
        for (const row of result.writes as EntityRecord[]) user.entities[`${row.kind}/${row.id}`] = row
        for (const row of result.appends as LogRecord[]) user.logs[`${row.kind}/${row.id}`] = row
        if (result.writes.length) await this.write(all)
        return result.response
      } catch (error) { return { status: 'recoverable-error', message: error instanceof Error ? error.message : 'Keep the journal and retry retirement', entities: [], logs: [] } }
    })
  }

  rpgCommand(uid: string, request: RpgCommandRequest): Promise<RpgCommandResponse> {
    return this.serialize(async () => {
      const all = await this.read()
      const user = (all[uid] ??= { entities: {}, logs: {} })
      const resolved = resolveRpgCommand(uid, request, new Map(Object.entries(user.entities)),
        new Map(Object.entries(user.logs)), Date.now())
      if (resolved.response.status !== 'applied') return resolved.response
      protectFarmSync({ upserts: resolved.writes.map(row => ({ ...row, baseVersion: row.version - 1 })), appends: [], farmProtocolVersion: 1 }, new Map(Object.entries(user.entities)), new Map(Object.entries(user.logs)))
      for (const row of resolved.writes) user.entities[`${row.kind}/${row.id}`] = row
      for (const row of resolved.appends) user.logs[`${row.kind}/${row.id}`] = row
      await this.write(all)
      return resolved.response
    })
  }
}
