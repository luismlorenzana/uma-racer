// Fixed level/role coefficients; verified cast supplies identity only (docs/design/uma-puzzles.md §§5–6; D271).
import { SCENARIOS } from '../../../scenarios'
import { STRATEGIES, type Strategy } from '../../../types'
import { parsePuzzleBattleInput, parsePuzzleEnemy } from '../battle-parse'
import { PUZZLE_ENEMY_GUARD, PUZZLE_RAGE_THRESHOLD } from '../battle-rules'
import type { PuzzleBattleInputV1, PuzzleBattleKind, PuzzleEnemy, PuzzleEnemyIntent, PuzzleEntrant } from '../battle-types'
import type { PuzzleLeaderId } from '../catalogue'
import type { PuzzleScenarioRegistry } from '../materials'
import { puzzleSeed } from '../rng'
import { PUZZLE_PARSE_LIMITS, PUZZLE_STAT_BASE, PUZZLE_STAT_GROWTH } from '../rules'
import { PUZZLE_ELEMENTS, type PuzzleElement } from '../types'
import { puzzleArray, puzzleExact, puzzleId, puzzleInteger, puzzleRecord, puzzleSafe, requirePuzzle } from '../validation'
import { puzzleCampaignId } from './identity'
import { parsePuzzleChapter, puzzleEntryEligibility } from './progress'
import { PUZZLE_CAMPAIGN_VERSION, PUZZLE_DARK_VARIANTS, PUZZLE_DROP_COUNTS, PUZZLE_FOE_MECHANICS as M,
  PUZZLE_FOE_REFERENCE as R, PUZZLE_FOE_ROLES, PUZZLE_FOE_ROLE_MULTIPLIERS, PUZZLE_FOE_SCALING, type PuzzleFoeRole } from './rules'
import type { PuzzleCastV1, PuzzleChapter, PuzzleCheckpointV1, PuzzleDarkVariant, PuzzleEncounter, PuzzleMapNode } from './types'

