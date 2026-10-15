// The local repository in a temporary folder (T135): its file shape, serialized calls, and the purge of the old dev
// file's entry for the uid, at a path that can never be the generation-2 file.
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { parseSyncRequestV2, type SyncRequestV2 } from '@racer/domain/save'
import { LEGACY_LOCAL_SAVE_FILE, LocalSaveRepository } from './local-save.repository'
import { saveG2Fixtures, type SaveG2Fixtures } from './save.test-support'

let F: SaveG2Fixtures
beforeAll(async () => { F = await saveG2Fixtures() })

const STAMP = { protocol: 2, generation: 2 } as const
function request(changes: readonly unknown[]): SyncRequestV2 {
  const parsed = parseSyncRequestV2(JSON.parse(JSON.stringify({ ...STAMP, changes })))
  if (typeof parsed === 'string') throw new Error(parsed)
  return parsed
}
const op = (n: number, name: string, input: unknown, at: number) => ({ type: 'operation', operation: { id: F.opId(n), name, input, at } })

let dir: string
let file: string
let legacy: string
let repo: LocalSaveRepository
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'racer-g2-local-'))
  file = join(dir, '.data', 'save-g2.json')
  legacy = join(dir, '.data', 'save.json')
  await mkdir(join(dir, '.data'))
  repo = new LocalSaveRepository(file, legacy, () => 1_800_000_000_000)
})
afterEach(async () => rm(dir, { recursive: true, force: true }))

// `any`: the test reads back raw JSON files and checks their shape itself.
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8')) as Record<string, any>

describe('the local repository', () => {
  it("keeps { [uid]: { rows: { 'kind/id': row } } } and serializes concurrent calls", async () => {
    await repo.sync('u1', request([{ type: 'create', createdAt: F.clock('07:00') }]), async () => F.ENV)
    // Twenty taps at once: each sees the one before, so every ticket is spent exactly once.
    const taps = Array.from({ length: 20 }, (_, i) => repo.sync('u1', request([op(i + 1, 'unlock-uma', { outfitId: F.uma(i + 1) }, F.clock('07:01') + i)]), async () => F.ENV))
    const answers = await Promise.all(taps)
    expect(answers.every((answer) => typeof answer === 'object' && answer.results[0]!.status === 'applied')).toBe(true)
    const saved = await readJson(file)
    expect(Object.keys(saved)).toEqual(['u1'])
    expect(saved.u1.rows['profile/main']).toMatchObject({ kind: 'profile', id: 'main', version: 21, data: { umaTickets: 0 } })
    expect(Object.keys(saved.u1.rows)).toContain(`operations/${F.opId(20)}`)
    expect(saved.u1.purge).toBeUndefined()
  })

  it("purges the uid's entry from the old dev file, counting its rows by kind, then writes the marker", async () => {
    await writeFile(legacy, JSON.stringify({
      u1: { entities: { 'profile/main': {}, 'umas/a': {}, 'umas/b': {} }, logs: { 'ledger/x': {}, 'raceResults/r': {} } },
      u2: { entities: { 'profile/main': {} }, logs: {} },
    }))
    await repo.sync('u1', request([{ type: 'create', createdAt: F.clock('07:00') }]), async () => F.ENV)
    const rows = (await readJson(file)).u1.rows
    const response = await repo.purge('u1')
    expect(response).toEqual({ ...STAMP, status: 'purged', at: 1_800_000_000_000, counts: { collections: 4, documents: 5 } })
    expect(await readJson(legacy)).toEqual({ u2: { entities: { 'profile/main': {} }, logs: {} } })
    expect(await readJson(file)).toEqual({ u1: { rows, purge: { generation: 2, at: 1_800_000_000_000, collections: 4, documents: 5 } } })
    // Called again, it answers at once from the marker, and touches neither file.
    await writeFile(legacy, JSON.stringify({ u1: { entities: { 'profile/main': {} }, logs: {} } }))
    expect(await repo.purge('u1')).toEqual({ ...response, status: 'already' })
    expect(Object.keys(await readJson(legacy))).toEqual(['u1'])
  })

  it('purges with zero counts when there is no old dev file, or no entry for the uid', async () => {
    expect((await repo.purge('u1')).counts).toEqual({ collections: 0, documents: 0 })
    await writeFile(legacy, JSON.stringify({ u2: { entities: {}, logs: {} } }))
    expect((await repo.purge('u3')).counts).toEqual({ collections: 0, documents: 0 })
    expect(Object.keys(await readJson(legacy))).toEqual(['u2'])
  })

  it('refuses to purge when the old dev path is the generation-2 file', async () => {
    const same = new LocalSaveRepository(file, join(dir, '.data', '..', '.data', 'save-g2.json'))
    await expect(same.purge('u1')).rejects.toThrow('cannot be the generation-2 file')
    expect(LEGACY_LOCAL_SAVE_FILE).toBe('.data/save.json')
  })
})
