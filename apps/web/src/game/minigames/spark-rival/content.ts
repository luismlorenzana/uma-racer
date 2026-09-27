// Private roster selection and deterministic catalogue fallback
// (docs/design/minigames.md#spark-match--rival-circuit).
import {
  SPARK_RIVAL_STYLE_RECIPES,
  sparkRivalBestStrategy,
  type Grade,
  type SparkRivalRecipeId,
  type SparkRivalRosterCandidate,
  type SparkRivalScenarioRoster,
  type Strategy,
  type UmaTemplate,
} from '@racer/domain'
import { sparkShuffle, sparkSeed } from './rng'
import { sparkRivalDefinition } from './recipes'
import { parseSparkRivalEncounter, type SparkRivalEncounterV1 } from './types'

export type SparkRivalRosterReason = 'missing-pack' | 'tier-missing' | 'roster-exhausted'

export interface SparkRivalRosterDiagnostic {
  source: 'authored' | 'fallback'
  reason: SparkRivalRosterReason | null
  severe: boolean
}

export interface SelectedSparkRival {
  templateId: string | null
  charaId: string | null
  label: string
  strategy: Strategy
  recipe: SparkRivalRecipeId
}

export interface SparkEncounterSelection {
  ordinary: readonly [SelectedSparkRival, SelectedSparkRival]
  boss: SelectedSparkRival
  diagnostic: SparkRivalRosterDiagnostic
}

const recipeForStrategy = (strategy: Strategy): SparkRivalRecipeId => {
  const entry = Object.entries(SPARK_RIVAL_STYLE_RECIPES)
    .find(([, required]) => required === strategy)
  if (!entry) throw new Error('Spark Rival has no base recipe for strategy')
  return entry[0] as SparkRivalRecipeId
}

function shuffled<T>(items: readonly T[], seed: string, stream: string, key: (item: T) => string): T[] {
  const ordered = [...items].sort((left, right) => key(left).localeCompare(key(right)))
  return sparkShuffle(ordered, sparkSeed(seed, stream)).items
}

function distinctCharacters<T>(items: readonly T[], character: (item: T) => string): T[] {
  const used = new Set<string>()
  return items.filter((item) => {
    const id = character(item)
    if (used.has(id)) return false
    used.add(id)
    return true
  })
}

function selected(candidate: SparkRivalRosterCandidate, catalogue: ReadonlyMap<string, UmaTemplate>): SelectedSparkRival | null {
  const template = catalogue.get(candidate.templateId)
  if (!template || template.charaId !== candidate.charaId || sparkRivalBestStrategy(template.aptitudes.strategy) !== candidate.strategy) return null
  return {
    templateId: template.id,
    charaId: template.charaId,
    label: template.name,
    strategy: candidate.strategy,
    recipe: candidate.recipe,
  }
}

function authoredSelection(
  roster: SparkRivalScenarioRoster,
  catalogue: readonly UmaTemplate[],
  traineeCharacter: string,
  seed: string,
): SparkEncounterSelection | null {
  const byId = new Map(catalogue.map((uma) => [uma.id, uma]))
  const bossPool = distinctCharacters(
    shuffled(roster.bosses, seed, `tier:${roster.tier}:boss`, (candidate) => `${candidate.charaId}:${candidate.templateId}`),
    (candidate) => candidate.charaId,
  ).filter((candidate) => candidate.charaId !== traineeCharacter)
  const boss = bossPool.map((candidate) => selected(candidate, byId)).find((candidate) => candidate !== null)
  if (!boss?.charaId) return null

  const ordinaryPool = distinctCharacters(
    shuffled(roster.ordinary, seed, `tier:${roster.tier}:ordinary`, (candidate) => `${candidate.charaId}:${candidate.templateId}`),
    (candidate) => candidate.charaId,
  ).filter((candidate) => candidate.charaId !== traineeCharacter && candidate.charaId !== boss.charaId)
    .map((candidate) => selected(candidate, byId))
    .filter((candidate): candidate is SelectedSparkRival => candidate !== null)
  if (ordinaryPool.length < 2) return null
  return {
    ordinary: [ordinaryPool[0]!, ordinaryPool[1]!],
    boss,
    diagnostic: { source: 'authored', reason: null, severe: false },
  }
}

