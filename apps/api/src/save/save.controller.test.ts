// Generation 2's routes (T135): every route behind AuthGuard, the guard before the stamp, 426 for any stamp but 2 and
// 2 with nothing read or written, T134's parsers and bounds as 400, 409 for a missing save, 503 when an operation's
// content can't load (badges still sync), and the module mounted on its own Nest app over HTTP.
import 'reflect-metadata'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { HttpException, Module, type INestApplication } from '@nestjs/common'
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { createTrainerBadgeState } from '@racer/domain'
import { SAVE_LIMITS, type OperationEnv } from '@racer/domain/save'
import { AuthGuard } from '../auth/auth.guard'
import { ContentService } from '../content/content.service'
import { FirestoreSaveRepository } from './firestore-save.repository'
import { ContentUnavailable, MANIFEST_TTL_MS, OperationContent } from './operation-content'
import { SaveController } from './save.controller'
import { SaveModule } from './save.module'
import { FakeFirestore, saveG2Fixtures, writeSyntheticContent, type SaveG2Fixtures } from './save.test-support'

let F: SaveG2Fixtures
beforeAll(async () => { F = await saveG2Fixtures() })

const STAMP = { protocol: 2, generation: 2 } as const
const op = (n: number, name: string, input: unknown, at: number) => ({ type: 'operation', operation: { id: F.opId(n), name, input, at } })

/** What a handler threw: its status and body. */
async function thrown(run: () => unknown): Promise<{ status: number; body: unknown }> {
  try {
    await run()
  } catch (error) {
    if (error instanceof HttpException) return { status: error.getStatus(), body: error.getResponse() }
    throw error
  }
  throw new Error('expected an HTTP error')
}

let fake: FakeFirestore
let controller: SaveController
let envLoads: number
let env: () => Promise<OperationEnv>
beforeEach(() => {
  fake = new FakeFirestore()
  envLoads = 0
  env = async () => F.ENV
  controller = new SaveController(new FirestoreSaveRepository(fake.asFirestore), { env: () => { envLoads += 1; return env() } })
})

