import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FirestoreSaveRepository } from './firestore-save.repository'
import { LocalSaveRepository } from './local-save.repository'
import { parseRpgCommandRequest, rpgEncounterSeed, type RpgCommandRequest } from './rpg-command'
import { parseRpgEntity } from './rpg-save.types'
import { parseSyncRequest } from './save.types'
import type { SaveRepository } from './save.repository'

// Only the Firestore methods used by the repository are modeled. The cast below is a test boundary, not production code.
class FakeRef {
  constructor(readonly path: string, private readonly docs: Map<string, Record<string, unknown>>) {}
  collection(name: string) { return new FakeCollection(`${this.path}/${name}`, this.docs) }
}
class FakeCollection {
  constructor(readonly path: string, private readonly docs: Map<string, Record<string, unknown>>) {}
  doc(id: string) { return new FakeRef(`${this.path}/${id}`, this.docs) }
  async get() {
    const prefix = `${this.path}/`
    return { docs: [...this.docs.entries()].filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .map(([, data]) => ({ data: () => data })) }
  }
}
class FakeFirestore {
  readonly docs = new Map<string, Record<string, unknown>>()
  private queue: Promise<unknown> = Promise.resolve()
  collection(name: string) { return new FakeCollection(name, this.docs) }
  async getAll(...refs: FakeRef[]) { return refs.map(ref => ({ exists: this.docs.has(ref.path), data: () => this.docs.get(ref.path)! })) }
  async runTransaction<T>(fn: (tx: { getAll: (...refs: FakeRef[]) => Promise<Array<{ exists: boolean; data: () => Record<string, unknown> }>>;
    get: (query: FakeCollection) => ReturnType<FakeCollection['get']>;
    set: (ref: FakeRef, data: Record<string, unknown>) => void }) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const writes: Array<[string, Record<string, unknown>]> = []
      const result = await fn({
        getAll: async (...refs) => refs.map((ref) => ({ exists: this.docs.has(ref.path), data: () => this.docs.get(ref.path)! })),
        get: query => query.get(),
        set: (ref, data) => { writes.push([ref.path, data]) },
      })
      for (const [path, data] of writes) this.docs.set(path, data)
      return result
    })
    this.queue = run.catch(() => undefined)
    return run
  }
}

const chapter = 'chapter-1'
const checkpointId = `party-1:${chapter}`
const contentHash = 'a'.repeat(64)
const memberIds = ['uma-a', 'uma-b', 'uma-c', 'uma-d', 'uma-e']
const coreStats = { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100,
  atk: 100, matk: 100, initiative: 100, pdef: 100, mdef: 100, dexterity: 100, hp: 100, mp: 100 }
const frozen = {
  entryId: `rpg-entry:${checkpointId}:1:node-1`, nodeId: 'node-1',
  seed: rpgEncounterSeed('u1', 'party-1', chapter, 1, 'node-1'), contentHash, engineVersion: 1,
  enemyKitJson: '{"enemies":[]}', party: memberIds.map((outfitId) => ({ outfitId, tier: 1, level: 1,
    stats: coreStats, signature: 'fire', skills: [] })), retryOrdinal: 0, leaseRevision: 0,
}
const atCheckpoint = {
  schemaVersion: 1, presetId: 'party-1', chapterId: chapter, contentVersion: 'synthetic-v1', contentHash,
  attemptIndex: 1, attemptId: `rpg-attempt:${checkpointId}:1`, lastClearedNodeId: null,
  selectedPath: [], status: 'at-checkpoint', revision: 0, frozenEntry: null,
}
const inBattle = { ...atCheckpoint, status: 'in-battle', revision: 1, frozenEntry: frozen }
const result = { schemaVersion: 1, resultId: `${frozen.entryId}:retry-0`, entryId: frozen.entryId,
  retryOrdinal: 0, outcome: 'win', stateHash: 'b'.repeat(64), contentHash, contentVersion: 'synthetic-v1',
  memberExp: memberIds.map((outfitId) => ({ outfitId, delta: 0, beforeTier: 1, beforeLevel: 1,
    beforeExp: 0, afterTier: 1, afterLevel: 1, afterExp: 0 })), createdAt: 30 }

