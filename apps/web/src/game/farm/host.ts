// Save-facing Stable Farm port (docs/design/farm.md#persistence-boundary, T083).

import {
  assignFarmOutfit,
  applyFarmingXp,
  createInitialFarmState,
  defaultOutfitFarmingProgress,
  FARM_PLOTS_PER_SECTION,
  farmLevel,
  farmPlot,
  farmPlotId,
  farmWorkerProgress,
  harvestPlot,
  parseFarmState,
  parseInventoryStackData,
  parseItemLedgerEntry,
  plantPlot,
  plotStatus,
  unassignFarmOutfit,
  unlockedPlotCount,
  type FarmCropDefinition,
  type FarmCropId,
  type FarmHarvestMovement,
  type FarmPlotId,
  type FarmPlotStatus,
  type FarmState,
  type InventoryStackData,
  type ItemLedgerEntry,
  type OutfitFarmingProgress,
} from '@racer/domain'
import { db, type FarmRow } from '../db'
import { queueInTransaction } from '../persistence'

export interface FarmPlotView {
  id: FarmPlotId
  status: FarmPlotStatus
  templateId: string | null
  lastCropId: FarmCropId | null
  cycle: FarmState['plots'][number]['cycle']
}

export interface FarmView {
  version: number
  state: FarmState
  farmLevel: number
  /** Plots this Farm Level has opened, in order (D234). */
  unlockedPlots: number
  /** Every plot of each Section with an open plot, then the next Section's six, in order. */
  plots: FarmPlotView[]
  workers: Record<string, OutfitFarmingProgress>
  inventory: Record<string, number>
}

export interface FarmHarvestReceipt {
  cycleId: string
  itemId: FarmCropId
  quantity: number
  templateId: string
  outfitLevel: number
  farmLevel: number
  alreadyHarvested: boolean
  farm: FarmView
}

export class FarmConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Farm changed on another screen or device; reload its current state')
    this.name = 'FarmConflictError'
  }
}

export interface FarmHost {
  getFarm(): Promise<FarmView>
  assign(input: { plotId: FarmPlotId; templateId: string; expectedFarmVersion: number }): Promise<FarmView>
  unassign(input: { plotId: FarmPlotId; expectedFarmVersion: number }): Promise<FarmView>
  plant(input: { plotId: FarmPlotId; cropId: FarmCropId; expectedFarmVersion: number }): Promise<FarmView>
  harvest(input: { plotId: FarmPlotId; cycleId: string; expectedFarmVersion: number }): Promise<FarmHarvestReceipt>
}

export interface PersistentFarmHostOptions {
  now?: () => number
  afterMutation?: () => void | Promise<void>
  /** Test-only transaction fault hook; throwing rolls back the complete command. */
  afterWrite?: (boundary: string) => void
}

const cloneFarm = (farm: FarmState): FarmState => ({
  ...farm,
  plots: farm.plots.map((plot) => ({ ...plot, cycle: plot.cycle ? { ...plot.cycle } : null })),
  workers: Object.fromEntries(Object.entries(farm.workers).map(([id, value]) => [id, { ...value }])),
})

const validVersion = (value: number): boolean => Number.isSafeInteger(value) && value >= 0

/** Every Section with an open plot, plus the next one so its unlock is in view (D234). */
export const visibleFarmPlotCount = (unlockedPlots: number): number =>
  FARM_PLOTS_PER_SECTION * (Math.ceil(unlockedPlots / FARM_PLOTS_PER_SECTION) + 1)

function plotViews(farm: FarmState, now: number): Pick<FarmView, 'farmLevel' | 'unlockedPlots' | 'plots'> {
  const level = farmLevel(farm.workers)
  const unlockedPlots = unlockedPlotCount(level)
  const plots = Array.from({ length: visibleFarmPlotCount(unlockedPlots) }, (_, index) => {
    const plot = farmPlot(farm, farmPlotId(index + 1))
    return { id: plot.id, status: plotStatus(farm, plot.id, now), templateId: plot.templateId, lastCropId: plot.lastCropId,
      cycle: plot.cycle ? { ...plot.cycle } : null }
  })
  return { farmLevel: level, unlockedPlots, plots }
}

async function loadCrop(id: FarmCropId): Promise<FarmCropDefinition> {
  const { farmCropById } = await import('@racer/domain/farm')
  const crop = farmCropById(id)
  if (!crop) throw new Error(`Farm crop is unknown: ${id}`)
  return crop
}

function requireExpected(row: FarmRow, expected: number): void {
  if (!validVersion(expected)) throw new Error('Expected Farm version is invalid')
  if (row.revision !== expected) throw new FarmConflictError(row.revision)
}

