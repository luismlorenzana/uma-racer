// Device-local RPG battle journal and grouped result boundary (docs/technical/uma-rpg-implementation.md, T092).
import { applyAction, createEncounter, parseRpgCheckpointSave, parseRpgResultEvidence,
  projectRpgStats, replay, rpgCheckpointId, rpgEncounterSeed, rpgEntryId, rpgResultId,
  RPG_MAX_ENEMY_KIT_CHARS, RPG_MAX_ROUNDS, rpgEncounterExp, rpgRewardProjection, validRpgRewardInput,
  type CombatAction, type CombatCue, type CombatState, type EncounterInput, type RpgCheckpointSaveV1,
  validInspirationReward, type InspirationReward,
  type RpgCommandRequest, type RpgFrozenEntryV1, type RpgResultEvidenceV1, type RpgRewardInput, type RpgProfile } from '@racer/domain'
import { db, type PendingRpgCommandRow, type RpgBattleJournalRow, type VersionedRow, type RacerDb } from './db'
import { enqueueRpgCommand } from './rpg-sync'

type RpgBattleStatus =
  | { kind: 'open'; checkpoint: RpgCheckpointSaveV1; state: CombatState | null; actionCount: number;
      recovery: 'none' | 'restart-journal' | 'takeover-required' }
  | { kind: 'pending'; checkpoint: RpgCheckpointSaveV1; state: CombatState | null; phase: 'entry' | 'takeover' | 'result';
      recovery?: 'none' | 'restart-journal' }
  | { kind: 'conflict'; checkpoint: RpgCheckpointSaveV1; reason: string; state: CombatState | null }
  | { kind: 'frozen-content-unavailable'; checkpoint: RpgCheckpointSaveV1; reason: string }
  | { kind: 'loss'; checkpoint: RpgCheckpointSaveV1; resultId: string }
  | { kind: 'accepted'; checkpoint: RpgCheckpointSaveV1; resultId: string; outcome: 'win' | 'loss' }

/** Read-only replay projection, including acknowledged results whose checkpoint has already moved. */
export type RpgBattleView = RpgBattleStatus & {
  state: CombatState | null
  actionCount: number
  cues: CombatCue[]
  lastAction: CombatAction | null
  cueState: CombatState | null
  evidence: RpgResultEvidenceV1 | null
  previewEvidence?: RpgResultEvidenceV1 | null
  rewardProfiles?: RpgProfile[]
}

type BattleProjection = Pick<RpgBattleView, 'state' | 'actionCount' | 'cues' | 'lastAction' | 'cueState'>

function battleView(status: RpgBattleStatus, projection: BattleProjection | null = null,
  evidence: RpgResultEvidenceV1 | null = null): RpgBattleView {
  return { ...status, state: 'state' in status ? status.state : projection?.state ?? null,
    actionCount: projection?.actionCount ?? 0, cues: projection?.cues ?? [],
    lastAction: projection?.lastAction ?? null, cueState: projection?.cueState ?? null, evidence }
}

/** Validate the final state and capture its last cue step in one replay, not three full prefixes. */
function projectJournal(input: EncounterInput, journal: RpgBattleJournalRow): BattleProjection | null {
  const last = journal.actions.at(-1)
  const before = replay(input, last ? journal.actions.slice(0, -1) : [])
  if (before.error) return null
  const step = last ? applyAction(before.state, last) : before
  if (step.error || step.hash !== journal.stateHash ||
    !(journal.terminal === 'abandoned' || journal.terminal === 'open' && step.state.outcome === 'active' ||
      journal.terminal === 'win' && step.state.outcome === 'victory' ||
      journal.terminal === 'loss' && step.state.outcome === 'loss')) return null
  return { state: step.state, actionCount: journal.actions.length, cues: last ? step.cues : [],
    lastAction: last ?? null, cueState: last ? before.state : null }
}

export interface RpgBattleHost {
  enter(uid: string, checkpointId: string, nodeId: string, input?: EncounterInput, reward?: RpgRewardInput, inspiration?: InspirationReward): Promise<RpgBattleView>
  resume(checkpointId: string): Promise<RpgBattleView>
  submitAction(checkpointId: string, expectedActionCount: number, action: CombatAction): Promise<RpgBattleView>
  restartFromFrozenEntry(checkpointId: string): Promise<RpgBattleView>
  takeover(checkpointId: string): Promise<RpgBattleView>
  complete(checkpointId: string): Promise<RpgBattleView>
  abandonToCheckpoint(checkpointId: string): Promise<RpgBattleView>
}

