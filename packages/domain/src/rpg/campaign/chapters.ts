// One generated campaign chapter per scenario: a top-to-bottom map of fights, camps, sub-bosses and three authored
// Finals routes (docs/design/uma-rpg.md#chapters, D262, D312). Layout and numbers are code; the private pack only
// supplies the cast (names and portraits).
import { SCENARIOS } from '../../scenarios'
import { RPG_DEPTH_GATES, RPG_ELEMENTS, RPG_WEAPON_KINDS, rpgElementWeakness, type RpgElement } from '../rules'
import { RPG_SKILL_POWER } from '../catalog'
import type { BattleEnemy, BattleWeaknesses, EnemyRank } from '../battle/types'
import { RPG_FOE_ROLES, RPG_FOE_TUNING, rpgFoe, type RpgFoeRole } from './enemies'
import { RPG_FINALS, type RpgFinalsRoute } from './finals'

export const RPG_CAMPAIGN_VERSION = 1
/** D266: a chapter spans twelve levels (Debut 1–3, Classic 4–6, Senior 7–9, Finals 10–12), so four fill Lv1–48. */
export const RPG_CHAPTER_LEVELS = 12
/** Stages with rows of regular fights; the Finals is three routes of a vanguard and a champion (D312). */
export const RPG_FIGHT_STAGES = 3
/** D286: a stage's first two levels are one row of three fights each, then its camp and sub-boss at the third. */
export const RPG_STAGE_FIGHT_ROWS = 2
export const RPG_FIGHT_LANES = [1, 2, 3] as const
export const RPG_MAP_COLUMNS = 5
export type RpgMapNodeKind = 'camp' | 'fight' | 'sub-boss' | 'boss'
export interface RpgCastMember { id: string; name: string }
export interface RpgMapNode {
  id: string
  row: number
  col: number
  kind: RpgMapNodeKind
  /** Lifetime level of its foes (camps carry the level around them). */
  level: number
  stage: number
  name: string
  /** The route's or boss's element, when the node has one. */
  element: RpgElement | null
  /** A Finals route's one-line flavor (D312). */
  note: string | null
  enemies: BattleEnemy[]
  exits: string[]
}
export interface RpgCampaignChapter {
  id: string
  scenarioId: string
  tier: number
  title: string
  /** Lifetime level band: first fights at `levelStart`, champions at `levelStart + 11` (D266). */
  levelStart: number
  rows: number
  nodes: RpgMapNode[]
}

export const RPG_STAGE_NAMES = ['Debut', 'Classic', 'Senior', 'Finals'] as const
const FIGHT_NAMES = ['Skirmish', 'Rival team', 'Ambush', 'Patrol', 'Sparring match', 'Practice bout', 'Road block', 'Challenge']
/** Finals node ids: route 1–3's vanguard and champion. */
export const rpgFinalsNodeIds = (route: number): { vanguard: string; champion: string } => ({ vanguard: `route${route}-sub`, champion: `route${route}-boss` })
/** The authored Finals of a scenario. */
export function rpgFinals(scenarioId: string) {
  const finals = RPG_FINALS[scenarioId]
  if (!finals) throw new RangeError(`No Finals authored for ${scenarioId}`)
  return finals
}

function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}
const pick = <T>(list: readonly T[], key: string): T => list[hash(key) % list.length]!

/** Lifetime level to the Tier · Lv a profile shows. */
export function rpgTierLevel(lifetime: number): { tier: number; level: number } {
  return { tier: Math.floor((lifetime - 1) / 50) + 1, level: ((lifetime - 1) % 50) + 1 }
}
export const rpgChapterLevelStart = (tier: number): number => (tier - 1) * RPG_CHAPTER_LEVELS + 1

interface Layout { id: string; row: number; col: number; kind: RpgMapNodeKind; level: number; stage: number; element: RpgElement | null
  exits: string[]; route: { index: number; spec: RpgFinalsRoute } | null }

