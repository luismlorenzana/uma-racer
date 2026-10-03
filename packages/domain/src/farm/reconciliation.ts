// Evidence-based Farm projection repair (docs/design/farm.md#persistence-boundary, T083).

import type { FarmPlotId } from './constants'
import { inspirationToken } from '../inspiration'
import { applyFarmingXp, defaultOutfitFarmingProgress, farmPlotNumber } from './progression'
import {
  isEmptyFarmPlot,
  parseFarmState,
  parseInventoryStackData,
  parseItemLedgerEntry,
  type FarmHarvestMovement,
  type FarmState,
  type InventoryStackData,
  type ItemLedgerEntry,
  type OutfitFarmingProgress,
} from './types'

export interface FarmReconciliation {
  farm: FarmState
  stacks: InventoryStackData[]
  farmChanged: boolean
  changedItemIds: string[]
}

const same = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right)

function uniqueMovements(input: readonly ItemLedgerEntry[]): ItemLedgerEntry[] {
  const entries = new Map<string, ItemLedgerEntry>()
  for (const raw of input) {
    const entry = parseItemLedgerEntry(raw)
    if (!entry) throw new Error('Item ledger evidence is invalid')
    const existing = entries.get(entry.id)
    if (existing && !same(existing, entry)) throw new Error(`Item ledger id has conflicting evidence: ${entry.id}`)
    entries.set(entry.id, entry)
  }
  return [...entries.values()].sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))
}

function cycleAttempt(id: string, plotId: FarmPlotId): number | null {
  const prefix = `farm:${plotId}:`
  if (!id.startsWith(prefix)) return null
  const value = Number(id.slice(prefix.length))
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

/**
 * Repairs mutable projections from unique append-only evidence. An already-correct projection is returned byte-for-byte
 * equivalent so callers can avoid a write and another sync cycle.
 */
export function reconcileFarmEvidence(
  farmInput: FarmState,
  stackInput: readonly InventoryStackData[],
  movementInput: readonly ItemLedgerEntry[],
): FarmReconciliation {
  const parsedFarm = parseFarmState(farmInput)
  if (!parsedFarm) throw new Error('Farm projection is invalid')
  const movements = uniqueMovements(movementInput)
  const existingStacks = new Map<string, InventoryStackData>()
  for (const raw of stackInput) {
    const stack = parseInventoryStackData(raw)
    if (!stack || existingStacks.has(stack.itemId)) throw new Error('Item stack projection is invalid')
    existingStacks.set(stack.itemId, stack)
  }

  const quantities = new Map<string, { quantity: number; updatedAt: number }>()
  const progress = new Map<string, OutfitFarmingProgress>()
  const harvestedByCycle = new Map<string, FarmHarvestMovement>()
  for (const entry of movements) {
    const item = quantities.get(entry.itemId) ?? { quantity: 0, updatedAt: 0 }
    item.quantity += entry.delta
    item.updatedAt = Math.max(item.updatedAt, entry.createdAt)
    // Accepted token groups establish causality; device timestamps can differ. Validate their final sum, not
    // a timestamp-sorted prefix that could put a valid later spend before its grant on another device.
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 0 && !inspirationToken(entry.itemId)) {
      throw new Error(`Item ledger produces an invalid quantity: ${entry.itemId}`)
    }
    quantities.set(entry.itemId, item)
    if (entry.reason === 'farm-harvest') {
      progress.set(entry.source.templateId, applyFarmingXp(
        progress.get(entry.source.templateId) ?? defaultOutfitFarmingProgress(),
        entry.source.farmingExp,
      ).progress)
      harvestedByCycle.set(entry.source.cycleId, entry)
    }
  }

  const workers = Object.fromEntries([...progress.entries()].sort(([left], [right]) => left.localeCompare(right)))
  for (const [itemId, item] of quantities) if (item.quantity < 0) throw new Error(`Item ledger produces an invalid quantity: ${itemId}`)
  // Plots are stored sparsely (D234): evidence can name a plot this projection lost to a sync conflict.
  const stored = new Map(parsedFarm.plots.map((plot) => [plot.id, plot]))
  for (const entry of harvestedByCycle.values()) {
    if (!stored.has(entry.source.plotId)) {
      stored.set(entry.source.plotId, { id: entry.source.plotId, templateId: null, lastCropId: null, attempt: 0, cycle: null })
    }
  }
  const plots = [...stored.values()].sort((left, right) => farmPlotNumber(left.id)! - farmPlotNumber(right.id)!).map((plot) => {
    let attempt = plot.attempt
    for (const entry of harvestedByCycle.values()) {
      if (entry.source.plotId !== plot.id) continue
      attempt = Math.max(attempt, cycleAttempt(entry.source.cycleId, plot.id) ?? 0)
    }
    const harvested = plot.cycle ? harvestedByCycle.get(plot.cycle.id) : undefined
    if (!harvested) return { ...plot, attempt, cycle: plot.cycle ? { ...plot.cycle } : null }
    return {
      ...plot,
      templateId: harvested.source.templateId,
      lastCropId: harvested.itemId,
      attempt,
      cycle: null,
    }
  }).filter((plot) => !isEmptyFarmPlot(plot))
  const farm = { ...parsedFarm, plots, workers }
  if (!parseFarmState(farm)) throw new Error('Item ledger evidence cannot produce a valid Farm projection')

  const reconciled = new Map(existingStacks)
  const changedItemIds: string[] = []
  for (const [itemId, projection] of quantities) {
    const next = { itemId, quantity: projection.quantity, updatedAt: projection.updatedAt }
    if (!same(existingStacks.get(itemId), next)) changedItemIds.push(itemId)
    reconciled.set(itemId, next)
  }
  return {
    farm,
    stacks: [...reconciled.values()].sort((left, right) => left.itemId.localeCompare(right.itemId)),
    farmChanged: !same(parsedFarm, farm),
    changedItemIds: changedItemIds.sort(),
  }
}
