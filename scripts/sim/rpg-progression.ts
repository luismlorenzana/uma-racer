// T096 per-fight progression envelope. Invented outfits and T095 graphs; no private content.
import {
  enrollRpgOutfit, grantRpgExp, promoteRpgOutfit, projectRpgStats, rpgExpToNext,
  spendRpgTreePoint, rpgEncounterBaseExp, rpgEncounterExp, rpgChapterFightCounts, type RpgProfile, type RpgSkillRef,
  rpgInspirationReward,
} from '../../packages/domain/src/rpg/index'
import { SCENARIOS, INSPIRATION_SLOTS, emptyInspiration, openInspiration } from '../../packages/domain/src/index'
import { syntheticChapterPack } from '../../packages/domain/src/rpg/chapter.synthetic'

const outfit = {
  id: 'synthetic-runner',
  baseStats: { speed: 100, stamina: 90, power: 80, guts: 70, wit: 60 },
  growthRates: { speed: 0.2, stamina: 0.1, power: 0, guts: 0, wit: 0.3 },
  aptitudes: {
    surface: { turf: 'A', dirt: 'G' },
    distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'B' },
    strategy: { front: 'B', pace: 'A', late: 'B', end: 'G' },
  },
} as const
const enroll = (): RpgProfile => enrollRpgOutfit({
  outfit, contentVersion: 'synthetic-v1', style: 'pace', weapon: 'spear', defaultSignature: 'fire',
})
const cost = (first: number, lastExclusive: number): number =>
  Array.from({ length: lastExclusive - first }, (_, index) => rpgExpToNext(first + index))
    .reduce((total, value) => total + value, 0)
const budgets = [cost(1, 11), cost(11, 21), cost(21, 31), cost(31, 41), cost(41, 50)]
const expected = [2_080, 3_680, 5_280, 6_880, 7_560]
if (JSON.stringify(budgets) !== JSON.stringify(expected)) throw new Error(`RPG chapter budgets drifted: ${budgets}`)

const rows: string[] = []
const fixture = syntheticChapterPack().chapters[0]!
if (JSON.stringify(rpgChapterFightCounts(fixture)) !== '[2,3]') throw new Error('T095 route lengths drifted')
for (const route of ['rest', 'elite'] as const) {
  let profile = enroll()
  for (let tier = 1; tier <= 2; tier++) {
    for (let chapter = 0; chapter < 5; chapter++) {
      const recommendedLevel = 1 + chapter * 10
      const before = profile.level
      let total = 0
      let slotTokens = 0, skillTokens = 0
      const fights = fixture.nodes.filter((n) => n.kind === 'encounter' || n.kind === 'boss' || route === 'elite' && n.kind === 'elite')
      for (const node of fights) {
        const reward = { baseExp: rpgEncounterBaseExp(recommendedLevel, node.kind as 'encounter' | 'elite' | 'boss'),
          recommendedTier: tier, recommendedLevel }
        const delta = rpgEncounterExp(reward, profile)
        const from = profile.level
        profile = grantRpgExp(profile, delta).profile
        total += delta
        const tokens = rpgInspirationReward({ ...fixture, scenarioId: SCENARIOS[chapter]!.id }, node)
        slotTokens += tokens.slot; skillTokens += tokens.skill
        rows.push(`${route} T${tier} chapter ${chapter + 1} ${node.kind}: +${delta} → Lv${from}→${profile.level}, EXP/bank ${profile.exp}`)
      }
      rows.push(`  Chapter total +${total}; ${profile.level - before} levels`)
      // Five outfits, all six lineage slots and both gold moons per slot. No optional fight required.
      const slotBefore = slotTokens, skillBefore = skillTokens
      for (let member = 0; member < 5; member++) {
        let state = emptyInspiration()
        for (const slot of INSPIRATION_SLOTS) {
          state = openInspiration(state, slot, null); slotTokens--
          for (const index of [0, 1]) { state = openInspiration(state, slot, index); skillTokens-- }
        }
        if (state.slots.length !== 6 || state.golds.length !== 12 || slotTokens < 0 || skillTokens < 0) throw new Error('Five-outfit Inspiration funding shortfall')
      }
      rows.push(`  ${SCENARIOS[chapter]!.name}: ${slotBefore} slot / ${skillBefore} skill tokens → five full builds; surplus ${slotTokens}/${skillTokens}`)
      if (chapter < 4 && (profile.level - before < (tier === 1 ? 7 : 3) || profile.level - before > 14)) throw new Error(`Chapter pacing outside first-tier 7–14 / carried-bank 3–14 levels: ${rows.join('\n')}`)
    }
    if (profile.level !== 50) throw new Error(`${route} five chapters did not reach promotion: Lv${profile.level}`)
    const before = projectRpgStats(profile)
    const bank = profile.exp
    profile = promoteRpgOutfit(profile, [], true).profile
    const after = projectRpgStats(profile)
    if (profile.tier !== tier + 1 || after.speed < before.speed || after.hp < before.hp) throw new Error('Promotion lost stats')
    rows.push(`Promotion T${tier} → T${profile.tier} Lv${profile.level}: bank ${bank} applied; Speed ${before.speed}→${after.speed}, HP ${before.hp}→${after.hp}`)
  }
}

const mid = grantRpgExp(enroll(), budgets[0]!).profile
const reward = { baseExp: rpgEncounterBaseExp(11, 'encounter'), recommendedTier: 1, recommendedLevel: 11 }
const over = { ...mid, tier: 2, level: 11 }
const replayExp = rpgEncounterExp(reward, over), catchExp = rpgEncounterExp(reward, enroll())
if (replayExp !== Math.round(reward.baseExp * 0.25) || catchExp <= reward.baseExp) throw new Error('Replay/catch-up envelope drifted')
rows.push(`Weak replay T2 Lv11: +${replayExp} (25% floor); catch-up T1 Lv1: +${catchExp} vs on-level ${reward.baseExp}`)
const varied = [1, 5, 11, 30, 50].map((level) => rpgEncounterExp(reward, { tier: 1, level }))
rows.push(`Five entrants Lv1/5/11/30/50: ${varied.join(' / ')} EXP; KO does not change grants`)

const ref = (element: RpgSkillRef['element'], depth: number, branch: RpgSkillRef['branch']): RpgSkillRef =>
  ({ tier: 1, weapon: 'spear', element, depth, branch })
let focus = { ...enroll(), level: 50 }
for (const [depth, branch] of ['foundation', 'focused', 'committed', 'role', 'signature'].entries()) {
  const choice = ref('fire', depth + 1, branch as RpgSkillRef['branch'])
  for (let level = 1; level <= 5; level += 1) focus = spendRpgTreePoint(focus, choice)
}
let breadth = { ...enroll(), level: 50 }
for (const element of ['fire', 'ice', 'lightning', 'light', 'dark'] as const) {
  for (let level = 1; level <= 3; level += 1) breadth = spendRpgTreePoint(breadth, ref(element, 1, 'foundation'))
  for (let level = 1; level <= 2; level += 1) breadth = spendRpgTreePoint(breadth, ref(element, 2, 'area'))
}
if (focus.tree.length !== 5 || focus.tree.some((node) => node.level !== 5) ||
  breadth.tree.length !== 10 || breadth.tree.some((node) => node.depth > 2)) {
  throw new Error('RPG focus/breadth tree envelope drifted')
}
rows.push('25 points: focus = five Lv5 Fire nodes through depth 5; breadth = five elements through depth 2')

console.log('Uma RPG synthetic progression — two tiers, five chapter-sized budgets per tier')
for (const row of rows) console.log(row)
