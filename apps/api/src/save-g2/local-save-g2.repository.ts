// Local dev persistence for generation 2 (docs/rework/13-removals-and-plan-changes.md §6; docs/rearchitecture/07-data-
// reset.md §2–§3; T135): one JSON file, `.data/save-g2.json`, shaped `{ [uid]: { rows: { 'kind/id': row }, purge? } }`,
// written atomically (a temporary file, then a rename) with calls serialized in-process, on the same `resolve.ts` as
// Firestore. Its purge clears the uid's entry from the old dev file, at a fixed path and never an env var.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { rowKey, SAVE_GENERATION, type PurgeResponse, type SaveSnapshotV2, type SyncRequestV2, type SyncResponseV2 } from '@racer/domain/save-g2'
import { needsOperationEnv, NO_SAVE, resolveSync, selectReadSet, snapshotPage, syncReadSet, type NoSave, type SaveRow } from './resolve'
import { parsePurgeMarker, purgeResponse, type OperationEnvLoader, type PurgeMarker, type SaveG2Repository } from './save-g2.repository'

/** The old dev store (07 §2), relative to the API's working directory. */
export const LEGACY_LOCAL_SAVE_FILE = '.data/save.json'

interface UserFile {
  rows: Record<string, SaveRow>
  purge?: PurgeMarker
}
type FileShape = Record<string, UserFile>

/** Today's dev file: `{ [uid]: { entities: { 'kind/id': row }, logs: { 'kind/id': row } } }`. */
type LegacyFileShape = Record<string, { entities?: Record<string, unknown>; logs?: Record<string, unknown> }>

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

export class LocalSaveG2Repository implements SaveG2Repository {
  private queue: Promise<unknown> = Promise.resolve()

  /** `legacyFile` is `LEGACY_LOCAL_SAVE_FILE` under the working directory; tests pass a temporary one. */
  constructor(private readonly file: string, private readonly legacyFile: string = resolve(process.cwd(), LEGACY_LOCAL_SAVE_FILE),
    private readonly clock: () => number = Date.now) {}

  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn)
    this.queue = run.catch(() => undefined)
    return run
  }

  private read(): Promise<FileShape> {
    return readJson<FileShape>(this.file, {})
  }

  snapshot(uid: string, since: number, cursor: string | null): Promise<SaveSnapshotV2> {
    return this.serialize(async () => snapshotPage(Object.values((await this.read())[uid]?.rows ?? {}), since, cursor, this.clock()))
  }

  async sync(uid: string, request: SyncRequestV2, env: OperationEnvLoader): Promise<SyncResponseV2 | NoSave> {
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

  purge(uid: string): Promise<PurgeResponse> {
    return this.serialize(async () => {
      if (resolve(this.legacyFile) === resolve(this.file)) throw new Error('The old dev save cannot be the generation-2 file')
      const all = await this.read()
      const done = all[uid]?.purge
      if (done !== undefined) return purgeResponse('already', parsePurgeMarker(done))

      const legacy = await readJson<LegacyFileShape>(this.legacyFile, {})
      const old = Object.hasOwn(legacy, uid) ? legacy[uid] : undefined
      const keys = [...Object.keys(old?.entities ?? {}), ...Object.keys(old?.logs ?? {})]
      if (old !== undefined) {
        delete legacy[uid]
        await writeJson(this.legacyFile, legacy)
      }
      const marker: PurgeMarker = {
        generation: SAVE_GENERATION, at: this.clock(), collections: new Set(keys.map((key) => key.split('/')[0])).size, documents: keys.length,
      }
      ;(all[uid] ??= { rows: {} }).purge = marker
      await writeJson(this.file, all)
      return purgeResponse('purged', marker)
    })
  }
}