function parseFarmRow(row: FarmRow | undefined): FarmRow | null {
  if (!row) return null
  const farm = parseFarmState(row.data)
  if (!farm || row.id !== 'main' || !validVersion(row.version) || !validVersion(row.revision)) {
    throw new Error('Local Farm row is invalid')
  }
  return { ...row, data: farm }
}

async function ownedTemplateIds(): Promise<Set<string>> {
  return new Set((await db.umas.toArray()).map((row) => row.id))
}

async function viewFromRow(row: FarmRow, now: number): Promise<FarmView> {
  const farm = cloneFarm(row.data)
  const owned = await ownedTemplateIds()
  const inventory: Record<string, number> = {}
  for (const itemRow of await db.items.toArray()) {
    const item = parseInventoryStackData(itemRow.data, itemRow.id)
    if (!item) throw new Error(`Local item stack is invalid: ${itemRow.id}`)
    inventory[item.itemId] = item.quantity
  }
  const workers = Object.fromEntries([...owned].sort().map((id) => [id, farmWorkerProgress(farm, id)]))
  return { version: row.revision, state: farm, ...plotViews(farm, now), workers, inventory }
}

async function historicalReceiptProjection(target: FarmHarvestMovement): Promise<{
  quantity: number
  outfitLevel: number
  farmLevel: number
}> {
  const entries = (await db.itemLedger.toArray()).map((row) => {
    const entry = parseItemLedgerEntry(row.data)
    if (!entry || entry.id !== row.id || entry.createdAt !== row.createdAt) throw new Error(`Local item ledger is invalid: ${row.id}`)
    return entry
  }).sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))
  let quantity = 0
  const workers = new Map<string, OutfitFarmingProgress>()
  let found = false
  for (const entry of entries) {
    if (entry.itemId === target.itemId) quantity += entry.delta
    if (entry.reason === 'farm-harvest') {
      workers.set(entry.source.templateId, applyFarmingXp(
        workers.get(entry.source.templateId) ?? defaultOutfitFarmingProgress(),
        entry.source.farmingExp,
      ).progress)
    }
    if (entry.id === target.id) {
      found = true
      break
    }
  }
  if (!found || quantity < 0) throw new Error(`Farm harvest evidence cannot be replayed: ${target.id}`)
  const workerRecord = Object.fromEntries(workers)
  return {
    quantity,
    outfitLevel: workers.get(target.source.templateId)?.level ?? 1,
    farmLevel: farmLevel(workerRecord),
  }
}

export class PersistentFarmHost implements FarmHost {
  private readonly clock: () => number
  private readonly afterMutation: () => void | Promise<void>
  private readonly afterWrite: (boundary: string) => void

  constructor(options: PersistentFarmHostOptions = {}) {
    this.clock = options.now ?? (() => Date.now())
    this.afterMutation = options.afterMutation ?? (() => undefined)
    this.afterWrite = options.afterWrite ?? (() => undefined)
  }

  private now(): number {
    const now = this.clock()
    if (!Number.isSafeInteger(now) || now < 0) throw new Error('Farm clock is invalid')
    return now
  }

  private async ensureFarm(now: number): Promise<FarmRow> {
    const existing = parseFarmRow(await db.farm.get('main'))
    if (existing) return existing
    const row: FarmRow = { id: 'main', data: createInitialFarmState(), version: 0, revision: 0 }
    await db.transaction('rw', [db.farm, db.outbox], async () => {
      const raced = parseFarmRow(await db.farm.get('main'))
      if (raced) return
      await db.farm.put(row)
      await queueInTransaction('farm', 'main', 'upsert', now)
    })
    await this.afterMutation()
    return parseFarmRow(await db.farm.get('main')) ?? row
  }

  async getFarm(): Promise<FarmView> {
    const now = this.now()
    return viewFromRow(await this.ensureFarm(now), now)
  }

  private async changeAssignment(
    input: { plotId: FarmPlotId; expectedFarmVersion: number },
    templateId: string | null,
  ): Promise<FarmView> {
    const now = this.now()
    await this.ensureFarm(now)
    const row = await db.transaction('rw', [db.farm, db.umas, db.outbox], async () => {
      const current = parseFarmRow(await db.farm.get('main'))
      if (!current) throw new Error('Farm is missing')
      requireExpected(current, input.expectedFarmVersion)
      const owned = await ownedTemplateIds()
      const next = templateId === null
        ? unassignFarmOutfit(current.data, input.plotId)
        : assignFarmOutfit(current.data, input.plotId, templateId, owned)
      if (JSON.stringify(next) === JSON.stringify(current.data)) return current
      const updated = { ...current, data: next, revision: current.revision + 1 }
      await db.farm.put(updated)
      await queueInTransaction('farm', 'main', 'upsert', now)
      return updated
    })
    await this.afterMutation()
    return viewFromRow(row, now)
  }

  assign(input: { plotId: FarmPlotId; templateId: string; expectedFarmVersion: number }): Promise<FarmView> {
    return this.changeAssignment(input, input.templateId)
  }

