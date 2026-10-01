// T091 synthetic combat envelope; no private Uma, enemy or chapter content.
import { RPG_ELEMENTS, RPG_WEAPONS, type RpgElement, type RpgWeapon } from '../../packages/domain/src/rpg/rules'
import { combatSkill } from '../../packages/domain/src/rpg/combat/catalog'
import { applyAction, createEncounter } from '../../packages/domain/src/rpg/combat/engine'
import { syntheticEncounter } from '../../packages/domain/src/rpg/combat/synthetic'
import type { CombatAction, CombatCue, CombatState, EncounterInput } from '../../packages/domain/src/rpg/combat/types'

const weakAgainst: Record<RpgElement, RpgElement> = {
  fire: 'ice', ice: 'lightning', lightning: 'fire', light: 'dark', dark: 'light',
}
const resists: Partial<Record<RpgElement, RpgElement>> = {
  fire: 'lightning', ice: 'fire', lightning: 'ice',
}
const neutralAgainst: Record<RpgElement, RpgElement> = {
  fire: 'dark', ice: 'dark', lightning: 'dark', light: 'fire', dark: 'fire',
}
interface Sample { win: boolean; turns: number; hp: number; mp: number; status: number; statusHp: number; ko: number; phase: number }
function actionFor(state: CombatState, actorId: string): CombatAction {
  const actor = state.units.find((part) => part.id === actorId)!
  const profile = state.input.allies.find((part) => part.id === actorId)!
  const low = state.units.filter((part) => part.side === 'ally' && part.hp > 0)
    .sort((a, b) => a.hp / state.input.allies.find((part) => part.id === a.id)!.stats.hp -
      b.hp / state.input.allies.find((part) => part.id === b.id)!.stats.hp)[0]
  const endangered = low && low.hp / state.input.allies.find((part) => part.id === low.id)!.stats.hp < 0.58
  const support = profile.loadout.find((ref) => ref.branch === 'focused' && combatSkill(ref)?.heal)
  if (endangered && support && actor.mp >= combatSkill(support)!.mp) {
    return { kind: 'skill', actorId, targetId: low.id, skill: support }
  }
  if (endangered && profile.weapon === 'sword-shield' &&
    state.intents.some((intent) => intent.targetId === low.id)) {
    return { kind: 'guard', actorId, targetId: low.id }
  }
  const targets = state.units.filter((part) => part.side === 'enemy' && part.hp > 0)
  const target = targets.sort((a, b) => a.hp - b.hp || a.id.localeCompare(b.id))[0]!
  const area = profile.loadout.find((ref) => ref.branch === 'area')
  const focused = profile.loadout.find((ref) => ref.branch === 'focused')
  const committed = profile.loadout.find((ref) => ref.branch === 'committed')
  const chosen = profile.weapon === 'cleric-staff' || profile.weapon === 'sword-shield'
    ? committed ?? profile.loadout[0]
    : targets.length >= 3 && area ? area : focused ?? profile.loadout[0]
  if (chosen && actor.mp >= combatSkill(chosen)!.mp) {
    return { kind: 'skill', actorId, targetId: target.id, skill: chosen }
  }
  return { kind: 'attack', actorId, targetId: target.id }
}
function play(input: EncounterInput): Sample {
  let state = createEncounter(input).state
  const cues: CombatCue[] = []
  while (state.outcome === 'active') {
    const actor = state.units.find((part) => part.side === 'ally' && part.hp > 0 && !state.acted.includes(part.id))
    if (!actor) throw new Error('Active battle without an available actor')
    const step = applyAction(state, actionFor(state, actor.id))
    if (step.error) throw new Error(`Synthetic bot chose illegal action: ${step.error}`)
    cues.push(...step.cues)
    state = step.state
  }
  const allies = state.units.filter((part) => part.side === 'ally')
  return { win: state.outcome === 'victory', turns: state.round,
    hp: allies.reduce((sum, part) => sum + part.hp / input.allies.find((entry) => entry.id === part.id)!.stats.hp, 0) / 5,
    mp: allies.reduce((sum, part) => sum + part.mp / input.allies.find((entry) => entry.id === part.id)!.stats.mp, 0) / 5,
    status: cues.filter((cue) => cue.kind === 'status' || cue.label === 'Burn' || cue.label === 'Regen').length,
    statusHp: cues.reduce((sum, cue) => sum +
      ((cue.label === 'Burn' || cue.label === 'Regen') && 'amount' in cue ? cue.amount ?? 0 : 0), 0),
    ko: cues.filter((cue) => cue.kind === 'ko' && input.allies.some((entry) => entry.id === cue.targetId)).length,
    phase: cues.filter((cue) => cue.kind === 'phase').length }
}
function summarize(values: Sample[]): string {
  const mean = (pick: (value: Sample) => number) => values.reduce((sum, part) => sum + pick(part), 0) / values.length
  return `win ${(mean((value) => Number(value.win)) * 100).toFixed(0)}% · turns ${mean((value) => value.turns).toFixed(1)} · ` +
    `HP ${(mean((value) => value.hp) * 100).toFixed(0)}% · MP ${(mean((value) => value.mp) * 100).toFixed(0)}% · ` +
    `status ${mean((value) => value.status).toFixed(1)} / ${mean((value) => value.statusHp).toFixed(0)} HP · ` +
    `KO ${mean((value) => value.ko).toFixed(2)}`
}
const seeds = Array.from({ length: 12 }, (_, index) => 101 + index * 59)
const matrix: Sample[] = []
const bounded: Sample[] = []
const none: Sample[] = []
console.log('Uma RPG combat — invented five-member teams, fixed seeds; status = applications/ticks per battle')
for (const weapon of RPG_WEAPONS) {
  for (const element of RPG_ELEMENTS) {
    const columns: string[] = []
    for (const [label, enemyElement] of [
      ['neutral', neutralAgainst[element]], ['weak', weakAgainst[element]],
      ['resist', resists[element]],
    ] as const) {
      if (!enemyElement) continue
      const samples = seeds.map((seed) => play(syntheticEncounter(weapon, element, enemyElement, seed)))
      matrix.push(...samples)
      columns.push(`${label}: ${summarize(samples)}`)
      if (label === 'weak') {
        bounded.push(...samples)
        none.push(...seeds.map((seed) => play(syntheticEncounter(weapon, element, enemyElement, seed, false, 'none'))))
      }
    }
    console.log(`${weapon.padEnd(13)} ${element.padEnd(9)} ${columns.join(' | ')}`)
  }
}
const boss = RPG_WEAPONS.flatMap((weapon: RpgWeapon) => seeds.map((seed) =>
  play(syntheticEncounter(weapon, 'fire', 'ice', seed, true))))