const freshClassProfile = () => ({ outfitId: 'uma-a', sourceContentVersion: 'invented-v1',
  baseStats: { speed: 100, stamina: 90, power: 80, guts: 70, wit: 60 },
  growthRates: { speed: 0.2, stamina: 0.1, power: 0, guts: 0, wit: 0.3 },
  sourceAptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'C', mile: 'C', medium: 'A', long: 'C' },
    strategy: { front: 'A', pace: 'A', late: 'B', end: 'G' } },
  affinities: { fire: 'A', dark: 'A' }, style: 'front', weapon: 'greatsword', defaultSignature: 'fire',
  tier: 1, level: 1, exp: 65, tree: [], legacy: [] })

function command(commandId: string, action: RpgCommandRequest['action'], version: number,
  next: Record<string, unknown>, appends: RpgCommandRequest['appends'] = [], extra: Partial<RpgCommandRequest> = {}): RpgCommandRequest {
  const partyExpected = action === 'begin-battle' &&
    (next.frozenEntry as { retryOrdinal?: number } | undefined)?.retryOrdinal === 0 ? [
    { kind: 'rpgPresets' as const, id: 'party-1', version: 1 },
    ...memberIds.map((id) => ({ kind: 'rpgOutfits' as const, id, version: 1 })),
  ] : []
  const raw = { schemaVersion: 1, commandId, action,
    expected: [{ kind: 'rpgCheckpoints', id: checkpointId, version }, ...partyExpected, ...(extra.expected ?? [])],
    upserts: [{ kind: 'rpgCheckpoints', id: checkpointId, data: next }, ...(extra.upserts ?? [])], appends }
  const parsed = parseRpgCommandRequest(raw)
  if (typeof parsed === 'string') throw new Error(parsed)
  return parsed
}