describe('the routes', () => {
  it('all sit behind AuthGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, SaveController)).toEqual([AuthGuard])
    const routes = Object.getOwnPropertyNames(SaveController.prototype)
      .filter((name) => Reflect.getMetadata(METHOD_METADATA, (SaveController.prototype as unknown as Record<string, object>)[name]!) !== undefined)
      .map((name) => Reflect.getMetadata(PATH_METADATA, (SaveController.prototype as unknown as Record<string, object>)[name]!) as string)
    expect(routes.sort()).toEqual(['legacy/purge', 'save', 'sync'])
  })

  it('answers 426 for any stamp but protocol 2 and generation 2, reading and writing nothing', async () => {
    const upgrade = { status: 426, body: { code: 'upgrade-required', protocol: 2, generation: 2 } }
    for (const query of [{}, { protocol: '1', generation: '2' }, { protocol: '2', generation: '3' }, { protocol: '2' }, { protocol: ['2', '2'], generation: '2' }]) {
      expect(await thrown(() => controller.snapshot('u1', query)), JSON.stringify(query)).toEqual(upgrade)
    }
    for (const stamp of [{}, { protocol: 1, generation: 2 }, { protocol: 2, generation: 3 }, { protocol: '2', generation: '2' }]) {
      expect(await thrown(() => controller.sync('u1', { ...stamp, changes: [{ type: 'create', createdAt: 1 }] })), JSON.stringify(stamp)).toEqual(upgrade)
      expect(await thrown(() => controller.purge('u1', stamp)), JSON.stringify(stamp)).toEqual(upgrade)
    }
    for (const body of [undefined, null, 'v2', []]) {
      expect(await thrown(() => controller.sync('u1', body))).toEqual(upgrade)
      expect(await thrown(() => controller.purge('u1', body))).toEqual(upgrade)
    }
    expect(fake.log).toEqual([])
    expect(fake.reads + fake.writes).toBe(0)
    expect(envLoads).toBe(0)
  })

  it("answers 400 for what T134's parsers refuse: a profile or Uma write, every bound, a bad query or purge body", async () => {
    const bad = async (run: () => unknown) => expect((await thrown(run)).status).toBe(400)
    const sync = (changes: unknown[]) => () => controller.sync('u1', { ...STAMP, changes })
    await bad(sync([{ type: 'upsert', kind: 'profile', id: 'main', baseVersion: 1, data: {} }]))
    await bad(sync([{ type: 'upsert', kind: 'umas', id: F.uma(1), baseVersion: 0, data: {} }]))
    await bad(sync(Array.from({ length: SAVE_LIMITS.changes + 1 }, (_, i) => op(i + 1, 'collect-all', {}, i))))
    await bad(sync(Array.from({ length: 5 }, (_, i) => op(i + 1, 'collect-all', { pad: 'x'.repeat(500 * 1024) }, i))))
    await bad(sync([op(1, 'collect-all', { pad: 'x'.repeat(SAVE_LIMITS.rowBytes) }, 1)]))
    await bad(sync([{ type: 'upsert', kind: 'badges', id: 'trainer', baseVersion: 0, data: { ...createTrainerBadgeState(1), pad: 'x'.repeat(SAVE_LIMITS.rowBytes) } }]))
    await bad(sync([op(1, 'collect-all', {}, 1), op(1, 'collect-all', {}, 2)]))
    await bad(sync([{ type: 'operation', operation: { id: 'x:y', name: 'collect-all', input: {}, at: 1 } }]))
    await bad(sync([op(1, 'collect-all', {}, 1), { type: 'create', createdAt: 1 }]))
    await bad(sync([{ type: 'append', kind: 'flairEvents', id: 'x'.repeat(SAVE_LIMITS.idLength + 1), at: 1, data: {} }]))
    await bad(() => controller.snapshot('u1', { ...{ protocol: '2', generation: '2' }, since: '-1' }))
    await bad(() => controller.snapshot('u1', { protocol: '2', generation: '2', cursor: 'umas~1' }))
    await bad(() => controller.purge('u1', { ...STAMP, force: true }))
    expect(fake.log).toEqual([])
  })

  it('answers 409 with no save and no create', async () => {
    const changes = [op(1, 'unlock-uma', { outfitId: F.uma(1) }, 1)]
    expect(await thrown(() => controller.sync('u1', { ...STAMP, changes }))).toEqual({ status: 409, body: { code: 'no-save' } })
    expect(fake.docs.size).toBe(0)
  })

  it('answers 503 when an operation’s content cannot load, writing nothing, while a badge still syncs', async () => {
    await controller.sync('u1', { ...STAMP, changes: [{ type: 'create', createdAt: 1 }] })
    const before = new Map(fake.docs)
    env = async () => { throw new ContentUnavailable() }
    const changes = [{ type: 'upsert', kind: 'badges', id: 'trainer', baseVersion: 0, data: createTrainerBadgeState(1) }, op(1, 'unlock-uma', { outfitId: F.uma(1) }, 2)]
    expect(await thrown(() => controller.sync('u1', { ...STAMP, changes }))).toEqual({ status: 503, body: { code: 'content-unavailable' } })
    expect(fake.docs).toEqual(before)
    const badge = await controller.sync('u1', { ...STAMP, changes: changes.slice(0, 1) })
    expect(badge.results).toEqual([{ type: 'upsert', kind: 'badges', id: 'trainer', status: 'applied', version: 1 }])
    // Any other failure is the server's own, never a 503.
    env = async () => { throw new Error('boom') }
    await expect(controller.sync('u1', { ...STAMP, changes: changes.slice(1) })).rejects.toThrow('boom')
  })

  it('answers 503 for a pack missing from the published content, and runs the operation once it is published', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'racer-g2-missing-'))
    try {
      await writeSyntheticContent(dir, F.PACKS, 'a1a1a1a1a1a1', ['skills'])
      let now = 1_800_000_000_000
      const content = new OperationContent(new ContentService(new ConfigService({ CONTENT_SOURCE: 'local', CONTENT_DIR: dir })), () => now)
      const routes = new SaveController(new FirestoreSaveRepository(fake.asFirestore), content)
      await routes.sync('u1', { ...STAMP, changes: [{ type: 'create', createdAt: 1 }] })
      const before = new Map(fake.docs)
      const changes = [op(1, 'unlock-uma', { outfitId: F.uma(1) }, 2)]
      expect(await thrown(() => routes.sync('u1', { ...STAMP, changes }))).toEqual({ status: 503, body: { code: 'content-unavailable' } })
      expect(fake.docs).toEqual(before)
      await writeSyntheticContent(dir, F.PACKS, 'b2b2b2b2b2b2')
      now += MANIFEST_TTL_MS
      expect((await routes.sync('u1', { ...STAMP, changes })).results).toEqual([expect.objectContaining({ status: 'applied' })])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('returns the snapshot, the sync and the purge as T134 types them', async () => {
    const created = await controller.sync('u1', { ...STAMP, changes: [{ type: 'create', createdAt: 1 }, op(1, 'unlock-uma', { outfitId: F.uma(1) }, 2)] })
    expect(created.results.map((result) => result.status)).toEqual(['created', 'applied'])
    expect(envLoads).toBe(1)
    const page = await controller.snapshot('u1', { protocol: '2', generation: '2', since: '0' })
    expect(page).toMatchObject({ ...STAMP, cursor: null })
    // The profile, 14 buildings and her Uma; two ledger rows and the operation's receipt.
    expect([page.entities.length, page.logs.length]).toEqual([16, 3])
    expect(await controller.purge('u1', { ...STAMP })).toMatchObject({ ...STAMP, status: 'purged', counts: { collections: 0, documents: 0 } })
  })
})

