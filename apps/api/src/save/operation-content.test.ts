// The content operations read (T135): the four packs from a synthetic content folder through today's ContentService,
// built into the same env the domain's fixtures use, cached per manifest version, re-read at most once a minute, and
// unavailable (never leaking a path) when a pack is missing or fails. `dev-grant` runs only with DEV_OPERATIONS=true.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ConfigService } from '@nestjs/config'
import { parseSyncRequestV2, type OperationEnv, type SyncRequestV2 } from '@racer/domain/save-g2'
import { ContentService } from '../content/content.service'
import { ContentUnavailable, MANIFEST_TTL_MS, OperationContent } from './operation-content'
import { NO_SAVE, resolveSync } from './resolve'
import { saveG2Fixtures, writeSyntheticContent, type SaveG2Fixtures } from './save.test-support'

let F: SaveG2Fixtures
beforeAll(async () => { F = await saveG2Fixtures() })

let dir: string
let now: number
let reads: { manifest: number; packs: number }
let loader: OperationContent
let devOperations: string | undefined

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'racer-g2-content-'))
  now = 1_800_000_000_000
  reads = { manifest: 0, packs: 0 }
  const content = new ContentService(new ConfigService({ CONTENT_SOURCE: 'local', CONTENT_DIR: dir }))
  loader = new OperationContent({
    manifest: () => { reads.manifest += 1; return content.manifest() },
    readVerifiedJson: (file) => { reads.packs += 1; return content.readVerifiedJson(file) },
  }, () => now)
  devOperations = process.env.DEV_OPERATIONS
  delete process.env.DEV_OPERATIONS
})
afterEach(async () => {
  if (devOperations === undefined) delete process.env.DEV_OPERATIONS
  else process.env.DEV_OPERATIONS = devOperations
  await rm(dir, { recursive: true, force: true })
})

function request(changes: readonly unknown[]): SyncRequestV2 {
  const parsed = parseSyncRequestV2(JSON.parse(JSON.stringify({ protocol: 2, generation: 2, changes })))
  if (typeof parsed === 'string') throw new Error(parsed)
  return parsed
}

/** A new account's first taps, resolved on `env`. */
function firstTaps(env: OperationEnv) {
  const op = (n: number, name: string, input: unknown, at: number) => ({ type: 'operation', operation: { id: F.opId(n), name, input, at } })
  return resolveSync({ entities: new Map(), logs: new Map() }, request([
    { type: 'create', createdAt: F.clock('07:00') },
    op(1, 'unlock-uma', { outfitId: F.uma(1) }, F.clock('07:01')),
    op(2, 'unlock-uma', { outfitId: F.uma(2) }, F.clock('07:02')),
    op(3, 'set-targets', { outfitIds: [F.uma(2)] }, F.clock('07:03')),
    op(4, 'dev-grant', { prizeMoney: 10 }, F.clock('07:04')),
  ]), 1, env)
}

const unavailable = async (): Promise<ContentUnavailable> => {
  const error = await loader.env().then(() => null, (e: unknown) => e)
  expect(error).toBeInstanceOf(ContentUnavailable)
  expect((error as Error).message).not.toMatch(/data\/|\.json|racer-g2|\//)
  return error as ContentUnavailable
}

describe('the operation content', () => {
  it("builds from the published packs the env the domain's fixtures build, so the server's numbers are the device's", async () => {
    await writeSyntheticContent(dir, F.PACKS)
    const env = await loader.env()
    const served = firstTaps(env)
    const fixture = firstTaps(F.ENV)
    expect(served).not.toBe(NO_SAVE)
    expect(served).toEqual(fixture)
    expect(reads).toEqual({ manifest: 1, packs: 4 })
  })

  it('caches per manifest version and re-reads the manifest at most once a minute', async () => {
    await writeSyntheticContent(dir, F.PACKS, 'aaaaaaaaaaaa')
    const first = await loader.env()
    now += MANIFEST_TTL_MS - 1
    await loader.env()
    expect(reads).toEqual({ manifest: 1, packs: 4 })
    // A minute on, the manifest is read again; the same version keeps the env.
    now += 1
    expect((await loader.env()).content).toBe(first.content)
    expect(reads).toEqual({ manifest: 2, packs: 4 })
    // A publish takes effect within the minute after it.
    await writeSyntheticContent(dir, { ...F.PACKS, races: F.PACKS.races.slice(1) }, 'bbbbbbbbbbbb')
    await loader.env()
    expect(reads).toEqual({ manifest: 2, packs: 4 })
    now += MANIFEST_TTL_MS
    const next = await loader.env()
    expect(next.content.races).toHaveLength(F.PACKS.races.length - 1)
    expect(reads).toEqual({ manifest: 3, packs: 8 })
  })

  it('loads one env for concurrent calls', async () => {
    await writeSyntheticContent(dir, F.PACKS)
    const envs = await Promise.all([loader.env(), loader.env(), loader.env()])
    expect(new Set(envs.map((env) => env.content)).size).toBe(1)
    expect(reads).toEqual({ manifest: 1, packs: 4 })
  })

  it('is unavailable without a manifest, with a missing or doubled pack, or with a pack that fails, and tries the packs again', async () => {
    await unavailable()
    await writeSyntheticContent(dir, F.PACKS, 'cccccccccccc', ['skills'])
    now += MANIFEST_TTL_MS
    await unavailable()
    // Two Uma packs in one manifest: which one is meant is unknown, so neither is read.
    await writeSyntheticContent(dir, F.PACKS, 'c0c0c0c0c0c0')
    const doubled = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as { files: { path: string }[] }
    const uma = doubled.files.find((file) => file.path.startsWith('data/umas.'))!
    doubled.files.push({ ...uma, path: 'data/umas.00000000.json' })
    await writeFile(join(dir, 'manifest.json'), JSON.stringify(doubled))
    now += MANIFEST_TTL_MS
    const before = reads.packs
    await unavailable()
    expect(reads.packs - before).toBeLessThan(4)
    // A malformed pack (an item without an id) fails its envelope check.
    await writeSyntheticContent(dir, { ...F.PACKS, cards: [...F.PACKS.cards, {} as never] }, 'dddddddddddd')
    now += MANIFEST_TTL_MS
    await unavailable()
    // A pack whose bytes no longer match the manifest fails verification; once fixed, the next call loads it.
    await writeSyntheticContent(dir, F.PACKS, 'eeeeeeeeeeee')
    now += MANIFEST_TTL_MS
    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as { files: { path: string }[] }
    const umas = join(dir, manifest.files.find((file) => file.path.startsWith('data/umas.'))!.path)
    const good = await readFile(umas)
    await writeFile(umas, Buffer.from(good.toString('utf8').replace('"version"', '"versioN"')))
    await unavailable()
    await writeFile(umas, good)
    await expect(loader.env()).resolves.toMatchObject({ dev: false })
  })

  it('runs dev-grant only when DEV_OPERATIONS is true (M034)', async () => {
    await writeSyntheticContent(dir, F.PACKS)
    const refused = firstTaps(await loader.env())
    expect(refused !== NO_SAVE && refused.response.results.at(-1)).toMatchObject({ status: 'refused', refusal: { code: 'dev-only' } })
    for (const value of ['1', 'yes', 'TRUE', '']) {
      process.env.DEV_OPERATIONS = value
      expect((await loader.env()).dev).toBe(false)
    }
    process.env.DEV_OPERATIONS = 'true'
    const applied = firstTaps(await loader.env())
    expect(applied !== NO_SAVE && applied.response.results.at(-1)).toMatchObject({ status: 'applied' })
  })
})
