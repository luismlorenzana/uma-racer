// Immutable chapter graph and receipt-gated map rules (docs/design/uma-rpg.md, T095).
import { SCENARIOS } from '../scenarios'
import { DISTANCE_CATEGORIES, SURFACES, type DistanceCategory, type Surface } from '../types'
import { RPG_ELEMENTS, type RpgElement } from './rules'
import { RPG_MAX_ENCOUNTER_EXP } from './rewards'
import { elementMatchup } from './combat/catalog'
import type { EnemyMove, FrozenEnemy } from './combat/types'
import { RPG_MAX_SELECTED_PATH, rpgResultId, type RpgCheckpointSaveV1, type RpgResultEvidenceV1 } from './save'

export type RpgNodeKind = 'encounter' | 'elite' | 'boss' | 'branch' | 'recovery' | 'checkpoint'
export interface RpgChapterActor { id: string; name: string; role: string; artKey: string; combat: FrozenEnemy }
export interface RpgChapterNode { id: string; name: string; kind: RpgNodeKind; detail: string; enemies: string[]; exits: string[]; baseExp?: number }
export interface RpgChapter {
  id: string; scenarioId: string; title: string; contentVersion: string; contentHash: string
  recommendedTier: number; recommendedLevel: number; surface: Surface; distance: DistanceCategory
  startNodeId: string; bossNodeId: string; nodes: RpgChapterNode[]
}
export interface RpgChapterPack { schemaVersion: 1; version: string; contentHash: string; actors: RpgChapterActor[]; chapters: RpgChapter[] }
export interface RpgChapterSource { version: string; contentHash: string; artKeys: readonly string[] }
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const exact = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k))
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_.:-]{1,24}$/.test(v)
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max
const int = (v: unknown, min: number, max: number): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max
const list = (v: unknown, max: number): v is string[] => Array.isArray(v) && v.length <= max && v.every(id) && new Set(v).size === v.length
const enumValue = <T extends string>(v: unknown, values: readonly T[]): v is T => typeof v === 'string' && values.includes(v as T)
const fail = (message: string): never => { throw new Error(`Invalid RPG chapter pack: ${message}`) }
const coreKeys = ['speed', 'stamina', 'power', 'guts', 'wit', 'atk', 'matk', 'initiative', 'pdef', 'mdef', 'dexterity', 'hp', 'mp']

function moves(v: unknown): v is EnemyMove[] {
  if (!Array.isArray(v) || v.length < 1 || v.length > 8) return false
  const ids = new Set<string>()
  return v.every((move: unknown) => {
    if (!record(move) || !exact(move, ['id', 'kind', 'channel', 'element', 'power', 'target', 'intentText', ...(Object.hasOwn(move, 'status') ? ['status'] : [])]) ||
      !id(move.id) || ids.has(move.id) || !enumValue(move.kind, ['damage', 'heal', 'guard', 'buff']) ||
      !enumValue(move.channel, ['physical', 'magical']) || !(move.element === null || enumValue(move.element, RPG_ELEMENTS)) ||
      !int(move.power, 0, 500) || !enumValue(move.target, move.kind === 'damage' ? ['front', 'lowest-hp', 'seeded'] : ['self', 'lowest-hp-ally']) ||
      !text(move.intentText, 120) || (Object.hasOwn(move, 'status') && !enumValue(move.status, move.kind === 'damage' ? ['burn', 'slow', 'mark', 'weaken'] : ['ward', 'regen', 'power-up']))) return false
    ids.add(move.id)
    return true
  })
}

function actor(v: unknown, arts: readonly string[]): v is RpgChapterActor {
  if (!record(v) || !exact(v, ['id', 'name', 'role', 'artKey', 'combat']) || !id(v.id) || !text(v.name, 80) ||
    !text(v.role, 80) || !id(v.artKey) || !arts.includes(v.artKey) || !record(v.combat)) return false
  const c = v.combat
  if (!exact(c, ['id', 'element', 'stats', 'moves', ...(Object.hasOwn(c, 'phaseTwo') ? ['phaseTwo'] : [])]) || c.id !== v.id ||
    !enumValue(c.element, RPG_ELEMENTS) || !record(c.stats) || !exact(c.stats, coreKeys) ||
    !coreKeys.every((key) => int((c.stats as Record<string, unknown>)[key], key === 'hp' ? 1 : 0, 100000)) || !moves(c.moves)) return false
  return c.phaseTwo === undefined || record(c.phaseTwo) && exact(c.phaseTwo, ['thresholdPercent', 'moves']) &&
    int(c.phaseTwo.thresholdPercent, 1, 99) && moves(c.phaseTwo.moves)
}

