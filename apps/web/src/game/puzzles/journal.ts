// Strict device-only replay, never the ticketed journal (docs/technical/uma-puzzles-implementation.md §§4, 7).
import { PUZZLE_ACTION_LIMIT, parsePuzzleBattleAction, puzzleBattleStateHash, replayPuzzleBattle,
  type PuzzleOpenEncounterV1 } from '@racer/domain'
import type { PuzzleJournalRow } from '../db'

export type PuzzleRecoveryCode = 'disabled' | 'preparing' | 'missing-battle' | 'foreign-owner' | 'displaced' |
  'missing-journal' | 'unsupported-journal' | 'corrupt-journal' | 'content-unavailable' | 'stale' | 'conflict' | 'offline'
export class PuzzleRecoveryError extends Error {
  constructor(readonly code: PuzzleRecoveryCode, message: string) { super(message); this.name = 'PuzzleRecoveryError' }
}
const plain = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' &&
  !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
export function parsePuzzleJournal(value: unknown): PuzzleJournalRow | null {
  if (!plain(value) || Object.keys(value).sort().join(',') !== 'actions,id,inputHash,ownerEpoch,schemaVersion,stateHash,updatedAt' ||
    value.schemaVersion !== 1 || typeof value.id !== 'string' || !integer(value.ownerEpoch) || !integer(value.updatedAt) ||
    typeof value.inputHash !== 'string' || !/^[a-f0-9]{16}$/.test(value.inputHash) ||
    typeof value.stateHash !== 'string' || !/^[a-f0-9]{16}$/.test(value.stateHash) || !Array.isArray(value.actions) ||
    Object.getPrototypeOf(value.actions) !== Array.prototype || value.actions.length > PUZZLE_ACTION_LIMIT ||
    Object.keys(value.actions).length !== value.actions.length ||
    Object.keys(value.actions).some((key, index) => key !== String(index))) return null
  const actions = value.actions.map(parsePuzzleBattleAction)
  if (actions.some(a => !a)) return null
  return { id: value.id, schemaVersion: 1, ownerEpoch: value.ownerEpoch, inputHash: value.inputHash,
    actions: actions.map(a => a!), stateHash: value.stateHash, updatedAt: value.updatedAt }
}
export function replayPuzzleJournal(open: PuzzleOpenEncounterV1, raw: unknown) {
  if (!raw) throw new PuzzleRecoveryError('missing-journal', 'The saved journal is missing. Retry restore or explicitly take over this same fight online.')
  if (plain(raw) && raw.schemaVersion !== 1) throw new PuzzleRecoveryError('unsupported-journal', 'This journal needs a compatible app. It has not been reset.')
  const journal = parsePuzzleJournal(raw)
  if (!journal) throw new PuzzleRecoveryError('corrupt-journal', 'The saved journal is invalid. Your frozen fight is retained for recovery.')
  if (journal.ownerEpoch !== open.ownerEpoch) throw new PuzzleRecoveryError('displaced', 'Another device owns this fight now. This journal cannot claim rewards.')
  if (journal.id !== open.input.battleId || journal.inputHash !== open.inputHash)
    throw new PuzzleRecoveryError('corrupt-journal', 'Journal and frozen input disagree; neither was reset.')
  try {
    const replay = replayPuzzleBattle(open.input, journal.actions)
    if (puzzleBattleStateHash(replay.state) !== journal.stateHash) throw new Error('Hash mismatch')
    return { journal, ...replay }
  } catch { throw new PuzzleRecoveryError('corrupt-journal', 'The accepted journal could not be replayed exactly. Retry restore or use explicit online recovery.') }
}
