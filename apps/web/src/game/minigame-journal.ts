// Installed device-local replay journal port (docs/design/minigames.md#determinism-journal-and-commit, D171).

import type {
  FtAction,
  SparkRivalAction,
  SparkRivalEncounterV1,
  SparkRivalReplay,
} from '@racer/domain'
import type { RunTicket } from './minigame-host'

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

export interface SparkRunSnapshotV1 {
  version: 1
  contentVersion: string
  encounter: SparkRivalEncounterV1
  source: 'authored' | 'fallback'
}

/** Read-only projection of one persisted Spark run. Mutable Dexie rows never leave the journal boundary. */
export interface SparkRunView {
  ticket: RunTicket
  snapshot: SparkRunSnapshotV1
  actions: readonly SparkRivalAction[]
  replay: SparkRivalReplay
}

export interface MinigameJournal {
  loadSpark(runId: string): Promise<SparkRunView>
  appendSpark(runId: string, expectedActionCount: number, action: SparkRivalAction): Promise<SparkRunView>
}

const unavailableJournal: MinigameJournal = {
  async loadSpark() {
    throw new Error('Minigame journal is not ready')
  },
  async appendSpark() {
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
