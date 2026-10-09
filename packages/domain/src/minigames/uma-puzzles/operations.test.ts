import { describe, expect, it } from 'vitest'
import { createPuzzleOperation, parsePuzzleOperation, parsePuzzleOperationBatch, parsePuzzleOperationResponses, partitionPuzzleOperations,
  resolvePuzzleOperations, resolvePuzzleTakeover, parsePuzzlePrepareRequest, parsePuzzleTakeoverRequest, parsePuzzleTakeoverResponse, PUZZLE_SYNC_LIMITS } from './operations'
import { parseConstellationBankSave, parsePuzzleCheckpointSave, parsePuzzleOutfitSave, parsePuzzlePresetSave, puzzlePayloadHash, puzzleReadiness } from './records'
import { puzzleProtocolFixture } from './protocol-fixtures'
import { parseEntityData, parseSaveSnapshot, parseUmaSave } from '../../save'
import { createBattle, applyBattleAction } from './battle'
import { puzzleBattleResult } from './replay'
import { puzzleBotAction } from './bots'
import { parsePuzzleResultSave, puzzleData } from './records'
import { puzzleChapter } from './campaign/chapters'
import { applyPuzzleTerminal, createPuzzleCheckpoint, puzzleChapterStatus } from './campaign/progress'
import { resolvePuzzleEncounter } from './campaign/encounters'
import { acceptedFact } from './campaign/test-helpers'
import { puzzleSeed } from './rng'
import { puzzleStats, puzzleWinExp } from './progression'
import type { PuzzleBattleInputV1 } from './battle-types'

