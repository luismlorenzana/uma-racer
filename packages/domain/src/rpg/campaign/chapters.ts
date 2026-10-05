// One generated campaign chapter per scenario: a top-to-bottom map of fights, camps, sub-bosses and five
// elemental final bosses (docs/design/uma-rpg.md#chapters, D262). Layout and numbers are code; the private pack only
// supplies the cast (names and portraits).
import { SCENARIOS } from '../../scenarios'
import { RPG_ELEMENTS, type RpgElement } from '../rules'
import type { BattleEnemy } from '../battle/types'
import { RPG_FOE_ROLES, rpgFoe, type RpgFoeRole } from './enemies'

export const RPG_CAMPAIGN_VERSION = 1
export const RPG_CHAPTER_LEVELS = 10
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
  enemies: BattleEnemy[]
  exits: string[]
}
export interface RpgCampaignChapter {
  id: string
  scenarioId: string
  tier: number
  title: string
  /** Lifetime level band: first fights at `levelStart`, final bosses at `levelStart + 10`. */
  levelStart: number
  rows: number
  nodes: RpgMapNode[]
}

export const RPG_STAGE_NAMES = ['Debut', 'Classic', 'Senior', 'Finals'] as const
const FIGHT_NAMES = ['Skirmish', 'Rival team', 'Ambush', 'Patrol', 'Sparring match', 'Practice bout', 'Road block', 'Challenge']
const ROUTE_NAME: Readonly<Record<RpgElement, string>> = { fire: 'Ember', ice: 'Frost', lightning: 'Storm', light: 'Dawn', dark: 'Dusk' }

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

interface Layout { id: string; row: number; col: number; kind: RpgMapNodeKind; level: number; stage: number; element: RpgElement | null; exits: string[] }

function layout(start: number, scenarioTier: number): Layout[] {
  const nodes: Layout[] = []
  let row = 0
  const add = (n: Omit<Layout, 'exits' | 'row'>): Layout => { const node = { ...n, row, exits: [] }; nodes.push(node); return node }
  let previous: Layout[] = [add({ id: 'start', col: 2, kind: 'camp', level: start, stage: 0, element: null })]
  row += 1
  const link = (from: Layout[], to: Layout[]) => {
    for (const a of from) {
      const near = to.filter((b) => Math.abs(b.col - a.col) <= 1)
      a.exits.push(...(near.length && from.length > 1 && to.length > 1 ? near : to).map((b) => b.id))
    }
  }
  for (let stage = 0; stage < RPG_STAGE_NAMES.length; stage += 1) {
    const pattern = stage % 2 === 0 ? [3, 2, 3, 2] : [2, 3, 2, 3]
    pattern.forEach((count, index) => {
      const cols = count === 3 ? [1, 2, 3] : [1, 3]
      const level = start + 2 * stage + (index < 2 ? 0 : 1)
      const current = cols.map((col) => add({ id: `a${stage + 1}r${index + 1}c${col}`, col, kind: 'fight', level, stage, element: null }))
      link(previous, current)
      previous = current
      row += 1
    })
    const camp = add({ id: `a${stage + 1}camp`, col: 2, kind: 'camp', level: start + 2 * stage + 1, stage, element: null })
    link(previous, [camp]); row += 1
    const element = RPG_ELEMENTS[(scenarioTier + stage * 2) % RPG_ELEMENTS.length]!
    const boss = add({ id: `a${stage + 1}boss`, col: 2, kind: 'sub-boss', level: start + 2 * stage + 2, stage, element })
    link([camp], [boss]); row += 1
    previous = [boss]
  }
  const last = add({ id: 'final-camp', col: 2, kind: 'camp', level: start + 9, stage: 4, element: null })
  link(previous, [last]); row += 1
  const routes = RPG_ELEMENTS.map((element, col) => ({ element, col }))
  let routeRow = routes.map(({ element, col }) => add({ id: `${element}-1`, col, kind: 'fight', level: start + 9, stage: 4, element }))
  last.exits.push(...routeRow.map((n) => n.id)); row += 1
  const second = routes.map(({ element, col }) => add({ id: `${element}-2`, col, kind: 'fight', level: start + 9, stage: 4, element }))
  routeRow.forEach((n, i) => n.exits.push(second[i]!.id)); routeRow = second; row += 1
  const bosses = routes.map(({ element, col }) => add({ id: `${element}-boss`, col, kind: 'boss', level: start + RPG_CHAPTER_LEVELS, stage: 4, element }))
  routeRow.forEach((n, i) => n.exits.push(bosses[i]!.id))
  return nodes
}

function foes(chapterId: string, node: Layout, cast: readonly RpgCastMember[]): { enemies: BattleEnemy[]; lead: RpgCastMember | null } {
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
  const regular = (slot: number, element: RpgElement, role?: RpgFoeRole): BattleEnemy => {
    const member = castFor(slot)
    return rpgFoe({ id: `foe${slot + 1}`, castId: member.id, element, rank: 'regular', level: node.level,
      role: role ?? pick(RPG_FOE_ROLES, `${chapterId}:${node.id}:${slot}:role`) })
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
  // Leaders rotate through the cast: each stage and each champion route shows a different face where possible.
  const leadIndex = (hash(`${chapterId}:leads`) + (node.kind === 'boss' ? 4 + RPG_ELEMENTS.indexOf(element) : node.stage)) % cast.length
  const boss = cast[leadIndex]!
  used.add(boss.id)
  const minions = node.kind === 'boss' ? 2 : node.stage < 2 ? 1 : 2
  const enemies = [rpgFoe({ id: 'foe1', castId: boss.id, element, rank: node.kind === 'boss' ? 'boss' : 'sub-boss',
    level: node.level, role: node.kind === 'boss' ? 'champion' : 'captain' }),
  ...Array.from({ length: minions }, (_, i) => regular(i + 1, others(element, i + 1)))]
  return { enemies, lead: boss }
}

function nodeName(node: Layout, lead: RpgCastMember | null): string {
  if (node.kind === 'camp') return node.id === 'start' ? 'Starting camp' : node.id === 'final-camp' ? 'Last camp' : `${RPG_STAGE_NAMES[node.stage]} camp`
  if (node.kind === 'sub-boss') return `${lead!.name}'s squad`
  if (node.kind === 'boss') return `${ROUTE_NAME[node.element!]} champion · ${lead!.name}`
  if (node.element) return `${ROUTE_NAME[node.element]} road`
  return pick(FIGHT_NAMES, `${node.id}:name`)
}

/** Deterministic for a scenario and cast; node ids stay stable across rebalances. */
export function rpgCampaignChapter(scenarioId: string, cast: readonly RpgCastMember[]): RpgCampaignChapter {
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)
  if (!scenario) throw new RangeError(`Unknown scenario ${scenarioId}`)
  if (!cast.length) throw new RangeError('The campaign needs a cast')
  const sorted = [...cast].sort((a, b) => a.id.localeCompare(b.id))
  const levelStart = rpgChapterLevelStart(scenario.tier)
  const nodes = layout(levelStart, scenario.tier).map((node) => {
    const { enemies, lead } = foes(scenario.id, node, sorted)
    return { ...node, name: nodeName(node, lead), enemies }
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
