// Local persistence after T144: serialized calls preserve the account and its historical cutover audit record.
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { parseSyncRequestV2, type SyncRequestV2 } from '@racer/domain/save'
import { LocalSaveRepository } from './local-save.repository'
import { saveFixtures, type SaveFixtures } from './save.test-support'

let F: SaveFixtures
beforeAll(async () => { F = await saveFixtures() })

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
  repo = new LocalSaveRepository(file, () => 1_800_000_000_000)
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

  it('preserves the historical audit marker and never reads or alters the retired dev file', async () => {
    const audit = { generation: 2, at: 42, collections: 3, documents: 5 }
    await writeFile(file, JSON.stringify({ u1: { rows: {}, purge: audit } }))
    // Invalid JSON proves the retired file is not even parsed during normal sync.
    await writeFile(legacy, 'retired data: do not read or change')
    await repo.sync('u1', request([{ type: 'create', createdAt: F.clock('07:00') }]), async () => F.ENV)
    await repo.sync('u1', request([op(1, 'unlock-uma', { outfitId: F.uma(1) }, F.clock('07:01'))]), async () => F.ENV)
    expect((await readJson(file)).u1.purge).toEqual(audit)
    expect(await readFile(legacy, 'utf8')).toBe('retired data: do not read or change')
    expect((await repo.snapshot('u1', 0, null)).entities.some((row) => row.kind === 'umas')).toBe(true)
  })
})
