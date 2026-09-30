// Save-facing minigame reservation and authoritative commit port (docs/design/minigame-kit.md#2-the-run-lifecycle).

import {
  SPARK_MATCH_TICKET_COST,
  ftFinished,
  ftReplay,
  ftStateHash,
  parseFtAction,
  parseSparkRivalAction,
  parseSparkRivalEncounter,
  replaySparkRival,
  sparkRivalStateHash,
  syntheticSparkEncounter,
  trainingExpToNext,
  type FtAction,
  type FtSetup,
  type SparkRivalAction,
  type SparkRivalReplay,
} from '@racer/domain'
import type {
  FriendshipRunView,
  MinigameJournalAction,
  MinigameRunView,
  SparkRunSnapshotV1,
  SparkRunView,
} from './minigame-journal'

/** The minigames a run can begin in. Bond Recall is retired (D177); its stored rows keep their `bond-recall` kind. */
export type MinigameKind = 'spark-match' | 'friendship-training'

export interface MinigameHost {
  /** Reserves a run: spends tickets, returns the deterministic seed. Rejects if tickets are short. */
  beginRun(kind: MinigameKind, target: RunTarget): Promise<RunTicket>
  /** Commits a finished run atomically. Safe to call twice with the same runId. */
  commitRun(runId: string, outcome: RunOutcome): Promise<RunReward>
  /** The target's open run, if one is waiting to resume; never spends a ticket. */
  findOpenRun(target: RunTarget): Promise<RunTicket | null>
}

export interface RunTicket {
  runId: string
  seed: string
  attemptIndex: number
}

export type RunTarget =
  /** Which of her scenarios trains (D190); her current one when omitted. */
  | { kind: 'spark-match'; umaId: string; tier?: number }
  /** Retired (D177): only in stored history rows, never begun. */
  | { kind: 'bond-recall'; cardId: string; tier: number }
  /**
   * The run's partner cards, chosen for it (D199); without them, the default partners. `umaId` is read only from rows
   * stored before D199, when the deck came from an Uma's set.
   */
  | { kind: 'friendship-training'; cardId: string; tier: number; partnerIds?: string[]; umaId?: string | null }

export type RunOutcome =
  | { kind: 'spark-match'; engine: 'spark-rival-v1'; actionCount: number; stateHash: string }
  | { kind: 'bond-recall'; cleared: boolean; mismatches: number }
  | { kind: 'friendship-training'; engine: 'friendship-training-v1'; actionCount: number; stateHash: string }

/** Read-only history shape from the retired adjacent-swap engine. It can never be submitted again. */
export interface LegacySparkOutcome {
  kind: 'spark-match'
  score: number
  moves: number
}

export interface LegacyFriendshipOutcome {
  kind: 'friendship-training'
  cleared: boolean
  actions: FtAction[]
}

export type StoredRunOutcome = RunOutcome | LegacySparkOutcome | LegacyFriendshipOutcome

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
  /** Training EXP a run carried past TL10 into the bank (D212). */
  trainingExpBanked?: number
  /** Training Level-Up Tickets that deposit completed. */
  levelUpTicketsGranted?: number
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
    if (outcome.engine !== 'friendship-training-v1' || !Number.isSafeInteger(outcome.actionCount) ||
      outcome.actionCount < 0 || outcome.actionCount > 64 || !/^[a-f0-9]{8}$/.test(outcome.stateHash)) {
      throw new Error('Friendship Training outcomes require a bounded replay claim')
    }
    return
  }
  throw new Error('Bond Recall is retired: Bond opens Friendship Training')
}


