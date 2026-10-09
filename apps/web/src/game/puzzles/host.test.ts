// Genuine isolated IndexedDB plus invented content; no private rows or network.
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlayerProfile, nodesUnlockedBetween, constellationTemplate, parsePuzzlePresetSave, puzzleBotAction,
  puzzleBattleStateHash, puzzleCampaignId, puzzleChapter, puzzleData, puzzleEncounterRewards, puzzlePayloadHash, resolvePuzzleOperations, resolvePuzzleTakeover,
  PUZZLE_ELEMENTS, PUZZLE_FOE_ROLES, type PuzzleBattleAction, type PuzzleCheckpointSaveV1, type PuzzleOperationV1, type PuzzleStoredEntity, type UmaTemplate } from '@racer/domain'
import { puzzleProtocolFixture } from '../../../../../packages/domain/src/minigames/uma-puzzles/protocol-fixtures'
import type { LoadedContent } from '../../content/runtime'
import { RacerDb } from '../db'
import { PersistentPuzzleHost, emptyPuzzleParty, type PuzzleBattleView, type PuzzleHostOptions } from './host'
import { parsePuzzleJournal } from './journal'
import { reconcilePuzzleFlairInTransaction } from './flair'
import { usePuzzleSync } from './store'
import { createIsolatedPuzzleProof } from './proof'
import { canonicalTrainingUma, trainingSnapshot } from '../badges'

let sequence = 0
const identity = { version: 'invented-pack-v1', contentHash: 'a'.repeat(64) }
const cast = { schemaVersion: 1 as const, manifestVersion: `puzzles-${identity.contentHash}`,
  members: [{ id: 'invented-foe', elements: [...PUZZLE_ELEMENTS], roles: [...PUZZLE_FOE_ROLES] }] }
