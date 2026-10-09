// Real durable Farm kitchen port, outside MinigameHost. See implementation §§4,6–7.
import { createFarmOperation, farmOperationReferences, parseFarmOperationReceipt, farmCanonical, farmSafeId, parseFarmPayload, FARM_CUTOVER_GENERATION, FARM_KITCHEN_ENERGY_MS, FARM_KITCHEN_CATALOGUE,
  type FarmPayloadV1, type FarmOperationReceiptV1, type FarmOperationV1 } from '@racer/domain/farm/kitchen'
import type { RacerDb } from '../../db'
import { FarmOperationCoordinator, farmTransactionTables, readFarmPending, readFarmCanonical, farmWriterDependencies } from './operations'
import { assertFarmViewRevision, readFarmKitchenView, type FarmKitchenReadInput, type FarmKitchenView, type FarmViewRevision } from './view'
import { prepareFarmCutoverOnce, exportFarmCutoverRecovery, type FarmCutoverPorts } from './cutover'
import { FARM_KITCHEN_RELEASE_ENABLED } from './capability'
import { criticalGameplayAction } from '../../../app/update-lifecycle'
import { exportFarmDeviceRecovery } from './recovery'

export interface FarmIntent { intentId: string; expectedRevision: FarmViewRevision; dependencies?: string[] }
type Input<K extends FarmPayloadV1['kind']> = FarmIntent & Omit<Extract<FarmPayloadV1, { kind: K }>, 'kind'>
export interface FarmMutation {
  operationId: string; status: 'pending' | 'applied' | 'duplicate' | 'rejected' | 'blocked'; reason: string | null
  receipt: FarmOperationReceiptV1 | null; prediction: FarmOperationReceiptV1 | null; celebrate: boolean; view: FarmKitchenView
}
export interface FarmCollectResult {
  intentId: string; succeeded: number; pending: number; failed: number
  jobs: Array<{ stationId: string; jobId: string; name: string; operationId: string; status: FarmMutation['status']; reason: string | null }>
  view: FarmKitchenView
}
export interface FarmKitchenHost {
  read(input?: FarmKitchenReadInput): Promise<FarmKitchenView>
  /** Explicit confirmation setup only; reading a screen never reserves a new ID. */
  createIntent(): Promise<string>
  assign(input: Input<'assign'>): Promise<FarmMutation>
  remove(input: Input<'remove'>): Promise<FarmMutation>
  start(input: Input<'start'>): Promise<FarmMutation>
  claim(input: Input<'claim'> | Input<'claim-legacy'>): Promise<FarmMutation>
  collectAll(input: FarmIntent): Promise<FarmCollectResult>
  spendEnergy(input: Input<'energy'> & { confirmedWastedMs: number }): Promise<FarmMutation>
  grantEnergy(input: FarmIntent & { ownerDebugConfirmed: true }): Promise<FarmMutation>
  buyNode(input: Input<'buy-node'>): Promise<FarmMutation>
  setActive(input: Input<'set-active'>): Promise<FarmMutation>
  retry(input: { operationId: string; action?: 'retry' | 'discard' }): Promise<FarmMutation | null>
  prepareUpgrade(): Promise<boolean>
  exportRecovery(): Promise<void>
}
export interface FarmKitchenHostOptions {
  database: RacerDb; enabled?: boolean; clock?: () => number; current?: () => boolean; persistent?: () => boolean
  schedule?: () => void; publish?: (view: FarmKitchenView) => void | Promise<void>; afterWrite?: (boundary: string) => void
  ownerDebugAllowed?: () => boolean; cutover?: FarmCutoverPorts | (() => Promise<FarmCutoverPorts>)
  /** Explicit recovery only. Sends the immutable command to the same semantic repository; never a fresh ID. */
  recover?: (operations: FarmOperationV1[]) => Promise<unknown>
}
const payload = <K extends FarmPayloadV1['kind']>(kind: K, input: Input<K>): FarmPayloadV1 => {
  const { intentId: _id, expectedRevision: _revision, dependencies: _dependencies, ...fields } = input
  const parsed = parseFarmPayload({ kind, ...fields })
  if (!parsed) throw new Error('Invalid Farm choice; no command was queued')
  return parsed
}
interface CollectManifest {
  type: 'collect'; intentId: string; jobs: Array<{ payload: Extract<FarmPayloadV1, { kind: 'claim' | 'claim-legacy' }>; operationId: string; name: string }>
}
export class PersistentFarmKitchenHost implements FarmKitchenHost {
  readonly coordinator: FarmOperationCoordinator
  private readonly enabled: boolean
  constructor(private readonly options: FarmKitchenHostOptions) {
    this.enabled = options.enabled ?? FARM_KITCHEN_RELEASE_ENABLED
    this.coordinator = new FarmOperationCoordinator(options.database, () => options.schedule?.(), this.enabled, options.afterWrite)
  }
  private now(): number {
    const now = (this.options.clock ?? Date.now)()
    if (!Number.isSafeInteger(now) || now < 0) throw new Error('Farm clock is invalid')
    return now
  }
  private available(): void {
    if (this.options.current?.() === false) throw new Error('Farm account changed; reload before acting')
    if (this.options.persistent?.() === false || !this.options.database.isOpen()) throw new Error('Persistent Farm storage is unavailable; recover the save, no craft was started')
  }
  async read(input?: FarmKitchenReadInput): Promise<FarmKitchenView> {
    this.available()
    return readFarmKitchenView(this.options.database, this.coordinator, this.enabled, this.now(), input)
  }
  async createIntent(): Promise<string> {
    this.available()
    const db = this.options.database
    if (!this.enabled) throw new Error('Farm kitchen release is disabled')
    const control = await db.farmCutover.get('main')
    if (control?.data.phase !== 'active' || control.data.generation !== FARM_CUTOVER_GENERATION) throw new Error('Farm upgrade must finish in a compatible app before acting')
    return db.transaction('rw', db.farmPreferences, async () => {
      const prior = await db.farmPreferences.get('device-id')
      if (prior && (typeof prior.value !== 'string' || !farmSafeId(prior.value))) throw new Error('Farm device identity needs recovery')
      const deviceId = prior?.value as string | undefined ?? crypto.randomUUID()
      if (!prior) await db.farmPreferences.add({ id: 'device-id', value: deviceId })
      return this.coordinator.reserveOperationId(deviceId)
    })
  }
  private async publish(input?: FarmKitchenReadInput): Promise<FarmKitchenView> {
    const view = await this.read(input)
    if (this.options.current?.() !== false) await this.options.publish?.(view)
    return view
  }
  private async result(id: string, duplicate = false): Promise<FarmMutation> {
    const db = this.options.database, row = await db.farmOperations.get(id), pending = await db.farmPending.get(id)
    const receipt = row ? parseFarmOperationReceipt(row.data) : null
    if (row && (!receipt || receipt.operation.operationId !== id)) throw new Error('Farm receipt needs recovery')
    if (!receipt && !pending) throw new Error('Farm intent is missing; retain recovery and reload')
    const p = (receipt?.operation ?? pending!.operation).payload
    const view = await this.publish({ ...('outfitId' in p ? { outfitId: p.outfitId } : {}), ...('scenarioId' in p ? { scenarioId: p.scenarioId } : {}), operationIds: receipt ? [id] : [] })
    return { operationId: id, status: receipt ? duplicate ? 'duplicate' : 'applied' : pending!.status, reason: pending?.reason ?? null,
      receipt, prediction: pending?.status === 'pending' ? pending.prediction : null, celebrate: !!receipt && !duplicate && !receipt.reusedTarget, view }
  }
  private async mutate(input: FarmIntent, choice: FarmPayloadV1, wasted?: number): Promise<FarmMutation> {
    return criticalGameplayAction(() => this.mutateInAction(input, choice, wasted))
  }
  private async mutateInAction(input: FarmIntent, choice: FarmPayloadV1, wasted?: number): Promise<FarmMutation> {
    this.available()
    const db = this.options.database, now = this.now()
    const duplicate = await db.transaction('rw', farmTransactionTables(db), async () => {
      if (this.options.current?.() === false) throw new Error('Farm account changed')
      const previous = await db.farmPending.get(input.intentId), accepted = await db.farmOperations.get(input.intentId)
      const prior = previous?.operation ?? (accepted ? parseFarmOperationReceipt(accepted.data)?.operation : null)
      if (prior) {
        if (farmCanonical(prior.payload) !== farmCanonical(choice) || farmCanonical(prior.dependencies) !== farmCanonical(input.dependencies ?? []))
          throw new Error('Farm intent reused with different choices; confirm a new intent')
        return !!accepted // Keep the old clock/version/bytes even when the screen has changed.
      }
      if (!this.enabled) throw new Error('Farm kitchen release is disabled')
      const device = (await db.farmPreferences.get('device-id'))?.value
      const sequence = (await db.farmPreferences.get(`sequence:${String(device)}`))?.value
      const prefix = `fop:${String(device)}:`, n = Number(input.intentId.slice(prefix.length))
      if (!input.intentId.startsWith(prefix) || !Number.isSafeInteger(n) || n < 1 || typeof sequence !== 'number' || n > sequence)
        throw new Error('Reserve a durable Farm intent before confirmation')
      const control = await db.farmCutover.get('main')
      if (control?.data.phase !== 'active' || control.data.generation !== FARM_CUTOVER_GENERATION) throw new Error('Farm upgrade must finish in a compatible app before acting')
      const provisional = createFarmOperation({ schemaVersion: 1, generation: String(control.data.generation), operationId: input.intentId,
        now, expected: [], dependencies: input.dependencies ?? [], payload: choice })
      const refs = farmOperationReferences(provisional), state = await this.coordinator.overlayInTransaction(refs)
      const rows = await readFarmPending(db)
      // Compare canonical versions: projected revisions are represented by the exact ordered pending fingerprint.
      const canonical = await readFarmCanonical(db, refs)
      assertFarmViewRevision(input.expectedRevision, provisional.generation, canonical.entities, rows, refs.entities)
      if (wasted !== undefined && choice.kind === 'energy') {
        const farm = state.entities.get('farm/main')?.data, stations = farm?.stations as Array<{ job: { id: string; readyAt: number } | null }> | undefined
        const job = stations?.find(s => s.job?.id === choice.jobId)?.job
        const actual = job ? Math.max(0, FARM_KITCHEN_ENERGY_MS - Math.max(0, job.readyAt - now)) : -1
        if (!job || Math.ceil(actual / 60000) !== Math.ceil(wasted / 60000))
          throw new Error('Energy waiting time changed; review the wasted minutes and confirm again')
      }
      await this.coordinator.enqueueInTransaction(choice, input.intentId, input.dependencies ?? [], now)
      return false
    })
    this.options.schedule?.()
    return this.result(input.intentId, duplicate)
  }
  /** A confirmed Collect manifest already freezes the target job. Queue just its exact authority, not30 roster joins. */
  private async collectJob(job: CollectManifest['jobs'][number]): Promise<Pick<FarmMutation, 'status' | 'reason'>> {
    const db = this.options.database, prior = await db.farmPending.get(job.operationId), accepted = await db.farmOperations.get(job.operationId)
    if (accepted) {
      const receipt = parseFarmOperationReceipt(accepted.data)
      if (!receipt || farmCanonical(receipt.operation.payload) !== farmCanonical(job.payload)) throw new Error('Collect receipt changed; export recovery')
      return { status: 'duplicate', reason: null }
    }
    if (prior) {
      if (farmCanonical(prior.operation.payload) !== farmCanonical(job.payload)) throw new Error('Collect intent changed; export recovery')
      if (prior.status !== 'pending') {
        if (!this.enabled || !this.options.recover) return { status: prior.status, reason: prior.reason }
        const reply = await this.options.recover([prior.operation])
        this.available()
        await this.coordinator.adopt([prior.operation], reply, this.now())
        if (await db.farmOperations.get(job.operationId)) return { status: 'duplicate', reason: null }
      } else await db.transaction('rw', db.outbox, db.farmPending, async () => {
        if ((await db.farmPending.get(job.operationId))?.status === 'pending' && !await db.outbox.where('[kind+id]').equals(['farmOperations', job.operationId]).count())
          await db.outbox.add({ kind: 'farmOperations', id: job.operationId, op: 'farm', queuedAt: prior.queuedAt })
      })
      const current = await db.farmPending.get(job.operationId)
      return { status: current?.status ?? 'pending', reason: current?.reason ?? null }
    }
    await criticalGameplayAction(async () => db.transaction('rw', farmTransactionTables(db), async () => {
      this.available()
      const control = await db.farmCutover.get('main')
      if (!this.enabled || control?.data.phase !== 'active' || control.data.generation !== FARM_CUTOVER_GENERATION) throw new Error('Farm requires a compatible active release')
      const now = this.now(), provisional = createFarmOperation({ schemaVersion: 1, generation: String(control.data.generation),
        operationId: job.operationId, now, expected: [], dependencies: [], payload: job.payload })
      const rows = await readFarmPending(db), dependencies = farmWriterDependencies(rows, farmOperationReferences(provisional))
      await this.coordinator.enqueueInTransaction(job.payload, job.operationId, dependencies, now)
    }))
    this.options.schedule?.()
    return { status: 'pending', reason: null }
  }
  async assign(input: Input<'assign'>) { return this.mutate(input, payload('assign', input)) }
  async remove(input: Input<'remove'>) { return this.mutate(input, payload('remove', input)) }
  async start(input: Input<'start'>) { return this.mutate(input, payload('start', input)) }
  async claim(input: Input<'claim'> | Input<'claim-legacy'>) { return this.mutate(input, 'cycleId' in input ? payload('claim-legacy', input) : payload('claim', input)) }
  async spendEnergy(input: Input<'energy'> & { confirmedWastedMs: number }) {
    const { confirmedWastedMs, ...command } = input
    if (!Number.isSafeInteger(confirmedWastedMs) || confirmedWastedMs < 0 || confirmedWastedMs > FARM_KITCHEN_ENERGY_MS) throw new Error('Confirm Energy waste before spending')
    return this.mutate(command, payload('energy', command), confirmedWastedMs)
  }
  async grantEnergy(input: FarmIntent & { ownerDebugConfirmed: true }) {
    if (input.ownerDebugConfirmed !== true || !this.options.ownerDebugAllowed?.()) throw new Error('Farm Energy grants are owner playtesting only')
    return this.mutate(input, { kind: 'grant-energy' })
  }
  async buyNode(input: Input<'buy-node'>) { return this.mutate(input, payload('buy-node', input)) }
  async setActive(input: Input<'set-active'>) { return this.mutate(input, payload('set-active', input)) }
  async retry({ operationId, action = 'retry' }: { operationId: string; action?: 'retry' | 'discard' }): Promise<FarmMutation | null> {
    this.available()
    const db = this.options.database, accepted = await db.farmOperations.get(operationId)
    if (accepted) {
      if (action === 'discard') throw new Error('An accepted Farm job cannot be discarded')
      return this.result(operationId, true)
    }
    const row = await db.farmPending.get(operationId)
    if (!row) throw new Error('Farm intent is missing; export recovery')
    if (!this.enabled) throw new Error('This Farm generation is read-only until a compatible release; export recovery')
    if (action === 'discard') {
      await db.transaction('rw', farmTransactionTables(db), async () => {
        const proof = await db.farmRecovery.get(operationId)
        if (await db.farmOperations.get(operationId) || row.status === 'pending' || !proof ||
          farmCanonical(proof.data) !== farmCanonical({ operation: row.operation, nonaccepted: true }))
          throw new Error('Discard needs explicit canonical nonacceptance; uncertain requests must Retry unchanged')
        if ((await readFarmPending(db)).some(r => r.operation.dependencies.includes(operationId))) throw new Error('Recover dependent Farm intents before discarding this one')
        await db.farmPending.delete(operationId)
        await db.outbox.where('[kind+id]').equals(['farmOperations', operationId]).delete()
        // Keep the immutable recovery proof/payload for export, rather than erasing evidence.
      })
      await this.publish(); return null
    }
    if (row.status !== 'pending') {
      if (!this.enabled || !this.options.recover) throw new Error('Reconnect for a canonical Retry; review and confirm fresh choices separately')
      const reply = await this.options.recover([row.operation])
      if (this.options.current?.() === false) throw new Error('Account changed during Farm recovery')
      await this.coordinator.adopt([row.operation], reply, this.now())
    } else {
      await db.transaction('rw', db.outbox, db.farmPending, async () => {
        if ((await db.farmPending.get(operationId))?.status === 'pending' && !await db.outbox.where('[kind+id]').equals(['farmOperations', operationId]).count())
          await db.outbox.add({ kind: 'farmOperations', id: operationId, op: 'farm', queuedAt: row.queuedAt })
      })
      this.options.schedule?.()
    }
    return this.result(operationId, true)
  }
  async collectAll(input: FarmIntent): Promise<FarmCollectResult> {
    this.available()
    const db = this.options.database, key = `collect:${input.intentId}`
    if (!this.enabled) throw new Error('This Farm generation is read-only until a compatible release')
    let manifest: CollectManifest
    const old = await db.farmRecovery.get(key)
    if (old) {
      const v = old.data as CollectManifest
      if (!v || Object.keys(v).sort().join() !== 'intentId,jobs,type' || v.type !== 'collect' || v.intentId !== input.intentId || !Array.isArray(v.jobs) || v.jobs.length > 30 ||
        new Set(v.jobs.map(j => j.operationId)).size !== v.jobs.length ||
        v.jobs.some(j => !farmSafeId(j.operationId) || !parseFarmPayload(j.payload) || !['claim', 'claim-legacy'].includes(j.payload.kind) || typeof j.name !== 'string'))
        throw new Error('Collect snapshot needs recovery')
      manifest = v
    } else {
      // Capture readiness once with stable per-job operation IDs. Retry never collects a subsequently started job.
      const view = await this.read()
      if (view.mode !== 'active' || farmCanonical(view.revision) !== farmCanonical(input.expectedRevision)) throw new Error('Farm changed; review Collect all again')
      manifest = await db.transaction('rw', farmTransactionTables(db), async () => {
        const device = (await db.farmPreferences.get('device-id'))?.value, prefix = `fop:${String(device)}:`, n = Number(input.intentId.slice(prefix.length))
        const reserved = (await db.farmPreferences.get(`sequence:${String(device)}`))?.value
        if (!input.intentId.startsWith(prefix) || !Number.isSafeInteger(n) || n < 1 || typeof reserved !== 'number' || n > reserved)
          throw new Error('Reserve a durable Collect intent before confirmation')
        const raced = await db.farmRecovery.get(key)
        if (raced) return raced.data as CollectManifest
        const latest = await this.read()
        if (farmCanonical(latest.revision) !== farmCanonical(view.revision)) throw new Error('Farm changed before Collect all; reload')
        const jobs: CollectManifest['jobs'] = []
        for (const station of view.stations.filter(s => s.status === 'ready')) {
          const job = station.job, legacy = station.legacy
          const p: CollectManifest['jobs'][number]['payload'] = job ? { kind: 'claim', stationId: station.id, outfitId: job.outfitId, jobId: job.id, recipeId: job.recipeId }
            : { kind: 'claim-legacy', stationId: station.id, outfitId: legacy!.outfitId!, cycleId: legacy!.cycle!.id, cropId: legacy!.cycle!.cropId }
          jobs.push({ payload: p, operationId: await this.createIntent(), name: job ? FARM_KITCHEN_CATALOGUE.recipesById.get(job.recipeId)!.name : 'Legacy crop' })
        }
        const value: CollectManifest = { type: 'collect', intentId: input.intentId, jobs }
        await db.farmRecovery.put({ id: key, reason: 'Collect all frozen ready-job snapshot', data: value, createdAt: this.now() })
        return value
      })
    }
    const results: FarmCollectResult['jobs'] = []
    for (const job of manifest.jobs) {
      const p = job.payload, jobId = 'jobId' in p ? p.jobId : p.cycleId
      try {
        const result = await this.collectJob(job)
        results.push({ stationId: p.stationId, jobId, name: job.name, operationId: job.operationId, status: result.status, reason: result.reason })
      } catch (error) {
        results.push({ stationId: p.stationId, jobId, name: job.name, operationId: job.operationId, status: 'rejected', reason: error instanceof Error ? error.message : 'Retry this frozen job' })
      }
    }
    return { intentId: input.intentId, jobs: results, succeeded: results.filter(r => r.status === 'applied' || r.status === 'duplicate').length,
      pending: results.filter(r => r.status === 'pending').length, failed: results.filter(r => r.status === 'rejected' || r.status === 'blocked').length, view: await this.publish() }
  }
  async prepareUpgrade(): Promise<boolean> {
    this.available()
    if (!this.options.cutover) throw new Error('Farm upgrade is unavailable; retain recovery')
    if (!this.enabled) return false
    const ports = typeof this.options.cutover === 'function' ? await this.options.cutover() : this.options.cutover
    return prepareFarmCutoverOnce(this.options.database, ports, this.enabled, this.now())
  }
  async exportRecovery(): Promise<void> {
    this.available()
    if (!this.options.cutover) throw new Error('Authenticated Farm recovery identity is unavailable')
    const ports = typeof this.options.cutover === 'function' ? await this.options.cutover() : this.options.cutover
    // Original verified cutover archive stays exportable. Include current unresolved intents in a second device export.
    const { readFarmCutoverRecovery } = await import('./cutover'), recovery = await readFarmCutoverRecovery(this.options.database)
    if (recovery?.archiveId) await exportFarmCutoverRecovery(this.options.database, ports.accountId)
    await exportFarmDeviceRecovery(this.options.database, ports.accountId, ports.build)
  }
}
let installed: FarmKitchenHost | null = null
export function installFarmKitchenHost(host: FarmKitchenHost): () => void {
  installed = host
  return () => { if (installed === host) installed = null }
}
export function getFarmKitchenHost(): FarmKitchenHost {
  if (!installed) throw new Error('Farm kitchen host is not ready; no production test double is installed')
  return installed
}
