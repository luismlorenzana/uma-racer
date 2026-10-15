// The live manual's generated blocks (docs/game/, D337, from uma-rpg's D92): every list in the manual is rendered
// here from the rules, so it can't drift from the game. A page marks a block with `<!-- live:<key> -->` …
// `<!-- /live -->`; `pnpm docs:update` rewrites them, and `docs.test.ts` fails when one is stale. Pure: no I/O.
// Only code-owned rules are rendered: nothing from the private content packs (Umas, cards, skills, races).
//
// Each area renders its own tables too (docs/game/architecture.md#the-rework-modules): an area exports
// `LIVE_BLOCKS: Record<key, () => string>` from its `docs.ts`, and one import plus one argument to `AREA_BLOCKS` below
// joins it. A key used twice fails at load, so two areas can't fight over a block.
import { LIVE_BLOCKS as BUILDS_BLOCKS } from '../builds/docs'
import { LIVE_BLOCKS as CHECK_IN_BLOCKS } from '../check-in/docs'
import { LIVE_BLOCKS as EXCHANGE_BLOCKS } from '../economy/docs'
import { LIVE_BLOCKS as FARM_BLOCKS } from '../farm/docs'
import { LIVE_BLOCKS as HUB_BLOCKS } from '../hub/docs'
import { LIVE_BLOCKS as ITEM_BLOCKS } from '../items/docs'
import { LIVE_BLOCKS as PLANNER_BLOCKS } from '../planner/docs'
import { LIVE_BLOCKS as LOOP_BLOCKS } from '../sim/docs'
import { LIVE_BLOCKS as TIER_BLOCKS } from '../tiers/docs'
import { LIVE_BLOCKS as TRAINING_BLOCKS } from '../training/docs'
import { LIVE_BLOCKS as CONSTELLATION_BLOCKS } from '../training/trees/docs'
import { CAP_PROFILES, CONSTELLATION_SHAPES, nodeValue } from '../constellation'
import { GRADE_HANDICAP, RIVAL_REFERENCE_METERS, RIVAL_SKILL_RANGE, RIVAL_STAT_FLOOR, STYLE_COUNT_RANGE } from '../opponents'
import { expToNextUmaLevel, GATE_SHARD_REWARD, raceExp } from '../progression'
import { SCENARIO_BUFFS } from '../scenario-buffs'
import { LEVELS_PER_SCENARIO, MAX_UMA_LEVEL, SCENARIOS, skillPointCap } from '../scenarios'
import { RACE_GRADES, STATS } from '../types'

export type LiveBlocks = Readonly<Record<string, () => string>>

export function joinBlocks(...tables: readonly LiveBlocks[]): LiveBlocks {
  const joined: Record<string, () => string> = {}
  for (const table of tables) {
    for (const [key, render] of Object.entries(table)) {
      if (key in joined) throw new Error(`Live block "${key}" is rendered twice`)
      joined[key] = render
    }
  }
  return joined
}

/** Every area's live blocks, joined. */
export const AREA_BLOCKS: LiveBlocks = joinBlocks(
  TIER_BLOCKS, ITEM_BLOCKS, CONSTELLATION_BLOCKS, EXCHANGE_BLOCKS, FARM_BLOCKS, TRAINING_BLOCKS, PLANNER_BLOCKS, BUILDS_BLOCKS, LOOP_BLOCKS,
  CHECK_IN_BLOCKS, HUB_BLOCKS,
)

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
    default: return AREA_BLOCKS[key]?.() ?? null
  }
}
