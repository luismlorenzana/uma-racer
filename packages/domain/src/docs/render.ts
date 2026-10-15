// The live manual's generated blocks (docs/game/, D337, from uma-rpg's D92): every list in the manual is rendered
// here from the rules, so it can't drift from the game. A page marks a block with `<!-- live:<key> -->` …
// `<!-- /live -->`; `pnpm docs:update` rewrites them, and `docs.test.ts` fails when one is stale. Pure: no I/O.
// Only code-owned rules are rendered: nothing from the private content packs (Umas, cards, skills, races).
//
// Each area renders its own tables too (docs/game/architecture.md#the-rework-modules): an area exports
// `LIVE_BLOCKS: Record<key, () => string>` from its `docs.ts`, and one import plus one argument to `AREA_BLOCKS` below
// joins it. A key used twice fails at load, so two areas can't fight over a block. The manual's own keys below are
// the race's (docs/game/racing.md) and the dependencies (docs/game/architecture.md); the old fourteen-scenario ladder,
// caps, buffs and level table left with generation 2, whose pages render the tier rules' (T143).
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
import { GRADE_HANDICAP, RIVAL_REFERENCE_METERS, RIVAL_SKILL_RANGE, RIVAL_STAT_FLOOR, STYLE_COUNT_RANGE } from '../opponents'
import { raceExp } from '../progression'
import { RACE_GRADES } from '../types'

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
const GRADE_LABEL: Readonly<Record<string, string>> = { debut: 'Debut', maiden: 'Maiden', 'pre-op': 'Pre-OP', op: 'OP', g3: 'G3', g2: 'G2', g1: 'G1' }

// --- Racing ---------------------------------------------------------------------------------------------------------

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
    case 'race-rewards': return raceRewards()
    case 'rivals': return rivals()
    case 'dependencies': return dependencies(context.packages)
    default: return AREA_BLOCKS[key]?.() ?? null
  }
}
