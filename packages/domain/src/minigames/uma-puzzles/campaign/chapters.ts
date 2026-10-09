// Code-authored stage line (v2, D301) or the frozen-fight v1 two-lane DAG; no save seed, private cast or RPG math
// (docs/design/uma-puzzles.md §6).
import { SCENARIOS } from '../../../scenarios'
import { validatePuzzleRegistry, type PuzzleScenarioRegistry } from '../materials'
import { PUZZLE_ELEMENTS } from '../types'
import { puzzleSafe, requirePuzzle } from '../validation'
import { puzzleCampaignId } from './identity'
import { PUZZLE_CAMPAIGN_V1, PUZZLE_CAMPAIGN_VERSION, PUZZLE_CHAPTER_LEVELS, PUZZLE_CHAMPION_LEVEL, PUZZLE_GUARDIAN_LEVELS,
  PUZZLE_REGULAR_LEVELS, PUZZLE_SQUAD_MIXES, type PuzzleCampaignVersion, type PuzzleFoeRole } from './rules'
import type { PuzzleChapter, PuzzleMapNode } from './types'

/**
 * Stage `o{pair}{a|b}` has the same level, trio, roles and opening rule in both versions, so any v1 progress is v2
 * progress. v2 lists the stages in one line, a level's two stages opening together once either stage of the level
 * before is won (v1's lanes), and drops v1's tenth pair (D301, D304).
 */
export function puzzleChapter(scenarioId: string, registry: PuzzleScenarioRegistry = SCENARIOS,
  version: PuzzleCampaignVersion = PUZZLE_CAMPAIGN_VERSION): PuzzleChapter {
  validatePuzzleRegistry(registry)
  requirePuzzle(version === 1 || version === 2, 'invalid', 'Unknown Puzzle campaign version')
  const index = registry.findIndex(s => s.id === scenarioId), scenario = registry[index]
  requirePuzzle(scenario, 'unknown', 'Unknown Puzzle chapter')
  const levelStart = puzzleSafe((scenario.tier - 1) * PUZZLE_CHAPTER_LEVELS + 1, 'Chapter start')
  const nodeId = (localId: string) => puzzleCampaignId({ kind: 'node', scenarioId, localId }, registry)
  const nodes: PuzzleMapNode[] = [], guardians: string[] = []
  // Pair levels per section: v2 runs two stages per level; v1 rows are its two lanes.
  const pairs: readonly (readonly number[])[] = version === 1 ? PUZZLE_CAMPAIGN_V1.regularLevels : PUZZLE_REGULAR_LEVELS.map(levels => levels.filter((_, i) => i % 2 === 0))
  let row = 0, pair = 0, previous: string[] = []
  const specialRoles: PuzzleFoeRole[] = ['striker', 'healer', 'guard', 'converter', 'ward', 'striker']
  const stage = (sector: number, recommended: number, branch: number): PuzzleMapNode => {
    const localId = `o${pair}${branch === 0 ? 'a' : 'b'}`
    // Cycles all six combinations in both lanes; neither lane has a fixed rare side or pair.
    const mix = (pair - 1 + branch * 3 + index) % PUZZLE_SQUAD_MIXES.length
    return { id: nodeId(localId), localId, row, column: version === 1 ? branch : 0, sector, kind: 'ordinary',
      level: puzzleSafe(levelStart + recommended - 1, 'Encounter level'), elements: [...PUZZLE_SQUAD_MIXES[mix]!],
      roles: ['striker', 'striker', specialRoles[(pair - 1 + branch + index) % specialRoles.length]!],
      darkStyle: PUZZLE_SQUAD_MIXES[mix]![0] === 'dark' ? 'late' : null,
      requires: previous.length ? [[...previous]] : [], exits: [] }
  }
  const link = (current: PuzzleMapNode[]) => {
    for (const parent of previous) nodes.find(n => n.id === parent)!.exits = current.map(n => n.id)
    nodes.push(...current); previous = current.map(n => n.id)
  }
  for (let sector = 0; sector < pairs.length; sector++) {
    for (const recommended of pairs[sector]!) {
      pair++
      const current = [0, 1].map(branch => stage(sector, recommended, branch))
      // v2 lists the pair as two rows of one column; both still open together.
      if (version === 2) current[1] = { ...current[1]!, row: row + 1 }
      link(current); row += version === 1 ? 1 : 2
    }
    const localId = `g${sector + 1}`, id = nodeId(localId)
    const guardian: PuzzleMapNode = { id, localId, row, column: 0, sector, kind: 'guardian',
      level: puzzleSafe(levelStart + PUZZLE_GUARDIAN_LEVELS[sector]! - 1, 'Guardian level'),
      elements: [PUZZLE_ELEMENTS[(index + sector * 2) % PUZZLE_ELEMENTS.length]!],
      roles: [(['guard', 'converter', 'ward'] as const)[sector]!],
      darkStyle: PUZZLE_ELEMENTS[(index + sector * 2) % PUZZLE_ELEMENTS.length] === 'dark' ? 'late' : null,
      requires: [[...previous]], exits: [] }
    link([guardian]); guardians.push(id); row++
  }
  const champions = PUZZLE_ELEMENTS.map((element, column): PuzzleMapNode => ({ id: nodeId(`c-${element}`), localId: `c-${element}`,
    row, column, sector: 3, kind: 'champion', level: puzzleSafe(levelStart + PUZZLE_CHAMPION_LEVEL - 1, 'Champion level'),
    elements: [element], roles: ['champion'], darkStyle: null, requires: guardians.map(g => [g]), exits: [] }))
  nodes.find(n => n.id === previous[0])!.exits = champions.map(n => n.id); nodes.push(...champions)
  return { schemaVersion: 1, id: puzzleCampaignId({ kind: 'chapter', scenarioId }, registry), scenarioId, tier: scenario.tier,
    name: scenario.name, levelStart, levelEnd: puzzleSafe(levelStart + PUZZLE_CHAPTER_LEVELS - 1, 'Chapter end'), nodes }
}
export function puzzleCampaign(registry: PuzzleScenarioRegistry = SCENARIOS): PuzzleChapter[] {
  validatePuzzleRegistry(registry)
  return registry.map(s => puzzleChapter(s.id, registry))
}
