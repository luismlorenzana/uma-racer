// Generation 3's routes (T152): every route behind AuthGuard, the guard before the stamp, 426 for any stamp but 3 and
// 3 with nothing read or written, the domain's parsers and bounds as 400, 409 for a missing save, 503 when an
// operation's content can't load (a create still syncs), each operation's answer, and the module mounted on its own
// Nest app over HTTP.
import 'reflect-metadata'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { HttpException, Module, type INestApplication } from '@nestjs/common'
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { SAVE_LIMITS, type OperationEnv } from '@racer/domain/save'
import { AuthGuard } from '@luismlorenzana/uma-server/auth'
import { authModule } from '../app.module'
import { DirectoryFileSource, DirectoryReleaseSource } from '@luismlorenzana/uma-server/content'
import { MasterContent } from '../master/master-content'
import { writeMasterFixture } from '../master/master.test-support'
import { FirestoreSaveRepository } from './firestore-save.repository'
import { ContentUnavailable, MANIFEST_TTL_MS, OperationContent } from './operation-content'
import { SaveController } from './save.controller'
import { SaveModule } from './save.module'
import { card, clock, ENV, FakeFirestore, op, opId, STAMP, uma } from './save.test-support'

const OLD = { protocol: 2, generation: 2 } as const
const UPGRADE = { code: 'upgrade-required', protocol: 3, generation: 3 } as const

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
  env = async () => ENV
  controller = new SaveController(new FirestoreSaveRepository(fake.asFirestore), { env: () => { envLoads += 1; return env() } })
})

