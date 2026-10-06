// Campaign balance (D261–D265): a synthetic five-outfit party plays generated chapters with a careful policy and an
// attack-only policy. No private Uma, cast or chapter content: outfits and cast are invented here.
import { RPG_ELEMENTS, enrollRpgOutfit, eligibleRpgCells, projectRpgStats, rpgActiveSlots, rpgSkillKey, rpgTreePointsEarned,
  rpgTreePointsSpent, spendRpgTreePoint, RPG_DEPTH_GATES, type RpgElement, type RpgProfile, type RpgSkillRef, type RpgWeapon } from '../../packages/domain/src/rpg/rules'
import type { Aptitudes, Strategy } from '../../packages/domain/src/types'
import { applyBattleAction, battleBroken } from '../../packages/domain/src/rpg/battle/engine'
import { battleSkill, battleWeaponKind } from '../../packages/domain/src/rpg/battle/skills'
import type { BattleAction, BattleState } from '../../packages/domain/src/rpg/battle/types'
import { rpgCampaignChapter, rpgTierLevel, type RpgCampaignChapter, type RpgMapNode } from '../../packages/domain/src/rpg/campaign/chapters'
import { createBattle } from '../../packages/domain/src/rpg/battle/engine'
import { createRpgRun, rpgBeginRunBattle, rpgCarriedMp, rpgMemberLevel, rpgRestAtCamp, rpgSettleRunBattle,
  type RpgPartyMember, type RpgRunSaveV2 } from '../../packages/domain/src/rpg/campaign/run'
import { SCENARIOS } from '../../packages/domain/src/scenarios'

const cast = Array.from({ length: 7 }, (_, i) => ({ id: `cast${i + 1}`, name: `Rival ${i + 1}` }))
const grade = (a: string) => a as Aptitudes['distance']['sprint']
function outfit(id: string, style: Strategy, weapon: RpgWeapon, distance: Partial<Record<'sprint' | 'mile' | 'medium' | 'long', 'A' | 'B'>>, signature: RpgElement): RpgProfile {
  const stats = { speed: 112, stamina: 106, power: 112, guts: 100, wit: 110 }
  const aptitudes: Aptitudes = { surface: { turf: 'A', dirt: 'G' },
    distance: { sprint: grade(distance.sprint ?? 'D'), mile: grade(distance.mile ?? 'D'), medium: grade(distance.medium ?? 'D'), long: grade(distance.long ?? 'D') },
    strategy: { front: 'A', pace: 'A', late: 'A', end: 'A' } }
  return enrollRpgOutfit({ outfit: { id, baseStats: stats, growthRates: { speed: 0.1, stamina: 0.05, power: 0.05, guts: 0.05, wit: 0.05 }, aptitudes },
    contentVersion: 'sim', style, weapon, defaultSignature: signature })
}
const PARTY: RpgProfile[] = [
  outfit('o1', 'front', 'greatsword', { medium: 'A', mile: 'B' }, 'fire'),
  outfit('o2', 'pace', 'spear', { mile: 'A', long: 'B' }, 'ice'),
  outfit('o3', 'late', 'wizard-staff', { long: 'A', medium: 'B' }, 'lightning'),
  outfit('o4', 'end', 'tome', { medium: 'A', sprint: 'B' }, 'dark'),
  outfit('o5', 'pace', 'sword-shield', { sprint: 'A', mile: 'B' }, 'light'),
]

/** Foundations of two A elements, then the signature's deeper branches, then skill levels. */
/** Two A elements: each runs foundation → Twin → Triple → Quad → Barrage, then single big hits; spare points level skills. */
function learn(profile: RpgProfile): RpgProfile {
  let p = profile
  const cells = eligibleRpgCells(p)
  const primary = [p.defaultSignature, ...cells.filter((c) => c.affinity === 'A' && c.element !== p.defaultSignature).map((c) => c.element)].slice(0, 2)
  const line = [[1, 'foundation'], [2, 'double'], [3, 'multi'], [4, 'quad'], [5, 'barrage'], [2, 'focused'], [3, 'committed'], [5, 'signature']] as const
  while (rpgTreePointsSpent(p.tree) < rpgTreePointsEarned(p.level)) {
    const want: RpgSkillRef[] = []
    for (const element of primary) for (const [depth, branch] of line) {
      const max = cells.find((c) => c.element === element)?.maxDepth ?? 0
      if (depth <= max && p.level >= RPG_DEPTH_GATES[depth - 1]! && !p.tree.some((s) => s.element === element && s.branch === branch) &&
        (depth === 1 || p.tree.some((s) => s.element === element && s.depth === depth - 1))) want.push({ tier: p.tier, weapon: p.weapon, element, depth, branch })
    }
    const upgrade = [...p.tree].filter((s) => s.level < 5).sort((a, b) => b.depth - a.depth)[0]
    const ref = want[0] ?? upgrade
    if (!ref) break
    try { p = spendRpgTreePoint(p, ref) } catch { break }
  }
  return p
}
const loadout = (p: RpgProfile): RpgSkillRef[] => [...p.tree].sort((a, b) => b.depth - a.depth).slice(0, rpgActiveSlots(p.level))
  .map(({ tier, weapon, element, depth, branch }) => ({ tier, weapon, element, depth, branch }))

