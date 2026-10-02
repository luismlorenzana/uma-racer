// Deterministic RPG combat reducer and replay (docs/design/uma-rpg.md, D229).
import { RPG_DEPTH_GATES, RPG_ELEMENTS, rpgActiveSlots, rpgSkillKey,
  rpgTreePointsEarned, rpgTreePointsSpent, rpgWeaponsForStyle,
  RPG_SIGNATURE_MULTIPLIER, type RpgElement } from '../rules'
import { RPG_ADVANTAGE, RPG_BASIC_ATTACK_FACTOR, RPG_BURN_PERCENT, RPG_DEFENSE_FACTOR,
  RPG_ENEMY_MOVE_DENOMINATOR, RPG_FOLLOW_UP_FACTOR,
  RPG_GUARD_FACTOR, RPG_MARK_PERCENT, RPG_MAX_ROUNDS, RPG_POWER_PERCENT, RPG_REGEN_PERCENT,
  RPG_RESISTANCE, RPG_SKILL_LEVEL_STEP, RPG_SLOW_PERCENT, RPG_STATUS_STACK_CAP,
  RPG_STATUS_TURNS, RPG_MULTI_HIT_FACTOR, RPG_WEAK_FOLLOW_UP_LIMIT,
  RPG_WARD_PERCENT, combatSkill, elementMatchup, type SkillDefinition } from './catalog'
import type { CombatAction, CombatCue, CombatError, CombatSide, CombatState, CombatStatusKind,
  CombatStep, CombatUnit, EncounterInput, EnemyIntent, EnemyMove, FrozenAlly, FrozenEnemy } from './types'