describe('the routes', () => {
  it('all sit behind AuthGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, SaveController)).toEqual([AuthGuard])
    const routes = Object.getOwnPropertyNames(SaveController.prototype)
      .filter((name) => Reflect.getMetadata(METHOD_METADATA, (SaveController.prototype as unknown as Record<string, object>)[name]!) !== undefined)
      .map((name) => Reflect.getMetadata(PATH_METADATA, (SaveController.prototype as unknown as Record<string, object>)[name]!) as string)
    expect(routes.sort()).toEqual(['save', 'sync'])
  })

  it('answers 426 for any stamp but protocol 3 and generation 3, reading and writing nothing', async () => {
    const upgrade = { status: 426, body: UPGRADE }
    for (const query of [{}, { protocol: '2', generation: '2' }, { protocol: '3', generation: '2' }, { protocol: '2', generation: '3' }, { protocol: '3' },
      { protocol: ['3', '3'], generation: '3' }]) {
      expect(await thrown(() => controller.snapshot('u1', query)), JSON.stringify(query)).toEqual(upgrade)
    }
    for (const stamp of [{}, OLD, { protocol: 3, generation: 2 }, { protocol: 2, generation: 3 }, { protocol: 4, generation: 4 }, { protocol: '3', generation: '3' }]) {
      expect(await thrown(() => controller.sync('u1', { ...stamp, changes: [{ type: 'create', createdAt: 1 }] })), JSON.stringify(stamp)).toEqual(upgrade)
    }
    for (const body of [undefined, null, 'v3', []]) {
      expect(await thrown(() => controller.sync('u1', body))).toEqual(upgrade)
    }
    expect(fake.log).toEqual([])
    expect(fake.reads + fake.writes).toBe(0)
    expect(envLoads).toBe(0)
  })

  it("answers 400 for what the domain's parsers refuse: generation 2's changes, every bound, a bad query", async () => {
    const bad = async (run: () => unknown) => expect((await thrown(run)).status).toBe(400)
    const sync = (changes: unknown[]) => () => controller.sync('u1', { ...STAMP, changes })
    // Generation 2's device-written rows are gone: no upserts and no appends.
    await bad(sync([{ type: 'upsert', kind: 'badges', id: 'trainer', baseVersion: 0, data: {} }]))
    await bad(sync([{ type: 'append', kind: 'flairEvents', id: 'x', at: 1, data: {} }]))
    await bad(sync([{ type: 'upsert', kind: 'account', id: 'main', baseVersion: 1, data: {} }]))
    // An operation the registry doesn't name, and every bound.
    await bad(sync([op(1, 'collect-all', {}, 1)]))
    await bad(sync(Array.from({ length: SAVE_LIMITS.changes + 1 }, (_, i) => op(i + 1, 'unlock-uma', { umaId: uma(1) }, i))))
    await bad(sync(Array.from({ length: 5 }, (_, i) => op(i + 1, 'unlock-uma', { umaId: uma(1), pad: 'x'.repeat(500 * 1024) }, i))))
    await bad(sync([op(1, 'unlock-uma', { umaId: 'x'.repeat(SAVE_LIMITS.rowBytes) }, 1)]))
    await bad(sync([op(1, 'unlock-uma', { umaId: uma(1) }, 1), op(1, 'unlock-uma', { umaId: uma(2) }, 2)]))
    await bad(sync([{ type: 'operation', operation: { id: 'x:y', name: 'unlock-uma', input: { umaId: uma(1) }, at: 1 } }]))
    await bad(sync([op(1, 'unlock-uma', { umaId: uma(1) }, 1), { type: 'create', createdAt: 1 }]))
    await bad(() => controller.sync('u1', { ...STAMP, changes: [], extra: true }))
    await bad(() => controller.snapshot('u1', { protocol: '3', generation: '3', since: '-1' }))
    await bad(() => controller.snapshot('u1', { protocol: '3', generation: '3', cursor: 'umas~1' }))
    await bad(() => controller.snapshot('u1', { protocol: '3', generation: '3', cursor: 'badges~1~trainer' }))
    expect(fake.log).toEqual([])
    expect(envLoads).toBe(0)
  })

  it('answers 409 with no save and no create', async () => {
    const changes = [op(1, 'unlock-uma', { umaId: uma(1) }, 1)]
    expect(await thrown(() => controller.sync('u1', { ...STAMP, changes }))).toEqual({ status: 409, body: { code: 'no-save' } })
    expect(await thrown(() => controller.sync('u1', { ...STAMP, changes: [] }))).toEqual({ status: 409, body: { code: 'no-save' } })
    expect(fake.docs.size).toBe(0)
  })

  it('answers each operation: applied, repeated, refused, invalid, and not built yet', async () => {
    const created = await controller.sync('u1', { ...STAMP, changes: [{ type: 'create', createdAt: clock('07:00') }] })
    expect(created.results).toEqual([{ type: 'create', status: 'created' }])
    expect(created.entities).toEqual([expect.objectContaining({ kind: 'account', data: { createdAt: clock('07:00'), umaTickets: 20, cardTickets: 24 } })])
    expect(envLoads).toBe(0)

    const unlock = op(1, 'unlock-uma', { umaId: uma(1) }, clock('07:01'))
    const applied = await controller.sync('u1', { ...STAMP, changes: [unlock] })
    expect(applied.results).toEqual([{ type: 'operation', id: opId(1), status: 'applied', receipt: { id: uma(1), ticketsLeft: 19 } }])
    expect(applied.entities.map((row) => `${row.kind}/${row.id}`)).toEqual(['account/main', `umas/${uma(1)}`])
    expect(applied.logs.map((row) => `${row.kind}/${row.id}`)).toEqual([`operations/${opId(1)}`])

    // The outbox retries a tap whose answer it never saw: the first receipt, nothing written.
    const writes = fake.writes
    const repeated = await controller.sync('u1', { ...STAMP, changes: [unlock] })
    expect(repeated).toMatchObject({ results: [{ type: 'operation', id: opId(1), status: 'repeated', receipt: { id: uma(1), ticketsLeft: 19 } }], entities: [], logs: [] })

    const refused = await controller.sync('u1', { ...STAMP, changes: [op(2, 'unlock-uma', { umaId: uma(1) }, clock('07:02'))] })
    expect(refused.results).toEqual([{
      type: 'operation', id: opId(2), status: 'refused', refusal: { refused: true, code: 'already-unlocked', reason: 'Test Uma 1 is already in your Stable.' },
    }])

    const invalid = await controller.sync('u1', { ...STAMP, changes: [op(3, 'unlock-card', { umaId: card(1) }, clock('07:03'))] })
    expect(invalid.results).toEqual([{ type: 'operation', id: opId(3), status: 'invalid' }])

    const unbuilt = await controller.sync('u1', { ...STAMP, changes: [op(4, 'settle-stage', { careerId: 'x', kind: 'training-yard', seed: 1, version: 1, inputs: [], practice: false }, clock('07:04'))] })
    expect(unbuilt.results).toEqual([{ type: 'operation', id: opId(4), status: 'refused', refusal: expect.objectContaining({ code: 'unknown-career' }) }])
    expect(fake.writes).toBe(writes)

    const page = await controller.snapshot('u1', { protocol: '3', generation: '3', since: '0' })
    expect(page).toMatchObject({ ...STAMP, cursor: null })
    expect([...page.entities, ...page.logs].map((row) => `${row.kind}/${row.id}`)).toEqual(['account/main', `umas/${uma(1)}`, `operations/${opId(1)}`])
  })

  it('answers 503 when an operation’s content cannot load, writing nothing, while a create still syncs', async () => {
    env = async () => { throw new ContentUnavailable() }
    const changes = [{ type: 'create', createdAt: 1 }, op(1, 'unlock-uma', { umaId: uma(1) }, 2)]
    expect(await thrown(() => controller.sync('u1', { ...STAMP, changes }))).toEqual({ status: 503, body: { code: 'content-unavailable' } })
    expect(fake.docs.size).toBe(0)
    const create = await controller.sync('u1', { ...STAMP, changes: changes.slice(0, 1) })
    expect(create.results).toEqual([{ type: 'create', status: 'created' }])
    // Any other failure is the server's own, never a 503.
    env = async () => { throw new Error('boom') }
    await expect(controller.sync('u1', { ...STAMP, changes: changes.slice(1) })).rejects.toThrow('boom')
  })

  it('answers 503 for a pack missing from the published content, and runs the operation once it is published', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'racer-g3-missing-'))
    try {
      const fixture = await writeMasterFixture(dir)
      await rm(join(dir, 'master', fixture.release.manifest.sets.skills))
      let now = 1_800_000_000_000
      const content = new OperationContent(new MasterContent({ master: new DirectoryReleaseSource(join(dir, 'master')), overlay: new DirectoryFileSource(join(dir, 'content')) }), () => now)
      const routes = new SaveController(new FirestoreSaveRepository(fake.asFirestore), content)
      await routes.sync('u1', { ...STAMP, changes: [{ type: 'create', createdAt: 1 }] })
      const before = new Map(fake.docs)
      const changes = [op(1, 'unlock-uma', { umaId: fixture.adapted.umas[0]!.id }, 2)]
      expect(await thrown(() => routes.sync('u1', { ...STAMP, changes }))).toEqual({ status: 503, body: { code: 'content-unavailable' } })
      expect(fake.docs).toEqual(before)
      await writeMasterFixture(dir)
      now += MANIFEST_TTL_MS
      expect((await routes.sync('u1', { ...STAMP, changes })).results).toEqual([expect.objectContaining({ status: 'applied' })])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

// --- Over HTTP ------------------------------------------------------------------------------------------------------

/** The module on its own app, as main.ts mounts AppModule: the guard, the `api` prefix and the 5 MB JSON body. */
@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), authModule(), SaveModule] })
class SaveTestApp {}

