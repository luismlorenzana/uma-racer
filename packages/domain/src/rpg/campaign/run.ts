// A party's run through one chapter: cleared nodes, carried MP and the open fight (docs/design/uma-rpg.md#runs, D263).
// Saved locally first and synced like any other row; the map is derived from it, never stored.
import { grantRpgExp, projectRpgStats, rpgLifetimeLevels, type RpgProfile } from '../rules'
import { createBattle } from '../battle/engine'
import type { BattleInput, BattleState } from '../battle/types'
import type { RpgPresetSlotV1 } from '../save'
import { rpgNodeParents, type RpgCampaignChapter, type RpgMapNode } from './chapters'
import { rpgBattleExp, rpgBattleTokens } from './rewards'

export const RPG_RUN_SCHEMA_VERSION = 2
export interface RpgRunBattleV2 { battleId: string; nodeId: string; startedAt: number; input: BattleInput }
export interface RpgRunSaveV2 {
  schemaVersion: 2
  presetId: string
  chapterId: string
  /** Wins per battle node; visits per camp. */
  wins: Record<string, number>
  /** MP carried per outfit; an absent outfit is full. */
  mp: Record<string, number>
  battle: RpgRunBattleV2 | null
  /** Fights started, for unique battle ids and seeds. */
  battles: number
  clearedAt: number | null
  updatedAt: number
}
export interface RpgMemberExp {
  outfitId: string; delta: number; beforeTier: number; beforeLevel: number; beforeExp: number
  afterTier: number; afterLevel: number; afterExp: number
}
export interface RpgBattleResultV2 {
  schemaVersion: 2; resultId: string; presetId: string; chapterId: string; nodeId: string; rounds: number
  members: RpgMemberExp[]; tokens: { tier: number; slot: number; skill: number }; createdAt: number
}
export type RpgNodeStatus = 'locked' | 'available' | 'cleared'

const ID = /^[A-Za-z0-9_.:-]{1,120}$/
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const exact = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k))
const int = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && (v as number) >= min
const counts = (v: unknown, min: number): v is Record<string, number> =>
  record(v) && Object.keys(v).length <= 200 && Object.entries(v).every(([k, n]) => ID.test(k) && int(n, min))

export const rpgRunId = (presetId: string, chapterId: string): string => `${presetId}:${chapterId}`
export const rpgBattleId = (run: Pick<RpgRunSaveV2, 'presetId' | 'chapterId' | 'battles'>): string =>
  `rpg-battle:${run.presetId}:${run.chapterId}:${run.battles + 1}`

export function createRpgRun(presetId: string, chapterId: string, now: number): RpgRunSaveV2 {
  return { schemaVersion: 2, presetId, chapterId, wins: { start: 1 }, mp: {}, battle: null, battles: 0, clearedAt: null, updatedAt: now }
}

export function parseRpgRunSave(value: unknown): RpgRunSaveV2 | null {
  if (!record(value) || !exact(value, ['schemaVersion', 'presetId', 'chapterId', 'wins', 'mp', 'battle', 'battles', 'clearedAt', 'updatedAt']) ||
    value.schemaVersion !== 2 || typeof value.presetId !== 'string' || !/^party-[1-5]$/.test(value.presetId) ||
    typeof value.chapterId !== 'string' || !/^[a-z0-9-]{1,24}$/.test(value.chapterId) || !counts(value.wins, 1) ||
    !counts(value.mp, 0) || !int(value.battles) || !(value.clearedAt === null || int(value.clearedAt)) || !int(value.updatedAt)) return null
  const battle = value.battle
  if (battle !== null) {
    if (!record(battle) || !exact(battle, ['battleId', 'nodeId', 'startedAt', 'input']) || typeof battle.battleId !== 'string' ||
      !ID.test(battle.battleId) || typeof battle.nodeId !== 'string' || !ID.test(battle.nodeId) || !int(battle.startedAt)) return null
    try { createBattle(battle.input as BattleInput) } catch { return null }
  }
  return value as unknown as RpgRunSaveV2
}

export function parseRpgBattleResult(value: unknown): RpgBattleResultV2 | null {
  if (!record(value) || !exact(value, ['schemaVersion', 'resultId', 'presetId', 'chapterId', 'nodeId', 'rounds', 'members', 'tokens', 'createdAt']) ||
    value.schemaVersion !== 2 || typeof value.resultId !== 'string' || !ID.test(value.resultId) ||
    typeof value.nodeId !== 'string' || !ID.test(value.nodeId) || !int(value.rounds, 1) || !int(value.createdAt) ||
    !Array.isArray(value.members) || value.members.length !== 5 || !record(value.tokens) ||
    !exact(value.tokens, ['tier', 'slot', 'skill']) || !int(value.tokens.tier, 1) || !int(value.tokens.slot) || !int(value.tokens.skill)) return null
  const ok = value.members.every((m: unknown) => record(m) && exact(m, ['outfitId', 'delta', 'beforeTier', 'beforeLevel', 'beforeExp',
    'afterTier', 'afterLevel', 'afterExp']) && typeof m.outfitId === 'string' && ID.test(m.outfitId) && int(m.delta) &&
    int(m.beforeTier, 1) && int(m.beforeLevel, 1) && int(m.beforeExp) && int(m.afterTier, 1) && int(m.afterLevel, 1) && int(m.afterExp))
  return ok ? value as unknown as RpgBattleResultV2 : null
}

