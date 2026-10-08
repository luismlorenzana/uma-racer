// Campaign balance (D261–D272): a synthetic five-outfit party — one Brawler, two Mages, a Cleric and a Summoner — plays
// generated chapters with a careful policy and an attack-only policy. No private Uma, cast or chapter content.
import { RPG_ELEMENTS, enrollRpgOutfit, learnRpgNode, projectRpgStats, rpgActiveSlots, rpgHand, rpgLearnedSkills, rpgProfileTrees,
  rpgTreePointsEarned, rpgTreePointsSpent, type RpgClass, type RpgNodeRef, type RpgProfile, type RpgWeapon,
  type RpgWeaponKind } from '../../packages/domain/src/rpg/rules'
import { rpgNode, rpgTreeNodes } from '../../packages/domain/src/rpg/catalog'
import type { Aptitudes } from '../../packages/domain/src/types'
import { applyBattleAction, battleActionsLeft, battleActorSkill, battleBlessings, battleBroken, battleHitIsWeak, createBattle } from '../../packages/domain/src/rpg/battle/engine'
import type { BattleAction, BattleState, BattleUnit } from '../../packages/domain/src/rpg/battle/types'
import { rpgCampaignChapter, rpgTierLevel, type RpgCampaignChapter, type RpgMapNode } from '../../packages/domain/src/rpg/campaign/chapters'
import { createRpgRun, rpgBeginRunBattle, rpgCarriedMp, rpgRestAtCamp, rpgSettleRunBattle,
  type RpgPartyMember, type RpgRunSaveV2 } from '../../packages/domain/src/rpg/campaign/run'
import { SCENARIOS } from '../../packages/domain/src/scenarios'

const cast = Array.from({ length: 7 }, (_, i) => ({ id: `cast${i + 1}`, name: `Rival ${i + 1}` }))
const STYLE: Record<RpgClass, Aptitudes['strategy']> = {
  brawler: { front: 'A', pace: 'C', late: 'C', end: 'C' }, mage: { front: 'C', pace: 'A', late: 'C', end: 'C' },
  cleric: { front: 'C', pace: 'C', late: 'A', end: 'C' }, summoner: { front: 'C', pace: 'C', late: 'C', end: 'A' },
}
function outfit(id: string, classId: RpgClass, weapons: RpgWeapon[]): RpgProfile {
  const stats = { speed: 112, stamina: 106, power: 112, guts: 100, wit: 110 }
  const aptitudes: Aptitudes = { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'C', mile: 'A', medium: 'A', long: 'C' }, strategy: STYLE[classId] }
  return enrollRpgOutfit({ outfit: { id, baseStats: stats, growthRates: { speed: 0.1, stamina: 0.05, power: 0.05, guts: 0.05, wit: 0.05 }, aptitudes },
    contentVersion: 'sim', classId, weapons })
}
const PARTY: RpgProfile[] = [
  outfit('o1', 'brawler', ['greatsword', 'spear']),
  outfit('o2', 'mage', ['mage-staff', 'arcane-staff']),
  outfit('o3', 'mage', ['mage-staff', 'short-sword']),
  outfit('o4', 'cleric', ['arcane-staff', 'cleric-staff']),
  outfit('o5', 'summoner', ['summoner-tome']),
]

/** Core nodes shallowest first across every branch, then a variant per fork until the tree's three. */
function learn(profile: RpgProfile): RpgProfile {
  let p = profile
  const nodes = rpgProfileTrees(p).flatMap(rpgTreeNodes).sort((a, b) => Number(a.variant !== null) - Number(b.variant !== null) || a.depth - b.depth)
  for (const node of nodes) {
    if (rpgTreePointsSpent(p.tree) >= rpgTreePointsEarned(p.level)) break
    if (node.variant === 'b') continue
    try { p = learnRpgNode(p, node.id) } catch { /* not yet */ }
  }
  return p
}
/** The deepest learned skills, one per branch first so every element is on hand. */
function loadout(p: RpgProfile): RpgNodeRef[] {
  const skills = rpgLearnedSkills(p).map((ref) => ({ ref, node: rpgNode(ref.id)! })).sort((a, b) => b.node.depth - a.node.depth)
  const seen = new Set<string>()
  const first = skills.filter(({ node }) => !seen.has(`${node.tree}.${node.branch}`) && seen.add(`${node.tree}.${node.branch}`))
  return [...first, ...skills.filter((s) => !first.includes(s))].slice(0, rpgActiveSlots(p.level)).map(({ ref }) => ref)
}

