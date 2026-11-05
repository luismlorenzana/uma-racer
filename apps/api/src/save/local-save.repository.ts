// Local dev persistence for generation 3 (docs/game/architecture.md "The save and sync"; D381; T152): one JSON file,
// `.data/save-g3.json`, shaped `{ [uid]: { rows: { 'kind/id': row } } }`, written atomically (a temporary file, then a
// rename) with calls serialized in-process, on the same `resolve.ts` as Firestore. Generation 2's file is never read.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { rowKey, type SaveSnapshot, type SyncRequest, type SyncResponse } from '@racer/domain/save'
import { needsOperationEnv, NO_SAVE, resolveSync, selectReadSet, snapshotPage, syncReadSet, type NoSave, type SaveRow } from './resolve'
import type { OperationEnvLoader, SaveRepository } from './save.repository'

interface UserFile {
  rows: Record<string, SaveRow>
}
type FileShape = Record<string, UserFile>

async function readJson<T>(file: string, empty: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return empty
    throw err
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  await writeFile(tmp, JSON.stringify(data, null, 2))
  await rename(tmp, file)
}

export class LocalSaveRepository implements SaveRepository {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly file: string, private readonly clock: () => number = Date.now) {}

  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn)
    this.queue = run.catch(() => undefined)
    return run
  }

  private read(): Promise<FileShape> {
    return readJson<FileShape>(this.file, {})
  }

  snapshot(uid: string, since: number, cursor: string | null): Promise<SaveSnapshot> {
    return this.serialize(async () => snapshotPage(Object.values((await this.read())[uid]?.rows ?? {}), since, cursor, this.clock()))
  }

  async sync(uid: string, request: SyncRequest, env: OperationEnvLoader): Promise<SyncResponse | NoSave> {
    // Content loads first: a missing pack throws here, and nothing is written.
    const operationEnv = needsOperationEnv(request) ? await env() : undefined
    return this.serialize(async () => {
      const all = await this.read()
      const readSet = syncReadSet(request)
      const resolved = resolveSync(selectReadSet(Object.values(all[uid]?.rows ?? {}), readSet), request, this.clock(), operationEnv)
      if (resolved === NO_SAVE) return NO_SAVE
      if (resolved.entities.length + resolved.logs.length > 0) {
        const user = (all[uid] ??= { rows: {} })
        for (const row of [...resolved.entities, ...resolved.logs]) user.rows[rowKey(row)] = row
        await writeJson(this.file, all)
      }
      return resolved.response
    })
  }

}
