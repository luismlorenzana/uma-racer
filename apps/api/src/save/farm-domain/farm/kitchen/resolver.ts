// One economic resolver for offline prediction and both API adapters (implementation §4). No I/O.
import { SCENARIOS } from '../../scenarios'
import { parseFarmHarvestMovement } from '../types'
import { FARM_KITCHEN_CATALOGUE, farmMealId } from './catalogue'
import { buyFarmExtraNode, createFarmExtraBlock, farmExtraNode, parseFarmExtraBlock, setFarmActiveNodes } from './extra-map'
import { applyFarmInventory } from './inputs'
import { parseFarmKitchenState, parseFarmKitchenWorker, parseFarmBlockRecipes } from './parsers'
import { assignFarmWorker, claimFarmJob, createFarmKitchenWorker, emptyFarmRecipes, farmStation, removeFarmWorker, spendFarmEnergy, startFarmJob } from './production'
import { farmIngredientBlock } from './progression'
import { farmExtraRowId, farmLegacyPageId, parseFarmCutoverControl, parseFarmCutoverPage } from './records'
import { FARM_KITCHEN_ENERGY_GRANT, FARM_KITCHEN_ENERGY_ID, farmSafeInteger, type FarmResult, type FarmStationId } from './rules'
import { farmCanonical, farmData, farmKey, type FarmStoredEntity, type FarmStoredLog } from './wire'
import { farmMovementId, type FarmMovementRole } from './movement'
import { farmOperationReferences, farmPurchaseIdentity, farmTargetGuardId, parseFarmOperationBatch, parseFarmOperationReceipt, parseFarmTargetGuard,
  parseFarmOperationResponses, type FarmChange, type FarmOperationV1, type FarmOperationResponse, type FarmOperationReceiptV1, type FarmOperationResult } from './operations'

export interface FarmResolveContext { enabled: boolean; allowEnergyGrant?: boolean; now: number;
  entities: ReadonlyMap<string, FarmStoredEntity>; logs: ReadonlyMap<string, FarmStoredLog> }