/** Bytes are SHA-256 verified by the content runtime; the pure parser binds their manifest identity and references. */
export function parseRpgChapterPack(value: unknown, source: RpgChapterSource): RpgChapterPack {
  if (!/^[a-f0-9]{64}$/.test(source.contentHash) || !/^[A-Za-z0-9_.:-]{1,120}$/.test(source.version) ||
    !record(value) || !exact(value, ['schemaVersion', 'version', 'actors', 'chapters']) || value.schemaVersion !== 1 ||
    value.version !== source.version || !Array.isArray(value.actors) || value.actors.length < 1 || value.actors.length > 500 ||
    !Array.isArray(value.chapters) || value.chapters.length < 1 || value.chapters.length > 64) fail('version, hash or bounded arrays')
  const raw = value as Record<string, unknown>
  const actors = raw.actors as unknown[]
  if (!actors.every((v) => actor(v, source.artKeys))) fail('actor, action kit or art reference')
  const typedActors = actors as RpgChapterActor[]
  if (new Set(typedActors.map((a) => a.id)).size !== actors.length) fail('duplicate actor')
  const chapters: RpgChapter[] = []
  for (const c of raw.chapters as unknown[]) {
    if (!record(c) || !exact(c, ['id', 'scenarioId', 'title', 'contentVersion', 'recommendedTier', 'recommendedLevel', 'surface', 'distance', 'startNodeId', 'bossNodeId', 'nodes']) ||
      !id(c.id) || !SCENARIOS.some((s) => s.id === c.scenarioId) || !text(c.title, 100) || c.contentVersion !== source.version ||
      !int(c.recommendedTier, 1, 10000) || !int(c.recommendedLevel, 1, 50) || !enumValue(c.surface, SURFACES) ||
      !enumValue(c.distance, DISTANCE_CATEGORIES) || !id(c.startNodeId) || !id(c.bossNodeId) ||
      !Array.isArray(c.nodes) || c.nodes.length < 1 || c.nodes.length > RPG_MAX_SELECTED_PATH) fail('chapter fields or scenario')
    const chapter = { ...(c as Record<string, unknown>), contentHash: source.contentHash } as unknown as RpgChapter
    for (const n of chapter.nodes) {
      if (!record(n) || !exact(n, ['id', 'name', 'kind', 'detail', 'enemies', 'exits', ...(Object.hasOwn(n, 'baseExp') ? ['baseExp'] : [])]) || !id(n.id) || !text(n.name, 80) ||
        !text(n.detail, 240) || !enumValue(n.kind, ['encounter', 'elite', 'boss', 'branch', 'recovery', 'checkpoint']) ||
        !list(n.enemies, 5) || !list(n.exits, RPG_MAX_SELECTED_PATH) || n.enemies.some((key) => !typedActors.some((a) => a.id === key)) ||
        (isRpgBattleNode(n as unknown as RpgChapterNode) ? n.enemies.length < 1 : n.enemies.length !== 0) ||
        Object.hasOwn(n, 'baseExp') && (!int(n.baseExp, 0, RPG_MAX_ENCOUNTER_EXP) || !isRpgBattleNode(n as unknown as RpgChapterNode) && n.baseExp !== 0)) fail('node, reward or enemy reference')
    }
    validateRpgChapterGraph(chapter)
    chapters.push(chapter)
  }
  if (new Set(chapters.map((c) => c.id)).size !== chapters.length) fail('duplicate chapter')
  return { schemaVersion: 1, version: source.version, contentHash: source.contentHash, actors: typedActors, chapters }
}

export const isRpgBattleNode = (node: RpgChapterNode): boolean => ['encounter', 'elite', 'boss'].includes(node.kind)

export function validateRpgChapterGraph(chapter: RpgChapter): void {
  const nodes = new Map(chapter.nodes.map((n) => [n.id, n]))
  if (nodes.size !== chapter.nodes.length || !nodes.has(chapter.startNodeId) || nodes.get(chapter.bossNodeId)?.kind !== 'boss' ||
    chapter.nodes.filter((n) => n.kind === 'boss').length !== 1) fail('duplicate nodes, start or terminal boss')
  const visiting = new Set<string>(), reached = new Set<string>()
  const visit = (key: string) => {
    const n = nodes.get(key)
    if (!n) fail('unsafe edge')
    if (visiting.has(key)) fail('cycle')
    if (reached.has(key)) return
    if (key === chapter.bossNodeId ? n!.exits.length !== 0 : n!.exits.length === 0) fail('dead end or nonterminal boss')
    visiting.add(key)
    for (const exit of n!.exits) visit(exit)
    visiting.delete(key); reached.add(key)
  }
  visit(chapter.startNodeId)
  if (reached.size !== nodes.size) fail('unreachable node or boss')
}

