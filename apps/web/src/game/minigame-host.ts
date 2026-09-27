// Port between the independently shipped minigames and save-v6 progression (docs/tasks/M014-minigames.md).

import { SPARK_MATCH_TICKET_COST, ftReplay, type FtAction, type FtSetup } from '@racer/domain'
import type { SparkRunSnapshotV1, SparkRunView } from './minigame-journal'
import {
  parseSparkRivalAction,
  parseSparkRivalEncounter,
  replaySparkRival,
  sparkRivalStateHash,
  syntheticSparkEncounter,
  type SparkRivalAction,
  type SparkRivalReplay,
} from './minigames/spark-rival'

/** The minigames a run can begin in. Bond Recall is retired (D177); its stored rows keep their `bond-recall` kind. */
export type MinigameKind = 'spark-match' | 'friendship-training'

export interface MinigameHost {
  /** Reserves a run: spends tickets, returns the deterministic seed. Rejects if tickets are short. */
  beginRun(kind: MinigameKind, target: RunTarget): Promise<RunTicket>
  /** Commits a finished run atomically. Safe to call twice with the same runId. */
  commitRun(runId: string, outcome: RunOutcome): Promise<RunReward>
  /** A Friendship Training run's frozen setup and the choices made so far (D168); null for any other run. */
  loadRun(runId: string): Promise<SavedRun | null>
  /** Appends a Friendship Training run's choices as they are made, so a reload resumes exactly. */
  saveProgress(runId: string, actions: readonly FtAction[]): Promise<void>
  /** The target's open run, if one is waiting to resume; never spends a ticket. */
  findOpenRun(target: RunTarget): Promise<RunTicket | null>
}

export interface SavedRun {
  setup: FtSetup
  actions: FtAction[]
}

export interface RunTicket {
  runId: string
  seed: string
  attemptIndex: number
}

export type RunTarget =
  | { kind: 'spark-match'; umaId: string }
  /** Retired (D177): only in stored history rows, never begun. */
  | { kind: 'bond-recall'; cardId: string; tier: number }
  /** The Uma names the card set the deck is built from; without one, the first set anyone holds there. */
  | { kind: 'friendship-training'; cardId: string; tier: number; umaId?: string | null }

export type RunOutcome =
  | { kind: 'spark-match'; engine: 'spark-rival-v1'; actionCount: number; stateHash: string }
  | { kind: 'bond-recall'; cleared: boolean; mismatches: number }
  | { kind: 'friendship-training'; cleared: boolean; actions: FtAction[] }

/** Read-only history shape from the retired adjacent-swap engine. It can never be submitted again. */
export interface LegacySparkOutcome {
  kind: 'spark-match'
  score: number
  moves: number
}

export type StoredRunOutcome = RunOutcome | LegacySparkOutcome

export interface RunRewardNode {
  id: string
  label: string
}

export interface RunReward {
  ticketsSpent: number
  trainingExpEarned?: number
  trainingExpBefore?: number
  trainingExpAfter?: number
  trainingLevelBefore?: number
  trainingLevelAfter?: number
  nodesUnlocked?: RunRewardNode[]
  starsBefore?: number
  starsAfter?: number
  couponGranted?: boolean
}

export interface LegacyRunReward extends Omit<RunReward, 'nodesUnlocked'> {
  nodesUnlocked?: string[]
}

export type StoredRunReward = RunReward | LegacyRunReward

type RewardFactory = (
  ticket: RunTicket,
  target: RunTarget,
  outcome: RunOutcome,
  sparkReplay: SparkRivalReplay | null,
) => RunReward

const targetKey = (target: RunTarget): string =>
  target.kind === 'spark-match' ? `spark-match:${target.umaId}` : `${target.kind}:${target.cardId}:${target.tier}`

export const validateMinigameOutcome = (ticket: RunTicket, target: RunTarget, outcome: RunOutcome): void => {
  if (target.kind !== outcome.kind) throw new Error(`Run ${ticket.runId} received the wrong minigame outcome`)
  if (outcome.kind === 'spark-match') {
    if (outcome.engine !== 'spark-rival-v1' || !Number.isSafeInteger(outcome.actionCount) ||
      outcome.actionCount < 0 || outcome.actionCount > 64 || !/^[a-f0-9]{8}$/.test(outcome.stateHash)) {
      throw new Error('Spark Match outcomes require a bounded Rival Circuit replay claim')
    }
    return
  }
  if (outcome.kind === 'friendship-training') {
    if (typeof outcome.cleared !== 'boolean' || !Array.isArray(outcome.actions)) {
      throw new Error('Friendship Training outcomes require a clear flag and the run\'s choices')
    }
    return
  }
  throw new Error('Bond Recall is retired: Bond opens Friendship Training')
}

