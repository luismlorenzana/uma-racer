// API-side RPG wire validation. Kept independent of the ESM domain package (T090).
import type { EntityKind, LogKind } from './save.types'

export const RPG_ACTIONS = ['enroll', 'edit-preset', 'start-chapter', 'begin-battle', 'takeover',
  'battle-result', 'clear-chapter', 'promote', 'spend-inspiration'] as const
export type RpgAction = typeof RPG_ACTIONS[number]
export const RPG_MAX_GROUP_OPERATIONS = 20
const ID = /^[A-Za-z0-9_.:-]{1,120}$/
const SHORT = /^[A-Za-z0-9_.:-]{1,24}$/
const HASH = /^[a-f0-9]{64}$/
const SEED = /^[a-f0-9]{8}$/
const ELEMENTS = ['fire', 'ice', 'lightning', 'light', 'dark']
const WEAPONS = ['greatsword', 'spear', 'sword-shield', 'wizard-staff', 'cleric-staff', 'tome']
const STATS = ['speed', 'stamina', 'power', 'guts', 'wit']
const STYLES = ['front', 'pace', 'late', 'end']
const DISTANCES = ['sprint', 'mile', 'medium', 'long']
const GRADES = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G']
const ROLES: Record<string, string[]> = { front: ['greatsword'], pace: ['spear', 'sword-shield'],
  late: ['wizard-staff', 'cleric-staff'], end: ['tome'] }
const ELEMENTS_BY_DISTANCE: Record<string, string[]> = { sprint: ['dark', 'light'], mile: ['ice', 'light'],
  medium: ['fire', 'dark'], long: ['lightning', 'light'] }
const BRANCHES = [['foundation'], ['focused', 'area'], ['committed', 'multi'], ['role', 'hybrid'], ['signature']]

export const rpgRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
export const rpgInt = (value: unknown, min = 0): value is number => Number.isSafeInteger(value) && (value as number) >= min
export const rpgId = (value: unknown): value is string => typeof value === 'string' && ID.test(value)
const short = (value: unknown): value is string => typeof value === 'string' && SHORT.test(value)
const hash = (value: unknown): value is string => typeof value === 'string' && HASH.test(value)
export const rpgExact = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
const oneOf = (value: unknown, options: readonly string[]): boolean => typeof value === 'string' && options.includes(value)
const preset = (value: unknown): value is string => oneOf(value, ['party-1', 'party-2', 'party-3', 'party-4', 'party-5'])

function stats(value: unknown, growth = false): boolean {
  return rpgRecord(value) && rpgExact(value, STATS) && STATS.every((key) => growth
    ? typeof value[key] === 'number' && Number.isFinite(value[key]) && (value[key] as number) >= 0 && (value[key] as number) <= 1
    : rpgInt(value[key]))
}

function aptitudes(value: unknown): value is Record<string, Record<string, string>> {
  if (!rpgRecord(value) || !rpgExact(value, ['surface', 'distance', 'strategy'])) return false
  return ([['surface', ['turf', 'dirt']], ['distance', DISTANCES], ['strategy', STYLES]] as const).every(([group, keys]) =>
    rpgRecord(value[group]) && rpgExact(value[group] as Record<string, unknown>, keys) &&
    keys.every((key) => oneOf((value[group] as Record<string, unknown>)[key], GRADES)))
}

function skill(value: unknown, learned: boolean): boolean {
  if (!rpgRecord(value) || !rpgExact(value, learned ? ['tier', 'weapon', 'element', 'depth', 'branch', 'level'] :
    ['tier', 'weapon', 'element', 'depth', 'branch']) || !rpgInt(value.tier, 1) ||
    !oneOf(value.weapon, WEAPONS) || !oneOf(value.element, ELEMENTS) || !rpgInt(value.depth, 1) || value.depth > 5 ||
    !oneOf(value.branch, BRANCHES[(value.depth as number) - 1] ?? [])) return false
  return !learned || rpgInt(value.level, 1) && value.level <= 5
}
const skillKey = (value: Record<string, unknown>): string =>
  `${value.tier}:${value.weapon}:${value.element}:${value.depth}:${value.branch}`

