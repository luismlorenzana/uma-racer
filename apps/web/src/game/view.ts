// Save/content joins and Stable derivations (docs/tasks/T003-stable-save-foundation.md).

import {
  baselineStatCap,
  expToNextUmaLevel,
  isGateLevel,
  LEVELS_PER_SCENARIO,
  SCENARIOS,
  scenarioForTier,
  spCap,
  statCap,
  tierOfLevel,
  type DistanceCategory,
  type ScenarioDef,
  type Strategy,
  type Surface,
  type UmaSave,
  type UmaTemplate,
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
  tier: number
  scenario: ScenarioDef | undefined
  currentStatCap: number
  baselineStatCap: number
  currentSpCap: number
  expToNext: number
  readyToPromote: boolean
}

export type UmaJoinResult =
  | { status: 'ready'; value: UmaViewModel }
  | { status: 'missing-content'; templateId: string }

export function joinUma(save: UmaSave, content: LoadedContent): UmaJoinResult {
  const template = content.umas.byId.get(save.templateId)
  if (!template) return { status: 'missing-content', templateId: save.templateId }
  const tier = tierOfLevel(save.level)
  const expToNext = expToNextUmaLevel(save.level)
  const finalLevel = save.level >= SCENARIOS.length * LEVELS_PER_SCENARIO
  return {
    status: 'ready',
    value: {
      save,
      template,
      asset: umaAsset(content, save.templateId),
      tier,
      scenario: scenarioForTier(tier),
      currentStatCap: statCap(tier, save.trainingLevel),
      baselineStatCap: baselineStatCap(tier),
      currentSpCap: spCap(tier, save.trainingLevel),
      expToNext,
      readyToPromote: save.scenarioStarted && isGateLevel(save.level) && !finalLevel,
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
    if (filters.surface && !highAptitude(uma.save.aptitudes.surface[filters.surface])) return false
    if (filters.distance && !highAptitude(uma.save.aptitudes.distance[filters.distance])) return false
    if (filters.strategy && !highAptitude(uma.save.aptitudes.strategy[filters.strategy])) return false
    return !filters.ready || uma.readyToPromote
  })
  return [...filtered].sort((left, right) => {
    const idOrder = left.save.templateId.localeCompare(right.save.templateId)
    if (sort === 'uma-level') return right.save.level - left.save.level || idOrder
    if (sort === 'training-level') return right.save.trainingLevel - left.save.trainingLevel || idOrder
    return left.template.name.localeCompare(right.template.name) || idOrder
  })
}