export function rpgNodeStatus(chapter: RpgCampaignChapter, run: RpgRunSaveV2 | null, nodeId: string): RpgNodeStatus {
  if ((run?.wins[nodeId] ?? 0) > 0 || nodeId === 'start') return 'cleared'
  return rpgNodeParents(chapter, nodeId).some((p) => p === 'start' || (run?.wins[p] ?? 0) > 0) ? 'available' : 'locked'
}

export const rpgChapterCleared = (chapter: RpgCampaignChapter, run: RpgRunSaveV2 | null): boolean =>
  chapter.nodes.some((n) => n.kind === 'boss' && (run?.wins[n.id] ?? 0) > 0)

/** Resting at a reached or reachable camp refills every party member's MP. */
export function rpgRestAtCamp(chapter: RpgCampaignChapter, run: RpgRunSaveV2, campId: string, now: number): RpgRunSaveV2 {
  const node = chapter.nodes.find((n) => n.id === campId)
  if (!node || node.kind !== 'camp' || rpgNodeStatus(chapter, run, campId) === 'locked') throw new Error('Camp is not reachable')
  if (run.battle) throw new Error('Finish the open fight first')
  return { ...run, wins: { ...run.wins, [campId]: Math.max(1, run.wins[campId] ?? 0) }, mp: {}, updatedAt: now }
}

export interface RpgPartyMember { profile: RpgProfile; slot: RpgPresetSlotV1 }

export const rpgMemberLevel = (profile: Pick<RpgProfile, 'tier' | 'level'>): number => rpgLifetimeLevels(profile.tier, profile.level) + 1

export function rpgCarriedMp(run: Pick<RpgRunSaveV2, 'mp'>, profile: RpgProfile): number {
  const max = projectRpgStats(profile).mp
  return Math.min(max, run.mp[profile.outfitId] ?? max)
}

function seedOf(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}

/** Freezes the party (with its carried MP) and the node's foes into a new fight. */
export function rpgBeginRunBattle(chapter: RpgCampaignChapter, run: RpgRunSaveV2, nodeId: string,
  party: readonly RpgPartyMember[], now: number): RpgRunSaveV2 {
  const node = chapter.nodes.find((n) => n.id === nodeId)
  if (!node || node.kind === 'camp') throw new Error('That node has no fight')
  if (run.battle) throw new Error('Finish the open fight first')
  if (rpgNodeStatus(chapter, run, nodeId) === 'locked') throw new Error('Clear a path to this node first')
  if (party.length !== 5) throw new Error('A fight needs five party members')
  const battleId = rpgBattleId(run)
  const input: BattleInput = {
    version: 2, seed: seedOf(battleId),
    allies: party.map(({ profile, slot }) => ({ id: profile.outfitId, style: profile.style, weapon: profile.weapon,
      tier: profile.tier, level: profile.level, stats: projectRpgStats(profile), affinities: profile.affinities,
      signature: slot.signature, tree: profile.tree, legacy: profile.legacy, loadout: slot.loadout, mp: rpgCarriedMp(run, profile) })),
    enemies: node.enemies,
  }
  createBattle(input)
  return { ...run, battle: { battleId, nodeId, startedAt: now, input }, battles: run.battles + 1, updatedAt: now }
}

export interface RpgSettlement {
  run: RpgRunSaveV2
  outcome: 'win' | 'loss'
  profiles: RpgProfile[]
  result: RpgBattleResultV2 | null
}

/** A win pays every entrant (KO'd included) and carries the party's MP; a loss leaves the run as it was. */
export function rpgSettleRunBattle(chapter: RpgCampaignChapter, run: RpgRunSaveV2, state: BattleState,
  profiles: readonly RpgProfile[], now: number): RpgSettlement {
  const battle = run.battle
  if (!battle) throw new Error('No open fight')
  if (state.input.seed !== battle.input.seed) throw new Error('Battle does not belong to this run')
  if (state.outcome === 'active') throw new Error('The fight is still on')
  const node = chapter.nodes.find((n) => n.id === battle.nodeId)
  if (!node || node.kind === 'camp') throw new Error('Battle node is unavailable')
  if (state.outcome === 'loss') return { run: { ...run, battle: null, updatedAt: now }, outcome: 'loss', profiles: [...profiles], result: null }
  const members: RpgMemberExp[] = []
  const next = battle.input.allies.map((ally) => {
    const profile = profiles.find((p) => p.outfitId === ally.id)
    if (!profile) throw new Error('Party member is unavailable')
    const delta = rpgBattleExp(node.kind as Exclude<RpgMapNode['kind'], 'camp'>, node.level, rpgMemberLevel({ tier: ally.tier, level: ally.level }))
    const after = grantRpgExp(profile, delta).profile
    members.push({ outfitId: profile.outfitId, delta, beforeTier: profile.tier, beforeLevel: profile.level, beforeExp: profile.exp,
      afterTier: after.tier, afterLevel: after.level, afterExp: after.exp })
    return after
  })
  const mp = { ...run.mp }
  for (const unit of state.units) if (unit.side === 'ally') mp[unit.id] = unit.mp
  const result: RpgBattleResultV2 = { schemaVersion: 2, resultId: battle.battleId, presetId: run.presetId, chapterId: run.chapterId,
    nodeId: node.id, rounds: state.round, members, tokens: { tier: chapter.tier, ...rpgBattleTokens(node.kind as Exclude<RpgMapNode['kind'], 'camp'>) },
    createdAt: now }
  const wins = { ...run.wins, [node.id]: (run.wins[node.id] ?? 0) + 1 }
  return { outcome: 'win', profiles: next, result,
    run: { ...run, wins, mp, battle: null, clearedAt: run.clearedAt ?? (node.kind === 'boss' ? now : null), updatedAt: now } }
}