function need(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message) }
function value<T>(result: FarmResult<T>): T { if (!result.ok) throw new Error(`${result.error.code}: ${result.error.detail}`); return result.value }
export function resolveFarmOperations(context: FarmResolveContext, operations: readonly FarmOperationV1[]) {
  need(farmSafeInteger(context.now) && parseFarmOperationBatch(operations), 'Invalid Farm batch or clock')
  const entities = new Map(context.entities), logs = new Map(context.logs), writes: FarmStoredEntity[] = [], appends: FarmStoredLog[] = [], responses: FarmOperationResponse[] = []
  for (const operation of operations) {
    const response = resolveOne({ ...context, entities, logs }, operation)
    responses.push(response)
    if (response.status !== 'applied') continue
    for (const change of response.receipt!.changes) { entities.set(farmKey(change.after), change.after); writes.push(change.after) }
    for (const log of response.receipt!.logs) { logs.set(farmKey(log), log); appends.push(log) }
    const receipt = { kind: 'farmOperations', id: operation.operationId, data: farmData(response.receipt!), createdAt: context.now }
    logs.set(farmKey(receipt), receipt); appends.push(receipt)
  }
  for (const response of responses) for (const row of response.authoritative) row.record = entities.get(farmKey(row)) ?? null
  // Both adapters call this before any write. An unreadable reply must never commit economic effects.
  need(parseFarmOperationResponses(responses, operations), 'Farm response exceeds bounds; retry unchanged commands in a smaller batch')
  return { responses, entities, logs, writes, appends }
}
function resolveOne(context: FarmResolveContext, operation: FarmOperationV1): FarmOperationResponse {
  const refs = farmOperationReferences(operation), authoritative = () => refs.entities.map(k => {
    const [kind, id] = k.split('/'); return { kind: kind!, id: id!, record: context.entities.get(k) ?? null }
  })
  const reject = (reason: string, blocked = false): FarmOperationResponse => ({ operationId: operation.operationId,
    status: blocked ? 'blocked' : 'rejected', receipt: null, reason: reason.slice(0, 240), authoritative: authoritative() })
  const prior = context.logs.get(`farmOperations/${operation.operationId}`)
  if (prior) {
    const receipt = parseFarmOperationReceipt(prior.data)
    if (!receipt || farmCanonical(receipt.operation) !== farmCanonical(operation)) return reject('Operation id was reused with different bytes')
    return { operationId: operation.operationId, status: 'duplicate', receipt, reason: null, authoritative: authoritative() }
  }
  if (!context.enabled) return reject('Farm production is disabled until the complete release')
  for (const dependency of operation.dependencies) {
    const row = context.logs.get(`farmOperations/${dependency}`)
    if (!row) return reject(`Waiting for dependency ${dependency}`, true)
    const receipt = parseFarmOperationReceipt(row.data)
    if (!receipt || receipt.operation.generation !== operation.generation) return reject('Invalid or old-generation dependency')
  }
  try {
    const current = (kind: string, id: string) => context.entities.get(`${kind}/${id}`)
    const controlRow = current('farmCutover', 'main'), control = controlRow && !controlRow.deleted && parseFarmCutoverControl(controlRow.data)
    need(control && control.phase === 'active' && control.generation === operation.generation, 'Farm generation is not active; keep inputs for recovery')
    const puzzleControl = current('constellationBank', 'main')
    need(!puzzleControl || !puzzleControl.deleted && puzzleControl.data.phase === 'active', 'Puzzle preservation is incomplete; retry after preparation')
    const p = operation.payload, changes: FarmChange[] = [], evidence: FarmStoredLog[] = []
    let result: FarmOperationResult, reusedTarget: string | null = null
    const receipt = (): FarmOperationReceiptV1 => ({ schemaVersion: 1, type: 'operation', operation, createdAt: context.now,
      changes, logs: evidence, result, reusedTarget })
    const accepted = (): FarmOperationResponse => {
      const saved = receipt(); need(parseFarmOperationReceipt(saved), 'Invalid or oversized Farm receipt')
      return { operationId: operation.operationId, status: 'applied', receipt: saved, reason: null, authoritative: authoritative() }
    }
    const guard = (type: 'terminal' | 'purchase', targetId: string) => {
      const row = context.logs.get(`farmOperations/${farmTargetGuardId(operation.generation, type, targetId)}`)
      if (!row) return null
      const parsed = parseFarmTargetGuard(row.data)
      need(parsed && parsed.generation === operation.generation && parsed.type === type && parsed.targetId === targetId,
        'Target evidence collision or corruption; preserve for recovery')
      return parsed!
    }
    const target = p.kind === 'claim' ? p.jobId : p.kind === 'claim-legacy' ? p.cycleId : p.kind === 'buy-node'
      ? farmPurchaseIdentity(operation.generation, p.outfitId, farmIngredientBlock(SCENARIOS.find(s => s.id === p.scenarioId)!.tier), p.nodeId) : null
    need(farmCanonical(operation.expected.map(farmKey).sort()) === farmCanonical(refs.entities), 'Missing or excessive expected read references')
    if (target) {
      const previous = guard(p.kind === 'buy-node' ? 'purchase' : 'terminal', target)
      if (previous) {
        need(previous.result.kind === p.kind, 'Target result does not match this command')
        result = previous.result; reusedTarget = target
        return accepted() // Existing target result, no extra spend, XP or selected-preset activation.
      }
    }
    for (const expected of operation.expected) need(expected.version === (current(expected.kind, expected.id)?.version ?? 0),
      `${farmKey(expected)} changed; review the frozen input and retry`)
    const put = (kind: string, id: string, data: object) => {
      need(refs.entities.includes(`${kind}/${id}`), 'Farm mutation exceeded its static read set')
      const before = current(kind, id) ?? null, version = (before?.version ?? 0) + 1
      need(farmSafeInteger(version, 1), 'Entity version overflow')
      changes.push({ kind, id, before, after: { kind, id, version, data: farmData(data), deleted: false, updatedAt: context.now } })
    }
    const owned = (outfitId: string) => {
      const row = current('umas', outfitId)
      need(row && !row.deleted && row.data.templateId === outfitId && [15, 16].includes(Number(row.data.schemaVersion)), 'Outfit is unavailable or needs a save update')
      return row!
    }
    const stock = (itemId: string) => {
      const row = current('items', itemId)
      need(!row || !row.deleted && row.data.itemId === itemId && farmSafeInteger(row.data.quantity), 'Invalid inventory stack')
      return Number(row?.data.quantity ?? 0)
    }
    const inventory: Record<string, number> = {}
    for (const ref of refs.entities.filter(k => k.startsWith('items/'))) { const itemId = ref.slice(6); inventory[itemId] = stock(itemId) }
    const movement = (itemId: string, delta: number, role: FarmMovementRole, jobId: string | null = null) => {
      const id = farmMovementId(operation.operationId, itemId, role)
      need(!context.logs.has(`itemLedger/${id}`), 'Conflicting economic movement evidence')
      const quantity = stock(itemId) + delta
      need(farmSafeInteger(quantity), 'Insufficient stock or quantity overflow')
      put('items', itemId, { itemId, quantity, updatedAt: context.now })
      evidence.push({ kind: 'itemLedger', id, createdAt: context.now, data: { id, itemId, delta, reason: 'farm-command',
        source: { kind: 'farm-operation', version: 1, operationId: operation.operationId, generation: operation.generation, role, jobId }, createdAt: context.now } })
    }
    const writeGuard = (type: 'terminal' | 'purchase', targetId: string) => evidence.push({ kind: 'farmOperations',
      id: farmTargetGuardId(operation.generation, type, targetId), createdAt: context.now,
      data: { schemaVersion: 1, type, generation: operation.generation, targetId, operationId: operation.operationId, createdAt: context.now, result } })
    if (p.kind === 'grant-energy') {
      need(context.allowEnergyGrant === true, 'Farm Energy debug grants require the owner boundary')
      value(applyFarmInventory(inventory, [], [{ itemId: FARM_KITCHEN_ENERGY_ID, amount: FARM_KITCHEN_ENERGY_GRANT }]))
      movement(FARM_KITCHEN_ENERGY_ID, FARM_KITCHEN_ENERGY_GRANT, 'grant')
      result = { kind: p.kind, amount: FARM_KITCHEN_ENERGY_GRANT }
    } else if (p.kind === 'buy-node' || p.kind === 'set-active') {
      const uma = owned(p.outfitId), block = farmIngredientBlock(SCENARIOS.find(s => s.id === p.scenarioId)!.tier)
      need(Array.isArray(uma.data.scenarios), 'Invalid owned scenario units')
      const units = uma.data.scenarios as Record<string, unknown>[]
      const unlockedScenarioIds = new Set(units.map(u => SCENARIOS.find(s => s.tier === u.tier)?.id).filter((id): id is string => !!id))
      const rowId = farmExtraRowId(p.outfitId, block), raw = current('farmExtra', rowId)
      const map = raw ? !raw.deleted && parseFarmExtraBlock(raw.data) : createFarmExtraBlock(operation.generation, p.outfitId, block)
      need(map && map.generation === operation.generation, 'Farm map is corrupt or from another generation')
      const input = { map: map!, outfitId: p.outfitId, scenarioId: p.scenarioId, distance: p.distance, unlockedScenarioIds }
      if (p.kind === 'set-active') {
        const updated = value(setFarmActiveNodes({ ...input, nodeIds: p.nodeIds }))
        put('farmExtra', rowId, updated); result = { kind: p.kind, scenarioId: p.scenarioId, distance: p.distance, nodeIds: updated.activeByScenario[p.scenarioId]![p.distance] }
      } else {
        need(!map!.boughtNodeIds.includes(p.nodeId), 'A bought node is missing its purchase evidence; recover rather than spend again')
        const bought = value(buyFarmExtraNode({ ...input, nodeId: p.nodeId, autoactivate: p.autoactivate, inventory }))
        movement(farmMealId(block, bought.node.signature), -1, 'purchase'); put('farmExtra', rowId, bought.map)
        result = { kind: p.kind, purchaseId: bought.purchaseId, nodeId: p.nodeId, nodeName: bought.node.name, scenarioId: p.scenarioId,
          distance: p.distance, activated: bought.map.activeByScenario[p.scenarioId]?.[p.distance].includes(p.nodeId) ?? false }
        writeGuard('purchase', bought.purchaseId)
      }
    } else {
      const raw = current('farm', 'main'), farm = raw && !raw.deleted && parseFarmKitchenState(raw.data)
      need(farm && farm.generation === operation.generation, 'Missing or corrupt active Farm; preserve for recovery')
      const legacyRaw = current('farmCutoverPages', farmLegacyPageId(operation.generation)), page = legacyRaw && !legacyRaw.deleted && parseFarmCutoverPage(legacyRaw.data)
      need(page && page.type === 'legacy' && page.generation === operation.generation, 'Missing frozen legacy station page')
      const legacy = page!.type === 'legacy' ? page!.stations : []
      const legacyBusy = (stationId: FarmStationId) => legacy.some(s => s.stationId === stationId && s.cycle && !guard('terminal', `station:${stationId}`))
      if (p.kind === 'assign') {
        owned(p.outfitId)
        const existingWorker = current('farmWorkers', p.outfitId)
        need(!existingWorker || !existingWorker.deleted && parseFarmKitchenWorker(existingWorker.data)?.generation === operation.generation, 'Worker generation is invalid; preserve for recovery')
        const held = farm!.stations.find(s => s.outfitId === p.outfitId)
        need(!legacyBusy(p.stationId) && (!held || !legacyBusy(held.id)), 'Claim the frozen legacy job before moving workers')
        put('farm', 'main', value(assignFarmWorker(farm!, p.stationId, p.outfitId, new Set([p.outfitId]))))
        if (!current('farmWorkers', p.outfitId)) put('farmWorkers', p.outfitId, createFarmKitchenWorker(operation.generation, p.outfitId))
        result = { kind: p.kind, stationId: p.stationId, outfitId: p.outfitId }
      } else if (p.kind === 'remove') {
        need(!legacyBusy(p.stationId), 'Claim the frozen legacy job before removing its worker')
        put('farm', 'main', value(removeFarmWorker(farm!, p.stationId))); result = { kind: p.kind, stationId: p.stationId, outfitId: null }
      } else if (p.kind === 'claim-legacy') {
        owned(p.outfitId)
        const station = legacy.find(s => s.stationId === p.stationId), job = station?.cycle
        need(station?.outfitId === p.outfitId && job?.id === p.cycleId && job.cropId === p.cropId && operation.now >= job.readyAt,
          'Legacy job/worker/deadline does not match the frozen cycle')
        const historical = context.logs.get(`itemLedger/${p.cycleId}`)
        if (historical) {
          const parsed = parseFarmHarvestMovement(historical.data)
          need(parsed && parsed.itemId === p.cropId && parsed.source.templateId === p.outfitId, 'Conflicting original legacy harvest evidence')
        } else movement(p.cropId, 1, 'legacy', p.cycleId)
        result = { kind: p.kind, cycleId: p.cycleId, outfitId: p.outfitId, output: { itemId: p.cropId, amount: 1 }, expAward: 0 }
        writeGuard('terminal', p.cycleId); writeGuard('terminal', `station:${p.stationId}`)
      } else {
        owned(p.outfitId)
        const workerRaw = current('farmWorkers', p.outfitId), worker = workerRaw && !workerRaw.deleted && parseFarmKitchenWorker(workerRaw.data)
        need(worker && worker.generation === operation.generation, 'Missing or corrupt Farm worker')
        const station = farmStation(farm!, p.stationId)
        need(station.outfitId === p.outfitId && !legacyBusy(p.stationId), 'Station belongs to another worker or a frozen legacy job')
        const recipeStates = FARM_KITCHEN_CATALOGUE.blocks.map(block => {
          const row = current('farmRecipes', `b${block}`)
          if (p.kind === 'start' && block !== FARM_KITCHEN_CATALOGUE.recipesById.get(p.recipeId)!.block || p.kind === 'energy') return emptyFarmRecipes(operation.generation, block)
          const state = row ? !row.deleted && parseFarmBlockRecipes(row.data) : emptyFarmRecipes(operation.generation, block)
          need(state && state.generation === operation.generation, 'Invalid recipe milestone row'); return state!
        })
        // Owner chose existing Farm timing: PersistentFarmHost uses device time for Start/Claim (technical §4).
        // Preserve that clock in offline intent; server time stamps acknowledgement, not a new job deadline.
        const input = { farm: farm!, stationId: p.stationId, worker: worker!, ownedOutfits: new Set([p.outfitId]), recipeStates, inventory, now: operation.now }
        if (p.kind === 'start') {
          const started = value(startFarmJob({ ...input, recipeId: p.recipeId, quantity: p.quantity, choices: p.choices }))
          put('farm', 'main', started.farm); started.debits.forEach(d => movement(d.itemId, -d.amount, 'input', started.job.id))
          result = { kind: p.kind, job: started.job }
        } else {
          need(station.job?.id === p.jobId, 'The frozen job identity changed; never retry against the next job')
          if (p.kind === 'energy') {
            const accelerated = value(spendFarmEnergy(input))
            put('farm', 'main', accelerated.farm); movement(FARM_KITCHEN_ENERGY_ID, -1, 'energy', p.jobId)
            result = { kind: p.kind, jobId: p.jobId, usedMs: accelerated.usedMs, wastedMs: accelerated.wastedMs,
              readyAt: farmStation(accelerated.farm, p.stationId).job!.readyAt }
          } else {
            need(station.job?.recipeId === p.recipeId, 'Declared output recipe does not match the authoritative job')
            const claimed = value(claimFarmJob(input))
            put('farm', 'main', claimed.farm); put('farmWorkers', p.outfitId, claimed.worker)
            claimed.recipeStates.forEach(state => {
              const before = current('farmRecipes', `b${state.block}`)
              if (!before || farmCanonical(before.data) !== farmCanonical(state)) put('farmRecipes', `b${state.block}`, state)
            })
            movement(claimed.receipt.output.itemId, claimed.receipt.output.amount, 'output', p.jobId)
            result = { kind: p.kind, ...claimed.receipt }; writeGuard('terminal', p.jobId)
          }
        }
      }
    }
    return accepted()
  } catch (error) { return reject(error instanceof Error ? error.message : 'Farm operation failed') }
}