function safeNumber(value: number, min: number, max: number): boolean {
  return Number.isSafeInteger(value) && value >= min && value <= max
}
function safeId(value: string): boolean { return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(value) }
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
    return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, part]) =>
      `${JSON.stringify(key)}:${stable(part)}`).join(',')}}`
  }
  return JSON.stringify(value)
}
export function combatStateHash(state: CombatState): string {
  return `rpg-combat-v1:${hashNumber(stable(state)).toString(16).padStart(8, '0')}`
}
function unit(state: CombatState, id: string): CombatUnit | undefined { return state.units.find((part) => part.id === id) }
function ally(state: CombatState, id: string): FrozenAlly | undefined { return state.input.allies.find((part) => part.id === id) }
function enemy(state: CombatState, id: string): FrozenEnemy | undefined { return state.input.enemies.find((part) => part.id === id) }
function stats(state: CombatState, id: string) {
  return ally(state, id)?.stats ?? enemy(state, id)?.stats
}
function maxHp(state: CombatState, id: string): number { return stats(state, id)!.hp }
function status(unitValue: CombatUnit, kind: CombatStatusKind): number {
  return unitValue.statuses.find((part) => part.kind === kind)?.stacks ?? 0
}
function addStatus(target: CombatUnit, kind: CombatStatusKind, turns: number): void {
  const current = target.statuses.find((part) => part.kind === kind)
  if (current) {
    current.stacks = kind === 'burn' || kind === 'mark'
      ? Math.min(RPG_STATUS_STACK_CAP, current.stacks + 1) : 1
    current.turns = Math.max(current.turns, turns)
  } else target.statuses.push({ kind, stacks: 1, turns })
  target.statuses.sort((a, b) => a.kind.localeCompare(b.kind))
}
function validateStats(value: FrozenAlly['stats']): boolean {
  if (!value || typeof value !== 'object') return false
  return ['speed', 'stamina', 'power', 'guts', 'wit', 'atk', 'matk', 'initiative',
    'pdef', 'mdef', 'dexterity', 'hp', 'mp'].every((key) =>
    safeNumber(value[key as keyof typeof value], key === 'hp' ? 1 : 0, 100_000))
}
function validMove(move: EnemyMove): boolean {
  return safeId(move.id) && ['damage', 'heal', 'guard', 'buff'].includes(move.kind) &&
    ['physical', 'magical'].includes(move.channel) &&
    (move.element === null || RPG_ELEMENTS.includes(move.element)) &&
    safeNumber(move.power, 0, 500) && typeof move.intentText === 'string' &&
    move.intentText.length > 0 && move.intentText.length <= 120 &&
    (move.kind === 'damage'
      ? ['front', 'lowest-hp', 'seeded'].includes(move.target)
      : ['self', 'lowest-hp-ally'].includes(move.target)) &&
    (move.status === undefined || (move.kind === 'damage'
      ? ['burn', 'slow', 'mark', 'weaken'].includes(move.status)
      : ['ward', 'regen', 'power-up'].includes(move.status)))
}
function validateInput(input: EncounterInput): void {
  if (!input || input.version !== 1 || !safeId(input.contentVersion) ||
    !safeNumber(input.seed, 0, 0xffff_ffff) ||
    !['none', 'bounded'].includes(input.weaknessFollowUp) ||
    !Array.isArray(input.allies) || input.allies.length !== 5 ||
    !Array.isArray(input.enemies) || input.enemies.length < 1 || input.enemies.length > 5) {
    throw new RangeError('Invalid frozen encounter header')
  }
  const ids = new Set<string>()
  for (const member of input.allies) {
    if (!safeId(member.id) || ids.has(member.id) || !rpgWeaponsForStyle(member.style).includes(member.weapon) ||
      !safeNumber(member.tier, 1, 1_000_000) || !safeNumber(member.level, 1, 50) ||
      !validateStats(member.stats) || !member.affinities ||
      Object.entries(member.affinities).some(([element, grade]) =>
        !RPG_ELEMENTS.includes(element as RpgElement) || (grade !== 'A' && grade !== 'B')) ||
      !RPG_ELEMENTS.includes(member.signature) ||
      !member.affinities[member.signature] || !Array.isArray(member.tree) ||
      !Array.isArray(member.legacy) || !Array.isArray(member.loadout) ||
      member.loadout.length > rpgActiveSlots(member.level) || member.tree.length > 25 ||
      member.legacy.length > 2) throw new RangeError('Invalid frozen ally')
    ids.add(member.id)
    const learned = [...member.tree, ...member.legacy]
    if (new Set(learned.map(rpgSkillKey)).size !== learned.length ||
      rpgTreePointsSpent(member.tree) > rpgTreePointsEarned(member.level) ||
      learned.some((entry) => !combatSkill(entry) || entry.weapon !== member.weapon ||
        !member.affinities[entry.element] ||
        (member.affinities[entry.element] === 'B' && entry.depth > 3) ||
        !safeNumber(entry.level, 1, 5) ||
        (member.tree.includes(entry) ? entry.tier !== member.tier : entry.tier >= member.tier))) {
      throw new RangeError('Invalid frozen learned skills')
    }
    if (member.tree.some((entry) => member.level < RPG_DEPTH_GATES[entry.depth - 1]! ||
      (entry.depth > 1 && !member.tree.some((prior) =>
        prior.element === entry.element && prior.depth === entry.depth - 1)))) {
      throw new RangeError('Invalid frozen tree progression')
    }
    const selected = new Set<string>()
    let legacyCount = 0
    for (const ref of member.loadout) {
      const key = rpgSkillKey(ref)
      const skill = learned.find((entry) => rpgSkillKey(entry) === key)
      const def = combatSkill(ref)
      if (!skill || !def || selected.has(key) || ref.weapon !== member.weapon ||
        !member.affinities[ref.element] || (member.affinities[ref.element] === 'B' && ref.depth > 3) ||
        (ref.tier !== member.tier && !member.legacy.some((entry) => rpgSkillKey(entry) === key)) ||
        !safeNumber(skill.level, 1, 5)) throw new RangeError('Invalid frozen loadout')
      selected.add(key)
      if (ref.tier < member.tier) legacyCount += 1
    }
    if (legacyCount > 2) throw new RangeError('Too many legacy skills')
  }
  for (const foe of input.enemies) {
    if (!safeId(foe.id) || ids.has(foe.id) || !RPG_ELEMENTS.includes(foe.element) ||
      !validateStats(foe.stats) || !Array.isArray(foe.moves) || foe.moves.length < 1 ||
      foe.moves.length > 8 || !foe.moves.every(validMove) ||
      new Set(foe.moves.map((move) => move.id)).size !== foe.moves.length ||
      (foe.phaseTwo && (!safeNumber(foe.phaseTwo.thresholdPercent, 1, 99) ||
        foe.phaseTwo.moves.length < 1 || foe.phaseTwo.moves.length > 8 ||
        !foe.phaseTwo.moves.every(validMove) ||
        new Set(foe.phaseTwo.moves.map((move) => move.id)).size !== foe.phaseTwo.moves.length))) {
      throw new RangeError('Invalid frozen enemy')
    }
    ids.add(foe.id)
  }
}
function cloneState(state: CombatState): CombatState {
  return { ...state, units: state.units.map((part) => ({ ...part,
    statuses: part.statuses.map((entry) => ({ ...entry })) })), acted: [...state.acted],
    intents: state.intents.map((entry) => ({ ...entry })) }
}
function living(state: CombatState, side: CombatSide): CombatUnit[] {
  return state.units.filter((part) => part.side === side && part.hp > 0)
}
function orderedFoes(state: CombatState): CombatUnit[] {
  return living(state, 'enemy').sort((a, b) =>
    stats(state, b.id)!.initiative - stats(state, a.id)!.initiative || a.id.localeCompare(b.id))
}
function chooseTarget(state: CombatState, source: FrozenEnemy, move: EnemyMove, round: number): string {
  if (move.target === 'self') return source.id
  if (move.target === 'lowest-hp-ally') {
    const allies = living(state, 'enemy').sort((a, b) => a.hp / maxHp(state, a.id) - b.hp / maxHp(state, b.id) || a.id.localeCompare(b.id))
    return allies[0]?.id ?? source.id
  }
  const targets = living(state, 'ally')
  if (move.target === 'front') return targets[0]?.id ?? ''
  if (move.target === 'lowest-hp') return [...targets].sort((a, b) =>
    a.hp / maxHp(state, a.id) - b.hp / maxHp(state, b.id) || a.id.localeCompare(b.id))[0]?.id ?? ''
  return targets[hashNumber(`${state.input.seed}:${round}:${source.id}:target`) % targets.length]?.id ?? ''
}
function intentsFor(state: CombatState): EnemyIntent[] {
  return orderedFoes(state).map((part) => {
    const source = enemy(state, part.id)!
    const moves = part.phase === 2 ? source.phaseTwo!.moves : source.moves
    const move = moves[hashNumber(`${state.input.seed}:${state.round}:${source.id}:phase${part.phase}:move`) % moves.length]!
    return { enemyId: source.id, moveId: move.id, targetId: chooseTarget(state, source, move, state.round) }
  })
}
function reveal(state: CombatState): CombatCue[] {
  return state.intents.map((intent) => {
    const source = enemy(state, intent.enemyId)!
    const move = (unit(state, source.id)!.phase === 2 ? source.phaseTwo!.moves : source.moves)
      .find((entry) => entry.id === intent.moveId)!
    return { kind: 'intent' as const, actorId: source.id, targetId: intent.targetId, label: move.intentText }
  })
}
export function createEncounter(source: EncounterInput): CombatStep {
  validateInput(source)
  // A JSON copy prevents later content or party edits from mutating this frozen entry.
  const input = JSON.parse(JSON.stringify(source)) as EncounterInput
  const units: CombatUnit[] = [...input.allies.map((part) => ({
    id: part.id, side: 'ally' as const, hp: part.stats.hp, mp: part.stats.mp,
    statuses: [], phase: 1 as const, guardingFor: null,
  })), ...input.enemies.map((part) => ({
    id: part.id, side: 'enemy' as const, hp: part.stats.hp, mp: part.stats.mp,
    statuses: [], phase: 1 as const, guardingFor: null,
  }))]
  const state: CombatState = { engineVersion: 1, input, round: 1, units, acted: [], intents: [],
    followUpsUsed: 0, outcome: 'active' }
  state.intents = intentsFor(state)
  return { state, cues: reveal(state), hash: combatStateHash(state) }
}
function magnitude(state: CombatState, attacker: CombatUnit, defender: CombatUnit,
  channel: 'physical' | 'magical', base: number, rider: number, element: RpgElement | null,
  skillLevel: number, signature: boolean): { amount: number; weakness: boolean } {
  const attackStats = stats(state, attacker.id)!
  const defendStats = stats(state, defender.id)!
  const offense = channel === 'physical' ? attackStats.atk : attackStats.matk
  const defense = channel === 'physical' ? defendStats.pdef : defendStats.mdef
  const targetElement = enemy(state, defender.id)?.element ?? ally(state, defender.id)?.signature ?? null
  const matchup = targetElement ? elementMatchup(element, targetElement) : 'neutral'
  const multiplier = matchup === 'weak' ? RPG_ADVANTAGE : matchup === 'resist' ? RPG_RESISTANCE : 1
  const total = base + rider
  const basePart = Math.max(0, offense * base - defense * RPG_DEFENSE_FACTOR * (total ? base / total : 0))
  const riderPart = Math.max(0, offense * rider - defense * RPG_DEFENSE_FACTOR * (total ? rider / total : 0))
  let amount = channel === 'physical' ? basePart + riderPart * multiplier : basePart * multiplier
  amount *= 1 + (skillLevel - 1) * RPG_SKILL_LEVEL_STEP
  amount *= 1 + status(attacker, 'power-up') * RPG_POWER_PERCENT
  amount *= 1 - status(attacker, 'weaken') * RPG_POWER_PERCENT
  amount *= 1 + status(defender, 'mark') * RPG_MARK_PERCENT
  amount *= 1 - status(defender, 'ward') * RPG_WARD_PERCENT
  amount *= 1 - status(attacker, 'slow') * RPG_SLOW_PERCENT
  amount = Math.max(1, Math.round(amount))
  if (signature) amount = Math.round(amount * RPG_SIGNATURE_MULTIPLIER)
  return { amount, weakness: matchup === 'weak' }
}
function guardedTarget(state: CombatState, target: CombatUnit): CombatUnit {
  return state.units.find((part) => part.side === target.side && part.hp > 0 && part.guardingFor === target.id) ?? target
}
function hit(state: CombatState, actor: CombatUnit, target: CombatUnit, channel: 'physical' | 'magical',
  base: number, rider: number, element: RpgElement | null, level: number, signature: boolean,
  cues: CombatCue[], appliedStatus: CombatStatusKind | null = null, duration = 0,
  intercept = true): void {
  const receiver = intercept ? guardedTarget(state, target) : target
  const result = magnitude(state, actor, receiver, channel, base, rider, element, level, signature)
  const amount = intercept && receiver.guardingFor !== null
    ? Math.max(1, Math.round(result.amount * RPG_GUARD_FACTOR)) : result.amount
  receiver.hp = Math.max(0, receiver.hp - amount)
  cues.push({ kind: 'hit', actorId: actor.id, targetId: receiver.id, amount, channel, element, rider: rider > 0,
    label: result.weakness ? 'Weakness' : receiver.id !== target.id ? 'Intercepted' : undefined })
  if (receiver.hp === 0) cues.push({ kind: 'ko', actorId: actor.id, targetId: receiver.id })
  if (receiver.hp > 0 && appliedStatus && (!element ||
    elementMatchup(element, enemy(state, receiver.id)?.element ?? ally(state, receiver.id)!.signature) !== 'resist')) {
    addStatus(receiver, appliedStatus, duration)
    cues.push({ kind: 'status', actorId: actor.id, targetId: receiver.id, label: appliedStatus })
  }
  if (element === 'light' && receiver.hp > 0 && status(receiver, 'ward')) {
    receiver.statuses = receiver.statuses.filter((part) => part.kind !== 'ward')
    cues.push({ kind: 'status', actorId: actor.id, targetId: receiver.id, label: 'ward broken' })
  }
  if (result.weakness && actor.side === 'ally' && state.input.weaknessFollowUp === 'bounded' &&
    state.followUpsUsed < RPG_WEAK_FOLLOW_UP_LIMIT && receiver.hp > 0) {
    state.followUpsUsed += 1
    const extra = Math.max(1, Math.round(amount * RPG_FOLLOW_UP_FACTOR))
    receiver.hp = Math.max(0, receiver.hp - extra)
    cues.push({ kind: 'follow-up', actorId: actor.id, targetId: receiver.id, amount: extra })
    if (receiver.hp === 0) cues.push({ kind: 'ko', actorId: actor.id, targetId: receiver.id })
  }
}
function heal(state: CombatState, actor: CombatUnit, target: CombatUnit, coefficient: number,
  level: number, signature: boolean, cues: CombatCue[], supportStatus: CombatStatusKind | null, duration: number): void {
  const source = stats(state, actor.id)!
  const offense = ally(state, actor.id)?.weapon === 'sword-shield' ? source.atk : source.matk
  let amount = Math.max(1, Math.round(offense * coefficient * (1 + (level - 1) * RPG_SKILL_LEVEL_STEP)))
  if (signature) amount = Math.round(amount * RPG_SIGNATURE_MULTIPLIER)
  const restored = Math.min(amount, maxHp(state, target.id) - target.hp)
  target.hp += restored
  cues.push({ kind: 'heal', actorId: actor.id, targetId: target.id, amount: restored })
  if (supportStatus) {
    addStatus(target, supportStatus, duration)
    cues.push({ kind: 'status', actorId: actor.id, targetId: target.id, label: supportStatus })
  }
  if (supportStatus === 'ward') target.statuses = target.statuses.filter((part) => part.kind !== 'burn' && part.kind !== 'weaken')
}
function checkTerminal(state: CombatState, cues: CombatCue[]): boolean {
  const alliesAlive = living(state, 'ally').length
  const enemiesAlive = living(state, 'enemy').length
  if (!enemiesAlive || !alliesAlive) {
    // No surviving entrant means no clear, even when the last enemy falls on that same tick.
    state.outcome = alliesAlive && !enemiesAlive ? 'victory' : 'loss'
    state.intents = []
    cues.push({ kind: 'result', label: state.outcome })
    return true
  }
  return false
}
function updatePhases(state: CombatState, cues: CombatCue[]): void {
  let changed = false
  for (const part of living(state, 'enemy')) {
    const phase = enemy(state, part.id)?.phaseTwo
    if (phase && part.phase === 1 && part.hp * 100 <= maxHp(state, part.id) * phase.thresholdPercent) {
      part.phase = 2
      cues.push({ kind: 'phase', actorId: part.id, targetId: part.id, label: 'Phase 2' })
      changed = true
    }
  }
  if (changed) {
    state.intents = intentsFor(state)
    cues.push(...reveal(state))
  }
}
function resolveEnemies(state: CombatState, cues: CombatCue[]): void {
  // Enemy guards covered the preceding player phase; fresh guards cover the next one.
  for (const part of state.units) if (part.side === 'enemy') part.guardingFor = null
  for (const intent of state.intents) {
    const actor = unit(state, intent.enemyId)
    if (!actor || actor.hp <= 0 || !living(state, 'ally').length) continue
    const source = enemy(state, actor.id)!
    const move = (actor.phase === 2 ? source.phaseTwo!.moves : source.moves).find((entry) => entry.id === intent.moveId)
    if (!move) throw new RangeError('Frozen intent no longer matches phase')
    const selected = unit(state, intent.targetId)
    const target = selected && selected.hp > 0 ? selected : unit(state, chooseTarget(state, source, move, state.round))!
    if (!target) continue
    if (target.id !== intent.targetId) cues.push({ kind: 'intent', actorId: actor.id, targetId: target.id, label: 'Retarget' })
    if (move.kind === 'damage') hit(state, actor, target, move.channel,
      move.power / RPG_ENEMY_MOVE_DENOMINATOR, 0,
      move.element, 1, false, cues, move.status ?? null, RPG_STATUS_TURNS)
    else if (move.kind === 'heal') heal(state, actor, target,
      move.power / RPG_ENEMY_MOVE_DENOMINATOR, 1, false, cues,
      move.status ?? null, RPG_STATUS_TURNS)
    else if (move.kind === 'guard') {
      actor.guardingFor = target.id
      cues.push({ kind: 'guard', actorId: actor.id, targetId: target.id })
    } else if (move.status) {
      addStatus(target, move.status, RPG_STATUS_TURNS)
      cues.push({ kind: 'status', actorId: actor.id, targetId: target.id, label: move.status })
    }
    if (checkTerminal(state, cues)) return
  }
  // Guard protects one enemy phase; damage-over-time ticks before duration decays.
  for (const part of state.units) {
    if (part.side === 'ally') part.guardingFor = null
    if (part.hp <= 0) continue
    const burn = status(part, 'burn')
    if (burn) {
      const amount = Math.max(1, Math.round(maxHp(state, part.id) * RPG_BURN_PERCENT * burn))
      part.hp = Math.max(0, part.hp - amount)
      cues.push({ kind: 'hit', actorId: part.id, targetId: part.id, amount, label: 'Burn' })
      if (part.hp === 0) cues.push({ kind: 'ko', actorId: part.id, targetId: part.id })
    }
    if (part.hp > 0 && status(part, 'regen')) {
      const amount = Math.min(maxHp(state, part.id) - part.hp,
        Math.max(1, Math.round(maxHp(state, part.id) * RPG_REGEN_PERCENT)))
      part.hp += amount
      cues.push({ kind: 'heal', actorId: part.id, targetId: part.id, amount, label: 'Regen' })
    }
    part.statuses = part.statuses.map((entry) => ({ ...entry, turns: entry.turns - 1 }))
      .filter((entry) => entry.turns > 0)
  }
  if (checkTerminal(state, cues)) return
  if (state.round >= RPG_MAX_ROUNDS) {
    state.outcome = 'loss'
    state.intents = []
    cues.push({ kind: 'result', label: 'loss' })
    return
  }
  state.round += 1
  state.acted = []
  state.followUpsUsed = 0
  state.intents = intentsFor(state)
  cues.push(...reveal(state))
}
function invalid(state: CombatState, error: CombatError): CombatStep {
  return { state, cues: [], hash: combatStateHash(state), error }
}
export function applyAction(previous: CombatState, action: CombatAction): CombatStep {
  if (previous.engineVersion !== 1 || !previous.input || !Array.isArray(previous.units)) return invalid(previous, 'invalid-state')
  if (previous.outcome !== 'active') return invalid(previous, 'terminal')
  if (!action || !['attack', 'guard', 'skill', 'item'].includes(action.kind)) return invalid(previous, 'invalid-state')
  if (action.kind === 'item') return invalid(previous, 'item-disabled')
  const actor = unit(previous, action.actorId)
  if (!actor || actor.side !== 'ally' || actor.hp <= 0) return invalid(previous, 'invalid-actor')
  if (previous.acted.includes(actor.id)) return invalid(previous, 'already-acted')
  const target = unit(previous, action.targetId)
  if (!target || target.hp <= 0) return invalid(previous, 'invalid-target')
  let def: SkillDefinition | null = null
  let level = 1
  if (action.kind === 'skill') {
    if (!action.skill || typeof action.skill !== 'object') return invalid(previous, 'invalid-skill')
    const member = ally(previous, actor.id)!
    def = combatSkill(action.skill)
    const learned = [...member.tree, ...member.legacy].find((part) => rpgSkillKey(part) === rpgSkillKey(action.skill))
    if (!def || !learned || !member.loadout.some((part) => rpgSkillKey(part) === rpgSkillKey(action.skill)) ||
      action.skill.weapon !== member.weapon || !member.affinities[action.skill.element] ||
      (member.affinities[action.skill.element] === 'B' && action.skill.depth > 3) ||
      (action.skill.tier !== member.tier && !member.legacy.some((part) => rpgSkillKey(part) === rpgSkillKey(action.skill)))) {
      return invalid(previous, 'invalid-skill')
    }
    if (actor.mp < def.mp) return invalid(previous, 'insufficient-mp')
    level = learned.level
  }
  const targetType = action.kind === 'guard' ? 'ally' : action.kind === 'attack' ? 'enemy' : def!.target
  if (targetType === 'enemy' && target.side !== 'enemy' ||
    targetType === 'all-enemies' && target.side !== 'enemy' ||
    targetType === 'ally' && target.side !== 'ally' ||
    targetType === 'all-allies' && target.side !== 'ally' ||
    targetType === 'self' && target.id !== actor.id) return invalid(previous, 'invalid-target')
  const state = cloneState(previous)
  const acting = unit(state, actor.id)!
  const selected = unit(state, target.id)!
  const cues: CombatCue[] = []
  if (action.kind === 'guard') {
    acting.guardingFor = selected.id
    cues.push({ kind: 'guard', actorId: acting.id, targetId: selected.id })
  } else if (action.kind === 'attack') {
    const channel = ['greatsword', 'spear', 'sword-shield'].includes(ally(state, acting.id)!.weapon)
      ? 'physical' : 'magical'
    hit(state, acting, selected, channel, RPG_BASIC_ATTACK_FACTOR, 0, null, 1, false, cues)
  } else if (def) {
    acting.mp -= def.mp
    const targets = def.target === 'all-enemies' ? living(state, 'enemy') :
      def.target === 'all-allies' ? living(state, 'ally') : [selected]
    for (const recipient of targets) {
      if (recipient.hp <= 0) continue
      if (def.heal && def.base === 0 && def.rider === 0) heal(state, acting, recipient, def.heal, level,
        def.element === ally(state, acting.id)!.signature, cues, def.status, def.duration)
      else {
        if (def.branch === 'multi') {
          for (let hitIndex = 0; hitIndex < 2 && recipient.hp > 0; hitIndex += 1) {
            hit(state, acting, recipient, def.channel, def.base * RPG_MULTI_HIT_FACTOR,
              def.rider * RPG_MULTI_HIT_FACTOR,
              def.element, level, def.element === ally(state, acting.id)!.signature,
              cues, def.status, def.duration, def.target !== 'all-enemies')
          }
        } else hit(state, acting, recipient, def.channel, def.base, def.rider, def.element, level,
          def.element === ally(state, acting.id)!.signature, cues, def.status, def.duration,
          def.target !== 'all-enemies')
        if (def.heal) {
          const friend = living(state, 'ally').sort((a, b) => a.hp / maxHp(state, a.id) -
            b.hp / maxHp(state, b.id) || a.id.localeCompare(b.id))[0]
          if (friend) heal(state, acting, friend, def.heal, level,
            def.element === ally(state, acting.id)!.signature, cues, null, 0)
        }
      }
    }
  }
  state.acted.push(acting.id)
  if (!checkTerminal(state, cues)) {
    updatePhases(state, cues)
    if (living(state, 'ally').every((part) => state.acted.includes(part.id))) resolveEnemies(state, cues)
  }
  return { state, cues, hash: combatStateHash(state) }
}
export function replay(input: EncounterInput, actions: readonly CombatAction[]): CombatStep {
  if (actions.length > RPG_MAX_ROUNDS * 5) throw new RangeError('Combat replay is too long')
  let result = createEncounter(input)
  const cues = [...result.cues]
  for (const action of actions) {
    result = applyAction(result.state, action)
    if (result.error) return { ...result, cues }
    cues.push(...result.cues)
  }
  return { ...result, cues }
}