for (const backend of ['local', 'firestore'] as const) {
  describe(`${backend} RPG grouped commands`, () => {
    let repo: SaveRepository
    let dir: string | undefined

    beforeEach(async () => {
      if (backend === 'local') {
        dir = await mkdtemp(join(tmpdir(), 'racer-rpg-'))
        repo = new LocalSaveRepository(join(dir, 'save.json'))
      } else {
        const fake = new FakeFirestore()
        repo = new FirestoreSaveRepository(fake as unknown as ConstructorParameters<typeof FirestoreSaveRepository>[0])
      }
    })
    afterEach(async () => { if (dir) await rm(dir, { recursive: true, force: true }) })

    async function seedCheckpoint() {
      await repo.sync('u1', { upserts: [
        { kind: 'rpgCheckpoints', id: checkpointId, baseVersion: 0, data: atCheckpoint },
        { kind: 'rpgPresets', id: 'party-1', baseVersion: 0, data: { schemaVersion: 1, presetId: 'party-1',
          name: 'Synthetic', slots: memberIds.map((outfitId) => ({ outfitId, signature: 'fire', loadout: [] })),
          foregroundChapterId: chapter } },
        ...memberIds.map((id) => ({ kind: 'rpgOutfits' as const, id, baseVersion: 0,
          data: { profile: { outfitId: id, affinities: { fire: 'A' } } } })),
      ], appends: [] })
    }

    function classEdit(profile = freshClassProfile(), commandId = 'correct-class') {
      return parseRpgCommandRequest({ schemaVersion: 1, commandId, action: 'edit-outfit',
        expected: [{ kind: 'rpgOutfits', id: 'uma-a', version: 1 },
          ...Array.from({ length: 5 }, (_, i) => ({ kind: 'rpgPresets', id: `party-${i + 1}`, version: 0 }))],
        upserts: [{ kind: 'rpgOutfits', id: 'uma-a', data: { schemaVersion: 1, projectionRevision: 1,
          profile: { ...profile, style: 'pace', weapon: 'sword-shield' } } }], appends: [] })
    }
    async function seedClass(profile = freshClassProfile()) {
      await repo.sync('u1', { upserts: [{ kind: 'rpgOutfits', id: 'uma-a', baseVersion: 0,
        data: { schemaVersion: 1, projectionRevision: 0, profile } }], appends: [] })
    }
    it('corrects a fresh class with an identical partial EXP balance, idempotently', async () => {
      const before = freshClassProfile(); await seedClass(before)
      const body = classEdit()
      if (typeof body === 'string') throw new Error(body)
      expect((await repo.rpgCommand('u1', body)).status).toBe('applied')
      expect((await repo.rpgCommand('u1', body)).status).toBe('duplicate')
      const snapshot = await repo.load('u1')
      expect(snapshot.entities.find(r => r.kind === 'rpgOutfits')?.data).toEqual({ schemaVersion: 1, projectionRevision: 1,
        profile: { ...before, style: 'pace', weapon: 'sword-shield' } })
      expect((await repo.rpgCommand('u1', { ...body, commandId: 'stale-class' })).status).toBe('conflict')
      expect(snapshot.logs.filter(r => r.kind !== 'rpgReceipts')).toHaveLength(0)
      expect(snapshot.logs.filter(r => r.kind === 'rpgReceipts')).toHaveLength(1)
    })
    it.each([{ tier: 1, level: 2 }, { tier: 2, level: 1 }])('rejects a class change after progression %j', async state => {
      const profile = { ...freshClassProfile(), ...state }; await seedClass(profile)
      const body = classEdit(profile)
      if (typeof body === 'string') throw new Error(body)
      expect((await repo.rpgCommand('u1', body)).status).toBe('rejected')
      expect((await repo.load('u1')).entities.find(r => r.kind === 'rpgOutfits')?.data.profile).toEqual(profile)
    })
    it('rejects hidden EXP/input/signature changes, ineligible classes and incomplete party reads', async () => {
      await seedClass()
      const body = classEdit(); if (typeof body === 'string') throw new Error(body)
      for (const patch of [{ exp: 0 }, { baseStats: { ...freshClassProfile().baseStats, speed: 101 } },
        { defaultSignature: 'dark' }, { sourceContentVersion: 'invented-v2' }]) {
        const forged = structuredClone(body)
        Object.assign(forged.upserts[0]!.data.profile as Record<string, unknown>, patch)
        expect((await repo.rpgCommand('u1', forged)).status).toBe('rejected')
      }
      for (const patch of [{ style: 'late', weapon: 'wizard-staff' }, { style: 'pace', weapon: 'tome' }]) {
        const forged = structuredClone(body)
        Object.assign(forged.upserts[0]!.data.profile as Record<string, unknown>, patch)
        expect(typeof parseRpgCommandRequest(forged)).toBe('string')
      }
      const missing = { ...body, expected: body.expected.slice(0, -1) }
      expect((await repo.rpgCommand('u1', missing)).status).toBe('rejected')
      expect((await repo.load('u1')).entities.find(r => r.kind === 'rpgOutfits')?.data.profile).toEqual(freshClassProfile())
    })
    it('refuses class correction while the member has a frozen open battle', async () => {
      await seedClass()
      await repo.sync('u1', { upserts: [
        { kind: 'rpgCheckpoints', id: checkpointId, baseVersion: 0, data: inBattle },
        { kind: 'rpgPresets', id: 'party-1', baseVersion: 0, data: { schemaVersion: 1, presetId: 'party-1', name: 'Invented',
          slots: [{ outfitId: 'uma-a', signature: 'fire', loadout: [] }, null, null, null, null], foregroundChapterId: chapter } },
      ], appends: [] })
      const body = classEdit(); if (typeof body === 'string') throw new Error(body)
      body.expected.find(e => e.kind === 'rpgPresets' && e.id === 'party-1')!.version = 1
      expect((await repo.rpgCommand('u1', body)).status).toBe('rejected') // Omitted required checkpoint.
      body.expected.push({ kind: 'rpgCheckpoints', id: checkpointId, version: 1 })
      expect((await repo.rpgCommand('u1', body)).status).toBe('rejected')
      expect((await repo.load('u1')).entities.find(r => r.kind === 'rpgOutfits')?.data.profile).toEqual(freshClassProfile())
    })

    it.each(['choose-node', 'clear-chapter'] as const)('collects frozen tokens with %s once, atomically rejecting stale inventory', async action => {
      const reward = { tier: 1, slot: action === 'clear-chapter' ? 30 : 0, skill: action === 'choose-node' ? 60 : 0 }
      // Opaque accepted encounter data: this test isolates map receipt/item transactions, not engine replay.
      const entry = { ...frozen, enemyKitJson: JSON.stringify({ format: 'rpg-combat-kit-v3', data: {},
        reward: { baseExp: 100, recommendedTier: 1, recommendedLevel: 10 }, inspiration: reward }) }
      const pending = { ...atCheckpoint, status: 'pending-result', revision: 2, frozenEntry: entry }
      await repo.sync('u1', { upserts: [{ kind: 'rpgCheckpoints', id: checkpointId, baseVersion: 0, data: pending }],
        appends: [{ kind: 'rpgResults', id: result.resultId, data: result, createdAt: 30 }] })
      const kind = action === 'clear-chapter' ? 'slot' : 'skill', itemId = `inspiration:t1:${kind}`, delta = reward[kind]
      const movement = { id: `rpg-inspiration:${entry.entryId}:${kind}`, itemId, delta, createdAt: 40, reason: 'rpg-inspiration',
        source: { kind: 'rpg-inspiration', entryId: entry.entryId, attemptId: pending.attemptId, tier: 1, tokenKind: kind } }
      const next = { ...pending, status: action === 'clear-chapter' ? 'cleared' : 'at-checkpoint', revision: 3,
        frozenEntry: null, lastClearedNodeId: entry.nodeId, selectedPath: [entry.nodeId] }
      const body = command(`collect-${action}`, action, 1, next, [{ kind: 'itemLedger', id: movement.id, data: movement, createdAt: 40 }], {
        expected: [{ kind: 'items', id: itemId, version: 0 }], upserts: [{ kind: 'items', id: itemId, data: { itemId, quantity: delta, updatedAt: 40 } }],
      })
      const applied = await repo.rpgCommand('u1', body)
      expect(applied.status).toBe('applied'); expect((await repo.rpgCommand('u1', body)).status).toBe('duplicate')
      const snapshot = await repo.load('u1')
      expect(snapshot.entities.find(r => r.kind === 'items' && r.id === itemId)?.data.quantity).toBe(delta)
      expect(snapshot.logs.filter(r => r.kind === 'itemLedger')).toHaveLength(1)
      // Another attempt cannot use the same version or leave orphan Item evidence.
      const stale = { ...body, commandId: `stale-${action}` }
      expect((await repo.rpgCommand('u1', stale)).status).toBe('conflict')
      expect((await repo.load('u1')).logs.filter(r => r.kind === 'itemLedger')).toHaveLength(1)
    })

    it('reads the actual advance bank even if an old client omits it, then commits net tokens once', async () => {
      const build = { cardSetIds: [], assignments: {}, activeExtraStats: [], loadoutSkillIds: [] }
      const owned = { schemaVersion: 15, templateId: 'invented-advanced', level: 1, exp: 0, unlockedTier: 1, goalPlanVersion: 0, racePreferences: null, skillHistory: [], activePreset: 'medium',
        scenarios: [{ tier: 1, trainingLevel: 1, trainingExp: 0, journey: null, started: false, extraStatsUnlocked: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
          inspiration: { slots: [], golds: [] }, presets: { sprint: build, mile: build, medium: build, long: build } }] }
      await repo.sync('u1', { upserts: [{ kind: 'umas', id: owned.templateId, baseVersion: 0, data: owned }], appends: [] })
      const advance = await repo.advanceInspiration('u1'), bank = advance.entities.find(r => r.kind === 'inspirationBank')!
      const entry = { ...frozen, enemyKitJson: JSON.stringify({ format: 'rpg-combat-kit-v3', data: {}, inspiration: { tier: 1, slot: 0, skill: 60 } }) }
      const pending = { ...atCheckpoint, status: 'pending-result', revision: 2, frozenEntry: entry }
      await repo.sync('u1', { upserts: [{ kind: 'rpgCheckpoints', id: checkpointId, baseVersion: 0, data: pending }], appends: [{ kind: 'rpgResults', id: result.resultId, data: result, createdAt: 30 }] })
      const itemId = 'inspiration:t1:skill', movement = { id: `rpg-inspiration:${entry.entryId}:skill`, itemId, delta: 60, createdAt: 40, reason: 'rpg-inspiration',
        source: { kind: 'rpg-inspiration', entryId: entry.entryId, attemptId: pending.attemptId, tier: 1, tokenKind: 'skill' } }
      const next = { ...pending, status: 'at-checkpoint', revision: 3, frozenEntry: null, lastClearedNodeId: entry.nodeId, selectedPath: [entry.nodeId] }
      const old = command('old-bank-grant', 'choose-node', 1, next, [{ kind: 'itemLedger', id: movement.id, data: movement, createdAt: 40 }], {
        expected: [{ kind: 'items', id: itemId, version: 0 }], upserts: [{ kind: 'items', id: itemId, data: { itemId, quantity: 60, updatedAt: 40 } }],
      })
      expect(await repo.rpgCommand('u1', old)).toMatchObject({ status: 'rejected', reason: expect.stringMatching(/bank/) })
      expect((await repo.load('u1')).entities.some(e => e.kind === 'items')).toBe(false)
      const correct: RpgCommandRequest = { ...old, commandId: 'correct-bank-grant',
        expected: [...old.expected, { kind: 'inspirationBank', id: 'main', version: bank.version }],
        upserts: old.upserts.map(u => u.kind === 'items' ? { ...u, data: { ...u.data, quantity: 48 } } : u).concat({ kind: 'inspirationBank', id: 'main', data: { ...bank.data, balances: { ...bank.data.balances as object, [itemId]: 0 } } }),
        appends: [{ kind: 'itemLedger', id: movement.id, createdAt: 40, data: { ...movement, source: { ...movement.source, debtPaid: 12 } } }] }
      const parsed = parseRpgCommandRequest(correct); if (typeof parsed === 'string') throw new Error(parsed)
      expect((await repo.rpgCommand('u1', parsed)).status).toBe('applied')
      expect((await repo.rpgCommand('u1', parsed)).status).toBe('duplicate')
      const snapshot = await repo.load('u1')
      expect(snapshot.entities.find(e => e.kind === 'items')!.data.quantity).toBe(48)
      expect(snapshot.entities.find(e => e.kind === 'inspirationBank')!.data.balances).toEqual({ 'inspiration:t1:slot': -6, 'inspiration:t1:skill': 0 })
    })

    it('opens precisely one v15 Inspiration position; duplicate and competing versions cannot consume twice', async () => {
      const umaId = 'invented-child', itemId = 'inspiration:t1:slot'
      const build = { cardSetIds: [], assignments: {}, activeExtraStats: [], loadoutSkillIds: [] }
      const uma = { schemaVersion: 15, templateId: umaId, level: 1, exp: 0, unlockedTier: 1, goalPlanVersion: 0, racePreferences: null, skillHistory: [],
        activePreset: 'medium', scenarios: [{ tier: 1, trainingLevel: 1, trainingExp: 0, journey: null, started: false,
          extraStatsUnlocked: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }, inspiration: { slots: [], golds: [] },
          presets: { sprint: build, mile: build, medium: build, long: build } }] }
      await repo.sync('u1', { upserts: [{ kind: 'umas', id: umaId, baseVersion: 0, data: uma },
        { kind: 'items', id: itemId, baseVersion: 0, data: { itemId, quantity: 2, updatedAt: 1 } }], appends: [] })
      const id = `inspiration:${umaId}:1:parent0:slot`, movement = { id, itemId, delta: -1, createdAt: 2, reason: 'inspiration-unlock',
        source: { kind: 'inspiration-unlock', umaId, tier: 1, nodeId: 'parent0', goldIndex: null } }
      const raw: RpgCommandRequest = { schemaVersion: 1, commandId: id, action: 'spend-inspiration',
        expected: [{ kind: 'umas', id: umaId, version: 1 }, { kind: 'items', id: itemId, version: 1 }],
        upserts: [{ kind: 'umas', id: umaId, data: { ...uma, scenarios: [{ ...uma.scenarios[0], inspiration: { slots: ['parent0'], golds: [] } }] } },
          { kind: 'items', id: itemId, data: { itemId, quantity: 1, updatedAt: 2 } }],
        appends: [{ kind: 'itemLedger', id, data: movement, createdAt: 2 }] }
      const parsed = parseRpgCommandRequest(raw); if (typeof parsed === 'string') throw new Error(parsed)
      expect((await repo.rpgCommand('u1', parsed)).status).toBe('applied')
      expect((await repo.rpgCommand('u1', parsed)).status).toBe('duplicate')
      expect((await repo.rpgCommand('u1', { ...parsed, commandId: 'competing-spend' })).status).toBe('conflict')
      const snapshot = await repo.load('u1')
      expect(snapshot.entities.find(r => r.kind === 'items')?.data.quantity).toBe(1)
      expect(snapshot.logs.filter(r => r.kind === 'itemLedger')).toHaveLength(1)
    })

    it('demonstrates ordinary sync can orphan a log after a version conflict', async () => {
      await repo.sync('u1', { upserts: [{ kind: 'cards', id: 'card-1', baseVersion: 0, data: { synthetic: 1 } }], appends: [] })
      const stale = await repo.sync('u1', { upserts: [{ kind: 'cards', id: 'card-1', baseVersion: 0,
        data: { synthetic: 2 } }], appends: [{ kind: 'ledger', id: 'orphan', data: { synthetic: true }, createdAt: 1 }] })
      expect(stale.conflicts).toHaveLength(1)
      expect(stale.appended).toBe(1)
      expect((await repo.load('u1')).logs.some((row) => row.id === 'orphan')).toBe(true)
    })

    it('accepts one begin, rejects a competing begin, and duplicates only an identical command', async () => {
      await seedCheckpoint()
      const first = command('begin-1', 'begin-battle', 1, inBattle)
      const competing = command('begin-2', 'begin-battle', 1, inBattle)
      const simultaneous = await Promise.all([repo.rpgCommand('u1', first), repo.rpgCommand('u1', competing)])
      expect(simultaneous.map((item) => item.status).sort()).toEqual(['applied', 'conflict'])
      expect((await repo.rpgCommand('u1', first)).status).toBe('duplicate')
      expect((await repo.rpgCommand('u1', { ...first, action: 'takeover' })).status).toBe('rejected')
      const save = await repo.load('u1')
      expect(save.entities.find((row) => row.id === checkpointId)?.version).toBe(2)
      expect(save.logs.filter((row) => row.kind === 'rpgReceipts')).toHaveLength(1)
    })

    it('cannot append a stale result, but accepts its checkpoint and evidence together', async () => {
      await seedCheckpoint()
      const beforeBegin = command('result-early', 'battle-result', 1,
        { ...inBattle, status: 'pending-result', revision: 2 },
        [{ kind: 'rpgResults', id: result.resultId, data: result, createdAt: 30 }])
      expect((await repo.rpgCommand('u1', beforeBegin)).status).toBe('rejected')
      expect((await repo.load('u1')).logs).toHaveLength(0)
      await repo.rpgCommand('u1', command('begin-1', 'begin-battle', 1, inBattle))
      const good = command('result-1', 'battle-result', 2,
        { ...inBattle, status: 'pending-result', revision: 2 },
        [{ kind: 'rpgResults', id: result.resultId, data: result, createdAt: 30 }])
      const stale = command('result-2', 'battle-result', 1,
        { ...inBattle, status: 'pending-result', revision: 2 },
        [{ kind: 'rpgResults', id: result.resultId, data: result, createdAt: 30 }])
      expect((await repo.rpgCommand('u1', stale)).status).toBe('conflict')
      expect((await repo.load('u1')).logs.some((row) => row.kind === 'rpgResults')).toBe(false)
      expect((await repo.rpgCommand('u1', good)).status).toBe('applied')
      expect((await repo.rpgCommand('u1', good)).status).toBe('duplicate')
      expect((await repo.load('u1')).logs.filter((row) => row.kind === 'rpgResults')).toHaveLength(1)
    })

    it.each(['choose-node', 'clear-chapter'] as const)('consumes accepted win evidence once for %s on both backends', async (action) => {
      await seedCheckpoint()
      await repo.rpgCommand('u1', command('begin-map', 'begin-battle', 1, inBattle))
      const done = { ...inBattle, status: 'pending-result', revision: 2 }
      await repo.rpgCommand('u1', command('result-map', 'battle-result', 2, done,
        [{ kind: 'rpgResults', id: result.resultId, data: result, createdAt: 30 }]))
      const advance = command('advance-map', action, 3, { ...done, revision: 3, status: action === 'clear-chapter' ? 'cleared' : 'at-checkpoint',
        lastClearedNodeId: frozen.nodeId, selectedPath: [frozen.nodeId], frozenEntry: null })
      expect((await repo.rpgCommand('u1', advance)).status).toBe('applied')
      expect((await repo.rpgCommand('u1', advance)).status).toBe('duplicate')
      expect((await repo.load('u1')).entities.find((r) => r.id === checkpointId)?.data.selectedPath).toEqual([frozen.nodeId])
    })

    it('refuses an invented pending result without accepted evidence and preserves the map', async () => {
      await seedCheckpoint()
      await repo.sync('u1', { upserts: [{ kind: 'rpgCheckpoints', id: checkpointId, baseVersion: 1,
        data: { ...inBattle, revision: 2, status: 'pending-result' } }], appends: [] })
      const advance = command('forged-map', 'choose-node', 2, { ...atCheckpoint, revision: 3, lastClearedNodeId: frozen.nodeId, selectedPath: [frozen.nodeId] })
      expect(await repo.rpgCommand('u1', advance)).toMatchObject({ status: 'rejected', reason: 'Map advance requires accepted winning evidence' })
      expect((await repo.load('u1')).entities.find((r) => r.id === checkpointId)?.data.lastClearedNodeId).toBeNull()
    })

    it('freezes entry bytes through takeover and refuses stale Item plus ledger writes', async () => {
      await seedCheckpoint()
      await repo.rpgCommand('u1', command('begin-1', 'begin-battle', 1, inBattle))
      const takeover = command('takeover-1', 'takeover', 2,
        { ...inBattle, revision: 2, frozenEntry: { ...frozen, leaseRevision: 1 } })
      expect((await repo.rpgCommand('u1', takeover)).status).toBe('applied')
      expect((await repo.rpgCommand('u1', command('bad-takeover', 'takeover', 3,
        { ...inBattle, revision: 3, frozenEntry: { ...frozen, leaseRevision: 2, seed: 'deadbeef' } }))).status).toBe('rejected')
      const takenResult = { ...result, resultId: `${frozen.entryId}:retry-0` }
      await repo.rpgCommand('u1', command('result-1', 'battle-result', 3,
        { ...inBattle, revision: 3, status: 'pending-result', frozenEntry: { ...frozen, leaseRevision: 1 } },
        [{ kind: 'rpgResults', id: takenResult.resultId, data: takenResult, createdAt: 30 }]))
      const itemId = 'training:level-up-ticket'
      await repo.sync('u1', { upserts: [{ kind: 'items', id: itemId, baseVersion: 0,
        data: { itemId, quantity: 1, updatedAt: 40 } }], appends: [] })
      await repo.sync('u1', { upserts: [{ kind: 'items', id: itemId, baseVersion: 1,
        data: { itemId, quantity: 2, updatedAt: 41 } }], appends: [] })
      const movement = { id: 'rpg-item-move-1', itemId, delta: 1, reason: 'exp-bank',
        source: { kind: 'bank-settle' }, createdAt: 42 }
      const clear = command('clear-1', 'clear-chapter', 4,
        { ...inBattle, revision: 4, status: 'cleared', frozenEntry: { ...frozen, leaseRevision: 1 } },
        [{ kind: 'itemLedger', id: movement.id, data: movement, createdAt: 42 }],
        { expected: [{ kind: 'items', id: itemId, version: 1 }],
          upserts: [{ kind: 'items', id: itemId, data: { itemId, quantity: 3, updatedAt: 42 } }] })
      expect((await repo.rpgCommand('u1', clear)).status).toBe('conflict')
      expect((await repo.load('u1')).logs.some((row) => row.id === movement.id)).toBe(false)
    })

    it('retries a loss with the same seed, kit and party but a new ordinal', async () => {
      await seedCheckpoint()
      await repo.rpgCommand('u1', command('begin-1', 'begin-battle', 1, inBattle))
      const loss = { ...result, outcome: 'loss' }
      const afterLoss = { ...inBattle, status: 'at-checkpoint', revision: 2,
        frozenEntry: { ...frozen, retryOrdinal: 1 } }
      expect((await repo.rpgCommand('u1', command('loss-1', 'battle-result', 2, afterLoss,
        [{ kind: 'rpgResults', id: loss.resultId, data: loss, createdAt: 30 }]))).status).toBe('applied')
      const retry = { ...afterLoss, status: 'in-battle', revision: 3 }
      expect((await repo.rpgCommand('u1', command('retry-1', 'begin-battle', 3, retry))).status).toBe('applied')
      const latest = (await repo.load('u1')).entities.find((row) => row.id === checkpointId)?.data
      expect((latest?.frozenEntry as typeof frozen).seed).toBe(frozen.seed)
      expect((latest?.frozenEntry as typeof frozen).enemyKitJson).toBe(frozen.enemyKitJson)
      expect((latest?.frozenEntry as typeof frozen).retryOrdinal).toBe(1)
    })

    it('starts a second chapter without replacing the first paused checkpoint', async () => {
      await seedCheckpoint()
      const second = { ...atCheckpoint, chapterId: 'chapter-2',
        attemptId: 'rpg-attempt:party-1:chapter-2:1' }
      const raw = { schemaVersion: 1, commandId: 'start-second', action: 'start-chapter',
        expected: [{ kind: 'rpgCheckpoints', id: 'party-1:chapter-2', version: 0 },
          { kind: 'rpgPresets', id: 'party-1', version: 1 },
          ...memberIds.map((id) => ({ kind: 'rpgOutfits', id, version: 1 }))],
        upserts: [{ kind: 'rpgCheckpoints', id: 'party-1:chapter-2', data: second }], appends: [] }
      const parsed = parseRpgCommandRequest(raw)
      if (typeof parsed === 'string') throw new Error(parsed)
      expect((await repo.rpgCommand('u1', parsed)).status).toBe('applied')
      expect((await repo.load('u1')).entities.filter((row) => row.kind === 'rpgCheckpoints').map((row) => row.id).sort())
        .toEqual([checkpointId, 'party-1:chapter-2'])
    })

    it('archives one Lv50 tier in the same group as promotion', async () => {
      const affinities = { fire: 'A', dark: 'A', ice: 'A', light: 'A' }
      const sourceAptitudes = { surface: { turf: 'A', dirt: 'B' },
        distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
        strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' } }
      const base = { outfitId: 'uma-a', sourceContentVersion: 'synthetic-v1',
        baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
        growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }, sourceAptitudes,
        affinities, style: 'pace', weapon: 'spear', defaultSignature: 'fire',
        tier: 1, level: 50, exp: 0, tree: [], legacy: [] }
      await repo.sync('u1', { upserts: [{ kind: 'rpgOutfits', id: 'uma-a', baseVersion: 0,
        data: { schemaVersion: 1, profile: base, projectionRevision: 0 } }], appends: [] })
      const evidence = { schemaVersion: 1, promotionId: 'promote-uma-a', outfitId: 'uma-a',
        fromTier: 1, toTier: 2, archive: [], createdAt: 50 }
      const raw = { schemaVersion: 1, commandId: 'promote-1', action: 'promote',
        expected: [{ kind: 'rpgOutfits', id: 'uma-a', version: 1 },
          ...Array.from({ length: 5 }, (_, i) => ({ kind: 'rpgPresets', id: `party-${i + 1}`, version: 0 }))],
        upserts: [{ kind: 'rpgOutfits', id: 'uma-a', data: { schemaVersion: 1,
          profile: { ...base, tier: 2, level: 1 }, projectionRevision: 1 } }],
        appends: [{ kind: 'rpgPromotions', id: evidence.promotionId, data: evidence, createdAt: 50 }] }
      const parsed = parseRpgCommandRequest(raw)
      if (typeof parsed === 'string') throw new Error(parsed)
      expect((await repo.rpgCommand('u1', parsed)).status).toBe('applied')
      expect((await repo.load('u1')).logs.filter((row) => row.kind === 'rpgPromotions')).toHaveLength(1)
    })
  })
}