  unassign(input: { plotId: FarmPlotId; expectedFarmVersion: number }): Promise<FarmView> {
    return this.changeAssignment(input, null)
  }

  async plant(input: { plotId: FarmPlotId; cropId: FarmCropId; expectedFarmVersion: number }): Promise<FarmView> {
    const crop = await loadCrop(input.cropId)
    const now = this.now()
    await this.ensureFarm(now)
    const row = await db.transaction('rw', [db.farm, db.umas, db.outbox], async () => {
      const current = parseFarmRow(await db.farm.get('main'))
      if (!current) throw new Error('Farm is missing')
      requireExpected(current, input.expectedFarmVersion)
      const planted = plantPlot({ farm: current.data, plotId: input.plotId, crop, ownedTemplateIds: await ownedTemplateIds(), now })
      const updated = { ...current, data: planted.farm, revision: current.revision + 1 }
      await db.farm.put(updated)
      await queueInTransaction('farm', 'main', 'upsert', now)
      return updated
    })
    await this.afterMutation()
    return viewFromRow(row, now)
  }

  async harvest(input: { plotId: FarmPlotId; cycleId: string; expectedFarmVersion: number }): Promise<FarmHarvestReceipt> {
    const now = this.now()
    await this.ensureFarm(now)
    const existingRaw = await db.itemLedger.get(input.cycleId)
    const existing = existingRaw ? parseItemLedgerEntry(existingRaw.data) : null
    let cropId: FarmCropId
    if (existing?.reason === 'farm-harvest') cropId = existing.itemId
    else {
      const current = parseFarmRow(await db.farm.get('main'))
      const cycle = current ? farmPlot(current.data, input.plotId).cycle : null
      if (!cycle || cycle.id !== input.cycleId) throw new Error('Farm cycle changed or is missing')
      cropId = cycle.cropId
    }
    const crop = await loadCrop(cropId)

    const receipt = await db.transaction('rw', [db.farm, db.items, db.itemLedger, db.outbox], async () => {
      const current = parseFarmRow(await db.farm.get('main'))
      if (!current) throw new Error('Farm is missing')
      const evidenceRow = await db.itemLedger.get(input.cycleId)
      if (evidenceRow) {
        const evidence = parseItemLedgerEntry(evidenceRow.data)
        if (!evidence || evidence.reason !== 'farm-harvest' || evidence.id !== input.cycleId ||
          evidence.source.plotId !== input.plotId || evidence.itemId !== crop.id || evidence.createdAt !== evidenceRow.createdAt) {
          throw new Error(`Farm harvest evidence is corrupt: ${input.cycleId}`)
        }
        const stack = parseInventoryStackData((await db.items.get(evidence.itemId))?.data, evidence.itemId)
        if (!stack) throw new Error(`Farm harvest stack is missing: ${evidence.itemId}`)
        return { current, evidence, stack, alreadyHarvested: true }
      }
      requireExpected(current, input.expectedFarmVersion)
      const result = harvestPlot({ farm: current.data, plotId: input.plotId, cycleId: input.cycleId, crop, now })
      const existingStackRow = await db.items.get(result.movement.itemId)
      const existingStack = existingStackRow
        ? parseInventoryStackData(existingStackRow.data, result.movement.itemId)
        : { itemId: result.movement.itemId, quantity: 0, updatedAt: 0 }
      if (!existingStack) throw new Error(`Local item stack is invalid: ${result.movement.itemId}`)
      const quantity = existingStack.quantity + result.movement.delta
      if (!Number.isSafeInteger(quantity)) throw new Error('Farm item quantity overflow')
      const stack: InventoryStackData = { itemId: result.movement.itemId, quantity, updatedAt: now }
      const updated = { ...current, data: result.farm, revision: current.revision + 1 }

      await db.farm.put(updated)
      this.afterWrite('farm')
      await db.items.put({ id: stack.itemId, data: stack, version: existingStackRow?.version ?? 0 })
      this.afterWrite('items')
      await db.itemLedger.add({ id: result.movement.id, data: result.movement, createdAt: result.movement.createdAt })
      this.afterWrite('itemLedger')
      await queueInTransaction('farm', 'main', 'upsert', now)
      await queueInTransaction('items', stack.itemId, 'upsert', now)
      await queueInTransaction('itemLedger', result.movement.id, 'append', now)
      this.afterWrite('outbox')
      return { current: updated, evidence: result.movement, stack, alreadyHarvested: false }
    })
    await this.afterMutation()
    const farm = await viewFromRow(receipt.current, now)
    const historical = await historicalReceiptProjection(receipt.evidence)
    return {
      cycleId: receipt.evidence.id,
      itemId: receipt.evidence.itemId,
      quantity: historical.quantity,
      templateId: receipt.evidence.source.templateId,
      outfitLevel: historical.outfitLevel,
      farmLevel: historical.farmLevel,
      alreadyHarvested: receipt.alreadyHarvested,
      farm,
    }
  }
}

