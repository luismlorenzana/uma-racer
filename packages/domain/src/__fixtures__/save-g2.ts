// Synthetic content and a stand-in server for the generation-2 save's tests (packages/domain/src/save-g2): the check-in
// fixtures' invented Umas, cards, skills and races as the four packs, and an in-memory store that stamps rows the way
// T135's repositories do (a version from 1 rising once a commit, first write wins for a log). Nothing from the packs.
import { buildOperationEnv, type OperationPacks } from '../save-g2/env'
import { commitOperation, type Commit, type OperationEnvelope } from '../save-g2/commit'
import { rowKey, stampEntity, stampLog, type EntityDraft, type EntityRow, type LogDraft, type LogRow } from '../save-g2/rows'
import { toSaveState, type SaveState } from '../save-g2/state'
import type { OperationEnv, OperationName } from '../rework/check-in/once'
import { CHECK_IN_CONTENT } from './rework-check-in'

export { clock, uma } from './rework-check-in'

export const PACKS: OperationPacks = {
  umas: [...CHECK_IN_CONTENT.umas.values()],
  races: CHECK_IN_CONTENT.races,
  cards: [...CHECK_IN_CONTENT.cards.values()],
  skills: [...CHECK_IN_CONTENT.skills.values()],
}

export const ENV: OperationEnv = buildOperationEnv(PACKS)
/** A dev build's env, where `dev-grant` runs. */
export const DEV: OperationEnv = { ...ENV, dev: true }

/** An operation id of the right shape: `op-00001`. */
export const opId = (n: number): string => `op-${String(n).padStart(5, '0')}`

/** A stand-in server: the rows it holds, stamped as T135 stamps them. */
export class Store {
  readonly entities = new Map<string, EntityRow>()
  readonly logs = new Map<string, LogRow>()

  write(entities: readonly EntityDraft[], logs: readonly LogDraft[], savedAt: number): void {
    for (const draft of entities) {
      const key = rowKey(draft)
      this.entities.set(key, stampEntity(draft, (this.entities.get(key)?.version ?? 0) + 1, savedAt))
    }
    for (const draft of logs) {
      const key = rowKey(draft)
      if (!this.logs.has(key)) this.logs.set(key, stampLog(draft, savedAt))
    }
  }

  rows(): { entities: EntityRow[]; logs: LogRow[] } {
    return { entities: [...this.entities.values()], logs: [...this.logs.values()] }
  }

  state(): SaveState {
    const { entities, logs } = this.rows()
    return toSaveState(entities, logs)
  }

  /** Commits one envelope on `state` and stores what it wrote, at the envelope's time. */
  commit<N extends OperationName>(state: SaveState, envelope: OperationEnvelope<N>, env: OperationEnv = ENV): Commit<N> {
    const commit = commitOperation(state, envelope, env)
    if (commit.status === 'applied') this.write(commit.entities, commit.logs, envelope.at)
    return commit
  }
}

/** The Warehouse without empty stacks: a rule reads an absent item as 0. */
export const stock = (items: Readonly<Record<string, number>>): Record<string, number> =>
  Object.fromEntries(Object.entries(items).filter(([, n]) => n !== 0))