const ACTION_ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/
const ENGINE_HASH = /^rpg-combat-v1:[a-f0-9]{8}$/
const exact = (value: Record<string, unknown>, keys: string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// Dictionary-decoded numeric keys can reorder objects. Compare values, never property insertion order.
function stableJson(value: unknown): string {
  const sorted = (part: unknown): unknown => Array.isArray(part) ? part.map(sorted)
    : record(part) ? Object.fromEntries(Object.keys(part).sort().map((key) => [key, sorted(part[key])])) : part
  return JSON.stringify(sorted(value))
}

// Versioned key/enum dictionary keeps a fully frozen five-member kit inside T090's 16,384-character wire bound.
// Only known schema keys/enums are shortened; authored names and actor identities remain byte-for-byte.
const KIT_KEYS = ['version', 'contentVersion', 'seed', 'allies', 'enemies', 'weaknessFollowUp',
  'id', 'style', 'weapon', 'tier', 'level', 'stats', 'affinities', 'signature', 'tree', 'legacy', 'loadout',
  'speed', 'stamina', 'power', 'guts', 'wit', 'atk', 'matk', 'initiative', 'pdef', 'mdef', 'dexterity',
  'hp', 'mp', 'element', 'depth', 'branch', 'moves', 'phaseTwo', 'thresholdPercent', 'kind',
  'channel', 'target', 'status', 'intentText'] as const
const KEY_TO_CODE = new Map<string, string>(KIT_KEYS.map((key, index) => [key, index.toString(36)]))
const CODE_TO_KEY = new Map<string, string>(KIT_KEYS.map((key, index) => [index.toString(36), key]))
const KIT_ENUMS: Record<string, readonly string[]> = {
  style: ['front', 'pace', 'late', 'end'],
  weapon: ['greatsword', 'spear', 'sword-shield', 'wizard-staff', 'cleric-staff', 'tome'],
  element: ['fire', 'ice', 'lightning', 'light', 'dark'],
  signature: ['fire', 'ice', 'lightning', 'light', 'dark'],
  branch: ['foundation', 'focused', 'area', 'committed', 'multi', 'role', 'hybrid', 'signature'],
  kind: ['damage', 'heal', 'guard', 'buff'],
  channel: ['physical', 'magical'],
  target: ['front', 'lowest-hp', 'seeded', 'self', 'lowest-hp-ally'],
  status: ['burn', 'slow', 'mark', 'ward', 'weaken', 'regen', 'power-up'],
  weaknessFollowUp: ['none', 'bounded'],
}
function mapKit(value: unknown, direction: 'encode' | 'decode'): unknown {
  if (Array.isArray(value)) return value.map((part) => mapKit(part, direction))
  if (record(value)) return Object.fromEntries(Object.entries(value).map(([rawKey, part]) => {
    const key = direction === 'decode' ? CODE_TO_KEY.get(rawKey) ?? rawKey : rawKey
    const values = KIT_ENUMS[key]
    const mapped = values && typeof part === 'string' ? (direction === 'encode'
      ? (values.indexOf(part) < 0 ? part : values.indexOf(part).toString(36))
      : values[Number.parseInt(part, 36)] ?? part) : mapKit(part, direction)
    return [direction === 'encode' ? KEY_TO_CODE.get(key) ?? key : key, mapped]
  }))
  return value
}
export function encodeKit(input: EncounterInput, reward?: RpgRewardInput, inspiration?: InspirationReward): string {
  if (reward && !validRpgRewardInput(reward)) throw new Error('Invalid frozen encounter reward')
  if (inspiration && (!reward || !validInspirationReward(inspiration))) throw new Error('Invalid frozen Inspiration reward')
  if (inspiration) return JSON.stringify({ format: 'rpg-combat-kit-v3', data: mapKit(input, 'encode'), reward, inspiration })
  return JSON.stringify(reward ? { format: 'rpg-combat-kit-v2', data: mapKit(input, 'encode'), reward }
    : { format: 'rpg-combat-kit-v1', data: mapKit(input, 'encode') })
}
export function decodeKit(value: string): EncounterInput {
  const kit: unknown = JSON.parse(value)
  if (!record(kit) || !(kit.format === 'rpg-combat-kit-v1' && exact(kit, ['format', 'data']) ||
    kit.format === 'rpg-combat-kit-v2' && exact(kit, ['format', 'data', 'reward']) && validRpgRewardInput(kit.reward) ||
    kit.format === 'rpg-combat-kit-v3' && exact(kit, ['format', 'data', 'reward', 'inspiration']) && validRpgRewardInput(kit.reward) && validInspirationReward(kit.inspiration)) || !record(kit.data)) {
    throw new Error('Frozen encounter kit is unavailable')
  }
  return mapKit(kit.data, 'decode') as EncounterInput
}
export function decodeReward(value: string): RpgRewardInput | null {
  decodeKit(value)
  const kit = JSON.parse(value) as { reward?: RpgRewardInput }
  return kit.reward ?? null // Pre-T096 entries retain their explicitly unrewarded v1 contract.
}
export function decodeInspirationReward(value: string): InspirationReward | null {
  decodeKit(value)
  return (JSON.parse(value) as { inspiration?: InspirationReward }).inspiration ?? null
}

async function digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), (part) => part.toString(16).padStart(2, '0')).join('')
}

