// Small invented accounts only; no owner data/content.
import { describe, expect, it } from 'vitest'
import { parsePlayerProfile, parseUmaSave, parseSyncRequest, type UmaSave } from '../../save'
import { constellationTemplate } from '../../constellation'
import { resolvePuzzlePreservation, preservationHeader, parsePuzzlePreservationRequest } from './preservation'
import { parseConstellationBankSave, parsePuzzleCohortSave, puzzleCohortId } from './records'
import { parsePuzzlePreservationRecord } from './preservation-records'
import { preservationFixture } from './preservation.synthetic'
describe('receipt-owned preservation', () => {
  it('previews without writes, freezes once, processes units, then separately activates/credits once', () => {
    const f = preservationFixture(), before = structuredClone(f.entities)
    const edited = f.entities.get('umas/invented-0')!, scenarios = edited.data.scenarios as Record<string, unknown>[]
    scenarios[0]!.trainingLevel = 4; scenarios[0]!.trainingExp = 999
    const expected = structuredClone(f.entities)
    expect(f.apply(f.request('preview')).response.summary).toMatchObject({ units: 5, rawExp: 1250, credited: 1, originalStock: 3, stockAfter: 4 })
    expect(f.entities).toEqual(expected)
    expect(f.apply().response.status).toBe('preparing')
    const oldRequest = f.request(); expect(f.apply().response.status).toBe('preparing')
    expect(f.entities.get('items/training:level-up-ticket')!.data.quantity).toBe(3)
    expect(f.apply(oldRequest).writes).toEqual([])
    expect(f.apply().response.status).toBe('active')
    const after = structuredClone(f.entities), duplicate = f.apply()
    expect(duplicate.writes).toEqual([]); expect(f.entities).toEqual(after); expect(f.logs.size).toBe(1)
    const uma = parseUmaSave(f.entities.get('umas/invented-0')!.data)!
    expect(uma.schemaVersion).toBe(16); expect(uma.scenarios[0]).toMatchObject({ trainingLevel: 4, trainingExp: 0 })
    expect(uma.scenarios[0]!.presets).toEqual((expected.get('umas/invented-0')!.data.scenarios as typeof uma.scenarios)[0]!.presets)
    expect(parsePlayerProfile(f.entities.get('profile/main')!.data)).toMatchObject({ schemaVersion: 16, trainingExpBank: 0 })
    expect(f.entities.get('umas/invented-1')!.data.level).toEqual(before.get('umas/invented-1')!.data.level)
    expect(parseSyncRequest({ upserts: [], appends: [...f.logs.values()] })).not.toBeTypeOf('string')
  })
  it('charges CL1→0 and CL10→9 once, preferred A wins, otherwise uses canonical first A', () => {
    const f = preservationFixture(2), a = f.entities.get('umas/invented-0')!, b = f.entities.get('umas/invented-1')!
    a.data.racePreferences = { strategy: 'late', distance: 'medium', surface: 'turf' }
    ;(b.data.scenarios as Record<string, unknown>[])[0]!.trainingLevel = 10
    f.content.sources.get('invented-0')!.aptitudes.strategy.late = 'A'
    f.apply(); f.apply(); f.apply()
    expect(parsePuzzleCohortSave(f.entities.get(`puzzleCohort/${puzzleCohortId('invented-0', 'ura-finale')}`)!.data)).toMatchObject({ debtStyle: 'late', debit: 0 })
    expect(parseConstellationBankSave(f.entities.get('constellationBank/main')!.data)?.balances).toMatchObject({ 'constellation:ura-finale:front': -9 })
  })
  it('retains zero receipts, allows an empty cohort, and rounds a final fraction only once for the whole account', () => {
    const f = preservationFixture(0); f.apply(); expect(f.apply().response.status).toBe('active')
    expect(f.entities.get('items/training:level-up-ticket')!.data.quantity).toBe(4)
    expect(parsePuzzlePreservationRecord(f.entities.get('puzzlePreservation/main')!.data)).toMatchObject({ receipt: { rawExp: 251, compensation: 1 } })
    f.apply(); expect(f.logs.size).toBe(1)
  })
  it('survives bounded batches, fresh coordinator, and excludes future units without resnapshotting', () => {
    const f = preservationFixture(40); f.apply(); f.apply()
    const header = preservationHeader(f.entities)!, frozen = structuredClone(f.entities.get('puzzlePreservation/page-0'))
    expect(header.cursor).toBe(16)
    f.entities.set('umas/future', { ...structuredClone(f.entities.get('umas/invented-0')!), id: 'future' })
    f.apply(); f.apply(); expect(f.apply().response.status).toBe('active')
    expect(f.entities.get('puzzlePreservation/page-0')).toEqual(frozen)
    expect(preservationHeader(f.entities)?.unitCount).toBe(40)
    expect([...f.entities.values()].filter(r => r.kind === 'puzzleCohort')).toHaveLength(40)
  })
  it('rejects unknown sources, unmigrated data and safe-size overflow before any write', () => {
    const f = preservationFixture(); f.content.sources.delete('invented-0'); const before = structuredClone(f.entities)
    expect(() => f.apply()).toThrow(/source/); expect(f.entities).toEqual(before)
    const g = preservationFixture(4097); expect(() => g.apply()).toThrow(/bounds/); expect(g.entities.has('constellationBank/main')).toBe(false)
    const h = preservationFixture(1); h.entities.get('umas/invented-0')!.data.schemaVersion = 14
    expect(() => h.apply()).toThrow(/migrat/); expect(h.entities.has('constellationBank/main')).toBe(false)
    const i = preservationFixture(1), unchanged = structuredClone(i.entities)
    expect(parsePuzzlePreservationRequest({ ...i.request(), cutoverId: 'x'.repeat(100) })).not.toBeNull()
    expect(() => i.apply({ ...i.request(), cutoverId: 'x'.repeat(101) })).toThrow(/Invalid preservation request/)
    expect(i.entities).toEqual(unchanged)
    i.apply(); expect(parsePuzzlePreservationRecord({ ...preservationHeader(i.entities)!, cutoverId: 'x'.repeat(101) })).toBeNull()
  })
  it('preserves distinct four-preset cards, lineage, Inspiration, crops, skills and unrelated historical rows byte-for-byte', () => {
    const f = preservationFixture(1), row = f.entities.get('umas/invented-0')!, data = row.data as unknown as UmaSave, unit = data.scenarios[0]!
    unit.trainingLevel = 10; unit.started = true; unit.inspiration = { slots: ['parent0'], golds: ['parent0:gold0'] }
    unit.extraStatsUnlocked.speed = 4
    const node = constellationTemplate(1).nodes.find(n => n.kind === 'card')!.id
    for (const distance of ['sprint', 'mile', 'medium', 'long'] as const) unit.presets[distance] = {
      cardSetIds: [`invented-${distance}-card`], assignments: { [node]: { kind: 'card', cardId: `invented-${distance}-card` },
        parent0: { kind: 'lineage', templateId: 'invented-parent' } }, activeExtraStats: ['speed-1'], loadoutSkillIds: [`invented-${distance}-skill`] }
    expect(parseUmaSave(data)).not.toBeNull()
    for (const kind of ['cards', 'badges', 'farm', 'rpgOutfits']) f.entities.set(`${kind}/invented-history`, { kind, id: 'invented-history', version: 7,
      data: { untouched: 'invented historical evidence' }, deleted: false, updatedAt: 1 })
    for (const kind of ['raceResults', 'flairEvents', 'itemLedger']) f.logs.set(`${kind}/invented-old`, { kind, id: 'invented-old', createdAt: 1,
      data: { untouched: 'previously converted overflow or earned fact' } })
    const before = structuredClone(f.entities), oldLogs = structuredClone(f.logs)
    f.apply(); f.apply(); f.apply()
    expect(f.entities.get('umas/invented-0')!.data).toEqual({ ...before.get('umas/invented-0')!.data, schemaVersion: 16 })
    for (const [key, old] of before) if (!['profile', 'umas', 'items'].includes(old.kind)) expect(f.entities.get(key)).toEqual(old)
    for (const [key, old] of oldLogs) expect(f.logs.get(key)).toEqual(old)
    expect(preservationHeader(f.entities)?.receipt?.credited).toBe(1) // Old item evidence is not counted as unapplied EXP.
  })
  it('does not accept changed frozen EXP/stock, different cutover identity, or erased receipts', () => {
    const f = preservationFixture(); f.apply(); const u = f.entities.get('umas/invented-0')!
    ;(u.data.scenarios as Record<string, unknown>[])[0]!.trainingExp = 1
    expect(() => f.apply()).toThrow(/Frozen progression/)
    expect(() => f.apply({ ...f.request(), cutoverId: 'another-id' })).toThrow(/frozen cutover/)
  })
  it('accepts schema16 only with zero retired EXP and never runs when disabled', () => {
    const f = preservationFixture(), raw = f.entities.get('umas/invented-0')!.data
    expect(parseUmaSave({ ...raw, schemaVersion: 16 })).not.toBeNull()
    expect(parseUmaSave({ ...raw, schemaVersion: 17 })).toBeNull()
    const bad = structuredClone(raw); (bad.scenarios as Record<string, unknown>[])[0]!.trainingExp = 1
    expect(parseUmaSave({ ...bad, schemaVersion: 16 })).toBeNull()
    expect(resolvePuzzlePreservation({ enabled: false, now: 1, entities: f.entities, logs: f.logs, content: f.content }, f.request()).writes).toEqual([])
  })
})