describe('RPG command parser', () => {
  it('rejects unknown fields, future versions, impossible counts and unsafe numbers', () => {
    const valid = command('begin-shape', 'begin-battle', 1, inBattle)
    expect(parseRpgCommandRequest({ ...valid, extra: true })).toMatch(/exact versioned fields/)
    expect(parseRpgCommandRequest({ ...valid, schemaVersion: 2 })).toMatch(/Unsupported/)
    expect(parseRpgCommandRequest({ ...valid, commandId: '../bad' })).toMatch(/Unsupported/)
    expect(parseRpgCommandRequest({ ...valid, expected: Array(21).fill(valid.expected[0]) })).toMatch(/operation count/)
    expect(parseRpgCommandRequest({ ...valid, upserts: [{ ...valid.upserts[0], data: { ...inBattle,
      revision: Number.MAX_SAFE_INTEGER + 1 } }] })).toMatch(/entity data/)
    expect(parseRpgEntity('rpgPresets', { schemaVersion: 1, presetId: 'party-1', name: 'Synthetic',
      slots: Array(5).fill({ outfitId: 'one', signature: 'fire', loadout: [] }),
      foregroundChapterId: null })).toBeNull()
    expect(parseRpgEntity('rpgCheckpoints', { ...atCheckpoint, selectedPath: Array(65).fill('n') })).toBeNull()
    expect(parseRpgEntity('rpgCheckpoints', { ...inBattle,
      frozenEntry: { ...frozen, enemyKitJson: JSON.stringify({ payload: 'x'.repeat(16_384) }) } })).toBeNull()
    expect(parseSyncRequest({ upserts: [{ kind: 'rpgCheckpoints', id: checkpointId,
      baseVersion: 0, data: atCheckpoint }] })).toMatch(/grouped command/)
  })
})
