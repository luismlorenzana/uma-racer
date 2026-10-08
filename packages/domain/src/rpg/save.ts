// Versioned RPG wire rows and deterministic entry identity (docs/technical/uma-rpg-implementation.md, T090).
import { DISTANCE_CATEGORIES, GRADES, STATS, STRATEGIES, SURFACES, type Aptitudes, type Stats } from '../types'
import {
  RPG_CLASS_WEAPONS, RPG_CLASSES, RPG_MAX_ACTIVE_SLOTS, RPG_MAX_LEGACY_SLOTS, RPG_TIER_MAX_LEVEL, RPG_WEAPON_KINDS, RPG_WEAPONS,
  enrollRpgOutfit, rpgClassOptions, rpgNodeKey, validRpgTree,
  type RpgClass, type RpgCoreStats, type RpgNodeRef, type RpgProfile, type RpgWeapon, type RpgWeaponKind,
} from './rules'
import { rpgNode } from './catalog'

/** Class-era RPG rows (D282). Schema 1 and 2 rows still parse and migrate on the way in. */
export const RPG_SAVE_SCHEMA_VERSION = 3
export const RPG_PARTY_SIZE = 5
export const RPG_PRESET_COUNT = 5
/** Six branches of five core nodes plus six variants fit; the bound leaves headroom. */
export const RPG_MAX_TREE_NODES = 40
export const RPG_MAX_SELECTED_PATH = 64
export const RPG_MAX_ENEMY_KIT_CHARS = 16_384
export const RPG_MAX_GROUP_OPERATIONS = 20
export const RPG_COMMAND_ACTIONS = [
  'enroll', 'edit-preset', 'edit-outfit', 'start-chapter', 'choose-node', 'begin-battle', 'takeover',
  'battle-result', 'clear-chapter', 'promote', 'spend-inspiration',
] as const
export type RpgCommandAction = typeof RPG_COMMAND_ACTIONS[number]
export const RPG_CHECKPOINT_STATUSES = ['not-started', 'at-checkpoint', 'in-battle', 'pending-result', 'cleared'] as const
export type RpgCheckpointStatus = typeof RPG_CHECKPOINT_STATUSES[number]

const ID = /^[A-Za-z0-9_.:-]{1,120}$/
const SHORT_ID = /^[A-Za-z0-9_.:-]{1,24}$/
const HASH = /^[a-f0-9]{64}$/
const SEED = /^[a-f0-9]{8}$/
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isInt = (value: unknown, min = 0): value is number => Number.isSafeInteger(value) && (value as number) >= min
const isId = (value: unknown): value is string => typeof value === 'string' && ID.test(value)
const isShortId = (value: unknown): value is string => typeof value === 'string' && SHORT_ID.test(value)
const isHash = (value: unknown): value is string => typeof value === 'string' && HASH.test(value)
const exact = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))

export function rpgPresetId(index: number): string {
  if (!isInt(index, 1) || index > RPG_PRESET_COUNT) throw new RangeError('Invalid RPG preset number')
  return `party-${index}`
}

export function rpgCheckpointId(presetId: string, chapterId: string): string {
  if (!isRpgPresetId(presetId) || !isShortId(chapterId)) throw new RangeError('Invalid RPG checkpoint identity')
  return `${presetId}:${chapterId}`
}

export function rpgEntryId(presetId: string, chapterId: string, attemptIndex: number, nodeId: string): string {
  if (!isInt(attemptIndex, 1) || !isShortId(nodeId)) throw new RangeError('Invalid RPG encounter identity')
  return `rpg-entry:${rpgCheckpointId(presetId, chapterId)}:${attemptIndex}:${nodeId}`
}