function fallbackSelection(
  catalogue: readonly UmaTemplate[],
  traineeCharacter: string,
  tier: number,
  seed: string,
  reason: SparkRivalRosterReason,
): SparkEncounterSelection {
  const candidates = distinctCharacters(
    shuffled(
      catalogue.filter((uma) => uma.charaId !== traineeCharacter),
      seed,
      `tier:${tier}:catalogue-fallback`,
      (uma) => `${uma.charaId}:${uma.id}`,
    ),
    (uma) => uma.charaId,
  )
  if (candidates.length >= 3) {
    const bossTemplate = candidates[0]!
    const ordinaryTemplates = [candidates[1]!, candidates[2]!] as const
    const fromTemplate = (template: UmaTemplate, recipe: SparkRivalRecipeId): SelectedSparkRival => ({
      templateId: template.id,
      charaId: template.charaId,
      label: template.name,
      strategy: sparkRivalBestStrategy(template.aptitudes.strategy),
      recipe,
    })
    return {
      ordinary: ordinaryTemplates.map((template) => {
        const strategy = sparkRivalBestStrategy(template.aptitudes.strategy)
        return fromTemplate(template, recipeForStrategy(strategy))
      }) as unknown as [SelectedSparkRival, SelectedSparkRival],
      boss: fromTemplate(bossTemplate, 'circuit-boss'),
      diagnostic: { source: 'fallback', reason, severe: false },
    }
  }

  const strategies: readonly Strategy[] = ['front', 'pace', 'late']
  const silhouettes = strategies.map((strategy, index): SelectedSparkRival => ({
    templateId: null,
    charaId: null,
    label: index === 2 ? 'Circuit Captain' : `Training Rival ${index + 1}`,
    strategy,
    recipe: index === 2 ? 'circuit-boss' : recipeForStrategy(strategy),
  }))
  return {
    ordinary: [silhouettes[0]!, silhouettes[1]!],
    boss: silhouettes[2]!,
    diagnostic: { source: 'fallback', reason: 'roster-exhausted', severe: true },
  }
}

/** Same inputs always choose the same no-self, no-duplicate three-wave lineup. */
export function selectSparkEncounter(
  rosters: readonly SparkRivalScenarioRoster[] | null,
  catalogue: readonly UmaTemplate[],
  traineeCharacter: string,
  tier: number,
  seed: string,
): SparkEncounterSelection {
  const roster = rosters?.find((candidate) => candidate.tier === tier) ?? null
  if (roster) {
    const authored = authoredSelection(roster, catalogue, traineeCharacter, seed)
    if (authored) return authored
    return fallbackSelection(catalogue, traineeCharacter, tier, seed, 'roster-exhausted')
  }
  return fallbackSelection(catalogue, traineeCharacter, tier, seed, rosters === null ? 'missing-pack' : 'tier-missing')
}

/** Builds the complete replay snapshot after the runtime has reserved a run and knows its Training Level. */
export function buildSparkRivalEncounter(
  selection: SparkEncounterSelection,
  trainee: UmaTemplate,
  tier: number,
  trainingLevel: number,
  strategyAptitudes: Readonly<Record<Strategy, Grade>> = trainee.aptitudes.strategy,
): SparkRivalEncounterV1 {
  const rivals = [...selection.ordinary, selection.boss] as const
  const waves = rivals.map((rival, index) => sparkRivalDefinition({
    id: rival.templateId ?? `synthetic-silhouette-${index + 1}`,
    label: rival.label,
    recipe: rival.recipe,
    strategy: rival.strategy,
    wave: index as 0 | 1 | 2,
    scenarioTier: tier,
    trainingLevel,
    traineeAptitudes: strategyAptitudes,
  })) as unknown as SparkRivalEncounterV1['waves']
  const encounter: SparkRivalEncounterV1 = {
    version: 1,
    scenarioTier: tier,
    trainingLevel,
    trainee: {
      templateId: trainee.id,
      label: trainee.name,
      strategyAptitudes,
    },
    waves,
  }
  const parsed = parseSparkRivalEncounter(encounter)
  if (!parsed) throw new Error('Selected Spark Rival encounter did not satisfy the engine contract')
  return parsed
}
