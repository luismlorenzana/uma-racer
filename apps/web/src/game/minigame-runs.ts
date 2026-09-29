// Atomic minigame reservations and rewards (docs/design/minigames.md).

import {
  FRIENDSHIP_TRAINING_TICKET_COST,
  FT_SETUP_VERSION,
  MAX_STARS,
  MAX_SCENARIO_TIER,
  MAX_TRAINING_LEVEL,
  SPARK_MATCH_TICKET_COST,
  scenarioAt,
  addTrainingExp,
  advanceCardStars,
  buildFriendshipSetup,
  defaultFriendshipPartners,
  FT_SET_OTHERS,
  cardStars,
  ftFinished,
  ftReplay,
  ftStateHash,
  constellationTemplate,
  deriveUma,
  nodesUnlockedBetween,
  parseCardSave,
  parseFtAction,
  parseFtActions,
  parseFtSetup,
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
  type LedgerEntry,
  type PlayerProfile,
  type ScenarioTraining,
  type UmaSave,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { db, type MinigameRunRow } from './db'
import {
  MINIGAME_JOURNAL_ACTION_LIMIT,
  type FriendshipReplayJournalV1,
  type FriendshipRunSnapshotV1,
  type FriendshipRunView,
  type MinigameJournal,
  type MinigameJournalAction,
  type MinigameRunView,
  type ReplayJournalV1,
  type SparkReplayJournalV1,
  type SparkRunSnapshotV1,
  type SparkRunView,
} from './minigame-journal'
import {
  validateMinigameOutcome,
  type MinigameHost,
  type MinigameKind,
  type RunOutcome,
  type RunReward,
  type RunTarget,
  type RunTicket,
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

export function parseFriendshipRunSnapshot(value: unknown): FriendshipRunSnapshotV1 | null {
  if (!record(value) || !exactKeys(value, ['setup', 'version']) || value.version !== 1) return null
  const setup = parseFtSetup(value.setup)
  return setup ? { version: 1, setup } : null
}

export function parseFriendshipReplayJournal(value: unknown): FriendshipReplayJournalV1 | null {
  if (!record(value) || !exactKeys(value, ['actions', 'engine', 'format']) ||
    value.format !== 1 || value.engine !== 'friendship-training-v1') return null
  const actions = parseFtActions(value.actions, MINIGAME_JOURNAL_ACTION_LIMIT)
  return actions ? { format: 1, engine: 'friendship-training-v1', actions } : null
}

const asTicket = (run: MinigameRunRow): RunTicket => ({
  runId: run.id,
  seed: run.seed,
  attemptIndex: run.attemptIndex,
})

function sparkRunView(run: MinigameRunRow): SparkRunView {
  if (run.kind !== 'spark-match' || run.target.kind !== 'spark-match' || run.status !== 'open' ||
    run.seed.length < 1 || run.seed.length > 120) throw new Error('Spark Rival run row is invalid')
  const snapshot = parseSparkRunSnapshot(run.snapshot)
  const journal = parseSparkReplayJournal(run.journal)
  if (!snapshot || !journal || snapshot.encounter.scenarioTier !== run.tier ||
    snapshot.encounter.trainee.templateId !== run.target.umaId) {
    throw new Error('Spark Rival run replay data is malformed')
  }
  return {
    engine: 'spark-rival-v1',
    ticket: asTicket(run),
    snapshot,
    actions: journal.actions,
    replay: replaySparkRival(snapshot.encounter, run.seed, journal.actions),
  }
}

function friendshipRunView(run: MinigameRunRow): FriendshipRunView {
  if (run.kind !== 'friendship-training' || run.target.kind !== 'friendship-training' || run.status !== 'open' ||
    run.seed.length < 1 || run.seed.length > 120) throw new Error('Friendship Training run row is invalid')
  const snapshot = parseFriendshipRunSnapshot(run.snapshot)
  const journal = parseFriendshipReplayJournal(run.journal)
  if (!snapshot || !journal || snapshot.setup.tier !== run.tier ||
    snapshot.setup.mainCardId !== run.target.cardId || String(snapshot.setup.seed) !== run.seed) {
    throw new Error('Friendship Training run replay data is malformed; this saved run was kept for recovery')
  }
  return {
    engine: 'friendship-training-v1',
    ticket: asTicket(run),
    snapshot,
    actions: journal.actions,
    replay: ftReplay(snapshot.setup, journal.actions),
  }
}

interface MinigameEngineAdapter {
  engine: MinigameRunView['engine']
  view(run: MinigameRunRow): MinigameRunView
  append(view: MinigameRunView, action: MinigameJournalAction): MinigameRunView
  isTerminal(view: MinigameRunView): boolean
  stateHash(view: MinigameRunView): string
}

const sparkAdapter: MinigameEngineAdapter = {
  engine: 'spark-rival-v1',
  view: sparkRunView,
  append(view, action) {
    if (view.engine !== 'spark-rival-v1') throw new Error('Spark Rival journal adapter received the wrong run')
    const parsed = parseSparkRivalAction(action)
    if (!parsed) throw new Error('Spark Rival action is invalid')
    const actions = [...view.actions, parsed]
    return {
      ...view,
      actions,
      replay: replaySparkRival(view.snapshot.encounter, view.ticket.seed, actions),
    }
  },
  isTerminal: (view) => view.engine === 'spark-rival-v1' && view.replay.outcome !== null,
  stateHash: (view) => {
    if (view.engine !== 'spark-rival-v1') throw new Error('Spark Rival journal adapter received the wrong run')
    return sparkRivalStateHash(view.replay.state)
  },
}

const friendshipAdapter: MinigameEngineAdapter = {
  engine: 'friendship-training-v1',
  view: friendshipRunView,
  append(view, action) {
    if (view.engine !== 'friendship-training-v1') throw new Error('Friendship Training journal adapter received the wrong run')
    const parsed = parseFtAction(action)
    if (!parsed) throw new Error('Friendship Training action is invalid')
    const actions = [...view.actions, parsed]
    return {
      ...view,
      actions,
      replay: ftReplay(view.snapshot.setup, actions),
    }
  },
  isTerminal: (view) => view.engine === 'friendship-training-v1' && ftFinished(view.replay),
  stateHash: (view) => {
    if (view.engine !== 'friendship-training-v1') throw new Error('Friendship Training journal adapter received the wrong run')
    return ftStateHash(view.replay)
  },
}

const ENGINE_ADAPTERS = new Map<MinigameRunView['engine'], MinigameEngineAdapter>([
  [sparkAdapter.engine, sparkAdapter],
  [friendshipAdapter.engine, friendshipAdapter],
])

function adapterFor(run: MinigameRunRow): MinigameEngineAdapter {
  if (!record(run.journal) || typeof run.journal.engine !== 'string') {
    throw new Error('This minigame run has no readable replay journal; the saved row was kept for recovery')
  }
  const adapter = ENGINE_ADAPTERS.get(run.journal.engine as MinigameRunView['engine'])
  if (!adapter) throw new Error(`Minigame engine ${run.journal.engine} is not supported; update the app to recover this run`)
  return adapter
}

function minigameRunView(run: MinigameRunRow): MinigameRunView {
  return adapterFor(run).view(run)
}

export function minigameRunStateHash(view: MinigameRunView): string {
  return ENGINE_ADAPTERS.get(view.engine)!.stateHash(view)
}

/**
 * The scenario a Spark run trains: her current one once started, or any of her earlier trained units (D190), which
 * keep training toward Training Level 10.
 */
function sparkScenario(uma: UmaSave, tier: number): ScenarioTraining | null {
  const run = scenarioAt(uma, tier)
  if (!run) return null
  return run.tier < uma.unlockedTier || run.started ? run : null
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
  const scenario = sparkScenario(uma, tier)
  if (!scenario || scenario.trainingLevel >= MAX_TRAINING_LEVEL) {
    throw new Error('The reserved Spark Match scenario is no longer active')
  }
  const trainee = content.umas.byId.get(target.umaId)
  if (!trainee) throw new Error('Spark Match Uma content is missing')
  const cardSaves = new Map((await db.cards.toArray()).map((row) => [row.id, parsedCard(row.id, row.data)]))
  const derived = deriveUma({
    uma,
    tier,
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

async function adoptOpenRun(content: LoadedContent, id: string): Promise<MinigameRunRow> {
  const run = await db.minigameRuns.get(id)
  if (!run) throw new Error('Unknown minigame run')
  if (run.status !== 'open') throw new Error('This minigame run is already finished')
  if (run.snapshot !== undefined || run.journal !== undefined || run.kind !== 'spark-match' || run.target.kind !== 'spark-match') {
    // A partially present or malformed pair is corruption, never an invitation to silently reroll.
    minigameRunView(run)
    return run
  }
  const adopted: MinigameRunRow = {
    ...run,
    snapshot: await buildSparkSnapshot(content, run.target, run.tier, run.seed),
    journal: { format: 1, engine: 'spark-rival-v1', actions: [] },
  }
  minigameRunView(adopted)
  await db.minigameRuns.put(adopted)
  return adopted
}

/** Dexie-backed, adapter-driven compare-and-append journal; it never mutates the synced save. */
export class PersistentMinigameJournal implements MinigameJournal {
  constructor(private readonly content: LoadedContent) {}

  async load(id: string): Promise<MinigameRunView> {
    return db.transaction('rw', [db.umas, db.cards, db.minigameRuns], async () =>
      minigameRunView(await adoptOpenRun(this.content, id)))
  }

  async append(id: string, expectedActionCount: number, action: MinigameJournalAction): Promise<MinigameRunView> {
    if (!Number.isSafeInteger(expectedActionCount) || expectedActionCount < 0 ||
      expectedActionCount >= MINIGAME_JOURNAL_ACTION_LIMIT) {
      throw new Error('Minigame expected action count is invalid')
    }
    return db.transaction('rw', [db.umas, db.cards, db.minigameRuns], async () => {
      const run = await adoptOpenRun(this.content, id)
      const adapter = adapterFor(run)
      const current = adapter.view(run)
      if (current.actions.length !== expectedActionCount) {
        throw new Error('Minigame action count changed; the saved run must be restored')
      }
      if (adapter.isTerminal(current)) throw new Error('This minigame run is already terminal')
      const nextView = adapter.append(current, action)
      const next: MinigameRunRow = {
        ...run,
        journal: { format: 1, engine: nextView.engine, actions: [...nextView.actions] } as ReplayJournalV1,
      }
      await db.minigameRuns.put(next)
      return nextView
    })
  }
}

/**
 * Bond Recall retired at the cutover (D177). A run left open there can never finish, so it closes as retired and its
 * ticket comes back under `minigame-refund`. Idempotent: a run is closed and refunded once. Returns the tickets given back.
 */
export async function retireBondRecallRuns(now: number, today: string): Promise<number> {
  return retireOpenRuns(now, today, (run) => run.kind === 'bond-recall',
    () => ({ outcome: { kind: 'bond-recall', cleared: false, mismatches: 0 } }))
}

/**
 * A Friendship Training run frozen for the five-star ladder (setup version 1) cannot replay on the three-star one (D200),
 * so it closes and its ticket comes back, as D177 did for Bond Recall. Idempotent. Returns the tickets given back.
 */
export async function retireFiveStarFriendshipRuns(now: number, today: string): Promise<number> {
  const frozenForFiveStars = (run: MinigameRunRow) => {
    const setup = (run.snapshot as { setup?: { version?: unknown } } | undefined)?.setup
    return run.kind === 'friendship-training' && setup?.version !== FT_SETUP_VERSION
  }
  return retireOpenRuns(now, today, frozenForFiveStars, (run) => ({
    outcome: {
      kind: 'friendship-training',
      engine: 'friendship-training-v1',
      actionCount: (run.journal as { actions?: unknown[] } | undefined)?.actions?.length ?? 0,
      stateHash: '00000000',
    },
  }))
}

async function retireOpenRuns(
  now: number,
  today: string,
  retire: (run: MinigameRunRow) => boolean,
  closing: (run: MinigameRunRow) => Pick<MinigameRunRow, 'outcome'>,
): Promise<number> {
  return db.transaction('rw', [db.profile, db.ledger, db.outbox, db.minigameRuns], async () => {
    const open = (await db.minigameRuns.toArray()).filter((run) => run.status === 'open' && retire(run))
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
        ...closing(run),
        status: 'completed',
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
      const tier = target.tier ?? uma.unlockedTier
      if (!scenarioAt(uma, tier)) throw new Error('She has not unlocked that scenario')
      const scenario = sparkScenario(uma, tier)
      if (!scenario) throw new Error('Start this scenario before playing Spark Match')
      if (scenario.trainingLevel >= MAX_TRAINING_LEVEL) throw new Error('This constellation is already at Training Level 10')
      return { tier, key: targetKey(target, tier) }
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
      throw new Error(`This card already has ${MAX_STARS}★ in that scenario`)
    }
    if (target.partnerIds !== undefined) await this.validatePartners(target.partnerIds, target.cardId, target.tier)
    return { tier: target.tier, key: targetKey(target, target.tier) }
  }

  /** Partners must be owned, eligible in the scenario, distinct, not the main card, and at most five (D199). */
  private async validatePartners(partnerIds: readonly string[], mainCardId: string, tier: number): Promise<void> {
    if (!Array.isArray(partnerIds) || partnerIds.length > FT_SET_OTHERS || new Set(partnerIds).size !== partnerIds.length) {
      throw new Error(`Pick up to ${FT_SET_OTHERS} different partner cards`)
    }
    for (const id of partnerIds) {
      if (id === mainCardId) throw new Error('The trained card cannot also be its own partner')
      const template = typeof id === 'string' ? this.content.cards.byId.get(id) : undefined
      if (!template || !(await db.cards.get(id))) throw new Error('A partner card is not owned')
      if (template.era > tier) throw new Error(`${template.charName} is not available in that scenario`)
    }
  }

  /** The Friendship Training run's frozen setup: the chosen partners, else the default ones; never an Uma's set (D199). */
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
    const set = target.partnerIds ?? defaultFriendshipPartners({ tier, mainCardId: target.cardId, owned })
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
      // Runs stay on their device, but each one's ticket row syncs: after a reinstall, or on a second device, the ledger
      // remembers attempts this device has no row for. A new attempt takes the first index no earlier attempt spent.
      let attemptIndex = await db.minigameRuns.where('targetKey').equals(valid.key).count()
      while (await db.ledger.get(runId(target, valid.tier, attemptIndex)) || await db.minigameRuns.get(runId(target, valid.tier, attemptIndex))) {
        attemptIndex += 1
      }
      const id = runId(target, valid.tier, attemptIndex)
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
          ? {
              snapshot: { version: 1, setup: await this.friendshipSetup(target, valid.tier, seed) },
              journal: { format: 1, engine: 'friendship-training-v1', actions: [] },
            }
          : target.kind === 'spark-match'
            ? {
                snapshot: await buildSparkSnapshot(this.content, target, valid.tier, seed),
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
        if (outcome.kind === 'bond-recall') throw new Error('Bond Recall is retired: Bond opens Friendship Training')
        const view = minigameRunView(run)
        const adapter = ENGINE_ADAPTERS.get(view.engine)!
        if (!adapter.isTerminal(view)) throw new Error('This minigame run is not finished')
        if (view.actions.length !== outcome.actionCount || minigameRunStateHash(view) !== outcome.stateHash) {
          throw new Error('Minigame replay claim is stale; the saved run must be restored')
        }
        const profileRow = await db.profile.get('main')
        if (!profileRow) throw new Error('Local profile is missing')
        let profile = parsePlayerProfileOrThrow(profileRow.data)
        let result: RunReward
        let reconcileTrainer = false

        if (run.kind === 'spark-match' && run.target.kind === 'spark-match' && outcome.kind === 'spark-match' &&
          view.engine === 'spark-rival-v1') {
          if (!view.replay.outcome) throw new Error('This Spark Rival run is not finished')
          const umaRow = await db.umas.get(run.target.umaId)
          if (!umaRow) throw new Error('Spark Match Uma is not owned')
          const uma = parsedUma(run.target.umaId, umaRow.data)
          const scenario = sparkScenario(uma, run.tier)
          if (!scenario) throw new Error('The reserved Spark Match scenario is no longer active')
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
        } else if (run.kind === 'friendship-training' && run.target.kind === 'friendship-training' &&
          outcome.kind === 'friendship-training' && view.engine === 'friendship-training-v1') {
          const cleared = view.replay.phase === 'won'
          const cardRow = await db.cards.get(run.target.cardId)
          if (!cardRow) throw new Error('This card is not owned')
          const card = parsedCard(run.target.cardId, cardRow.data)
          const before = cardStars(card, run.tier)
          let nextCard = card
          let after = before
          let couponGranted = false
          if (cleared) {
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
