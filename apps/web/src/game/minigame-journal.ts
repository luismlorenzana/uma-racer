// Installed device-local replay journal port (docs/design/minigame-kit.md#2-the-run-lifecycle, D171, D185).

import type {
  FtAction,
  FtSetup,
  FtState,
  SparkRivalAction,
  SparkRivalEncounterV1,
  SparkRivalReplay,
} from '@racer/domain'
import type { RunTicket } from './minigame-host'

export const MINIGAME_JOURNAL_ACTION_LIMIT = 64

export interface SparkReplayJournalV1 {
  format: 1
  engine: 'spark-rival-v1'
  actions: SparkRivalAction[]
}

export interface FriendshipReplayJournalV1 {
  format: 1
  engine: 'friendship-training-v1'
  actions: FtAction[]
}

export type ReplayJournalV1 = SparkReplayJournalV1 | FriendshipReplayJournalV1
export type MinigameEngineId = ReplayJournalV1['engine']
export type MinigameJournalAction = SparkRivalAction | FtAction

export interface SparkRunSnapshotV1 {
  version: 1
  contentVersion: string
  encounter: SparkRivalEncounterV1
  source: 'authored' | 'fallback'
}

export interface FriendshipRunSnapshotV1 {
  version: 1
  setup: FtSetup
}

export type MinigameRunSnapshotV1 = SparkRunSnapshotV1 | FriendshipRunSnapshotV1

/** Read-only projections of persisted rows. Mutable Dexie records never leave this boundary. */
export interface SparkRunView {
  engine: 'spark-rival-v1'
  ticket: RunTicket
  snapshot: SparkRunSnapshotV1
  actions: readonly SparkRivalAction[]
  replay: SparkRivalReplay
}

export interface FriendshipRunView {
  engine: 'friendship-training-v1'
  ticket: RunTicket
  snapshot: FriendshipRunSnapshotV1
  actions: readonly FtAction[]
  replay: FtState
}

export type MinigameRunView = SparkRunView | FriendshipRunView

export interface MinigameJournal {
  load(runId: string): Promise<MinigameRunView>
  append(runId: string, expectedActionCount: number, action: MinigameJournalAction): Promise<MinigameRunView>
}

const unavailableJournal: MinigameJournal = {
  async load() {
    throw new Error('Minigame journal is not ready')
  },
  async append() {
    throw new Error('Minigame journal is not ready')
  },
}

let installedJournal: MinigameJournal = unavailableJournal

/** Installed beside MinigameHost after the local database and verified content are ready. */
export function installMinigameJournal(journal: MinigameJournal): () => void {
  installedJournal = journal
  return () => {
    if (installedJournal === journal) installedJournal = unavailableJournal
  }
}

export const getMinigameJournal = (): MinigameJournal => installedJournal