function matchingMovement(left: FarmHarvestMovement, right: FarmHarvestMovement): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/** IndexedDB-unavailable fallback. It keeps the same command semantics for the current session and is labeled upstream. */
export class MemoryFarmHost implements FarmHost {
  private farm = createInitialFarmState()
  private version = 0
  private readonly inventory = new Map<string, number>()
  private readonly evidence = new Map<string, FarmHarvestMovement>()

  constructor(private readonly owned: ReadonlySet<string>, private readonly clock: () => number = () => Date.now()) {}

  private view(now = this.clock()): FarmView {
    const state = cloneFarm(this.farm)
    return {
      version: this.version,
      state,
      ...plotViews(state, now),
      workers: Object.fromEntries([...this.owned].sort().map((id) => [id, farmWorkerProgress(state, id)])),
      inventory: Object.fromEntries(this.inventory),
    }
  }

  async getFarm(): Promise<FarmView> { return this.view() }

  private expected(value: number): void { if (value !== this.version) throw new FarmConflictError(this.version) }

  async assign(input: { plotId: FarmPlotId; templateId: string; expectedFarmVersion: number }): Promise<FarmView> {
    this.expected(input.expectedFarmVersion)
    this.farm = assignFarmOutfit(this.farm, input.plotId, input.templateId, this.owned)
    this.version += 1
    return this.view()
  }

  async unassign(input: { plotId: FarmPlotId; expectedFarmVersion: number }): Promise<FarmView> {
    this.expected(input.expectedFarmVersion)
    this.farm = unassignFarmOutfit(this.farm, input.plotId)
    this.version += 1
    return this.view()
  }

  async plant(input: { plotId: FarmPlotId; cropId: FarmCropId; expectedFarmVersion: number }): Promise<FarmView> {
    this.expected(input.expectedFarmVersion)
    const result = plantPlot({ farm: this.farm, plotId: input.plotId, crop: await loadCrop(input.cropId), ownedTemplateIds: this.owned, now: this.clock() })
    this.farm = result.farm
    this.version += 1
    return this.view()
  }

  async harvest(input: { plotId: FarmPlotId; cycleId: string; expectedFarmVersion: number }): Promise<FarmHarvestReceipt> {
    const prior = this.evidence.get(input.cycleId)
    if (prior) {
      if (prior.source.plotId !== input.plotId) throw new Error(`Farm harvest evidence is corrupt: ${input.cycleId}`)
      const farm = this.view()
      return { cycleId: prior.id, itemId: prior.itemId, quantity: this.inventory.get(prior.itemId) ?? 0,
        templateId: prior.source.templateId, outfitLevel: farm.workers[prior.source.templateId]?.level ?? 1,
        farmLevel: farm.farmLevel, alreadyHarvested: true, farm }
    }
    this.expected(input.expectedFarmVersion)
    const cycle = farmPlot(this.farm, input.plotId).cycle
    if (!cycle || cycle.id !== input.cycleId) throw new Error('Farm cycle changed or is missing')
    const result = harvestPlot({ farm: this.farm, plotId: input.plotId, cycleId: input.cycleId,
      crop: await loadCrop(cycle.cropId), now: this.clock() })
    const stored = this.evidence.get(result.movement.id)
    if (stored && !matchingMovement(stored, result.movement)) throw new Error(`Farm harvest evidence is corrupt: ${input.cycleId}`)
    this.farm = result.farm
    this.evidence.set(result.movement.id, result.movement)
    this.inventory.set(result.movement.itemId, (this.inventory.get(result.movement.itemId) ?? 0) + result.movement.delta)
    this.version += 1
    const farm = this.view()
    return { cycleId: result.movement.id, itemId: result.movement.itemId,
      quantity: this.inventory.get(result.movement.itemId)!, templateId: result.movement.source.templateId,
      outfitLevel: farm.workers[result.movement.source.templateId]?.level ?? 1, farmLevel: farm.farmLevel,
      alreadyHarvested: false, farm }
  }
}

const unavailableHost: FarmHost = {
  async getFarm() { throw new Error('Farm save host is not ready') },
  async assign() { throw new Error('Farm save host is not ready') },
  async unassign() { throw new Error('Farm save host is not ready') },
  async plant() { throw new Error('Farm save host is not ready') },
  async harvest() { throw new Error('Farm save host is not ready') },
}

let installedHost: FarmHost = unavailableHost

export function installFarmHost(host: FarmHost): () => void {
  installedHost = host
  return () => { if (installedHost === host) installedHost = unavailableHost }
}

export const getFarmHost = (): FarmHost => installedHost
