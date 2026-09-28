// Atomic minigame reservations and rewards (docs/design/minigames.md).

import {
  FRIENDSHIP_TRAINING_TICKET_COST,
  MAX_STARS,
  MAX_SCENARIO_TIER,
  MAX_TRAINING_LEVEL,
  SPARK_MATCH_TICKET_COST,
  activeScenario,
  addTrainingExp,
  advanceCardStars,
  buildFriendshipSetup,
  cardStars,
  ftReplay,
  constellationTemplate,
  deriveUma,
  nodesUnlockedBetween,
  parseCardSave,
  parsePlayerProfileOrThrow,
  parseSparkRivalAction,
  parseSparkRivalActions,
  parseSparkRivalEncounter,
  parseUmaSave,
  replaySparkRival,
  selectSparkEncounter,
  sparkRivalStateHash,
  buildSparkRivalEncounter,
  type CardSave,
  type ConstellationNode,
  type FtAction,
  type LedgerEntry,
  type PlayerProfile,
  type SparkRivalAction,
  type UmaSave,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { db, type MinigameRunRow } from './db'
import {
  type MinigameJournal,
  type SparkReplayJournalV1,
  type SparkRunSnapshotV1,
  type SparkRunView,
} from './minigame-journal'
import {
  validateFriendshipOutcome,
  validateMinigameOutcome,
  type MinigameHost,
  type MinigameKind,
  type RunOutcome,
  type RunReward,
  type RunTarget,
  type RunTicket,
  type SavedRun,
  type StoredRunReward,
} from './minigame-host'
import { updateTrainingBadgeFacts } from './badges'
import { queueInTransaction } from './persistence'
import { reconcileTrainerInTransaction } from './trainer'

const cloneReward = (reward: StoredRunReward): RunReward => ({
  ...reward,
  nodesUnlocked: reward.nodesUnlocked?.map((node) => typeof node === 'string'
    ? { id: '', label: node }
    : { ...node }),
})

const parsedUma = (id: string, value: unknown): UmaSave => {
  const uma = parseUmaSave(value)
  if (!uma || uma.templateId !== id) throw new Error(`Invalid local Uma save: ${id}`)
  return uma
}

const parsedCard = (id: string, value: unknown): CardSave => {
  const card = parseCardSave(value)
  if (!card || card.templateId !== id) throw new Error(`Invalid local card save: ${id}`)
  return card
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort()
  const wanted = [...expected].sort()
  return keys.length === wanted.length && keys.every((key, index) => key === wanted[index])
}

export function parseSparkRunSnapshot(value: unknown): SparkRunSnapshotV1 | null {
  if (!record(value) || !exactKeys(value, ['contentVersion', 'encounter', 'source', 'version']) || value.version !== 1 ||
    typeof value.contentVersion !== 'string' || value.contentVersion.length < 1 || value.contentVersion.length > 120 ||
    (value.source !== 'authored' && value.source !== 'fallback')) return null
  const encounter = parseSparkRivalEncounter(value.encounter)
  return encounter ? {
    version: 1,
    contentVersion: value.contentVersion,
    encounter,
    source: value.source,
  } : null
}

export function parseSparkReplayJournal(value: unknown): SparkReplayJournalV1 | null {
  if (!record(value) || !exactKeys(value, ['actions', 'engine', 'format']) ||
    value.format !== 1 || value.engine !== 'spark-rival-v1') return null
  const actions = parseSparkRivalActions(value.actions)
  return actions ? { format: 1, engine: 'spark-rival-v1', actions: [...actions] } : null
}

const asTicket = (run: MinigameRunRow): RunTicket => ({
  runId: run.id,
  seed: run.seed,
  attemptIndex: run.attemptIndex,
})

function sparkRunView(run: MinigameRunRow): SparkRunView {
  if (run.kind !== 'spark-match' || run.target.kind !== 'spark-match' || run.status !== 'open' ||
    run.seed.length < 1 || run.seed.length > 120) throw new Error('Spark Rival run row is invalid')
  const snapshot = parseSparkRunSnapshot(run.sparkSnapshot)
  const journal = parseSparkReplayJournal(run.journal)
  if (!snapshot || !journal || snapshot.encounter.scenarioTier !== run.tier ||
    snapshot.encounter.trainee.templateId !== run.target.umaId) {
    throw new Error('Spark Rival run replay data is malformed')
  }
  return {
    ticket: asTicket(run),
    snapshot,
    actions: journal.actions,
    replay: replaySparkRival(snapshot.encounter, run.seed, journal.actions),
  }
}

const targetKey = (target: RunTarget, tier: number): string => target.kind === 'spark-match'
  ? `spark-match:${target.umaId}:${tier}`
  : `${target.kind}:${target.cardId}:${tier}`

const TICKET_COST: Readonly<Record<MinigameKind, number>> = {
  'spark-match': SPARK_MATCH_TICKET_COST,
  'friendship-training': FRIENDSHIP_TRAINING_TICKET_COST,
}

const runId = (target: RunTarget, tier: number, attemptIndex: number): string =>
  `${targetKey(target, tier)}:${attemptIndex}`

/** Stable FNV-1a seed derived from the save, content and attempt identity. */
export function minigameAttemptSeed(
  createdAt: number,
  contentVersion: string,
  target: RunTarget,
  tier: number,
  attemptIndex: number,
): string {
  if (!Number.isSafeInteger(createdAt) || createdAt < 0 || !Number.isSafeInteger(tier) || tier < 1) {
    throw new Error('Invalid minigame seed identity')
  }
  if (!Number.isSafeInteger(attemptIndex) || attemptIndex < 0 || contentVersion.length === 0) {
    throw new Error('Invalid minigame seed options')
  }
  const identity = target.kind === 'spark-match' ? target.umaId : `${target.cardId}:${tier}`
  const text = `${createdAt}:${contentVersion}:${target.kind}:${identity}:${tier}:${attemptIndex}`
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  const seed = hash >>> 0
  return String(seed === 0 ? 1 : seed)
}

function positionHint(node: ConstellationNode): string {
  const vertical = node.y < 34 ? 'upper' : node.y > 66 ? 'lower' : 'middle'
  const horizontal = node.x < 34 ? 'left' : node.x > 66 ? 'right' : 'center'
  return vertical === 'middle' && horizontal === 'center' ? 'center' : `${vertical} ${horizontal}`
}

/** Human-readable constellation summary; internal node ids never reach the player. */
export function minigameNodeLabel(node: ConstellationNode): string {
  const kind = node.kind === 'parent' ? 'Parent' : node.kind === 'grandparent' ? 'Grandparent' :
    node.kind === 'card' ? 'Card' : node.kind === 'stat' ? 'Stat' : 'Root'
  const ordinal = node.kind === 'card' || node.kind === 'stat' ? ` ${node.order + 1}` : ''
  return `${kind} node${ordinal} · ${positionHint(node)}`
}

async function buildSparkSnapshot(
  content: LoadedContent,
  target: Extract<RunTarget, { kind: 'spark-match' }>,
  tier: number,
  seed: string,
): Promise<SparkRunSnapshotV1> {
  const umaRow = await db.umas.get(target.umaId)
  if (!umaRow) throw new Error('Spark Match Uma is not owned')
  const uma = parsedUma(target.umaId, umaRow.data)
  const scenario = activeScenario(uma)
  if (!scenario.started || scenario.tier !== tier || scenario.trainingLevel >= MAX_TRAINING_LEVEL) {
    throw new Error('The reserved Spark Match scenario is no longer active')
  }
  const trainee = content.umas.byId.get(target.umaId)
  if (!trainee) throw new Error('Spark Match Uma content is missing')
  const cardSaves = new Map((await db.cards.toArray()).map((row) => [row.id, parsedCard(row.id, row.data)]))
  const derived = deriveUma({
    uma,
    umaTemplate: trainee,
    cardSaves,
    cardTemplates: content.cards.byId,
    umaTemplates: content.umas.byId,
    skillTemplates: content.skills.byId,
  })
  const selection = selectSparkEncounter(content.sparkRivals, content.umas.items, trainee.charaId, tier, seed)
  return {
    version: 1,
    contentVersion: content.manifest.version,
    encounter: buildSparkRivalEncounter(
      selection,
      trainee,
      tier,
      scenario.trainingLevel,
      derived.aptitudes.strategy,
    ),
    source: selection.diagnostic.source,
  }
}

async function adoptOpenSparkRun(content: LoadedContent, id: string): Promise<MinigameRunRow> {
  const run = await db.minigameRuns.get(id)
  if (!run || run.kind !== 'spark-match' || run.target.kind !== 'spark-match') {
    throw new Error('Unknown Spark Rival run')
  }
  if (run.status !== 'open') throw new Error('This Spark Rival run is already finished')
  if (run.sparkSnapshot !== undefined || run.journal !== undefined) {
    // A partially present or malformed pair is corruption, never an invitation to silently reroll.
    sparkRunView(run)
    return run
  }
  const adopted: MinigameRunRow = {
    ...run,
    sparkSnapshot: await buildSparkSnapshot(content, run.target, run.tier, run.seed),
    journal: { format: 1, engine: 'spark-rival-v1', actions: [] },
  }
  sparkRunView(adopted)
  await db.minigameRuns.put(adopted)
  return adopted
}

/** Dexie-backed compare-and-append journal; it never mutates the synced save. */
export class PersistentMinigameJournal implements MinigameJournal {
  constructor(private readonly content: LoadedContent) {}

  async loadSpark(id: string): Promise<SparkRunView> {
    return db.transaction('rw', [db.umas, db.cards, db.minigameRuns], async () =>
      sparkRunView(await adoptOpenSparkRun(this.content, id)))
  }

  async appendSpark(id: string, expectedActionCount: number, action: SparkRivalAction): Promise<SparkRunView> {
    if (!Number.isSafeInteger(expectedActionCount) || expectedActionCount < 0) {
      throw new Error('Spark Rival expected action count is invalid')
    }
    return db.transaction('rw', [db.umas, db.cards, db.minigameRuns], async () => {
      const run = await adoptOpenSparkRun(this.content, id)
      const current = sparkRunView(run)
      if (current.actions.length !== expectedActionCount) {
        throw new Error('Spark Rival action count changed; the saved run must be restored')
      }
      if (current.replay.outcome) throw new Error('This Spark Rival run is already terminal')
      const parsed = parseSparkRivalAction(action)
      if (!parsed) throw new Error('Spark Rival action is invalid')
      const actions = [...current.actions, parsed]
      const replay = replaySparkRival(current.snapshot.encounter, current.ticket.seed, actions)
      const next: MinigameRunRow = {
        ...run,
        journal: { format: 1, engine: 'spark-rival-v1', actions },
      }
      await db.minigameRuns.put(next)
      return { ticket: current.ticket, snapshot: current.snapshot, actions, replay }
    })
  }
}

/**
 * Bond Recall retired at the cutover (D177). A run left open there can never finish, so it closes as retired and its
 * ticket comes back under `minigame-refund`. Idempotent: a run is closed and refunded once. Returns the tickets given back.
 */
export async function retireBondRecallRuns(now: number, today: string): Promise<number> {
  return db.transaction('rw', [db.profile, db.ledger, db.outbox, db.minigameRuns], async () => {
    const open = (await db.minigameRuns.toArray()).filter((run) => run.kind === 'bond-recall' && run.status === 'open')
    if (open.length === 0) return 0
    const profileRow = await db.profile.get('main')
    if (!profileRow) return 0
    let refunded = 0
    for (const run of open) {
      const spent = await db.ledger.get(run.id)
      const cost = spent ? Math.max(0, -(spent.data as LedgerEntry).delta) : 0
      const refundId = `${run.id}:refund`
      if (cost > 0 && !(await db.ledger.get(refundId))) {
        const refund: LedgerEntry = { resource: 'tickets', delta: cost, reason: 'minigame-refund', localDay: today, createdAt: now }
        await db.ledger.add({ id: refundId, data: refund, createdAt: now })
        await queueInTransaction('ledger', refundId, 'append', now)
        refunded += cost
      }
      await db.minigameRuns.put({
        ...run,
        status: 'completed',
        outcome: { kind: 'bond-recall', cleared: false, mismatches: 0 },
        reward: { ticketsSpent: 0 },
        completedAt: now,
      })
    }
    if (refunded > 0) {
      const profile = parsePlayerProfileOrThrow(profileRow.data)
      await db.profile.put({ ...profileRow, data: { ...profile, tickets: profile.tickets + refunded } })
      await queueInTransaction('profile', 'main', 'upsert', now)
    }
    return refunded
  })
}

export interface MinigameHostMutation {
  profile: PlayerProfile
  uma?: UmaSave
  card?: CardSave
}

export interface PersistentMinigameHostOptions {
  now?: () => number
  today?: () => string
  publish?: (mutation: MinigameHostMutation) => void
  afterMutation?: () => void | Promise<void>
}

interface ValidTarget {
  tier: number
  key: string
}

export class PersistentMinigameHost implements MinigameHost {
  private readonly now: () => number
  private readonly today: () => string
  private readonly publish: (mutation: MinigameHostMutation) => void
  private readonly afterMutation: () => void | Promise<void>

  constructor(private readonly content: LoadedContent, options: PersistentMinigameHostOptions = {}) {
    this.now = options.now ?? (() => Date.now())
    this.today = options.today ?? (() => {
      const date = new Date()
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    })
    this.publish = options.publish ?? (() => undefined)
    this.afterMutation = options.afterMutation ?? (() => undefined)
  }

  private async validateTarget(target: RunTarget): Promise<ValidTarget> {
    if (target.kind === 'spark-match') {
      const row = await db.umas.get(target.umaId)
      if (!row) throw new Error('Spark Match Uma is not owned')
      const uma = parsedUma(target.umaId, row.data)
      const scenario = activeScenario(uma)
      if (!scenario.started) throw new Error('Start this scenario before playing Spark Match')
      if (scenario.trainingLevel >= MAX_TRAINING_LEVEL) throw new Error('This constellation is already at Training Level 10')
      return { tier: scenario.tier, key: targetKey(target, scenario.tier) }
    }
    if (target.kind === 'bond-recall') throw new Error('Bond Recall is retired: Bond opens Friendship Training')
    const row = await db.cards.get(target.cardId)
    if (!row) throw new Error('This card is not owned')
    const card = parsedCard(target.cardId, row.data)
    const template = this.content.cards.byId.get(target.cardId)
    if (!template) throw new Error(`Card content is missing ${target.cardId}`)
    if (!Number.isSafeInteger(target.tier) || target.tier < 1 || target.tier > MAX_SCENARIO_TIER || template.era > target.tier) {
      throw new Error('This card is not available in that scenario')
    }
    if (cardStars(card, target.tier) >= MAX_STARS) {
      throw new Error('This card already has 5★ in that scenario')
    }
    return { tier: target.tier, key: targetKey(target, target.tier) }
  }

  /** The Friendship Training run's frozen setup: the deck from the named Uma's set, else the first set anyone holds there. */
  private async friendshipSetup(target: Extract<RunTarget, { kind: 'friendship-training' }>, tier: number, seed: string) {
    const mainCard = this.content.cards.byId.get(target.cardId)
    if (!mainCard) throw new Error(`Card content is missing ${target.cardId}`)
    const ownedRows = await db.cards.toArray()
    const owned = ownedRows
      .map((row) => parsedCard(row.id, row.data))
      .flatMap((card) => {
        const template = this.content.cards.byId.get(card.templateId)
        return template ? [{ template, stars: cardStars(card, tier) }] : []
      })
    const main = owned.find((entry) => entry.template.id === target.cardId) ?? { template: mainCard, stars: 0 }
    const umas = (await db.umas.toArray()).map((row) => parsedUma(row.id, row.data)).sort((left, right) => left.templateId.localeCompare(right.templateId))
    const named = target.umaId ? umas.find((uma) => uma.templateId === target.umaId)?.scenarios.find((run) => run.tier === tier) : undefined
    const any = umas.flatMap((uma) => uma.scenarios.filter((run) => run.tier === tier && run.cardSetIds.length > 0))[0]
    const set = (named && named.cardSetIds.length > 0 ? named : any)?.cardSetIds ?? []
    return buildFriendshipSetup({
      seed: Number(seed),
      tier,
      mainStars: main.stars,
      mainCard,
      setCardIds: set,
      owned,
      skills: this.content.skills.items,
      races: this.content.races.items,
    })
  }

  async findOpenRun(target: RunTarget): Promise<RunTicket | null> {
    let key: string
    try {
      key = (await this.validateTarget(target)).key
    } catch {
      return null
    }
    const open = await db.minigameRuns.where('[targetKey+status]').equals([key, 'open']).first()
    return open ? asTicket(open) : null
  }

  async loadRun(id: string): Promise<SavedRun | null> {
    const run = await db.minigameRuns.get(id)
    if (!run || run.kind !== 'friendship-training' || !run.setup) return null
    return { setup: run.setup, actions: [...(run.actions ?? [])] }
  }

  async saveProgress(id: string, actions: readonly FtAction[]): Promise<void> {
    await db.transaction('rw', [db.minigameRuns], async () => {
      const run = await db.minigameRuns.get(id)
      if (!run || run.kind !== 'friendship-training' || !run.setup) throw new Error('Unknown Friendship Training run')
      if (run.status !== 'open') throw new Error('This run is already finished')
      // Only choices the run accepts are kept: an invalid list throws here and never reaches the row.
      ftReplay(run.setup, actions)
      await db.minigameRuns.put({ ...run, actions: [...actions] })
    })
  }

  async beginRun(kind: MinigameKind, target: RunTarget): Promise<RunTicket> {
    if (kind !== target.kind) throw new Error('Minigame kind and target do not match')
    const now = this.now()
    const today = this.today()
    let nextProfile: PlayerProfile | null = null
    const ticket = await db.transaction('rw', [db.profile, db.umas, db.cards, db.ledger, db.outbox, db.minigameRuns], async () => {
      const profileRow = await db.profile.get('main')
      if (!profileRow) throw new Error('Local profile is missing')
      const profile = parsePlayerProfileOrThrow(profileRow.data)
      const valid = await this.validateTarget(target)
      const open = await db.minigameRuns.where('[targetKey+status]').equals([valid.key, 'open']).first()
      if (open) return asTicket(open)

      const cost = TICKET_COST[kind]
      if (profile.tickets < cost) throw new Error(`You need ${cost} Training Tickets to begin this run`)
      const attemptIndex = await db.minigameRuns.where('targetKey').equals(valid.key).count()
      const id = runId(target, valid.tier, attemptIndex)
      if (await db.ledger.get(id)) throw new Error('This minigame run was already recorded')
      const seed = minigameAttemptSeed(profile.createdAt, this.content.manifest.version, target, valid.tier, attemptIndex)
      const run: MinigameRunRow = {
        id,
        targetKey: valid.key,
        kind,
        target: { ...target },
        tier: valid.tier,
        attemptIndex,
        seed,
        status: 'open',
        outcome: null,
        reward: null,
        createdAt: now,
        completedAt: null,
        ...(target.kind === 'friendship-training'
          ? { setup: await this.friendshipSetup(target, valid.tier, seed), actions: [] }
          : target.kind === 'spark-match'
            ? {
                sparkSnapshot: await buildSparkSnapshot(this.content, target, valid.tier, seed),
                journal: { format: 1, engine: 'spark-rival-v1', actions: [] },
              }
            : {}),
      }
      nextProfile = { ...profile, tickets: profile.tickets - cost }
      const ledger: LedgerEntry = {
        resource: 'tickets',
        delta: -cost,
        reason: kind === 'spark-match' ? 'training' : 'card-limit-break',
        localDay: today,
        createdAt: now,
      }
      await db.profile.put({ ...profileRow, data: nextProfile })
      await db.ledger.add({ id, data: ledger, createdAt: now })
      await db.minigameRuns.add(run)
      await queueInTransaction('profile', 'main', 'upsert', now)
      await queueInTransaction('ledger', id, 'append', now)
      return asTicket(run)
    })
    if (nextProfile) {
      this.publish({ profile: nextProfile })
      await this.afterMutation()
    }
    return ticket
  }

  async commitRun(id: string, outcome: RunOutcome): Promise<RunReward> {
    const now = this.now()
    const today = this.today()
    let mutation: MinigameHostMutation | null = null
    const reward = await db.transaction(
      'rw',
      [db.profile, db.umas, db.cards, db.badges, db.raceResults, db.ledger, db.flairEvents, db.outbox, db.minigameRuns],
      async () => {
        const run = await db.minigameRuns.get(id)
        if (!run) throw new Error('Unknown or expired minigame run')
        if (run.status === 'completed') {
          if (!run.reward) throw new Error('Completed minigame run is missing its reward')
          return cloneReward(run.reward)
        }
        validateMinigameOutcome(asTicket(run), run.target, outcome)
        const profileRow = await db.profile.get('main')
        if (!profileRow) throw new Error('Local profile is missing')
        let profile = parsePlayerProfileOrThrow(profileRow.data)
        let result: RunReward
        let reconcileTrainer = false

        if (run.kind === 'spark-match' && run.target.kind === 'spark-match' && outcome.kind === 'spark-match') {
          const view = sparkRunView(run)
          if (!view.replay.outcome) throw new Error('This Spark Rival run is not finished')
          if (view.actions.length !== outcome.actionCount || sparkRivalStateHash(view.replay.state) !== outcome.stateHash) {
            throw new Error('Spark Rival replay claim is stale')
          }
          const umaRow = await db.umas.get(run.target.umaId)
          if (!umaRow) throw new Error('Spark Match Uma is not owned')
          const uma = parsedUma(run.target.umaId, umaRow.data)
          const scenario = activeScenario(uma)
          if (scenario.tier !== run.tier || !scenario.started) throw new Error('The reserved Spark Match scenario is no longer active')
          const gain = addTrainingExp(scenario.trainingLevel, scenario.trainingExp, view.replay.outcome.trainingExp)
          const nextScenario = { ...scenario, trainingLevel: gain.trainingLevel, trainingExp: gain.trainingExp }
          const nextUma = {
            ...uma,
            scenarios: uma.scenarios.map((entry) => entry.tier === run.tier ? nextScenario : entry),
          }
          const nodesUnlocked = nodesUnlockedBetween(
            constellationTemplate(run.tier),
            scenario.trainingLevel,
            gain.trainingLevel,
          ).map((node) => ({ id: node.id, label: minigameNodeLabel(node) }))
          result = {
            ticketsSpent: SPARK_MATCH_TICKET_COST,
            trainingExpEarned: view.replay.outcome.trainingExp,
            trainingExpBefore: scenario.trainingExp,
            trainingExpAfter: gain.trainingExp,
            trainingLevelBefore: scenario.trainingLevel,
            trainingLevelAfter: gain.trainingLevel,
            nodesUnlocked,
          }
          await db.umas.put({ ...umaRow, data: nextUma })
          await queueInTransaction('umas', nextUma.templateId, 'upsert', now)
          // The run counts toward her training badges, and a TL10 is her scenario's Fully Trained (T056).
          await updateTrainingBadgeFacts({ content: this.content, uma: nextUma, sourceId: id, now })
          mutation = { profile, uma: nextUma }
          reconcileTrainer = true
        } else if (run.kind === 'friendship-training' && run.target.kind === 'friendship-training' && outcome.kind === 'friendship-training') {
          if (!run.setup) throw new Error('This Friendship Training run has no setup')
          validateFriendshipOutcome(run.setup, outcome)
          const cardRow = await db.cards.get(run.target.cardId)
          if (!cardRow) throw new Error('This card is not owned')
          const card = parsedCard(run.target.cardId, cardRow.data)
          const before = cardStars(card, run.tier)
          let nextCard = card
          let after = before
          let couponGranted = false
          if (outcome.cleared) {
            const advance = advanceCardStars(card, run.tier)
            nextCard = advance.card
            after = advance.toStars
            couponGranted = advance.couponGranted
            // A star pays no tickets: the run cost one, and the star is the reward (D148).
            profile = { ...profile, cardCoupons: profile.cardCoupons + (advance.couponGranted ? 1 : 0) }
            if (advance.couponGranted) {
              const couponId = `${id}:coupon`
              const couponLedger: LedgerEntry = {
                resource: 'card-coupons',
                delta: 1,
                reason: 'card-max',
                localDay: today,
                createdAt: now,
              }
              await db.ledger.add({ id: couponId, data: couponLedger, createdAt: now })
              await queueInTransaction('ledger', couponId, 'append', now)
            }
            await db.profile.put({ ...profileRow, data: profile })
            await db.cards.put({ ...cardRow, data: nextCard })
            await queueInTransaction('profile', 'main', 'upsert', now)
            await queueInTransaction('cards', nextCard.templateId, 'upsert', now)
            mutation = { profile, card: nextCard }
            reconcileTrainer = true
          }
          result = {
            ticketsSpent: FRIENDSHIP_TRAINING_TICKET_COST,
            starsBefore: before,
            starsAfter: after,
            couponGranted,
          }
        } else {
          throw new Error('Minigame run and outcome do not match')
        }

        await db.minigameRuns.put({
          ...run,
          ...(outcome.kind === 'friendship-training' ? { actions: [...outcome.actions] } : {}),
          status: 'completed',
          outcome: { ...outcome },
          reward: cloneReward(result),
          completedAt: now,
        })
        if (reconcileTrainer) await reconcileTrainerInTransaction(this.content, now, false, id)
        return cloneReward(result)
      },
    )
    if (mutation) {
      this.publish(mutation)
      await this.afterMutation()
    }
    return reward
  }
}