type Policy = 'careful' | 'attack-only'
function chooseAction(state: BattleState, policy: Policy, boss: boolean): BattleAction {
  const actor = state.units.find((u) => u.side === 'ally' && u.hp > 0 && battleActionsLeft(state, u.id) > 0)!
  const ally = state.input.allies.find((a) => a.id === actor.id)!
  const hand = rpgHand(ally)
  const foes = state.units.filter((u) => u.side === 'enemy' && u.hp > 0)
  const enemy = (u: BattleUnit) => state.input.enemies.find((e) => e.id === u.id)!
  const lowest = (list: BattleUnit[]) => [...list].sort((a, b) => a.hp - b.hp || a.id.localeCompare(b.id))[0]!
  const guard = (): BattleAction => ({ kind: 'guard', actorId: actor.id, targetId: state.units.find((u) => u.side === 'ally' && u.hp > 0 && u.id !== actor.id)?.id ?? actor.id })
  const familiarSpent = hand.free.kind === 'familiar' && state.familiars.includes(actor.id)
  const freeKinds: RpgWeaponKind[] = hand.free.kind === 'weapon' ? ally.weapons as RpgWeaponKind[] : hand.free.kind === 'short-sword' ? ['short-sword']
    : hand.free.kind === 'familiar' ? [ally.familiar] : []
  const attack = (target: BattleUnit): BattleAction => {
    if (familiarSpent) return guard()
    const weapon = freeKinds.find((k) => battleHitIsWeak(enemy(target), target, k)) ?? freeKinds[0]
    return { kind: 'attack', actorId: actor.id, targetId: target.id, ...(hand.free.kind === 'weapon' && weapon ? { weapon: weapon as RpgWeapon } : {}) }
  }
  if (policy === 'careful') {
    const skills = ally.loadout.flatMap((ref) => { const s = battleActorSkill(state, actor.id, ref); return s && actor.mp >= s.mp ? [s] : [] })
    const spare = (cost: number) => boss || actor.mp - cost >= 0.35 * ally.stats.mp
    const blessing = (primary: Parameters<typeof battleBlessings>[1]) => battleBlessings(ally, primary).at(-1)?.id
    const cast = (skill: typeof skills[number], target: BattleUnit): BattleAction => ({ kind: 'skill', actorId: actor.id, targetId: target.id, skill: skill.ref,
      ...(blessing(skill.def.primary) ? { blessing: blessing(skill.def.primary)! } : {}) })
    const total = (s: typeof skills[number]) => s.def.hits.reduce((sum, h) => sum + h.power, 0) * s.power * (s.def.target === 'all' ? foes.length : 1)
    // A Break is the moment for big skills.
    const broken = foes.filter((f) => battleBroken(f))
    if (broken.length) {
      const best = skills.filter((s) => spare(s.mp)).sort((a, b) => total(b) - total(a))[0]
      return best ? cast(best, lowest(broken)) : attack(lowest(broken))
    }
    // Chip: count weak parts each skill would land on a standing shield.
    const standing = foes.filter((f) => f.shield > 0)
    const weakParts = (s: typeof skills[number], f: BattleUnit) => (s.def.target === 'all' ? standing : [f]).reduce((sum, foe) =>
      sum + s.def.hits.reduce((n, h) => n + h.parts.filter((p) => battleHitIsWeak(enemy(foe), foe, p.kind)).length, 0), 0)
    const options = standing.flatMap((f) => skills.filter((s) => spare(s.mp)).map((s) => ({ f, s, n: weakParts(s, f) })))
      .filter((o) => o.n > 0).sort((a, b) => b.n - a.n || a.f.shield - b.f.shield)
    const byFree = standing.find((f) => freeKinds.some((k) => battleHitIsWeak(enemy(f), f, k)))
    if (options[0] && (!byFree || options[0].n > 1 || boss)) return cast(options[0].s, options[0].f)
    if (byFree && !familiarSpent) return attack(byFree)
  }
  return familiarSpent ? guard() : attack(lowest(foes))
}

interface Fight { node: RpgMapNode; win: boolean; rounds: number; actions: number; kos: number; mpBefore: number; mpAfter: number; hpLost: number; level: number }
function play(chapter: RpgCampaignChapter, run: RpgRunSaveV2, party: RpgProfile[], nodeId: string, policy: Policy, now: number) {
  const members: RpgPartyMember[] = party.map((profile) => ({ profile, slot: { outfitId: profile.outfitId, loadout: loadout(profile), familiar: 'axe' } }))
  const begun = rpgBeginRunBattle(chapter, run, nodeId, members, now)
  const node = chapter.nodes.find((n) => n.id === nodeId)!
  let state = createBattle(begun.battle!.input).state
  let actions = 0
  const mpBefore = state.units.filter((u) => u.side === 'ally').reduce((s, u) => s + u.mp, 0)
  while (state.outcome === 'active') {
    const step = applyBattleAction(state, chooseAction(state, policy, node.kind !== 'fight'))
    if (step.error) throw new Error(`${node.id}: ${step.error}`)
    state = step.state
    actions += 1
  }
  const settled = rpgSettleRunBattle(chapter, begun, state, party, now)
  const fight: Fight = { node, win: settled.outcome === 'win', rounds: state.round, actions,
    kos: state.units.filter((u) => u.side === 'ally' && u.hp === 0).length, mpBefore,
    mpAfter: state.units.filter((u) => u.side === 'ally').reduce((s, u) => s + u.mp, 0),
    hpLost: 1 - state.units.filter((u) => u.side === 'ally').reduce((s, u) => s + u.hp, 0) /
      state.input.allies.reduce((s, a) => s + a.stats.hp, 0), level: settled.profiles[0]!.level }
  return { run: settled.run, party: settled.profiles.map(learn), fight }
}