export function rpgBattleJournalId(entry: RpgFrozenEntryV1): string {
  return rpgResultId(entry.entryId, entry.retryOrdinal)
}

function parseAction(value: unknown): CombatAction | null {
  if (!record(value) || !['attack', 'guard', 'skill', 'item'].includes(value.kind as string) ||
    typeof value.actorId !== 'string' || !ACTION_ID.test(value.actorId) ||
    typeof value.targetId !== 'string' || !ACTION_ID.test(value.targetId)) return null
  if (value.kind === 'attack' || value.kind === 'guard') {
    return exact(value, ['kind', 'actorId', 'targetId']) ? value as unknown as CombatAction : null
  }
  if (value.kind === 'item') {
    return exact(value, ['kind', 'actorId', 'targetId', 'itemId']) &&
      typeof value.itemId === 'string' && ACTION_ID.test(value.itemId) ? value as unknown as CombatAction : null
  }
  // The pure reducer validates the skill reference against the frozen actor's actual loadout.
  if (!exact(value, ['kind', 'actorId', 'targetId', 'skill']) || !record(value.skill) ||
    !exact(value.skill, ['tier', 'weapon', 'element', 'depth', 'branch'])) return null
  return value as unknown as CombatAction
}

function parseJournal(value: unknown, entry: RpgFrozenEntryV1, frozenHash: string): RpgBattleJournalRow | null {
  if (!record(value) || !exact(value, ['id', 'entryId', 'retryOrdinal', 'engineVersion', 'frozenHash', 'actions',
    'stateHash', 'terminal', 'commitStatus', 'createdAt', 'updatedAt']) ||
    value.id !== rpgBattleJournalId(entry) || value.entryId !== entry.entryId ||
    value.retryOrdinal !== entry.retryOrdinal || value.engineVersion !== 1 || value.frozenHash !== frozenHash ||
    !Array.isArray(value.actions) || value.actions.length > RPG_MAX_ROUNDS * 5 ||
    value.actions.some((action) => !parseAction(action)) || typeof value.stateHash !== 'string' ||
    !ENGINE_HASH.test(value.stateHash) || !['open', 'win', 'loss', 'abandoned'].includes(value.terminal as string) ||
    !['none', 'pending', 'accepted', 'conflict'].includes(value.commitStatus as string) ||
    !Number.isSafeInteger(value.createdAt) || (value.createdAt as number) < 0 ||
    !Number.isSafeInteger(value.updatedAt) || (value.updatedAt as number) < (value.createdAt as number)) return null
  return value as unknown as RpgBattleJournalRow
}

function frozenInput(entry: RpgFrozenEntryV1, checkpoint: RpgCheckpointSaveV1): EncounterInput {
  if (entry.engineVersion !== 1 || entry.contentHash !== checkpoint.contentHash) throw new Error('Frozen engine or content version is unavailable')
  const input = decodeKit(entry.enemyKitJson)
  if (input.version !== 1 || input.contentVersion !== checkpoint.contentVersion ||
    input.seed !== Number.parseInt(entry.seed, 16) ||
    input.allies?.length !== entry.party.length || entry.party.some((member, index) => {
      const ally = input.allies[index]
      return !ally || ally.id !== member.outfitId || ally.tier !== member.tier ||
        ally.level !== member.level || ally.signature !== member.signature ||
        stableJson(ally.stats) !== stableJson(member.stats) ||
        stableJson(ally.loadout) !== stableJson(member.skills)
    })) throw new Error('Frozen encounter differs from its entry')
  createEncounter(input)
  return input
}