function outfit(value: unknown): boolean {
  if (!rpgRecord(value) || !rpgExact(value, ['schemaVersion', 'profile', 'projectionRevision']) ||
    value.schemaVersion !== 1 || !rpgInt(value.projectionRevision) || !rpgRecord(value.profile)) return false
  const p = value.profile
  if (!rpgExact(p, ['outfitId', 'sourceContentVersion', 'baseStats', 'growthRates', 'sourceAptitudes',
    'affinities', 'style', 'weapon', 'defaultSignature', 'tier', 'level', 'exp', 'tree', 'legacy']) ||
    !rpgId(p.outfitId) || !rpgId(p.sourceContentVersion) || !stats(p.baseStats) || !stats(p.growthRates, true) ||
    !aptitudes(p.sourceAptitudes) || !oneOf(p.style, STYLES) ||
    !ROLES[p.style as string]?.includes(p.weapon as string) ||
    !oneOf(p.defaultSignature, ELEMENTS) || !rpgInt(p.tier, 1) || !rpgInt(p.level, 1) || p.level > 50 ||
    !rpgInt(p.exp) || !Array.isArray(p.tree) || p.tree.length > 25 ||
    !Array.isArray(p.legacy) || p.legacy.length > 2 || !rpgRecord(p.affinities)) return false
  const a = p.sourceAptitudes
  if (a.strategy?.[p.style as string] !== 'A') return false
  const expected: Record<string, string> = {}
  for (const distance of DISTANCES) {
    const grade = a.distance?.[distance]
    if (grade !== 'A' && grade !== 'B') continue
    for (const element of ELEMENTS_BY_DISTANCE[distance]!) {
      if (grade === 'A' || expected[element] !== 'A') expected[element] = grade
    }
  }
  if (!rpgExact(p.affinities, Object.keys(expected)) ||
    Object.keys(expected).some((key) => p.affinities && (p.affinities as Record<string, unknown>)[key] !== expected[key]) ||
    !expected[p.defaultSignature as string]) return false
  if (!p.tree.every((node: unknown) => skill(node, true)) || !p.legacy.every((node: unknown) => skill(node, true))) return false
  const tree = p.tree as Record<string, unknown>[]
  const legacy = p.legacy as Record<string, unknown>[]
  if (new Set(tree.map(skillKey)).size !== tree.length || new Set(legacy.map(skillKey)).size !== legacy.length ||
    tree.reduce((sum, node) => sum + (node.level as number), 0) > Math.floor((p.level as number) / 2)) return false
  return tree.every((node) => node.tier === p.tier && node.weapon === p.weapon && expected[node.element as string] &&
    (expected[node.element as string] === 'A' || (node.depth as number) <= 3) &&
    [2, 10, 20, 34, 50][(node.depth as number) - 1]! <= (p.level as number) &&
    ((node.depth as number) === 1 || tree.some((prior) => prior.element === node.element && prior.depth === (node.depth as number) - 1))) &&
    legacy.every((node) => (node.tier as number) < (p.tier as number) && node.weapon === p.weapon && expected[node.element as string])
}

function presetRow(value: unknown): boolean {
  if (!rpgRecord(value) || !rpgExact(value, ['schemaVersion', 'presetId', 'name', 'slots', 'foregroundChapterId']) ||
    value.schemaVersion !== 1 || !preset(value.presetId) || typeof value.name !== 'string' ||
    value.name.trim().length < 1 || value.name.length > 40 || !Array.isArray(value.slots) || value.slots.length !== 5 ||
    (value.foregroundChapterId !== null && !short(value.foregroundChapterId))) return false
  const ids: string[] = []
  for (const slot of value.slots) {
    if (slot === null) continue
    if (!rpgRecord(slot) || !rpgExact(slot, ['outfitId', 'signature', 'loadout']) || !rpgId(slot.outfitId) ||
      !oneOf(slot.signature, ELEMENTS) || !Array.isArray(slot.loadout) || slot.loadout.length > 7 ||
      !slot.loadout.every((node: unknown) => skill(node, false))) return false
    const loadout = slot.loadout as Record<string, unknown>[]
    if (new Set(loadout.map(skillKey)).size !== loadout.length) return false
    ids.push(slot.outfitId)
  }
  return new Set(ids).size === ids.length
}

