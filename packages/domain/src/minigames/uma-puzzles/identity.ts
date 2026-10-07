// Literal source-A enrollment, independent of racing builds (docs/design/uma-puzzles.md §§3–4).
import type { UmaTemplate } from '../../content'
import { DISTANCE_CATEGORIES, GRADES, STATS, STRATEGIES, SURFACES, type Aptitudes, type Stats, type Strategy } from '../../types'
import { PUZZLE_RULES_VERSION, PUZZLE_SCHEMA_VERSION } from './rules'
import { PUZZLE_ELEMENTS, type PuzzleElement, type PuzzleEnrollmentV1, type PuzzleSourceV1 } from './types'
import { nextPuzzleLevelExp, parsePuzzleProgress, puzzleStats } from './progression'
import { puzzleExact, puzzleId, puzzleInteger, puzzleRecord, requirePuzzle } from './validation'

const stats = (v: unknown, growth: boolean): v is Stats => puzzleRecord(v) && puzzleExact(v, STATS) &&
  STATS.every(k => growth ? typeof v[k] === 'number' && Number.isFinite(v[k]) && v[k] >= 0 && v[k] <= 1 : puzzleInteger(v[k]))
function parseAptitudes(v: unknown): Aptitudes | null {
  if (!puzzleRecord(v) || !puzzleExact(v, ['surface', 'distance', 'strategy'])) return null
  for (const [key, names] of [['surface', SURFACES], ['distance', DISTANCE_CATEGORIES], ['strategy', STRATEGIES]] as const) {
    const grades = v[key]
    if (!puzzleRecord(grades) || !puzzleExact(grades, names) || names.some(k => !GRADES.includes(grades[k] as never))) return null
  }
  return structuredAptitudes(v as unknown as Aptitudes)
}
const structuredAptitudes = (v: Aptitudes): Aptitudes =>
  ({ surface: { ...v.surface }, distance: { ...v.distance }, strategy: { ...v.strategy } })
