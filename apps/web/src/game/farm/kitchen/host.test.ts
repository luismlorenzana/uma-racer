// Real adapter/IndexedDB + invented semantic repository, never a production save or content pack.
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialFarmState, createPlayerProfile, parseUmaSaveOrThrow } from '@racer/domain'
import { readFarmStatState } from './stats'
import { farmStatsFor } from '../../farm-stats'
import { farmProofContent, farmProofCards } from './proof-content'
import { buildPreparedRace } from '../../racing'
import { FARM_CUTOVER_GENERATION, FARM_KITCHEN_JOB_MS, FARM_KITCHEN_ENERGY_MS, FARM_KITCHEN_CATALOGUE, farmCanonical,
  FARM_STATION_IDS, farmBytes, farmOperationReferences, FARM_SYNC_LIMITS, createFarmKitchenWorker, emptyFarmRecipes,
  type FarmPayloadV1, type FarmStoredEntity, type FarmOperationV1 } from '@racer/domain/farm/kitchen'
import { farmProtocolFixture } from '../../../../../../packages/domain/src/farm/kitchen/protocol-fixtures'
import { RacerDb } from '../../db'
import { PersistentFarmKitchenHost, getFarmKitchenHost, installFarmKitchenHost, type FarmKitchenHostOptions, type FarmIntent } from './host'
import { farmTransactionTables } from './operations'
import { createFarmKitchenStore, publishFarmKitchenView, observeFarmKitchen, type FarmObserverEvents } from './store'
import { readFarmKitchenSummary } from './diagnostics'
import { exportFarmDeviceRecovery } from './recovery'

