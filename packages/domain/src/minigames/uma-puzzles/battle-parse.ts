// Strict, detached v1 transport. Unsupported/future recipes fail closed (implementation §4).
import { SCENARIOS } from '../../scenarios'
import { STRATEGIES } from '../../types'
import { parsePuzzleBoard, parsePuzzlePath, PUZZLE_ORBS, type PuzzleOrb } from './board'
import { PUZZLE_ACTION_LIMIT, PUZZLE_BATTLE_LIMITS as LIMIT, PUZZLE_ENEMY_GUARD, PUZZLE_ENGINE_VERSION,
  PUZZLE_MOVEMENT_MS, PUZZLE_PARTY_SIZE, PUZZLE_RAGE_THRESHOLD, PUZZLE_SKILL_RULES, PUZZLE_TURN_LIMIT } from './battle-rules'
import type { PuzzleBattleAction, PuzzleBattleInputV1, PuzzleBattleResultV1, PuzzleBattleStateV1, PuzzleEnemy,
  PuzzleEnemyBarrier, PuzzleEnemyIntent, PuzzleEnemyPhase, PuzzleEntrant } from './battle-types'
import { parsePuzzleKit, PUZZLE_ACTIVES, PUZZLE_ENEMY_RECIPES, PUZZLE_LEADERS } from './catalogue'
import { eligiblePuzzleElements, parsePuzzleSource } from './identity'
import { puzzleStats } from './progression'
import { PUZZLE_ELEMENTS } from './types'
import { puzzleArray, puzzleExact, puzzleId, puzzleInteger, puzzleRecord, puzzleSafe } from './validation'