const ENV_KEYS = ['AUTH_MODE', 'ALLOWED_EMAIL', 'PERSISTENCE', 'LOCAL_SAVE_FILE', 'CONTENT_SOURCE', 'CONTENT_DIR', 'MASTER_DIR', 'DEV_OPERATIONS'] as const

describe('over HTTP', () => {
  let dir: string
  let umaId: string
  const saved: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}
  const apps: INestApplication[] = []

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'racer-g3-http-'))
    for (const key of ENV_KEYS) saved[key] = process.env[key]
    for (const key of ENV_KEYS) delete process.env[key]
    process.env.PERSISTENCE = 'local'
    process.env.LOCAL_SAVE_FILE = join(dir, 'save-g3.json')
    process.env.CONTENT_SOURCE = 'local'
    process.env.CONTENT_DIR = join(dir, 'content')
    process.env.MASTER_DIR = join(dir, 'master')
    umaId = (await writeMasterFixture(dir)).adapted.umas[0]!.id
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
      fetch(`${api}/save`), fetch(`${api}/save?protocol=2&generation=2`), fetch(`${api}/save?protocol=3&generation=3`),
      post(`${api}/sync`, { ...OLD, changes: [] }), post(`${api}/sync`, { ...STAMP, changes: [] }),
    ])) expect(response.status).toBe(401)
  })

  it('returns 404 for the retired migration endpoint with auth on or off, without touching a save', async () => {
    for (const mode of ['on', 'disabled'] as const) {
      const api = await start(mode)
      const response = await post(`${api}/${['legacy', 'purge'].join('/')}`, STAMP)
      expect(response.status).toBe(404)
    }
  })

  it('answers 426 to a generation-2 client and plays a new account over the wire', async () => {
    const api = await start('disabled')
    for (const response of await Promise.all([
      fetch(`${api}/save?protocol=2&generation=2`), post(`${api}/sync`, { ...OLD, changes: [] }),
      post(`${api}/sync`, { ...OLD, changes: [{ type: 'create', createdAt: 1 }] }), post(`${api}/sync`, { protocol: 3, generation: 2, changes: [] }),
    ])) {
      expect(response.status).toBe(426)
      expect(await response.json()).toEqual(UPGRADE)
    }
    expect((await post(`${api}/sync`, { ...STAMP, changes: [op(1, 'unlock-uma', { umaId }, 1)] })).status).toBe(409)
    const created = await post(`${api}/sync`, { ...STAMP, changes: [{ type: 'create', createdAt: clock('07:00') }, op(1, 'unlock-uma', { umaId }, clock('07:01'))] })
    expect(created.status).toBe(200)
    expect((await created.json() as { results: { status: string }[] }).results.map((result) => result.status)).toEqual(['created', 'applied'])
    // `DEV_OPERATIONS` is unset, as on every deploy: production refuses `dev-grant`.
    const dev = await post(`${api}/sync`, { ...STAMP, changes: [op(2, 'dev-grant', { umaTickets: 1, cardTickets: 1 }, clock('07:02'))] })
    expect((await dev.json() as { results: unknown[] }).results[0]).toMatchObject({ status: 'refused', refusal: { code: 'dev-only' } })
    const page = await fetch(`${api}/save?protocol=3&generation=3&since=0`)
    expect(page.status).toBe(200)
    expect(await page.json()).toMatchObject({ ...STAMP, cursor: null })
    expect((await post(`${api}/sync`, { ...STAMP, changes: [{ type: 'upsert', kind: 'badges', id: 'trainer', baseVersion: 0, data: {} }] })).status).toBe(400)
  })
})
