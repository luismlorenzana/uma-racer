// Private Spark Rival roster overlay (docs/design/minigames.md#spark-match--rival-circuit).

import {
  SPARK_RIVAL_RECIPES,
  SPARK_RIVAL_STYLE_RECIPES,
  parseSparkRivalContentPack,
  sparkRivalBestStrategy,
  type SparkRivalRecipeId,
  type SparkRivalScenarioRoster,
  type UmaTemplate,
} from '@racer/domain'

const CANDIDATE_LIMIT = 64
const PRIVATE_ID = /^[A-Za-z0-9_.:-]{1,120}$/

interface OverrideCandidate {
  templateId: string
  recipe: SparkRivalRecipeId
}

interface OverrideScenario {
  tier: number
  ordinary: OverrideCandidate[]
  bosses: OverrideCandidate[]
}

export interface SparkRivalCoverage {
  scenarios: number
  ordinaryCandidates: number
  bossCandidates: number
  distinctCharacters: number
  recipeCounts: Record<SparkRivalRecipeId, number>
  failures: number
}

export interface SparkRivalNormalizationResult {
  items: SparkRivalScenarioRoster[]
  warnings: string[]
  coverage: SparkRivalCoverage
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort()
  const sorted = [...expected].sort()
  return keys.length === sorted.length && keys.every((key, index) => key === sorted[index])
}

function emptyRecipeCounts(): Record<SparkRivalRecipeId, number> {
  return Object.fromEntries(SPARK_RIVAL_RECIPES.map((recipe) => [recipe, 0])) as Record<SparkRivalRecipeId, number>
}

function parseCandidate(value: unknown, tier: number, role: 'ordinary' | 'bosses', index: number): OverrideCandidate {
  const location = `tier ${tier} ${role}[${index}]`
  if (!record(value) || !exactKeys(value, ['recipe', 'templateId'])) {
    throw new Error(`Spark rival override has an invalid candidate shape at ${location}`)
  }
  if (typeof value.templateId !== 'string' || !PRIVATE_ID.test(value.templateId)) {
    throw new Error(`Spark rival override has an invalid candidate identity at ${location}`)
  }
  if (!SPARK_RIVAL_RECIPES.includes(value.recipe as SparkRivalRecipeId)) {
    throw new Error(`Spark rival override has an unknown recipe at ${location}`)
  }
  const recipe = value.recipe as SparkRivalRecipeId
  if ((role === 'bosses') !== (recipe === 'circuit-boss')) {
    throw new Error(`Spark rival override has an invalid recipe role at ${location}`)
  }
  return { templateId: value.templateId, recipe }
}

function parseCandidates(value: unknown, tier: number, role: 'ordinary' | 'bosses'): OverrideCandidate[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > CANDIDATE_LIMIT) {
    throw new Error(`Spark rival override has an invalid ${role} count at tier ${tier}`)
  }
  const candidates = value.map((candidate, index) => parseCandidate(candidate, tier, role, index))
  if (new Set(candidates.map((candidate) => candidate.templateId)).size !== candidates.length) {
    throw new Error(`Spark rival override repeats a template in ${role} at tier ${tier}`)
  }
  return candidates
}

function parseScenario(value: unknown, index: number): OverrideScenario {
  if (!record(value) || !exactKeys(value, ['bosses', 'ordinary', 'tier']) ||
    !Number.isSafeInteger(value.tier) || (value.tier as number) < 1 || (value.tier as number) > 14) {
    throw new Error(`Spark rival override has an invalid scenario at index ${index}`)
  }
  const tier = value.tier as number
  return {
    tier,
    ordinary: parseCandidates(value.ordinary, tier, 'ordinary'),
    bosses: parseCandidates(value.bosses, tier, 'bosses'),
  }
}

function parseOverride(value: unknown): OverrideScenario[] {
  if (!record(value) || !exactKeys(value, ['scenarios', 'version']) || value.version !== 1 ||
    !Array.isArray(value.scenarios) || value.scenarios.length !== 14) {
    throw new Error('Spark rival override has an invalid header')
  }
  const scenarios = value.scenarios.map(parseScenario).sort((left, right) => left.tier - right.tier)
  if (new Set(scenarios.map((scenario) => scenario.tier)).size !== 14 ||
    scenarios.some((scenario, index) => scenario.tier !== index + 1)) {
    throw new Error('Spark rival override must cover tiers 1 through 14 exactly once')
  }
  return scenarios
}

export function normalizeSparkRivals(
  umas: readonly UmaTemplate[],
  raw: unknown | null,
): SparkRivalNormalizationResult {
  if (raw === null) {
    return {
      items: [],
      warnings: ['Spark rival override is missing; the optional pack was omitted and catalogue fallback will be used'],
      coverage: {
        scenarios: 0,
        ordinaryCandidates: 0,
        bossCandidates: 0,
        distinctCharacters: 0,
        recipeCounts: emptyRecipeCounts(),
        failures: 0,
      },
    }
  }

  const scenarios = parseOverride(raw)
  const umasById = new Map(umas.map((uma) => [uma.id, uma]))
  const recipeCounts = emptyRecipeCounts()
  const allCharacters = new Set<string>()

  const items = scenarios.map((scenario): SparkRivalScenarioRoster => {
    const join = (candidates: readonly OverrideCandidate[], role: 'ordinary' | 'bosses') =>
      candidates.map((candidate, index) => {
        const uma = umasById.get(candidate.templateId)
        if (!uma) throw new Error(`Spark rival override references an unknown Uma at tier ${scenario.tier} ${role}[${index}]`)
        const strategy = sparkRivalBestStrategy(uma.aptitudes.strategy)
        const requiredStrategy = SPARK_RIVAL_STYLE_RECIPES[candidate.recipe]
        if (requiredStrategy && requiredStrategy !== strategy) {
          throw new Error(`Spark rival override recipe does not match the stable best strategy at tier ${scenario.tier} ${role}[${index}]`)
        }
        recipeCounts[candidate.recipe] += 1
        allCharacters.add(uma.charaId)
        return { templateId: uma.id, charaId: uma.charaId, strategy, recipe: candidate.recipe }
      }).sort((left, right) => left.charaId.localeCompare(right.charaId) || left.templateId.localeCompare(right.templateId))

    const ordinary = join(scenario.ordinary, 'ordinary')
    const bosses = join(scenario.bosses, 'bosses')
    const ordinaryCharacters = new Set(ordinary.map((candidate) => candidate.charaId))
    const bossCharacters = new Set(bosses.map((candidate) => candidate.charaId))
    if (ordinaryCharacters.size < 4 || bossCharacters.size < 2 ||
      new Set([...ordinaryCharacters, ...bossCharacters]).size < 4) {
      throw new Error(`Spark rival override has insufficient no-self coverage at tier ${scenario.tier}`)
    }
    return { id: `tier:${scenario.tier}`, tier: scenario.tier, ordinary, bosses }
  })

  // Exercise the exact pack parser before bytes are written so importer and runtime cannot disagree.
  const parsed = parseSparkRivalContentPack({ version: '1', items })
  return {
    items: parsed.items,
    warnings: [],
    coverage: {
      scenarios: items.length,
      ordinaryCandidates: items.reduce((total, item) => total + item.ordinary.length, 0),
      bossCandidates: items.reduce((total, item) => total + item.bosses.length, 0),
      distinctCharacters: allCharacters.size,
      recipeCounts,
      failures: 0,
    },
  }
}