const element = (v: unknown): boolean => PUZZLE_ELEMENTS.includes(v as never)
const fraction = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max
export function parsePuzzleEnemyIntent(v: unknown): PuzzleEnemyIntent | null {
  if (!puzzleRecord(v) || !puzzleInteger(v.countdown, 1, LIMIT.countdown)) return null
  if (v.type === 'attack' && puzzleExact(v, ['type', 'countdown', 'damage']) && puzzleInteger(v.damage, 1, LIMIT.enemyValue))
    return { type: v.type, countdown: v.countdown, damage: v.damage }
  if (v.type === 'heal' && puzzleExact(v, ['type', 'countdown', 'amount']) && puzzleInteger(v.amount, 1, LIMIT.enemyValue))
    return { type: v.type, countdown: v.countdown, amount: v.amount }
  if ((v.type === 'guard' || v.type === 'ward') && puzzleExact(v, ['type', 'countdown', 'reduction', 'durationDrags', 'comboThreshold']) &&
    fraction(v.reduction, PUZZLE_ENEMY_GUARD) && puzzleInteger(v.durationDrags, 1, LIMIT.statusDrags) &&
    puzzleInteger(v.comboThreshold, 1, LIMIT.comboThreshold) && (v.type !== 'guard' || (v.reduction === PUZZLE_ENEMY_GUARD && v.durationDrags === 1)))
    return { type: v.type, countdown: v.countdown, reduction: v.reduction, durationDrags: v.durationDrags, comboThreshold: v.comboThreshold }
  if (v.type === 'convert' && puzzleExact(v, ['type', 'countdown', 'from', 'to', 'count']) && PUZZLE_ORBS.includes(v.from as never) &&
    PUZZLE_ORBS.includes(v.to as never) && v.from !== v.to && puzzleInteger(v.count, 1, LIMIT.converterCount))
    return { type: v.type, countdown: v.countdown, from: v.from as PuzzleOrb, to: v.to as PuzzleOrb, count: v.count }
  return null
}
function parsePhase(v: unknown): PuzzleEnemyPhase | null {
  return puzzleRecord(v) && puzzleExact(v, ['atHpPercent', 'damageMultiplier', 'countdown', 'element']) &&
    v.atHpPercent === PUZZLE_RAGE_THRESHOLD && fraction(v.damageMultiplier, LIMIT.rageMultiplier) && v.damageMultiplier > 1 &&
    puzzleInteger(v.countdown, 1, LIMIT.countdown) && (v.element === null || element(v.element))
    ? { atHpPercent: v.atHpPercent, damageMultiplier: v.damageMultiplier, countdown: v.countdown, element: v.element as PuzzleEnemyPhase['element'] } : null
}
export function parsePuzzleEnemy(v: unknown): PuzzleEnemy | null {
  if (!puzzleRecord(v) || !puzzleExact(v, ['id', 'castId', 'recipeId', 'element', 'maxHp', 'defense', 'openingCountdown', 'intents', 'delayImmune', 'phase']) ||
    !puzzleId(v.id) || !puzzleId(v.castId) || !PUZZLE_ENEMY_RECIPES.includes(v.recipeId as never) || !element(v.element) ||
    !puzzleInteger(v.maxHp, 1, LIMIT.enemyValue) || !puzzleInteger(v.defense, 0, LIMIT.enemyValue) ||
    !puzzleInteger(v.openingCountdown, 1, LIMIT.countdown) || typeof v.delayImmune !== 'boolean' || !puzzleArray(v.intents, LIMIT.intents) ||
    !v.intents.length || v.intents.length > LIMIT.intents) return null
  const intents = v.intents.map(parsePuzzleEnemyIntent), phase = v.phase === null ? null : parsePhase(v.phase)
  if (intents.some(i => !i) || (v.phase !== null && !phase)) return null
  const checked = intents as PuzzleEnemyIntent[], special = new Set(checked.filter(i => i.type !== 'attack').map(i => i.type))
  const allowed: Record<PuzzleEnemy['recipeId'], readonly string[]> = { 'puzzle:striker': [], 'puzzle:ally-healer': ['heal'],
    'puzzle:guard': ['guard'], 'puzzle:converter': ['convert'], 'puzzle:combo-ward': ['ward'],
    'puzzle:guardian': ['guard', 'heal', 'convert', 'ward'], 'puzzle:champion': ['guard', 'heal', 'convert', 'ward'] }
  const recipeId = v.recipeId as PuzzleEnemy['recipeId']
  if (!checked.some(i => i.type === 'attack') || [...special].some(s => !allowed[recipeId].includes(s)) || special.size > 2 ||
    (recipeId === 'puzzle:champion' ? !phase : phase !== null) ||
    (!['puzzle:striker', 'puzzle:guardian', 'puzzle:champion'].includes(recipeId) && special.size !== 1)) return null
  return { id: v.id, castId: v.castId, recipeId, element: v.element as PuzzleEnemy['element'], maxHp: v.maxHp, defense: v.defense,
    openingCountdown: v.openingCountdown, intents: checked, delayImmune: v.delayImmune, phase }
}
function parseEntrant(v: unknown): PuzzleEntrant | null {
  if (!puzzleRecord(v) || !puzzleExact(v, ['outfitId', 'source', 'level', 'element', 'stats', 'kit']) || !puzzleId(v.outfitId) ||
    !puzzleInteger(v.level, 1) || !element(v.element)) return null
  const source = parsePuzzleSource(v.source)
  if (!source || source.templateId !== v.outfitId || !eligiblePuzzleElements(source).includes(v.element as never)) return null
  const kit = parsePuzzleKit(v.kit, source, v.level)
  if (!kit || !puzzleRecord(v.stats) || !puzzleExact(v.stats, ['atk', 'hp', 'rcv', 'guard', 'resilience'])) return null
  try {
    const stats = puzzleStats(source, v.level)
    const supplied = v.stats
    if (Object.entries(stats).some(([k, n]) => supplied[k] !== n) || stats.hp < 1) return null
    return { outfitId: v.outfitId, source, level: v.level, element: v.element as PuzzleEntrant['element'], stats, kit }
  } catch { return null }
}
export function puzzlePartyStats(input: PuzzleBattleInputV1): { maxHp: number; rcv: number; guard: number; resilience: number } {
  const leader = PUZZLE_LEADERS.find(l => l.id === input.leaderId)!
  const total = (stat: keyof PuzzleEntrant['stats']): number => puzzleSafe(input.entrants.reduce((n, e) => puzzleSafe(n + e.stats[stat], stat), 0), stat)
  return { maxHp: puzzleSafe(Math.round(total('hp') * (leader.stat === 'hp' ? leader.multiplier : 1)), 'HP'),
    rcv: puzzleSafe(Math.round(total('rcv') * (leader.stat === 'rcv' ? leader.multiplier : 1)), 'RCV'), guard: total('guard'), resilience: total('resilience') }
}
export function parsePuzzleBattleInput(v: unknown): PuzzleBattleInputV1 | null {
  if (!puzzleRecord(v) || !puzzleExact(v, ['schemaVersion', 'engineVersion', 'rulesVersion', 'battleId', 'partyId', 'checkpointId', 'ownerEpoch',
    'seed', 'scenarioId', 'encounterLevel', 'kind', 'entrants', 'leaderId', 'enemies', 'rewards', 'content']) ||
    v.schemaVersion !== 1 || v.engineVersion !== PUZZLE_ENGINE_VERSION || v.rulesVersion !== 1 || !puzzleId(v.battleId) ||
    typeof v.partyId !== 'string' || !/^puzzle-party-[1-5]$/.test(v.partyId) || !puzzleId(v.checkpointId) || !puzzleInteger(v.ownerEpoch) ||
    !puzzleId(v.seed) || !SCENARIOS.some(s => s.id === v.scenarioId) || !puzzleInteger(v.encounterLevel, 1) ||
    !['ordinary', 'guardian', 'champion'].includes(v.kind as string) || !puzzleArray(v.entrants, PUZZLE_PARTY_SIZE) || v.entrants.length !== PUZZLE_PARTY_SIZE ||
    !puzzleArray(v.enemies, LIMIT.enemies) || !v.enemies.length || !PUZZLE_LEADERS.some(l => l.id === v.leaderId) ||
    !puzzleArray(v.rewards, STRATEGIES.length) || !puzzleRecord(v.content) ||
    !puzzleExact(v.content, ['manifestVersion', 'recipeHash']) || !puzzleId(v.content.manifestVersion) || !puzzleId(v.content.recipeHash)) return null
  const entrants = v.entrants.map(parseEntrant), enemies = v.enemies.map(parsePuzzleEnemy)
  if (entrants.some(e => !e) || enemies.some(e => !e)) return null
  const checkedEntrants = entrants as PuzzleEntrant[], checkedEnemies = enemies as PuzzleEnemy[]
  if (new Set(checkedEntrants.map(e => e.outfitId)).size !== PUZZLE_PARTY_SIZE || new Set(checkedEnemies.map(e => e.id)).size !== checkedEnemies.length ||
    checkedEnemies.some(e => {
      const special = new Set(e.intents.filter(i => i.type !== 'attack').map(i => i.type)).size + Number(e.phase !== null)
      return special > (v.kind === 'ordinary' ? 1 : v.kind === 'guardian' ? 2 : 3)
    }) || (v.kind === 'champion' && !checkedEnemies.some(e => e.phase))) return null
  const rewards: PuzzleBattleInputV1['rewards'] = []
  for (const row of v.rewards) {
    if (!puzzleRecord(row) || !puzzleExact(row, ['style', 'quantity']) || !STRATEGIES.includes(row.style as never) ||
      !puzzleInteger(row.quantity, 1) || rewards.some(r => r.style === row.style)) return null
    rewards.push({ style: row.style as typeof STRATEGIES[number], quantity: row.quantity })
  }
  const input: PuzzleBattleInputV1 = { schemaVersion: 1, engineVersion: 1, rulesVersion: 1, battleId: v.battleId, partyId: v.partyId,
    checkpointId: v.checkpointId, ownerEpoch: v.ownerEpoch, seed: v.seed, scenarioId: v.scenarioId as string, encounterLevel: v.encounterLevel,
    kind: v.kind as PuzzleBattleInputV1['kind'], entrants: checkedEntrants, leaderId: v.leaderId as PuzzleBattleInputV1['leaderId'], enemies: checkedEnemies,
    rewards, content: { manifestVersion: v.content.manifestVersion, recipeHash: v.content.recipeHash } }
  try { puzzlePartyStats(input) } catch { return null }
  return input
}
export function parsePuzzleBattleAction(v: unknown): PuzzleBattleAction | null {
  if (!puzzleRecord(v)) return null
  if (v.type === 'abandon' && puzzleExact(v, ['type'])) return { type: 'abandon' }
  if (!(v.focusId === null || puzzleId(v.focusId))) return null
  if (v.type === 'use-active' && puzzleExact(v, ['type', 'slot', 'focusId']) && puzzleInteger(v.slot, 0, PUZZLE_PARTY_SIZE - 1))
    return { type: v.type, slot: v.slot, focusId: v.focusId }
  if (v.type === 'drag' && puzzleExact(v, ['type', 'path', 'elapsedMs', 'focusId']) && puzzleInteger(v.elapsedMs, 0, PUZZLE_MOVEMENT_MS)) {
    const path = parsePuzzlePath(v.path)
    return path ? { type: v.type, path, elapsedMs: v.elapsedMs, focusId: v.focusId } : null
  }
  return null
}
const barrier = (v: unknown, turn: number): PuzzleEnemyBarrier | null => puzzleRecord(v) &&
  puzzleExact(v, ['reduction', 'comboThreshold', 'expiresAfterTurn']) && fraction(v.reduction, PUZZLE_ENEMY_GUARD) &&
  puzzleInteger(v.comboThreshold, 1, LIMIT.comboThreshold) && puzzleInteger(v.expiresAfterTurn, turn + 1, turn + LIMIT.statusDrags)
  ? { reduction: v.reduction, comboThreshold: v.comboThreshold, expiresAfterTurn: v.expiresAfterTurn } : null
