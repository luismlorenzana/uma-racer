// Flair on generation 2 (docs/design/badges.md "Award and event semantics"; T141 "The race commit", "Trophy Hall"): the
// device's own rows, `badges/…` and `flairEvents`, evaluated after an operation applies locally and written in its
// transaction, behind it in the one lane. The rules are today's (`applyRaceBadgeFacts`, `evaluateUmaFlair`,
// `reconcileTrainerState`) on the generation-2 catalogue; the facts they read come from the rework state:
// - a race: today's race facts from its `raceResults` row, at her sequence;
// - her build: `layerDone` names her scenario Fully Trained (05 §11, D344), a full tree her Full House, her library
//   her skills, her lifetime level her level peak (03 §2);
// - leaving a scenario (the advance, a promotion from a tier's last scenario, the Hall of Fame): its completion fact,
//   "Graduate", with the sets of every race she ran there for Era Loyalist (04 §9), and Legacy, which counts the
//   selected preset's parents at each arrival, when her career freezes;
// - the Trainer: the ever-bonded set, a projection of every Uma's bonds and tier histories (06 §9), reconciled in each
//   race, advance and promotion commit and when the Trophy Hall opens, so no other place calls flair.
// Pure: the caller gives the time.
import {
  applyDynastyFact, applyLegacyFact, applyParentedStartFact, applyRaceBadgeFacts, applyScenarioCompletionFact, badgeStateId,
  buildUmaFlairCatalog, createTrainerBadgeState, createUmaBadgeState, evaluateUmaFlair, flairSourceId, reconcileTrainerState,
  STATS,
  type BadgeStateV1, type BadgeSubject, type FlairEventRecord, type FlairEventV1, type FlairTrigger, type ScenarioCompletionFact,
  type TrainerBadgeStateV1, type UmaBadgeStateV1,
} from '@racer/domain'
import type { OperationEnv } from '@racer/domain/check-in'
import { treeCardNodesAt } from '@racer/domain/training'
import { lifetimeLevel, scenarioNumber } from '@racer/domain/tiers'
import type { UmaState } from '@racer/domain/state'
import { DISTANCE_CATEGORIES } from '@racer/domain'
import { deriveUmaPreset, everBondedCardIds, layerDone } from '@racer/domain/training'
import type { WorkState } from '@racer/domain/work'
import type { RaceResultRow } from '@racer/domain/save'
import type { LoadedContent } from '../../content/runtime'
import type { G2DeviceRows, G2Records } from '../../app/game'
import { lifetimeOf, recordOf, rowsOf, umaSaveOf } from './today'

/** The account and what the flair reads beyond it. */
export interface FlairWorld {
  /** The account after the operation. */
  readonly state: WorkState
  /** The records, the operation's own `raceResults` row included. */
  readonly records: G2Records
  readonly content: LoadedContent
  readonly env: OperationEnv
  readonly now: number
}

/** What a commit's flair writes, and its events in the order they were earned. */
export interface FlairChange {
  readonly badges: Readonly<Record<string, BadgeStateV1>>
  readonly events: readonly FlairEventRecord[]
}

export const TRAINER_BADGE_ID = 'trainer'

/** The rows to write: every changed badge state, every new event. */
export const deviceRows = (change: FlairChange): G2DeviceRows => ({
  badges: change.badges,
  flairEvents: change.events.map((event) => event.data),
})

/** Her badge subject: the selected preset's stats and library, at her scenario T. */
function subjectOf(uma: UmaState, env: OperationEnv): BadgeSubject {
  const derived = deriveUmaPreset(uma, uma.raceDefaults.selectedPreset, env.content)
  return { tier: scenarioNumber(uma), stats: { ...derived.stats }, library: derived.library }
}

/** Her stored badge state, else a new one with her past races replayed in order, as today's bootstrap does. */
function storedOrNew(world: FlairWorld, uma: UmaState, before?: readonly RaceResultRow[]): UmaBadgeStateV1 {
  const stored = world.records.badges[badgeStateId(uma.outfitId)]
  if (stored?.scope === 'uma') return stored
  let state = createUmaBadgeState(umaSaveOf(uma), subjectOf(uma, world.env), world.now)
  ;(before ?? rowsOf(world.records.raceResults, uma.outfitId)).forEach((row, sequence) => {
    state = applyRaceBadgeFacts(state, row.opId, recordOf(row, sequence), row.run.accomplishmentFacts ?? null)
  })
  return state
}

const sortedNumbers = (values: Iterable<number>): number[] => [...new Set(values)].sort((a, b) => a - b)
const sortedIds = (values: Iterable<string>): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b))