function checkpoint(value: unknown): boolean {
  if (!rpgRecord(value) || !rpgExact(value, ['schemaVersion', 'presetId', 'chapterId', 'contentVersion', 'contentHash',
    'attemptIndex', 'attemptId', 'lastClearedNodeId', 'selectedPath', 'status', 'revision', 'frozenEntry']) ||
    value.schemaVersion !== 1 || !preset(value.presetId) || !short(value.chapterId) || !rpgId(value.contentVersion) ||
    !hash(value.contentHash) || !rpgInt(value.attemptIndex, 1) ||
    value.attemptId !== `rpg-attempt:${value.presetId}:${value.chapterId}:${value.attemptIndex}` ||
    (value.lastClearedNodeId !== null && !short(value.lastClearedNodeId)) || !Array.isArray(value.selectedPath) ||
    value.selectedPath.length > 64 || !value.selectedPath.every(short) ||
    !oneOf(value.status, ['not-started', 'at-checkpoint', 'in-battle', 'pending-result', 'cleared']) || !rpgInt(value.revision)) return false
  const frozen = value.frozenEntry
  if (frozen === null) return value.status !== 'in-battle' && value.status !== 'pending-result'
  if (!rpgRecord(frozen) || !rpgExact(frozen, ['entryId', 'nodeId', 'seed', 'contentHash', 'engineVersion',
    'enemyKitJson', 'party', 'retryOrdinal', 'leaseRevision']) || !short(frozen.nodeId) ||
    frozen.entryId !== `rpg-entry:${value.presetId}:${value.chapterId}:${value.attemptIndex}:${frozen.nodeId}` ||
    typeof frozen.seed !== 'string' || !SEED.test(frozen.seed) || frozen.contentHash !== value.contentHash ||
    !rpgInt(frozen.engineVersion, 1) || !rpgInt(frozen.retryOrdinal) || !rpgInt(frozen.leaseRevision) ||
    typeof frozen.enemyKitJson !== 'string' || frozen.enemyKitJson.length > 16_384 ||
    !Array.isArray(frozen.party) || frozen.party.length !== 5) return false
  try { if (!rpgRecord(JSON.parse(frozen.enemyKitJson))) return false } catch { return false }
  const ids: string[] = []
  for (const member of frozen.party) {
    if (!rpgRecord(member) || !rpgExact(member, ['outfitId', 'tier', 'level', 'stats', 'signature', 'skills']) ||
      !rpgId(member.outfitId) || !rpgInt(member.tier, 1) || !rpgInt(member.level, 1) || member.level > 50 ||
      !rpgRecord(member.stats) || !rpgExact(member.stats, [...STATS, 'atk', 'matk', 'initiative', 'pdef', 'mdef', 'dexterity', 'hp', 'mp']) ||
      Object.values(member.stats).some((stat) => !rpgInt(stat)) || !oneOf(member.signature, ELEMENTS) ||
      !Array.isArray(member.skills) || member.skills.length > 7 || !member.skills.every((node: unknown) => skill(node, false))) return false
    ids.push(member.outfitId)
  }
  return new Set(ids).size === ids.length
}

function result(value: unknown): boolean {
  if (!rpgRecord(value) || !rpgExact(value, ['schemaVersion', 'resultId', 'entryId', 'retryOrdinal', 'outcome',
    'stateHash', 'contentHash', 'contentVersion', 'memberExp', 'createdAt']) || value.schemaVersion !== 1 || !rpgId(value.entryId) ||
    !rpgInt(value.retryOrdinal) || value.resultId !== `${value.entryId}:retry-${value.retryOrdinal}` ||
    !oneOf(value.outcome, ['win', 'loss']) || !hash(value.stateHash) || !hash(value.contentHash) || !rpgId(value.contentVersion) ||
    !rpgInt(value.createdAt) || !Array.isArray(value.memberExp) || value.memberExp.length !== 5) return false
  const ids: string[] = []
  for (const member of value.memberExp) {
    if (!rpgRecord(member) || !rpgExact(member, ['outfitId', 'delta', 'beforeTier', 'beforeLevel', 'beforeExp',
      'afterTier', 'afterLevel', 'afterExp']) || !rpgId(member.outfitId) || !rpgInt(member.delta) ||
      !rpgInt(member.beforeTier, 1) || !rpgInt(member.afterTier, 1) || member.afterTier !== member.beforeTier ||
      !rpgInt(member.beforeLevel, 1) || !rpgInt(member.afterLevel, 1) || member.afterLevel > 50 ||
      member.afterLevel < member.beforeLevel || !rpgInt(member.beforeExp) || !rpgInt(member.afterExp) ||
      (value.outcome === 'loss' && (member.delta !== 0 || member.beforeLevel !== member.afterLevel ||
        member.beforeExp !== member.afterExp))) return false
    ids.push(member.outfitId)
  }
  return new Set(ids).size === ids.length
}