const defaultReward: RewardFactory = (_ticket, target, outcome, sparkReplay) => {
  if (target.kind === 'friendship-training' && outcome.kind === 'friendship-training') {
    return { ticketsSpent: 1, starsBefore: 0, starsAfter: 1, couponGranted: false }
  }
  if (target.kind !== 'spark-match' || outcome.kind !== 'spark-match' || !sparkReplay?.outcome) {
    throw new Error('Mismatched test-double run')
  }
  let level = 1
  let exp = sparkReplay.outcome.trainingExp
  while (level < 10 && exp >= trainingExpToNext(level)) {
    exp -= trainingExpToNext(level)
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
 * Stateful boundary double for screens and contract tests. It reserves at most one open run per target and memoizes a
 * committed reward so a retry cannot grant progression twice.
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
  private readonly progress = new Map<string, FtAction[]>()

  constructor(options: MinigameHostTestDoubleOptions = {}) {
    this.seedPrefix = options.seedPrefix ?? 'synthetic-minigame'
    this.rewardFactory = options.reward ?? defaultReward
  }

  async findOpenRun(target: RunTarget): Promise<RunTicket | null> {
    const open = this.openByTarget.get(targetKey(target))
    return open ? { ...open } : null
  }

  /** Test hook: the setup a Friendship Training run replays from. */
  readonly setups = new Map<string, FtSetup>()

  private sparkView(runId: string, ticket: RunTicket): SparkRunView {
    const run = this.sparkRuns.get(runId)
    if (!run) throw new Error('Unknown Spark Rival run')
    const snapshot = cloneTestSnapshot(run.snapshot)
    const actions = run.actions.map((action) => parseSparkRivalAction(action)!)
    return {
      engine: 'spark-rival-v1',
      ticket: { ...ticket },
      snapshot,
      actions,
      replay: replaySparkRival(snapshot.encounter, ticket.seed, actions),
    }
  }

  private friendshipView(runId: string, ticket: RunTicket): FriendshipRunView {
    const setup = this.setups.get(runId)
    if (!setup) throw new Error('Unknown Friendship Training run')
    const actions = [...(this.progress.get(runId) ?? [])]
    return {
      engine: 'friendship-training-v1',
      ticket: { ...ticket },
      snapshot: { version: 1, setup },
      actions,
      replay: ftReplay(setup, actions),
    }
  }

  async load(runId: string): Promise<MinigameRunView> {
    const target = this.targetsByRun.get(runId)
    const ticket = target ? this.openByTarget.get(targetKey(target)) : null
    if (!target || !ticket || ticket.runId !== runId) throw new Error('Minigame run is no longer active')
    if (target.kind === 'spark-match') return this.sparkView(runId, ticket)
    if (target.kind === 'friendship-training') return this.friendshipView(runId, ticket)
    throw new Error('Bond Recall has no replay journal')
  }

  async append(runId: string, expectedActionCount: number, action: MinigameJournalAction): Promise<MinigameRunView> {
    const target = this.targetsByRun.get(runId)
    const ticket = target ? this.openByTarget.get(targetKey(target)) : null
    if (!target || !ticket || ticket.runId !== runId) throw new Error('Minigame run is no longer active')
    const current = await this.load(runId)
    if (current.actions.length !== expectedActionCount) throw new Error('Minigame action count changed; reload the run')
    if (current.engine === 'spark-rival-v1') {
      if (current.replay.outcome) throw new Error('This minigame run is already terminal')
      const parsed = parseSparkRivalAction(action)
      const run = this.sparkRuns.get(runId)
      if (!parsed || !run) throw new Error('Spark Rival action is invalid')
      replaySparkRival(run.snapshot.encounter, ticket.seed, [...run.actions, parsed])
      run.actions.push(parsed)
      return this.sparkView(runId, ticket)
    }
    if (ftFinished(current.replay)) throw new Error('This minigame run is already terminal')
    const parsed = parseFtAction(action)
    if (!parsed) throw new Error('Friendship Training action is invalid')
    const actions = [...current.actions, parsed]
    ftReplay(current.snapshot.setup, actions)
    this.progress.set(runId, actions)
    return this.friendshipView(runId, ticket)
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
    let sparkReplay: SparkRivalReplay | null = null
    if (outcome.kind === 'spark-match') {
      const run = this.sparkRuns.get(runId)
      if (!run) throw new Error('Spark Rival run has no journal')
      sparkReplay = replaySparkRival(run.snapshot.encounter, ticket.seed, run.actions)
      if (!sparkReplay.outcome) throw new Error('This Spark Rival run is not finished')
      if (run.actions.length !== outcome.actionCount || sparkRivalStateHash(sparkReplay.state) !== outcome.stateHash) {
        throw new Error('Spark Rival replay claim is stale')
      }
    } else if (outcome.kind === 'friendship-training') {
      const view = this.friendshipView(runId, ticket)
      if (!ftFinished(view.replay)) throw new Error('This Friendship Training run is not finished')
      if (view.actions.length !== outcome.actionCount || ftStateHash(view.replay) !== outcome.stateHash) {
        throw new Error('Friendship Training replay claim is stale')
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