/**
 * A Friendship Training commit replays the frozen setup with the choices and must land where the outcome says: a clear
 * is always a real one, and a loss is a finished run (D168).
 */
export function validateFriendshipOutcome(setup: FtSetup, outcome: Extract<RunOutcome, { kind: 'friendship-training' }>): void {
  const state = ftReplay(setup, outcome.actions)
  if (state.phase !== 'won' && state.phase !== 'lost') throw new Error('This Friendship Training run is not finished')
  if ((state.phase === 'won') !== outcome.cleared) throw new Error('The run does not replay to that result')
}

const sparkTargetExp = (level: number): number => 1_000 + 350 * (level - 1)

const defaultReward: RewardFactory = (_ticket, target, outcome, sparkReplay) => {
  if (target.kind === 'friendship-training' && outcome.kind === 'friendship-training') {
    return { ticketsSpent: 1, starsBefore: 0, starsAfter: outcome.cleared ? 1 : 0, couponGranted: false }
  }
  if (target.kind !== 'spark-match' || outcome.kind !== 'spark-match' || !sparkReplay?.outcome) {
    throw new Error('Mismatched test-double run')
  }
  let level = 1
  let exp = sparkReplay.outcome.trainingExp
  while (level < 10 && exp >= sparkTargetExp(level)) {
    exp -= sparkTargetExp(level)
    level += 1
  }
  const nodesUnlocked = Array.from(
    { length: Math.max(0, level - 1) },
    (_, index) => ({ id: `n${index + 1}`, label: `Card node ${index + 2} · upper center` }),
  )
  return {
    ticketsSpent: SPARK_MATCH_TICKET_COST,
    trainingExpEarned: sparkReplay.outcome.trainingExp,
    trainingExpBefore: 0,
    trainingExpAfter: exp,
    trainingLevelBefore: 1,
    trainingLevelAfter: level,
    nodesUnlocked,
  }
}

export interface MinigameHostTestDoubleOptions {
  seedPrefix?: string
  reward?: RewardFactory
}

const cloneReward = (reward: RunReward): RunReward => ({
  ...reward,
  nodesUnlocked: reward.nodesUnlocked?.map((node) => ({ ...node })),
})

function cloneTestSnapshot(snapshot: SparkRunSnapshotV1): SparkRunSnapshotV1 {
  const encounter = parseSparkRivalEncounter(snapshot.encounter)
  if (!encounter) throw new Error('Synthetic Spark Rival snapshot is invalid')
  return {
    ...snapshot,
    encounter,
  }
}

/**
 * Stateful boundary double used until the save-v5 host is installed. It reserves at most one open run per target,
 * and memoizes a committed reward so a retry cannot grant progression twice.
 */
export class MinigameHostTestDouble implements MinigameHost {
  readonly beginCalls: Array<{ kind: MinigameKind; target: RunTarget }> = []
  readonly commitCalls: Array<{ runId: string; outcome: RunOutcome }> = []
  private readonly openByTarget = new Map<string, RunTicket>()
  private readonly targetsByRun = new Map<string, RunTarget>()
  private readonly rewardsByRun = new Map<string, RunReward>()
  private readonly sparkRuns = new Map<string, { snapshot: SparkRunSnapshotV1; actions: SparkRivalAction[] }>()
  private readonly attemptsByTarget = new Map<string, number>()
  private readonly seedPrefix: string
  private readonly rewardFactory: RewardFactory

  constructor(options: MinigameHostTestDoubleOptions = {}) {
    this.seedPrefix = options.seedPrefix ?? 'synthetic-minigame'
    this.rewardFactory = options.reward ?? defaultReward
  }

  private readonly progress = new Map<string, FtAction[]>()

  async loadRun(runId: string): Promise<SavedRun | null> {
    const setup = this.setups.get(runId)
    return setup ? { setup, actions: [...(this.progress.get(runId) ?? [])] } : null
  }

  async findOpenRun(target: RunTarget): Promise<RunTicket | null> {
    const open = this.openByTarget.get(targetKey(target))
    return open ? { ...open } : null
  }

  async saveProgress(runId: string, actions: readonly FtAction[]): Promise<void> {
    if (!this.openByTarget.has(targetKey(this.targetsByRun.get(runId) ?? { kind: 'spark-match', umaId: '' }))) {
      throw new Error('Minigame run is no longer active')
    }
    this.progress.set(runId, [...actions])
  }

  /** Test hook: the setup a Friendship Training run replays from. */
  readonly setups = new Map<string, FtSetup>()

  private sparkView(runId: string, ticket: RunTicket): SparkRunView {
    const run = this.sparkRuns.get(runId)
    if (!run) throw new Error('Unknown Spark Rival run')
    const snapshot = cloneTestSnapshot(run.snapshot)
    const actions = run.actions.map((action) => parseSparkRivalAction(action)!)
    return {
      ticket: { ...ticket },
      snapshot,
      actions,
      replay: replaySparkRival(snapshot.encounter, ticket.seed, actions),
    }
  }

