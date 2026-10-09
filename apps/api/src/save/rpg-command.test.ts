import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FirestoreSaveRepository } from './firestore-save.repository'
import { LocalSaveRepository } from './local-save.repository'
import { parseRpgCommandRequest, type RpgCommandRequest } from './rpg-command'
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

const profile = (outfitId: string) => ({ outfitId, sourceContentVersion: 'invented-v1',
  baseStats: { speed: 100, stamina: 90, power: 80, guts: 70, wit: 60 },
  growthRates: { speed: 0.2, stamina: 0.1, power: 0, guts: 0, wit: 0.3 },
  sourceAptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'C', mile: 'C', medium: 'A', long: 'C' },
    strategy: { front: 'A', pace: 'A', late: 'B', end: 'G' } },
  affinities: { fire: 'A', dark: 'A' }, style: 'front', weapon: 'greatsword', defaultSignature: 'fire',
  tier: 1, level: 1, exp: 0, tree: [], legacy: [] })
/** Class era (D277–D282): Front + Pace makes a Brawler. */
const classProfile = (outfitId: string, tree: { tier: number; id: string }[] = [{ tier: 1, id: 'greatsword.fire.1' }], level = 1) => {
  const { affinities: _a, style: _s, weapon: _w, defaultSignature: _d, ...rest } = profile(outfitId)
  return { ...rest, classId: 'brawler', weapons: ['greatsword', 'spear'], level, tree }
}
const classParty = { schemaVersion: 3, presetId: 'party-1', name: 'Invented', foregroundChapterId: 'ura-finale',
  slots: [{ outfitId: 'uma-a', loadout: [{ tier: 1, id: 'greatsword.fire.1' }], familiar: 'greatsword' }, null, null, null, null] }
const run = { schemaVersion: 2, presetId: 'party-1', chapterId: 'ura-finale', wins: { start: 1 }, mp: {}, battle: null,
  battles: 0, clearedAt: null, updatedAt: 1 }
const members = ['uma-a', 'uma-b', 'uma-c', 'uma-d', 'uma-e'].map((outfitId) => ({ outfitId, delta: 19, beforeTier: 1, beforeLevel: 1,
  beforeExp: 0, afterTier: 1, afterLevel: 1, afterExp: 19 }))
const result = { schemaVersion: 2, resultId: 'rpg-battle:party-1:ura-finale:1', presetId: 'party-1', chapterId: 'ura-finale',
  nodeId: 'a1r1c1', rounds: 4, members, tokens: { tier: 1, slot: 1, skill: 2 }, createdAt: 5 }

