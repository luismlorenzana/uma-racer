// Global ledger adds v3 Farm evidence without changing Puzzle's standalone legacy Farm dependency.
import { parseItemLedgerEntry as parseLegacy, type ItemLedgerEntry as LegacyItemLedgerEntry } from './farm/types'
import { parseFarmCommandMovement, type FarmCommandMovement } from './farm/kitchen/movement'
export type ItemLedgerEntry = LegacyItemLedgerEntry | FarmCommandMovement
export function parseItemLedgerEntry(value: unknown): ItemLedgerEntry | null { return parseFarmCommandMovement(value) ?? parseLegacy(value) }