  async loadSpark(runId: string): Promise<SparkRunView> {
    const target = this.targetsByRun.get(runId)
    const ticket = target ? this.openByTarget.get(targetKey(target)) : null
    if (!ticket || ticket.runId !== runId) throw new Error('Spark Rival run is no longer active')
    return this.sparkView(runId, ticket)
  }

  async appendSpark(runId: string, expectedActionCount: number, action: SparkRivalAction): Promise<SparkRunView> {
    const target = this.targetsByRun.get(runId)
    const ticket = target ? this.openByTarget.get(targetKey(target)) : null
    const run = this.sparkRuns.get(runId)
    if (!ticket || ticket.runId !== runId || !run) throw new Error('Spark Rival run is no longer active')
    if (run.actions.length !== expectedActionCount) throw new Error('Spark Rival action count changed; reload the run')
    const parsed = parseSparkRivalAction(action)
    if (!parsed) throw new Error('Spark Rival action is invalid')
    replaySparkRival(run.snapshot.encounter, ticket.seed, [...run.actions, parsed])
    run.actions.push(parsed)
    return this.sparkView(runId, ticket)
  }

  async beginRun(kind: MinigameKind, target: RunTarget): Promise<RunTicket> {
    this.beginCalls.push({ kind, target })
    if (kind !== target.kind) throw new Error('Minigame kind and target do not match')
    const key = targetKey(target)
    const existing = this.openByTarget.get(key)
    if (existing) return { ...existing }
    const attemptIndex = this.attemptsByTarget.get(key) ?? 0
    this.attemptsByTarget.set(key, attemptIndex + 1)
    const ticket = {
      runId: `test:${key}:${attemptIndex}`,
      seed: `${this.seedPrefix}:${key}:${attemptIndex}`,
      attemptIndex,
    }
    this.openByTarget.set(key, ticket)
    this.targetsByRun.set(ticket.runId, target)
    if (target.kind === 'spark-match') {
      this.sparkRuns.set(ticket.runId, {
        snapshot: {
          version: 1,
          contentVersion: 'synthetic-test-content',
          encounter: syntheticSparkEncounter(),
          source: 'fallback',
        },
        actions: [],
      })
    }
    return { ...ticket }
  }

  async commitRun(runId: string, outcome: RunOutcome): Promise<RunReward> {
    this.commitCalls.push({ runId, outcome })
    const existing = this.rewardsByRun.get(runId)
    if (existing) return cloneReward(existing)
    const target = this.targetsByRun.get(runId)
    if (!target) throw new Error('Unknown or expired minigame run')
    const ticket = this.openByTarget.get(targetKey(target))
    if (!ticket || ticket.runId !== runId) throw new Error('Minigame run is no longer active')
    validateMinigameOutcome(ticket, target, outcome)
    const setup = this.setups.get(runId)
    if (setup && outcome.kind === 'friendship-training') validateFriendshipOutcome(setup, outcome)
    let sparkReplay: SparkRivalReplay | null = null
    if (outcome.kind === 'spark-match') {
      const run = this.sparkRuns.get(runId)
      if (!run) throw new Error('Spark Rival run has no journal')
      sparkReplay = replaySparkRival(run.snapshot.encounter, ticket.seed, run.actions)
      if (!sparkReplay.outcome) throw new Error('This Spark Rival run is not finished')
      if (run.actions.length !== outcome.actionCount || sparkRivalStateHash(sparkReplay.state) !== outcome.stateHash) {
        throw new Error('Spark Rival replay claim is stale')
      }
    }
    const reward = this.rewardFactory(ticket, target, outcome, sparkReplay)
    const stored = cloneReward(reward)
    this.rewardsByRun.set(runId, stored)
    this.openByTarget.delete(targetKey(target))
    return cloneReward(stored)
  }
}

const unavailableHost: MinigameHost = {
  async beginRun() {
    throw new Error('Minigame save host is not ready')
  },
  async commitRun() {
    throw new Error('Minigame save host is not ready')
  },
  async loadRun() {
    throw new Error('Minigame save host is not ready')
  },
  async saveProgress() {
    throw new Error('Minigame save host is not ready')
  },
  async findOpenRun() {
    throw new Error('Minigame save host is not ready')
  },
}
let installedHost: MinigameHost = unavailableHost

/** Called by the save runtime once its real local-first host is available. */
export function installMinigameHost(host: MinigameHost): () => void {
  installedHost = host
  return () => {
    if (installedHost === host) installedHost = unavailableHost
  }
}

export const getMinigameHost = (): MinigameHost => installedHost