function layout(start: number, scenarioId: string, scenarioTier: number): Layout[] {
  const nodes: Layout[] = []
  let row = 0
  const add = (n: Omit<Layout, 'exits' | 'row' | 'route'> & { route?: Layout['route'] }): Layout => {
    const node = { route: null, ...n, row, exits: [] }; nodes.push(node); return node
  }
  let previous: Layout[] = [add({ id: 'start', col: 2, kind: 'camp', level: start, stage: 0, element: null })]
  row += 1
  const link = (from: Layout[], to: Layout[]) => {
    for (const a of from) {
      const near = to.filter((b) => Math.abs(b.col - a.col) <= 1)
      a.exits.push(...(near.length && from.length > 1 && to.length > 1 ? near : to).map((b) => b.id))
    }
  }
  for (let stage = 0; stage < RPG_FIGHT_STAGES; stage += 1) {
    for (let index = 0; index < RPG_STAGE_FIGHT_ROWS; index += 1) {
      const level = start + 3 * stage + index
      const current = RPG_FIGHT_LANES.map((col) => add({ id: `a${stage + 1}r${index + 1}c${col}`, col, kind: 'fight', level, stage, element: null }))
      link(previous, current)
      previous = current
      row += 1
    }
    const camp = add({ id: `a${stage + 1}camp`, col: 2, kind: 'camp', level: start + 3 * stage + 1, stage, element: null })
    link(previous, [camp]); row += 1
    const element = RPG_ELEMENTS[(scenarioTier + stage * 2) % RPG_ELEMENTS.length]!
    const boss = add({ id: `a${stage + 1}boss`, col: 2, kind: 'sub-boss', level: start + 3 * stage + 2, stage, element })
    link([camp], [boss]); row += 1
    previous = [boss]
  }
  // Finals (D266, D312): the last camp opens the scenario's three authored routes, each a vanguard then its champion.
  const finals = RPG_FIGHT_STAGES
  const last = add({ id: 'final-camp', col: 2, kind: 'camp', level: start + 9, stage: finals, element: null })
  link(previous, [last]); row += 1
  const routes = rpgFinals(scenarioId).routes.map((spec, index) => ({ index, spec, col: index * 2 }))
  const guards = routes.map((r) => add({ id: rpgFinalsNodeIds(r.index + 1).vanguard, col: r.col, kind: 'sub-boss', level: start + 10,
    stage: finals, element: r.spec.vanguard.element, route: r }))
  last.exits.push(...guards.map((n) => n.id)); row += 1
  const bosses = routes.map((r) => add({ id: rpgFinalsNodeIds(r.index + 1).champion, col: r.col, kind: 'boss', level: start + RPG_CHAPTER_LEVELS - 1,
    stage: finals, element: r.spec.champion.element, route: r }))
  guards.forEach((n, i) => n.exits.push(bosses[i]!.id))
  return nodes
}

/** Skill power open at a chapter's first level, against depth 1: what a party's MP buys in its boss fights (D282). */
export function rpgChapterReach(levelStart: number): number {
  const depth = RPG_DEPTH_GATES.filter((gate) => rpgTierLevel(levelStart).level >= gate).length
  return RPG_SKILL_POWER[depth - 1]! / RPG_SKILL_POWER[0]
}

