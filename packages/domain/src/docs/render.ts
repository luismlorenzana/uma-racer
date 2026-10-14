// The live manual's generated blocks (docs/game/, D337, from uma-rpg's D92): every list in the manual is rendered
// here from the rules, so it can't drift from the game. A page marks a block with `<!-- live:<key> -->` …
// `<!-- /live -->`; `pnpm docs:update` rewrites them, and `docs.test.ts` fails when one is stale. Pure: no I/O.
// Only code-owned rules are rendered: nothing from the private content packs (Umas, cards, skills, races).
import { CAP_PROFILES, CONSTELLATION_SHAPES, nodeValue } from '../constellation'
import { GRADE_HANDICAP, RIVAL_REFERENCE_METERS, RIVAL_SKILL_RANGE, RIVAL_STAT_FLOOR, STYLE_COUNT_RANGE } from '../opponents'
import { expToNextUmaLevel, GATE_SHARD_REWARD, raceExp } from '../progression'
import { SCENARIO_BUFFS } from '../scenario-buffs'
import { LEVELS_PER_SCENARIO, MAX_UMA_LEVEL, SCENARIOS, skillPointCap } from '../scenarios'
import { RACE_GRADES, STATS } from '../types'
import { REWORK_BLOCKS } from './rework'

type Cell = string | number
/** A Markdown table; pipes in cells are escaped. */
function table(head: readonly string[], rows: readonly (readonly Cell[])[]): string {
  const cell = (v: Cell) => String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ')
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n')
}
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`
const num = (n: number) => n.toLocaleString('en-US')
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const GRADE_LABEL: Readonly<Record<string, string>> = { debut: 'Debut', maiden: 'Maiden', 'pre-op': 'Pre-OP', op: 'OP', g3: 'G3', g2: 'G2', g1: 'G1' }

// --- Scenarios ------------------------------------------------------------------------------------------------------

function scenarios(): string {
  return table(['Tier', 'Scenario', 'JP release', 'Constellation', 'Card nodes', 'Node value', 'SP cap', 'Buff'],
    SCENARIOS.map((s) => {
      const shape = CONSTELLATION_SHAPES[s.tier - 1]!, buff = SCENARIO_BUFFS[s.tier - 1]!
      return [s.tier, s.name, s.jpRelease, shape.shape, shape.cardNodes, nodeValue(s.tier), num(skillPointCap(s.tier)), buff.name]
    }))
}

function caps(): string {
  return table(['Tier', 'Scenario', ...STATS.map(cap), 'Budget'],
    SCENARIOS.map((s) => {
      const caps = CAP_PROFILES[s.tier - 1]!
      return [s.tier, s.name, ...STATS.map((k) => num(caps[k])), num(STATS.reduce((sum, k) => sum + caps[k], 0))]
    }))
}

function buffs(): string {
  return table(['Scenario', 'Buff', 'Rule', 'Typical gain'],
    SCENARIOS.map((s) => { const b = SCENARIO_BUFFS[s.tier - 1]!; return [s.name, b.name, b.rule, pct(b.typical)] }))
}

// --- Racing ---------------------------------------------------------------------------------------------------------

function levels(): string {
  const rows = Array.from({ length: LEVELS_PER_SCENARIO - 1 }, (_, i) => [`${i + 1} → ${i + 2}`, num(expToNextUmaLevel(i + 1))])
  const total = rows.reduce((sum, [, exp]) => sum + Number(String(exp).replace(/,/g, '')), 0)
  return [table(['Level in a scenario', 'EXP'], [...rows, ['Scenario total', num(total)]]),
    '',
    `${LEVELS_PER_SCENARIO} levels a scenario, ${MAX_UMA_LEVEL} in all. Each gate level pays ${GATE_SHARD_REWARD} Uma Shard.`].join('\n')
}

function raceRewards(): string {
  return table(['Grade', 'Win EXP', '2nd or 3rd', 'Rival handicap'],
    RACE_GRADES.map((grade) => [GRADE_LABEL[grade] ?? grade, raceExp(grade, 1), raceExp(grade, 2), pct(GRADE_HANDICAP[grade])]))
}

function rivals(): string {
  return table(['Rule', 'Value'], [
    ['Rivals per running style', `${STYLE_COUNT_RANGE.min}–${STYLE_COUNT_RANGE.max}`],
    ['Each rolled stat', `${pct(RIVAL_STAT_FLOOR)}–100% of her style's preset`],
    ['Skills per rival', `${RIVAL_SKILL_RANGE.min}–${RIVAL_SKILL_RANGE.max}`],
    ...Object.entries(RIVAL_REFERENCE_METERS).map(([band, meters]) => [`Stamina reference, ${band}`, `${num(meters)} m`]),
  ])
}

// --- Repository -----------------------------------------------------------------------------------------------------

export interface PackageJson { name: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
function dependencies(pkgs: readonly { path: string; json: PackageJson }[]): string {
  return table(['Package', 'Dependency', 'Version', 'Kind'], pkgs.flatMap(({ json }) => [
    ...Object.entries(json.dependencies ?? {}).map(([name, v]) => [json.name, name, v, 'runtime']),
    ...Object.entries(json.devDependencies ?? {}).map(([name, v]) => [json.name, name, v, 'dev']),
  ]))
}

export function renderBlock(key: string, context: { packages: readonly { path: string; json: PackageJson }[] }): string | null {
  switch (key) {
    case 'scenarios': return scenarios()
    case 'caps': return caps()
    case 'buffs': return buffs()
    case 'levels': return levels()
    case 'race-rewards': return raceRewards()
    case 'rivals': return rivals()
    case 'dependencies': return dependencies(context.packages)
    default: return REWORK_BLOCKS[key]?.() ?? null
  }
}
