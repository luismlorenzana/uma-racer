// Local persistence for generation 3 (T152): `.data/save-g3.json`, serialized calls, and generation 2's file never read.
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseSyncRequest, type SyncRequest } from '@racer/domain/save'
import { LocalSaveRepository } from './local-save.repository'
import { DEFAULT_LOCAL_SAVE_FILE } from './save.module'
import { clock, ENV, op, opId, STAMP, uma } from './save.test-support'

function request(changes: readonly unknown[]): SyncRequest {
  const parsed = parseSyncRequest(JSON.parse(JSON.stringify({ ...STAMP, changes })))
  if (typeof parsed === 'string') throw new Error(parsed)
  return parsed
}

let dir: string
let file: string
let retired: string
let repo: LocalSaveRepository
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'racer-g3-local-'))
  file = join(dir, DEFAULT_LOCAL_SAVE_FILE)
  retired = join(dir, '.data', 'save-g2.json')
  await mkdir(join(dir, '.data'))
  repo = new LocalSaveRepository(file, () => 1_800_000_000_000)
})
afterEach(async () => rm(dir, { recursive: true, force: true }))

// `any`: the test reads back raw JSON files and checks their shape itself.
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8')) as Record<string, any>

describe('the local repository', () => {
  it('defaults to .data/save-g3.json', () => {
    expect(DEFAULT_LOCAL_SAVE_FILE).toBe('.data/save-g3.json')
  })

  it("keeps { [uid]: { rows: { 'kind/id': row } } } and serializes concurrent calls", async () => {
    await repo.sync('u1', request([{ type: 'create', createdAt: clock('07:00') }]), async () => ENV)
    // Twenty taps at once: each sees the one before, so every ticket is spent exactly once.
    const taps = Array.from({ length: 20 }, (_, i) => repo.sync('u1', request([op(i + 1, 'unlock-uma', { umaId: uma(i + 1) }, clock('07:01') + i)]), async () => ENV))
    const answers = await Promise.all(taps)
    expect(answers.every((answer) => typeof answer === 'object' && answer.results[0]!.status === 'applied')).toBe(true)
    const saved = await readJson(file)
    expect(Object.keys(saved)).toEqual(['u1'])
    expect(Object.keys(saved.u1)).toEqual(['rows'])
    expect(saved.u1.rows['account/main']).toMatchObject({ kind: 'account', id: 'main', generation: 3, version: 21, data: { umaTickets: 0, cardTickets: 24 } })
    expect(Object.keys(saved.u1.rows)).toContain(`operations/${opId(20)}`)
    expect(Object.keys(saved.u1.rows).filter((key) => key.startsWith('umas/'))).toHaveLength(20)
  })

  it('never reads or alters generation 2’s file', async () => {
    // Invalid JSON proves the retired file is not even parsed.
    await writeFile(retired, 'retired data: do not read or change')
    await repo.sync('u1', request([{ type: 'create', createdAt: clock('07:00') }]), async () => ENV)
    await repo.sync('u1', request([op(1, 'unlock-uma', { umaId: uma(1) }, clock('07:01'))]), async () => ENV)
    expect(await readFile(retired, 'utf8')).toBe('retired data: do not read or change')
    expect((await repo.snapshot('u1', 0, null)).entities.map((row) => `${row.kind}/${row.id}`)).toEqual(['account/main', `umas/${uma(1)}`])
  })

  it('writes no file for a sync that changes nothing', async () => {
    await repo.sync('u1', request([{ type: 'create', createdAt: clock('07:00') }]), async () => ENV)
    const before = await readFile(file, 'utf8')
    await repo.sync('u1', request([op(1, 'start-career', { umaId: uma(1) }, clock('07:01'))]), async () => ENV)
    await repo.sync('u1', request([{ type: 'create', createdAt: clock('08:00') }]), async () => ENV)
    expect(await readFile(file, 'utf8')).toBe(before)
  })
})