function checkpointCommand(commandId: string, action: RpgCommandRequest['action'], row: VersionedRow<RpgCheckpointSaveV1>,
  next: RpgCheckpointSaveV1, extras: Pick<RpgCommandRequest, 'expected' | 'upserts' | 'appends'> =
    { expected: [], upserts: [], appends: [] }): RpgCommandRequest {
  return { schemaVersion: 1, commandId, action,
    expected: [{ kind: 'rpgCheckpoints', id: row.id, version: row.version }, ...extras.expected],
    upserts: [{ kind: 'rpgCheckpoints', id: row.id, data: next as unknown as Record<string, unknown> }, ...extras.upserts],
    appends: extras.appends }
}

function pendingCheckpoint(row: PendingRpgCommandRow): RpgCheckpointSaveV1 | null {
  const body = row.body as RpgCommandRequest
  const value = body.upserts.find((upsert) => upsert.kind === 'rpgCheckpoints')?.data
  return value ? parseRpgCheckpointSave(value) : null
}

async function pendingFor(checkpointId: string, database: RacerDb): Promise<PendingRpgCommandRow[]> {
  const rows = await database.pendingRpgCommands.toArray()
  return rows.filter((row) => (row.body as RpgCommandRequest).upserts?.some((upsert) =>
    upsert.kind === 'rpgCheckpoints' && upsert.id === checkpointId)).sort((a, b) => a.queuedAt - b.queuedAt)
}

function journalFor(input: EncounterInput, entry: RpgFrozenEntryV1, frozenHash: string, now: number): RpgBattleJournalRow {
  return { id: rpgBattleJournalId(entry), entryId: entry.entryId, retryOrdinal: entry.retryOrdinal,
    engineVersion: 1, frozenHash, actions: [], stateHash: createEncounter(input).hash, terminal: 'open',
    commitStatus: 'none', createdAt: now, updatedAt: now }
}

export class DexieRpgBattleHost implements RpgBattleHost {
  constructor(private readonly now: () => number = Date.now, private readonly database: RacerDb = db) {}

  private async context(checkpointId: string): Promise<{ acknowledged: VersionedRow<RpgCheckpointSaveV1>;
    checkpoint: RpgCheckpointSaveV1; pending: PendingRpgCommandRow[] }> {
    const acknowledged = await this.database.rpgCheckpoints.get(checkpointId)
    if (!acknowledged || !parseRpgCheckpointSave(acknowledged.data)) throw new Error('RPG checkpoint is unavailable')
    const pending = await pendingFor(checkpointId, this.database)
    const latest = [...pending].reverse().find((row) => row.status === 'pending' &&
      (row.body as RpgCommandRequest).action !== 'battle-result')
    const checkpoint = (latest && pendingCheckpoint(latest)) || acknowledged.data
    return { acknowledged, checkpoint, pending }
  }

