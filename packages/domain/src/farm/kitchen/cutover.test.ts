import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { parseSaveSnapshotOrThrow, parseUmaSave, createScenarioTraining } from '../../save'
import { createInspirationBank, openBankOutfit } from '../../inspiration-bank'
import { farmCutoverFixture } from './cutover-fixtures'
import { clearFarmRetiredExtra, farmCutoverSource } from './cutover-source'
import { farmCanonical, farmData, farmHash, farmBytes } from './wire'
import { resolveFarmCutover, farmCutoverControl, farmCutoverReferences, parseFarmCutoverResponse } from './cutover'
import { farmCutoverReceiptId, parseFarmCutoverRequest, type FarmCutoverRequest } from './cutover-records'
import { createFarmOperation, farmOperationReferences } from './operations'
import { resolveFarmOperations } from './resolver'
import { puzzleProtocolFixture } from '../../minigames/uma-puzzles/protocol-fixtures'

function rehearsal(count = 20, tiers = 14, legacy: 'absent' | 'v1' | 'v2' = 'v2') {
  const f = farmCutoverFixture(count, tiers, legacy), generation = 'invented-cutover', accountId = 'invented-account'
  const digest = () => createHash('sha256').update(farmCanonical(farmCutoverSource(accountId, f.entities, f.logs))).digest('hex')
  const prepare = (): FarmCutoverRequest => ({ schemaVersion: 1, generation, action: 'prepare', archive: {
    accountId, profileCreatedAt: 1, archiveDigest: 'b'.repeat(64), sourceDigest: digest() } })
  const apply = (request: FarmCutoverRequest, enabled = true) => {
    const result = resolveFarmCutover({ enabled, now: 100, accountId, entities: f.entities, logs: f.logs,
      sourceDigest: farmCutoverControl(f.entities) ? undefined : digest() }, request)
    result.writes.forEach(r => f.entities.set(`${r.kind}/${r.id}`, r)); result.appends.forEach(r => f.logs.set(`${r.kind}/${r.id}`, r))
    return result
  }
  const request = (action: 'advance' | 'verify', index: number): FarmCutoverRequest => ({ schemaVersion: 1, generation, action, index })
  const finish = () => {
    for (let i = farmCutoverControl(f.entities)!.nextOutfitIndex; i < count; i++) expect(apply(request('advance', i)).response.status).toBe('resetting')
    for (let i = 0; i < Math.ceil(count / 32); i++) expect(apply(request('verify', i)).response.status).toBe(count ? 'resetting' : 'preparing')
    expect(apply({ schemaVersion: 1, generation, action: 'finalize' }).response.status).toBe('active')
  }
  return { ...f, generation, prepare, apply, request, finish }
}
describe('protected Farm generation rehearsal', () => {
  it.each(['absent', 'v1', 'v2'] as const)('resets precisely Farm/Extra, preserves stock and every other field (%s)', legacy => {
    const f = rehearsal(20, 14, legacy), before = structuredClone(f.entities)
    expect(f.apply(f.prepare()).response.status).toBe('preparing')
    for (const [key, row] of before) expect(f.entities.get(key)).toEqual(row) // Prepare is nondestructive.
    f.finish()
    for (const [key, row] of before) if (row.kind !== 'farm') {
      const next = f.entities.get(key)!
      expect(next.data, key).toEqual(row.kind === 'umas' ? clearFarmRetiredExtra(row.data) : row.data)
      if (row.kind === 'umas') expect(parseUmaSave(next.data)).not.toBeNull()
    }
    expect([...f.entities.values()].filter(r => r.kind === 'farmWorkers')).toHaveLength(20)
    expect([...f.entities.values()].filter(r => r.kind === 'farmExtra')).toHaveLength(60)
    expect([...f.entities.values()].filter(r => r.kind === 'farmWorkers').every(r => r.data.totalExp === 0)).toBe(true)
    expect([...f.entities.values()].filter(r => r.kind === 'farmRecipes').every(r => r.data.processing === null && r.data.cooking === null && farmCanonical(r.data.cookbook) === '{}')).toBe(true)
    expect(parseSaveSnapshotOrThrow({ entities: [...f.entities.values()], logs: [...f.logs.values()], serverTime: 100 }).entities).toHaveLength(f.entities.size)
    const stations = f.entities.get('farm/main')!.data.stations as { id: string; outfitId: string | null; attempt: number; job: null }[]
    expect(stations).toHaveLength(legacy === 'absent' ? 0 : legacy === 'v1' ? 6 : 18)
    expect(stations.every(s => s.job === null && /^(garden|orchard|barn)-/.test(s.id))).toBe(true)
    console.info('Farm reset witness', JSON.stringify({ legacy, outfits: 20, units: 280, builds: 1120, digest: farmHash([...f.entities.values()]), receipts: f.logs.size }))
  })
  it('supports an empty account, and repeats/lost responses return original receipts without extra writes', () => {
    const f = rehearsal(0, 1, 'absent'), req = f.prepare(), first = f.apply(req)
    expect(f.apply(req).response.receipt).toEqual(first.response.receipt); f.finish()
    const before = structuredClone(f.entities), logs = structuredClone(f.logs)
    expect(f.apply({ schemaVersion: 1, generation: f.generation, action: 'finalize' }).writes).toHaveLength(0)
    expect(f.entities).toEqual(before); expect(f.logs).toEqual(logs)
  })
  it('patches a current non-Farm edit/new scenario, never refreezes later acquisitions, and resumes exact steps', () => {
    const f = rehearsal(2, 1, 'absent'); f.apply(f.prepare())
    const u = f.entities.get('umas/invented-0000')!; u.version++; u.data.exp = 77; u.data.activePreset = 'long'
    const first = f.apply(f.request('advance', 0)), before = structuredClone(f.entities)
    expect(f.apply(f.request('advance', 0)).response.receipt).toEqual(first.response.receipt); expect(f.entities).toEqual(before)
    expect(f.entities.get('umas/invented-0000')!.data.exp).toBe(77)
    f.put('umas', 'invented-new', clearFarmRetiredExtra({ ...u.data, templateId: 'invented-new' }))
    f.finish(); expect(farmCutoverControl(f.entities)!.outfitCount).toBe(2); expect(f.entities.has('farmWorkers/invented-new')).toBe(false)
    expect(f.entities.get('umas/invented-0000')!.data.activePreset).toBe('long')
  })
  it('will not activate with a missing/mismatched step or verification receipt', () => {
    const f = rehearsal(2, 1, 'absent'); f.apply(f.prepare()); f.apply(f.request('advance', 0)); f.apply(f.request('advance', 1))
    const key = `farmOperations/${farmCutoverReceiptId(f.generation, 'advance', 0)}`, row = f.logs.get(key)!
    f.logs.delete(key); expect(f.apply(f.request('verify', 0)).response.message).toMatch(/Missing/)
    f.logs.set(key, row); expect(f.apply({ schemaVersion: 1, generation: f.generation, action: 'finalize' }).response.message).toMatch(/Verify/)
    f.apply(f.request('verify', 0)); f.finish()
  })
  it('blocks stale/account/future/oversized input without changing an authoritative row', () => {
    const f = rehearsal(2, 1, 'absent'), req = f.prepare()
    f.entities.get('umas/invented-0000')!.version++
    expect(f.apply(req).response.message).toMatch(/stale/); expect(f.entities.has('farmCutover/main')).toBe(false)
    const wrong = f.prepare(); if (wrong.action === 'prepare') wrong.archive.accountId = 'another-account'
    expect(f.apply(wrong).response.message).toMatch(/account/)
    expect(parseFarmCutoverRequest({ ...req, schemaVersion: 2 })).toBeNull()
    expect(parseFarmCutoverRequest({ schemaVersion: 1, generation: f.generation, action: 'advance', index: 4096 })).toBeNull()
    f.entities.get('umas/invented-0000')!.data.schemaVersion = 99
    expect(() => f.prepare()).toThrow(/unsupported/)
    const big = farmCutoverFixture(4097, 1, 'absent')
    expect(() => farmCutoverSource('invented-account', big.entities, big.logs)).toThrow(/4096/)
  })
  it('keeps a 4096-outfit freeze and final verification within unchanged document/byte caps', () => {
    const f = rehearsal(4096, 1, 'absent'), prepare = f.apply(f.prepare())
    expect(prepare.response.status).toBe('preparing'); expect(prepare.writes).toHaveLength(130)
    expect(Math.max(...prepare.writes.map(farmBytes))).toBeLessThan(131072)
    const refs = farmCutoverReferences(f.entities, { schemaVersion: 1, generation: f.generation, action: 'finalize' })
    expect(refs.entities.length + refs.logs.length).toBeLessThanOrEqual(200)
    expect(farmCutoverReferences(f.entities, f.request('verify', 127)).logs).toHaveLength(34)
  })
  it('coexists with active Puzzle control, defers incomplete protected preparation, and leaves banks byte-equal', () => {
    const f = rehearsal(2, 1, 'absent'), bank = puzzleProtocolFixture().entities.get('constellationBank/main')!
    f.entities.set('constellationBank/main', structuredClone(bank)); const before = structuredClone(bank)
    f.entities.get('constellationBank/main')!.data.phase = 'preparing'
    expect(f.apply(f.prepare()).response.message).toMatch(/existing Puzzle/)
    f.entities.set('constellationBank/main', before); f.apply(f.prepare()); f.finish()
    expect(f.entities.get('constellationBank/main')).toEqual(before)
  })
  it('preserves complete Puzzle parties/enrollments, Inspiration debt, card stars/sets and a newly opened scenario', () => {
    const f = rehearsal(5, 1, 'absent'), p = puzzleProtocolFixture(8, 2)
    for (const [key, row] of [...f.entities]) if (row.kind === 'umas') f.entities.delete(key)
    for (const [key, row] of p.entities) f.entities.set(key, structuredClone(row))
    f.put('cards', 'invented-card', { schemaVersion: 1, templateId: 'invented-card', stars: 3, maxCouponGranted: true })
    const cohorts = [...f.entities.values()].filter(r => r.kind === 'umas').map(r => ({ id: r.id,
      scenarios: (r.data.scenarios as { tier: number; inspiration: { slots: string[]; golds: string[] } }[]) }))
    let bank = createInspirationBank(cohorts, 1); for (const row of cohorts) bank = openBankOutfit(bank, row.id)
    f.put('inspirationBank', 'main', bank)
    const before = structuredClone(f.entities); f.apply(f.prepare())
    const u = f.entities.get('umas/invented-0')!; u.version++; u.data.level = 11; u.data.unlockedTier = 2
    ;(u.data.scenarios as object[]).push(createScenarioTraining(2))
    f.finish()
    for (const [key, row] of before) if (row.kind !== 'umas') expect(f.entities.get(key)).toEqual(row)
    expect(f.entities.get('umas/invented-0')!.data.level).toBe(11)
    expect((f.entities.get('umas/invented-0')!.data.scenarios as object[])).toHaveLength(2)
    expect(parseSaveSnapshotOrThrow({ entities: [...f.entities.values()], logs: [...f.logs.values()], serverTime: 100 })).toBeDefined()
  })
  it('preserves scenario array ordering while freezing sorted metadata and rejects changed frozen pages', () => {
    const f = rehearsal(2, 14, 'absent'), u = f.entities.get('umas/invented-0000')!
    ;(u.data.scenarios as object[]).reverse(); expect(parseUmaSave(u.data)).not.toBeNull()
    const before = structuredClone(u.data); f.apply(f.prepare()); f.apply(f.request('advance', 0))
    expect(f.entities.get('umas/invented-0000')!.data).toEqual(clearFarmRetiredExtra(before))
    const page = f.entities.get(`farmCutoverPages/${f.generation}:0`)!.data.outfits as { sourceVersion: number }[]
    page[1]!.sourceVersion++
    expect(f.apply(f.request('advance', 1)).response.message).toMatch(/page changed/)
  })
  it.each(Array.from(new Set([...Array.from({ length: 11 }, (_, i) => 600 - i * 15), ...Array.from({ length: 11 }, (_, i) => 720 - i * 24)])))
    ('retains the exact %i-minute legacy timer and pays one old crop with no new EXP', minutes => {
      const f = rehearsal(), old = f.entities.get('farm/main')!.data.plots as { cycle: { readyAt: number } | null }[]
      old[1]!.cycle!.readyAt = minutes * 60_000; f.apply(f.prepare()); f.finish()
      f.entities.get('farmWorkers/invented-0001')!.data.totalExp = 72 // Independently earned new-generation progress must survive an old claim.
      const operation = (id: string, now: number) => {
        const base = createFarmOperation({ schemaVersion: 1, operationId: id, generation: f.generation, now, dependencies: [], expected: [],
          payload: { kind: 'claim-legacy', stationId: 'garden-2', outfitId: 'invented-0001', cycleId: 'farm:plot-2:2', cropId: 'produce:t1:speed' } })
        return createFarmOperation({ ...base, expected: farmOperationReferences(base).entities.map(k => { const [kind, rowId] = k.split('/'); return { kind: kind!, id: rowId!, version: f.entities.get(k)?.version ?? 0 } }) })
      }
      const claim = (id: string, now: number) => {
        const result = resolveFarmOperations({ enabled: true, now, entities: f.entities, logs: f.logs }, [operation(id, now)])
        result.writes.forEach(r => f.entities.set(`${r.kind}/${r.id}`, r)); result.appends.forEach(r => f.logs.set(`${r.kind}/${r.id}`, r)); return result
      }
      expect(claim('too-early', minutes * 60_000 - 1).responses[0]!.receipt).toBeNull()
      expect(claim('old-claim', minutes * 60_000).responses[0]!.receipt!.result).toMatchObject({ expAward: 0 })
      expect(claim('other-claim', minutes * 60_000).writes).toHaveLength(0)
      expect(f.entities.get('items/produce:t1:speed')!.data.quantity).toBe(124)
      expect(f.entities.get('farmWorkers/invented-0001')!.data.totalExp).toBe(72)
    })
  it('does not resurrect a harvest accepted before freeze, and retains unassigned attempt floors', () => {
    const f = rehearsal(), plots = f.entities.get('farm/main')!.data.plots as { templateId: string | null; lastCropId: string | null; cycle: object | null }[]
    plots[0]!.templateId = null; plots[0]!.lastCropId = null
    const id = 'farm:plot-2:2', data = { id, itemId: 'produce:t1:speed', delta: 1, reason: 'farm-harvest',
      source: { kind: 'farm-harvest', plotId: 'plot-2', cycleId: id, templateId: 'invented-0001', farmingExp: 12 }, createdAt: 1 }
    f.logs.set(`itemLedger/${id}`, { kind: 'itemLedger', id, data, createdAt: 1 }); f.apply(f.prepare()); f.finish()
    const legacy = f.entities.get(`farmCutoverPages/${f.generation}:legacy`)!.data.stations as { stationId: string; attempt: number; cycle: object | null }[]
    expect(legacy.find(s => s.stationId === 'garden-2')!.cycle).toBeNull()
    expect(legacy.find(s => s.stationId === 'garden-1')!.attempt).toBe(1)
    expect(f.logs.get(`itemLedger/${id}`)!.data).toEqual(data)
    expect(parseFarmCutoverResponse({ status: 'active', message: null, entities: [], receipt: null })).toBeNull()
  })
})
