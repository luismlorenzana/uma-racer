// Atomic Extra stat purchases (docs/design/constellations.md#extra-stats, D235).

import {
  extraStatUnlockMovementId,
  farmCropById,
  farmCropFor,
  parseExtraStatNodeId,
  parseInventoryStackData,
  parseItemLedgerEntry,
  parseUmaSaveOrThrow,
  resolveExtraStatUnlock,
  scenarioAt,
  withScenarioView,
  type ExtraStatNodeId,
  type InventoryStackData,
  type UmaSave,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { updateTrainingBadgeFacts } from './badges'
import { db } from './db'
import { queueInTransaction } from './persistence'

export interface UnlockExtraStatInput {
  umaId: string
  tier: number
  /** The node the player chose to buy: the next one of its stat. */
  nodeId: ExtraStatNodeId
  now: number
}

export interface UnlockExtraStatReceipt {
  uma: UmaSave
  nodeId: ExtraStatNodeId
  cost: number
  quantityBefore: number
  quantityAfter: number
  alreadyCommitted: boolean
}

export interface UnlockExtraStatOptions {
  /** Test-only transaction fault boundary. Throwing rolls every projection and evidence write back. */
  afterWrite?: (boundary: 'uma' | 'items' | 'itemLedger' | 'badges' | 'outbox') => void
}

/** The node changed under a stale screen: it is already bought, or an earlier one is still missing. */
export class ExtraStatConflictError extends Error {
  constructor() {
    super('That Extra stat node changed; the grid shows it as it is now')
    this.name = 'ExtraStatConflictError'
  }
}

function requireStack(raw: unknown, itemId: string): InventoryStackData {
  if (raw === undefined) return { itemId, quantity: 0, updatedAt: 0 }
  const parsed = parseInventoryStackData(raw, itemId)
  if (!parsed) throw new Error(`Local item stack is invalid: ${itemId}`)
  return parsed
}

/** The five crops of a scenario and their stock, Speed to Wit. Missing stacks are canonical zeroes. */
export async function readProduceInventory(tier: number): Promise<InventoryStackData[]> {
  if (!Number.isSafeInteger(tier) || tier < 1 || tier > 14) throw new Error('Produce inventory tier is invalid')
  const crops = ['speed', 'stamina', 'power', 'guts', 'wit'].map((stat) => farmCropById(`produce:t${tier}:${stat}`))
  if (crops.some((crop) => crop === null)) throw new Error(`Produce catalog is incomplete for scenario ${tier}`)
  return Promise.all(crops.map(async (crop) => requireStack((await db.items.get(crop!.id))?.data, crop!.id)))
}

/**
 * Buy one Extra stat node: the Uma, the crop stack, its evidence, badges and outbox commit in one IndexedDB transaction.
 * The evidence id names the node, so an exact retry finds its own receipt instead of buying the next node.
 */
export async function unlockPersistentExtraStat(
  content: LoadedContent,
  input: UnlockExtraStatInput,
  options: UnlockExtraStatOptions = {},
): Promise<UnlockExtraStatReceipt> {
  const node = parseExtraStatNodeId(input.nodeId)
  if (!node) throw new Error('That Extra stat node is unknown')
  const crop = farmCropFor(input.tier, node.stat)
  if (!crop) throw new Error('That scenario has no crop for this stat')
  const evidenceId = extraStatUnlockMovementId(input.umaId, input.tier, input.nodeId)
  const afterWrite = options.afterWrite ?? (() => undefined)

  return db.transaction('rw', [db.umas, db.items, db.itemLedger, db.badges, db.ledger, db.flairEvents, db.outbox, db.farmCutover, db.farm], async () => {
    if (await db.farmCutover.get('main') || Number((await db.farm.get('main'))?.data.schemaVersion) >= 3)
      throw new Error('Legacy Extra stats are retired for this Farm generation; open the meal-funded map')
    const umaRow = await db.umas.get(input.umaId)
    if (!umaRow) throw new Error('Local Uma is missing')
    const uma = parseUmaSaveOrThrow(umaRow.data)
    if (uma.templateId !== input.umaId) throw new Error('Local Uma id is mismatched')
    // Buying is the scenario's, shared by every preset; the new node turns on in the preset being edited (D252).
    const run = scenarioAt(uma, input.tier)
    if (!run) throw new Error('That scenario has not been unlocked')
    const itemRow = await db.items.get(crop.id)
    const stack = requireStack(itemRow?.data, crop.id)

    const evidenceRow = await db.itemLedger.get(evidenceId)
    if (evidenceRow) {
      const movement = parseItemLedgerEntry(evidenceRow.data)
      if (!movement || movement.reason !== 'extra-stat-unlock' || movement.id !== evidenceId ||
        movement.createdAt !== evidenceRow.createdAt || run.extraStats.unlocked[node.stat] < node.index) {
        throw new Error(`Extra stat evidence is corrupt: ${evidenceId}`)
      }
      return { uma, nodeId: input.nodeId, cost: -movement.delta, quantityBefore: stack.quantity - movement.delta,
        quantityAfter: stack.quantity, alreadyCommitted: true }
    }
    if (run.extraStats.unlocked[node.stat] !== node.index - 1) throw new ExtraStatConflictError()

    const command = resolveExtraStatUnlock({
      umaId: input.umaId, tier: input.tier, extra: run.extraStats, stat: node.stat, quantity: stack.quantity, now: input.now,
    })
    const nextUma: UmaSave = withScenarioView(uma, { ...run, extraStats: command.extra })
    await db.umas.put({ ...umaRow, data: nextUma })
    afterWrite('uma')
    await db.items.put({ id: crop.id, data: { itemId: crop.id, quantity: command.quantityAfter, updatedAt: input.now }, version: itemRow?.version ?? 0 })
    afterWrite('items')
    await db.itemLedger.add({ id: command.movement.id, data: command.movement, createdAt: command.movement.createdAt })
    afterWrite('itemLedger')
    await queueInTransaction('umas', input.umaId, 'upsert', input.now)
    await queueInTransaction('items', crop.id, 'upsert', input.now)
    await queueInTransaction('itemLedger', command.movement.id, 'append', input.now)
    await updateTrainingBadgeFacts({ content, uma: nextUma, sourceId: command.movement.id, now: input.now })
    afterWrite('badges')
    afterWrite('outbox')
    return { uma: nextUma, nodeId: command.nodeId, cost: command.cost, quantityBefore: command.quantityBefore,
      quantityAfter: command.quantityAfter, alreadyCommitted: false }
  })
}