const poolMp = (run: RpgRunSaveV2, party: RpgProfile[]) => party.reduce((s, p) => s + rpgCarriedMp(run, p), 0) /
  party.reduce((s, p) => s + projectRpgStats(p).mp, 0)

function campaign(scenarioId: string, start: RpgProfile[], policy: Policy, route: (typeof RPG_ELEMENTS)[number]) {
  const chapter = rpgCampaignChapter(scenarioId, cast)
  let run = createRpgRun('party-1', chapter.id, 0)
  let party = start.map(learn)
  const fights: Fight[] = []
  let now = 1
  let lastCamp = 'start'
  const order = chapter.nodes.filter((n) => n.kind !== 'boss' && !(n.stage === 3 && n.element && n.element !== route) || n.id === `${route}-boss`)
    .sort((a, b) => a.row - b.row || a.col - b.col)
  for (const node of order) {
    if (node.kind === 'camp') { run = rpgRestAtCamp(chapter, run, node.id, now++); lastCamp = node.id; continue }
    if (node.kind !== 'fight' || poolMp(run, party) < 0.35) run = rpgRestAtCamp(chapter, run, lastCamp, now++)
    let tries = 0
    for (;;) {
      const out = play(chapter, run, party, node.id, policy, now++)
      run = out.run; party = out.party; fights.push(out.fight)
      if (out.fight.win || ++tries >= 3) break
      run = rpgRestAtCamp(chapter, run, lastCamp, now++)
    }
    if (!fights.at(-1)!.win) break
  }
  return { chapter, fights, party }
}

function report(scenarioId: string, start: RpgProfile[], policy: Policy, route: (typeof RPG_ELEMENTS)[number]) {
  const { chapter, fights, party } = campaign(scenarioId, start, policy, route)
  const minutes = fights.reduce((s, f) => s + f.actions * 7 + 15, 0) / 60
  console.log(`\n${chapter.title} · ${policy} · start ${start.map((p) => `T${p.tier}L${p.level}`)[0]} · route ${route}`)
  console.log('stage  kind      fights  losses  rounds  KOs   HP lost  MP used/fight  foe Lv → party Lv')
  for (let stage = 0; stage <= 3; stage += 1) {
    for (const kind of ['fight', 'sub-boss', 'boss'] as const) {
      const rows = fights.filter((f) => f.node.stage === stage && f.node.kind === kind)
      if (!rows.length) continue
      const wins = rows.filter((f) => f.win)
      const lastWin = wins.at(-1)
      const avg = (k: (f: Fight) => number) => (rows.reduce((s, f) => s + k(f), 0) / rows.length).toFixed(1)
      console.log(`${String(stage).padEnd(6)} ${kind.padEnd(9)} ${String(rows.length).padStart(6)} ${String(rows.length - wins.length).padStart(7)} ${avg((f) => f.rounds).padStart(7)} ${avg((f) => f.kos).padStart(5)} ${avg((f) => f.hpLost * 100).padStart(7)}% ${avg((f) => f.mpBefore - f.mpAfter).padStart(14)}   ${lastWin ? `${lastWin.node.level} → ${lastWin.level}` : '-'}`)
    }
  }
  const won = fights.filter((f) => f.win).length
  const finalLevel = party[0]!
  console.log(`total ${fights.length} fights (${won} won) · ~${minutes.toFixed(0)} min · ends T${finalLevel.tier} Lv${finalLevel.level} (${finalLevel.exp} EXP) · cleared ${fights.some((f) => f.win && f.node.kind === 'boss')}`)
}

const scenarioArg = process.argv[2]
const scenarios = scenarioArg ? [scenarioArg] : ['ura-finale', 'unity-cup', 'project-larc']
for (const id of scenarios) {
  const tier = SCENARIOS.find((s) => s.id === id)!.tier
  const { tier: classTier, level } = rpgTierLevel((tier - 1) * 12 + 1)
  const start = PARTY.map((p) => ({ ...p, tier: classTier, level, exp: 0, tree: [], legacy: [] }))
  report(id, start, 'careful', 'fire')
  report(id, start, 'attack-only', 'fire')
}