  async enter(uid: string, checkpointId: string, nodeId: string, input?: EncounterInput, reward?: RpgRewardInput, inspiration?: InspirationReward): Promise<RpgBattleView> {
    const { acknowledged, checkpoint, pending } = await this.context(checkpointId)
    if (rpgCheckpointId(checkpoint.presetId, checkpoint.chapterId) !== checkpointId) throw new Error('Checkpoint identity mismatch')
    if (pending.length > 0) return this.resume(checkpointId)
    if (checkpoint.status === 'in-battle') return this.resume(checkpointId)
    if (checkpoint.status !== 'at-checkpoint') throw new Error('Battle can only begin at a checkpoint')
    let frozen = checkpoint.frozenEntry
    let combat: EncounterInput
    const retry = frozen !== null
    if (frozen) {
      if (frozen.nodeId !== nodeId) throw new Error('Retry must use the same frozen node')
      combat = frozenInput(frozen, checkpoint)
    } else {
      if (!input) throw new Error('New encounter needs a frozen combat kit')
      const seed = rpgEncounterSeed(uid, checkpoint.presetId, checkpoint.chapterId, checkpoint.attemptIndex, nodeId)
      combat = { ...input, seed: Number.parseInt(seed, 16), contentVersion: checkpoint.contentVersion }
      createEncounter(combat)
      const preset = await this.database.rpgPresets.get(checkpoint.presetId)
      if (!preset || preset.data.slots.some((slot) => slot === null)) throw new Error('Battle needs a complete preset')
      const slots = preset.data.slots
      const expected: RpgCommandRequest['expected'] = [{ kind: 'rpgPresets', id: preset.id, version: preset.version }]
      for (let index = 0; index < slots.length; index += 1) {
        const slot = slots[index]!
        const ally = combat.allies[index]
        const outfit = await this.database.rpgOutfits.get(slot!.outfitId)
        if (!outfit || !ally || ally.id !== slot!.outfitId || ally.signature !== slot!.signature ||
          JSON.stringify(ally.loadout) !== JSON.stringify(slot!.loadout) ||
          ally.style !== outfit.data.profile.style || ally.weapon !== outfit.data.profile.weapon ||
          ally.tier !== outfit.data.profile.tier || ally.level !== outfit.data.profile.level ||
          JSON.stringify(ally.stats) !== JSON.stringify(projectRpgStats(outfit.data.profile)) ||
          JSON.stringify(ally.affinities) !== JSON.stringify(outfit.data.profile.affinities) ||
          JSON.stringify(ally.tree) !== JSON.stringify(outfit.data.profile.tree) ||
          JSON.stringify(ally.legacy) !== JSON.stringify(outfit.data.profile.legacy)) {
          throw new Error('Battle party differs from its versioned preset and profiles')
        }
        expected.push({ kind: 'rpgOutfits', id: outfit.id, version: outfit.version })
      }
      const enemyKitJson = encodeKit(combat, reward, inspiration)
      if (enemyKitJson.length > RPG_MAX_ENEMY_KIT_CHARS) throw new Error('Frozen encounter exceeds the save kit bound')
      frozen = { entryId: rpgEntryId(checkpoint.presetId, checkpoint.chapterId, checkpoint.attemptIndex, nodeId),
        nodeId, seed, contentHash: checkpoint.contentHash, engineVersion: 1, enemyKitJson,
        party: combat.allies.map((ally) => ({ outfitId: ally.id, tier: ally.tier, level: ally.level,
          stats: ally.stats, signature: ally.signature, skills: ally.loadout })),
        retryOrdinal: 0, leaseRevision: 0 }
      const next: RpgCheckpointSaveV1 = { ...checkpoint, status: 'in-battle', revision: checkpoint.revision + 1,
        frozenEntry: frozen }
      const command = checkpointCommand(`rpg-begin:${rpgBattleJournalId(frozen)}`, 'begin-battle', acknowledged,
        next, { expected, upserts: [], appends: [] })
      const frozenHash = await digest(enemyKitJson)
      const now = this.now()
      await this.database.transaction('rw', [this.database.pendingRpgCommands, this.database.rpgBattleJournals, this.database.rpgBattleClaims], async () => {
        await enqueueRpgCommand(command, now, null, this.database)
        if (!await this.database.rpgBattleJournals.get(rpgBattleJournalId(frozen!))) {
          await this.database.rpgBattleJournals.add(journalFor(combat, frozen!, frozenHash, now))
        }
        await this.database.rpgBattleClaims.put({ id: rpgBattleJournalId(frozen!), leaseRevision: 0 })
      })
      return this.resume(checkpointId)
    }
    const next: RpgCheckpointSaveV1 = { ...checkpoint, status: 'in-battle', revision: checkpoint.revision + 1 }
    const command = checkpointCommand(`rpg-begin:${rpgBattleJournalId(frozen)}`, 'begin-battle', acknowledged, next)
    const frozenHash = await digest(frozen.enemyKitJson)
    const now = this.now()
    await this.database.transaction('rw', [this.database.pendingRpgCommands, this.database.rpgBattleJournals, this.database.rpgBattleClaims], async () => {
      await enqueueRpgCommand(command, now, null, this.database)
      if (!await this.database.rpgBattleJournals.get(rpgBattleJournalId(frozen))) {
        await this.database.rpgBattleJournals.add(journalFor(combat, frozen, frozenHash, now))
      }
      await this.database.rpgBattleClaims.put({ id: rpgBattleJournalId(frozen), leaseRevision: frozen.leaseRevision })
    })
    return this.resume(checkpointId)
  }

  private async projectEntry(entry: RpgFrozenEntryV1, checkpoint: RpgCheckpointSaveV1): Promise<BattleProjection | null> {
    try {
      const input = frozenInput(entry, checkpoint)
      const raw = await this.database.rpgBattleJournals.get(rpgBattleJournalId(entry))
      const journal = raw && parseJournal(raw, entry, await digest(entry.enemyKitJson))
      return journal ? projectJournal(input, journal) : null
    } catch { return null /* An accepted receipt remains authoritative without its local replay. */ }
  }

