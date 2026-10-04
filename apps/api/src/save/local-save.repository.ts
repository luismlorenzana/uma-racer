import { Logger } from '@nestjs/common'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import type { SaveRepository } from './save.repository'
import { BANK_KEY, freezeAdvance, advanceOutfit, bankData } from './inspiration-advance'
import { resolveUpserts, type EntityRecord, type LogRecord, type SaveSnapshot, type SyncRequest, type SyncResponse } from './save.types'
import { resolveRpgCommand, type RpgCommandRequest, type RpgCommandResponse } from './rpg-command'

interface FileShape {
  [uid: string]: { entities: Record<string, EntityRecord>; logs: Record<string, LogRecord> }
}

// Local dev persistence: one JSON file, written atomically (tmp + rename), with calls serialized in-process.
export class LocalSaveRepository implements SaveRepository {
  private readonly logger = new Logger('SaveSync')
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly file: string) {}

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
    return this.serialize(async () => {
      const all = await this.read()
      const user = (all[uid] ??= { entities: {}, logs: {} })
      const now = Date.now()
      const existing = new Map(Object.entries(user.entities))
      const { writes, conflicts } = resolveUpserts(existing, request.upserts, now)
      for (const record of writes) user.entities[`${record.kind}/${record.id}`] = record

      let appended = 0
      for (const a of request.appends) {
        const key = `${a.kind}/${a.id}`
        const current = user.logs[key]
        if (current) {
          // The first write wins, as in Firestore (D149).
          const incoming: LogRecord = { kind: a.kind, id: a.id, data: a.data, createdAt: a.createdAt }
          if (!isDeepStrictEqual(current, incoming)) this.logger.warn(`Kept the first copy of ${key}`)
          continue
        }
        user.logs[key] = { kind: a.kind, id: a.id, data: a.data, createdAt: a.createdAt }
        appended++
      }
      await this.write(all)
      return {
        applied: writes.map((w) => ({ kind: w.kind, id: w.id, version: w.version })),
        conflicts,
        appended,
        serverTime: now,
      }
    })
  }

  rpgCommand(uid: string, request: RpgCommandRequest): Promise<RpgCommandResponse> {
    return this.serialize(async () => {
      const all = await this.read()
      const user = (all[uid] ??= { entities: {}, logs: {} })
      const resolved = resolveRpgCommand(uid, request, new Map(Object.entries(user.entities)),
        new Map(Object.entries(user.logs)), Date.now())
      if (resolved.response.status !== 'applied') return resolved.response
      for (const row of resolved.writes) user.entities[`${row.kind}/${row.id}`] = row
      for (const row of resolved.appends) user.logs[`${row.kind}/${row.id}`] = row
      await this.write(all)
      return resolved.response
    })
  }
}