for (const backend of ['local', 'firestore'] as const) {
  describe(`${backend} RPG rows and the remaining grouped command`, () => {
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

    it('syncs campaign rows like any save row (D263); an older RPG shape cannot overwrite them', async () => {
      const synced = await repo.sync('u1', { upserts: [
        { kind: 'rpgOutfits', id: 'uma-a', baseVersion: 0, data: { schemaVersion: 2, profile: profile('uma-a'), projectionRevision: 0 } },
        { kind: 'rpgPresets', id: 'party-1', baseVersion: 0, data: { schemaVersion: 2, presetId: 'party-1', name: 'Invented',
          slots: [{ outfitId: 'uma-a', signature: 'fire', loadout: [] }, null, null, null, null], foregroundChapterId: 'ura-finale' } },
        { kind: 'rpgCheckpoints', id: 'party-1:ura-finale', baseVersion: 0, data: run },
      ], appends: [{ kind: 'rpgResults', id: result.resultId, data: result, createdAt: result.createdAt }] })
      expect(synced.applied.map((row) => row.kind).sort()).toEqual(['rpgCheckpoints', 'rpgOutfits', 'rpgPresets'])
      expect(synced.appended).toBe(1)
      const stale = await repo.sync('u1', { upserts: [{ kind: 'rpgOutfits', id: 'uma-a', baseVersion: 1,
        data: { schemaVersion: 1, profile: { ...profile('uma-a'), level: 9 }, projectionRevision: 4 } }], appends: [] })
      expect(stale.applied).toEqual([])
      expect((await repo.load('u1')).entities.find((row) => row.kind === 'rpgOutfits')?.data.schemaVersion).toBe(2)
    })

    it('accepts class-era rows (D282); a schema-2 row cannot overwrite them', async () => {
      const synced = await repo.sync('u1', { upserts: [
        { kind: 'rpgOutfits', id: 'uma-a', baseVersion: 0, data: { schemaVersion: 3, profile: classProfile('uma-a'), projectionRevision: 1 } },
        { kind: 'rpgPresets', id: 'party-1', baseVersion: 0, data: classParty },
      ], appends: [] })
      expect(synced.applied.map((row) => row.kind).sort()).toEqual(['rpgOutfits', 'rpgPresets'])
      const stale = await repo.sync('u1', { upserts: [{ kind: 'rpgOutfits', id: 'uma-a', baseVersion: 1,
        data: { schemaVersion: 2, profile: profile('uma-a'), projectionRevision: 4 } }], appends: [] })
      expect(stale.applied).toEqual([])
      expect((await repo.load('u1')).entities.find((row) => row.kind === 'rpgOutfits')?.data.schemaVersion).toBe(3)
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

  })
}

describe('RPG sync and command parsers', () => {
  it('accepts campaign shapes, refuses first-map rows and receipts in ordinary sync', () => {
    expect(typeof parseSyncRequest({ upserts: [{ kind: 'rpgCheckpoints', id: 'party-1:ura-finale', baseVersion: 0, data: run }] })).toBe('object')
    expect(parseSyncRequest({ upserts: [{ kind: 'rpgCheckpoints', id: 'party-2:ura-finale', baseVersion: 0, data: run }] })).toMatch(/campaign shape and id/)
    expect(parseSyncRequest({ upserts: [{ kind: 'rpgCheckpoints', id: 'party-1:ura-finale', baseVersion: 0,
      data: { ...run, battle: { battleId: 'b', nodeId: 'n', startedAt: 1, input: { version: 2, pad: 'x'.repeat(70_000) } } } }] })).toMatch(/invalid rpgCheckpoints/)
    expect(parseSyncRequest({ appends: [{ kind: 'rpgReceipts', id: 'r', data: {}, createdAt: 1 }] })).toMatch(/receipts/)
    expect(parseSyncRequest({ appends: [{ kind: 'rpgResults', id: 'other', data: result, createdAt: result.createdAt }] })).toMatch(/campaign shape and id/)
  })
  it('checks class-era outfits against the class and tree rules', () => {
    const upsert = (data: unknown) => parseSyncRequest({ upserts: [{ kind: 'rpgOutfits', id: 'uma-a', baseVersion: 0, data }] })
    const outfit = (p: Record<string, unknown>) => ({ schemaVersion: 3, profile: p, projectionRevision: 0 })
    expect(typeof upsert(outfit(classProfile('uma-a')))).toBe('object')
    expect(typeof upsert(outfit({ ...classProfile('uma-a', [{ tier: 1, id: 'greatsword.fire.1' }, { tier: 1, id: 'greatsword.fire.2' },
      { tier: 1, id: 'greatsword.fire.2a' }], 10) }))).toBe('object')
    for (const bad of [
      { ...classProfile('uma-a'), classId: 'cleric', weapons: ['arcane-staff', 'cleric-staff'] }, // not open to Front + Pace
      { ...classProfile('uma-a'), weapons: ['greatsword', 'axe'] }, // not a weapon set
      classProfile('uma-a', [{ tier: 1, id: 'axe.fire.1' }]), // outside her trees
      classProfile('uma-a', [{ tier: 1, id: 'greatsword.fire.2' }], 10), // missing the core node above
      classProfile('uma-a', [{ tier: 1, id: 'greatsword.fire.1' }, { tier: 1, id: 'greatsword.fire.2' }], 9), // depth gate
      classProfile('uma-a', [{ tier: 1, id: 'greatsword.fire.1' }, { tier: 1, id: 'greatsword.fire.2' }, { tier: 1, id: 'greatsword.fire.2a' },
        { tier: 1, id: 'greatsword.fire.2b' }], 10), // both sides of a fork
    ]) expect(upsert(outfit(bad))).toMatch(/invalid rpgOutfits/)
    expect(typeof parseSyncRequest({ upserts: [{ kind: 'rpgPresets', id: 'party-1', baseVersion: 0, data: classParty }] })).toBe('object')
    expect(parseSyncRequest({ upserts: [{ kind: 'rpgPresets', id: 'party-1', baseVersion: 0, data: { ...classParty,
      slots: [{ ...classParty.slots[0], loadout: [{ tier: 1, id: 'short-sword.duel.1' }] }, null, null, null, null] } }] })).toMatch(/invalid rpgPresets/)
  })
  it('accepts self-consistent token exchange rows (D309)', () => {
    const side = (side: 'in' | 'out', itemId: string, delta: number, extra: Record<string, unknown> = {}) => ({
      id: `inspiration-exchange:x1:${side}`, itemId, delta, createdAt: 1, reason: 'inspiration-exchange',
      source: { kind: 'inspiration-exchange', exchangeId: 'x1', tier: Number(itemId.split(':t')[1]!.split(':')[0]), tokenKind: 'skill',
        direction: 'up', batches: 3, side, ...extra } })
    const append = (data: Record<string, unknown>) => parseSyncRequest({ appends: [{ kind: 'itemLedger', id: data.id as string, data, createdAt: 1 }] })
    expect(typeof append(side('in', 'inspiration:t2:skill', -6))).toBe('object')
    expect(typeof append(side('out', 'inspiration:t3:skill', 3, { debtPaid: 2 }))).toBe('object')
    for (const bad of [side('in', 'inspiration:t2:skill', -3), side('out', 'inspiration:t3:skill', 6), side('in', 'inspiration:t14:skill', -6),
      side('out', 'inspiration:t3:skill', 3, { debtPaid: 4 }), side('in', 'inspiration:t2:skill', -6, { debtPaid: 0 }),
      { ...side('in', 'inspiration:t2:skill', -6), id: 'inspiration-exchange:x2:in' }]) expect(append(bad)).toMatch(/invalid itemLedger/)
  })
  it('refuses retired grouped actions so an old app cannot move a campaign run', () => {
    expect(parseRpgCommandRequest({ schemaVersion: 1, commandId: 'old-begin', action: 'begin-battle', expected: [], upserts: [], appends: [] }))
      .toMatch(/syncs directly/)
  })
})