const raw = 'farm:raw:ura-finale:vegetable:speed'
const processed = 'farm:processed:ura-finale:canned-vegetable:speed'
let sequence = 0
async function put(db: RacerDb, row: FarmStoredEntity) { await db.table(row.kind).put({ id: row.id, data: row.data, version: row.version, updatedAt: row.updatedAt, deleted: row.deleted }) }
describe('real Farm kitchen host', () => {
  let db: RacerDb, f: ReturnType<typeof farmProtocolFixture>, host: PersistentFarmKitchenHost, clock: number, publish: ReturnType<typeof vi.fn>
  const make = (extra: Partial<FarmKitchenHostOptions> = {}) => new PersistentFarmKitchenHost({ database: db, enabled: true, clock: () => clock, publish,
    ownerDebugAllowed: () => true, recover: async ops => ops.flatMap(op => f.apply(op).responses), ...extra })
  async function confirmed(target?: { outfitId: string; scenarioId: string }): Promise<FarmIntent> {
    return { intentId: await host.createIntent(), expectedRevision: (await host.read(target)).revision }
  }
  async function command(p: FarmPayloadV1, dependencies: string[] = []): Promise<string> {
    const intent = { ...await confirmed('scenarioId' in p ? { outfitId: p.outfitId, scenarioId: p.scenarioId } : undefined), dependencies }
    const { kind, ...fields } = p
    const result = kind === 'assign' ? await host.assign({ ...intent, ...fields } as Parameters<typeof host.assign>[0])
      : kind === 'remove' ? await host.remove({ ...intent, ...fields } as Parameters<typeof host.remove>[0])
        : kind === 'start' ? await host.start({ ...intent, ...fields } as Parameters<typeof host.start>[0])
          : kind === 'buy-node' ? await host.buyNode({ ...intent, ...fields } as Parameters<typeof host.buyNode>[0])
            : kind === 'set-active' ? await host.setActive({ ...intent, ...fields } as Parameters<typeof host.setActive>[0])
              : kind === 'grant-energy' ? await host.grantEnergy({ ...intent, ownerDebugConfirmed: true })
                : await host.claim({ ...intent, ...fields } as Parameters<typeof host.claim>[0])
    return result.operationId
  }
  async function flush(dropReply = false) {
    const ops = await host.coordinator.nextBatch(), responses = ops.flatMap(op => f.apply(op).responses)
    if (!dropReply) await host.coordinator.adopt(ops, responses, clock)
    return ops
  }
  beforeEach(async () => {
    db = new RacerDb(`farm-host-proof-${++sequence}`); await db.open()
    f = farmProtocolFixture(0, FARM_CUTOVER_GENERATION); clock = 1000; publish = vi.fn(); host = make()
    for (const row of f.entities.values()) await put(db, row)
  })
  afterEach(async () => db.delete())
  it('reads/defaults/new getter without enrollment or a production double; install/uninstall is readiness-scoped', async () => {
    await expect(Promise.resolve().then(getFarmKitchenHost)).rejects.toThrow(/not ready/)
    await db.farmWorkers.delete('invented-1')
    const before = await Promise.all(db.tables.map(t => t.toArray()))
    const view = await host.read(); expect(view.workers['invented-1']!.progress.level).toBe(1)
    expect(view.stations).toHaveLength(30); expect(view.mode).toBe('active')
    expect(await Promise.all(db.tables.map(t => t.toArray()))).toEqual(before)
    const stop = installFarmKitchenHost(host); expect(getFarmKitchenHost()).toBe(host); stop()
    expect(() => getFarmKitchenHost()).toThrow(/not ready/)
  })
  it('assigns, starts, restores the same frozen job, waits, claims once and retains assignment', async () => {
    await command({ kind: 'assign', stationId: 'garden-2', outfitId: 'invented-1' }); await flush()
    const startId = await command({ kind: 'start', stationId: 'garden-2', outfitId: 'invented-1', recipeId: raw, quantity: 1, choices: {} })
    const frozen = (await host.read()).stations[1]!.job!
    expect(frozen.inputs).toEqual([]); expect(frozen.readyAt).toBe(clock + FARM_KITCHEN_JOB_MS)
    await flush(true); db.close(); await db.open(); host = make()
    expect((await host.read()).stations[1]!.job).toEqual(frozen)
    expect((await host.retry({ operationId: startId }))!.status).toBe('pending'); await flush()
    clock = frozen.readyAt
    expect((await host.read()).stations[1]!.status).toBe('ready')
    const claimId = await command({ kind: 'claim', stationId: 'garden-2', outfitId: 'invented-1', jobId: frozen.id, recipeId: raw })
    expect((await host.read()).items[raw]).toEqual({ canonical: 0, reserved: 0, incoming: 6, projected: 6 })
    expect(await db.items.count()).toBe(0); await flush(true); await flush()
    const result = await host.retry({ operationId: claimId })
    expect(result).toMatchObject({ status: 'duplicate', celebrate: false, receipt: { result: { expAward: 12, levelsCrossed: [], firstPrepared: [] } } })
    const view = await host.read(); expect(view.workers['invented-1']!.canonical.totalExp).toBe(12)
    expect(view.stations[1]).toMatchObject({ outfitId: 'invented-1', job: null, status: 'idle' })
    expect(view.items[raw]!.canonical).toBe(6); expect(await db.itemLedger.count()).toBe(1)
  })
  it('reuses double-tap intents and rejects changed payloads or stale simultaneous screens', async () => {
    const input = { ...await confirmed(), stationId: 'garden-1' as const, outfitId: 'invented-0', recipeId: raw, quantity: 1, choices: {} }
    const results = await Promise.all([host.start(input), host.start(input)])
    expect(results.map(r => r.operationId)).toEqual([input.intentId, input.intentId]); expect(await db.farmPending.count()).toBe(1)
    await expect(host.start({ ...input, recipeId: 'farm:raw:ura-finale:vegetable:power' })).rejects.toThrow(/reused/)
    const nextId = await host.createIntent()
    await expect(host.start({ ...input, intentId: nextId })).rejects.toThrow(/changed/)
    expect(await db.farmPending.count()).toBe(1)
  })
  it.each([false, true])('retains offline raw→processing→cooking dependencies; middle rejection=%s never grants descendant output', async rejectMiddle => {
    f.put('farmWorkers', 'invented-0', createFarmKitchenWorker(f.generation, 'invented-0', 192)); await put(db, f.entities.get('farmWorkers/invented-0')!)
    const first = await command({ kind: 'start', stationId: 'garden-1', outfitId: 'invented-0', recipeId: raw, quantity: 1, choices: {} })
    clock += FARM_KITCHEN_JOB_MS
    let last = await command({ kind: 'claim', stationId: 'garden-1', outfitId: 'invented-0', recipeId: raw,
      jobId: `farm-job:${f.generation}:garden-1:1` }, [first])
    last = await command({ kind: 'assign', stationId: 'workshop-1', outfitId: 'invented-0' }, [last])
    const recipe = FARM_KITCHEN_CATALOGUE.recipesById.get(processed)!
    expect(recipe).toBeDefined()
    const choices = Object.fromEntries(recipe.inputs.map(s => [s.id, s.fixedItemId!]))
    last = await command({ kind: 'start', stationId: 'workshop-1', outfitId: 'invented-0', recipeId: processed, quantity: 1, choices }, [last])
    clock += FARM_KITCHEN_JOB_MS
    last = await command({ kind: 'claim', stationId: 'workshop-1', outfitId: 'invented-0', recipeId: processed,
      jobId: `farm-job:${f.generation}:workshop-1:1` }, [last])
    // Gathering another batch creates the raw side of a legal meal; assignments remain explicit.
    last = await command({ kind: 'assign', stationId: 'garden-1', outfitId: 'invented-0' }, [last])
    last = await command({ kind: 'start', stationId: 'garden-1', outfitId: 'invented-0', recipeId: raw, quantity: 1, choices: {} }, [last])
    clock += FARM_KITCHEN_JOB_MS
    last = await command({ kind: 'claim', stationId: 'garden-1', outfitId: 'invented-0', recipeId: raw,
      jobId: `farm-job:${f.generation}:garden-1:2` }, [last])
    last = await command({ kind: 'assign', stationId: 'kitchen-1', outfitId: 'invented-0' }, [last])
    last = await command({ kind: 'start', stationId: 'kitchen-1', outfitId: 'invented-0', recipeId: 'farm:meal:b1:speed', quantity: 2,
      choices: { 'raw-speed': raw, 'processed-speed': processed } }, [last])
    clock += FARM_KITCHEN_JOB_MS
    await command({ kind: 'claim', stationId: 'kitchen-1', outfitId: 'invented-0', recipeId: 'farm:meal:b1:speed',
      jobId: `farm-job:${f.generation}:kitchen-1:1` }, [last])
    const operations = await db.farmPending.toArray(), projected = await host.read()
    expect(projected.items['farm:meal:b1:speed']!.projected).toBe(2); expect(await db.items.count()).toBe(0)
    db.close(); await db.open(); host = make(); expect(await db.farmPending.toArray()).toEqual(operations)
    if (rejectMiddle) {
      const ops = await host.coordinator.nextBatch(), replies = ops.flatMap((op, i) => {
        if (i === 3) f.entities.get('umas/invented-0')!.version++
        return f.apply(op).responses
      })
      await host.coordinator.adopt(ops, replies, clock)
      const final = await host.read()
      expect(final.items['farm:meal:b1:speed']).toBeUndefined(); expect(final.items[processed]).toBeUndefined()
      expect(final.items[raw]!.canonical).toBe(6); expect(final.workers['invented-0']!.canonical.totalExp).toBe(204)
      expect(final.pending.map(p => p.status)).toEqual(['rejected', ...Array(7).fill('blocked')])
    } else {
      await flush()
      const final = await host.read(); expect(final.items['farm:meal:b1:speed']!.canonical).toBe(2)
      expect(final.workers['invented-0']!.canonical.totalExp).toBe(240)
      expect(final.recipes.b1!.canonical.cookbook['farm:meal:b1:speed']).toMatchObject({ count: 2 })
      expect(await db.farmPending.count()).toBe(0)
      // Continue the real production chain into Items -> buy -> activate -> the actual race builder.
      const purchase = await command({ kind: 'buy-node', outfitId: 'invented-0', scenarioId: 'ura-finale', distance: 'sprint', nodeId: 'speed-01', autoactivate: false })
      expect(farmStatsFor(await readFarmStatState(db, true), 'invented-0', 1, 'sprint')?.speed).toBe(0)
      await flush()
      expect((await host.read({ outfitId: 'invented-0', scenarioId: 'ura-finale', operationIds: [purchase] })).receipts[purchase]?.result).toMatchObject({ nodeName: 'Speed Seed', activated: false })
      const activation = await command({ kind: 'set-active', outfitId: 'invented-0', scenarioId: 'ura-finale', distance: 'long', nodeIds: ['speed-01'] })
      expect(farmStatsFor(await readFarmStatState(db, true), 'invented-0', 1, 'long')?.speed).toBe(0)
      await flush()
      const joined = await readFarmStatState(db, true), content = farmProofContent(), saved = parseUmaSaveOrThrow((await db.umas.get('invented-0'))!.data)
      const uma = { ...saved, activePreset: 'sprint' as const, scenarios: saved.scenarios.map(run => ({ ...run, started: true,
        presets: Object.fromEntries(Object.entries(run.presets).map(([d, preset]) => [d, { ...preset, cardSetIds: ['invented-support'] }])) as typeof run.presets })) }
      const build = (distance: 'sprint' | 'long') => buildPreparedRace({ content, profile: createPlayerProfile('2000-01-01', 0), uma, cardsById: farmProofCards(), raceId: `invented-race-${distance}`,
        strategy: 'pace', sequence: 0, farmStats: farmStatsFor(joined, uma.templateId, 1, distance) })
      expect(build('long').startStats.speed).toBe(1200); expect(build('sprint').startStats.speed).toBe(1195)
      expect((await db.items.get('farm:meal:b1:speed'))!.data.quantity).toBe(1)
      expect((await host.retry({ operationId: activation }))?.status).toBe('duplicate')
      const repeated = await command({ kind: 'buy-node', outfitId: 'invented-0', scenarioId: 'ura-finale', distance: 'mile', nodeId: 'speed-01', autoactivate: true })
      await flush(); expect((await host.retry({ operationId: repeated }))?.receipt?.reusedTarget).toBeTruthy()
      expect((await db.items.get('farm:meal:b1:speed'))!.data.quantity).toBe(1)
      expect(farmStatsFor(await readFarmStatState(db, true), 'invented-0', 1, 'mile')?.speed).toBe(0)
    }
  })
  it.each([108, 180])('reports actual shared milestone crossings from EXP %s, not inventory guesses', async exp => {
    f.put('farmWorkers', 'invented-0', createFarmKitchenWorker(f.generation, 'invented-0', exp)); await put(db, f.entities.get('farmWorkers/invented-0')!)
    await command({ kind: 'start', stationId: 'garden-1', outfitId: 'invented-0', recipeId: raw, quantity: 1, choices: {} }); await flush()
    clock += FARM_KITCHEN_JOB_MS
    const claimId = await command({ kind: 'claim', stationId: 'garden-1', outfitId: 'invented-0', recipeId: raw, jobId: `farm-job:${f.generation}:garden-1:1` }); await flush()
    const r = await host.retry({ operationId: claimId })
    expect(r!.receipt!.result).toMatchObject({ levelsCrossed: [exp === 108 ? 6 : 9], milestones: expect.arrayContaining([{ block: 1, kind: exp === 108 ? 'processing' : 'cooking' }]) })
    expect((await host.read()).workers['invented-1']!.progress.level).toBe(1)
  })
  it('retains a rejected ancestor, blocks descendants, exports the frozen input and forbids uncertain Discard', async () => {
    const first = await command({ kind: 'start', stationId: 'garden-1', outfitId: 'invented-0', recipeId: raw, quantity: 1, choices: {} })
    clock += FARM_KITCHEN_JOB_MS
    const second = await command({ kind: 'claim', stationId: 'garden-1', outfitId: 'invented-0', recipeId: raw, jobId: `farm-job:${f.generation}:garden-1:1` }, [first])
    await expect(host.retry({ operationId: first, action: 'discard' })).rejects.toThrow(/nonacceptance/)
    f.entities.get('umas/invented-0')!.version++
    await flush()
    expect((await host.read()).pending.map(r => r.status)).toEqual(['rejected', 'blocked']); expect(await db.items.count()).toBe(0)
    await expect(host.retry({ operationId: first, action: 'discard' })).rejects.toThrow(/dependent/)
    expect((await host.retry({ operationId: second }))!.status).toBe('blocked')
    await host.retry({ operationId: second, action: 'discard' }); await host.retry({ operationId: first, action: 'discard' })
    expect(await db.farmPending.count()).toBe(0); expect(await db.farmRecovery.count()).toBe(2)
  })
  it('confirms single-job Energy/waste, resumes an exact lost acknowledgement and never grants automatically', async () => {
    const grant = await confirmed(); await host.grantEnergy({ ...grant, ownerDebugConfirmed: true }); await flush()
    await command({ kind: 'start', stationId: 'garden-1', outfitId: 'invented-0', recipeId: raw, quantity: 1, choices: {} }); await flush()
    const job = (await host.read()).stations[0]!.job!; clock = job.readyAt - 1000
    const input = { ...await confirmed(), stationId: 'garden-1' as const, outfitId: 'invented-0', jobId: job.id, confirmedWastedMs: FARM_KITCHEN_ENERGY_MS - 1000 }
    await expect(host.spendEnergy({ ...input, confirmedWastedMs: 0 })).rejects.toThrow(/wasted/)
    await host.spendEnergy(input); const frozen = (await db.farmPending.get(input.intentId))!.operation
    await flush(true); db.close(); await db.open(); host = make(); await host.retry({ operationId: input.intentId }); await flush()
    expect((await db.farmOperations.get(input.intentId))!.data.operation).toEqual(frozen)
    expect((await host.read()).items['farm:energy']!.canonical).toBe(49)
    expect((await host.read()).stations[0]!.status).toBe('ready')
    await expect(make({ ownerDebugAllowed: () => false }).grantEnergy({ ...await confirmed(), ownerDebugConfirmed: true })).rejects.toThrow(/playtesting/)
  })
  it('buys/activates only projected nodes until acknowledgement; lost Buy replies spend one meal once', async () => {
    f.put('items', 'farm:meal:b1:speed', { itemId: 'farm:meal:b1:speed', quantity: 1, updatedAt: 1 }); await put(db, f.entities.get('items/farm:meal:b1:speed')!)
    const target = { outfitId: 'invented-0', scenarioId: 'ura-finale' }, input = { ...await confirmed(target), ...target, distance: 'sprint' as const, nodeId: 'speed-01', autoactivate: true }
    const r = await host.buyNode(input)
    expect(r.view.extra).toMatchObject({ canonical: { boughtNodeIds: [] }, projected: { boughtNodeIds: ['speed-01'] }, pending: true })
    expect((await db.items.get('farm:meal:b1:speed'))!.data.quantity).toBe(1)
    await flush(true); db.close(); await db.open(); host = make(); await host.retry({ operationId: input.intentId }); await flush()
    expect((await host.read(target)).extra!.canonical.boughtNodeIds).toEqual(['speed-01'])
    expect((await db.items.get('farm:meal:b1:speed'))!.data.quantity).toBe(0)
  })
  it.each(['order', 'pending', 'outbox'])('rolls pending %s failure back without partial store publication', async boundary => {
    host = make({ afterWrite: key => { if (key === boundary) throw new Error('Invented write fault') } })
    const before = farmCanonical(await db.farm.get('main'))
    await expect(host.start({ ...await confirmed(), stationId: 'garden-1', outfitId: 'invented-0', recipeId: raw, quantity: 1, choices: {} })).rejects.toThrow(/fault/)
    expect(await db.farmPending.count()).toBe(0); expect(await db.outbox.count()).toBe(0); expect(publish).not.toHaveBeenCalled()
    expect(farmCanonical(await db.farm.get('main'))).toBe(before)
  })
  it('uses bounded target reads in Start; a display roster read remains separate from transaction authority', async () => {
    const intent = await confirmed(), umaReads = vi.spyOn(db.umas, 'toArray'), cardReads = vi.spyOn(db.cards, 'toArray')
    // result's latest view reads the roster once, after the enqueue has committed; the coordinator never scans it.
    const reads: number[] = []
    host = make({ afterWrite: () => { reads.push(umaReads.mock.calls.length) } })
    await host.start({ ...intent, stationId: 'garden-1', outfitId: 'invented-0', recipeId: raw, quantity: 1, choices: {} })
    expect(reads).toEqual([0, 0, 0]); expect(umaReads).toHaveBeenCalledTimes(1); expect(cardReads).not.toHaveBeenCalled()
  })
  it('admits a Lv1 specialist to shared same-block recipes/later variants and refuses cross-block inputs', async () => {
    f.put('farmRecipes', 'b1', { ...emptyFarmRecipes(f.generation, 1), processing: { jobId: `farm-job:${f.generation}:garden-1:99`, outfitId: 'invented-0', level: 6 },
      cooking: { jobId: `farm-job:${f.generation}:garden-1:100`, outfitId: 'invented-0', level: 9 } })
    await put(db, f.entities.get('farmRecipes/b1')!)
    const lateRaw = FARM_KITCHEN_CATALOGUE.foods.find(food => food.stage === 'raw' && food.stat === 'speed' && food.scenarioIndex === 5)!.id
    const lateProcessed = FARM_KITCHEN_CATALOGUE.foods.find(food => food.stage === 'processed' && food.stat === 'speed' && food.scenarioIndex === 5)!.id
    for (const id of [lateRaw, lateProcessed]) { f.put('items', id, { itemId: id, quantity: 4, updatedAt: 1 }); await put(db, f.entities.get(`items/${id}`)!) }
    await command({ kind: 'assign', stationId: 'kitchen-1', outfitId: 'invented-1' }); await flush()
    const input = { ...await confirmed(), stationId: 'kitchen-1' as const, outfitId: 'invented-1', recipeId: 'farm:meal:b1:speed', quantity: 3,
      choices: { 'raw-speed': lateRaw, 'processed-speed': lateProcessed } }
    const wrong = FARM_KITCHEN_CATALOGUE.foods.find(food => food.stage === 'raw' && food.stat === 'speed' && food.block === 2)!.id
    await expect(host.start({ ...input, choices: { ...input.choices, 'raw-speed': wrong } })).rejects.toThrow(/Invalid/)
    await host.start(input); await flush(); clock += FARM_KITCHEN_JOB_MS
    const id = await command({ kind: 'claim', stationId: 'kitchen-1', outfitId: 'invented-1', recipeId: input.recipeId,
      jobId: `farm-job:${f.generation}:kitchen-1:1` }); await flush()
    expect((await host.retry({ operationId: id }))!.receipt!.result).toMatchObject({ output: { amount: 3 }, expAward: 12, firstPrepared: [input.recipeId] })
    expect((await host.read()).workers['invented-1']!.canonical.totalExp).toBe(12)
  })
  it('two devices cannot both spend the last ingredient batch or last meal on different nodes', async () => {
    const peer = new RacerDb(`farm-host-peer-${++sequence}`); await peer.open()
    try {
      f.put('items', 'farm:meal:b1:speed', { itemId: 'farm:meal:b1:speed', quantity: 1, updatedAt: 1 })
      for (const row of f.entities.values()) { await put(db, row); await put(peer, row) }
      const other = make({ database: peer }), target = { outfitId: 'invented-0', scenarioId: 'ura-finale' }
      const first = { ...await confirmed(target), ...target, distance: 'sprint' as const, nodeId: 'speed-01', autoactivate: false }
      const second = { intentId: await other.createIntent(), expectedRevision: (await other.read(target)).revision, ...target,
        distance: 'sprint' as const, nodeId: 'speed-02', autoactivate: false }
      await host.buyNode(first); await other.buyNode(second)
      const a = (await host.coordinator.nextBatch())[0]!, b = (await other.coordinator.nextBatch())[0]!
      await host.coordinator.adopt([a], f.apply(a).responses, clock); await other.coordinator.adopt([b], f.apply(b).responses, clock)
      expect((await other.retry({ operationId: b.operationId }))!.status).toBe('rejected')
      expect(f.entities.get('farmExtra/invented-0:b1')!.data.boughtNodeIds).toEqual(['speed-01'])
      expect(f.entities.get('items/farm:meal:b1:speed')!.data.quantity).toBe(0)
      const r = FARM_KITCHEN_CATALOGUE.recipesById.get(processed)!, choices = Object.fromEntries(r.inputs.map(s => [s.id, s.fixedItemId!]))
      f.put('farmRecipes', 'b1', { ...emptyFarmRecipes(f.generation, 1), processing: { jobId: `farm-job:${f.generation}:garden-1:99`, outfitId: 'invented-0', level: 6 } })
      f.put('items', raw, { itemId: raw, quantity: 6, updatedAt: 1 })
      f.apply(f.operation({ kind: 'assign', stationId: 'workshop-1', outfitId: 'invented-0' }))
      f.apply(f.operation({ kind: 'assign', stationId: 'workshop-2', outfitId: 'invented-1' }))
      for (const row of f.entities.values()) { await put(db, row); await put(peer, row) }
      // Explicitly settle the rejected intent, not a hidden retry with revised spending bytes.
      await other.retry({ operationId: b.operationId, action: 'discard' })
      const x = await command({ kind: 'start', stationId: 'workshop-1', outfitId: 'invented-0', recipeId: processed, quantity: 1, choices })
      const y = await other.start({ intentId: await other.createIntent(), expectedRevision: (await other.read()).revision,
        stationId: 'workshop-2', outfitId: 'invented-1', recipeId: processed, quantity: 1, choices })
      const xOp = (await db.farmPending.get(x))!.operation, yOp = (await peer.farmPending.get(y.operationId))!.operation
      expect(f.apply(xOp).responses[0]!.status).toBe('applied'); expect(f.apply(yOp).responses[0]!.status).toBe('rejected')
      expect(f.entities.get(`items/${raw}`)!.data.quantity).toBe(0)
    } finally { await peer.delete() }
  })
  it('foreground reload and minute ticks only read, hidden/unmounted observers cannot publish or restart work', async () => {
    const store = createFarmKitchenStore(), focus = new Set<() => void>(), visibility = new Set<() => void>(), timers = new Set<() => void>()
    let visible = true
    const events: FarmObserverEvents = { visible: () => visible, now: () => clock,
      onFocus: listener => { focus.add(listener); return () => focus.delete(listener) }, onVisibility: listener => { visibility.add(listener); return () => visibility.delete(listener) },
      setTimer: listener => { timers.add(listener); return listener }, clearTimer: timer => { timers.delete(timer as () => void) } }
    const before = await Promise.all(db.tables.map(t => t.toArray())), stop = observeFarmKitchen(host, db, store, {}, events)
    await vi.waitFor(() => expect(store.getState().controlsReady).toBe(true))
    const oldWorkers = store.getState().workers; clock += 60000; for (const tick of [...timers]) tick()
    await vi.waitFor(() => expect(store.getState().view!.now).toBe(clock)); expect(store.getState().workers).toBe(oldWorkers)
    visible = false; for (const listener of visibility) listener(); expect(store.getState().controlsReady).toBe(false); expect(timers.size).toBe(0)
    visible = true; for (const listener of focus) listener(); await vi.waitFor(() => expect(store.getState().controlsReady).toBe(true))
    stop(); expect(timers.size).toBe(0); expect(focus.size).toBe(0); expect(visibility.size).toBe(0)
    expect(await Promise.all(db.tables.map(t => t.toArray()))).toEqual(before)
  })
  it('exports unresolved and even future rows privately without parsing them into rewards or writing progress', async () => {
    const id = await command({ kind: 'start', stationId: 'garden-1', outfitId: 'invented-0', recipeId: raw, quantity: 1, choices: {} })
    const before = await Promise.all(db.tables.map(t => t.toArray())), download = vi.fn(async (blob: Blob) => JSON.parse(await blob.text()) as Record<string, unknown>)
    await exportFarmDeviceRecovery(db, 'invented-account', 'invented-build', async blob => { await download(blob) })
    const exported = download.mock.results[0]!.value
    expect(await exported).toMatchObject({ format: 'uma-racer-farm-device-recovery-v1', accountId: 'invented-account', localTables: { farmPending: [{ id }] } })
    expect(await Promise.all(db.tables.map(t => t.toArray()))).toEqual(before)
  })
  it('keeps clock/navigation read-only, reports future data and never falls back to a v2 writer', async () => {
    await command({ kind: 'start', stationId: 'garden-1', outfitId: 'invented-0', recipeId: raw, quantity: 1, choices: {} }); await flush()
    const before = await db.farm.toArray(), job = (await host.read()).stations[0]!.job!
    clock = 0; expect((await host.read()).stations[0]!.remainingMs).toBe(job.readyAt)
    clock = job.readyAt + 999; expect((await host.read()).stations[0]!.status).toBe('ready'); expect(await db.farm.toArray()).toEqual(before)
    const disabled = make({ enabled: false }); expect((await disabled.read()).mode).toBe('maintenance')
    await expect(disabled.start({ ...await confirmed(), stationId: 'garden-1', outfitId: 'invented-0', recipeId: raw, quantity: 1, choices: {} })).rejects.toThrow(/disabled/)
    const worker = (await db.farmWorkers.get('invented-0'))!; worker.data.schemaVersion = 99; await db.farmWorkers.put(worker)
    await expect(host.read()).rejects.toThrow(/recovery/)
    await expect(exportFarmDeviceRecovery(db, 'invented-account', 'invented-build', async () => { throw new Error('Export denied') })).rejects.toThrow(/denied/)
    expect((await db.farmWorkers.get('invented-0'))!.data.schemaVersion).toBe(99)
  })
  it('keeps flag-off legacy reads write-free, preparing read-only, and unavailable storage honest', async () => {
    await db.farmCutover.clear(); await db.farm.put({ id: 'main', version: 1, revision: 1, data: createInitialFarmState() })
    host = make({ enabled: false }); expect((await host.read()).mode).toBe('legacy'); expect(await db.outbox.count()).toBe(0)
    const control = f.entities.get('farmCutover/main')!; control.data.phase = 'preparing'; control.data.nextOutfitIndex = 0; control.data.activatedAt = null; await put(db, control)
    host = make(); expect((await host.read()).mode).toBe('upgrade')
    await expect(host.createIntent()).rejects.toThrow(/finish/)
    host = make({ persistent: () => false }); await expect(host.read()).rejects.toThrow(/unavailable/)
  })
  it('reuses narrow Zustand slices on unrelated changes and exposes aggregate diagnostics only', async () => {
    const store = createFarmKitchenStore(); publishFarmKitchenView(store, await host.read()); const before = store.getState()
    const uma = (await db.umas.get('invented-0'))!; uma.data.exp = 99; await db.umas.put(uma)
    publishFarmKitchenView(store, await host.read()); expect(store.getState().workers).toBe(before.workers); expect(store.getState().items).toBe(before.items)
    expect(JSON.stringify(await readFarmKitchenSummary(db, clock))).not.toContain('invented-0')
  })
  it('production factory returns the real adapter in disabled-generation read-only mode without writes or port calls', async () => {
    vi.stubGlobal('__APP_BUILD_ID__', 'invented-build')
    try {
      const { createProductionFarmKitchenHost } = await import('./production'), schedule = vi.fn(), published = vi.fn(async () => {})
      const before = await Promise.all(db.tables.map(t => t.toArray()))
      const real = await createProductionFarmKitchenHost(db, { current: () => true, persistent: () => true, safeToPrepare: () => true, schedule, publish: published })
      expect(real).toBeInstanceOf(PersistentFarmKitchenHost); expect((await real.read()).mode).toBe('maintenance')
      await expect(real.createIntent()).rejects.toThrow(/disabled/)
      expect(await real.prepareUpgrade()).toBe(false)
      expect(schedule).not.toHaveBeenCalled(); expect(published).not.toHaveBeenCalled()
      expect(await Promise.all(db.tables.map(t => t.toArray()))).toEqual(before)
    } finally { vi.unstubAllGlobals() }
  })
  it('Collect all freezes all30 ready jobs, partitions within every ceiling, retries partial acknowledgements once', async () => {
    const states = []
    // Seed30 legal ready jobs through the same pure semantic repository. No account JSON or copied content.
    f.put('farmRecipes', 'b1', { ...emptyFarmRecipes(f.generation, 1), processing: { jobId: `farm-job:${f.generation}:garden-1:99`, outfitId: 'invented-0', level: 6 },
      cooking: { jobId: `farm-job:${f.generation}:garden-1:100`, outfitId: 'invented-0', level: 9 } })
    await put(db, f.entities.get('farmRecipes/b1')!)
    for (const food of FARM_KITCHEN_CATALOGUE.foods.filter(food => food.block === 1 && ['raw', 'processed'].includes(food.stage))) {
      f.put('items', food.id, { itemId: food.id, quantity: 100, updatedAt: 1 }); await put(db, f.entities.get(`items/${food.id}`)!)
    }
    for (let i = 0; i < 30; i++) {
      const outfitId = `invented-${i}`, base = f.entities.get('umas/invented-0')!
      f.put('umas', outfitId, { ...base.data, templateId: outfitId }); f.put('farmWorkers', outfitId, createFarmKitchenWorker(f.generation, outfitId, 192))
      await put(db, f.entities.get(`umas/${outfitId}`)!); await put(db, f.entities.get(`farmWorkers/${outfitId}`)!)
      const stationId = FARM_STATION_IDS[i]!, district = stationId.split('-')[0]
      const recipe = FARM_KITCHEN_CATALOGUE.recipes.find(r => r.district === district && r.block === 1 && r.requiredLevel === 1)!
      const choices = Object.fromEntries(recipe.inputs.map(s => [s.id, s.fixedItemId ?? FARM_KITCHEN_CATALOGUE.foods.find(food => food.stage === s.stage && food.stat === s.stat && food.block === 1)!.id]))
      expect(f.apply(f.operation({ kind: 'assign', stationId, outfitId })).responses[0]!.status).toBe('applied')
      const started = f.apply(f.operation({ kind: 'start', stationId, outfitId, recipeId: recipe.id, quantity: 1, choices })).responses[0]!
      expect(started.status).toBe('applied')
      expect(started.receipt!.result.kind).toBe('start')
      if (started.receipt!.result.kind === 'start') states.push(started.receipt!.result.job)
    }
    for (const row of f.entities.values()) await put(db, row)
    for (const row of f.logs.values()) await db.table(row.kind).put({ id: row.id, data: row.data, createdAt: row.createdAt })
    clock += FARM_KITCHEN_JOB_MS
    const intent = await confirmed(), result = await host.collectAll(intent)
    expect(result).toMatchObject({ pending: 30, succeeded: 0, failed: 0 }); expect(result.jobs.every(j => j.name.length > 0)).toBe(true)
    const queued = await db.farmPending.toArray(); expect(queued).toHaveLength(30)
    let batches = 0
    while (await db.outbox.count()) {
      const ops = await host.coordinator.nextBatch(), refs = new Set(ops.flatMap(o => { const r = farmOperationReferences(o); return [...r.entities, ...r.logs] }))
      expect(ops.length).toBeLessThanOrEqual(FARM_SYNC_LIMITS.groups); expect(refs.size).toBeLessThanOrEqual(FARM_SYNC_LIMITS.documents)
      expect(farmBytes({ upserts: [], appends: [], farmProtocolVersion: 1, farmOperations: ops })).toBeLessThanOrEqual(FARM_SYNC_LIMITS.bytes)
      if (!batches) f.entities.get('umas/invented-20')!.version++ // one stale device input blocks later dependent claims, not earlier successes.
      await flush(); batches++
    }
    expect(batches).toBeGreaterThanOrEqual(2)
    db.close(); await db.open(); host = make()
    const after = await host.collectAll(intent)
    expect(after.succeeded).toBe(20); expect(after.failed).toBe(10); expect(after.jobs.map(j => j.operationId)).toEqual(result.jobs.map(j => j.operationId))
    expect(after.jobs.map(j => j.jobId)).toEqual(states.map(s => s.id))
    expect((await host.read()).stations.filter(s => s.job === null)).toHaveLength(20)
    expect((await db.farmWorkers.get('invented-0'))!.data.totalExp).toBe(204)
  }, 30000)
})