export function parsePuzzleSource(v: unknown): PuzzleSourceV1 | null {
  if (!puzzleRecord(v) || !puzzleExact(v, ['schemaVersion', 'rulesVersion', 'templateId', 'contentVersion', 'baseStats', 'growthRates', 'aptitudes']) ||
    v.schemaVersion !== PUZZLE_SCHEMA_VERSION || v.rulesVersion !== PUZZLE_RULES_VERSION ||
    !puzzleId(v.templateId) || !puzzleId(v.contentVersion) || !stats(v.baseStats, false) || !stats(v.growthRates, true)) return null
  const aptitudes = parseAptitudes(v.aptitudes)
  return aptitudes ? { schemaVersion: 1, rulesVersion: 1, templateId: v.templateId, contentVersion: v.contentVersion,
    baseStats: { ...v.baseStats }, growthRates: { ...v.growthRates }, aptitudes } : null
}
/** Explicit unit selection avoids guessing whether 0.2 means 0.2% or 20%. Raw percentages must all be integers. */
export function createPuzzleSource(template: Pick<UmaTemplate, 'id' | 'baseStats' | 'growthRates' | 'aptitudes'>,
  contentVersion: string, growthUnit: 'fraction' | 'percent' = 'fraction'): PuzzleSourceV1 {
  requirePuzzle(growthUnit === 'fraction' || growthUnit === 'percent', 'invalid', 'Unknown growth unit')
  requirePuzzle(puzzleRecord(template.growthRates) && puzzleExact(template.growthRates, STATS), 'invalid', 'Invalid growths')
  if (growthUnit === 'percent') requirePuzzle(STATS.every(k => puzzleInteger(template.growthRates[k], 0, 100)),
    'invalid', 'Percentage growths must be whole percentages; mixed units are not accepted')
  const growthRates = Object.fromEntries(STATS.map(k => [k, template.growthRates[k] / (growthUnit === 'percent' ? 100 : 1)])) as Stats
  const source = parsePuzzleSource({ schemaVersion: 1, rulesVersion: 1, templateId: template.id, contentVersion,
    baseStats: template.baseStats, growthRates, aptitudes: template.aptitudes })
  requirePuzzle(source, 'invalid', 'Invalid Puzzle catalogue source')
  return source
}
export function eligiblePuzzleStyles(source: PuzzleSourceV1): Strategy[] {
  requirePuzzle(parsePuzzleSource(source), 'invalid', 'Invalid frozen source')
  return STRATEGIES.filter(k => source.aptitudes.strategy[k] === 'A')
}
export function eligiblePuzzleElements(source: PuzzleSourceV1): PuzzleElement[] {
  const styles = eligiblePuzzleStyles(source)
  if (!styles.length) return []
  if (source.aptitudes.surface.dirt === 'A') return [...PUZZLE_ELEMENTS]
  const set = styles.join(',')
  if (set === 'front' || set === 'front,pace') return ['light']
  if (set === 'end' || set === 'late,end') return ['dark']
  return ['fire', 'water', 'wood']
}
export function parsePuzzleEnrollment(v: unknown): PuzzleEnrollmentV1 | null {
  if (!puzzleRecord(v) || !puzzleExact(v, ['schemaVersion', 'source', 'eligibleElements', 'element', 'level', 'exp', 'firstBattleId']) ||
    v.schemaVersion !== 1 || !Array.isArray(v.eligibleElements) || v.eligibleElements.length > PUZZLE_ELEMENTS.length ||
    !v.eligibleElements.every(e => PUZZLE_ELEMENTS.includes(e as PuzzleElement)) ||
    !PUZZLE_ELEMENTS.includes(v.element as PuzzleElement) || !(v.firstBattleId === null || puzzleId(v.firstBattleId))) return null
  const source = parsePuzzleSource(v.source), progress = parsePuzzleProgress({ level: v.level, exp: v.exp })
  if (!source || !progress) return null
  const eligibleElements = eligiblePuzzleElements(source)
  if (!eligibleElements.length || eligibleElements.join(',') !== v.eligibleElements.join(',') || !eligibleElements.includes(v.element as PuzzleElement)) return null
  try { puzzleStats(source, progress.level); nextPuzzleLevelExp(progress.level) } catch { return null }
  return { schemaVersion: 1, source, eligibleElements, element: v.element as PuzzleElement, ...progress, firstBattleId: v.firstBattleId }
}
export function enrollPuzzleOutfit(source: PuzzleSourceV1, element: PuzzleElement): PuzzleEnrollmentV1 {
  requirePuzzle(eligiblePuzzleStyles(source).length, 'locked', 'No original A running style: enrollment unavailable')
  const enrollment = parsePuzzleEnrollment({ schemaVersion: 1, source, eligibleElements: eligiblePuzzleElements(source),
    element, level: 1, exp: 0, firstBattleId: null })
  requirePuzzle(enrollment, 'invalid', 'Ineligible element or invalid enrollment source')
  return enrollment
}
export function correctPuzzleElement(profile: PuzzleEnrollmentV1, element: PuzzleElement): PuzzleEnrollmentV1 {
  const parsed = parsePuzzleEnrollment(profile)
  requirePuzzle(parsed, 'invalid', 'Invalid enrollment')
  requirePuzzle(parsed.firstBattleId === null, 'locked', 'Element locked by first battle entry')
  requirePuzzle(parsed.eligibleElements.includes(element), 'invalid', 'Ineligible element')
  return { ...parsed, element }
}
export function enterFirstPuzzleBattle(profile: PuzzleEnrollmentV1, battleId: string): PuzzleEnrollmentV1 {
  const parsed = parsePuzzleEnrollment(profile)
  requirePuzzle(parsed && puzzleId(battleId), 'invalid', 'Invalid enrollment or battle id')
  return parsed.firstBattleId ? parsed : { ...parsed, firstBattleId: battleId }
}
