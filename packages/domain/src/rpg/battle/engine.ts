// Deterministic campaign battle reducer, engine v3 (docs/design/uma-rpg.md#battles, D265).
// Octopath Traveler breaks: every foe has a shield and weaknesses (one element, two or more weapon kinds). Each hit of
// a weak kind chips one point; Attack counts as its weapon. Unbroken foes take half damage; at zero they Break, lose
// that round's and the next round's action, take full damage, then raise their shield again.
import { RPG_DEPTH_GATES, RPG_ELEMENTS, rpgActiveSlots, rpgSkillKey, rpgTreePointsEarned, rpgTreePointsSpent,
  rpgWeaponsForStyle, type RpgElement, type RpgSkillRef } from '../rules'
import {
  BATTLE_ATTACK_POWER, BATTLE_BREAK_ROUNDS, BATTLE_BUFF_PERCENT, BATTLE_BURN_PERCENT, BATTLE_DEFENSE_SHARE,
  BATTLE_GUARD_FACTOR, BATTLE_MARK_PERCENT, BATTLE_MAX_ROUNDS, BATTLE_MIN_OFFENSE_SHARE, BATTLE_SKILL_LEVEL_STEP,
  BATTLE_STATUS_STACK_CAP, BATTLE_STATUS_TURNS, BATTLE_UNBROKEN_FACTOR, BATTLE_WEAK, BATTLE_WEAPON_KINDS,
  battleChannel, battleSignatureFactor, battleSkill, battleWeaponKind, type BattleSkill,
} from './skills'
import { RPG_MAX_TREE_NODES } from '../save'
import type { BattleAction, BattleAlly, BattleChannel, BattleCue, BattleEnemy, BattleEnemyMove, BattleError,
  BattleInput, BattleIntent, BattleSide, BattleState, BattleStatusKind, BattleStep, BattleUnit, BattleWeaponKind } from './types'

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{0,127}$/
const safeInt = (v: unknown, min: number, max: number): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max
function hashNumber(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, part]) => `${JSON.stringify(key)}:${stable(part)}`).join(',')}}`
  }
  return JSON.stringify(value)
}
export function battleStateHash(state: BattleState): string {
  return `rpg-battle-v3:${hashNumber(stable(state)).toString(16).padStart(8, '0')}`
}

const unit = (s: BattleState, id: string) => s.units.find((u) => u.id === id)
const allyOf = (s: BattleState, id: string) => s.input.allies.find((a) => a.id === id)
const enemyOf = (s: BattleState, id: string) => s.input.enemies.find((e) => e.id === id)
const living = (s: BattleState, side: BattleSide) => s.units.filter((u) => u.side === side && u.hp > 0)
const maxHp = (s: BattleState, id: string) => allyOf(s, id)?.stats.hp ?? enemyOf(s, id)!.stats.hp
const stacks = (u: BattleUnit, kind: BattleStatusKind) => u.statuses.find((x) => x.kind === kind)?.stacks ?? 0
export const battleBroken = (u: BattleUnit): boolean => u.brokenAt > 0

function addStatus(target: BattleUnit, kind: BattleStatusKind): void {
  const current = target.statuses.find((x) => x.kind === kind)
  if (current) {
    current.stacks = kind === 'burn' || kind === 'mark' ? Math.min(BATTLE_STATUS_STACK_CAP, current.stacks + 1) : 1
    current.turns = BATTLE_STATUS_TURNS
  } else target.statuses.push({ kind, stacks: 1, turns: BATTLE_STATUS_TURNS })
  target.statuses.sort((a, b) => a.kind.localeCompare(b.kind))
}

function validStats(v: Record<string, unknown> | undefined, keys: readonly string[]): boolean {
  return !!v && typeof v === 'object' && keys.every((k) => safeInt(v[k], k === 'hp' ? 1 : 0, 10_000_000))
}
const ALLY_STATS = ['speed', 'stamina', 'power', 'guts', 'wit', 'atk', 'matk', 'initiative', 'pdef', 'mdef', 'dexterity', 'hp', 'mp']
const ENEMY_STATS = ['hp', 'atk', 'matk', 'pdef', 'mdef', 'initiative']
function validMove(m: BattleEnemyMove): boolean {
  return SAFE_ID.test(m.id) && ['damage', 'guard', 'buff', 'debuff'].includes(m.kind) &&
    ['physical', 'magical'].includes(m.channel) && (m.element === null || RPG_ELEMENTS.includes(m.element)) &&
    safeInt(m.power, 0, 1000) && typeof m.label === 'string' && m.label.length > 0 && m.label.length <= 80 &&
    (m.kind === 'damage' ? ['front', 'lowest-hp', 'seeded', 'all'].includes(m.target)
      : m.kind === 'debuff' ? ['front', 'lowest-hp', 'seeded'].includes(m.target) : ['self', 'ally'].includes(m.target)) &&
    (m.status === undefined || (m.kind === 'buff' ? ['ward', 'power-up'].includes(m.status)
      : ['burn', 'slow', 'mark', 'weaken'].includes(m.status)))
}

/** Learned, slotted and affinity-legal; the same tree rules the profile enforces. */
function validAlly(a: BattleAlly): boolean {
  if (!SAFE_ID.test(a.id) || !rpgWeaponsForStyle(a.style).includes(a.weapon) || !safeInt(a.tier, 1, 1_000_000) ||
    !safeInt(a.level, 1, 50) || !validStats(a.stats as unknown as Record<string, unknown>, ALLY_STATS) ||
    !safeInt(a.mp, 0, a.stats.mp) || !a.affinities || !a.affinities[a.signature] ||
    !Array.isArray(a.tree) || !Array.isArray(a.legacy) || !Array.isArray(a.loadout) ||
    a.loadout.length > rpgActiveSlots(a.level) || a.tree.length > RPG_MAX_TREE_NODES || a.legacy.length > 2) return false
  const learned = [...a.tree, ...a.legacy]
  if (new Set(learned.map(rpgSkillKey)).size !== learned.length || rpgTreePointsSpent(a.tree) > rpgTreePointsEarned(a.level)) return false
  if (learned.some((s) => s.weapon !== a.weapon || !a.affinities[s.element] || (a.affinities[s.element] === 'B' && s.depth > 3) ||
    !safeInt(s.level, 1, 5) || (a.tree.includes(s) ? s.tier !== a.tier : s.tier >= a.tier))) return false
  if (a.tree.some((s) => a.level < RPG_DEPTH_GATES[s.depth - 1]! ||
    (s.depth > 1 && !a.tree.some((p) => p.element === s.element && p.depth === s.depth - 1)))) return false
  const keys = a.loadout.map(rpgSkillKey)
  return new Set(keys).size === keys.length && a.loadout.filter((r) => r.tier < a.tier).length <= 2 &&
    keys.every((k) => learned.some((s) => rpgSkillKey(s) === k))
}
function validEnemy(e: BattleEnemy): boolean {
  const w = e.weaknesses
  return SAFE_ID.test(e.id) && SAFE_ID.test(e.castId) && RPG_ELEMENTS.includes(e.element) &&
    ['regular', 'sub-boss', 'boss'].includes(e.rank) && safeInt(e.level, 1, 1_000_000) &&
    validStats(e.stats as unknown as Record<string, unknown>, ENEMY_STATS) && safeInt(e.shield, 1, 20) &&
    !!w && RPG_ELEMENTS.includes(w.element) && Array.isArray(w.weapons) && w.weapons.length >= 1 && w.weapons.length <= 5 &&
    w.weapons.every((k) => BATTLE_WEAPON_KINDS.includes(k)) && new Set(w.weapons).size === w.weapons.length &&
    Array.isArray(e.moves) && e.moves.length >= 1 && e.moves.length <= 8 && e.moves.every(validMove) &&
    new Set(e.moves.map((m) => m.id)).size === e.moves.length &&
    (e.phaseTwo === undefined || (safeInt(e.phaseTwo.thresholdPercent, 1, 99) && e.phaseTwo.moves.length >= 1 &&
      e.phaseTwo.moves.length <= 8 && e.phaseTwo.moves.every(validMove)))
}
function validateInput(input: BattleInput): void {
  if (!input || input.version !== 3 || !safeInt(input.seed, 0, 0xffff_ffff) || !Array.isArray(input.allies) ||
    input.allies.length !== 5 || !Array.isArray(input.enemies) || input.enemies.length < 1 || input.enemies.length > 5) {
    throw new RangeError('Invalid battle header')
  }
  const ids = [...input.allies.map((a) => a.id), ...input.enemies.map((e) => e.id)]
  if (new Set(ids).size !== ids.length) throw new RangeError('Duplicate battle unit')
  if (!input.allies.every(validAlly)) throw new RangeError('Invalid battle ally')
  if (!input.enemies.every(validEnemy)) throw new RangeError('Invalid battle enemy')
}

function clone(s: BattleState): BattleState {
  return { ...s, units: s.units.map((u) => ({ ...u, statuses: u.statuses.map((x) => ({ ...x })) })),
    acted: [...s.acted], intents: s.intents.map((i) => ({ ...i })) }
}
const movesOf = (s: BattleState, u: BattleUnit): BattleEnemyMove[] => {
  const e = enemyOf(s, u.id)!
  return u.phase === 2 && e.phaseTwo ? e.phaseTwo.moves : e.moves
}
function chooseTarget(s: BattleState, e: BattleEnemy, m: BattleEnemyMove): string {
  if (m.target === 'self') return e.id
  if (m.target === 'all') return 'all'
  if (m.target === 'ally') {
    return living(s, 'enemy').sort((a, b) => a.hp / maxHp(s, a.id) - b.hp / maxHp(s, b.id) || a.id.localeCompare(b.id))[0]?.id ?? e.id
  }
  const allies = living(s, 'ally')
  if (m.target === 'front') return allies[0]?.id ?? ''
  if (m.target === 'lowest-hp') {
    return [...allies].sort((a, b) => a.hp / maxHp(s, a.id) - b.hp / maxHp(s, b.id) || a.id.localeCompare(b.id))[0]?.id ?? ''
  }
  return allies[hashNumber(`${s.input.seed}:${s.round}:${e.id}:target`) % allies.length]?.id ?? ''
}
function intentFor(s: BattleState, u: BattleUnit): BattleIntent {
  const e = enemyOf(s, u.id)!
  const moves = movesOf(s, u)
  const move = moves[hashNumber(`${s.input.seed}:${s.round}:${e.id}:phase${u.phase}:move`) % moves.length]!
  return { enemyId: e.id, moveId: move.id, targetId: chooseTarget(s, e, move) }
}
function intentsFor(s: BattleState): BattleIntent[] {
  return living(s, 'enemy').sort((a, b) => enemyOf(s, b.id)!.stats.initiative - enemyOf(s, a.id)!.stats.initiative ||
    a.id.localeCompare(b.id)).map((u) => intentFor(s, u))
}
function reveal(s: BattleState): BattleCue[] {
  return s.intents.map((i) => {
    const move = movesOf(s, unit(s, i.enemyId)!).find((m) => m.id === i.moveId)!
    return { kind: 'intent' as const, actorId: i.enemyId, targetId: i.targetId, label: move.label }
  })
}

export function createBattle(source: BattleInput): BattleStep {
  validateInput(source)
  const input = JSON.parse(JSON.stringify(source)) as BattleInput
  const units: BattleUnit[] = [
    ...input.allies.map((a) => ({ id: a.id, side: 'ally' as const, hp: a.stats.hp, mp: a.mp, statuses: [], phase: 1 as const,
      guardingFor: null, shield: 0, brokenAt: 0 })),
    ...input.enemies.map((e) => ({ id: e.id, side: 'enemy' as const, hp: e.stats.hp, mp: 0, statuses: [], phase: 1 as const,
      guardingFor: null, shield: e.shield, brokenAt: 0 })),
  ]
  const state: BattleState = { engineVersion: 3, input, round: 1, units, acted: [], intents: [], outcome: 'active' }
  state.intents = intentsFor(state)
  return { state, cues: reveal(state), hash: battleStateHash(state) }
}

function offenseOf(s: BattleState, id: string, channel: BattleChannel): number {
  const stats = allyOf(s, id)?.stats ?? enemyOf(s, id)!.stats
  return channel === 'physical' ? stats.atk : stats.matk
}
function defenseOf(s: BattleState, id: string, channel: BattleChannel): number {
  const stats = allyOf(s, id)?.stats ?? enemyOf(s, id)!.stats
  return channel === 'physical' ? stats.pdef : stats.mdef
}

/** A hit is weak when its element or (for Attack) its weapon kind is on the foe's list. */
export function battleHitIsWeak(enemy: BattleEnemy, element: RpgElement | null, weapon: BattleWeaponKind | null): boolean {
  return (element !== null && enemy.weaknesses.element === element) || (weapon !== null && enemy.weaknesses.weapons.includes(weapon))
}

/** One hit's final amount; shared by live play, previews and the simulator. */
export function battleDamage(s: BattleState, attacker: BattleUnit, defender: BattleUnit, channel: BattleChannel,
  power: number, element: RpgElement | null, weapon: BattleWeaponKind | null, skillLevel = 1): { amount: number; weak: boolean } {
  const offense = offenseOf(s, attacker.id, channel)
  let amount = Math.max(offense * BATTLE_MIN_OFFENSE_SHARE, offense - defenseOf(s, defender.id, channel) * BATTLE_DEFENSE_SHARE) * power
  const foe = defender.side === 'enemy' ? enemyOf(s, defender.id)! : null
  const weak = !!foe && attacker.side === 'ally' && battleHitIsWeak(foe, element, weapon)
  if (weak) amount *= BATTLE_WEAK
  amount *= 1 + (skillLevel - 1) * BATTLE_SKILL_LEVEL_STEP
  amount *= 1 + stacks(attacker, 'power-up') * BATTLE_BUFF_PERCENT
  amount *= 1 - stacks(attacker, 'weaken') * BATTLE_BUFF_PERCENT
  amount *= 1 - stacks(attacker, 'slow') * BATTLE_BUFF_PERCENT
  amount *= 1 + stacks(defender, 'mark') * BATTLE_MARK_PERCENT
  amount *= 1 - stacks(defender, 'ward') * BATTLE_BUFF_PERCENT
  const ally = allyOf(s, attacker.id)
  if (ally) amount *= battleSignatureFactor(ally.signature, element)
  if (foe && !battleBroken(defender)) amount *= BATTLE_UNBROKEN_FACTOR
  return { amount: Math.max(1, Math.round(amount)), weak }
}

function guardOf(s: BattleState, target: BattleUnit): BattleUnit {
  return s.units.find((u) => u.side === target.side && u.hp > 0 && u.guardingFor === target.id) ?? target
}
function terminal(s: BattleState, cues: BattleCue[]): boolean {
  const allies = living(s, 'ally').length, enemies = living(s, 'enemy').length
  if (allies && enemies) return false
  // A party with nobody standing never clears, even if the last foe fell on the same tick.
  s.outcome = allies ? 'victory' : 'loss'
  s.intents = []
  cues.push({ kind: 'result', label: s.outcome })
  return true
}

/** Applies one hit; a weak hit on a standing shield chips it and may Break the foe. */
function strike(s: BattleState, actor: BattleUnit, target: BattleUnit, channel: BattleChannel, power: number,
  element: RpgElement | null, weapon: BattleWeaponKind | null, level: number, cues: BattleCue[], intercept: boolean): void {
  const receiver = intercept ? guardOf(s, target) : target
  const result = battleDamage(s, actor, receiver, channel, power, element, weapon, level)
  const amount = receiver !== target ? Math.max(1, Math.round(result.amount * BATTLE_GUARD_FACTOR)) : result.amount
  receiver.hp = Math.max(0, receiver.hp - amount)
  cues.push({ kind: 'hit', actorId: actor.id, targetId: receiver.id, amount, channel, element, weak: result.weak,
    label: receiver !== target ? 'Intercepted' : undefined })
  if (receiver.hp === 0) { cues.push({ kind: 'ko', actorId: actor.id, targetId: receiver.id }); return }
  if (!result.weak || battleBroken(receiver) || receiver.shield === 0) return
  receiver.shield -= 1
  cues.push({ kind: 'shield', actorId: actor.id, targetId: receiver.id, amount: receiver.shield })
  if (receiver.shield === 0) {
    receiver.brokenAt = s.round
    cues.push({ kind: 'break', actorId: actor.id, targetId: receiver.id })
  }
}

function updatePhases(s: BattleState, cues: BattleCue[]): void {
  for (const u of living(s, 'enemy')) {
    const phase = enemyOf(s, u.id)!.phaseTwo
    if (!phase || u.phase === 2 || u.hp * 100 > maxHp(s, u.id) * phase.thresholdPercent) continue
    u.phase = 2
    cues.push({ kind: 'phase', actorId: u.id, targetId: u.id, label: 'Phase 2' })
    const index = s.intents.findIndex((i) => i.enemyId === u.id)
    const next = intentFor(s, u)
    if (index >= 0) s.intents[index] = next
    const move = movesOf(s, u).find((m) => m.id === next.moveId)!
    cues.push({ kind: 'intent', actorId: u.id, targetId: next.targetId, label: move.label })
  }
}

function resolveEnemies(s: BattleState, cues: BattleCue[]): void {
  for (const u of s.units) if (u.side === 'enemy') u.guardingFor = null
  for (const intent of s.intents) {
    const actor = unit(s, intent.enemyId)
    if (!actor || actor.hp <= 0 || !living(s, 'ally').length) continue
    if (battleBroken(actor)) { cues.push({ kind: 'skip', actorId: actor.id, targetId: actor.id, label: 'Broken' }); continue }
    const source = enemyOf(s, actor.id)!
    const move = movesOf(s, actor).find((m) => m.id === intent.moveId)
    if (!move) throw new RangeError('Frozen intent no longer matches phase')
    if (move.kind === 'damage' && move.target === 'all') {
      for (const target of living(s, 'ally')) {
        strike(s, actor, target, move.channel, move.power / 100, move.element, null, 1, cues, false)
        if (target.hp > 0 && move.status) { addStatus(target, move.status); cues.push({ kind: 'status', actorId: actor.id, targetId: target.id, label: move.status }) }
      }
    } else if (move.kind === 'damage' || move.kind === 'debuff') {
      const chosen = unit(s, intent.targetId)
      const target = chosen && chosen.hp > 0 ? chosen : unit(s, chooseTarget(s, source, move))
      if (!target) continue
      if (target.id !== intent.targetId) cues.push({ kind: 'intent', actorId: actor.id, targetId: target.id, label: 'Retarget' })
      if (move.kind === 'damage') strike(s, actor, target, move.channel, move.power / 100, move.element, null, 1, cues, true)
      if (target.hp > 0 && move.status) { addStatus(target, move.status); cues.push({ kind: 'status', actorId: actor.id, targetId: target.id, label: move.status }) }
    } else if (move.kind === 'guard') {
      const ward = unit(s, chooseTarget(s, source, move))!
      actor.guardingFor = ward.id === actor.id ? null : ward.id
      cues.push({ kind: 'guard', actorId: actor.id, targetId: ward.id })
    } else if (move.status) {
      const target = unit(s, chooseTarget(s, source, move))!
      addStatus(target, move.status)
      cues.push({ kind: 'status', actorId: actor.id, targetId: target.id, label: move.status })
    }
    if (terminal(s, cues)) return
  }
  // A break ends after its second enemy phase; guards lapse; burn ticks before durations decay.
  for (const u of s.units) {
    if (u.side === 'ally') u.guardingFor = null
    if (u.hp <= 0) continue
    if (u.side === 'enemy' && battleBroken(u) && s.round >= u.brokenAt + BATTLE_BREAK_ROUNDS - 1) {
      u.brokenAt = 0
      u.shield = enemyOf(s, u.id)!.shield
      cues.push({ kind: 'recover', actorId: u.id, targetId: u.id, amount: u.shield })
    }
    const burn = stacks(u, 'burn')
    if (burn) {
      const amount = Math.max(1, Math.round(maxHp(s, u.id) * BATTLE_BURN_PERCENT * burn))
      u.hp = Math.max(0, u.hp - amount)
      cues.push({ kind: 'hit', actorId: u.id, targetId: u.id, amount, channel: 'status', element: 'fire', weak: false, label: 'Burn' })
      if (u.hp === 0) cues.push({ kind: 'ko', actorId: u.id, targetId: u.id })
    }
    u.statuses = u.statuses.map((x) => ({ ...x, turns: x.turns - 1 })).filter((x) => x.turns > 0)
  }
  if (terminal(s, cues)) return
  if (s.round >= BATTLE_MAX_ROUNDS) {
    s.outcome = 'loss'
    s.intents = []
    cues.push({ kind: 'result', label: 'loss' })
    return
  }
  s.round += 1
  s.acted = []
  s.intents = intentsFor(s)
  cues.push(...reveal(s))
}

function invalid(s: BattleState, error: BattleError): BattleStep { return { state: s, cues: [], hash: battleStateHash(s), error } }

/** Skill the actor may use: learned, slotted, legal for its affinity and tier. */
export function battleActorSkill(s: BattleState, actorId: string, ref: RpgSkillRef): { skill: BattleSkill; level: number } | null {
  const a = allyOf(s, actorId)
  if (!a) return null
  const key = rpgSkillKey(ref)
  const learned = [...a.tree, ...a.legacy].find((x) => rpgSkillKey(x) === key)
  if (!learned || !a.loadout.some((x) => rpgSkillKey(x) === key) || ref.weapon !== a.weapon || !a.affinities[ref.element] ||
    (a.affinities[ref.element] === 'B' && ref.depth > 3) ||
    (ref.tier !== a.tier && !a.legacy.some((x) => rpgSkillKey(x) === key))) return null
  return { skill: battleSkill(ref), level: learned.level }
}

/** Random-target hits are seeded by the fight, round, actor and hit, so a replay lands the same hits. */
function randomFoe(s: BattleState, actorId: string, hit: number): BattleUnit | undefined {
  const foes = living(s, 'enemy')
  return foes[hashNumber(`${s.input.seed}:${s.round}:${actorId}:${s.acted.length}:${hit}:barrage`) % Math.max(1, foes.length)]
}

export function applyBattleAction(previous: BattleState, action: BattleAction): BattleStep {
  if (previous.engineVersion !== 3 || !previous.input || !Array.isArray(previous.units)) return invalid(previous, 'invalid-state')
  if (previous.outcome !== 'active') return invalid(previous, 'terminal')
  if (!action || !['attack', 'guard', 'skill'].includes(action.kind)) return invalid(previous, 'invalid-state')
  const actorUnit = unit(previous, action.actorId)
  if (!actorUnit || actorUnit.side !== 'ally' || actorUnit.hp <= 0) return invalid(previous, 'invalid-actor')
  if (previous.acted.includes(actorUnit.id)) return invalid(previous, 'already-acted')
  const targetUnit = unit(previous, action.targetId)
  if (!targetUnit || targetUnit.hp <= 0) return invalid(previous, 'invalid-target')
  const s = clone(previous)
  const actor = unit(s, actorUnit.id)!
  const target = unit(s, targetUnit.id)!
  const ally = allyOf(s, actor.id)!
  const cues: BattleCue[] = []
  if (action.kind === 'guard') {
    if (target.side !== 'ally' || target.id === actor.id) return invalid(previous, 'invalid-target')
    actor.guardingFor = target.id
    cues.push({ kind: 'guard', actorId: actor.id, targetId: target.id })
  } else if (action.kind === 'attack') {
    if (target.side !== 'enemy') return invalid(previous, 'invalid-target')
    strike(s, actor, target, battleChannel(ally.weapon), BATTLE_ATTACK_POWER, null, battleWeaponKind(ally.weapon), 1, cues, true)
  } else {
    if (!action.skill || typeof action.skill !== 'object') return invalid(previous, 'invalid-skill')
    const legal = battleActorSkill(s, actor.id, action.skill)
    if (!legal) return invalid(previous, 'invalid-skill')
    if (target.side !== 'enemy') return invalid(previous, 'invalid-target')
    const { skill, level } = legal
    if (actor.mp < skill.mp) return invalid(previous, 'insufficient-mp')
    actor.mp -= skill.mp
    const struck = new Set<BattleUnit>()
    const hitOnce = (foe: BattleUnit, intercept: boolean) => {
      strike(s, actor, foe, skill.channel, skill.power, skill.element, null, level, cues, intercept)
      struck.add(intercept ? guardOf(s, foe) : foe)
    }
    if (skill.target === 'all') for (const foe of living(s, 'enemy')) hitOnce(foe, false)
    else if (skill.target === 'random') {
      for (let hit = 0; hit < skill.hits && living(s, 'enemy').length; hit += 1) hitOnce(randomFoe(s, actor.id, hit)!, false)
    } else for (let hit = 0; hit < skill.hits && target.hp > 0; hit += 1) hitOnce(target, true)
    for (const foe of struck) {
      if (foe.hp > 0 && skill.status) { addStatus(foe, skill.status); cues.push({ kind: 'status', actorId: actor.id, targetId: foe.id, label: skill.status }) }
      if (skill.element === 'light' && foe.hp > 0 && stacks(foe, 'ward')) {
        foe.statuses = foe.statuses.filter((x) => x.kind !== 'ward')
        cues.push({ kind: 'status', actorId: actor.id, targetId: foe.id, label: 'ward broken' })
      }
    }
    if (skill.support) {
      for (const friend of living(s, 'ally')) addStatus(friend, skill.support)
      cues.push({ kind: 'status', actorId: actor.id, targetId: actor.id, label: `party ${skill.support}` })
    }
  }
  s.acted.push(actor.id)
  if (!terminal(s, cues)) {
    updatePhases(s, cues)
    if (living(s, 'ally').every((u) => s.acted.includes(u.id))) resolveEnemies(s, cues)
  }
  return { state: s, cues, hash: battleStateHash(s) }
}

export function replayBattle(input: BattleInput, actions: readonly BattleAction[]): BattleStep {
  if (actions.length > BATTLE_MAX_ROUNDS * 5) throw new RangeError('Battle replay is too long')
  let result = createBattle(input)
  const cues = [...result.cues]
  for (const action of actions) {
    result = applyBattleAction(result.state, action)
    if (result.error) return { ...result, cues }
    cues.push(...result.cues)
  }
  return { ...result, cues }
}