/**
 * Her build's facts as they stand: Fully Trained when her scenario's layer is done, Full House when every card node
 * of her tree is filled in a preset, her library's skills, her stat and level peaks. Nothing already counted falls.
 */
export function withBuildFacts(state: UmaBadgeStateV1, uma: UmaState, env: OperationEnv): UmaBadgeStateV1 {
  const T = scenarioNumber(uma)
  const presets = DISTANCE_CATEGORIES.map((distance) => deriveUmaPreset(uma, distance, env.content))
  const selected = presets[DISTANCE_CATEGORIES.indexOf(uma.raceDefaults.selectedPreset)]!
  const tree = treeCardNodesAt(T)
  const full = presets.some((derived) => derived.openNodes === tree && derived.filledNodes === tree)
  const facts = state.facts
  const library = selected.library.map((skill) => skill.skillId)
  const skillsHere = Math.max(...facts.maxSkillsByTier.filter((row) => row.key === String(T)).map((row) => row.count), library.length)
  const next: UmaBadgeStateV1 = {
    ...state,
    facts: {
      ...facts,
      fullyTrainedTiers: layerDone(uma.build, uma.scenario) ? sortedNumbers([...facts.fullyTrainedTiers, T]) : facts.fullyTrainedTiers,
      fullHouseCount: full ? Math.max(1, facts.fullHouseCount) : facts.fullHouseCount,
      distinctSkillIds: sortedIds([...facts.distinctSkillIds, ...library]),
      maxSkillsByTier: [...facts.maxSkillsByTier.filter((row) => row.key !== String(T)), { key: String(T), count: skillsHere }]
        .sort((a, b) => a.key.localeCompare(b.key)),
      levelPeak: Math.max(facts.levelPeak, lifetimeOf(uma)),
      statPeaks: Object.fromEntries(STATS.map((stat) => [stat, Math.max(facts.statPeaks[stat], selected.stats[stat])])) as UmaBadgeStateV1['facts']['statPeaks'],
      balancedPeak: Math.max(facts.balancedPeak, Math.min(...STATS.map((stat) => selected.stats[stat]))),
    },
  }
  return JSON.stringify(next) === JSON.stringify(state) ? state : next
}

/** Today's evaluator on the generation-2 catalogue. */
function evaluate(world: FlairWorld, state: UmaBadgeStateV1, trigger: FlairTrigger, courseRecordIds?: ReadonlySet<string>) {
  const catalog = buildUmaFlairCatalog({ state, races: world.content.races.items, courseRecordIds })
  return evaluateUmaFlair(catalog, state, trigger)
}

/** Every Uma's state after `changed`, created where missing, so the Trainer reads one contributor per Uma. */
function contributors(world: FlairWorld, changed: ReadonlyMap<string, UmaBadgeStateV1>): Map<string, UmaBadgeStateV1> {
  const all = new Map<string, UmaBadgeStateV1>()
  for (const uma of Object.values(world.state.umas).sort((a, b) => a.outfitId.localeCompare(b.outfitId))) {
    all.set(uma.outfitId, changed.get(uma.outfitId) ?? storedOrNew(world, uma))
  }
  return all
}

/** The Trainer on the generation-2 catalogue: the ever-bonded set, lifetime levels, and every Uma's badge state. */
function reconcileTrainer(world: FlairWorld, states: ReadonlyMap<string, UmaBadgeStateV1>, sourceId: string) {
  const stored = world.records.badges[TRAINER_BADGE_ID]
  const state: TrainerBadgeStateV1 = stored?.scope === 'trainer' ? stored : createTrainerBadgeState(world.now)
  const umas = Object.values(world.state.umas).sort((a, b) => a.outfitId.localeCompare(b.outfitId))
  const raceResults = umas.flatMap((uma) => rowsOf(world.records.raceResults, uma.outfitId).map((row, sequence) => recordOf(row, sequence)))
  const result = reconcileTrainerState({
    state,
    contentVersion: world.content.manifest.version,
    umas: world.content.umas.items,
    cards: world.content.cards.items,
    races: world.content.races.items,
    ownedUmas: umas.map(umaSaveOf),
    contributors: umas.map((uma) => states.get(uma.outfitId)!),
    raceResults,
    now: world.now,
    retroactive: false,
    sourceId,
    bondedCardIds: everBondedCardIds(umas),
  })
  return { ...result, created: stored?.scope !== 'trainer' }
}