export function parsePuzzleCast(v: unknown): PuzzleCastV1 | null {
  if (!puzzleRecord(v) || !puzzleExact(v, ['schemaVersion', 'manifestVersion', 'members']) || v.schemaVersion !== 1 ||
    !puzzleId(v.manifestVersion) || !puzzleArray(v.members, PUZZLE_PARSE_LIMITS.units) || !v.members.length) return null
  const members: PuzzleCastV1['members'] = []
  for (const member of v.members) {
    if (!puzzleRecord(member) || !puzzleExact(member, ['id', 'elements', 'roles']) || !puzzleId(member.id) ||
      members.some(m => m.id === member.id) || !puzzleArray(member.elements, PUZZLE_ELEMENTS.length) || !member.elements.length ||
      new Set(member.elements).size !== member.elements.length || !member.elements.every(e => PUZZLE_ELEMENTS.includes(e as never)) ||
      !puzzleArray(member.roles, PUZZLE_FOE_ROLES.length) || !member.roles.length || new Set(member.roles).size !== member.roles.length ||
      !member.roles.every(r => PUZZLE_FOE_ROLES.includes(r as never))) return null
    members.push({ id: member.id, elements: member.elements as PuzzleElement[], roles: member.roles as PuzzleFoeRole[] })
  }
  return { schemaVersion: 1, manifestVersion: v.manifestVersion, members: members.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) }
}
function foe(level: number, kind: PuzzleBattleKind, role: PuzzleFoeRole, element: PuzzleElement, id: string, castId: string): PuzzleEnemy {
  const scaling = PUZZLE_FOE_SCALING[kind], multiplier = PUZZLE_FOE_ROLE_MULTIPLIERS[role], n = level - 1
  const refAtk = Math.round(PUZZLE_STAT_BASE.atk * R.speed + PUZZLE_STAT_GROWTH.atk * n * (1 + R.growth))
  const refHp = R.partySize * Math.round(PUZZLE_STAT_BASE.hp * R.stamina + PUZZLE_STAT_GROWTH.hp * n * (1 + R.growth))
  const maxHp = puzzleSafe(Math.round(refAtk * scaling.hpAtk * multiplier.hp), 'Enemy HP')
  const attack: PuzzleEnemyIntent = { type: 'attack', countdown: scaling.attackCountdown,
    damage: puzzleSafe(Math.round(refHp * scaling.damageHp * multiplier.damage), 'Enemy damage') }
  const special: Partial<Record<PuzzleFoeRole, PuzzleEnemyIntent>> = {
    healer: { type: 'heal', countdown: M.supportCountdown, amount: Math.round(maxHp * M.healHp) },
    guard: { type: 'guard', countdown: M.supportCountdown, reduction: PUZZLE_ENEMY_GUARD, durationDrags: 1, comboThreshold: M.guardCombos },
    converter: { type: 'convert', countdown: M.supportCountdown, from: element === 'fire' ? 'water' : 'fire', to: element, count: M.converterCount },
    ward: { type: 'ward', countdown: M.supportCountdown, reduction: PUZZLE_ENEMY_GUARD, durationDrags: M.wardDuration, comboThreshold: M.wardCombos },
    champion: { type: 'ward', countdown: M.supportCountdown, reduction: PUZZLE_ENEMY_GUARD, durationDrags: M.wardDuration, comboThreshold: M.wardCombos },
  }
  const recipeIds = { striker: 'puzzle:striker', healer: 'puzzle:ally-healer', guard: 'puzzle:guard',
    converter: 'puzzle:converter', ward: 'puzzle:combo-ward', champion: 'puzzle:champion' } as const
  const support = special[role]
  // Bosses attack first, so guard/ward do not turn their pressure into decorative waiting.
  const intents = support ? kind === 'ordinary' ? [support, attack] : [attack, support] : [attack]
  const enemy = parsePuzzleEnemy({ id, castId, recipeId: kind === 'guardian' ? 'puzzle:guardian' : recipeIds[role],
    element, maxHp, defense: puzzleSafe(M.defenseBase + M.defensePerLevel * n, 'Enemy DEF'),
    openingCountdown: scaling.opening, intents, delayImmune: false,
    phase: kind === 'champion' ? { atHpPercent: PUZZLE_RAGE_THRESHOLD, damageMultiplier: M.rageMultiplier,
      countdown: M.rageCountdown, element: null } : null })
  requirePuzzle(enemy, 'overflow', 'Enemy exceeds v1 engine bounds'); return enemy
}
export function puzzleEncounterRewards(node: PuzzleMapNode, variant: PuzzleDarkVariant | null = null): PuzzleEncounter['rewards'] {
  const choice = node.kind === 'champion' && node.elements[0] === 'dark'
  requirePuzzle(choice ? PUZZLE_DARK_VARIANTS.includes(variant as never) : variant === null, 'invalid', 'Invalid Dark champion variant')
  const mapping: Record<PuzzleElement, Strategy> = { fire: 'front', water: 'end', wood: 'late', light: 'pace', dark: variant ?? node.darkStyle ?? 'late' }
  const counts = new Map<Strategy, number>()
  for (const element of node.elements) {
    const quantity = node.kind === 'ordinary' ? 1 : PUZZLE_DROP_COUNTS[node.kind], style = mapping[element]
    counts.set(style, (counts.get(style) ?? 0) + quantity)
  }
  return STRATEGIES.filter(s => counts.has(s)).map(style => ({ style, quantity: counts.get(style)! }))
}
/** Preview and freeze call this ONE resolver. No party strength, save, clock, random source or asset URL enters it. */
export function resolvePuzzleEncounter(chapter: PuzzleChapter, nodeId: string, valueCast: PuzzleCastV1,
  variant: PuzzleDarkVariant | null = null, registry: PuzzleScenarioRegistry = SCENARIOS): PuzzleEncounter {
  const map = parsePuzzleChapter(chapter, registry), cast = parsePuzzleCast(valueCast)
  requirePuzzle(map && cast, 'invalid', 'Invalid chapter/cast contract')
  const node = map.nodes.find(n => n.id === nodeId)
  requirePuzzle(node, 'unknown', 'Unknown encounter')
  const rewards = puzzleEncounterRewards(node, variant)
  const enemies = node.elements.map((element, slot) => {
    const role = node.roles[slot]!, candidates = cast.members.filter(m => m.elements.includes(element) && m.roles.includes(role))
    requirePuzzle(candidates.length, 'unknown', `Missing verified cast coverage for ${element}/${role}`)
    const castId = candidates[puzzleSeed(node.id, `cast-${slot}`) % candidates.length]!.id
    return foe(node.level, node.kind, role, element, `${node.id}:foe${slot}`, castId)
  })
  return { nodeId, level: node.level, kind: node.kind, enemies, rewards, darkVariant: variant }
}
export interface PuzzleEncounterEntry {
  chapter: PuzzleChapter; checkpoint: PuzzleCheckpointV1; nodeId: string; entrants: PuzzleEntrant[]; leaderId: PuzzleLeaderId;
  cast: PuzzleCastV1; accountSeed: string; ownerEpoch: number; darkVariant: PuzzleDarkVariant | null
}
export function freezePuzzleEncounter(entry: PuzzleEncounterEntry, registry: PuzzleScenarioRegistry = SCENARIOS): PuzzleBattleInputV1 {
  requirePuzzle(puzzleId(entry.accountSeed) && puzzleInteger(entry.ownerEpoch), 'invalid', 'Invalid account seed/owner epoch')
  const eligibility = puzzleEntryEligibility(entry.chapter, entry.checkpoint, entry.nodeId, entry.entrants.map(e => e.level), registry)
  const encounter = resolvePuzzleEncounter(entry.chapter, entry.nodeId, entry.cast, entry.darkVariant, registry)
  const localId = entry.chapter.nodes.find(n => n.id === entry.nodeId)!.localId
  const battleId = puzzleCampaignId({ kind: 'battle', scenarioId: entry.chapter.scenarioId,
    partyId: entry.checkpoint.partyId, localId, attempt: eligibility.attempt }, registry)
  const seed = `puzzle-seed-${puzzleSeed(entry.accountSeed, 'account')}-${puzzleSeed(battleId, 'attempt')}`
  const input = parsePuzzleBattleInput({ schemaVersion: 1, engineVersion: 1, rulesVersion: 1,
    battleId, partyId: entry.checkpoint.partyId,
    checkpointId: puzzleCampaignId({ kind: 'checkpoint', partyId: entry.checkpoint.partyId, scenarioId: entry.chapter.scenarioId }, registry),
    ownerEpoch: entry.ownerEpoch, seed, scenarioId: entry.chapter.scenarioId, encounterLevel: encounter.level,
    kind: encounter.kind, entrants: entry.entrants, leaderId: entry.leaderId, enemies: encounter.enemies, rewards: encounter.rewards,
    content: { manifestVersion: entry.cast.manifestVersion, recipeHash: `puzzle-campaign-v${PUZZLE_CAMPAIGN_VERSION}` } }, registry)
  requirePuzzle(input, 'invalid', 'Invalid frozen entrant/loadout or encounter'); return input
}
