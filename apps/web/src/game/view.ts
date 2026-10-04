import {
  activeScenario,
  capProfile,
  deriveUma,
  expToNextUmaLevel,
  awaitingAdvance,
  LEVELS_PER_SCENARIO,
  SCENARIOS,
  skillPointCap,
  scenarioForTier,
  tierOfLevel,
  trainedScenario,
  type CardSave,
  type DerivedUma,
  type DistanceCategory,
  type ScenarioDef,
  type ScenarioTraining,
  type Stats,
  type Strategy,
  type Surface,
  type UmaSave,
  type UmaTemplate,
  DISTANCE_CATEGORIES,
  type Grade,
} from '@racer/domain'
import type { ContentAsset, LoadedContent } from '../content/runtime'

function umaAsset(content: LoadedContent, id: string): ContentAsset | null {
  const atlas = content.atlases['uma-icons']
  const frame = atlas.descriptor.frames[id]
  if (!frame) return null
  const page = atlas.descriptor.pages[frame.page]
  const url = atlas.pageUrls[frame.page]
  return page && url ? { url, frame, pageWidth: page.width, pageHeight: page.height } : null
}

export interface UmaViewModel {
  save: UmaSave
  template: UmaTemplate
  asset: ContentAsset | null
  /** The scenario shown: her current one unless another of her trained units was asked for (D190). */
  tier: number
  scenario: ScenarioDef | undefined
  /** That scenario's run. */
  run: ScenarioTraining
  /** True when `tier` is one of her earlier scenarios rather than her current one. */
  past: boolean
  /** Stats, skills and aptitudes, recomputed from the constellation (D121). */
  derived: DerivedUma
  /** Per-stat caps for this scenario. */
  caps: Stats
  spCap: number
  expToNext: number
  readyToAdvance: boolean
}

export type UmaJoinResult =
  | { status: 'ready'; value: UmaViewModel }
  | { status: 'missing-content'; templateId: string }

/**
 * Joins a save to content and derives everything the UI reads. Card saves are needed because stats now come
 * from the constellation, not from the save.
 */
/**
 * Her aptitude at each distance, read through that distance's own preset (D252): what each preset button hints, since a
 * preset's parents can lift the distance it is built for.
 */
export function presetDistanceGrades(
  save: UmaSave,
  content: LoadedContent,
  cardSaves: Readonly<Record<string, CardSave>>,
  tier?: number,
): Record<DistanceCategory, Grade> {
  const grades = {} as Record<DistanceCategory, Grade>
  for (const preset of DISTANCE_CATEGORIES) {
    const joined = joinUma(save, content, cardSaves, tier, preset)
    if (joined.status !== 'ready') throw new Error(`Uma ${save.templateId} has no content`)
    grades[preset] = joined.value.derived.aptitudes.distance[preset]
  }
  return grades
}

export function joinUma(
  save: UmaSave,
  content: LoadedContent,
  cardSaves: Readonly<Record<string, CardSave>> = {},
  requestedTier?: number,
  /** A distance preset to join instead of her selected one (D252), such as a race's. */
  requestedPreset?: DistanceCategory,
): UmaJoinResult {
  const template = content.umas.byId.get(save.templateId)
  if (!template) return { status: 'missing-content', templateId: save.templateId }
  const tier = requestedTier !== undefined && save.scenarios.some((run) => run.tier === requestedTier) ? requestedTier : save.unlockedTier
  const finalLevel = save.level >= SCENARIOS.length * LEVELS_PER_SCENARIO
  const preset = requestedPreset ?? save.activePreset
  const derived = deriveUma({
    uma: save,
    tier,
    preset,
    umaTemplate: template,
    cardSaves: new Map(Object.entries(cardSaves)),
    cardTemplates: content.cards.byId,
    umaTemplates: content.umas.byId,
    skillTemplates: content.skills.byId,
  })
  return {
    status: 'ready',
    value: {
      save,
      template,
      asset: umaAsset(content, save.templateId),
      tier,
      scenario: scenarioForTier(tier),
      run: trainedScenario(save, tier, preset),
      past: tier < save.unlockedTier,
      derived,
      caps: capProfile(tier),
      spCap: skillPointCap(tier),
      expToNext: expToNextUmaLevel(save.level),
      readyToAdvance: activeScenario(save).started && awaitingAdvance(save)
        && tierOfLevel(save.level) === save.unlockedTier && !finalLevel,
    },
  }
}

export type UmaSort = 'name' | 'uma-level' | 'training-level'

export interface UmaFilters {
  tier: number | null
  surface: Surface | null
  distance: DistanceCategory | null
  strategy: Strategy | null
  ready: boolean
}

export const EMPTY_UMA_FILTERS: UmaFilters = {
  tier: null,
  surface: null,
  distance: null,
  strategy: null,
  ready: false,
}

const highAptitude = (grade: string) => grade === 'S' || grade === 'A'

export function filterAndSortUmas(
  umas: readonly UmaViewModel[],
  filters: UmaFilters,
  sort: UmaSort,
): UmaViewModel[] {
  const filtered = umas.filter((uma) => {
    if (filters.tier !== null && uma.tier !== filters.tier) return false
    if (filters.surface && !highAptitude(uma.derived.aptitudes.surface[filters.surface])) return false
    if (filters.distance && !highAptitude(uma.derived.aptitudes.distance[filters.distance])) return false
    if (filters.strategy && !highAptitude(uma.derived.aptitudes.strategy[filters.strategy])) return false
    return !filters.ready || uma.readyToAdvance
  })
  return [...filtered].sort((left, right) => {
    const idOrder = left.save.templateId.localeCompare(right.save.templateId)
    if (sort === 'uma-level') return right.save.level - left.save.level || idOrder
    if (sort === 'training-level') return right.derived.trainingLevel - left.derived.trainingLevel || idOrder
    return left.template.name.localeCompare(right.template.name) || idOrder
  })
}