  private async rewards(view: RpgBattleView, evidence: RpgResultEvidenceV1 | null): Promise<RpgBattleView> {
    const rows = await Promise.all((evidence?.memberExp ?? []).map((m) => this.database.rpgOutfits.get(m.outfitId)))
    return { ...view, previewEvidence: view.kind === 'pending' ? evidence : null,
      rewardProfiles: rows.flatMap((row) => row ? [row.data.profile] : []) }
  }

  async resume(checkpointId: string): Promise<RpgBattleView> {
    const { acknowledged, checkpoint, pending } = await this.context(checkpointId)
    const conflicting = pending.find((row) => row.status === 'conflict')
    const result = pending.find((row) => (row.body as RpgCommandRequest).action === 'battle-result' && row.status === 'pending')
    const entry = checkpoint.frozenEntry
    if (conflicting) return battleView({ kind: 'conflict', checkpoint: acknowledged.data,
      reason: JSON.stringify(conflicting.conflict ?? 'RPG command conflicted'), state: null })
    if (!entry) throw new Error('No frozen battle at this checkpoint')
    const id = rpgBattleJournalId(entry)
    const accepted = await this.database.rpgResults.get(id)
    if (accepted) return this.rewards(battleView({ kind: 'accepted', checkpoint: acknowledged.data, resultId: id,
      outcome: accepted.data.outcome }, await this.projectEntry(entry, acknowledged.data), accepted.data), accepted.data)
    let input: EncounterInput
    let frozenHash: string
    try { input = frozenInput(entry, checkpoint); frozenHash = await digest(entry.enemyKitJson) }
    catch (error) { return battleView({ kind: 'frozen-content-unavailable', checkpoint, reason: String(error) }) }
    const raw = await this.database.rpgBattleJournals.get(id)
    const claim = await this.database.rpgBattleClaims.get(id)
    const journal = raw ? parseJournal(raw, entry, frozenHash) : null
    if (claim && claim.leaseRevision !== entry.leaseRevision) return battleView({ kind: 'conflict', checkpoint,
      reason: 'Battle lease changed; this device is stale', state: null })
    let projection: BattleProjection | null = null
    if (journal) {
      try { projection = projectJournal(input, journal) }
      catch { /* Corrupt journals stay on disk; recovery must be explicit. */ }
    }
    const state = projection?.state ?? null
    if (result) return this.rewards(battleView({ kind: 'pending', checkpoint, state, phase: 'result' }, projection),
      parseRpgResultEvidence((result.body as RpgCommandRequest).appends.find((a) => a.kind === 'rpgResults')?.data))
    const takeover = pending.find((row) => (row.body as RpgCommandRequest).action === 'takeover')
    if (takeover) return battleView({ kind: 'pending', checkpoint, state: null, phase: 'takeover' })
    if (checkpoint.status === 'at-checkpoint') {
      const previous = { ...entry, retryOrdinal: entry.retryOrdinal - 1 }
      const resultId = rpgBattleJournalId(previous)
      return battleView({ kind: 'loss', checkpoint, resultId }, await this.projectEntry(previous, checkpoint),
        (await this.database.rpgResults.get(resultId))?.data ?? null)
    }
    const begin = pending.find((row) => (row.body as RpgCommandRequest).action === 'begin-battle')
    if (journal?.terminal !== 'open' && journal && state) return battleView({ kind: 'pending', checkpoint, state, phase: 'result' }, projection)
    if (begin) return battleView({ kind: 'pending', checkpoint, state, phase: 'entry',
      recovery: state ? 'none' : claim?.leaseRevision === entry.leaseRevision ? 'restart-journal' : undefined }, projection)
    return battleView({ kind: 'open', checkpoint, state, actionCount: projection?.actionCount ?? 0,
      recovery: claim?.leaseRevision !== entry.leaseRevision ? 'takeover-required' :
        state ? 'none' : 'restart-journal' }, projection)
  }