const spend = { kind: 'cl-spend' as const, outfitId: 'invented-0', scenarioId: 'ura-finale', inputs: [{ itemId: 'constellation:ura-finale:front' as const, quantity: 1 }] }
describe('Puzzle atomic protocol v1', () => {
  it('opens an incomplete party chapter without reserving or rewarding, and checks explicit transfers', () => {
    const f = puzzleProtocolFixture(), empty = { ...f.party, slots: f.party.slots.map(() => null) }
    expect(f.apply(f.operation({ kind: 'save-party', party: empty }, 'empty-party')).responses[0]?.status).toBe('applied')
    expect(f.apply(f.operation({ kind: 'open-chapter', partyId: f.party.partyId, scenarioId: 'ura-finale' }, 'open')).responses[0]?.status).toBe('applied')
    expect(parsePuzzleCheckpointSave(f.entities.get('puzzleCheckpoints/pzp:puzzle-party-1:ura-finale')!.data)).toMatchObject({ open: null })
    expect(f.logs.size).toBe(2)
    const original = puzzleProtocolFixture(), second = { ...empty, partyId: 'puzzle-party-2' }
    original.apply(original.operation({ kind: 'save-party', party: second }, 'second-party'))
    const duplicate = { ...second, slots: f.party.slots }
    expect(original.apply(original.operation({ kind: 'save-party', party: duplicate }, 'duplicate-party')).responses[0]?.status).toBe('rejected')
    expect(original.apply(original.operation({ kind: 'transfer', outfitId: 'invented-0', fromPartyId: f.party.partyId, toPartyId: second.partyId, slot: 0 }, 'transfer')).responses[0]?.status).toBe('applied')
    expect(parsePuzzlePresetSave(original.entities.get('puzzlePresets/puzzle-party-1')!.data)!.slots[0]).toBeNull()
    expect(parsePuzzlePresetSave(original.entities.get('puzzlePresets/puzzle-party-2')!.data)!.slots[0]?.outfitId).toBe('invented-0')
  })
  it('allows CL on an unenrolled owned outfit using its original source, without creating enrollment', () => {
    const f = puzzleProtocolFixture(1); f.entities.delete('puzzleOutfits/invented-0')
    expect(f.apply(f.operation(spend, 'missing-source')).responses[0]?.status).toBe('rejected')
    const uma = f.entities.get('umas/invented-0')!; uma.version++ // unrelated Racing revision
    expect(f.apply(f.operation({ ...spend, source: f.sources[0]! }, 'source-spend')).responses[0]?.status).toBe('applied')
    expect(f.entities.has('puzzleOutfits/invented-0')).toBe(false)
  })
  it('equips an unlocked outfit default independently from frozen party slots, and refuses a locked pattern', () => {
    const f = puzzleProtocolFixture(), locked = { kind: 'equip-outfit' as const, outfitId: 'invented-0', kit: { activeId: 'puzzle:front-convert' as const, patternId: 'puzzle:four' as const } }
    expect(f.apply(f.operation(locked, 'locked')).responses[0]?.status).toBe('rejected')
    const row = f.entities.get('puzzleOutfits/invented-0')!, outfit = parsePuzzleOutfitSave(row.data)!
    row.data.enrollment = { ...outfit.enrollment, level: 5 }
    expect(f.apply(f.operation(locked, 'unlocked')).responses[0]?.status).toBe('applied')
    expect(parsePuzzleOutfitSave(row.data)!.kit.patternId).toBeNull() // prior immutable row
    expect(parsePuzzleOutfitSave(f.entities.get('puzzleOutfits/invented-0')!.data)!.kit.patternId).toBe('puzzle:four')
    expect(parsePuzzlePresetSave(f.entities.get('puzzlePresets/puzzle-party-1')!.data)!.slots[0]!.kit.patternId).toBeNull()
    const reserve = f.reserve(); f.apply(reserve)
    expect(f.apply(f.operation({ ...locked, kit: { ...locked.kit, patternId: null } }, 'open-edit')).responses[0]?.reason).toMatch(/open battle/)
  })
  it('exchanges only unlocked adjacent same-style stock and intercepts output debt atomically', () => {
    const f = puzzleProtocolFixture(2), bank = f.entities.get('constellationBank/main')!
    bank.data.openingClears = ['unity-cup']
    bank.data.cohortCount = 1; bank.data.completedCount = 1; bank.data.debitLimits = { 'constellation:unity-cup:front': 1 }; bank.data.balances = { 'constellation:unity-cup:front': -1 }
    const exchange = { kind: 'exchange' as const, from: 'constellation:ura-finale:front', to: 'constellation:unity-cup:front', quantity: 2 }
    const receipt = f.apply(f.operation(exchange, 'exchange')).responses[0]!.receipt!
    expect(receipt).not.toBeNull(); expect(f.entities.get(`items/${exchange.to}`)!.data.quantity).toBe(0)
    expect(f.entities.get(`items/${exchange.from}`)!.data.quantity).toBe(0)
    expect(f.entities.get('constellationBank/main')!.data.balances).toEqual({ [exchange.to]: 0 })
    expect(receipt.logs.filter(l => l.kind === 'itemLedger')).toHaveLength(2)
    expect(f.apply(f.operation({ ...exchange, to: 'constellation:trackblazer:front' }, 'nonadjacent')).responses[0]?.status).toBe('rejected')
  })
  it('uses strict additive records and an active empty cohort, not endless preparation', () => {
    const f = puzzleProtocolFixture()
    expect(parseUmaSave(f.entities.get('umas/invented-0')!.data)).not.toBeNull()
    for (const row of f.entities.values()) expect(parseEntityData(row.kind as Parameters<typeof parseEntityData>[0], row.data)).not.toBeNull()
    const bank = parseConstellationBankSave(f.entities.get('constellationBank/main')!.data)!
    expect(bank).toMatchObject({ phase: 'active', cohortCount: 0, completedCount: 0 })
    expect(parseConstellationBankSave({ ...bank, phase: 'preparing' })).toBeNull()
    expect(puzzleReadiness(false, bank)).toBe('disabled'); expect(puzzleReadiness(true, null)).toBe('preparing'); expect(puzzleReadiness(true, bank)).toBe('active')
    expect(parseSaveSnapshot({ entities: [...f.entities.values()], logs: [], serverTime: 1 })).not.toBeNull()
  })
  it('rejects prototype/extra/future/sparse/duplicate records and operation digests', () => {
    const f = puzzleProtocolFixture(), outfit = f.entities.get('puzzleOutfits/invented-0')!.data
    for (const bad of [{ ...outfit, schemaVersion: 2 }, { ...outfit, extra: true }, Object.assign(Object.create({ sneaky: true }), outfit)]) expect(parsePuzzleOutfitSave(bad)).toBeNull()
    const party = structuredClone(f.party), sparse = structuredClone(f.party); delete sparse.slots[1]
    party.slots[1] = party.slots[0]!
    expect(parsePuzzlePresetSave(party)).toBeNull(); expect(parsePuzzlePresetSave(sparse)).toBeNull()
    const op = f.operation(spend)
    for (const bad of [{ ...op, schemaVersion: 2 }, { ...op, payloadDigest: '0'.repeat(16) }, { ...op, expected: [...op.expected, op.expected[0]] },
      { ...op, payload: { ...spend, debtPaid: 99 } }, Object.assign(Object.create({ extra: true }), op)]) expect(parsePuzzleOperation(bad)).toBeNull()
  })
  it('moves CL/items/bank/ledger/receipt together; same payload retry precedes stale revisions', () => {
    const f = puzzleProtocolFixture(1), op = f.operation(spend), first = f.apply(op)
    expect(first.responses[0]).toMatchObject({ status: 'applied' })
    expect(f.entities.get('items/constellation:ura-finale:front')!.data.quantity).toBe(0)
    expect((f.entities.get('umas/invented-0')!.data.scenarios as { trainingLevel: number }[])[0]!.trainingLevel).toBe(2)
    expect(f.logs.size).toBe(2)
    expect(f.apply(op).responses[0]).toMatchObject({ status: 'duplicate', receipt: first.responses[0]!.receipt })
    const reused = createPuzzleOperation({ ...op, payload: { ...spend, inputs: [{ ...spend.inputs[0]!, quantity: 2 }] } })
    expect(f.apply(reused).responses[0]?.reason).toMatch(/reused/)
  })
  it('rejects stale spends and missing dependencies without any evidence or partial projection', () => {
    const f = puzzleProtocolFixture(1), a = f.operation(spend, 'spend-a'), b = f.operation(spend, 'spend-b')
    f.apply(a); const before = [...f.entities.values()], count = f.logs.size
    expect(f.apply(b).responses[0]).toMatchObject({ status: 'rejected' })
    expect([...f.entities.values()]).toEqual(before); expect(f.logs.size).toBe(count)
    const blocked = f.operation(spend, 'blocked', ['not-accepted'])
    expect(f.apply(blocked).responses[0]).toMatchObject({ status: 'blocked' }); expect(f.logs.size).toBe(count)
  })
  it('rolls back after a late validation failure, including malformed Uma/stale inventory', () => {
    const f = puzzleProtocolFixture(), op = f.operation(spend)
    f.entities.get('umas/invented-0')!.data.schemaVersion = 99
    const before = structuredClone([...f.entities]), count = f.logs.size
    const r = f.apply(op)
    expect(r.writes).toHaveLength(0); expect(r.appends).toHaveLength(0); expect([...f.entities]).toEqual(before); expect(f.logs.size).toBe(count)
  })
  it('freezes a reservation, locks parties/correction and never rerolls it', () => {
    const f = puzzleProtocolFixture(), reserve = f.reserve()
    const r = f.apply(reserve)
    expect(r.responses[0]?.status, r.responses[0]?.reason ?? '').toBe('applied')
    const checkpoint = parsePuzzleCheckpointSave(f.entities.get(`puzzleCheckpoints/${reserve.payload.kind === 'reserve' ? reserve.payload.encounter.input.checkpointId : ''}`)!.data)!
    expect(checkpoint.open?.input).toEqual(reserve.payload.kind === 'reserve' ? reserve.payload.encounter.input : null)
    expect(f.apply(f.operation({ kind: 'save-party', party: { ...f.party, name: 'Changed' } }, 'edit')).responses[0]?.reason).toMatch(/open battle/)
    expect(f.apply(f.operation({ kind: 'correct', outfitId: 'invented-0', element: 'water' }, 'correct')).responses[0]?.status).toBe('rejected')
    expect(f.apply(f.reserve('reroll')).responses[0]?.reason).toMatch(/Resume/)
  })
  it('checks frozen enemy/reward recipes rather than accepting an arbitrary UI drop vector', () => {
    const f = puzzleProtocolFixture(), good = f.reserve()
    if (good.payload.kind !== 'reserve') throw new Error('Fixture')
    for (const mutate of [(v: typeof good.payload.encounter) => { v.input.rewards[0]!.quantity++ },
      (v: typeof good.payload.encounter) => { v.input.enemies[0]!.maxHp++ },
      (v: typeof good.payload.encounter) => { v.input.seed = 'friendly-board' }]) {
      const encounter = structuredClone(good.payload.encounter); mutate(encounter); encounter.inputHash = puzzlePayloadHash(encounter.input)
      const op = f.operation({ kind: 'reserve', encounter })
      expect(f.apply(op).responses[0]?.status).toBe('rejected'); expect(f.logs.size).toBe(0)
    }
  })
  it('settles replay evidence once, calculates five fixed EXP awards and matching debt itself', () => {
    const f = puzzleProtocolFixture(0, 1), reserve = f.reserve()
    expect(f.apply(reserve).responses[0]?.status).toBe('applied')
    if (reserve.payload.kind !== 'reserve') throw new Error('Fixture')
    let state = createBattle(reserve.payload.encounter.input)
    for (let n = 0; n < 181 && state.outcome === 'active'; n++) state = applyBattleAction(state, puzzleBotAction(state, 'competent')).state
    expect(state.outcome).toBe('win')
    const result = puzzleBattleResult(state), op = f.operation({ kind: 'settle', checkpointId: state.input.checkpointId, inputHash: reserve.payload.encounter.inputHash, result }, 'settle', ['invented-reserve'])
    const r = f.apply(op)
    expect(r.responses[0]?.status, r.responses[0]?.reason ?? '').toBe('applied')
    const saved = f.logs.get(`puzzleResults/${result.battleId}`)!.data
    expect(saved.exp).toHaveLength(5); expect(saved.materials).toContainEqual({ itemId: 'constellation:ura-finale:front', gross: 1, debtPaid: 1, net: 0 })
    expect(f.entities.get('constellationBank/main')!.data.balances).toEqual({ 'constellation:ura-finale:front': 0 })
    expect(f.apply(op).responses[0]?.status).toBe('duplicate')
    expect(f.apply(f.operation(op.payload, 'other-claim')).responses[0]?.status).toBe('rejected')
  }, 15000)
  it('keeps a v1-era account working: its checkpoint reads on the v2 line and its open v1 fight on a retired stage settles by v1 rules (D301)', () => {
    const f = puzzleProtocolFixture(), v1 = puzzleChapter('ura-finale', undefined, 1), reserve = f.reserve()
    if (reserve.payload.kind !== 'reserve') throw new Error('Fixture')
    // A v1 checkpoint halfway into Senior that skipped o8a, with a fight open on the retired tenth pair.
    const played = ['o1a', 'o1b', 'o2a', 'o2b', 'o3a', 'o3b', 'g1', 'o4a', 'o4b', 'o5a', 'o5b', 'o6a', 'o6b', 'g2', 'o7a', 'o7b', 'o8b', 'o9a']
    const progress = played.reduce((p, localId) => applyPuzzleTerminal(v1, p, acceptedFact(v1, p, localId)), createPuzzleCheckpoint(v1, 'puzzle-party-1'))
    const node = v1.nodes.find(n => n.localId === 'o10a')!, encounter = resolvePuzzleEncounter(v1, node.id, { schemaVersion: 1,
      manifestVersion: reserve.payload.encounter.input.content.manifestVersion, members: [{ id: 'invented-foe', elements: ['fire', 'water', 'wood', 'light', 'dark'],
        roles: ['striker', 'healer', 'guard', 'converter', 'ward', 'champion'] }] })
    const battleId = 'pzb:puzzle-party-1:ura-finale:o10a:0', base = reserve.payload.encounter.input
    const input: PuzzleBattleInputV1 = { ...base, battleId, seed: `puzzle-seed-${puzzleSeed('invented-cutover', 'account')}-${puzzleSeed(battleId, 'attempt')}`,
      encounterLevel: node.level, kind: 'ordinary', enemies: encounter.enemies, rewards: encounter.rewards,
      entrants: base.entrants.map(e => ({ ...e, level: 30, stats: puzzleStats(e.source, 30) })), content: { ...base.content, recipeHash: 'puzzle-campaign-v1' } }
    const open = { ...reserve.payload.encounter, input, inputHash: puzzlePayloadHash(input) }
    const checkpointId = 'pzp:puzzle-party-1:ura-finale'
    f.put('puzzleCheckpoints', checkpointId, { schemaVersion: 1, checkpointId, scenarioId: 'ura-finale', progress,
      reached: puzzleChapterStatus(v1, progress).reached, open, revision: 4 }, 4)
    const loaded = parsePuzzleCheckpointSave(f.entities.get(`puzzleCheckpoints/${checkpointId}`)!.data)!
    expect(loaded.progress.cleared).not.toContain('pzn:ura-finale:o8a'); expect(loaded.open?.input.battleId).toBe(battleId)
    expect(loaded.reached).toContain('pzn:ura-finale:o9b'); expect(loaded.reached).toContain('pzn:ura-finale:g3')
    let state = createBattle(input)
    for (let n = 0; n < 181 && state.outcome === 'active'; n++) state = applyBattleAction(state, puzzleBotAction(state, 'competent')).state
    expect(state.outcome).toBe('win')
    const result = puzzleBattleResult(state), r = f.apply(f.operation({ kind: 'settle', checkpointId, inputHash: open.inputHash, result }, 'settle-v1'))
    expect(r.responses[0]?.status, r.responses[0]?.reason ?? '').toBe('applied')
    const receipt = parsePuzzleResultSave(f.logs.get(`puzzleResults/${battleId}`)!.data)!
    expect(receipt.materials.reduce((n, m) => n + m.gross, 0)).toBe(3)
    expect(receipt.exp[0]!.amount).toBe(puzzleWinExp(9, 30, 'ordinary', 1))
    const after = parsePuzzleCheckpointSave(f.entities.get(`puzzleCheckpoints/${checkpointId}`)!.data)!
    expect(after.open).toBeNull(); expect(after.progress).toEqual(loaded.progress)
    expect(parsePuzzleCheckpointSave(puzzleData(after))).toEqual(after)
  }, 15000)
  it('compares takeover/settlement epoch and preserves everything except explicit ownership metadata', () => {
    const f = puzzleProtocolFixture(), reserve = f.reserve(); f.apply(reserve)
    if (reserve.payload.kind !== 'reserve') throw new Error('Fixture')
    const input = reserve.payload.encounter.input, takeover = { schemaVersion: 1 as const, checkpointId: input.checkpointId, battleId: input.battleId, expectedEpoch: 0, deviceId: 'second-device' }
    const ctx = { accountSeed: 'invented-cutover', enabled: true, now: 20, entities: f.entities, logs: f.logs }
    const taken = resolvePuzzleTakeover(ctx, takeover)
    expect(taken.response.status).toBe('taken-over')
    expect(parsePuzzleTakeoverResponse(taken.response, takeover)).toEqual(taken.response)
    expect(parsePuzzleTakeoverResponse(taken.response, { ...takeover, deviceId: 'wrong-device' })).toBeNull()
    const open = parsePuzzleCheckpointSave(taken.writes[0]!.data)!.open!
    expect(open.input).toEqual({ ...input, ownerEpoch: 1 }); expect(open.ownerEpoch).toBe(1)
    f.entities.set(`puzzleCheckpoints/${input.checkpointId}`, taken.writes[0]!)
    const state = applyBattleAction(createBattle(input), { type: 'abandon' }).state
    const old = f.operation({ kind: 'settle', checkpointId: input.checkpointId, inputHash: reserve.payload.encounter.inputHash, result: puzzleBattleResult(state) }, 'old-device-settle')
    expect(f.apply(old).responses[0]?.reason).toMatch(/ownership/)
    expect(resolvePuzzleTakeover(ctx, takeover).response.status).toBe('rejected')
  })
  it('bounds and partitions complete groups and rejects response mismatch', () => {
    const f = puzzleProtocolFixture(), ops = Array.from({ length: 17 }, (_, i) => f.operation(spend, `op-${i}`))
    expect(PUZZLE_SYNC_LIMITS).toEqual({ groups: 16, bytes: 262144, documents: 200, receiptBytes: 921600 })
    expect(parsePuzzleOperationBatch(ops)).toBeNull(); expect(partitionPuzzleOperations(ops).map(b => b.length)).toEqual([16, 1])
    const refs = Array.from({ length: 199 }, (_, i) => ({ kind: 'umas', id: `invented-extra-${i}`, version: 0 }))
    const wide = createPuzzleOperation({ ...ops[0]!, expected: refs })
    expect(parsePuzzleOperation(wide)).not.toBeNull(); expect(parsePuzzleOperationBatch([wide])).toBeNull()
    const large = Array.from({ length: 16 }, (_, i) => createPuzzleOperation({ ...ops[0]!, operationId: `large-${i}`, expected: refs.map(r => ({ ...r, id: r.id.padEnd(120, 'x') })) }))
    expect(new TextEncoder().encode(JSON.stringify(large)).length).toBeGreaterThan(PUZZLE_SYNC_LIMITS.bytes)
    expect(parsePuzzleOperationBatch(large)).toBeNull()
    const op = ops[0]!, response = f.apply(op).responses
    expect(parsePuzzleOperationResponses(response, [op])).not.toBeNull()
    for (const bad of [[], [response[0], response[0]], [{ ...response[0], operationId: 'unknown' }], [{ ...response[0], authoritative: [] }]])
      expect(parsePuzzleOperationResponses(bad, [op])).toBeNull()
  })
  it('keeps release off and preparation requests non-mutating until the later task', () => {
    const f = puzzleProtocolFixture(), op = f.operation(spend)
    const r = resolvePuzzleOperations({ accountSeed: 'test', enabled: false, now: 1, entities: f.entities, logs: f.logs }, [op])
    expect(r.writes).toEqual([]); expect(r.responses[0]?.reason).toMatch(/disabled/)
    expect(parsePuzzlePrepareRequest({ schemaVersion: 1, cutoverId: 'cutover', expectedBankRevision: 0 })).not.toBeNull()
    expect(parsePuzzlePrepareRequest({ schemaVersion: 2, cutoverId: 'cutover', expectedBankRevision: 0 })).toBeNull()
    expect(parsePuzzleTakeoverRequest({ schemaVersion: 1, checkpointId: 'pzp:puzzle-party-1:ura-finale', battleId: 'pzb:puzzle-party-2:ura-finale:o1a:0', expectedEpoch: 0, deviceId: 'other' })).toBeNull()
  })
})