function promotion(value: unknown): boolean {
  return rpgRecord(value) && rpgExact(value, ['schemaVersion', 'promotionId', 'outfitId', 'fromTier',
    'toTier', 'archive', 'createdAt']) && value.schemaVersion === 1 && rpgId(value.promotionId) &&
    rpgId(value.outfitId) && rpgInt(value.fromTier, 1) && value.toTier === value.fromTier + 1 &&
    rpgInt(value.createdAt) && Array.isArray(value.archive) && value.archive.length <= 25 &&
    value.archive.every((node: unknown) => skill(node, true) && (node as Record<string, unknown>).tier === value.fromTier)
}

function receipt(value: unknown): boolean {
  return rpgRecord(value) && rpgExact(value, ['schemaVersion', 'commandId', 'action', 'payloadHash', 'applied',
    'appendedIds', 'createdAt']) && value.schemaVersion === 1 && rpgId(value.commandId) &&
    oneOf(value.action, RPG_ACTIONS) && hash(value.payloadHash) && rpgInt(value.createdAt) &&
    Array.isArray(value.applied) && value.applied.length <= RPG_MAX_GROUP_OPERATIONS &&
    value.applied.every((row: unknown) => rpgRecord(row) && rpgExact(row, ['kind', 'id', 'version']) &&
      oneOf(row.kind, ['rpgOutfits', 'rpgPresets', 'rpgCheckpoints', 'umas', 'items']) && rpgId(row.id) && rpgInt(row.version, 1)) &&
    Array.isArray(value.appendedIds) && value.appendedIds.length <= RPG_MAX_GROUP_OPERATIONS &&
    value.appendedIds.every(rpgId) && new Set(value.appendedIds).size === value.appendedIds.length &&
    new Set((value.applied as Array<{ kind: string; id: string }>).map((row) => `${row.kind}/${row.id}`)).size === value.applied.length
}

export function parseRpgEntity(kind: EntityKind, value: unknown): Record<string, unknown> | null {
  const valid = kind === 'rpgOutfits' ? outfit(value) : kind === 'rpgPresets' ? presetRow(value) :
    kind === 'rpgCheckpoints' ? checkpoint(value) : false
  return valid ? value as Record<string, unknown> : null
}

export function parseRpgLog(kind: LogKind, value: unknown): Record<string, unknown> | null {
  const valid = kind === 'rpgResults' ? result(value) : kind === 'rpgPromotions' ? promotion(value) :
    kind === 'rpgReceipts' ? receipt(value) : false
  return valid ? value as Record<string, unknown> : null
}

export function rpgEntityIdMatches(kind: EntityKind, id: string, data: Record<string, unknown>): boolean {
  if (kind === 'rpgOutfits') return (data.profile as Record<string, unknown>).outfitId === id
  if (kind === 'rpgPresets') return data.presetId === id
  if (kind === 'rpgCheckpoints') return id === `${data.presetId}:${data.chapterId}`
  return false
}

export function rpgLogIdMatches(kind: LogKind, id: string, data: Record<string, unknown>, createdAt: number): boolean {
  if (kind === 'rpgResults') return data.resultId === id && data.createdAt === createdAt
  if (kind === 'rpgPromotions') return data.promotionId === id && data.createdAt === createdAt
  if (kind === 'rpgReceipts') return data.commandId === id && data.createdAt === createdAt
  return false
}
