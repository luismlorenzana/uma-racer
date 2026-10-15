// Test support for generation 2's API (T135): the domain's synthetic fixtures, a synthetic content folder and a strict
// fake Firestore. Not built (tsconfig.build.json leaves `*.test-support.ts` out) and never imported by the module.
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { OperationEnv, OperationPacks } from '@racer/domain/save'

// --- Synthetic fixtures ---------------------------------------------------------------------------------------------

/** `packages/domain/src/__fixtures__/save.ts`: invented Umas, cards, skills and races, and their envs. */
export interface SaveFixtures {
  readonly PACKS: OperationPacks
  readonly ENV: OperationEnv
  /** The env with `dev: true`, where `dev-grant` runs. */
  readonly DEV: OperationEnv
  opId(n: number): string
  uma(n: number): string
  clock(hhmm: string): number
}

/** The domain's synthetic save fixtures, read from source: the built package leaves `__fixtures__` out. */
export async function saveFixtures(): Promise<SaveFixtures> {
  return (await import(resolve(process.cwd(), '../../packages/domain/src/__fixtures__/save.ts'))) as SaveFixtures
}

/** A content folder as the importer writes it: the four packs, content-addressed, and a manifest at `version`. */
export async function writeSyntheticContent(dir: string, packs: OperationPacks, version = 'a1b2c3d4e5f6',
  omit: readonly (keyof OperationPacks)[] = []): Promise<void> {
  await mkdir(join(dir, 'data'), { recursive: true })
  const files: { path: string; bytes: number; sha256: string }[] = []
  for (const [name, items] of Object.entries(packs)) {
    if (omit.includes(name as keyof OperationPacks)) continue
    const bytes = Buffer.from(JSON.stringify({ version: `synthetic-${version}`, items }))
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const path = `data/${name}.${sha256.slice(0, 8)}.json`
    await writeFile(join(dir, path), bytes)
    files.push({ path, bytes: bytes.length, sha256 })
  }
  await writeFile(join(dir, 'manifest.json'), JSON.stringify({ version, generatedAt: '2026-10-14T00:00:00.000Z', source: {}, files }))
}

// --- A fake Firestore -----------------------------------------------------------------------------------------------
// Only what the generation-2 repository calls. Like Firestore, it refuses `undefined` and an array directly inside an
// array, applies a transaction's writes only when its callback resolves, and refuses a read after a write.

type Data = Record<string, unknown>
interface Filter { readonly field: string; readonly op: '>' | '==' | 'in'; readonly value: unknown }
/** A query's sort key: a field path, or null for the document id. */
type Order = string | null

const lastSegment = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

function fieldValue(data: Data, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => (value !== null && typeof value === 'object' ? (value as Data)[key] : undefined), data)
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  const left = String(a), right = String(b)
  return left < right ? -1 : left > right ? 1 : 0
}

/** Throws as Firestore does on a value it can't store. */
export function assertStorable(value: unknown, path = 'data', inArray = false): void {
  if (value === undefined) throw new Error(`Cannot use "undefined" as a Firestore value (found in ${path})`)
  if (Array.isArray(value)) {
    if (inArray) throw new Error(`Cannot have an array directly inside an array (found in ${path})`)
    value.forEach((item, i) => assertStorable(item, `${path}.${i}`, true))
  } else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) assertStorable(item, `${path}.${key}`)
  }
}

export interface FakeSnapshot {
  readonly id: string
  readonly exists: boolean
  readonly ref: FakeDocRef
  data(): Data | undefined
}

export class FakeQuery {
  constructor(readonly db: FakeFirestore, readonly path: string, private readonly filters: readonly Filter[] = [],
    private readonly orders: readonly Order[] = [], private readonly after: readonly unknown[] | null = null, private readonly max: number | null = null) {}

  doc(id: string): FakeDocRef { return new FakeDocRef(this.db, `${this.path}/${id}`) }
  where(field: string, op: Filter['op'], value: unknown): FakeQuery {
    return new FakeQuery(this.db, this.path, [...this.filters, { field, op, value }], this.orders, this.after, this.max)
  }
  orderBy(field: unknown): FakeQuery {
    return new FakeQuery(this.db, this.path, this.filters, [...this.orders, typeof field === 'string' ? field : null], this.after, this.max)
  }
  startAfter(...values: unknown[]): FakeQuery { return new FakeQuery(this.db, this.path, this.filters, this.orders, values, this.max) }
  limit(max: number): FakeQuery { return new FakeQuery(this.db, this.path, this.filters, this.orders, this.after, max) }