export function rpgEncounterSeed(uid: string, presetId: string, chapterId: string, attemptIndex: number, nodeId: string): string {
  if (!isId(uid)) throw new RangeError('Invalid account identity')
  const identity = `${uid}:${rpgEntryId(presetId, chapterId, attemptIndex, nodeId)}`
  let hash = 2166136261
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function rpgResultId(entryId: string, retryOrdinal: number): string {
  if (!isId(entryId) || !isInt(retryOrdinal)) throw new RangeError('Invalid RPG result identity')
  const id = `${entryId}:retry-${retryOrdinal}`
  if (!isId(id)) throw new RangeError('RPG result identity is too long')
  return id
}

export interface RpgOutfitSave { schemaVersion: 3; profile: RpgProfile; projectionRevision: number }
/** A party slot: the outfit, its equipped skills and, for a Summoner, her Familiar's weapon form (D278). */
export interface RpgPresetSlot { outfitId: string; loadout: RpgNodeRef[]; familiar: RpgWeaponKind }
export interface RpgPresetSave {
  /** `foregroundChapterId` is the chapter the party last opened. */
  schemaVersion: 3; presetId: string; name: string; slots: [RpgPresetSlot | null, RpgPresetSlot | null,
    RpgPresetSlot | null, RpgPresetSlot | null, RpgPresetSlot | null]
  foregroundChapterId: string | null
}
/** First-map rows (T095–T099), retired history: kept so old rows still parse. */
export interface RpgFrozenMemberV1 {
  outfitId: string; tier: number; level: number; stats: RpgCoreStats; signature: string; skills: Record<string, unknown>[]
}
export interface RpgFrozenEntryV1 {
  entryId: string; nodeId: string; seed: string; contentHash: string; engineVersion: number
  enemyKitJson: string; party: RpgFrozenMemberV1[]; retryOrdinal: number; leaseRevision: number
}
export interface RpgCheckpointSaveV1 {
  schemaVersion: 1; presetId: string; chapterId: string; contentVersion: string; contentHash: string
  attemptIndex: number; attemptId: string; lastClearedNodeId: string | null; selectedPath: string[]
  status: RpgCheckpointStatus; revision: number; frozenEntry: RpgFrozenEntryV1 | null
}
export interface RpgResultEvidenceV1 {
  schemaVersion: 1; resultId: string; entryId: string; retryOrdinal: number; outcome: 'win' | 'loss'
  stateHash: string; contentHash: string; contentVersion: string
  memberExp: Array<{ outfitId: string; delta: number; beforeTier: number; beforeLevel: number; beforeExp: number
    afterTier: number; afterLevel: number; afterExp: number }>; createdAt: number
}
/** Schema 2 archives learned nodes (D282); schema 1 archived the element-tree skills. */
export interface RpgPromotionEvidence {
  schemaVersion: 1 | 2; promotionId: string; outfitId: string; fromTier: number; toTier: number
  archive: Array<RpgNodeRef | Record<string, unknown>>; createdAt: number
}
export interface RpgCommandReceiptV1 {
  schemaVersion: 1; commandId: string; action: RpgCommandAction; payloadHash: string
  applied: Array<{ kind: string; id: string; version: number }>; appendedIds: string[]; createdAt: number
}

const isRpgPresetId = (value: unknown): value is string =>
  typeof value === 'string' && Array.from({ length: RPG_PRESET_COUNT }, (_, i) => `party-${i + 1}`).includes(value)

function parseStats(value: unknown, growth = false): Stats | null {
  if (!isRecord(value) || !exact(value, STATS)) return null
  for (const key of STATS) {
    const number = value[key]
    if (growth ? typeof number !== 'number' || !Number.isFinite(number) || number < 0 || number > 1 : !isInt(number)) return null
  }
  return value as Stats
}

function parseAptitudes(value: unknown): Aptitudes | null {
  if (!isRecord(value) || !exact(value, ['surface', 'distance', 'strategy'])) return null
  for (const [group, keys] of [
    ['surface', SURFACES], ['distance', DISTANCE_CATEGORIES], ['strategy', STRATEGIES],
  ] as const) {
    const record = value[group]
    if (!isRecord(record) || !exact(record, keys) || keys.some((key) => !GRADES.includes(record[key] as typeof GRADES[number]))) return null
  }
  return value as unknown as Aptitudes
}

export function parseRpgNodeRef(value: unknown): RpgNodeRef | null {
  return isRecord(value) && exact(value, ['tier', 'id']) && isInt(value.tier, 1) && typeof value.id === 'string' && rpgNode(value.id)
    ? value as unknown as RpgNodeRef : null
}

const PROFILE_KEYS = ['outfitId', 'sourceContentVersion', 'baseStats', 'growthRates', 'sourceAptitudes',
  'classId', 'weapons', 'tier', 'level', 'exp', 'tree', 'legacy'] as const

export function parseRpgOutfitSave(value: unknown): RpgOutfitSave | null {
  if (!isRecord(value) || !exact(value, ['schemaVersion', 'profile', 'projectionRevision']) || value.schemaVersion !== 3 ||
    !isInt(value.projectionRevision) || !isRecord(value.profile)) return null
  const profile = value.profile
  if (!exact(profile, PROFILE_KEYS) || !isId(profile.outfitId) || !isId(profile.sourceContentVersion) ||
    !RPG_CLASSES.includes(profile.classId as RpgClass) || !Array.isArray(profile.weapons) ||
    profile.weapons.some((w) => !RPG_WEAPONS.includes(w as RpgWeapon)) ||
    !isInt(profile.tier, 1) || !isInt(profile.level, 1) || profile.level > RPG_TIER_MAX_LEVEL || !isInt(profile.exp) ||
    !Array.isArray(profile.tree) || profile.tree.length > RPG_MAX_TREE_NODES ||
    !Array.isArray(profile.legacy) || profile.legacy.length > RPG_MAX_LEGACY_SLOTS) return null
  try {
    enrollRpgOutfit({ outfit: { id: profile.outfitId, baseStats: profile.baseStats as Stats, growthRates: profile.growthRates as Stats,
      aptitudes: profile.sourceAptitudes as Aptitudes }, contentVersion: profile.sourceContentVersion,
    classId: profile.classId as RpgClass, weapons: profile.weapons as RpgWeapon[] })
  } catch { return null }
  if (!parseStats(profile.baseStats) || !parseStats(profile.growthRates, true) || !parseAptitudes(profile.sourceAptitudes) ||
    profile.tree.some((ref) => !parseRpgNodeRef(ref)) || profile.legacy.some((ref) => !parseRpgNodeRef(ref))) return null
  const typed = profile as unknown as RpgProfile
  if (!validRpgTree(typed) || new Set(typed.legacy.map(rpgNodeKey)).size !== typed.legacy.length ||
    typed.legacy.some((ref) => ref.tier >= typed.tier || !rpgNode(ref.id)?.skill)) return null
  return { schemaVersion: 3, profile: typed, projectionRevision: value.projectionRevision }
}

/**
 * D282: an outfit from before classes keeps its tier, level and EXP, takes the first class open to its running styles
 * with that class's first weapon set, and restarts its trees. The empty tree lets the owner re-pick once.
 */
export function migrateRpgOutfitSave(value: unknown): RpgOutfitSave | null {
  if (isRecord(value) && value.schemaVersion === 3) return parseRpgOutfitSave(value)
  if (!isRecord(value) || (value.schemaVersion !== 1 && value.schemaVersion !== 2) || !isInt(value.projectionRevision) ||
    !isRecord(value.profile)) return null
  const p = value.profile
  const aptitudes = parseAptitudes(p.sourceAptitudes)
  if (!isId(p.outfitId) || !isId(p.sourceContentVersion) || !parseStats(p.baseStats) || !parseStats(p.growthRates, true) ||
    !aptitudes || !isInt(p.tier, 1) || !isInt(p.level, 1) || p.level > RPG_TIER_MAX_LEVEL || !isInt(p.exp)) return null
  const classId = rpgClassOptions(aptitudes)[0]
  if (!classId) return null
  // Schema 1 rows predate the campaign reset (D263): they restart at Tier 1 Lv1 as that migration did.
  const fresh = value.schemaVersion === 1
  const profile: RpgProfile = { outfitId: p.outfitId, sourceContentVersion: p.sourceContentVersion, baseStats: p.baseStats as Stats,
    growthRates: p.growthRates as Stats, sourceAptitudes: aptitudes, classId, weapons: [...RPG_CLASS_WEAPONS[classId][0]!],
    tier: fresh ? 1 : p.tier, level: fresh ? 1 : p.level, exp: fresh ? 0 : p.exp, tree: [], legacy: [] }
  return parseRpgOutfitSave({ schemaVersion: 3, profile, projectionRevision: value.projectionRevision + 1 })
}

function parseSlot(slot: unknown): RpgPresetSlot | null {
  if (!isRecord(slot) || !exact(slot, ['outfitId', 'loadout', 'familiar']) || !isId(slot.outfitId) ||
    !RPG_WEAPON_KINDS.includes(slot.familiar as RpgWeaponKind) || !Array.isArray(slot.loadout) ||
    slot.loadout.length > RPG_MAX_ACTIVE_SLOTS || slot.loadout.some((ref) => !parseRpgNodeRef(ref) || !rpgNode((ref as RpgNodeRef).id)?.skill)) return null
  const keys = (slot.loadout as RpgNodeRef[]).map(rpgNodeKey)
  return new Set(keys).size === keys.length ? slot as unknown as RpgPresetSlot : null
}

export function parseRpgPresetSave(value: unknown): RpgPresetSave | null {
  if (!isRecord(value) || !exact(value, ['schemaVersion', 'presetId', 'name', 'slots', 'foregroundChapterId']) ||
    value.schemaVersion !== 3 || !isRpgPresetId(value.presetId) || typeof value.name !== 'string' ||
    value.name.trim().length < 1 || value.name.length > 40 || !Array.isArray(value.slots) ||
    value.slots.length !== RPG_PARTY_SIZE ||
    (value.foregroundChapterId !== null && !isShortId(value.foregroundChapterId))) return null
  const ids: string[] = []
  for (const slot of value.slots) {
    if (slot === null) continue
    const parsed = parseSlot(slot)
    if (!parsed) return null
    ids.push(parsed.outfitId)
  }
  return new Set(ids).size === ids.length ? value as unknown as RpgPresetSave : null
}

/** D282: parties keep their members and current chapter; loadouts clear with the trees and Familiars start as Greatsword. */
export function migrateRpgPresetSave(value: unknown): RpgPresetSave | null {
  if (isRecord(value) && value.schemaVersion === 3) return parseRpgPresetSave(value)
  if (!isRecord(value) || (value.schemaVersion !== 1 && value.schemaVersion !== 2) || !Array.isArray(value.slots) ||
    value.slots.length !== RPG_PARTY_SIZE) return null
  const slots = value.slots.map((slot: unknown) => isRecord(slot) && isId(slot.outfitId)
    ? { outfitId: slot.outfitId, loadout: [], familiar: 'greatsword' } : null)
  return parseRpgPresetSave({ schemaVersion: 3, presetId: value.presetId, name: value.name, slots,
    foregroundChapterId: value.schemaVersion === 2 ? value.foregroundChapterId : null })
}

function parseCoreStats(value: unknown): RpgCoreStats | null {
  const keys = [...STATS, 'atk', 'matk', 'initiative', 'pdef', 'mdef', 'dexterity', 'hp', 'mp']
  if (!isRecord(value) || !exact(value, keys) || keys.some((key) => !isInt(value[key]))) return null
  return value as unknown as RpgCoreStats
}

export function parseRpgCheckpointSave(value: unknown): RpgCheckpointSaveV1 | null {
  if (!isRecord(value) || !exact(value, ['schemaVersion', 'presetId', 'chapterId', 'contentVersion', 'contentHash',
    'attemptIndex', 'attemptId', 'lastClearedNodeId', 'selectedPath', 'status', 'revision', 'frozenEntry']) ||
    value.schemaVersion !== 1 || !isRpgPresetId(value.presetId) || !isShortId(value.chapterId) ||
    !isId(value.contentVersion) || !isHash(value.contentHash) || !isInt(value.attemptIndex, 1) ||
    value.attemptId !== `rpg-attempt:${value.presetId}:${value.chapterId}:${value.attemptIndex}` ||
    (value.lastClearedNodeId !== null && !isShortId(value.lastClearedNodeId)) ||
    !Array.isArray(value.selectedPath) || value.selectedPath.length > RPG_MAX_SELECTED_PATH ||
    value.selectedPath.some((id) => !isShortId(id)) ||
    !RPG_CHECKPOINT_STATUSES.includes(value.status as RpgCheckpointStatus) || !isInt(value.revision)) return null
  const frozen = value.frozenEntry
  if (frozen === null) return value.status === 'in-battle' || value.status === 'pending-result'
    ? null : value as unknown as RpgCheckpointSaveV1
  if (!isRecord(frozen) || !exact(frozen, ['entryId', 'nodeId', 'seed', 'contentHash', 'engineVersion',
    'enemyKitJson', 'party', 'retryOrdinal', 'leaseRevision']) || !isShortId(frozen.nodeId) ||
    frozen.entryId !== rpgEntryId(value.presetId, value.chapterId, value.attemptIndex as number, frozen.nodeId) ||
    (typeof frozen.seed !== 'string' || !SEED.test(frozen.seed)) || frozen.contentHash !== value.contentHash ||
    !isInt(frozen.engineVersion, 1) || !isInt(frozen.retryOrdinal) || !isInt(frozen.leaseRevision) ||
    typeof frozen.enemyKitJson !== 'string' || frozen.enemyKitJson.length > RPG_MAX_ENEMY_KIT_CHARS ||
    !Array.isArray(frozen.party) || frozen.party.length !== RPG_PARTY_SIZE) return null
  try {
    const kit: unknown = JSON.parse(frozen.enemyKitJson)
    if (!isRecord(kit)) return null
  } catch { return null }
  const ids: string[] = []
  for (const member of frozen.party) {
    if (!isRecord(member) || !exact(member, ['outfitId', 'tier', 'level', 'stats', 'signature', 'skills']) ||
      !isId(member.outfitId) || !isInt(member.tier, 1) || !isInt(member.level, 1) ||
      member.level > RPG_TIER_MAX_LEVEL || !parseCoreStats(member.stats) || typeof member.signature !== 'string' ||
      !Array.isArray(member.skills) || member.skills.length > 7 || member.skills.some((skill) => !isRecord(skill))) return null
    ids.push(member.outfitId)
  }
  if (new Set(ids).size !== ids.length) return null
  return value as unknown as RpgCheckpointSaveV1
}

export function parseRpgResultEvidence(value: unknown): RpgResultEvidenceV1 | null {
  if (!isRecord(value) || !exact(value, ['schemaVersion', 'resultId', 'entryId', 'retryOrdinal', 'outcome',
    'stateHash', 'contentHash', 'contentVersion', 'memberExp', 'createdAt']) || value.schemaVersion !== 1 ||
    !isId(value.entryId) || !isInt(value.retryOrdinal) || !isId(value.resultId) ||
    value.resultId !== `${value.entryId}:retry-${value.retryOrdinal}` ||
    !['win', 'loss'].includes(value.outcome as string) || !isHash(value.stateHash) ||
    !isHash(value.contentHash) || !isId(value.contentVersion) || !isInt(value.createdAt) || !Array.isArray(value.memberExp) ||
    value.memberExp.length !== RPG_PARTY_SIZE) return null
  const ids: string[] = []
  for (const member of value.memberExp) {
    if (!isRecord(member) || !exact(member, ['outfitId', 'delta', 'beforeTier', 'beforeLevel', 'beforeExp',
      'afterTier', 'afterLevel', 'afterExp']) || !isId(member.outfitId) || !isInt(member.delta) ||
      !isInt(member.beforeTier, 1) || !isInt(member.afterTier, 1) || member.afterTier !== member.beforeTier ||
      !isInt(member.beforeLevel, 1) || !isInt(member.afterLevel, 1) || member.afterLevel > RPG_TIER_MAX_LEVEL ||
      member.afterLevel < member.beforeLevel || !isInt(member.beforeExp) || !isInt(member.afterExp) ||
      (value.outcome === 'loss' && (member.delta !== 0 || member.beforeLevel !== member.afterLevel ||
        member.beforeExp !== member.afterExp))) return null
    ids.push(member.outfitId)
  }
  return new Set(ids).size === ids.length ? value as unknown as RpgResultEvidenceV1 : null
}

export function parseRpgPromotionEvidence(value: unknown): RpgPromotionEvidence | null {
  if (!isRecord(value) || !exact(value, ['schemaVersion', 'promotionId', 'outfitId', 'fromTier',
    'toTier', 'archive', 'createdAt']) || (value.schemaVersion !== 1 && value.schemaVersion !== 2) || !isId(value.promotionId) ||
    !isId(value.outfitId) || !isInt(value.fromTier, 1) || value.toTier !== value.fromTier + 1 ||
    !isInt(value.createdAt) || !Array.isArray(value.archive) || value.archive.length > RPG_MAX_TREE_NODES ||
    value.archive.some((entry) => !isRecord(entry) || entry.tier !== value.fromTier ||
      (value.schemaVersion === 2 && !parseRpgNodeRef(entry)))) return null
  return value as unknown as RpgPromotionEvidence
}

export function parseRpgCommandReceipt(value: unknown): RpgCommandReceiptV1 | null {
  if (!isRecord(value) || !exact(value, ['schemaVersion', 'commandId', 'action', 'payloadHash',
    'applied', 'appendedIds', 'createdAt']) || value.schemaVersion !== 1 || !isId(value.commandId) ||
    !RPG_COMMAND_ACTIONS.includes(value.action as RpgCommandAction) || !isHash(value.payloadHash) ||
    !isInt(value.createdAt) || !Array.isArray(value.applied) || value.applied.length > RPG_MAX_GROUP_OPERATIONS ||
    !Array.isArray(value.appendedIds) || value.appendedIds.length > RPG_MAX_GROUP_OPERATIONS ||
    value.appendedIds.some((id) => !isId(id)) || new Set(value.appendedIds).size !== value.appendedIds.length) return null
  for (const row of value.applied) {
    if (!isRecord(row) || !exact(row, ['kind', 'id', 'version']) ||
      !['rpgOutfits', 'rpgPresets', 'rpgCheckpoints', 'umas', 'items', 'inspirationBank'].includes(row.kind as string) ||
      !isId(row.id) || !isInt(row.version, 1)) return null
  }
  if (new Set(value.applied.map((row) => `${(row as Record<string, unknown>).kind}/${(row as Record<string, unknown>).id}`)).size !== value.applied.length) return null
  return value as unknown as RpgCommandReceiptV1
}