/** The changed Umas' states, every Uma missing one, the Trainer, and the events, in one change. */
function settleTrainer(world: FlairWorld, changed: Map<string, UmaBadgeStateV1>, events: FlairEventRecord[], sourceId: string): FlairChange {
  const states = contributors(world, changed)
  const trainer = reconcileTrainer(world, states, sourceId)
  const badges: Record<string, BadgeStateV1> = {}
  for (const [umaId, state] of states) {
    const id = badgeStateId(umaId)
    const stored = world.records.badges[id]
    if (stored === undefined || changed.has(umaId)) badges[id] = state
  }
  if (trainer.changed || trainer.created) badges[TRAINER_BADGE_ID] = trainer.state
  return { badges, events: [...events, ...trainer.events] }
}

/** Course records this result set: a strictly faster time on a course she had run before (today's rule). */
function courseRecordIds(state: UmaBadgeStateV1, row: RaceResultRow): ReadonlySet<string> | undefined {
  const facts = row.run.accomplishmentFacts
  const player = row.run.field.find((runner) => runner.isPlayer)
  if (facts === undefined || player === undefined) return undefined
  const prior = state.facts.courseBests.find((entry) => entry.courseId === facts.courseId)
  return prior && player.finishTime < prior.finishTime ? new Set([facts.courseId]) : undefined
}

/** A committed race's flair (T141): her race facts at her sequence, her build's, the evaluator, then the Trainer. */
export function raceFlair(world: FlairWorld, resultId: string): FlairChange {
  const row = world.records.raceResults[resultId]
  if (row === undefined) throw new Error(`No race result ${resultId}`)
  const uma = world.state.umas[row.umaId]
  if (uma === undefined) throw new Error(`No Uma ${row.umaId}`)
  const rows = rowsOf(world.records.raceResults, row.umaId)
  const sequence = rows.findIndex((entry) => entry.opId === resultId)
  const prior = storedOrNew(world, uma, rows.slice(0, sequence))
  const raced = applyRaceBadgeFacts(prior, resultId, recordOf(row, sequence), row.run.accomplishmentFacts ?? null)
  const built = withBuildFacts(raced, uma, world.env)
  const evaluation = evaluate(world, built, {
    source: { kind: 'race', id: resultId, tier: scenarioNumber(row) }, earnedAt: world.now, retroactive: false,
  }, courseRecordIds(prior, row))
  return settleTrainer(world, new Map([[uma.outfitId, evaluation.state]]), [...evaluation.events], resultId)
}

/** Her selected preset's lineage, filled open slots only: parents, then grandparents. */
function lineageOf(uma: UmaState): { readonly parents: string[]; readonly grandparents: string[] } {
  const lineage = uma.build.presets[uma.raceDefaults.selectedPreset].lineage
  const open = new Set(uma.build.inspiration.slots)
  const ids = (grand: boolean) => Object.entries(lineage)
    .filter(([slot, id]) => id !== undefined && open.has(slot as never) && slot.includes('-gp') === grand)
    .map(([, id]) => id!)
  return { parents: sortedIds(ids(false)), grandparents: sortedIds(ids(true)) }
}

/** The completion fact holds six cards at most (today's set), so a scenario's deck keeps its verdict in six. */
export const COMPLETION_DECK_SIZE = 6

/**
 * The deck a completion fact records from the sets of every race she ran in scenario T: the union, cards of another
 * era first, then by id, cut to six. Era Loyalist reads only whether every era is T, so the cut keeps its verdict:
 * any card of another era is kept, and a deck of era T alone stays era T alone.
 */
export function completionDeck(cardIds: readonly string[], eraOf: (id: string) => number, T: number): string[] {
  return sortedIds(cardIds)
    .sort((a, b) => Number(eraOf(a) === T) - Number(eraOf(b) === T) || a.localeCompare(b))
    .slice(0, COMPLETION_DECK_SIZE)
}

/**
 * The completion fact of the scenario she leaves (04 §9 "Graduate"): her selected preset's stats as she leaves, the
 * card sets of every race she ran there (Era Loyalist), her starts there, her goals and Honors, and her lineage.
 */