const pressure = [...seeds.map((seed) => play(syntheticEncounter('sword-shield', 'light', 'dark', seed, true))),
  ...seeds.map((seed) => play(syntheticEncounter('cleric-staff', 'light', 'dark', seed, true)))]
const fragile = seeds.map((seed) => {
  const input = syntheticEncounter('spear', 'fire', 'ice', seed)
  for (const member of input.allies) member.stats.hp = 70
  for (const foe of input.enemies) { foe.stats.hp = 1_000; foe.stats.atk = 110; foe.stats.matk = 110 }
  return play(input)
})
const levelProbe = (offenseDelta: number, hpDelta: number) => seeds.map((seed) => {
  const input = syntheticEncounter('spear', 'fire', 'ice', seed, true)
  for (const member of input.allies) {
    member.stats.atk += offenseDelta
    member.stats.matk += offenseDelta
    member.stats.hp += hpDelta
  }
  return play(input)
})
const ahead = levelProbe(22, 120)
const catchingUp = levelProbe(-18, -80)
const winRate = (values: Sample[]) => values.filter((part) => part.win).length / values.length
const mean = (values: Sample[], pick: (value: Sample) => number) =>
  values.reduce((sum, part) => sum + pick(part), 0) / values.length
console.log(`All regular: ${summarize(matrix)}`)
console.log(`Weakness without follow-up: ${summarize(none)}`)
console.log(`Weakness bounded follow-up: ${summarize(bounded)}`)
console.log(`Two-phase bosses: ${summarize(boss)} · phase shifts ${boss.filter((part) => part.phase > 0).length}/${boss.length}`)
console.log(`Guard/heal support pressure: ${summarize(pressure)}`)
console.log(`Fragile elite loss probe: ${summarize(fragile)}`)
console.log(`Overleveled replay probe: ${summarize(ahead)}`)
console.log(`Catch-up combat probe: ${summarize(catchingUp)}`)
// Broad synthetic regression envelope; chapter-specific balance belongs to T095/T096.
if (winRate(matrix) < 0.55 || winRate(matrix) > 1 ||
  winRate(bounded) < winRate(none) || mean(matrix, (part) => part.turns) < 2.5 ||
  mean(matrix, (part) => part.turns) > 9 ||
  mean(matrix, (part) => part.hp) < 0.25 || mean(matrix, (part) => part.hp) > 0.95 ||
  bounded.some((part) => part.turns > 40) ||
  boss.filter((part) => part.phase > 0).length < boss.length * 0.6 ||
  !matrix.some((part) => part.statusHp > 0) || !boss.some((part) => part.ko > 0) ||
  winRate(fragile) >= 1 ||
  mean(ahead, (part) => part.turns) >= mean(catchingUp, (part) => part.turns)) {
  throw new Error('RPG synthetic combat envelope drifted')
}
