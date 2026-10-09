// Deterministic campaign battle reducer, engine v5 (docs/design/uma-rpg-classes.md, D278–D281, D310).
// Octopath Traveler breaks with class hands: every hit has one to three parts, and each weak part removes one shield
// point. Mages, Spell Blades and Summoners act twice a round; a Cleric's Arcane cast carries a blessing chosen from the
// branch its element points to. Unbroken foes take half damage.
import { RPG_SKILL_POWER, rpgBlessingBranch, rpgNode, type RpgHit, type RpgSkillDef } from '../catalog'
import {
  RPG_CLASSES, RPG_ELEMENTS, RPG_MAX_LEGACY_SLOTS, RPG_WEAPON_KINDS, rpgActiveSlots, rpgHand, rpgNodeKey, validRpgTree, validRpgWeapons,
  type RpgDamageKind, type RpgStatusKind,
} from '../rules'
import {
  BATTLE_BARRIER_CAP, BATTLE_BARRIER_PERCENT, BATTLE_BREAK_ROUNDS, BATTLE_BURN_PERCENT, BATTLE_CLARITY_PERCENT, BATTLE_CURE_PERCENT,
  BATTLE_DEFENSE_SHARE, BATTLE_FOE_STATUS_STEP, BATTLE_GUARD_FACTOR, BATTLE_MAX_ROUNDS, BATTLE_MIN_OFFENSE_SHARE,
  BATTLE_REBIRTH_PERCENT, BATTLE_REGEN_PERCENT, BATTLE_STATUS_STACK_CAP, BATTLE_STATUS_STEP, BATTLE_STATUS_TURNS,
  BATTLE_ULTIMA, BATTLE_UNBROKEN_FACTOR, BATTLE_WEAK, battleChannel, battleSkillFor, type BattleSkill,
} from './skills'
import { RPG_MAX_TREE_NODES } from '../save'
import type { BattleAction, BattleAlly, BattleChannel, BattleCue, BattleEnemy, BattleEnemyMove, BattleError,
  BattleInput, BattleIntent, BattleSide, BattleState, BattleStep, BattleUnit } from './types'

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
  return `rpg-battle-v5:${hashNumber(stable(state)).toString(16).padStart(8, '0')}`
}

const unit = (s: BattleState, id: string) => s.units.find((u) => u.id === id)
const allyOf = (s: BattleState, id: string) => s.input.allies.find((a) => a.id === id)
const enemyOf = (s: BattleState, id: string) => s.input.enemies.find((e) => e.id === id)
const living = (s: BattleState, side: BattleSide) => s.units.filter((u) => u.side === side && u.hp > 0)
const maxHp = (s: BattleState, id: string) => allyOf(s, id)?.stats.hp ?? enemyOf(s, id)!.stats.hp
const stacks = (u: BattleUnit, kind: RpgStatusKind) => u.statuses.find((x) => x.kind === kind)?.stacks ?? 0
export const battleBroken = (u: BattleUnit): boolean => u.brokenAt > 0
const learnedPassive = (ally: BattleAlly, key: string): boolean => ally.tree.some((ref) => rpgNode(ref.id)?.passive === key)
/** Actions this Uma has spent this round, and how many she has. */
export const battleActionsUsed = (s: BattleState, id: string): number => s.acted.filter((x) => x === id).length
export const battleActionsLeft = (s: BattleState, id: string): number => {
  const ally = allyOf(s, id)
  return ally ? Math.max(0, rpgHand(ally).actions - battleActionsUsed(s, id)) : 0
}

