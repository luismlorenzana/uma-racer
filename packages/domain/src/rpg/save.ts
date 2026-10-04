// Versioned RPG wire rows and deterministic entry identity (docs/technical/uma-rpg-implementation.md, T090).
import { DISTANCE_CATEGORIES, GRADES, STATS, STRATEGIES, SURFACES, type Aptitudes, type Stats } from '../types'
import {
  RPG_DEPTH_GATES, RPG_ELEMENTS, RPG_MAX_LEGACY_SLOTS, RPG_SKILL_MAX_LEVEL, RPG_TIER_MAX_LEVEL,
  RPG_WEAPONS, enrollRpgOutfit, rpgSkillKey, rpgTreePointsEarned, rpgTreePointsSpent,
  type RpgCoreStats, type RpgElement, type RpgProfile, type RpgSkill, type RpgSkillRef,
} from './rules'

export const RPG_SAVE_SCHEMA_VERSION = 1
export const RPG_PARTY_SIZE = 5
export const RPG_PRESET_COUNT = 5
export const RPG_MAX_TREE_NODES = 25
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

export interface RpgOutfitSaveV1 { schemaVersion: 1; profile: RpgProfile; projectionRevision: number }
export interface RpgPresetSlotV1 { outfitId: string; signature: RpgElement; loadout: RpgSkillRef[] }
export interface RpgPresetSaveV1 {
  schemaVersion: 1; presetId: string; name: string; slots: [RpgPresetSlotV1 | null, RpgPresetSlotV1 | null,
    RpgPresetSlotV1 | null, RpgPresetSlotV1 | null, RpgPresetSlotV1 | null]
  foregroundChapterId: string | null
}
export interface RpgFrozenMemberV1 {
  outfitId: string; tier: number; level: number; stats: RpgCoreStats; signature: RpgElement; skills: RpgSkillRef[]
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
export interface RpgPromotionEvidenceV1 {
  schemaVersion: 1; promotionId: string; outfitId: string; fromTier: number; toTier: number
  archive: RpgSkill[]; createdAt: number
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

export function parseRpgSkillRef(value: unknown): RpgSkillRef | null {
  if (!isRecord(value) || !exact(value, ['tier', 'weapon', 'element', 'depth', 'branch']) ||
    !isInt(value.tier, 1) || !RPG_WEAPONS.includes(value.weapon as RpgSkillRef['weapon']) ||
    !RPG_ELEMENTS.includes(value.element as RpgElement) || !isInt(value.depth, 1) || value.depth > 5) return null
  const branches = [['foundation'], ['focused', 'area'], ['committed', 'multi'], ['role', 'hybrid'], ['signature']]
  if (!branches[value.depth - 1]?.includes(value.branch as string)) return null
  return value as unknown as RpgSkillRef
}

function parseRpgSkill(value: unknown): RpgSkill | null {
  if (!isRecord(value) || !exact(value, ['tier', 'weapon', 'element', 'depth', 'branch', 'level']) ||
    !isInt(value.level, 1) || value.level > RPG_SKILL_MAX_LEVEL) return null
  const ref = parseRpgSkillRef({ tier: value.tier, weapon: value.weapon, element: value.element,
    depth: value.depth, branch: value.branch })
  return ref ? { ...ref, level: value.level } : null
}

export function parseRpgOutfitSave(value: unknown): RpgOutfitSaveV1 | null {
  if (!isRecord(value) || !exact(value, ['schemaVersion', 'profile', 'projectionRevision']) ||
    value.schemaVersion !== RPG_SAVE_SCHEMA_VERSION || !isInt(value.projectionRevision) || !isRecord(value.profile)) return null
  const profile = value.profile
  if (!exact(profile, ['outfitId', 'sourceContentVersion', 'baseStats', 'growthRates', 'sourceAptitudes',
    'affinities', 'style', 'weapon', 'defaultSignature', 'tier', 'level', 'exp', 'tree', 'legacy']) ||
    !isId(profile.outfitId) || !isId(profile.sourceContentVersion) || !parseStats(profile.baseStats) ||
    !parseStats(profile.growthRates, true) || !parseAptitudes(profile.sourceAptitudes) ||
    !isInt(profile.tier, 1) || !isInt(profile.level, 1) || profile.level > RPG_TIER_MAX_LEVEL ||
    !isInt(profile.exp) || !Array.isArray(profile.tree) || profile.tree.length > RPG_MAX_TREE_NODES ||
    !Array.isArray(profile.legacy) || profile.legacy.length > RPG_MAX_LEGACY_SLOTS || !isRecord(profile.affinities)) return null
  let enrolled: RpgProfile
  try {
    enrolled = enrollRpgOutfit({ outfit: { id: profile.outfitId, baseStats: profile.baseStats as Stats,
      growthRates: profile.growthRates as Stats, aptitudes: profile.sourceAptitudes as Aptitudes },
    contentVersion: profile.sourceContentVersion as string, style: profile.style as RpgProfile['style'],
    weapon: profile.weapon as RpgProfile['weapon'], defaultSignature: profile.defaultSignature as RpgElement })
  } catch { return null }
  const affinities = profile.affinities as Record<string, unknown>
  if (!exact(affinities, Object.keys(enrolled.affinities)) ||
    Object.keys(enrolled.affinities).some((key) => affinities[key] !== enrolled.affinities[key as RpgElement])) return null
  const tree = profile.tree.map(parseRpgSkill)
  const legacy = profile.legacy.map(parseRpgSkill)
  if (tree.some((skill) => skill === null) || legacy.some((skill) => skill === null)) return null
  const typedTree = tree as RpgSkill[]
  const typedLegacy = legacy as RpgSkill[]
  if (rpgTreePointsSpent(typedTree) > rpgTreePointsEarned(profile.level as number) ||
    new Set(typedTree.map(rpgSkillKey)).size !== typedTree.length ||
    new Set(typedLegacy.map(rpgSkillKey)).size !== typedLegacy.length) return null
  for (const skill of typedTree) {
    if (skill.tier !== profile.tier || skill.weapon !== profile.weapon ||
      !enrolled.affinities[skill.element] ||
      (enrolled.affinities[skill.element] === 'B' && skill.depth > 3) ||
      RPG_DEPTH_GATES[skill.depth - 1]! > profile.level ||
      (skill.depth > 1 && !typedTree.some((previous) => previous.element === skill.element && previous.depth === skill.depth - 1))) return null
  }
  if (typedLegacy.some((skill) => skill.tier >= (profile.tier as number) || skill.weapon !== profile.weapon ||
    !enrolled.affinities[skill.element])) return null
  return { schemaVersion: 1, profile: profile as unknown as RpgProfile,
    projectionRevision: value.projectionRevision as number }
}

export function parseRpgPresetSave(value: unknown): RpgPresetSaveV1 | null {
  if (!isRecord(value) || !exact(value, ['schemaVersion', 'presetId', 'name', 'slots', 'foregroundChapterId']) ||
    value.schemaVersion !== 1 || !isRpgPresetId(value.presetId) || typeof value.name !== 'string' ||
    value.name.trim().length < 1 || value.name.length > 40 || !Array.isArray(value.slots) ||
    value.slots.length !== RPG_PARTY_SIZE ||
    (value.foregroundChapterId !== null && !isShortId(value.foregroundChapterId))) return null
  const ids: string[] = []
  for (const slot of value.slots) {
    if (slot === null) continue
    if (!isRecord(slot) || !exact(slot, ['outfitId', 'signature', 'loadout']) || !isId(slot.outfitId) ||
      !RPG_ELEMENTS.includes(slot.signature as RpgElement) || !Array.isArray(slot.loadout) || slot.loadout.length > 7 ||
      slot.loadout.some((skill) => !parseRpgSkillRef(skill))) return null
    const keys = slot.loadout.map((skill) => rpgSkillKey(skill as RpgSkillRef))
    if (new Set(keys).size !== keys.length) return null
    ids.push(slot.outfitId)
  }
  if (new Set(ids).size !== ids.length) return null
  return value as unknown as RpgPresetSaveV1
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
      member.level > RPG_TIER_MAX_LEVEL || !parseCoreStats(member.stats) ||
      !RPG_ELEMENTS.includes(member.signature as RpgElement) || !Array.isArray(member.skills) ||
      member.skills.length > 7 || member.skills.some((skill) => !parseRpgSkillRef(skill))) return null
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

export function parseRpgPromotionEvidence(value: unknown): RpgPromotionEvidenceV1 | null {
  if (!isRecord(value) || !exact(value, ['schemaVersion', 'promotionId', 'outfitId', 'fromTier',
    'toTier', 'archive', 'createdAt']) || value.schemaVersion !== 1 || !isId(value.promotionId) ||
    !isId(value.outfitId) || !isInt(value.fromTier, 1) || value.toTier !== value.fromTier + 1 ||
    !isInt(value.createdAt) || !Array.isArray(value.archive) || value.archive.length > RPG_MAX_TREE_NODES ||
    value.archive.some((skill) => !parseRpgSkill(skill) || skill.tier !== value.fromTier)) return null
  return value as unknown as RpgPromotionEvidenceV1
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
