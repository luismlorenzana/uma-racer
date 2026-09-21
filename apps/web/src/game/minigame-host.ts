// Port between the independently shipped minigames and save-v5 progression (docs/tasks/M014-minigames.md).

export interface MinigameHost {
  /** Reserves a run: spends tickets, returns the deterministic seed. Rejects if tickets are short. */
  beginRun(kind: 'spark-match' | 'bond-recall', target: RunTarget): Promise<RunTicket>
  /** Commits a finished run atomically. Safe to call twice with the same runId. */
  commitRun(runId: string, outcome: RunOutcome): Promise<RunReward>
}

export interface RunTicket {
  runId: string
  seed: string
  attemptIndex: number
}

export type RunTarget =
  | { kind: 'spark-match'; umaId: string }
  | { kind: 'bond-recall'; cardId: string }

export type RunOutcome =
  | { kind: 'spark-match'; score: number; moves: number }
  | { kind: 'bond-recall'; cleared: boolean; mismatches: number }

export interface RunReward {
  ticketsSpent: number
  trainingLevelBefore?: number
  trainingLevelAfter?: number
  nodesUnlocked?: string[]
  limitBreakBefore?: number
  limitBreakAfter?: number
  couponGranted?: boolean
}

type RewardFactory = (ticket: RunTicket, target: RunTarget, outcome: RunOutcome) => RunReward

const targetKey = (target: RunTarget): string =>
  target.kind === 'spark-match' ? `spark-match:${target.umaId}` : `bond-recall:${target.cardId}`

const validateOutcome = (ticket: RunTicket, target: RunTarget, outcome: RunOutcome): void => {
  if (target.kind !== outcome.kind) throw new Error(`Run ${ticket.runId} received the wrong minigame outcome`)
  if (outcome.kind === 'spark-match') {
    if (!Number.isSafeInteger(outcome.score) || outcome.score < 0 || outcome.moves !== 25) {
      throw new Error('Spark Match outcomes require a nonnegative score and exactly 25 moves')
    }
    return
  }
  if (!Number.isSafeInteger(outcome.mismatches) || outcome.mismatches < 0) {
    throw new Error('Bond Recall outcomes require a nonnegative mismatch count')
  }
}

const sparkTargetExp = (level: number): number => 1_000 + 350 * (level - 1)

const defaultReward: RewardFactory = (_ticket, target, outcome) => {
  if (target.kind === 'bond-recall' && outcome.kind === 'bond-recall') {
    return { ticketsSpent: 10, limitBreakBefore: 0, limitBreakAfter: outcome.cleared ? 1 : 0, couponGranted: false }
  }
  if (target.kind !== 'spark-match' || outcome.kind !== 'spark-match') throw new Error('Mismatched test-double run')
  let level = 1
  let exp = outcome.score
  while (level < 10 && exp >= sparkTargetExp(level)) {
    exp -= sparkTargetExp(level)
    level += 1
  }
  const syntheticNames = ['First Light', 'Rising Arc', 'Bright Turn', 'Golden Line', 'North Star', 'Open Sky']
  const nodesUnlocked = Array.from(
    { length: Math.max(0, level - 1) },
    (_, index) => syntheticNames[index % syntheticNames.length]!,
  )
  return {
    ticketsSpent: 5,
    trainingLevelBefore: 1,
    trainingLevelAfter: level,
    nodesUnlocked,
  }
}

export interface MinigameHostTestDoubleOptions {
  seedPrefix?: string
  reward?: RewardFactory
}

/**
 * Stateful boundary double used until the save-v5 host is installed. It reserves at most one open run per target,
 * and memoizes a committed reward so a retry cannot grant progression twice.
 */
export class MinigameHostTestDouble implements MinigameHost {
  readonly beginCalls: Array<{ kind: 'spark-match' | 'bond-recall'; target: RunTarget }> = []
  readonly commitCalls: Array<{ runId: string; outcome: RunOutcome }> = []
  private readonly openByTarget = new Map<string, RunTicket>()
  private readonly targetsByRun = new Map<string, RunTarget>()
  private readonly rewardsByRun = new Map<string, RunReward>()
  private readonly attemptsByTarget = new Map<string, number>()
  private readonly seedPrefix: string
  private readonly rewardFactory: RewardFactory

  constructor(options: MinigameHostTestDoubleOptions = {}) {
    this.seedPrefix = options.seedPrefix ?? 'synthetic-minigame'
    this.rewardFactory = options.reward ?? defaultReward
  }

  async beginRun(kind: 'spark-match' | 'bond-recall', target: RunTarget): Promise<RunTicket> {
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
    return { ...ticket }
  }

  async commitRun(runId: string, outcome: RunOutcome): Promise<RunReward> {
    this.commitCalls.push({ runId, outcome })
    const existing = this.rewardsByRun.get(runId)
    if (existing) return { ...existing, nodesUnlocked: existing.nodesUnlocked ? [...existing.nodesUnlocked] : undefined }
    const target = this.targetsByRun.get(runId)
    if (!target) throw new Error('Unknown or expired minigame run')
    const ticket = this.openByTarget.get(targetKey(target))
    if (!ticket || ticket.runId !== runId) throw new Error('Minigame run is no longer active')
    validateOutcome(ticket, target, outcome)
    const reward = this.rewardFactory(ticket, target, outcome)
    const stored = { ...reward, nodesUnlocked: reward.nodesUnlocked ? [...reward.nodesUnlocked] : undefined }
    this.rewardsByRun.set(runId, stored)
    this.openByTarget.delete(targetKey(target))
    return { ...stored, nodesUnlocked: stored.nodesUnlocked ? [...stored.nodesUnlocked] : undefined }
  }
}

const previewHost = new MinigameHostTestDouble()
let installedHost: MinigameHost = previewHost

/** Called by the save-v5 integration once its real local-first host is available. */
export function installMinigameHost(host: MinigameHost): () => void {
  installedHost = host
  return () => {
    if (installedHost === host) installedHost = previewHost
  }
}

export const getMinigameHost = (): MinigameHost => installedHost
