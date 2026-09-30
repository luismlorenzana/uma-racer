// Aggregate-only Farm/Item diagnostics; never exposes private catalog names or saved item ids (T085).

import {
  farmLevel,
  parseFarmState,
  parseInventoryStackData,
  parseItemLedgerEntry,
  plotStatus,
  unlockedPlotIds,
} from '@racer/domain'
import { db } from '../db'

export interface FarmSaveSummary {
  farmPresent: boolean
  farmLevel: number | null
  unlockedPlots: number
  assignedPlots: number
  growingPlots: number
  readyPlots: number
  itemStacks: number
  totalItems: number
  itemMovements: number
}

export async function readFarmSaveSummary(now = Date.now()): Promise<FarmSaveSummary> {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Farm diagnostic time is invalid')
  const [farmRow, itemRows, ledgerRows] = await Promise.all([
    db.farm.get('main'), db.items.toArray(), db.itemLedger.toArray(),
  ])
  const farm = farmRow ? parseFarmState(farmRow.data) : null
  if (farmRow && (!farm || farmRow.id !== 'main')) throw new Error('Farm diagnostic state is invalid')
  const items = itemRows.map((row) => {
    const item = parseInventoryStackData(row.data, row.id)
    if (!item) throw new Error('Item diagnostic stack is invalid')
    return item
  })
  for (const row of ledgerRows) {
    const entry = parseItemLedgerEntry(row.data)
    if (!entry || entry.id !== row.id || entry.createdAt !== row.createdAt) throw new Error('Item diagnostic movement is invalid')
  }
  const level = farm ? farmLevel(farm.workers) : null
  const statuses = farm ? farm.plots.map((plot) => plotStatus(farm, plot.id, now)) : []
  return {
    farmPresent: farm !== null,
    farmLevel: level,
    unlockedPlots: level === null ? 0 : unlockedPlotIds(level).length,
    assignedPlots: farm?.plots.filter((plot) => plot.templateId !== null).length ?? 0,
    growingPlots: statuses.filter((status) => status === 'growing').length,
    readyPlots: statuses.filter((status) => status === 'ready').length,
    itemStacks: items.filter((item) => item.quantity > 0).length,
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    itemMovements: ledgerRows.length,
  }
}
