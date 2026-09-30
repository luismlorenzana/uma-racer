// Atomic Produce-node consumption (docs/design/farm.md#constellation-produce-bridge).

import {
  ConstellationProduceConflictError,
  constellationProduceMovementId,
  farmCropById,
  parseInventoryStackData,
  parseItemLedgerEntry,
  parseUmaSaveOrThrow,
  produceAssignmentRevision,
  resolveConstellationProduce,
  type ConstellationProduceMovement,
  type FarmCropId,
  type InventoryStackData,
  type ProduceAssignment,
  type UmaSave,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { updateTrainingBadgeFacts } from './badges'
import { db } from './db'
import { queueInTransaction } from './persistence'

export interface ConsumeProduceInput {
  umaId: string
  tier: number
  nodeId: string
  itemId: string
  expectedRevision: number
  now: number
}

export interface ConsumeProduceReceipt {
  uma: UmaSave
  assignment: ProduceAssignment
  movement: ConstellationProduceMovement
  quantityBefore: number
  quantityAfter: number
  alreadyCommitted: boolean
}

export interface ConsumeProduceOptions {
  /** Test-only transaction fault boundary. Throwing rolls every projection and evidence write back. */
  afterWrite?: (boundary: 'uma' | 'items' | 'itemLedger' | 'badges' | 'outbox') => void
}

function assignmentAt(uma: UmaSave, tier: number, nodeId: string) {
  return uma.scenarios.find((run) => run.tier === tier)?.assignments[nodeId]
}

function requireStack(raw: unknown, itemId: string): InventoryStackData {
  if (raw === undefined) return { itemId, quantity: 0, updatedAt: 0 }
  const parsed = parseInventoryStackData(raw, itemId)
  if (!parsed) throw new Error(`Local item stack is invalid: ${itemId}`)
  return parsed
}

function requireRetryProjection(
  input: ConsumeProduceInput,
  uma: UmaSave,
  movement: ConstellationProduceMovement,
  stack: InventoryStackData,
): ConsumeProduceReceipt {
  const assignment = assignmentAt(uma, input.tier, input.nodeId)
  if (movement.source.umaId !== input.umaId || movement.source.tier !== input.tier ||
    movement.source.nodeId !== input.nodeId || movement.source.revision !== input.expectedRevision + 1) {
    throw new Error(`Produce evidence is corrupt: ${movement.id}`)
  }
  if (movement.itemId !== input.itemId) throw new ConstellationProduceConflictError()
  if (!assignment || assignment.kind !== 'produce' || assignment.revision < movement.source.revision ||
    (assignment.revision === movement.source.revision && assignment.itemId !== movement.itemId)) {
    throw new Error(`Produce projection is corrupt: ${movement.id}`)
  }
  return {
    uma,
    // Evidence remains an idempotency receipt even after another replacement has advanced the live node.
    assignment: { kind: 'produce', itemId: movement.itemId, revision: movement.source.revision },
    movement,
    // The exact historical before quantity is not a projection. This retry still reports the single movement.
    quantityBefore: stack.quantity + 1,
    quantityAfter: stack.quantity,
    alreadyCommitted: true,
  }
}

/** Read the five current quantities shown by a scenario's Produce picker. Missing stacks are canonical zeroes. */
export async function readProduceInventory(tier: number): Promise<InventoryStackData[]> {
  if (!Number.isSafeInteger(tier) || tier < 1 || tier > 14) throw new Error('Produce inventory tier is invalid')
  const crops = ['speed', 'stamina', 'power', 'guts', 'wit'].map((stat) => farmCropById(`produce:t${tier}:${stat}`))
  if (crops.some((crop) => crop === null)) throw new Error(`Produce catalog is incomplete for scenario ${tier}`)
  return Promise.all(crops.map(async (crop) => {
    const itemId = crop!.id
    const row = await db.items.get(itemId)
    return requireStack(row?.data, itemId)
  }))
}

/**
 * Consume one crop and replace one node. The saved Uma, inventory projection, evidence, badges and outbox are one
 * IndexedDB transaction; the evidence id makes an exact retry a read instead of a second spend.
 */
export async function consumePersistentProduce(
  content: LoadedContent,
  input: ConsumeProduceInput,
  options: ConsumeProduceOptions = {},
): Promise<ConsumeProduceReceipt> {
  const crop = farmCropById(input.itemId)
  if (!crop) throw new Error('That crop is unknown')
  const revision = input.expectedRevision + 1
  const evidenceId = constellationProduceMovementId(input.umaId, input.tier, input.nodeId, revision)
  const afterWrite = options.afterWrite ?? (() => undefined)

  return db.transaction('rw', [db.umas, db.items, db.itemLedger, db.badges, db.ledger, db.flairEvents, db.outbox], async () => {
    const umaRow = await db.umas.get(input.umaId)
    if (!umaRow) throw new Error('Local Uma is missing')
    const uma = parseUmaSaveOrThrow(umaRow.data)
    if (uma.templateId !== input.umaId) throw new Error('Local Uma id is mismatched')
    const itemRow = await db.items.get(crop.id)
    const stack = requireStack(itemRow?.data, crop.id)

    const evidenceRow = await db.itemLedger.get(evidenceId)
    if (evidenceRow) {
      const movement = parseItemLedgerEntry(evidenceRow.data)
      if (!movement || movement.reason !== 'constellation-produce' || movement.id !== evidenceId ||
        movement.createdAt !== evidenceRow.createdAt) throw new Error(`Produce evidence is corrupt: ${evidenceId}`)
      return requireRetryProjection(input, uma, movement, stack)
    }

    const run = uma.scenarios.find((entry) => entry.tier === input.tier)
    if (!run) throw new Error('That scenario has not been unlocked')
    const command = resolveConstellationProduce({
      ...input,
      trainingLevel: run.trainingLevel,
      quantity: stack.quantity,
      current: run.assignments[input.nodeId],
    })
    const nextUma: UmaSave = {
      ...uma,
      scenarios: uma.scenarios.map((entry) => entry.tier === input.tier
        ? { ...entry, assignments: { ...entry.assignments, [input.nodeId]: command.assignment } }
        : entry),
    }
    const nextStack: InventoryStackData = { itemId: crop.id as FarmCropId, quantity: command.quantityAfter, updatedAt: input.now }

    await db.umas.put({ ...umaRow, data: nextUma })
    afterWrite('uma')
    await db.items.put({ id: crop.id, data: nextStack, version: itemRow?.version ?? 0 })
    afterWrite('items')
    await db.itemLedger.add({ id: command.movement.id, data: command.movement, createdAt: command.movement.createdAt })
    afterWrite('itemLedger')
    await queueInTransaction('umas', input.umaId, 'upsert', input.now)
    await queueInTransaction('items', crop.id, 'upsert', input.now)
    await queueInTransaction('itemLedger', command.movement.id, 'append', input.now)
    await updateTrainingBadgeFacts({ content, uma: nextUma, sourceId: command.movement.id, now: input.now })
    afterWrite('badges')
    afterWrite('outbox')
    return { uma: nextUma, ...command, alreadyCommitted: false }
  })
}

export function currentProduceRevision(uma: UmaSave, tier: number, nodeId: string): number {
  const revision = produceAssignmentRevision(assignmentAt(uma, tier, nodeId))
  if (revision === null) throw new Error('That node does not hold Produce')
  return revision
}