  async get(): Promise<{ readonly docs: FakeSnapshot[] }> {
    this.db.log.push(`query ${this.path}`)
    const prefix = `${this.path}/`
    const key = (path: string, data: Data): unknown[] => this.orders.map((order) => (order === null ? lastSegment(path) : fieldValue(data, order)))
    const compare = (a: readonly unknown[], b: readonly unknown[]): number => a.reduce<number>((result, value, i) => result || compareValues(value, b[i]), 0)
    let rows = [...this.db.docs].filter(([path, data]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/') &&
      this.filters.every(({ field, op, value }) => {
        const actual = fieldValue(data, field)
        return op === '>' ? compareValues(actual, value) > 0 : op === '==' ? actual === value : (value as unknown[]).includes(actual)
      }))
    if (this.orders.length > 0) rows.sort(([a, x], [b, y]) => compare(key(a, x), key(b, y)))
    if (this.after !== null) rows = rows.filter(([path, data]) => compare(key(path, data), this.after!) > 0)
    if (this.max !== null) rows = rows.slice(0, this.max)
    this.db.reads += Math.max(1, rows.length)
    return { docs: rows.map(([path, data]) => ({ id: lastSegment(path), exists: true, ref: new FakeDocRef(this.db, path), data: () => structuredClone(data) })) }
  }
}

export class FakeDocRef {
  constructor(readonly db: FakeFirestore, readonly path: string) {}
  get id(): string { return lastSegment(this.path) }
  collection(name: string): FakeQuery { return new FakeQuery(this.db, `${this.path}/${name}`) }
  snapshot(): FakeSnapshot {
    const data = this.db.docs.get(this.path)
    return { id: this.id, exists: data !== undefined, ref: this, data: () => (data === undefined ? undefined : structuredClone(data)) }
  }
  async get(): Promise<FakeSnapshot> {
    this.db.log.push(`get ${this.path}`)
    this.db.reads += 1
    return this.snapshot()
  }
  async create(data: Data): Promise<void> {
    this.db.log.push(`create ${this.path}`)
    await this.db.beforeCreate?.(this)
    if (this.db.docs.has(this.path)) throw Object.assign(new Error('6 ALREADY_EXISTS: Document already exists'), { code: 6 })
    assertStorable(data)
    this.db.docs.set(this.path, structuredClone(data))
    this.db.writes += 1
  }
  async listCollections(): Promise<FakeQuery[]> {
    this.db.log.push(`listCollections ${this.path}`)
    const prefix = `${this.path}/`
    const names = new Set([...this.db.docs.keys()].filter((path) => path.startsWith(prefix)).map((path) => path.slice(prefix.length).split('/')[0]!))
    return [...names].sort().map((name) => this.collection(name))
  }
}

export class FakeBulkWriter {
  private readonly results: ((ref: FakeDocRef) => void)[] = []
  closed = false
  onWriteResult(callback: (ref: FakeDocRef) => void): void { this.results.push(callback) }
  wrote(ref: FakeDocRef): void { for (const callback of this.results) callback(ref) }
  async close(): Promise<void> { this.closed = true }
}

export interface FakeTransaction {
  get(query: FakeQuery): Promise<{ readonly docs: FakeSnapshot[] }>
  getAll(...refs: FakeDocRef[]): Promise<FakeSnapshot[]>
  set(ref: FakeDocRef, data: Data): void
}

export class FakeFirestore {
  readonly docs = new Map<string, Data>()
  /** Every call, in order: `query <path>`, `get <path>`, `getAll <n>`, `set <path>`, `create <path>`, `delete <path>`. */
  readonly log: string[] = []
  reads = 0
  writes = 0
  /** Throw at this transaction write (from 0), or at commit, after the callback resolved. */
  failAt: number | 'commit' | null = null
  /** Runs before a `create()` checks its document: a test writes a racing marker here. */
  beforeCreate: ((ref: FakeDocRef) => Promise<void> | void) | null = null
  readonly writers: FakeBulkWriter[] = []
  private queue: Promise<unknown> = Promise.resolve()

  collection(path: string): FakeQuery { return new FakeQuery(this, path) }

  bulkWriter(): FakeBulkWriter {
    const writer = new FakeBulkWriter()
    this.writers.push(writer)
    return writer
  }

  /** Deletes the document and everything under it, reporting each delete (the document's own, existing or not). */
  async recursiveDelete(ref: FakeDocRef, writer: FakeBulkWriter): Promise<void> {
    for (const path of [...this.docs.keys()].filter((p) => p.startsWith(`${ref.path}/`)).sort()) {
      this.log.push(`delete ${path}`)
      this.docs.delete(path)
      this.writes += 1
      writer.wrote(new FakeDocRef(this, path))
    }
    this.log.push(`delete ${ref.path}`)
    this.docs.delete(ref.path)
    this.writes += 1
    writer.wrote(ref)
  }

  runTransaction<T>(fn: (tx: FakeTransaction) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      this.log.push('transaction')
      const writes = new Map<string, Data>()
      let writing = false
      let n = 0
      const read = (): void => { if (writing) throw new Error('Read after write') }
      const result = await fn({
        get: async (query) => { read(); return query.get() },
        getAll: async (...refs) => {
          read()
          this.log.push(`getAll ${refs.map((ref) => ref.path).join(' ')}`)
          this.reads += refs.length
          return refs.map((ref) => ref.snapshot())
        },
        set: (ref, data) => {
          writing = true
          if (this.failAt === n++) throw new Error('Synthetic write failure')
          assertStorable(data)
          this.log.push(`set ${ref.path}`)
          writes.set(ref.path, structuredClone(data))
        },
      })
      if (this.failAt === 'commit') throw new Error('Synthetic commit failure')
      for (const [path, data] of writes) {
        this.docs.set(path, data)
        this.writes += 1
      }
      return result
    })
    this.queue = run.catch(() => undefined)
    return run
  }

  /** What a repository constructor takes: the cast is the test boundary, not production code. */
  get asFirestore(): never { return this as never }
}