const put = (database: RacerDb, row: PuzzleStoredEntity) => database.table(row.kind).put({ id: row.id, data: row.data, version: row.version })
function contentFor(f: ReturnType<typeof puzzleProtocolFixture>): LoadedContent {
  const templates: UmaTemplate[] = f.sources.map((s, i) => ({ id: s.templateId, charaId: `invented-character-${i}`, name: `Invented ${i}`,
    outfit: 'Synthetic', jpRelease: '2000-01-01', globalRelease: null, starter: true, baseStats: s.baseStats, growthRates: s.growthRates,
    aptitudes: s.aptitudes, uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [], imageSource: 'https://invalid.test/art' }))
  const atlas = { descriptor: { schemaVersion: 1 as const, kind: 'uma-icons' as const, frameWidth: 128 as const, frameHeight: 128 as const, pages: [], frames: {} }, pageUrls: [] }
  return { manifest: { version: 'invented-catalogue', generatedAt: '', source: {}, files: [] }, origin: 'network', sparkRivals: null,
    umas: { items: templates, byId: new Map(templates.map(t => [t.id, t])) }, cards: { items: [], byId: new Map() },
    skills: { items: [], byId: new Map() }, races: { items: [], byId: new Map() }, courses: { items: [], byId: new Map() },
    atlases: { 'uma-icons': atlas, 'card-icons': { ...atlas, descriptor: { ...atlas.descriptor, kind: 'card-icons' } } }, art: { has: () => false, load: async () => null } }
}
describe('real Puzzle host and journal', () => {
  let database: RacerDb, f: ReturnType<typeof puzzleProtocolFixture>, host: PersistentPuzzleHost, options: PuzzleHostOptions
  let schedule: ReturnType<typeof vi.fn>, release: ReturnType<typeof vi.fn>, fault: string | null, writes: string[]
  beforeEach(async () => {
    f = puzzleProtocolFixture(0, 0); database = new RacerDb(`puzzle-host-test-${++sequence}`); await database.open()
    for (const row of f.entities.values()) await put(database, row)
    await database.profile.put({ id: 'main', data: { ...createPlayerProfile('invented-account', 1), tickets: 15 }, version: 1 })
    release = vi.fn(); schedule = vi.fn(() => { expect(writes.at(-1)).not.toBe('before-commit') })
    writes = []; fault = null
    options = { database, deviceId: 'invented-device', enabled: true, now: () => 100,
      source: id => f.sources.find(s => s.templateId === id)!,
      acquire: vi.fn(async requested => {
        if (requested && requested.contentHash !== identity.contentHash) throw new Error('Missing retained pack')
        return { identity, cast, release }
      }), schedule, afterWrite: boundary => { writes.push(boundary); if (fault === boundary || fault?.endsWith('*') && boundary.startsWith(fault.slice(0, -1))) throw new Error(`Injected ${boundary}`) } }
    host = new PersistentPuzzleHost(options)
    usePuzzleSync.setState({ pending: 0, message: null, recoveryIds: [] })
  })
  afterEach(async () => { await database.delete() })
  async function begin(local = 'o1a', operationId = 'begin', variant: 'pace' | 'late' | null = null, scenarioId = 'ura-finale'): Promise<PuzzleBattleView> {
    const account = await host.account(), party = account.parties[0]!, checkpoint = account.checkpoints.find(c => c.scenarioId === scenarioId)
    const view = await host.begin({ partyId: party.partyId, scenarioId, nodeId: puzzleCampaignId({ kind: 'node', scenarioId, localId: local }),
      darkVariant: variant, partyRevision: party.revision, checkpointRevision: checkpoint?.revision ?? 0 }, operationId)
    expect(view.kind).toBe('battle')
    if (view.kind !== 'battle') throw new Error('Expected battle')
    view.lease.release(); return view
  }
  async function play(view: PuzzleBattleView, bot: 'competent' | 'novice' = 'competent') {
    let state = view.state
    while (state.outcome === 'active') state = (await host.append(view.open.input.battleId, view.open.ownerEpoch, state.actionCount, puzzleBotAction(state, bot))).state
    return { battleId: state.input.battleId, ownerEpoch: state.input.ownerEpoch, expectedCount: state.actionCount, stateHash: puzzleBattleStateHash(state) }
  }
  const server = (ops: PuzzleOperationV1[]) => {
    const result = resolvePuzzleOperations({ enabled: true, accountSeed: 'invented-cutover', now: 101, entities: f.entities, logs: f.logs }, ops)
    result.writes.forEach(r => f.entities.set(`${r.kind}/${r.id}`, r)); result.appends.forEach(r => f.logs.set(`${r.kind}/${r.id}`, r)); return result.responses
  }
  const snapshot = () => ({ serverTime: 200, entities: [...f.entities.values()], logs: [...f.logs.values()] })
  async function sync() {
    for (let ops = await host.coordinator.nextBatch(); ops.length; ops = await host.coordinator.nextBatch())
      await host.coordinator.adopt(ops, server(ops), 200)
    await database.outbox.clear()
  }
  function recoveryOnline(): NonNullable<PuzzleHostOptions['online']> {
    return { available: () => true, flush: sync,
      takeover: async request => {
        const result = resolvePuzzleTakeover({ enabled: true, accountSeed: 'invented-cutover', now: 150, entities: f.entities, logs: f.logs }, request)
        result.writes.forEach(r => f.entities.set(`${r.kind}/${r.id}`, r)); return result.response
      }, snapshot: async () => snapshot() }
  }

  it('an explicit off gate and preparing bank block gameplay without touching other modes', async () => {
    const disabled = new PersistentPuzzleHost({ ...options, enabled: false })
    expect((await disabled.account()).readiness).toBe('disabled')
    await expect(disabled.enroll('invented-0', 'fire', 'disabled')).rejects.toMatchObject({ code: 'disabled' })
    const bank = (await database.constellationBank.get('main'))!
    bank.data.phase = 'preparing'; bank.data.cohortCount = 1; bank.data.completedCount = 0
    await database.constellationBank.put(bank)
    expect((await host.account()).readiness).toBe('preparing')
    await expect(host.previewCl('invented-0', 'ura-finale', [{ itemId: 'constellation:ura-finale:front', quantity: 1 }])).rejects.toMatchObject({ code: 'preparing' })
    await expect(begin()).rejects.toMatchObject({ code: 'preparing' })
    expect(await database.puzzleJournals.count()).toBe(0); expect(schedule).not.toHaveBeenCalled()
    expect((await database.profile.get('main'))!.data.tickets).toBe(15)
  })
  it('enrolls owned literal-A sources, corrects before entry, then permanently locks colour and open kits', async () => {
    await database.puzzleOutfits.delete('invented-4')
    expect((await host.registration('invented-4')).elements).toEqual(PUZZLE_ELEMENTS)
    await host.enroll('invented-4', 'water', 'enroll')
    await host.enroll('invented-4', 'water', 'enroll')
    await expect(host.enroll('invented-4', 'wood', 'enroll')).rejects.toThrow(/reused/)
    await host.correct('invented-4', 'wood', 1, 'correct')
    await expect(host.correct('invented-4', 'water', 1, 'stale')).rejects.toMatchObject({ code: 'stale' })
    const view = await begin()
    await expect(host.correct('invented-4', 'fire', 3, 'locked')).rejects.toThrow(/open battle/)
    await expect(host.equip('invented-4', f.party.slots[4]!.kit, 3, 'kit-locked')).rejects.toThrow(/open battle/)
    await host.append(view.open.input.battleId, 0, 0, { type: 'abandon' })
    await host.commit({ battleId: view.open.input.battleId, ownerEpoch: 0, expectedCount: 1, stateHash: (await database.puzzleJournals.get(view.open.input.battleId))!.stateHash })
    const o = (await database.puzzleOutfits.get('invented-4'))!
    await expect(host.correct('invented-4', 'fire', o.data.revision, 'still-locked')).rejects.toThrow(/first battle/)
    await host.equip('invented-4', { activeId: 'puzzle:pace-shield', patternId: null }, o.data.revision, 'valid-kit')
    await expect(host.equip('invented-4', { activeId: 'puzzle:pace-shield', patternId: 'puzzle:row' }, o.data.revision + 1, 'locked-pattern')).rejects.toThrow(/unavailable/)
    await database.umas.delete('invented-3'); await database.puzzleOutfits.delete('invented-3')
    await expect(host.enroll('invented-3', 'fire', 'unowned')).rejects.toThrow(/owned/)
  })
  it('uses the verified original template, not improved race preferences, for enrollment palette and no-A refusal', async () => {
    await database.puzzleOutfits.delete('invented-0')
    const base = f.sources[0]!, fixed = { ...base, aptitudes: { ...base.aptitudes, surface: { turf: 'A' as const, dirt: 'B' as const },
      strategy: { front: 'A' as const, pace: 'A' as const, late: 'B' as const, end: 'B' as const } } }
    host = new PersistentPuzzleHost({ ...options, source: () => fixed })
    expect((await host.registration('invented-0')).elements).toEqual(['light'])
    await expect(host.enroll('invented-0', 'fire', 'wrong-element')).rejects.toThrow()
    await host.enroll('invented-0', 'light', 'correct-element')
    await database.puzzleOutfits.delete('invented-1')
    const noA = { ...fixed, templateId: 'invented-1', aptitudes: { ...fixed.aptitudes, strategy: { front: 'S' as const, pace: 'B' as const, late: 'B' as const, end: 'B' as const } } }
    host = new PersistentPuzzleHost({ ...options, source: () => noA })
    await expect(host.enroll('invented-1', 'light', 'no-source-a')).rejects.toThrow()
    expect(await database.puzzleOutfits.get('invented-1')).toBeUndefined()
  })
  it('saves ten default parties, transfers atomically with explicit revisions and preserves map wins', async () => {
    expect((await host.account()).parties).toHaveLength(10)
    await host.saveParty(emptyPuzzleParty('puzzle-party-2'), 'empty')
    await host.openChapter('puzzle-party-1', 'ura-finale', 'map')
    const before = (await host.account()).parties
    await host.transfer({ outfitId: 'invented-0', fromPartyId: before[0]!.partyId, toPartyId: before[1]!.partyId, slot: 0,
      fromRevision: before[0]!.revision, toRevision: before[1]!.revision }, 'transfer')
    expect((await host.account()).parties[0]!.slots[0]).toBeNull()
    expect((await host.account()).parties[1]!.slots[0]!.outfitId).toBe('invented-0')
    expect((await host.account()).checkpoints).toHaveLength(1)
    await expect(begin()).rejects.toThrow(/five/)
    await expect(host.saveParty(f.party, 'stale-party')).rejects.toMatchObject({ code: 'stale' })
    const updated = (await host.account()).parties[0]!
    await expect(host.saveParty({ ...updated, slots: f.party.slots }, 'duplicate')).rejects.toThrow(/explicit party transfer/)
  })
  it('loads five-party saves unchanged, synthesizes 6–10 without writes, and round-trips party 10', async () => {
    for (let i = 2; i <= 5; i++) {
      const party = { ...emptyPuzzleParty(`puzzle-party-${i}`), name: `Invented original ${i}`, revision: 1 }
      const row = { kind: 'puzzlePresets', id: party.partyId, data: puzzleData(party), version: 1, updatedAt: 1, deleted: false }
      await put(database, row); f.entities.set(`puzzlePresets/${row.id}`, row)
    }
    const before = await database.puzzlePresets.toArray()
    const loaded = await host.account()
    expect(loaded.parties).toHaveLength(10)
    expect(loaded.parties.slice(5).map(p => [p.name, p.revision, p.slots])).toEqual(
      Array.from({ length: 5 }, (_, i) => [`Party ${i + 6}`, 0, [null, null, null, null, null]]))
    expect(await database.puzzlePresets.toArray()).toEqual(before)
    await host.saveParty({ ...loaded.parties[9]!, name: 'Invented tenth journey' }, 'tenth')
    await sync()
    const fresh = new PersistentPuzzleHost(options), tenth = (await fresh.account()).parties[9]!
    expect(tenth).toMatchObject({ partyId: 'puzzle-party-10', name: 'Invented tenth journey', revision: 1 })
    expect(await database.puzzlePresets.count()).toBe(6)
    expect((await database.puzzlePresets.get('puzzle-party-10'))!.data).toEqual(tenth)
  })
  it('edits and reserves party 10 through the coordinator, declares only its locks and syncs the same fight', async () => {
    const loaded = await host.account()
    await host.saveParty({ ...loaded.parties[0]!, slots: [null, null, null, null, null] }, 'clear-first')
    await host.saveParty({ ...loaded.parties[9]!, slots: f.party.slots }, 'fill-tenth')
    await host.correct('invented-0', 'water', 1, 'tenth-correction')
    const edit = (await database.pendingPuzzleOperations.get('tenth-correction'))!.operation
    expect(edit.expected.filter(e => e.kind === 'puzzlePresets')).toHaveLength(10)
    const locks = edit.expected.filter(e => e.kind === 'puzzleCheckpoints')
    expect(locks).toHaveLength(14); expect(locks.every(e => e.id.startsWith('pzp:puzzle-party-10:'))).toBe(true)
    const party = (await host.account()).parties[9]!
    const view = await host.begin({ partyId: party.partyId, scenarioId: 'ura-finale', nodeId: 'pzn:ura-finale:o1a',
      darkVariant: null, partyRevision: party.revision, checkpointRevision: 0 }, 'tenth-begin')
    if (view.kind !== 'battle') throw new Error('Expected party 10 fight')
    view.lease.release()
    await expect(host.equip('invented-0', f.party.slots[0]!.kit, 3, 'locked-tenth-kit')).rejects.toThrow(/open battle/)
    await sync()
    expect((await host.account()).checkpoints.find(c => c.progress.partyId === 'puzzle-party-10')!.open!.input).toEqual(view.open.input)
    expect(await database.pendingPuzzleOperations.count()).toBe(0)
  })
  it('blocks editing/transferring an open party and opening another chapter, but resumes its current map', async () => {
    await host.saveParty(emptyPuzzleParty('puzzle-party-2'), 'empty')
    const view = await begin(), a = await host.account()
    await expect(host.saveParty(a.parties[0]!, 'edit')).rejects.toThrow(/open battle/)
    await expect(host.transfer({ outfitId: 'invented-0', fromPartyId: 'puzzle-party-1', toPartyId: 'puzzle-party-2', slot: 0,
      fromRevision: a.parties[0]!.revision, toRevision: a.parties[1]!.revision }, 'move')).rejects.toThrow(/idle parties/)
    const count = await database.pendingPuzzleOperations.count()
    expect(await host.openChapter('puzzle-party-1', 'ura-finale', 'resume-map')).toBeNull()
    expect(await database.pendingPuzzleOperations.count()).toBe(count)
    await expect(host.openChapter('puzzle-party-1', 'unity-cup', 'other')).rejects.toThrow(/open encounter/)
    expect((await host.loadBattle(view.open.input.battleId)).kind).toBe('battle')
  })
  it('freezes seed/ordinal/cast/rewards and retries/reloads without charge or reroll', async () => {
    await expect(begin('unknown')).rejects.toThrow(/Invalid|Unknown/)
    await expect(begin('o1a', 'bad-variant', 'pace')).rejects.toThrow(/variant/)
    const view = await begin()
    expect(view.stateHash).toBe('54b8700e4d24d666') // D290 recipe input under the campaign-v2 name (D301); T107 replay math is unchanged.
    const step = await host.append(view.open.input.battleId, 0, 0, puzzleBotAction(view.state, 'competent'))
    database.close(); await database.open(); host = new PersistentPuzzleHost(options)
    const restored = await host.loadBattle(view.open.input.battleId)
    expect(restored.kind).toBe('battle')
    if (restored.kind !== 'battle') throw new Error('Expected restored battle')
    expect(restored.state).toEqual(step.state); restored.lease.release()
    const retry = await host.begin({ partyId: 'puzzle-party-1', scenarioId: 'ura-finale', nodeId: view.open.input.enemies[0]!.id,
      darkVariant: null, partyRevision: 0, checkpointRevision: 0 }, 'another-entry')
    expect(retry.kind).toBe('battle')
    if (retry.kind === 'battle') { expect(retry.open).toEqual(view.open); retry.lease.release() }
    expect(await database.pendingPuzzleOperations.count()).toBe(1)
    expect((await database.profile.get('main'))!.data.tickets).toBe(15)
    const claim = await play(restored); await host.commit(claim)
    const next = await begin('o1a', 'next')
    expect(next.open.input.battleId).toMatch(/:1$/); expect(next.open.input.seed).not.toBe(view.open.input.seed)
  })
  it('compare-and-appends once across two stale tabs; cancellations/invalid/terminal actions never write', async () => {
    const view = await begin(), id = view.open.input.battleId, action = puzzleBotAction(view.state, 'competent')
    const before = await database.puzzleJournals.get(id)
    // Cancel/pause/target previews have no host action at all.
    expect(await database.puzzleJournals.get(id)).toEqual(before)
    await expect(host.append(id, 0, 0, { type: 'drag', path: [0], elapsedMs: 0, focusId: null } as unknown as PuzzleBattleAction)).rejects.toThrow()
    expect(await database.puzzleJournals.get(id)).toEqual(before)
    const pair = await Promise.allSettled([host.append(id, 0, 0, action), host.append(id, 0, 0, action)])
    expect(pair.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect((await database.puzzleJournals.get(id))!.actions).toHaveLength(1)
    const step = await host.append(id, 0, 1, { type: 'abandon' })
    await expect(host.append(id, 0, 2, action)).rejects.toThrow(/terminal/)
    expect(step.state.outcome).toBe('abandon')
  })
  it.each(['missing', 'corrupt', 'future', 'hash', 'overbound'] as const)('never resets a %s journal, even after begin retry', async kind => {
    const view = await begin(), id = view.open.input.battleId, row = (await database.puzzleJournals.get(id))!
    if (kind === 'missing') await database.puzzleJournals.delete(id)
    else await database.puzzleJournals.put({ ...row, ...(kind === 'future' ? { schemaVersion: 2 } : {}),
      ...(kind === 'hash' ? { stateHash: 'b'.repeat(16) } : {}),
      ...(kind === 'corrupt' ? { actions: [{ type: 'unsupported' }] } : {}),
      ...(kind === 'overbound' ? { actions: Array.from({ length: 182 }, () => ({ type: 'abandon' })) } : {}) } as unknown as typeof row)
    const saved = await database.puzzleJournals.get(id)
    const recovery = await host.loadBattle(id)
    expect(recovery).toMatchObject({ kind: 'recovery', code: kind === 'missing' ? 'missing-journal' : kind === 'future' ? 'unsupported-journal' : 'corrupt-journal' })
    expect(await host.begin({ partyId: 'puzzle-party-1', scenarioId: 'ura-finale', nodeId: f.chapter.nodes[0]!.id,
      darkVariant: null, partyRevision: 1, checkpointRevision: 0 }, 'retry')).toMatchObject({ kind: 'recovery' })
    expect(await database.puzzleJournals.get(id)).toEqual(saved)
  })
  it('retains journals on unavailable or wrongly-versioned content and validates JSON round trips', async () => {
    const view = await begin(), id = view.open.input.battleId
    const row = JSON.parse(JSON.stringify(await database.puzzleJournals.get(id))) as unknown
    expect(parsePuzzleJournal(row)).toEqual(await database.puzzleJournals.get(id))
    const unavailable = new PersistentPuzzleHost({ ...options, acquire: async () => { throw new Error('Offline art') } })
    expect(await unavailable.loadBattle(id)).toMatchObject({ code: 'content-unavailable' })
    const wrong = new PersistentPuzzleHost({ ...options, acquire: async () => ({ identity: { ...identity, version: 'new-pack' }, cast, release }) })
    expect(await wrong.loadBattle(id)).toMatchObject({ code: 'content-unavailable' })
    expect((await database.puzzleJournals.get(id))!.actions).toEqual([])
    expect(release).toHaveBeenCalled()
  })
  it.each(['win', 'loss', 'abandon'] as const)('settles %s once, archives after durable receipt, and reopens exact results across reload/sync', async outcome => {
    const view = await begin(), id = view.open.input.battleId
    let claim
    if (outcome === 'abandon') {
      const step = await host.append(id, 0, 0, { type: 'abandon' })
      claim = { battleId: id, ownerEpoch: 0, expectedCount: 1, stateHash: puzzleBattleStateHash(step.state) }
    } else claim = await play(view, outcome === 'win' ? 'competent' : 'novice')
    const result = await host.commit(claim)
    expect(result.receipt.result.outcome).toBe(outcome)
    expect(result.receipt.exp).toHaveLength(5)
    expect(result.receipt.materials.reduce((n, r) => n + r.gross, 0)).toBe(outcome === 'win' ? 3 : 0)
    expect(result.receipt.exp.every(e => outcome === 'win' ? e.amount > 0 : e.amount === 0)).toBe(true)
    expect(await database.puzzleJournals.count()).toBe(0); expect(await database.puzzleArchives.count()).toBe(1)
    expect(await database.puzzleResults.count()).toBe(0); expect(await database.itemLedger.count()).toBe(0)
    const projections = await database.puzzleOutfits.toArray()
    database.close(); await database.open(); host = new PersistentPuzzleHost(options)
    expect(await host.commit(claim)).toEqual(result)
    expect(await database.puzzleOutfits.toArray()).toEqual(projections)
    await expect(host.commit({ ...claim, stateHash: 'b'.repeat(16) })).rejects.toMatchObject({ code: 'conflict' })
    await sync()
    const synced = await host.loadBattle(id)
    expect(synced.kind).toBe('result')
    if (synced.kind === 'result') { expect(synced.pending).toBe(false); expect(synced.receipt.materials).toEqual(result.receipt.materials) }
    expect(await database.puzzleResults.count()).toBe(1)
    expect(await database.itemLedger.count()).toBe(outcome === 'win' ? 3 : 0)
  })
  it('commits only terminal complete journal claims and schedules after all durable writes', async () => {
    const view = await begin(), id = view.open.input.battleId
    await expect(host.commit({ battleId: id, ownerEpoch: 0, expectedCount: 0, stateHash: view.stateHash })).rejects.toThrow(/terminal/)
    const claim = await play(view)
    await expect(host.commit({ ...claim, expectedCount: claim.expectedCount - 1 })).rejects.toMatchObject({ code: 'stale' })
    schedule.mockImplementation(() => { expect(writes.at(-1)).toBe('journal-close') })
    await host.commit(claim)
    expect(schedule).toHaveBeenCalledTimes(2)
  })
  const dump = async () => {
    const names = ['umas', 'puzzleOutfits', 'puzzlePresets', 'puzzleCheckpoints', 'constellationBank', 'items', 'itemLedger',
      'puzzleResults', 'puzzleOperations', 'pendingPuzzleOperations', 'puzzleBases', 'puzzleJournals', 'puzzleArchives', 'outbox', 'badges', 'flairEvents']
    return Promise.all(names.map(async name => [name, await database.table(name).toArray()]))
  }
  it.each(['puzzleOutfits/invented-0', 'puzzleOutfits/invented-1', 'puzzleOutfits/invented-2', 'puzzleOutfits/invented-3', 'puzzleOutfits/invented-4',
    'puzzleCheckpoints/pzp:puzzle-party-1:ura-finale', 'constellationBank/main', 'items/constellation:ura-finale:front',
    'items/constellation:ura-finale:pace', 'items/constellation:ura-finale:end', 'pending', 'itemLedger/*', 'puzzleResults/*', 'outbox', 'result', 'archive', 'journal-close'])
  ('rolls back every settlement write when storage fails after %s', async boundary => {
    const view = await begin(), claim = await play(view), before = await dump()
    schedule.mockClear(); const pending = usePuzzleSync.getState().pending
    fault = boundary
    await expect(host.commit(claim)).rejects.toThrow(/Injected/)
    expect(await dump()).toEqual(before)
    expect(schedule).not.toHaveBeenCalled(); expect(usePuzzleSync.getState().pending).toBe(pending)
    fault = null
    expect((await host.commit(claim)).receipt.result.outcome).toBe('win')
  })
  it.each(['puzzleCheckpoints/pzp:puzzle-party-1:ura-finale', 'pending', 'outbox', 'journal'])('reserves journal/input/queue all-or-none on failure after %s', async boundary => {
    const before = await dump(); fault = boundary
    await expect(begin()).rejects.toThrow(/Injected/)
    expect(await dump()).toEqual(before); expect(schedule).not.toHaveBeenCalled()
  })
  it('stores the append before exposing events, and an append storage failure preserves the preceding exact hash', async () => {
    const view = await begin(), before = await dump(); fault = 'journal'
    await expect(host.append(view.open.input.battleId, 0, 0, puzzleBotAction(view.state, 'competent'))).rejects.toThrow(/Injected/)
    expect(await dump()).toEqual(before)
    fault = null
    const transition = await host.append(view.open.input.battleId, 0, 0, puzzleBotAction(view.state, 'competent'))
    expect(transition.events.length).toBeGreaterThan(0)
    expect((await database.puzzleJournals.get(view.open.input.battleId))!.stateHash).toBe(puzzleBattleStateHash(transition.state))
  })
  it('uses frozen levels for five awards while adding EXP to current lifetime progression', async () => {
    const view = await begin(); await sync()
    for (const row of await database.puzzleOutfits.toArray()) { row.data.enrollment.level = 5; row.data.enrollment.exp = 30; row.data.revision++; await database.puzzleOutfits.put(row) }
    const result = await host.commit(await play(view))
    for (const e of result.receipt.exp) expect(e).toMatchObject({ frozenLevel: 1, amount: 28, before: { level: 5, exp: 30 }, after: { level: 5, exp: 58 } })
  })
  it('freezes the Dark boss variant/reachable node, without putting future nodes on the map by guessing ids', async () => {
    await expect(begin('c-dark', 'unreached', 'pace')).rejects.toThrow(/reached/)
    const bank = (await database.constellationBank.get('main'))!
    // Debt sized so the whole stage line's Front drops leave 7 for the Champion to repay.
    const front = puzzleChapter('ura-finale').nodes.filter(n => n.kind !== 'champion').flatMap(n => puzzleEncounterRewards(n))
      .filter(r => r.style === 'front').reduce((sum, r) => sum + r.quantity, 0) + 7
    bank.data.cohortCount = bank.data.completedCount = 10; bank.data.debitLimits = { 'constellation:ura-finale:front': front }; bank.data.balances = { 'constellation:ura-finale:front': -front }
    await database.constellationBank.put(bank)
    // Deliberately over-levelled synthetic crew: this test covers persistence/variant reachability, not balance.
    for (const row of await database.puzzleOutfits.toArray()) { row.data.enrollment.level = 30; await database.puzzleOutfits.put(row) }
    // Reach guardians through actual wins, not forged later clear flags.
    const locals = puzzleChapter('ura-finale').nodes.filter(n => n.kind !== 'champion').map(n => n.localId)
    for (const local of locals) {
      const view = await begin(local, `route-${local}`)
      const result = await host.commit(await play(view)); expect(result.receipt.result.outcome).toBe('win')
    }
    const view = await begin('c-dark', 'dark-pace', 'pace')
    expect(view.open.input.rewards).toEqual([{ style: 'pace', quantity: 12 }])
    const same = await begin('c-dark', 'different-request', 'late')
    expect(same.open.input.rewards).toEqual(view.open.input.rewards)
    await expect(begin('c-dark', 'dark-pace', 'late')).rejects.toMatchObject({ code: 'conflict' })
    const abandoned = await host.append(view.open.input.battleId, 0, 0, { type: 'abandon' })
    await host.commit({ battleId: view.open.input.battleId, ownerEpoch: 0, expectedCount: 1, stateHash: puzzleBattleStateHash(abandoned.state) })
    expect((await database.constellationBank.get('main'))!.data.balances['constellation:ura-finale:front']).toBe(-7)
    const champion = await begin('c-fire', 'fire-boss'), result = await host.commit(await play(champion))
    expect(result.receipt.materials).toEqual([{ itemId: 'constellation:ura-finale:front', gross: 12, debtPaid: 7, net: 5 }])
    expect((await database.items.get('constellation:ura-finale:front'))!.data.quantity).toBe(5)
  }, 30000)
  it.each(['umas/invented-0', 'items/constellation:ura-finale:front', 'constellationBank/main', 'pending', 'outbox', 'badges'])
  ('rolls back CL spend and flair/outbox if storage fails after %s', async boundary => {
    host = new PersistentPuzzleHost({ ...options, content: contentFor(f) })
    await database.items.put({ id: 'constellation:ura-finale:front', version: 1, data: { itemId: 'constellation:ura-finale:front', quantity: 1, updatedAt: 1 } })
    const p = await host.previewCl('invented-0', 'ura-finale', [{ itemId: 'constellation:ura-finale:front', quantity: 1 }]), before = await dump()
    fault = boundary
    await expect(host.confirmMaterial(p, 'fault-spend')).rejects.toThrow(/Injected/)
    expect(await dump()).toEqual(before); expect(schedule).not.toHaveBeenCalled()
  })
  it.each(['items/constellation:unity-cup:front', 'items/constellation:ura-finale:front', 'constellationBank/main', 'itemLedger/*', 'pending', 'outbox'])
  ('rolls back both exchange sides/debt/evidence if storage fails after %s', async boundary => {
    const bank = (await database.constellationBank.get('main'))!; bank.data.openingClears = ['unity-cup']; await database.constellationBank.put(bank)
    await database.items.put({ id: 'constellation:unity-cup:front', version: 1, data: { itemId: 'constellation:unity-cup:front', quantity: 1, updatedAt: 1 } })
    const p = await host.previewExchange('constellation:unity-cup:front', 'constellation:ura-finale:front', 1), before = await dump(); fault = boundary
    await expect(host.confirmMaterial(p, 'fault-exchange')).rejects.toThrow(/Injected/)
    expect(await dump()).toEqual(before); expect(schedule).not.toHaveBeenCalled()
  })
  it('previews/spends mixed eligible tickets with actual node labels, preserves four presets and never pays debt with universals', async () => {
    const bank = (await database.constellationBank.get('main'))!
    bank.data.cohortCount = bank.data.completedCount = 1; bank.data.debitLimits = { 'constellation:ura-finale:front': 7 }; bank.data.balances = { 'constellation:ura-finale:front': -7 }
    await database.constellationBank.put(bank)
    await database.items.put({ id: 'constellation:ura-finale:front', version: 1, data: { itemId: 'constellation:ura-finale:front', quantity: 3, updatedAt: 1 } })
    await database.items.put({ id: 'constellation:ura-finale:pace', version: 1, data: { itemId: 'constellation:ura-finale:pace', quantity: 3, updatedAt: 1 } })
    host = new PersistentPuzzleHost({ ...options, content: contentFor(f) })
    const preview = await host.previewCl('invented-0', 'ura-finale', [{ itemId: 'constellation:ura-finale:front', quantity: 2 }, { itemId: 'constellation:ura-finale:pace', quantity: 1 }])
    expect(preview.cl.after).toBe(4); expect(preview.cl.delta!.skillPoints).toBeGreaterThan(0)
    expect(preview.cl.nodes.map(n => n.id)).toEqual(nodesUnlockedBetween(constellationTemplate(1), 1, 4).map(n => n.id))
    expect(preview.cl.nodes.every(n => n.label.startsWith('Card node'))).toBe(true)
    const result = await host.confirmMaterial(preview, 'spend')
    expect(result.cl).toEqual(preview.cl); expect(await host.confirmMaterial(preview, 'spend')).toEqual(result)
    await expect(host.confirmMaterial({ ...preview, payload: { ...preview.payload, inputs: [{ itemId: 'constellation:ura-finale:front', quantity: 1 }] } } as typeof preview, 'spend')).rejects.toMatchObject({ code: 'conflict' })
    await expect(host.confirmMaterial(preview, 'stale-new-id')).rejects.toMatchObject({ code: 'stale' })
    expect((await database.umas.get('invented-0'))!.data.scenarios[0]!.presets).toEqual((f.entities.get('umas/invented-0')!.data.scenarios as { presets: unknown }[])[0]!.presets)
    await expect(host.previewCl('invented-0', 'unity-cup', [{ itemId: 'constellation:ura-finale:front', quantity: 1 }])).rejects.toThrow(/Unlock/)
    await database.items.put({ id: 'training:level-up-ticket', version: 1, data: { itemId: 'training:level-up-ticket', quantity: 1, updatedAt: 1 } })
    const legacy = await host.previewCl('invented-1', 'ura-finale', [{ itemId: 'training:level-up-ticket', quantity: 1 }])
    await host.confirmMaterial(legacy, 'universal')
    expect((await database.constellationBank.get('main'))!.data.balances['constellation:ura-finale:front']).toBe(-7)
  })
  it('CL9/10 report SP-only, source verification does not force enrollment, and rejected CL cannot earn monotonic completion flair', async () => {
    const row = (await database.umas.get('invented-0'))!; row.data.scenarios[0]!.trainingLevel = 8; await database.umas.put(row)
    await database.puzzleOutfits.delete(row.id)
    await database.items.put({ id: 'constellation:ura-finale:front', version: 1, data: { itemId: 'constellation:ura-finale:front', quantity: 2, updatedAt: 1 } })
    const content = contentFor(f); host = new PersistentPuzzleHost({ ...options, content })
    const preview = await host.previewCl(row.id, 'ura-finale', [{ itemId: 'constellation:ura-finale:front', quantity: 2 }])
    expect(preview.cl).toMatchObject({ before: 8, after: 10, spOnly: true, nodes: [], delta: { stats: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 } } })
    expect(preview.cl.delta!.skillPoints).toBeGreaterThan(0)
    await host.confirmMaterial(preview, 'full-training')
    expect(await database.puzzleOutfits.get(row.id)).toBeUndefined()
    expect((await database.badges.get(`uma:${row.id}`))!.data).toMatchObject({ facts: { trainingByTier: [{ tier: 1, reachedTl10: false }] } })
    // Startup and unrelated training/configuration hooks also read this canonical boundary.
    const canonical = await canonicalTrainingUma((await database.umas.get(row.id))!.data, database)
    expect(trainingSnapshot(canonical, new Map()).fullyTrainedTiers).toEqual([])
    expect(canonical.scenarios[0]!.trainingLevel).toBe(8)
    // Older badge hooks have a smaller table scope; the canonical read must not escape their transaction lifetime.
    await database.transaction('rw', [database.umas, database.badges], async () => {
      const scoped = await canonicalTrainingUma((await database.umas.get(row.id))!.data, database)
      expect(scoped.scenarios[0]!.trainingLevel).toBe(8)
      await database.badges.get(`uma:${row.id}`)
    })
    const op = (await host.coordinator.nextBatch())[0]!
    f.entities.get(`umas/${row.id}`)!.data = puzzleData(row.data)
    f.entities.delete(`puzzleOutfits/${row.id}`)
    f.entities.get('items/constellation:ura-finale:front')!.data.quantity = 2
    await host.coordinator.adopt([op], server([op]), 200, async () => { await reconcilePuzzleFlairInTransaction(database, content, 200, op.operationId) })
    expect((await database.badges.get(`uma:${row.id}`))!.data).toMatchObject({ facts: { trainingByTier: [{ tier: 1, reachedTl10: true }] } })
    expect(trainingSnapshot(await canonicalTrainingUma((await database.umas.get(row.id))!.data, database), new Map()).fullyTrainedTiers).toEqual([1])
  })
  it('exchange exact −7/gross12 debt split, wrong-family isolation, stale confirmation and atomic paired evidence', async () => {
    const bank = (await database.constellationBank.get('main'))!
    bank.data.cohortCount = bank.data.completedCount = 2; bank.data.debitLimits = { 'constellation:ura-finale:front': 7, 'constellation:ura-finale:pace': 8 }
    bank.data.balances = { 'constellation:ura-finale:front': -7, 'constellation:ura-finale:pace': -8 }; bank.data.openingClears = ['unity-cup']
    await database.constellationBank.put(bank)
    await database.items.put({ id: 'constellation:unity-cup:front', version: 1, data: { itemId: 'constellation:unity-cup:front', quantity: 6, updatedAt: 1 } })
    const p = await host.previewExchange('constellation:unity-cup:front', 'constellation:ura-finale:front', 6)
    expect(p.exchange).toMatchObject({ gross: 12, debtPaid: 7, net: 5, irreversible: true })
    const committed = await host.confirmMaterial(p, 'exchange')
    expect(committed.receipt.logs).toHaveLength(2)
    expect((await database.items.get('constellation:ura-finale:front'))!.data.quantity).toBe(5)
    expect((await database.constellationBank.get('main'))!.data.balances).toEqual({ 'constellation:ura-finale:front': 0, 'constellation:ura-finale:pace': -8 })
    expect(await host.confirmMaterial(p, 'exchange')).toEqual(committed)
    await expect(host.confirmMaterial(p, 'stale')).rejects.toMatchObject({ code: 'stale' })
    await expect(host.previewExchange('constellation:ura-finale:front', 'constellation:unity-cup:pace', 2)).rejects.toThrow()
  })
  it('canonical adoption adjusts only repayment/net, keeping gross and all five EXP unchanged', async () => {
    const bank = (await database.constellationBank.get('main'))!; bank.data.cohortCount = bank.data.completedCount = 1
    bank.data.debitLimits = { 'constellation:ura-finale:front': 1 }; bank.data.balances = { 'constellation:ura-finale:front': -1 }
    await database.constellationBank.put(bank); f.entities.get('constellationBank/main')!.data = puzzleData(bank.data)
    const view = await begin(); await sync(); const claim = await play(view), pending = await host.commit(claim)
    expect(pending.receipt.materials.find(m => m.itemId.endsWith(':front'))!.net).toBe(0)
    f.entities.get('constellationBank/main')!.data.balances = { 'constellation:ura-finale:front': 0 }
    await sync(); const result = await host.loadBattle(claim.battleId)
    if (result.kind !== 'result') throw new Error('Expected result')
    expect(result.receipt.exp).toEqual(pending.receipt.exp)
    expect(result.receipt.materials.find(m => m.itemId.endsWith(':front'))).toMatchObject({ gross: 1, debtPaid: 0, net: 1 })
    expect(usePuzzleSync.getState().message).toMatch(/Gross rewards and EXP are unchanged/)
  })
  it('explicit acknowledged takeover restores the same seed/input at turn0 and rejects the displaced epoch', async () => {
    const view = await begin(); await host.append(view.open.input.battleId, 0, 0, puzzleBotAction(view.state, 'competent')); await sync()
    const online: NonNullable<PuzzleHostOptions['online']> = { available: () => true, flush: sync,
      takeover: async request => { const result = resolvePuzzleTakeover({ enabled: true, accountSeed: 'invented-cutover', now: 150, entities: f.entities, logs: f.logs }, request)
        result.writes.forEach(r => f.entities.set(`${r.kind}/${r.id}`, r)); return result.response }, snapshot: async () => snapshot() }
    const second = new PersistentPuzzleHost({ ...options, deviceId: 'second-device', online })
    expect(await second.loadBattle(view.open.input.battleId)).toMatchObject({ code: 'foreign-owner' })
    const restored = await second.takeover(view.open.input.battleId, 0)
    expect(restored.kind).toBe('battle')
    if (restored.kind !== 'battle') throw new Error('Expected takeover')
    expect(restored.state.actionCount).toBe(0); expect(restored.open.ownerEpoch).toBe(1)
    expect({ ...restored.open.input, ownerEpoch: 0 }).toEqual(view.open.input); restored.lease.release()
    expect(await database.puzzleArchives.count()).toBe(1)
    await expect(host.append(view.open.input.battleId, 0, 1, { type: 'abandon' })).rejects.toMatchObject({ code: 'displaced' })
  })
  it('offline takeover never resets; lost acknowledgement recovers only from exact online canonical owner', async () => {
    const view = await begin(); await sync()
    await expect(host.takeover(view.open.input.battleId, 0)).rejects.toMatchObject({ code: 'offline' })
    const saved = await database.puzzleJournals.get(view.open.input.battleId)
    const request = { schemaVersion: 1 as const, checkpointId: view.open.input.checkpointId, battleId: view.open.input.battleId, expectedEpoch: 0, deviceId: 'second-device' }
    const accepted = resolvePuzzleTakeover({ enabled: true, accountSeed: 'invented-cutover', now: 150, entities: f.entities, logs: f.logs }, request).response
    if (accepted.status !== 'taken-over') throw new Error('Fixture takeover')
    f.entities.set(`puzzleCheckpoints/${accepted.checkpoint.id}`, accepted.checkpoint)
    const second = new PersistentPuzzleHost({ ...options, deviceId: 'second-device', online: { available: () => true, flush: sync,
      takeover: async () => ({ status: 'rejected', reason: 'Stale epoch' }), snapshot: async () => snapshot() } })
    const restored = await second.takeover(view.open.input.battleId, 0)
    expect(restored.kind).toBe('battle'); if (restored.kind === 'battle') restored.lease.release()
    expect((await database.puzzleJournals.get(view.open.input.battleId))!.ownerEpoch).not.toBe(saved!.ownerEpoch)
  })
  it.each(['missing', 'corrupt'] as const)('explicit same-device online takeover recovers a %s journal without rerolling', async problem => {
    const view = await begin(); await sync()
    if (problem === 'missing') await database.puzzleJournals.delete(view.open.input.battleId)
    else await database.puzzleJournals.update(view.open.input.battleId, { stateHash: '0'.repeat(16) })
    expect(await host.loadBattle(view.open.input.battleId)).toMatchObject({ kind: 'recovery', code: `${problem}-journal` })
    const restored = await new PersistentPuzzleHost({ ...options, online: recoveryOnline() }).takeover(view.open.input.battleId, 0)
    expect(restored.kind).toBe('battle')
    if (restored.kind !== 'battle') throw new Error('Expected recovered battle')
    expect(restored.state.actionCount).toBe(0); expect({ ...restored.open.input, ownerEpoch: 0 }).toEqual(view.open.input)
    restored.lease.release()
    expect(await database.puzzleArchives.count()).toBe(problem === 'missing' ? 0 : 1)
  })
  it.each(['unconfirmed', 'changed-input'] as const)('a %s canonical takeover response cannot reset a local journal', async problem => {
    const view = await begin(); await host.append(view.open.input.battleId, 0, 0, puzzleBotAction(view.state, 'competent')); await sync()
    const old = await database.puzzleJournals.get(view.open.input.battleId), online = recoveryOnline()
    if (problem === 'unconfirmed') online.takeover = async () => ({ status: 'rejected', reason: 'Ownership not confirmed' })
    else {
      const takeover = online.takeover
      online.takeover = async request => {
        const response = await takeover(request)
        const row = structuredClone(f.entities.get(`puzzleCheckpoints/${request.checkpointId}`)!)
        const checkpoint = row.data as unknown as PuzzleCheckpointSaveV1
        checkpoint.open!.input.seed += 1; checkpoint.open!.inputHash = puzzlePayloadHash(checkpoint.open!.input)
        f.entities.set(`puzzleCheckpoints/${row.id}`, row)
        return { ...(response as object), checkpoint: row }
      }
    }
    const second = new PersistentPuzzleHost({ ...options, deviceId: 'second-device', online })
    await expect(second.takeover(view.open.input.battleId, 0)).rejects.toMatchObject({ code: 'conflict' })
    expect(await database.puzzleJournals.get(view.open.input.battleId)).toEqual(old)
    expect(await database.puzzleArchives.count()).toBe(0)
  })
  it('keeps the old journal when retained art is unavailable after acknowledgement, then resumes the same accepted owner', async () => {
    const view = await begin(); await host.append(view.open.input.battleId, 0, 0, puzzleBotAction(view.state, 'competent')); await sync()
    const old = await database.puzzleJournals.get(view.open.input.battleId), online = recoveryOnline()
    const offlineArt = new PersistentPuzzleHost({ ...options, deviceId: 'second-device', online, acquire: async () => { throw new Error('Retained art missing') } })
    await expect(offlineArt.takeover(view.open.input.battleId, 0)).rejects.toMatchObject({ code: 'content-unavailable' })
    expect(await database.puzzleJournals.get(view.open.input.battleId)).toEqual(old)
    expect(await database.puzzleArchives.count()).toBe(0)
    const restored = await new PersistentPuzzleHost({ ...options, deviceId: 'second-device', online }).takeover(view.open.input.battleId, 0)
    expect(restored.kind).toBe('battle')
    if (restored.kind === 'battle') {
      expect(restored.open.ownerEpoch).toBe(1); expect({ ...restored.open.input, ownerEpoch: 0 }).toEqual(view.open.input)
      restored.lease.release()
    }
  })
  it.each(['archive', 'journal'] as const)('a local takeover %s failure rolls back, then recovers the already acknowledged owner', async boundary => {
    const view = await begin(); await host.append(view.open.input.battleId, 0, 0, puzzleBotAction(view.state, 'competent')); await sync()
    const old = await database.puzzleJournals.get(view.open.input.battleId), online = recoveryOnline()
    const second = new PersistentPuzzleHost({ ...options, deviceId: 'second-device', online })
    fault = boundary
    await expect(second.takeover(view.open.input.battleId, 0)).rejects.toThrow(`Injected ${boundary}`)
    expect(await database.puzzleJournals.get(view.open.input.battleId)).toEqual(old)
    expect(await database.puzzleArchives.count()).toBe(0)
    fault = null
    const restored = await second.takeover(view.open.input.battleId, 0)
    expect(restored.kind).toBe('battle')
    if (restored.kind === 'battle') {
      expect(restored.open.ownerEpoch).toBe(1); expect(restored.state.actionCount).toBe(0); restored.lease.release()
    }
    expect(await database.puzzleArchives.count()).toBe(1)
  })
  it('a canonical terminal result winning the takeover race is adopted, not restarted or paid twice', async () => {
    const view = await begin(); await sync()
    // Another accepted client terminal wins before the takeover request.
    const reservation = f.operation({ kind: 'reserve', encounter: view.open }, 'already-reserved')
    const settled = f.operation(f.win(reservation), 'remote-terminal'); server([settled])
    const second = new PersistentPuzzleHost({ ...options, deviceId: 'second-device', online: { available: () => true, flush: sync,
      takeover: async request => resolvePuzzleTakeover({ enabled: true, accountSeed: 'invented-cutover', now: 201, entities: f.entities, logs: f.logs }, request).response, snapshot: async () => snapshot() } })
    const result = await second.takeover(view.open.input.battleId, 0)
    expect(result.kind).toBe('result'); expect(await database.puzzleJournals.count()).toBe(0)
    expect((await database.items.get('constellation:ura-finale:front'))!.data.quantity).toBe(1)
    expect(await database.puzzleResults.count()).toBe(1)
  })
  it('provides an isolated proof adapter and refuses to overwrite a nonempty proof/account store', async () => {
    const name = `puzzle-proof-isolation-${++sequence}`
    const proof = await createIsolatedPuzzleProof(name, [...f.entities.values()], options)
    expect((await proof.host.account()).readiness).toBe('active')
    await expect(createIsolatedPuzzleProof(name, [...f.entities.values()], options)).rejects.toThrow(/overwrites/)
    await proof.dispose()
    const existing = new RacerDb(name); await existing.open()
    await existing.puzzlePreferences.put({ id: 'invented-existing-pref', value: true })
    await expect(createIsolatedPuzzleProof(name, [], options)).rejects.toThrow(/overwrites/)
    expect(await existing.puzzlePreferences.count()).toBe(1); await existing.delete()
    await expect(createIsolatedPuzzleProof('uma-racer', [], options)).rejects.toThrow(/isolated/)
  })
  it('a material preview never replays a real operation named puzzle-preview', async () => {
    await host.openChapter(f.party.partyId, 'ura-finale', 'puzzle-preview')
    await sync()
    await database.items.put({ id: 'training:level-up-ticket', version: 1, data: { itemId: 'training:level-up-ticket', quantity: 1, updatedAt: 1 } })
    const preview = await host.previewCl('invented-0', 'ura-finale', [{ itemId: 'training:level-up-ticket', quantity: 1 }])
    expect(preview.receipt.operation.payload.kind).toBe('cl-spend')
    expect(preview.cl.after).toBe(preview.cl.before + 1)
    expect(await database.pendingPuzzleOperations.count()).toBe(0)
  })
  it('rejects journal prototypes, sparse/extra arrays and invalid actions without dropping future data', () => {
    const row = { id: 'invented-battle', schemaVersion: 1, ownerEpoch: 0, inputHash: 'a'.repeat(16), actions: [], stateHash: 'b'.repeat(16), updatedAt: 1 }
    expect(parsePuzzleJournal(row)).not.toBeNull()
    expect(parsePuzzleJournal(Object.assign(Object.create({ injected: true }) as object, row))).toBeNull()
    expect(parsePuzzleJournal({ ...row, actions: new Array<PuzzleBattleAction>(1) })).toBeNull()
    const actions: PuzzleBattleAction[] = []; Object.assign(actions, { extra: true })
    expect(parsePuzzleJournal({ ...row, actions })).toBeNull()
    const sparseWithExtra = new Array<PuzzleBattleAction>(1); Object.assign(sparseWithExtra, { extra: { type: 'abandon' } })
    expect(parsePuzzleJournal({ ...row, actions: sparseWithExtra })).toBeNull()
  })
})