type Policy = 'careful' | 'attack-only'
function chooseAction(state: BattleState, policy: Policy, boss: boolean, skillsUsed: Map<string, number>): BattleAction {
  const actor = state.units.find((u) => u.side === 'ally' && u.hp > 0 && !state.acted.includes(u.id))!
  const ally = state.input.allies.find((a) => a.id === actor.id)!
  const foes = state.units.filter((u) => u.side === 'enemy' && u.hp > 0)
  const enemy = (id: string) => state.input.enemies.find((e) => e.id === id)!
  const lowest = (list: typeof foes) => [...list].sort((a, b) => a.hp - b.hp || a.id.localeCompare(b.id))[0]!
  if (policy === 'careful') {
    const skills = ally.loadout.map((ref) => ({ ref, s: battleSkill(ref) })).filter(({ s }) => actor.mp >= s.mp)
    const spare = (cost: number) => boss || actor.mp - cost >= 0.3 * ally.stats.mp
    // A Break is the moment for big skills.
    const broken = foes.filter((f) => battleBroken(f))
    if (broken.length) {
      const target = lowest(broken)
      const best = skills.filter(({ s }) => s.target !== 'all' && spare(s.mp)).sort((a, b) => b.s.power * b.s.hits - a.s.power * a.s.hits)[0]
      return best ? { kind: 'skill', actorId: actor.id, targetId: target.id, skill: best.ref } : { kind: 'attack', actorId: actor.id, targetId: target.id }
    }
    // Chip shields: a weak weapon Attack is free; a weak multi-hit skill chips faster.
    const unbroken = foes.filter((f) => f.shield > 0).sort((a, b) => a.shield - b.shield)
    const byWeapon = unbroken.find((f) => enemy(f.id).weaknesses.weapons.includes(battleWeaponKind(ally.weapon)))
    const used = skillsUsed.get(actor.id) ?? 0
    const bySkill = unbroken.flatMap((f) => skills.filter(({ s }) => s.element === enemy(f.id).weaknesses.element && spare(s.mp))
      .map((x) => ({ f, ...x }))).sort((a, b) => b.s.hits - a.s.hits)[0]
    if (bySkill && (!byWeapon || bySkill.f.shield > 1) && (boss || used < 2)) {
      skillsUsed.set(actor.id, used + 1)
      return { kind: 'skill', actorId: actor.id, targetId: bySkill.f.id, skill: bySkill.ref }
    }
    if (byWeapon) return { kind: 'attack', actorId: actor.id, targetId: byWeapon.id }
  }
  return { kind: 'attack', actorId: actor.id, targetId: lowest(foes).id }
}

interface Fight { node: RpgMapNode; win: boolean; rounds: number; actions: number; kos: number; mpBefore: number; mpAfter: number; hpLost: number; level: number }
function play(chapter: RpgCampaignChapter, run: RpgRunSaveV2, party: RpgProfile[], nodeId: string, policy: Policy, now: number) {
  const members: RpgPartyMember[] = party.map((profile) => ({ profile, slot: { outfitId: profile.outfitId, signature: profile.defaultSignature, loadout: loadout(profile) } }))
  const begun = rpgBeginRunBattle(chapter, run, nodeId, members, now)
  const node = chapter.nodes.find((n) => n.id === nodeId)!
  let state = createBattle(begun.battle!.input).state
  const used = new Map<string, number>()
  let actions = 0
  const mpBefore = state.units.filter((u) => u.side === 'ally').reduce((s, u) => s + u.mp, 0)
  while (state.outcome === 'active') {
    const step = applyBattleAction(state, chooseAction(state, policy, node.kind !== 'fight', used))
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

function campaign(scenarioId: string, start: RpgProfile[], policy: Policy) {
  const chapter = rpgCampaignChapter(scenarioId, cast)
  let run = createRpgRun('party-1', chapter.id, 0)
  let party = start.map(learn)
  const fights: Fight[] = []
  let now = 1
  let lastCamp = 'start'
  const weakCount = (element: RpgElement) => party.filter((p) => p.affinities[({ fire: 'lightning', ice: 'fire', lightning: 'ice', light: 'dark', dark: 'light' } as const)[element]] === 'A').length
  const route = [...RPG_ELEMENTS].sort((a, b) => weakCount(b) - weakCount(a))[0]!
  const order = chapter.nodes.filter((n) => n.kind !== 'boss' && !(n.stage === 4 && n.element && n.element !== route) || n.id === `${route}-boss`)
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
  return { chapter, fights, party, route }
}

function report(scenarioId: string, start: RpgProfile[], policy: Policy) {
  const { chapter, fights, party, route } = campaign(scenarioId, start, policy)
  const minutes = fights.reduce((s, f) => s + f.actions * 7 + 15, 0) / 60
  console.log(`\n${chapter.title} · ${policy} · start ${start.map((p) => `T${p.tier}L${p.level}`)[0]} · route ${route}`)
  console.log('stage  kind      fights  losses  rounds  KOs   HP lost  MP used/fight  foe Lv → party Lv')
  for (let stage = 0; stage <= 4; stage += 1) {
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
  return party
}

const scenarioArg = process.argv[2]
const scenarios = scenarioArg ? [scenarioArg] : ['ura-finale', 'unity-cup', 'project-larc']
for (const id of scenarios) {
  const tier = SCENARIOS.find((s) => s.id === id)!.tier
  const lifetime = (tier - 1) * 10 + 1
  const { tier: classTier, level } = rpgTierLevel(lifetime)
  const start = PARTY.map((p) => ({ ...p, tier: classTier, level, exp: 0, tree: [], legacy: [] }))
  report(id, start, 'careful')
  report(id, start, 'attack-only')
}
void rpgSkillKey; void rpgMemberLevel