// --- Over HTTP ------------------------------------------------------------------------------------------------------

/** The module on its own app, as main.ts mounts AppModule: the `api` prefix and the 5 MB JSON body. */
@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), SaveModule] })
class SaveTestApp {}

const ENV_KEYS = ['AUTH_MODE', 'ALLOWED_EMAIL', 'PERSISTENCE', 'LOCAL_SAVE_FILE', 'CONTENT_SOURCE', 'CONTENT_DIR', 'DEV_OPERATIONS'] as const

describe('over HTTP', () => {
  let dir: string
  const saved: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}
  const apps: INestApplication[] = []

  beforeAll(async () => {
    // Vitest's transform emits no decorator metadata, so the guard's one dependency is named here; `nest build` emits it.
    if (Reflect.getMetadata('design:paramtypes', AuthGuard) === undefined) Reflect.defineMetadata('design:paramtypes', [ConfigService], AuthGuard)
    dir = await mkdtemp(join(tmpdir(), 'racer-g2-http-'))
    for (const key of ENV_KEYS) saved[key] = process.env[key]
    for (const key of ENV_KEYS) delete process.env[key]
    process.env.PERSISTENCE = 'local'
    process.env.LOCAL_SAVE_FILE = join(dir, 'save-g2.json')
    process.env.CONTENT_SOURCE = 'local'
    process.env.CONTENT_DIR = join(dir, 'content')
    await writeSyntheticContent(join(dir, 'content'), F.PACKS)
  })
  afterAll(async () => {
    for (const app of apps) await app.close()
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
    await rm(dir, { recursive: true, force: true })
  })

  async function start(auth: 'on' | 'disabled'): Promise<string> {
    if (auth === 'disabled') process.env.AUTH_MODE = 'disabled'
    else delete process.env.AUTH_MODE
    const app = await NestFactory.create<NestExpressApplication>(SaveTestApp, { logger: false })
    app.setGlobalPrefix('api')
    app.useBodyParser('json', { limit: '5mb' })
    await app.listen(0, '127.0.0.1')
    apps.push(app)
    return `${await app.getUrl()}/api`
  }

  const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

  it('answers 401 before the stamp: no token is 401 on every route, whatever the stamp', async () => {
    const api = await start('on')
    for (const response of await Promise.all([
      fetch(`${api}/save`), fetch(`${api}/save?protocol=1&generation=2`), fetch(`${api}/save?protocol=2&generation=2`),
      post(`${api}/sync`, { protocol: 1, generation: 2, changes: [] }), post(`${api}/sync`, { ...STAMP, changes: [] }),
      post(`${api}/legacy/purge`, {}), post(`${api}/legacy/purge`, STAMP),
    ])) expect(response.status).toBe(401)
  })

  it('answers 426 to a stale client and plays a new account over the wire', async () => {
    const api = await start('disabled')
    for (const response of await Promise.all([
      fetch(`${api}/save?protocol=1&generation=2`), post(`${api}/sync`, { protocol: 1, generation: 2, changes: [] }),
      post(`${api}/sync`, { protocol: 2, generation: 3, changes: [] }), post(`${api}/legacy/purge`, { protocol: 1, generation: 1 }),
    ])) {
      expect(response.status).toBe(426)
      expect(await response.json()).toEqual({ code: 'upgrade-required', protocol: 2, generation: 2 })
    }
    expect((await post(`${api}/sync`, { ...STAMP, changes: [op(1, 'unlock-uma', { outfitId: F.uma(1) }, 1)] })).status).toBe(409)
    const created = await post(`${api}/sync`, { ...STAMP, changes: [{ type: 'create', createdAt: F.clock('07:00') }, op(1, 'unlock-uma', { outfitId: F.uma(1) }, F.clock('07:01'))] })
    expect(created.status).toBe(200)
    expect((await created.json() as { results: { status: string }[] }).results.map((result) => result.status)).toEqual(['created', 'applied'])
    const dev = await post(`${api}/sync`, { ...STAMP, changes: [op(2, 'dev-grant', { prizeMoney: 10 }, F.clock('07:02'))] })
    expect((await dev.json() as { results: unknown[] }).results[0]).toMatchObject({ status: 'refused', refusal: { code: 'dev-only' } })
    const page = await fetch(`${api}/save?protocol=2&generation=2&since=0`)
    expect(page.status).toBe(200)
    expect(await page.json()).toMatchObject({ ...STAMP, cursor: null })
    expect((await post(`${api}/sync`, { ...STAMP, changes: [{ type: 'upsert', kind: 'profile', id: 'main', baseVersion: 1, data: {} }] })).status).toBe(400)
  })
})