export function rpgChapterChoices(chapter: RpgChapter, checkpoint: RpgCheckpointSaveV1): RpgChapterNode[] {
  assertRpgChapterCheckpoint(chapter, checkpoint)
  if (checkpoint.status !== 'at-checkpoint' || checkpoint.frozenEntry) return []
  const keys = checkpoint.lastClearedNodeId === null ? [chapter.startNodeId]
    : chapter.nodes.find((n) => n.id === checkpoint.lastClearedNodeId)!.exits
  return keys.map((key) => chapter.nodes.find((n) => n.id === key)!)
}

export function assertRpgChapterCheckpoint(chapter: RpgChapter, checkpoint: RpgCheckpointSaveV1): void {
  if (chapter.id !== checkpoint.chapterId || chapter.contentVersion !== checkpoint.contentVersion || chapter.contentHash !== checkpoint.contentHash) throw new Error('Frozen chapter content unavailable: version/hash changed')
  let exits = [chapter.startNodeId]
  for (const key of checkpoint.selectedPath) {
    const node = chapter.nodes.find((n) => n.id === key)
    if (!node || !exits.includes(key)) throw new Error('Saved chapter path is invalid')
    exits = node.exits
  }
  if (checkpoint.lastClearedNodeId !== (checkpoint.selectedPath.at(-1) ?? null) ||
    checkpoint.frozenEntry && (!exits.includes(checkpoint.frozenEntry.nodeId) || !isRpgBattleNode(chapter.nodes.find((n) => n.id === checkpoint.frozenEntry!.nodeId)!)) ||
    checkpoint.status === 'cleared' && checkpoint.lastClearedNodeId !== chapter.bossNodeId) throw new Error('Saved chapter checkpoint is invalid')
}

export function rpgAcceptSafeNode(chapter: RpgChapter, checkpoint: RpgCheckpointSaveV1, nodeId: string): RpgCheckpointSaveV1 {
  const node = rpgChapterChoices(chapter, checkpoint).find((n) => n.id === nodeId)
  if (!node || isRpgBattleNode(node)) throw new Error('Node is not an available safe checkpoint')
  return { ...checkpoint, revision: checkpoint.revision + 1, lastClearedNodeId: nodeId, selectedPath: [...checkpoint.selectedPath, nodeId] }
}

export function rpgAcceptBattleNode(chapter: RpgChapter, checkpoint: RpgCheckpointSaveV1, evidence: RpgResultEvidenceV1): RpgCheckpointSaveV1 {
  assertRpgChapterCheckpoint(chapter, checkpoint)
  const entry = checkpoint.frozenEntry
  if (checkpoint.status !== 'pending-result' || !entry || evidence.outcome !== 'win' ||
    evidence.resultId !== rpgResultId(entry.entryId, entry.retryOrdinal) || evidence.contentHash !== chapter.contentHash || evidence.contentVersion !== chapter.contentVersion) throw new Error('Map advance requires an accepted win for this entry')
  return { ...checkpoint, revision: checkpoint.revision + 1, status: entry.nodeId === chapter.bossNodeId ? 'cleared' : 'at-checkpoint',
    frozenEntry: null, lastClearedNodeId: entry.nodeId, selectedPath: [...checkpoint.selectedPath, entry.nodeId] }
}

export function rpgEnemyWeaknesses(element: RpgElement): RpgElement[] { return RPG_ELEMENTS.filter((e) => elementMatchup(e, element) === 'weak') }

/** Route counts are for reward/pacing simulations, never a production length chosen by the renderer. */
export function rpgChapterFightCounts(chapter: RpgChapter): number[] {
  validateRpgChapterGraph(chapter)
  const memo = new Map<string, number[]>()
  const visit = (key: string): number[] => {
    const cached = memo.get(key)
    if (cached) return cached
    const node = chapter.nodes.find((n) => n.id === key)!
    const own = Number(isRpgBattleNode(node))
    const counts = node.exits.length ? [...new Set(node.exits.flatMap((exit) => visit(exit).map((count) => count + own)))] : [own]
    memo.set(key, counts)
    return counts
  }
  return visit(chapter.startNodeId).sort((a, b) => a - b)
}