function foes(chapterId: string, node: Layout, cast: readonly RpgCastMember[], reach: number): { enemies: BattleEnemy[]; lead: RpgCastMember | null } {
  if (node.kind === 'camp') return { enemies: [], lead: null }
  const used = new Set<string>()
  const castFor = (slot: number): RpgCastMember => {
    const offset = hash(`${chapterId}:${node.id}:${slot}:cast`)
    for (let i = 0; i < cast.length; i += 1) {
      const member = cast[(offset + i) % cast.length]!
      if (!used.has(member.id) || used.size >= cast.length) { used.add(member.id); return member }
    }
    return cast[offset % cast.length]!
  }
  // Weaknesses by rank (D279): regulars 3 weapons + 2 elements (or 2 + 3), sub-bosses 2 + 2, champions 2 + 1 (or 1 + 2).
  // The first element is the one that beats the foe's own, so routes still read by element; its own never shows.
  const weaknesses = (slot: number, element: RpgElement, rank: EnemyRank): BattleWeaknesses => {
    const key = `${chapterId}:${node.id}:${slot}`
    const flip = hash(`${key}:split`) % 2 === 1
    const [w, e] = rank === 'regular' ? (flip ? [2, 3] : [3, 2]) : rank === 'sub-boss' ? [2, 2] : (flip ? [1, 2] : [2, 1])
    const shuffled = <T extends string>(list: readonly T[], tag: string): T[] => [...list].sort((a, b) => hash(`${key}:${a}:${tag}`) - hash(`${key}:${b}:${tag}`))
    const first = rpgElementWeakness(element)
    return { weapons: shuffled(RPG_WEAPON_KINDS, 'weak').slice(0, w),
      elements: [first, ...shuffled(RPG_ELEMENTS.filter((x) => x !== element && x !== first), 'el')].slice(0, e) }
  }
  const shield = node.stage >= 2 ? RPG_FOE_TUNING.lateRegularShield : RPG_FOE_TUNING.regularShield
  const regular = (slot: number, element: RpgElement, role?: RpgFoeRole): BattleEnemy => {
    const member = castFor(slot)
    return rpgFoe({ id: `foe${slot + 1}`, castId: member.id, element, rank: 'regular', level: node.level, shield,
      weaknesses: weaknesses(slot, element, 'regular'), role: role ?? pick(RPG_FOE_ROLES, `${chapterId}:${node.id}:${slot}:role`) })
  }
  const others = (avoid: RpgElement, slot: number) => pick(RPG_ELEMENTS.filter((e) => e !== avoid), `${chapterId}:${node.id}:${slot}:el`)
  if (node.kind === 'fight') {
    const count = node.element ? 3 : node.stage === 0 ? 2 : node.stage === 1 ? (node.col === 2 ? 3 : 2) : 3
    // Lanes lean toward an element so a party can steer by its affinities; the middle lane is mixed.
    const lane = node.element ?? (node.col === 2 ? null : RPG_ELEMENTS[(hash(`${chapterId}:lane:${node.stage}:${node.col}`)) % RPG_ELEMENTS.length]!)
    const enemies = Array.from({ length: count }, (_, slot) => {
      const element = lane && slot < (node.element ? 2 : 1) ? lane : pick(RPG_ELEMENTS, `${chapterId}:${node.id}:${slot}:el`)
      const role = slot === 0 ? undefined : pick(RPG_FOE_ROLES.filter((r) => r !== 'guard'), `${chapterId}:${node.id}:${slot}:role`)
      return regular(slot, element, role)
    })
    return { enemies, lead: null }
  }
  const element = node.element!
  // Leaders rotate through the cast: each stage and each Finals route shows a different face where possible.
  const route = node.route?.index ?? 0
  const leadIndex = (hash(`${chapterId}:leads`) + (node.kind === 'boss' ? 4 + route : node.stage >= RPG_FIGHT_STAGES ? 9 + route : node.stage)) % cast.length
  const boss = cast[leadIndex]!
  used.add(boss.id)
  const minions = node.kind === 'boss' ? 2 : node.stage < 2 ? 1 : 2
  const rank = node.kind === 'boss' ? 'boss' : 'sub-boss'
  // A Finals route's escorts are authored (D312); a stage sub-boss's are drawn from the seed.
  const authored = node.route ? (node.kind === 'boss' ? node.route.spec.champion : node.route.spec.vanguard).escorts : null
  const enemies = [rpgFoe({ id: 'foe1', castId: boss.id, element, rank, level: node.level, role: node.kind === 'boss' ? 'champion' : 'captain',
    shield: node.kind === 'boss' ? RPG_FOE_TUNING.bossShield : RPG_FOE_TUNING.subBossShield, weaknesses: weaknesses(0, element, rank), reach }),
  ...Array.from({ length: minions }, (_, i) => authored ? regular(i + 1, authored[i]![1], authored[i]![0]) : regular(i + 1, others(element, i + 1)))]
  return { enemies, lead: boss }
}

function nodeName(node: Layout, lead: RpgCastMember | null): string {
  if (node.kind === 'camp') return node.id === 'start' ? 'Starting camp' : node.id === 'final-camp' ? 'Last camp' : `${RPG_STAGE_NAMES[node.stage]} camp`
  if (node.kind === 'sub-boss') return node.route ? `${node.route.spec.name} vanguard · ${lead!.name}` : `${lead!.name}'s squad`
  if (node.kind === 'boss') return `${node.route!.spec.name} champion · ${lead!.name}`
  return pick(FIGHT_NAMES, `${node.id}:name`)
}

/** Deterministic for a scenario and cast; node ids stay stable across rebalances. */
export function rpgCampaignChapter(scenarioId: string, cast: readonly RpgCastMember[]): RpgCampaignChapter {
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)
  if (!scenario) throw new RangeError(`Unknown scenario ${scenarioId}`)
  if (!cast.length) throw new RangeError('The campaign needs a cast')
  const sorted = [...cast].sort((a, b) => a.id.localeCompare(b.id))
  const levelStart = rpgChapterLevelStart(scenario.tier)
  const nodes = layout(levelStart, scenario.id, scenario.tier).map(({ route, ...node }) => {
    const { enemies, lead } = foes(scenario.id, { ...node, route }, sorted, rpgChapterReach(levelStart))
    return { ...node, name: nodeName({ ...node, route }, lead), note: route?.spec.line ?? null, enemies }
  })
  return { id: scenario.id, scenarioId: scenario.id, tier: scenario.tier, title: scenario.name, levelStart,
    rows: Math.max(...nodes.map((n) => n.row)) + 1, nodes }
}

export function rpgCampaign(cast: readonly RpgCastMember[]): RpgCampaignChapter[] {
  return SCENARIOS.map((s) => rpgCampaignChapter(s.id, cast))
}

export function rpgNodeParents(chapter: RpgCampaignChapter, nodeId: string): string[] {
  return chapter.nodes.filter((n) => n.exits.includes(nodeId)).map((n) => n.id)
}
