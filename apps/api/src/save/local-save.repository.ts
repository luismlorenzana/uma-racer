import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import type { SaveRepository } from './save.repository'
import { resolveUpserts, type EntityRecord, type LogRecord, type SaveSnapshot, type SyncRequest, type SyncResponse } from './save.types'

interface FileShape {
  [uid: string]: { entities: Record<string, EntityRecord>; logs: Record<string, LogRecord> }
}

// Local dev persistence: one JSON file, written atomically (tmp + rename), with calls serialized in-process.
export class LocalSaveRepository implements SaveRepository {
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
          const incoming: LogRecord = { kind: a.kind, id: a.id, data: a.data, createdAt: a.createdAt }
          if (!isDeepStrictEqual(current, incoming)) throw new Error(`Append log id collision: ${key}`)
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
}
