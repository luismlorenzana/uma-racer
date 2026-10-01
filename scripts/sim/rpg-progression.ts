// T089 progression envelope. Invented outfits and EXP budgets only; no private pack or chapter rows.
import {
  enrollRpgOutfit, grantRpgExp, promoteRpgOutfit, projectRpgStats, rpgExpToNext,
  spendRpgTreePoint, type RpgProfile, type RpgSkillRef,
} from '../../packages/domain/src/rpg/index'

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

let profile = enroll()
const rows: string[] = []
for (let tier = 1; tier <= 2; tier += 1) {
  for (const [index, budget] of budgets.entries()) {
    profile = grantRpgExp(profile, budget).profile
    rows.push(`Tier ${tier} chapter ${index + 1}: +${budget} EXP → Lv${profile.level}, bank ${profile.exp}`)
    if (profile.level !== [11, 21, 31, 41, 50][index]) throw new Error('RPG five-chapter pacing drifted')
  }
  if (tier === 1) {
    const before = projectRpgStats(profile)
    profile = promoteRpgOutfit(profile, [], true).profile
    const after = projectRpgStats(profile)
    if (profile.tier !== 2 || profile.level !== 1 || after.speed < before.speed || after.hp < before.hp) {
      throw new Error('RPG promotion lost progression')
    }
    rows.push(`Promotion T1 Lv50 → T2 Lv1: Speed ${before.speed}→${after.speed}, HP ${before.hp}→${after.hp}`)
  }
}

// These replay/catch-up grants are illustrative inputs, not T096's eventual level-relative payout rule.
const mid = grantRpgExp(enroll(), budgets[0]!).profile
const weakReplay = grantRpgExp(mid, Math.round(budgets[0]! * 0.25)).profile
const catchUp = grantRpgExp(enroll(), Math.round(budgets[1]! * 1.5)).profile
if (weakReplay.level <= mid.level || weakReplay.level >= 21 || catchUp.level <= mid.level) {
  throw new Error('RPG illustrative replay/catch-up envelope drifted')
}
rows.push(`Weak-chapter replay (illustrative 25%): Lv${mid.level}→${weakReplay.level}`)
rows.push(`Catch-up (illustrative 150%): Lv1→${catchUp.level}`)

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