function addStatus(target: BattleUnit, kind: RpgStatusKind, count = 1, turns = BATTLE_STATUS_TURNS, cap = BATTLE_STATUS_STACK_CAP): void {
  const current = target.statuses.find((x) => x.kind === kind)
  if (current) {
    current.stacks = Math.min(Math.max(cap, current.stacks), current.stacks + count)
    current.turns = Math.max(current.turns, turns)
  } else target.statuses.push({ kind, stacks: Math.min(cap, count), turns })
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

/** Learned, slotted and legal for her class; the same tree rules the profile enforces. */
function validAlly(a: BattleAlly): boolean {
  if (!SAFE_ID.test(a.id) || !RPG_CLASSES.includes(a.classId) || !Array.isArray(a.weapons) || !validRpgWeapons(a.classId, a.weapons) ||
    !safeInt(a.tier, 1, 1_000_000) || !safeInt(a.level, 1, 50) || !validStats(a.stats as unknown as Record<string, unknown>, ALLY_STATS) ||
    !safeInt(a.mp, 0, a.stats.mp) || !RPG_WEAPON_KINDS.includes(a.familiar) ||
    !Array.isArray(a.tree) || !Array.isArray(a.legacy) || !Array.isArray(a.loadout) ||
    a.loadout.length > rpgActiveSlots(a.level) || a.tree.length > RPG_MAX_TREE_NODES || a.legacy.length > RPG_MAX_LEGACY_SLOTS) return false
  if (!validRpgTree(a) || a.legacy.some((r) => r.tier >= a.tier || !rpgNode(r.id)?.skill)) return false
  const keys = a.loadout.map(rpgNodeKey)
  return new Set(keys).size === keys.length && a.loadout.filter((r) => r.tier < a.tier).length <= RPG_MAX_LEGACY_SLOTS &&
    a.loadout.every((ref) => battleSkillFor(a, ref) !== null)
}
function validEnemy(e: BattleEnemy): boolean {
  const w = e.weaknesses
  const set = <T>(list: unknown, all: readonly T[]) => Array.isArray(list) && list.length <= all.length &&
    list.every((k) => all.includes(k as T)) && new Set(list).size === list.length
  return SAFE_ID.test(e.id) && SAFE_ID.test(e.castId) && RPG_ELEMENTS.includes(e.element) &&
    ['regular', 'sub-boss', 'boss'].includes(e.rank) && safeInt(e.level, 1, 1_000_000) &&
    validStats(e.stats as unknown as Record<string, unknown>, ENEMY_STATS) && safeInt(e.shield, 1, 20) &&
    !!w && set(w.weapons, RPG_WEAPON_KINDS) && set(w.elements, RPG_ELEMENTS) && w.weapons.length + w.elements.length >= 1 &&
    Array.isArray(e.moves) && e.moves.length >= 1 && e.moves.length <= 8 && e.moves.every(validMove) &&
    new Set(e.moves.map((m) => m.id)).size === e.moves.length &&
    (e.phaseTwo === undefined || (safeInt(e.phaseTwo.thresholdPercent, 1, 99) && e.phaseTwo.moves.length >= 1 &&
      e.phaseTwo.moves.length <= 8 && e.phaseTwo.moves.every(validMove)))
}
function validateInput(input: BattleInput): void {
  if (!input || input.version !== 5 || !safeInt(input.seed, 0, 0xffff_ffff) || !Array.isArray(input.allies) ||
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
    acted: [...s.acted], familiars: [...s.familiars], intents: s.intents.map((i) => ({ ...i })) }
}
const movesOf = (s: BattleState, u: BattleUnit): BattleEnemyMove[] => {
  const e = enemyOf(s, u.id)!
  return u.phase === 2 && e.phaseTwo ? e.phaseTwo.moves : e.moves
}
const byHpShare = (s: BattleState) => (a: BattleUnit, b: BattleUnit) => a.hp / maxHp(s, a.id) - b.hp / maxHp(s, b.id) || a.id.localeCompare(b.id)
function chooseTarget(s: BattleState, e: BattleEnemy, m: BattleEnemyMove): string {
  if (m.target === 'self') return e.id
  if (m.target === 'all') return 'all'
  if (m.target === 'ally') return [...living(s, 'enemy')].sort(byHpShare(s))[0]?.id ?? e.id
  const allies = living(s, 'ally')
  if (m.target === 'front') return allies[0]?.id ?? ''
  if (m.target === 'lowest-hp') return [...allies].sort(byHpShare(s))[0]?.id ?? ''
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
  const base = { statuses: [], barrier: 0, phase: 1 as const, guardingFor: null, brokenAt: 0, revived: false }
  const units: BattleUnit[] = [
    ...input.allies.map((a) => ({ ...base, id: a.id, side: 'ally' as const, hp: a.stats.hp, mp: a.mp, shield: 0 })),
    ...input.enemies.map((e) => ({ ...base, id: e.id, side: 'enemy' as const, hp: e.stats.hp, mp: 0, shield: e.shield })),
  ]
  const state: BattleState = { engineVersion: 5, input, round: 1, units, acted: [], familiars: [], intents: [], outcome: 'active' }
  state.intents = intentsFor(state)
  return { state, cues: reveal(state), hash: battleStateHash(state) }
}

/** A part is weak when its kind is on the foe's lists, or it is Light or Dark against a Hexed foe. */
export function battleHitIsWeak(enemy: BattleEnemy, foe: BattleUnit | null, kind: RpgDamageKind | null): boolean {
  if (kind === null || kind === 'ultima' || kind === 'staff') return false
  return (enemy.weaknesses.weapons as string[]).includes(kind) || (enemy.weaknesses.elements as string[]).includes(kind) ||
    (!!foe && stacks(foe, 'hex') > 0 && (kind === 'light' || kind === 'dark'))
}

interface HitOptions { special?: RpgSkillDef['special']; area?: boolean }
/** One part's final amount; shared by live play, previews and the simulator. */
export function battleDamage(s: BattleState, attacker: BattleUnit, defender: BattleUnit, channel: BattleChannel,
  power: number, kind: RpgDamageKind | null, options: HitOptions = {}): { amount: number; weak: boolean } {
  const atk = allyOf(s, attacker.id)?.stats ?? enemyOf(s, attacker.id)!.stats
  const def = allyOf(s, defender.id)?.stats ?? enemyOf(s, defender.id)!.stats
  const offense = channel === 'physical' ? atk.atk : atk.matk
  const defense = channel === 'physical' ? def.pdef : def.mdef
  let amount = Math.max(offense * BATTLE_MIN_OFFENSE_SHARE, offense - defense * BATTLE_DEFENSE_SHARE) * power
  const foe = defender.side === 'enemy' ? enemyOf(s, defender.id)! : null
  const weak = !!foe && attacker.side === 'ally' && battleHitIsWeak(foe, defender, kind)
  if (weak) amount *= BATTLE_WEAK
  if (kind === 'ultima') amount *= BATTLE_ULTIMA
  const physical = channel === 'physical'
  amount *= 1 + stacks(attacker, physical ? 'brave' : 'faith') * BATTLE_STATUS_STEP
  amount *= 1 + stacks(attacker, 'power-up') * BATTLE_FOE_STATUS_STEP
  amount *= 1 - (stacks(attacker, 'weaken') + stacks(attacker, 'slow')) * BATTLE_FOE_STATUS_STEP
  amount *= 1 - stacks(attacker, 'enfeeble') * BATTLE_STATUS_STEP
  amount *= 1 + (stacks(defender, physical ? 'armor-break' : 'mind-break') + stacks(defender, 'shock') + stacks(defender, 'mark')) * BATTLE_STATUS_STEP
  amount *= 1 - stacks(defender, 'ward') * BATTLE_FOE_STATUS_STEP
  amount *= 1 - stacks(defender, 'aegis') * BATTLE_STATUS_STEP
  if (stacks(defender, 'hex') > 1) amount *= 1 + BATTLE_STATUS_STEP
  if (foe && options.special === 'vs-broken' && battleBroken(defender)) amount *= 1.3
  if (foe && options.special === 'vs-wounded' && defender.hp * 2 < foe.stats.hp) amount *= 1.3
  if (foe && !battleBroken(defender) && options.special !== 'pierce') amount *= BATTLE_UNBROKEN_FACTOR
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

/** Removes shield points; at zero the foe Breaks. */
function chip(s: BattleState, actor: BattleUnit, foe: BattleUnit, points: number, cues: BattleCue[]): void {
  if (battleBroken(foe) || foe.shield === 0 || foe.hp <= 0 || points <= 0) return
  foe.shield = Math.max(0, foe.shield - points)
  cues.push({ kind: 'shield', actorId: actor.id, targetId: foe.id, amount: foe.shield })
  if (foe.shield === 0) {
    foe.brokenAt = s.round
    cues.push({ kind: 'break', actorId: actor.id, targetId: foe.id })
  }
}

/** Applies one hit's parts; each weak part on a standing shield removes a point (two with a Breaker charge). */
function strike(s: BattleState, actor: BattleUnit, target: BattleUnit, hit: RpgHit, scale: number, cues: BattleCue[],
  intercept: boolean, options: HitOptions = {}): { receiver: BattleUnit; weak: boolean } {
  const receiver = intercept ? guardOf(s, target) : target
  let anyWeak = false
  for (const part of hit.parts) {
    if (receiver.hp <= 0) break
    const channel = battleChannel(part.kind)
    const result = battleDamage(s, actor, receiver, channel, hit.power * part.share * scale, part.kind, options)
    const amount = receiver !== target ? Math.max(1, Math.round(result.amount * BATTLE_GUARD_FACTOR)) : result.amount
    receiver.hp = Math.max(0, receiver.hp - amount)
    cues.push({ kind: 'hit', actorId: actor.id, targetId: receiver.id, amount, channel, element: part.kind, weak: result.weak,
      label: receiver !== target ? 'Intercepted' : undefined })
    if (receiver.hp === 0) { cues.push({ kind: 'ko', actorId: actor.id, targetId: receiver.id }); break }
    if (!result.weak || battleBroken(receiver) || receiver.shield === 0) continue
    anyWeak = true
    const charge = actor.side === 'ally' && stacks(actor, 'breaker') > 0
    if (charge) {
      const status = actor.statuses.find((x) => x.kind === 'breaker')!
      status.stacks -= 1
      if (!status.stacks) actor.statuses = actor.statuses.filter((x) => x !== status)
    }
    chip(s, actor, receiver, charge ? 2 : 1, cues)
  }
  return { receiver, weak: anyWeak }
}

/** Damage from a foe to an ally: a Barrier absorbs first. */
function harm(s: BattleState, actor: BattleUnit, target: BattleUnit, move: BattleEnemyMove, cues: BattleCue[], intercept: boolean): void {
  const receiver = intercept ? guardOf(s, target) : target
  const result = battleDamage(s, actor, receiver, move.channel, move.power / 100, move.element, { area: move.target === 'all' })
  let amount = receiver !== target ? Math.max(1, Math.round(result.amount * BATTLE_GUARD_FACTOR)) : result.amount
  const absorbed = Math.min(receiver.barrier, amount)
  receiver.barrier -= absorbed
  amount -= absorbed
  receiver.hp = Math.max(0, receiver.hp - amount)
  cues.push({ kind: 'hit', actorId: actor.id, targetId: receiver.id, amount, channel: move.channel, element: move.element, weak: false,
    label: receiver !== target ? 'Intercepted' : absorbed ? `Barrier −${absorbed}` : undefined })
  if (receiver.hp === 0) cues.push({ kind: 'ko', actorId: actor.id, targetId: receiver.id })
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

const MALICE: readonly RpgStatusKind[] = ['armor-break', 'mind-break', 'enfeeble']
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
        harm(s, actor, target, move, cues, false)
        if (target.hp > 0 && move.status) { addStatus(target, move.status); cues.push({ kind: 'status', actorId: actor.id, targetId: target.id, label: move.status }) }
      }
    } else if (move.kind === 'damage' || move.kind === 'debuff') {
      const chosen = unit(s, intent.targetId)
      const target = chosen && chosen.hp > 0 ? chosen : unit(s, chooseTarget(s, source, move))
      if (!target) continue
      if (target.id !== intent.targetId) cues.push({ kind: 'intent', actorId: actor.id, targetId: target.id, label: 'Retarget' })
      if (move.kind === 'damage') harm(s, actor, target, move, cues, true)
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
  // A break ends after its second enemy phase; guards lapse; burn and regen tick before durations decay.
  for (const u of s.units) {
    if (u.side === 'ally') u.guardingFor = null
    if (u.hp <= 0) continue
    if (u.side === 'enemy' && battleBroken(u) && s.round >= u.brokenAt + BATTLE_BREAK_ROUNDS - 1) {
      const malice = MALICE.reduce((sum, kind) => sum + stacks(u, kind), 0)
      u.brokenAt = 0
      u.shield = Math.max(1, enemyOf(s, u.id)!.shield - (stacks(u, 'erosion') && malice >= 2 ? 1 : 0))
      cues.push({ kind: 'recover', actorId: u.id, targetId: u.id, amount: u.shield })
    }
    const burn = stacks(u, 'burn')
    if (burn) {
      const amount = Math.max(1, Math.round(maxHp(s, u.id) * BATTLE_BURN_PERCENT * burn))
      u.hp = Math.max(0, u.hp - amount)
      cues.push({ kind: 'hit', actorId: u.id, targetId: u.id, amount, channel: 'status', element: 'fire', weak: false, label: 'Burn' })
      if (u.hp === 0) { cues.push({ kind: 'ko', actorId: u.id, targetId: u.id }); continue }
    }
    const regen = stacks(u, 'regen')
    if (regen && u.side === 'ally') {
      heal(s, u, Math.round(maxHp(s, u.id) * BATTLE_REGEN_PERCENT * regen), u.id, cues, false)
      if (stacks(u, 'sacred')) restoreMp(s, u, 0.01 * regen, u.id, cues)
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
  s.familiars = []
  s.intents = intentsFor(s)
  cues.push(...reveal(s))
}

function heal(s: BattleState, u: BattleUnit, amount: number, actorId: string, cues: BattleCue[], overflow: boolean): void {
  const room = maxHp(s, u.id) - u.hp
  const healed = Math.min(room, Math.max(0, amount))
  u.hp += healed
  if (healed) cues.push({ kind: 'heal', actorId, targetId: u.id, amount: healed })
  if (overflow && amount > healed) addBarrier(s, u, amount - healed, actorId, cues)
}
function restoreMp(s: BattleState, u: BattleUnit, share: number, actorId: string, cues: BattleCue[]): void {
  const max = allyOf(s, u.id)!.stats.mp
  const gained = Math.min(max - u.mp, Math.round(max * share))
  if (gained > 0) { u.mp += gained; cues.push({ kind: 'mp', actorId, targetId: u.id, amount: gained }) }
}
function addBarrier(s: BattleState, u: BattleUnit, amount: number, actorId: string, cues: BattleCue[]): void {
  const cap = Math.round(maxHp(s, u.id) * BATTLE_BARRIER_CAP)
  const next = Math.min(cap, u.barrier + Math.round(amount))
  if (next > u.barrier) { cues.push({ kind: 'status', actorId, targetId: u.id, label: `barrier ${next}`, amount: next }); u.barrier = next }
}

function invalid(s: BattleState, error: BattleError): BattleStep { return { state: s, cues: [], hash: battleStateHash(s), error } }

/** Skill the actor may use: learned, slotted and in her class trees. */
export function battleActorSkill(s: BattleState, actorId: string, ref: { tier: number; id: string }): BattleSkill | null {
  const a = allyOf(s, actorId)
  return a ? battleSkillFor(a, ref) : null
}

/** Random-target hits are seeded by the fight, round, actor, action and hit, so a replay lands the same hits. */
function randomFoe(s: BattleState, actorId: string, hit: number, salt = 'random'): BattleUnit | undefined {
  const foes = living(s, 'enemy')
  return foes[hashNumber(`${s.input.seed}:${s.round}:${actorId}:${s.acted.length}:${hit}:${salt}`) % Math.max(1, foes.length)]
}

interface CastLog { tapped: BattleUnit; struck: BattleUnit[]; hitFoes: BattleUnit[]; weak: boolean }

/** Resolves a skill's hits, extras and riders. */
function cast(s: BattleState, actor: BattleUnit, tapped: BattleUnit, def: RpgSkillDef, scale: number, cues: BattleCue[]): CastLog {
  const log: CastLog = { tapped, struck: [], hitFoes: [], weak: false }
  const options: HitOptions = { special: def.special }
  const note = (foe: BattleUnit, hit: RpgHit, weak: boolean) => {
    if (!log.struck.includes(foe)) log.struck.push(foe)
    log.hitFoes.push(foe)
    log.weak ||= weak
    if (def.rider && def.rider.per !== 'foe' && foe.hp > 0 &&
      (def.rider.per === 'hit' || hit.parts.some((p) => p.kind === 'fire' || p.kind === 'ice' || p.kind === 'lightning'))) {
      addStatus(foe, def.rider.status)
      cues.push({ kind: 'status', actorId: actor.id, targetId: foe.id, label: def.rider.status })
    }
  }
  if (def.target === 'all') {
    for (const hit of def.hits) {
      for (const foe of living(s, 'enemy')) { const r = strike(s, actor, foe, hit, scale, cues, false, options); note(r.receiver, hit, r.weak) }
    }
  } else if (def.target === 'random') {
    def.hits.forEach((hit, i) => {
      const foe = randomFoe(s, actor.id, i)
      if (!foe) return
      const r = strike(s, actor, foe, hit, scale, cues, false, options)
      note(r.receiver, hit, r.weak)
    })
  } else {
    for (const hit of def.hits) {
      if (tapped.hp <= 0) break
      const r = strike(s, actor, tapped, hit, scale, cues, true, options)
      note(r.receiver, hit, r.weak)
    }
  }
  for (const hit of def.focus ?? []) if (tapped.hp > 0) { const r = strike(s, actor, tapped, hit, scale, cues, false, options); note(r.receiver, hit, r.weak) }
  if (def.splash) for (const foe of living(s, 'enemy')) if (foe !== tapped) { const r = strike(s, actor, foe, def.splash, scale, cues, false, options); note(r.receiver, def.splash, r.weak) }
  if (def.sweep) for (const foe of living(s, 'enemy')) { const r = strike(s, actor, foe, def.sweep, scale, cues, false, options); note(r.receiver, def.sweep, r.weak) }
  if (def.rider?.per === 'foe') {
    for (const foe of log.struck) if (foe.hp > 0) {
      addStatus(foe, def.rider.status, def.rider.stacks)
      cues.push({ kind: 'status', actorId: actor.id, targetId: foe.id, label: def.rider.status })
    }
  }
  if (def.allies) for (const friend of living(s, 'ally')) addBarrier(s, friend, maxHp(s, friend.id) * BATTLE_BARRIER_PERCENT * def.allies.stacks, actor.id, cues)
  return log
}

// --- Cleric blessings (D281) -----------------------------------------------------------------------------------------

const BEST_FIT: Readonly<Record<string, 'atk' | 'matk' | 'mp' | 'hp'>> = {
  brave: 'atk', breaker: 'atk', faith: 'matk', exalt: 'matk', clarity: 'mp',
  barrier: 'hp', regen: 'hp', aegis: 'hp', cure: 'hp', rebirth: 'hp',
}
function rankAllies(s: BattleState, key: string): BattleUnit[] {
  const by = BEST_FIT[key] ?? 'hp'
  const allies = living(s, 'ally')
  const order = (u: BattleUnit) => s.input.allies.findIndex((a) => a.id === u.id)
  if (by === 'atk' || by === 'matk') return [...allies].sort((a, b) => allyOf(s, b.id)!.stats[by] - allyOf(s, a.id)!.stats[by] || order(a) - order(b))
  if (by === 'mp') return [...allies].sort((a, b) => a.mp / Math.max(1, allyOf(s, a.id)!.stats.mp) - b.mp / Math.max(1, allyOf(s, b.id)!.stats.mp) || order(a) - order(b))
  return [...allies].sort((a, b) => byHpShare(s)(a, b) || order(a) - order(b))
}

/** One blessing's stacks on one unit. */
function bless(s: BattleState, cleric: BattleUnit, ally: BattleAlly, key: string, target: BattleUnit, count: number, cues: BattleCue[]): void {
  const has = (k: string) => learnedPassive(ally, k)
  const grace = ['brave', 'faith', 'clarity', 'breaker', 'exalt'].includes(key)
  const malice = ['armor-break', 'mind-break', 'enfeeble', 'hex', 'shatter'].includes(key)
  const turns = (grace && has('lasting-grace')) || (malice && has('lingering-malice')) || (!grace && !malice && has('lasting-sanctuary')) ? 3 : BATTLE_STATUS_TURNS
  if (malice && battleBroken(target) && has('exploit')) count += 1
  if (target.hp <= 0 && key !== 'rebirth') return
  const label = (text: string) => cues.push({ kind: 'status', actorId: cleric.id, targetId: target.id, label: text, amount: count })
  switch (key) {
    case 'brave': case 'faith': addStatus(target, key, count, turns, has('zeal') ? 4 : BATTLE_STATUS_STACK_CAP); label(key); break
    case 'exalt':
      for (const kind of ['brave', 'faith'] as const) addStatus(target, kind, count, turns, has('zeal') ? 4 : BATTLE_STATUS_STACK_CAP)
      label('exalt'); break
    case 'breaker': addStatus(target, 'breaker', count, turns, has('overcharge') ? 5 : BATTLE_STATUS_STACK_CAP); label('breaker'); break
    case 'clarity': restoreMp(s, target, BATTLE_CLARITY_PERCENT * count, cleric.id, cues); break
    case 'armor-break': case 'mind-break': case 'enfeeble': addStatus(target, key, count, turns); label(key); break
    case 'hex': {
      // Hex does not stack: two marks a Doom Hex (+10% from everything).
      const level = has('doom-hex') ? 2 : 1, length = has('deep-hex') ? 3 : turns
      const current = target.statuses.find((x) => x.kind === 'hex')
      if (current) { current.stacks = Math.max(current.stacks, level); current.turns = Math.max(current.turns, length) }
      else addStatus(target, 'hex', level, length, 2)
      label('hex'); break
    }
    case 'shatter': chip(s, cleric, target, count, cues); break
    case 'barrier': addBarrier(s, target, maxHp(s, target.id) * (has('bulwark') ? 0.1 : BATTLE_BARRIER_PERCENT) * count, cleric.id, cues); break
    case 'regen':
      addStatus(target, 'regen', count, turns); label('regen')
      if (has('sacred-ground')) addStatus(target, 'sacred', count, turns)
      break
    case 'aegis': addStatus(target, 'aegis', count, turns); label('aegis'); break
    case 'cure': heal(s, target, maxHp(s, target.id) * (has('miracle') ? 0.15 : BATTLE_CURE_PERCENT) * count, cleric.id, cues, has('overflow')); break
    case 'rebirth':
      if (target.hp <= 0 && !target.revived) {
        target.hp = Math.max(1, Math.round(maxHp(s, target.id) * BATTLE_REBIRTH_PERCENT * count))
        target.revived = true
        target.statuses = []
        cues.push({ kind: 'revive', actorId: cleric.id, targetId: target.id, amount: target.hp })
      } else if (target.hp > 0) addBarrier(s, target, maxHp(s, target.id) * BATTLE_BARRIER_PERCENT * count, cleric.id, cues)
      break
  }
  if (malice && has('erosion') && target.side === 'enemy') addStatus(target, 'erosion', 1, turns, 1)
  if (grace && has('inspiration') && key !== 'clarity') restoreMp(s, target, 0.01 * count, cleric.id, cues)
  if (!grace && !malice && has('purify') && target.hp > 0) {
    const debuff = target.statuses.find((x) => ['burn', 'slow', 'mark', 'weaken'].includes(x.kind))
    if (debuff) target.statuses = target.statuses.filter((x) => x !== debuff)
  }
}

/** The cast's shape decides how the blessing lands: Focused, Party or Scatter. */
function blessing(s: BattleState, cleric: BattleUnit, ally: BattleAlly, key: string, def: RpgSkillDef, log: CastLog, cues: BattleCue[]): void {
  const onFoes = ['armor-break', 'mind-break', 'enfeeble', 'hex', 'shatter'].includes(key)
  const grace = ['brave', 'faith', 'clarity', 'breaker', 'exalt'].includes(key)
  const knockedOut = () => s.units.filter((u) => u.side === 'ally' && u.hp <= 0 && !u.revived)
  if (def.target === 'one') {
    if (onFoes) {
      if (log.tapped.hp > 0) bless(s, cleric, ally, key, log.tapped, 3, cues)
      if (learnedPassive(ally, 'spreading-malice')) for (const foe of living(s, 'enemy')) if (foe !== log.tapped) bless(s, cleric, ally, key, foe, 1, cues)
      return
    }
    const ranked = key === 'rebirth' && knockedOut().length ? knockedOut() : rankAllies(s, key)
    if (ranked[0]) bless(s, cleric, ally, key, ranked[0], 3, cues)
    if (grace && learnedPassive(ally, 'second-blessing') && ranked[1]) bless(s, cleric, ally, key, ranked[1], 1, cues)
  } else if (def.target === 'all') {
    const count = Math.min(2, def.hits.length) + (grace && learnedPassive(ally, 'abundant-grace') ? 1 : 0)
    if (onFoes) { for (const foe of log.struck) if (foe.hp > 0) bless(s, cleric, ally, key, foe, count, cues); return }
    const targets = key === 'rebirth' ? [...knockedOut(), ...living(s, 'ally')] : living(s, 'ally')
    for (const friend of targets) bless(s, cleric, ally, key, friend, count, cues)
  } else {
    log.hitFoes.forEach((foe, i) => {
      if (onFoes) { if (foe.hp > 0) bless(s, cleric, ally, key, foe, 1, cues); return }
      const pool = key === 'rebirth' && knockedOut().length ? knockedOut() : living(s, 'ally')
      const friend = pool[hashNumber(`${s.input.seed}:${s.round}:${cleric.id}:${i}:scatter`) % Math.max(1, pool.length)]
      if (friend) bless(s, cleric, ally, key, friend, 1, cues)
    })
  }
}

/** The Cleric's blessings for a cast: learned core nodes of the branch its primary kind points to. */
export function battleBlessings(ally: BattleAlly, primary: RpgDamageKind): { id: string; key: string; name: string }[] {
  const branch = ally.classId === 'cleric' ? rpgBlessingBranch(primary) : null
  if (!branch) return []
  return ally.tree.flatMap((ref) => {
    const n = rpgNode(ref.id)
    return n && n.tree === 'cleric-staff' && n.branch === branch && n.variant === null && n.passive ? [{ id: n.id, key: n.passive, name: n.name }] : []
  })
}

export function applyBattleAction(previous: BattleState, action: BattleAction): BattleStep {
  if (previous.engineVersion !== 5 || !previous.input || !Array.isArray(previous.units)) return invalid(previous, 'invalid-state')
  if (previous.outcome !== 'active') return invalid(previous, 'terminal')
  if (!action || !['attack', 'guard', 'skill'].includes(action.kind)) return invalid(previous, 'invalid-state')
  const actorUnit = unit(previous, action.actorId)
  if (!actorUnit || actorUnit.side !== 'ally' || actorUnit.hp <= 0) return invalid(previous, 'invalid-actor')
  if (battleActionsLeft(previous, actorUnit.id) <= 0) return invalid(previous, 'already-acted')
  const targetUnit = unit(previous, action.targetId)
  if (!targetUnit || targetUnit.hp <= 0) return invalid(previous, 'invalid-target')
  const s = clone(previous)
  const actor = unit(s, actorUnit.id)!
  const target = unit(s, targetUnit.id)!
  const ally = allyOf(s, actor.id)!
  const hand = rpgHand(ally)
  const cues: BattleCue[] = []
  let spent = 1
  if (action.kind === 'guard') {
    if (target.side !== 'ally' || target.id === actor.id) return invalid(previous, 'invalid-target')
    actor.guardingFor = target.id
    spent = battleActionsLeft(s, actor.id)
    cues.push({ kind: 'guard', actorId: actor.id, targetId: target.id })
  } else if (action.kind === 'attack') {
    if (target.side !== 'enemy') return invalid(previous, 'invalid-target')
    let kind: RpgDamageKind = 'staff'
    if (hand.free.kind === 'weapon') {
      const weapon = action.weapon ?? ally.weapons[0]!
      if (!ally.weapons.includes(weapon)) return invalid(previous, 'invalid-skill')
      kind = weapon as RpgDamageKind
    } else if (hand.free.kind === 'short-sword') kind = 'short-sword'
    else if (hand.free.kind === 'familiar') {
      if (s.familiars.includes(actor.id)) return invalid(previous, 'already-acted')
      s.familiars.push(actor.id)
      kind = ally.familiar
    }
    strike(s, actor, target, { power: hand.free.power, parts: [{ kind, share: 1 }] }, 1, cues, true)
  } else {
    if (!action.skill || typeof action.skill !== 'object') return invalid(previous, 'invalid-skill')
    const legal = battleActorSkill(s, actor.id, action.skill)
    if (!legal) return invalid(previous, 'invalid-skill')
    if (target.side !== 'enemy') return invalid(previous, 'invalid-target')
    let key: string | null = null
    if (action.blessing !== undefined) {
      const choice = battleBlessings(ally, legal.def.primary).find((b) => b.id === action.blessing)
      if (!choice) return invalid(previous, 'invalid-skill')
      key = choice.key
    }
    if (actor.mp < legal.mp) return invalid(previous, 'insufficient-mp')
    actor.mp -= legal.mp
    const log = cast(s, actor, target, legal.def, legal.power, cues)
    if (key) blessing(s, actor, ally, key, legal.def, log, cues)
  }
  for (let i = 0; i < spent; i += 1) s.acted.push(actor.id)
  if (!terminal(s, cues)) {
    updatePhases(s, cues)
    if (living(s, 'ally').every((u) => battleActionsLeft(s, u.id) <= 0)) resolveEnemies(s, cues)
  }
  return { state: s, cues, hash: battleStateHash(s) }
}

export function replayBattle(input: BattleInput, actions: readonly BattleAction[]): BattleStep {
  if (actions.length > BATTLE_MAX_ROUNDS * 10) throw new RangeError('Battle replay is too long')
  let result = createBattle(input)
  const cues = [...result.cues]
  for (const action of actions) {
    result = applyBattleAction(result.state, action)
    if (result.error) return { ...result, cues }
    cues.push(...result.cues)
  }
  return { ...result, cues }
}