export function completionFact(world: FlairWorld, uma: UmaState, rows: readonly RaceResultRow[]): ScenarioCompletionFact {
  const T = scenarioNumber(uma)
  const here = rows.filter((row) => row.tier === uma.tier && row.scenario === uma.scenario)
  const eraOf = (id: string): number => world.content.cards.byId.get(id)?.era ?? world.env.content.cards.get(id)?.era ?? 0
  const deckCardIds = completionDeck(here.flatMap((row) => row.cardSetIds).filter((id) => eraOf(id) > 0), eraOf, T)
  const won = uma.career.goals.filter((goal) => goal.status === 'completed').map((goal) => goal.id).sort()
  const lineage = lineageOf(uma)
  return {
    tier: T,
    completedAt: world.now,
    stats: { ...deriveUmaPreset(uma, uma.raceDefaults.selectedPreset, world.env.content).stats },
    deckCardIds,
    deckEras: deckCardIds.map(eraOf),
    raceStarts: here.length,
    completedGoalIds: won,
    honors: uma.career.tracking === 'tracked' && uma.career.goals.length > 0 && won.length === uma.career.goals.length,
    parentUmaIds: lineage.parents,
    grandparentUmaIds: lineage.grandparents,
  }
}

/**
 * Leaving a scenario (`advance-scenario`, `promote`, an induction): `before` is her as she leaves, `after` as she
 * arrives (the same Uma for the Hall of Fame, which resets nothing). Her completion fact, Dynasty for her
 * grandparents, then Legacy for the parents of her selected preset on arrival; each changed Uma is evaluated.
 */
export function leaveFlair(world: FlairWorld, before: UmaState, after: UmaState, sourceId: string): FlairChange {
  const T = scenarioNumber(before)
  const states = new Map<string, UmaBadgeStateV1>()
  const read = (umaId: string): UmaBadgeStateV1 | null => {
    const known = states.get(umaId)
    if (known) return known
    const uma = world.state.umas[umaId]
    return uma ? storedOrNew(world, uma) : null
  }
  let child = read(before.outfitId)!
  child = applyScenarioCompletionFact(child, completionFact(world, before, rowsOf(world.records.raceResults, before.outfitId)))
  child = withBuildFacts(child, after, world.env)
  for (const grandparent of lineageOf(before).grandparents) {
    const state = read(grandparent)
    if (state) states.set(grandparent, applyDynastyFact(state, before.outfitId, T, world.now))
  }
  const arrival = scenarioNumber(after)
  const parents = arrival === T ? [] : lineageOf(after).parents
  child = applyParentedStartFact(child, arrival, parents, world.now)
  states.set(before.outfitId, child)
  for (const parent of parents) {
    const state = read(parent)
    if (state) states.set(parent, applyLegacyFact(state, before.outfitId, arrival, world.now))
  }
  const events: FlairEventRecord[] = []
  const trigger: FlairTrigger = { source: { kind: 'scenario', id: flairSourceId('scenario', before.outfitId, String(T)), tier: T }, earnedAt: world.now, retroactive: false }
  for (const [umaId, state] of [...states].sort(([a], [b]) => a.localeCompare(b))) {
    const evaluation = evaluate(world, state, trigger)
    states.set(umaId, evaluation.state)
    events.push(...evaluation.events)
  }
  return settleTrainer(world, states, events, sourceId)
}

/**
 * The Trophy Hall's reconcile (T141): every Uma's state created where missing and brought up to her build, the
 * catalogue evaluated, the Trainer reconciled. Only what changed is written.
 */
export function reconcileFlair(world: FlairWorld): FlairChange {
  const changed = new Map<string, UmaBadgeStateV1>()
  const events: FlairEventRecord[] = []
  for (const uma of Object.values(world.state.umas).sort((a, b) => a.outfitId.localeCompare(b.outfitId))) {
    const stored = world.records.badges[badgeStateId(uma.outfitId)]
    const prior = storedOrNew(world, uma)
    const evaluation = evaluate(world, withBuildFacts(prior, uma, world.env), {
      source: { kind: 'collection', id: `collection:${world.now}`, tier: null }, earnedAt: world.now, retroactive: false,
    })
    if (stored === undefined || evaluation.events.length > 0 || JSON.stringify(evaluation.state) !== JSON.stringify(stored)) {
      changed.set(uma.outfitId, evaluation.state)
      events.push(...evaluation.events)
    }
  }
  return settleTrainer(world, changed, events, `collection:${world.now}`)
}

/** The events a result shows (today's T016 order is the caller's): hers and the Trainer's, earned in its commit. */
export function eventsOfCommit(records: G2Records, umaId: string, at: number): (FlairEventV1 & { id: string })[] {
  return Object.entries(records.flairEvents)
    .filter(([, event]) => event.earnedAt === at && (event.scope === 'trainer' || event.umaId === umaId))
    .map(([id, event]) => ({ ...event, id }))
}

/** Lifetime level at a scenario's first level, for words that name a level across tiers. */
export const firstLifetimeLevel = (uma: Pick<UmaState, 'tier'>): number => lifetimeLevel(uma.tier, 1)