  async submitAction(checkpointId: string, expectedActionCount: number, action: CombatAction): Promise<RpgBattleView> {
    if (!parseAction(action) || !Number.isSafeInteger(expectedActionCount) || expectedActionCount < 0) throw new Error('Invalid RPG action')
    const view = await this.resume(checkpointId)
    if ((view.kind !== 'open' && !(view.kind === 'pending' && view.phase === 'entry')) || !view.state ||
      (view.kind === 'open' && view.recovery !== 'none')) {
      throw new Error('Battle input is unavailable')
    }
    const entry = view.checkpoint.frozenEntry!
    const input = frozenInput(entry, view.checkpoint)
    const frozenHash = await digest(entry.enemyKitJson)
    const id = rpgBattleJournalId(entry)
    await this.database.transaction('rw', this.database.rpgBattleJournals, async () => {
      const current = await this.database.rpgBattleJournals.get(id)
      const journal = current && parseJournal(current, entry, frozenHash)
      if (!journal || journal.actions.length !== expectedActionCount || journal.terminal !== 'open') {
        throw new Error('Battle action count is stale or journal is unavailable')
      }
      const replayed = replay(input, journal.actions)
      if (replayed.error || replayed.hash !== journal.stateHash) throw new Error('Battle journal replay differs from its hash')
      const applied = applyAction(replayed.state, action)
      if (applied.error) throw new Error(`Illegal RPG action: ${applied.error}`)
      const terminal = applied.state.outcome === 'victory' ? 'win' : applied.state.outcome === 'loss' ? 'loss' : 'open'
      await this.database.rpgBattleJournals.put({ ...journal, actions: [...journal.actions, action], stateHash: applied.hash,
        terminal, updatedAt: Math.max(this.now(), journal.updatedAt) })
    })
    return this.resume(checkpointId)
  }

  async restartFromFrozenEntry(checkpointId: string): Promise<RpgBattleView> {
    const view = await this.resume(checkpointId)
    if (!((view.kind === 'open' || view.kind === 'pending' && view.phase === 'entry') &&
      view.recovery === 'restart-journal')) throw new Error('Journal restart is not available')
    const entry = view.checkpoint.frozenEntry!
    const input = frozenInput(entry, view.checkpoint)
    const now = this.now()
    await this.database.rpgBattleJournals.put(journalFor(input, entry, await digest(entry.enemyKitJson), now))
    return this.resume(checkpointId)
  }

  async takeover(checkpointId: string): Promise<RpgBattleView> {
    const { acknowledged, checkpoint, pending } = await this.context(checkpointId)
    if (pending.length > 0 || checkpoint.status !== 'in-battle' || !checkpoint.frozenEntry) throw new Error('Takeover needs an acknowledged open battle')
    const frozen = checkpoint.frozenEntry
    frozenInput(frozen, checkpoint)
    const id = rpgBattleJournalId(frozen)
    const localClaim = await this.database.rpgBattleClaims.get(id)
    const localJournal = await this.database.rpgBattleJournals.get(id)
    if (localClaim?.leaseRevision === frozen.leaseRevision && localJournal) {
      throw new Error('This device already owns the open battle; resume it instead')
    }
    const next: RpgCheckpointSaveV1 = { ...checkpoint, revision: checkpoint.revision + 1,
      frozenEntry: { ...frozen, leaseRevision: frozen.leaseRevision + 1 } }
    const command = checkpointCommand(`rpg-takeover:${rpgBattleJournalId(frozen)}:lease-${next.frozenEntry!.leaseRevision}`,
      'takeover', acknowledged, next)
    await this.database.transaction('rw', [this.database.pendingRpgCommands, this.database.rpgBattleClaims,
      this.database.rpgBattleJournals, this.database.rpgBattleArchives], async () => {
      await enqueueRpgCommand(command, this.now(), null, this.database)
      if (localJournal) {
        await this.database.rpgBattleArchives.put({ id: `${id}:lease-${frozen.leaseRevision}`,
          journal: { ...localJournal, commitStatus: 'conflict' }, reason: 'takeover' })
        await this.database.rpgBattleJournals.delete(id)
      }
      await this.database.rpgBattleClaims.put({ id, leaseRevision: next.frozenEntry!.leaseRevision })
    })
    return this.resume(checkpointId)
  }