export function parsePuzzleBattleState(v: unknown): PuzzleBattleStateV1 | null {
  if (!puzzleRecord(v) || !puzzleExact(v, ['engineVersion', 'input', 'board', 'rng', 'turn', 'actionCount', 'hp', 'maxHp', 'rcv', 'guard', 'resilience',
    'members', 'enemies', 'shield', 'outcome', 'reason']) || v.engineVersion !== 1 || !puzzleInteger(v.turn, 0, PUZZLE_TURN_LIMIT) ||
    !puzzleInteger(v.actionCount, v.turn, PUZZLE_ACTION_LIMIT) || !puzzleRecord(v.rng) ||
    !puzzleExact(v.rng, ['opening', 'refill', 'playerConversion', 'enemyConversion']) ||
    Object.values(v.rng).some(n => !puzzleInteger(n, 1, 0xffffffff)) || !puzzleArray(v.members, PUZZLE_PARTY_SIZE) || v.members.length !== PUZZLE_PARTY_SIZE ||
    !puzzleArray(v.enemies, LIMIT.enemies) || (v.shield !== 0 && v.shield !== PUZZLE_SKILL_RULES.paceShield)) return null
  const input = parsePuzzleBattleInput(v.input), board = parsePuzzleBoard(v.board)
  if (!input || !board || v.enemies.length !== input.enemies.length) return null
  const totals = puzzlePartyStats(input)
  if (Object.entries(totals).some(([k, n]) => v[k] !== n) || !puzzleInteger(v.hp, 0, totals.maxHp)) return null
  const members: PuzzleBattleStateV1['members'] = []
  for (let i = 0; i < PUZZLE_PARTY_SIZE; i++) {
    const m: unknown = v.members[i], kit = PUZZLE_ACTIVES.find(a => a.id === input.entrants[i]!.kit.activeId)!
    if (!puzzleRecord(m) || !puzzleExact(m, ['charge', 'usedInGap']) || !puzzleInteger(m.charge, 0, Math.min(v.turn, kit.charge)) ||
      typeof m.usedInGap !== 'boolean' || (m.usedInGap && m.charge !== 0)) return null
    members.push({ charge: m.charge, usedInGap: m.usedInGap })
  }
  const enemies: PuzzleBattleStateV1['enemies'] = []
  for (let i = 0; i < input.enemies.length; i++) {
    const e: unknown = v.enemies[i], def = input.enemies[i]!
    if (!puzzleRecord(e) || !puzzleExact(e, ['id', 'hp', 'element', 'countdown', 'intentIndex', 'phaseFired', 'delayed', 'guard', 'ward']) ||
      e.id !== def.id || !puzzleInteger(e.hp, 0, def.maxHp) || typeof e.phaseFired !== 'boolean' || (e.phaseFired && !def.phase) ||
      typeof e.delayed !== 'boolean' || (e.delayed && def.delayImmune) || !puzzleInteger(e.countdown, 0, LIMIT.countdown + PUZZLE_SKILL_RULES.endDelay) ||
      !puzzleInteger(e.intentIndex, 0, def.intents.length - 1) || e.element !== (e.phaseFired ? def.phase?.element ?? def.element : def.element)) return null
    const guard = e.guard === null ? null : barrier(e.guard, v.turn), ward = e.ward === null ? null : barrier(e.ward, v.turn)
    if ((e.guard !== null && (!guard || guard.reduction !== PUZZLE_ENEMY_GUARD || guard.expiresAfterTurn !== v.turn + 1)) ||
      (e.ward !== null && !ward)) return null
    enemies.push({ id: e.id, hp: e.hp, element: e.element as PuzzleEnemyStateElement, countdown: e.countdown, intentIndex: e.intentIndex,
      phaseFired: e.phaseFired, delayed: e.delayed, guard, ward })
  }
  const cleared = enemies.every(e => e.hp === 0), dead = v.hp === 0
  const valid = v.outcome === 'active' ? v.reason === null && !cleared && !dead && v.turn < PUZZLE_TURN_LIMIT
    : v.outcome === 'win' ? v.reason === 'cleared' && cleared && !dead
    : v.outcome === 'loss' ? (v.reason === 'hp-zero' ? dead && !cleared : v.reason === 'turn-limit' && v.turn === PUZZLE_TURN_LIMIT && !cleared && !dead)
    : v.outcome === 'abandon' && v.reason === 'abandoned' && !cleared && !dead
  if (!valid) return null
  return { engineVersion: 1, input, board, rng: { opening: v.rng.opening as number, refill: v.rng.refill as number,
    playerConversion: v.rng.playerConversion as number, enemyConversion: v.rng.enemyConversion as number }, turn: v.turn,
    actionCount: v.actionCount, ...totals, hp: v.hp, members, enemies, shield: v.shield as number,
    outcome: v.outcome as PuzzleBattleStateV1['outcome'], reason: v.reason as PuzzleBattleStateV1['reason'] }
}
type PuzzleEnemyStateElement = PuzzleBattleStateV1['enemies'][number]['element']
export function parsePuzzleBattleResult(v: unknown): PuzzleBattleResultV1 | null {
  if (!puzzleRecord(v) || !puzzleExact(v, ['engineVersion', 'battleId', 'ownerEpoch', 'actionCount', 'stateHash', 'outcome', 'reason', 'drags', 'hpRemaining']) ||
    v.engineVersion !== 1 || !puzzleId(v.battleId) || !puzzleInteger(v.ownerEpoch) || !puzzleInteger(v.drags, 0, PUZZLE_TURN_LIMIT) ||
    !puzzleInteger(v.actionCount, v.drags, PUZZLE_ACTION_LIMIT) || typeof v.stateHash !== 'string' || !/^[0-9a-f]{16}$/.test(v.stateHash) ||
    !puzzleInteger(v.hpRemaining) || !(v.outcome === 'win' ? v.reason === 'cleared' && v.hpRemaining > 0 :
      v.outcome === 'loss' ? v.reason === 'hp-zero' && v.hpRemaining === 0 || v.reason === 'turn-limit' && v.drags === PUZZLE_TURN_LIMIT && v.hpRemaining > 0 :
      v.outcome === 'abandon' && v.reason === 'abandoned' && v.hpRemaining > 0)) return null
  return { engineVersion: 1, battleId: v.battleId, ownerEpoch: v.ownerEpoch, actionCount: v.actionCount, stateHash: v.stateHash,
    outcome: v.outcome as PuzzleBattleResultV1['outcome'], reason: v.reason as PuzzleBattleResultV1['reason'], drags: v.drags, hpRemaining: v.hpRemaining }
}