  private async finish(checkpointId: string, abandon: boolean): Promise<RpgBattleView> {
    const { acknowledged, checkpoint, pending } = await this.context(checkpointId)
    const entry = checkpoint.frozenEntry
    if (!entry) throw new Error('No frozen battle')
    const resultId = rpgBattleJournalId(entry)
    const existing = await this.database.rpgResults.get(resultId)
    if (existing) return this.resume(checkpointId)
    if (checkpoint.status !== 'in-battle') throw new Error('No open frozen battle')
    if (pending.some((row) => (row.body as RpgCommandRequest).action === 'takeover' && row.status === 'pending')) {
      throw new Error('Takeover must be acknowledged before a result')
    }
    const claim = await this.database.rpgBattleClaims.get(resultId)
    if (!claim || claim.leaseRevision !== entry.leaseRevision) throw new Error('Battle lease is stale; take over explicitly')
    if (pending.some((row) => row.status === 'conflict')) return this.resume(checkpointId)
    if (pending.some((row) => row.id === resultId)) return this.resume(checkpointId)
    const input = frozenInput(entry, checkpoint)
    const frozenHash = await digest(entry.enemyKitJson)
    const raw = await this.database.rpgBattleJournals.get(resultId)
    const journal = raw && parseJournal(raw, entry, frozenHash)
    if (!journal) throw new Error('Battle journal is missing or corrupt')
    const step = replay(input, journal.actions)
    if (step.error || step.hash !== journal.stateHash) throw new Error('Battle journal hash mismatch')
    if (!abandon && step.state.outcome === 'active') throw new Error('Battle has not reached a terminal result')
    if (abandon && step.state.outcome !== 'active') throw new Error('A terminal battle must commit its actual result')
    const outcome = abandon ? 'loss' : step.state.outcome === 'victory' ? 'win' : 'loss'
    const next: RpgCheckpointSaveV1 = { ...checkpoint,
      revision: checkpoint.revision + 1, status: outcome === 'win' ? 'pending-result' : 'at-checkpoint',
      frozenEntry: outcome === 'win' ? entry : { ...entry, retryOrdinal: entry.retryOrdinal + 1 } }
    const now = this.now()
    const outfits = await Promise.all(entry.party.map(async (member) => {
      const row = await this.database.rpgOutfits.get(member.outfitId)
      if (!row) {
        throw new Error('Frozen outfit projection is unavailable')
      }
      return row
    }))
    const reward = decodeReward(entry.enemyKitJson)
    const grants = outfits.map((row, index) => rpgRewardProjection(row.data.profile,
      outcome === 'win' && reward ? rpgEncounterExp(reward, entry.party[index]!) : 0))
    const evidence: RpgResultEvidenceV1 = { schemaVersion: 1, resultId, entryId: entry.entryId,
      retryOrdinal: entry.retryOrdinal, outcome, stateHash: await digest(abandon ? `abandon:${step.hash}` : step.hash),
      contentHash: checkpoint.contentHash, contentVersion: checkpoint.contentVersion,
      memberExp: grants.map((grant) => grant.member), createdAt: now }
    if (!parseRpgResultEvidence(evidence)) throw new Error('Battle result evidence is invalid')
    const virtualVersion = acknowledged.version + pending.filter((row) => row.status === 'pending' &&
      (row.body as RpgCommandRequest).action !== 'battle-result').length
    const command = checkpointCommand(resultId, 'battle-result', { ...acknowledged, version: virtualVersion }, next,
      { expected: outfits.map((row) => ({ kind: 'rpgOutfits' as const, id: row.id,
        version: row.version })), upserts: outcome === 'win' && reward?.baseExp ? outfits.map((row, index) => ({
          kind: 'rpgOutfits' as const, id: row.id, data: { ...row.data, profile: grants[index]!.profile,
            projectionRevision: row.data.projectionRevision + 1 } as unknown as Record<string, unknown> })) : [],
        appends: [{ kind: 'rpgResults', id: resultId, data: evidence as unknown as Record<string, unknown>, createdAt: now }] })
    const dependency = pending.filter((row) => row.status === 'pending' &&
      (row.body as RpgCommandRequest).action !== 'battle-result').at(-1)?.id ?? null
    await this.database.transaction('rw', [this.database.rpgBattleJournals, this.database.pendingRpgCommands], async () => {
      const fresh = await this.database.rpgBattleJournals.get(resultId)
      if (!fresh || fresh.actions.length !== journal.actions.length || fresh.stateHash !== journal.stateHash) {
        throw new Error('Battle journal changed before result reservation')
      }
      await enqueueRpgCommand(command, now, dependency, this.database)
      await this.database.rpgBattleJournals.put({ ...journal, terminal: abandon ? 'abandoned' : journal.terminal,
        commitStatus: 'pending', updatedAt: Math.max(now, journal.updatedAt) })
    })
    return this.resume(checkpointId)
  }

  complete(checkpointId: string): Promise<RpgBattleView> { return this.finish(checkpointId, false) }
  abandonToCheckpoint(checkpointId: string): Promise<RpgBattleView> { return this.finish(checkpointId, true) }
}
