// Local-first progression race preparation and persistence (docs/design/racing.md).

import {
  SAVE_ID_PATTERN,
  compileRaceSkill,
  compileRaceCourseLayout,
  compileRaceCourseSlopes,
  COURSE_ROTATION,
  closeFinalScenario,
  activeScenario,
  deriveUma,
  type DerivedUma,
  type Stats,
  GATE_SHARD_REWARD,
  UMA_LEVEL_TICKET_REWARD,
  equippedRaceBonus,
  careerComplete,
  careerHoldLevel,
  careerOpenAtGate,
  evaluateScenarioGoals,
  isCareerJourney,
  isGateLevel,
  isLocalDay,
  LEVELS_PER_SCENARIO,
  castRivals,
  rollRivalField,
  parseCardSave,
  parsePlayerProfileOrThrow,
  parseFlairEvent,
  parseRaceResultRecord,
  parseUmaSave,
  progressionFieldSize,
  raceAttemptId,
  raceAttemptSeed,
  raceSkillSupported,
  resolveRaceExperience,
  selectBaselineRaceSkills,
  affordableLoadout,
  summarizeSkillLoadout,
  SCENARIOS,
  supportDeckIssueMessage,
  tierOfLevel,
  validateSupportDeck,
  type CardSave,
  type CompiledRaceSkill,
  type LedgerEntry,
  type PlayerProfile,
  type RaceResultRecord,
  type RaceResultRunner,
  type RaceTemplate,
  type SkillTemplate,
  type Strategy,
  type UmaSave,
  type UmaTemplate,
} from '@racer/domain'
import { createRng, simulateRace, simulateRaceV1, simulateRaceV2, simulateRaceV3, simulateRaceV4, simulateRaceV5, type RaceInput, type RaceTimeline } from '@racer/race'
import type { LoadedContent } from '../content/runtime'
import { db, type LogRow } from './db'
import { updateRaceBadgeFacts, updateScenarioBadgeFacts } from './badges'
import { reconcileTrainerInTransaction } from './trainer'
import { queueInTransaction } from './persistence'
import { accomplishmentFactsFromTimeline } from './race-facts'

export interface PreparedRaceRunner {
  templateId: string
  isPlayer: boolean
}

export interface PreparedRace {
  engineVersion: 1 | 2 | 3 | 4 | 5 | 6
  id: string
  contentVersion: string
  umaId: string
  raceId: string
  sequence: number
  seed: number
  strategy: Strategy
  startLevel: number
  startExp: number
  startStats: Stats
  raceBonus: number
  playerIndex: number
  input: RaceInput
  runners: PreparedRaceRunner[]
}

export type RacePreparation =
  | { status: 'prepared'; attempt: PreparedRace }
  | { status: 'completed'; record: RaceResultRecord }

export interface RaceCompletion {
  profile: PlayerProfile
  uma: UmaSave
  record: RaceResultRecord
  timeline: RaceTimeline
  alreadyRecorded: boolean
}

export const simulatePreparedRace = (attempt: PreparedRace): RaceTimeline =>
  attempt.engineVersion === 1 ? simulateRaceV1(attempt.input)
    : attempt.engineVersion === 2 ? simulateRaceV2(attempt.input)
      : attempt.engineVersion === 3 ? simulateRaceV3(attempt.input)
        : attempt.engineVersion === 4 ? simulateRaceV4(attempt.input)
          : attempt.engineVersion === 5 ? simulateRaceV5(attempt.input)
            : simulateRace(attempt.input)

interface BuildRaceInput {
  content: LoadedContent
  profile: PlayerProfile
  uma: UmaSave
  cardsById: Readonly<Record<string, CardSave>>
  raceId: string
  strategy: Strategy
  sequence: number
}

const parsedUma = (id: string, value: unknown): UmaSave => {
  const uma = parseUmaSave(value)
  if (!uma || uma.templateId !== id) throw new Error(`Invalid local Uma save: ${id}`)
  return uma
}

const parsedCard = (id: string, value: unknown): CardSave => {
  const card = parseCardSave(value)
  if (!card || card.templateId !== id) throw new Error(`Invalid local card save: ${id}`)
  return card
}

const shuffled = <T,>(items: readonly T[], seed: number): T[] => {
  const result = [...items]
  const rng = createRng(seed)
  for (let index = result.length - 1; index > 0; index -= 1) {
    const selected = Math.floor(rng.next() * (index + 1))
    const value = result[index]!
    result[index] = result[selected]!
    result[selected] = value
  }
  return result
}

function uniqueOpponentPool(player: UmaTemplate, umas: readonly UmaTemplate[]): UmaTemplate[] {
  const byCharacter = new Map<string, UmaTemplate>()
  for (const template of [...umas].sort((left, right) => left.id.localeCompare(right.id))) {
    if (template.charaId === player.charaId || byCharacter.has(template.charaId)) continue
    byCharacter.set(template.charaId, template)
  }
  return [...byCharacter.values()]
}

function equippedCards(
  content: LoadedContent,
  uma: UmaSave,
  cardsById: Readonly<Record<string, CardSave>>,
) {
  const validation = validateSupportDeck({
    tier: uma.unlockedTier,
    orderedCardIds: activeScenario(uma).cardSetIds,
    ownedCards: Object.values(cardsById),
    templates: content.cards.byId,
  })
  const issue = validation.issues[0]
  if (issue) throw new Error(supportDeckIssueMessage(issue))
  return validation.cards
}

function compiledSupported(template: SkillTemplate | undefined): CompiledRaceSkill[] {
  if (!template) return []
  const compiled = compileRaceSkill(template)
  return raceSkillSupported(compiled) ? [compiled] : []
}

function baselineNpcSkills(content: LoadedContent): CompiledRaceSkill[] {
  return selectBaselineRaceSkills(content.skills.items)
}

function playerRaceSkills(
  content: LoadedContent,
  derived: DerivedUma,
  template: UmaTemplate,
): CompiledRaceSkill[] {
  // Structure still blocks a race (an unknown or unsupported skill); an SP overdraft does not — the skills past
  // what this scenario now pays simply sit out (affordableLoadout).
  const structure = summarizeSkillLoadout({ ...derived, skillPoints: Number.MAX_SAFE_INTEGER }, template, content.skills.byId)
  if (!structure.valid) throw new Error(structure.errors[0])
  const own = template.uniqueSkillId ? compiledSupported(content.skills.byId.get(template.uniqueSkillId)) : []
  const equipped = affordableLoadout(structure.skills, derived.skillPoints).map((skill) => compileRaceSkill(skill))
  const unsupported = equipped.find((skill) => !raceSkillSupported(skill))
  if (unsupported) throw new Error(`Equipped skill ${unsupported.id} is not supported by the basic race engine`)
  return [...own, ...equipped]
}

export function buildPreparedRace(input: BuildRaceInput): PreparedRace {
  const { content, profile, uma, raceId, strategy, sequence } = input
  const run = activeScenario(uma)
  if (!run.started) throw new Error('Start this scenario before racing')
  if (run.trainingLevel < 1) throw new Error('Play one Spark Match run to unlock races for this Uma')
  // An unfinished career keeps racing at the gate level; anything else waits for the advance (D137).
  if (isGateLevel(uma.level) && !careerOpenAtGate(run.journey)) throw new Error('Advance this Uma before entering another race')
  const template = content.umas.byId.get(uma.templateId)
  if (!template) throw new Error(`Race content is missing Uma ${uma.templateId}`)
  // Stats, skills and aptitudes all come from the active constellation (D121).
  const derived = deriveUma({
    uma,
    umaTemplate: template,
    cardSaves: new Map(Object.entries(input.cardsById)),
    cardTemplates: content.cards.byId,
    umaTemplates: content.umas.byId,
  })
  const race = content.races.byId.get(raceId)
  if (!race) throw new Error(`Race content is missing race ${raceId}`)
  const course = content.courses.byId.get(race.courseId)
  if (!course) throw new Error(`Race content is missing course ${race.courseId}`)
  // Engine v5 snapshots the course's hills with its corners and straights (M018).
  const layout = { ...compileRaceCourseLayout(course, race.distance, race.direction), slopes: compileRaceCourseSlopes(course, race.distance) }
  const seed = raceAttemptSeed(profile.createdAt, content.manifest.version, uma.templateId, race.id, strategy, sequence)
  const fieldSize = progressionFieldSize(race)
  const opponents = shuffled(uniqueOpponentPool(template, content.umas.items), seed ^ 0x9e3779b9)
  if (opponents.length < fieldSize - 1) {
    throw new Error(`${race.name} needs ${fieldSize - 1} distinct opponent characters`)
  }
  const rng = createRng(seed ^ 0x5bd1e995)
  const playerGate = Math.floor(rng.next() * fieldSize)
  const raceBonus = equippedRaceBonus(tierOfLevel(uma.level), equippedCards(content, uma, input.cardsById))
  const playerSkills = playerRaceSkills(content, derived, template)
  const baselineSkills = baselineNpcSkills(content)
  // A fresh field every race: styles and stats rolled from the tier's presets, each style run by an Uma suited to it
  // (D153, docs/design/racing.md#opponents-generated-rivals).
  const slots = rollRivalField({ tier: uma.unlockedTier, grade: race.grade, distance: race.distanceCategory, count: fieldSize - 1, rng })
  const cast = castRivals(opponents, slots)
  let rivalIndex = 0
  const runners = Array.from({ length: fieldSize }, (_, gate) => {
    if (gate === playerGate) {
      return {
        template: template,
        display: { templateId: template.id, isPlayer: true },
        engine: {
          id: template.id,
          label: String(gate + 1),
          stats: { ...derived.stats },
          strategy,
          aptitude: {
            distance: derived.aptitudes.distance[race.distanceCategory],
            surface: derived.aptitudes.surface[race.surface],
            strategy: derived.aptitudes.strategy[strategy],
          },
          gate,
          skills: playerSkills,
        },
      }
    }
    const slot = slots[rivalIndex]!
    const rival = cast[rivalIndex++]!
    return {
      template: rival,
      display: { templateId: rival.id, isPlayer: false },
      engine: {
        id: rival.id,
        label: String(gate + 1),
        stats: slot.stats,
        strategy: slot.strategy,
        aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const,
        gate,
        skills: [...compiledSupported(content.skills.byId.get(rival.uniqueSkillId ?? '')), ...baselineSkills],
      },
    }
  })
  return {
    engineVersion: 6,
    id: raceAttemptId(uma.templateId, sequence),
    contentVersion: content.manifest.version,
    umaId: uma.templateId,
    raceId: race.id,
    sequence,
    seed,
    strategy,
    startLevel: uma.level,
    startExp: uma.exp,
    startStats: { ...derived.stats },
    raceBonus,
    playerIndex: playerGate,
    input: {
      course: {
        distance: race.distance,
        surface: race.surface,
        season: race.season,
        layout,
        // Imported track ids are numeric; anything else reads as no track, so no track-specific skill fires.
        trackId: /^\d+$/.test(course.trackId) ? Number(course.trackId) : 0,
        rotation: COURSE_ROTATION[race.direction],
      },
      runners: runners.map((runner) => runner.engine),
      seed,
    },
    runners: runners.map((runner) => runner.display),
  }
}

function sameAttempt(left: PreparedRace, right: PreparedRace): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function recordMatchesAttempt(record: RaceResultRecord, attempt: PreparedRace): boolean {
  return record.engineVersion === attempt.engineVersion &&
    record.contentVersion === attempt.contentVersion &&
    record.umaId === attempt.umaId &&
    record.raceId === attempt.raceId &&
    record.sequence === attempt.sequence &&
    record.seed === attempt.seed &&
    record.strategy === attempt.strategy &&
    record.startLevel === attempt.startLevel &&
    record.startExp === attempt.startExp &&
    record.raceBonus === attempt.raceBonus &&
    JSON.stringify(record.startStats) === JSON.stringify(attempt.startStats) &&
    JSON.stringify(record.course) === JSON.stringify(attempt.input.course)
}

function factsForAttempt(content: LoadedContent, attempt: PreparedRace, race: RaceTemplate, timeline: RaceTimeline) {
  const playerInput = attempt.input.runners[attempt.playerIndex]!
  const inheritedUniqueSkillIds = new Set(
    (playerInput.skills ?? [])
      .filter((skill) => skill.inherited && content.skills.byId.get(skill.id)?.kind === 'inherited-unique')
      .map((skill) => skill.id),
  )
  return accomplishmentFactsFromTimeline({
    race,
    timeline,
    playerIndex: attempt.playerIndex,
    gates: attempt.input.runners.map((runner) => runner.gate),
    inheritedUniqueSkillIds,
  })
}

function resultRecord(
  content: LoadedContent,
  attempt: PreparedRace,
  race: RaceTemplate,
  uma: UmaSave,
  timeline: RaceTimeline,
  createdAt: number,
): { record: RaceResultRecord; uma: UmaSave; ticketReward: number; shardReward: number } {
  const playerResult = timeline.results.find((result) => result.runner === attempt.playerIndex)
  if (!playerResult) throw new Error('Race result is missing the player')
  const accomplishmentFacts = factsForAttempt(content, attempt, race, timeline)
  const field: RaceResultRunner[] = timeline.results.map((result) => {
    const runner = attempt.input.runners[result.runner]
    const display = attempt.runners[result.runner]
    if (!runner || !display) throw new Error('Race result references an unknown runner')
    return {
      umaId: display.templateId,
      isPlayer: display.isPlayer,
      strategy: runner.strategy,
      gate: runner.gate,
      stats: { ...runner.stats },
      aptitude: { ...runner.aptitude },
      placement: result.placement,
      finishTime: result.finishTime,
      marginLengths: result.marginLengths,
      skills: [...(runner.skills ?? [])],
    }
  }).sort((left, right) => left.placement - right.placement)
  const unsettled: RaceResultRecord = {
    engineVersion: 6,
    course: { ...attempt.input.course, season: attempt.input.course.season ?? 0 },
    contentVersion: attempt.contentVersion,
    umaId: attempt.umaId,
    raceId: attempt.raceId,
    sequence: attempt.sequence,
    seed: attempt.seed,
    strategy: attempt.strategy,
    startLevel: attempt.startLevel,
    startExp: attempt.startExp,
    startStats: { ...attempt.startStats },
    raceBonus: attempt.raceBonus,
    playerPlacement: playerResult.placement,
    expGained: 0,
    levelsGained: [],
    ticketReward: 0,
    shardReward: 0,
    completedGoalIds: [],
    accomplishmentFacts,
    field,
    createdAt,
  }
  // Goals settle before EXP, so the race that wins a stage's goal also releases the level it was holding (D137).
  const goals = settleScenarioGoals(uma, race, attempt.id, unsettled, createdAt)
  const progress = resolveRaceExperience(goals.uma, race.grade, playerResult.placement, attempt.raceBonus,
    careerHoldLevel(activeScenario(goals.uma).journey, uma.level))
  return {
    uma: progress.uma,
    ticketReward: progress.ticketReward,
    shardReward: progress.shardReward,
    record: {
      ...unsettled,
      expGained: progress.expGained,
      levelsGained: progress.levelsGained,
      ticketReward: progress.ticketReward,
      shardReward: progress.shardReward,
      completedGoalIds: goals.completedGoalIds,
    },
  }
}

/** Evaluate the active journey's goals against this result; the Uma's level and EXP are untouched here. */
function settleScenarioGoals(
  umaBeforeRace: UmaSave,
  race: RaceTemplate,
  resultId: string,
  record: RaceResultRecord,
  now: number,
): { uma: UmaSave; completedGoalIds: string[] } {
  const active = activeScenario(umaBeforeRace).journey
  if (active?.state !== 'active') return { uma: umaBeforeRace, completedGoalIds: [] }
  const evaluated = evaluateScenarioGoals({ journey: active, uma: umaBeforeRace, race, resultId, result: record, completedAt: now })
  return {
    uma: {
      ...umaBeforeRace,
      scenarios: umaBeforeRace.scenarios.map((run) =>
        run.tier === active.tier ? { ...run, journey: evaluated.journey } : run),
    },
    completedGoalIds: evaluated.newlyCompletedIds,
  }
}

/** At the highest tier there is nothing left to unlock, so the run's journey simply closes. */
function captureFinalSnapshot(content: LoadedContent, uma: UmaSave, now: number): UmaSave {
  if (uma.level !== SCENARIOS.length * LEVELS_PER_SCENARIO) return uma
  // A final-tier career closes only once it is won; the gate keeps it racing until then.
  const journey = activeScenario(uma).journey
  if (isCareerJourney(journey) && !careerComplete(journey)) return uma
  if (!content.umas.byId.has(uma.templateId)) throw new Error(`Race content is missing Uma ${uma.templateId}`)
  return closeFinalScenario(uma, now)
}

function parseHistoryRow(row: LogRow): RaceResultRecord {
  const result = parseRaceResultRecord(row.data)
  if (!result || row.id !== raceAttemptId(result.umaId, result.sequence) || row.createdAt !== result.createdAt) {
    throw new Error(`Invalid local race result: ${row.id}`)
  }
  return result
}

function validateUmaSequence(history: readonly RaceResultRecord[], umaId: string): RaceResultRecord[] {
  const results = history.filter((record) => record.umaId === umaId).sort((left, right) => left.sequence - right.sequence)
  results.forEach((record, index) => {
    if (record.sequence !== index) throw new Error(`Race history sequence is incomplete for ${umaId}`)
  })
  return results
}

async function validateStoredFlairEvents(record: RaceResultRecord): Promise<void> {
  if (record.earnedFlairEventIds === undefined) return
  const rows = await db.flairEvents.bulkGet(record.earnedFlairEventIds)
  rows.forEach((row, index) => {
    const id = record.earnedFlairEventIds![index]!
    const parsed = row ? parseFlairEvent(row.data) : null
    if (!row || !parsed || row.id !== id || row.createdAt !== parsed.earnedAt) {
      throw new Error(`Race result flair reference is corrupt: ${id}`)
    }
  })
}

/** Every result one Uma has, oldest first. The Race tab reads it for wins and repeat counts. */
export async function readUmaRaceHistory(umaId: string): Promise<RaceResultRecord[]> {
  const rows = await db.raceResults.orderBy('createdAt').toArray()
  return rows.map(parseHistoryRow).filter((record) => record.umaId === umaId)
}

export async function readRaceHistory(limit = 20): Promise<RaceResultRecord[]> {
  const rows = await db.raceResults.orderBy('createdAt').reverse().toArray()
  return rows.map(parseHistoryRow).slice(0, limit)
}

/**
 * Latest race time per Uma, for the album's "recently raced" sort. Reads ids and times only — the
 * save itself stores no timestamps (D114).
 */
export async function readLatestRaceTimes(): Promise<Record<string, number>> {
  const rows = await db.raceResults.orderBy('createdAt').toArray()
  const latest: Record<string, number> = {}
  for (const row of rows) {
    const umaId = (row.data as { umaId?: unknown }).umaId
    if (typeof umaId === 'string' && SAVE_ID_PATTERN.test(umaId)) latest[umaId] = row.createdAt
  }
  return latest
}

async function savedRaceInputs(content: LoadedContent, umaId: string) {
  const profileRow = await db.profile.get('main')
  const umaRow = await db.umas.get(umaId)
  if (!profileRow) throw new Error('Local profile is missing')
  if (!umaRow) throw new Error('Race Uma is not owned')
  const profile = parsePlayerProfileOrThrow(profileRow.data)
  const uma = parsedUma(umaId, umaRow.data)
  const cardSetIds = activeScenario(uma).cardSetIds
  const rows = await db.cards.bulkGet(cardSetIds)
  const cardsById = Object.fromEntries(cardSetIds.map((id, index) => {
    const row = rows[index]
    if (!row) throw new Error(`Card set card is not owned: ${id}`)
    return [id, parsedCard(id, row.data)]
  }))
  return { profile, uma, cardsById }
}

export async function preparePersistentRace(
  content: LoadedContent,
  umaId: string,
  raceId: string,
  strategy: Strategy,
  requestedSequence?: number,
): Promise<RacePreparation> {
  const { profile, uma, cardsById } = await savedRaceInputs(content, umaId)
  const history = validateUmaSequence((await db.raceResults.toArray()).map(parseHistoryRow), umaId)
  const sequence = requestedSequence ?? history.length
  if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence > history.length) throw new Error('Race attempt is stale')
  if (sequence < history.length) {
    const record = history[sequence]!
    if (record.raceId !== raceId || record.strategy !== strategy) throw new Error('Race attempt no longer matches history')
    return { status: 'completed', record }
  }
  return { status: 'prepared', attempt: buildPreparedRace({ content, profile, uma, cardsById, raceId, strategy, sequence }) }
}

export function prepareMemoryRace(
  content: LoadedContent,
  profile: PlayerProfile,
  uma: UmaSave,
  cardsById: Readonly<Record<string, CardSave>>,
  history: readonly RaceResultRecord[],
  raceId: string,
  strategy: Strategy,
  requestedSequence?: number,
): RacePreparation {
  const results = validateUmaSequence(history, uma.templateId)
  const sequence = requestedSequence ?? results.length
  if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence > results.length) throw new Error('Race attempt is stale')
  if (sequence < results.length) {
    const record = results[sequence]!
    if (record.raceId !== raceId || record.strategy !== strategy) throw new Error('Race attempt no longer matches history')
    return { status: 'completed', record }
  }
  return { status: 'prepared', attempt: buildPreparedRace({ content, profile, uma, cardsById, raceId, strategy, sequence }) }
}

export function completeMemoryRace(
  content: LoadedContent,
  profile: PlayerProfile,
  uma: UmaSave,
  cardsById: Readonly<Record<string, CardSave>>,
  history: readonly RaceResultRecord[],
  attempt: PreparedRace,
  today: string,
  now: number,
): RaceCompletion {
  if (!isLocalDay(today) || !Number.isSafeInteger(now) || now < 0) throw new Error('Invalid race completion time')
  const existing = history.find((record) => record.umaId === attempt.umaId && record.sequence === attempt.sequence)
  if (existing) {
    if (!recordMatchesAttempt(existing, attempt)) throw new Error('Race result id collision')
    const timeline = simulatePreparedRace(attempt)
    const race = content.races.byId.get(attempt.raceId)
    if (!race || !existing.accomplishmentFacts || JSON.stringify(existing.accomplishmentFacts) !== JSON.stringify(factsForAttempt(content, attempt, race, timeline))) {
      throw new Error('Race result accomplishment facts are corrupt')
    }
    return { profile, uma, record: existing, timeline, alreadyRecorded: true }
  }
  const current = buildPreparedRace({
    content,
    profile,
    uma,
    cardsById,
    raceId: attempt.raceId,
    strategy: attempt.strategy,
    sequence: validateUmaSequence(history, uma.templateId).length,
  })
  if (!sameAttempt(current, attempt)) throw new Error('Race attempt is stale; prepare a new race')
  const race = content.races.byId.get(attempt.raceId)!
  const timeline = simulatePreparedRace(attempt)
  const result = resultRecord(content, attempt, race, uma, timeline, now)
  const completedUma = captureFinalSnapshot(content, result.uma, now)
  return {
    profile: {
      ...profile,
      tickets: profile.tickets + result.ticketReward,
      umaShards: profile.umaShards + result.shardReward,
    },
    uma: completedUma,
    record: result.record,
    timeline,
    alreadyRecorded: false,
  }
}

export async function completePersistentRace(
  content: LoadedContent,
  attempt: PreparedRace,
  today: string,
  now: number,
): Promise<RaceCompletion> {
  if (!isLocalDay(today) || !Number.isSafeInteger(now) || now < 0) throw new Error('Invalid race completion time')
  return db.transaction('rw', [db.profile, db.umas, db.cards, db.badges, db.raceResults, db.ledger, db.flairEvents, db.outbox], async () => {
    const existingRow = await db.raceResults.get(attempt.id)
    if (existingRow) {
      const record = parseHistoryRow(existingRow)
      if (!recordMatchesAttempt(record, attempt)) throw new Error('Race result id collision')
      const saved = await savedRaceInputs(content, attempt.umaId)
      const timeline = simulatePreparedRace(attempt)
      const race = content.races.byId.get(attempt.raceId)
      if (!race || !record.accomplishmentFacts || JSON.stringify(record.accomplishmentFacts) !== JSON.stringify(factsForAttempt(content, attempt, race, timeline))) {
        throw new Error('Race result accomplishment facts are corrupt')
      }
      await validateStoredFlairEvents(record)
      return {
        profile: saved.profile,
        uma: saved.uma,
        record,
        timeline,
        alreadyRecorded: true,
      }
    }

    const { profile, uma, cardsById } = await savedRaceInputs(content, attempt.umaId)
    const history = validateUmaSequence((await db.raceResults.toArray()).map(parseHistoryRow), attempt.umaId)
    const current = buildPreparedRace({
      content,
      profile,
      uma,
      cardsById,
      raceId: attempt.raceId,
      strategy: attempt.strategy,
      sequence: history.length,
    })
    if (!sameAttempt(current, attempt)) throw new Error('Race attempt is stale; prepare a new race')
    const race = content.races.byId.get(attempt.raceId)!
    const timeline = simulatePreparedRace(attempt)
    const resolved = resultRecord(content, attempt, race, uma, timeline, now)
    const completedUma = captureFinalSnapshot(content, resolved.uma, now)
    const levelIds = resolved.record.levelsGained.map((level) => `uma-level-tickets:${attempt.umaId}:${level}`)
    const gate = resolved.record.shardReward ? resolved.record.levelsGained.at(-1) : undefined
    const shardId = gate === undefined ? null : `uma-gate-shard:${attempt.umaId}:${gate}`
    const existingRewards = await db.ledger.bulkGet(shardId ? [...levelIds, shardId] : levelIds)
    if (existingRewards.some((entry) => entry !== undefined)) throw new Error('Race reward was already recorded')
    const nextProfile = {
      ...profile,
      tickets: profile.tickets + resolved.ticketReward,
      umaShards: profile.umaShards + resolved.shardReward,
    }
    const profileRow = await db.profile.get('main')
    const umaRow = await db.umas.get(attempt.umaId)
    if (!profileRow || !umaRow) throw new Error('Local race save disappeared')
    await db.profile.put({ ...profileRow, data: nextProfile })
    await db.umas.put({ ...umaRow, data: completedUma })
    const raceFlair = await updateRaceBadgeFacts({
      content,
      umaBefore: uma,
      umaAfter: completedUma,
      resultId: attempt.id,
      record: resolved.record,
      facts: resolved.record.accomplishmentFacts!,
      now,
    })
    const earnedFlairEventIds = raceFlair.events.map((event) => event.id)
    // The final tier closes exactly once: when this race is the one that closed its journey.
    const finalJourneyState = (save: UmaSave) =>
      save.scenarios.find((run) => run.tier === SCENARIOS.length)?.journey?.state ?? null
    const completedFinalTier = finalJourneyState(completedUma) === 'completed' &&
      finalJourneyState(uma) !== 'completed'
    if (completedFinalTier) {
      const scenarioFlair = await updateScenarioBadgeFacts({ content, before: completedUma, after: completedUma, completedTier: SCENARIOS.length, now })
      earnedFlairEventIds.push(...scenarioFlair.events.map((event) => event.id))
    }
    const finalRecord: RaceResultRecord = { ...resolved.record, earnedFlairEventIds }
    await db.raceResults.add({
      id: attempt.id,
      data: finalRecord as unknown as Record<string, unknown>,
      createdAt: now,
    })
    await queueInTransaction('profile', 'main', 'upsert', now)
    await queueInTransaction('umas', attempt.umaId, 'upsert', now)
    await queueInTransaction('raceResults', attempt.id, 'append', now)

    const ledger: { id: string; data: LedgerEntry }[] = levelIds.map((id) => ({
      id,
      data: { resource: 'tickets', delta: UMA_LEVEL_TICKET_REWARD, reason: 'uma-level', localDay: today, createdAt: now },
    }))
    if (shardId) {
      ledger.push({
        id: shardId,
        data: { resource: 'uma-shards', delta: GATE_SHARD_REWARD, reason: 'uma-level', localDay: today, createdAt: now },
      })
    }
    for (const entry of ledger) {
      await db.ledger.add({ id: entry.id, data: entry.data, createdAt: now })
      await queueInTransaction('ledger', entry.id, 'append', now)
    }
    const trainer = await reconcileTrainerInTransaction(content, now, false, attempt.id)
    const committedRecord: RaceResultRecord = {
      ...finalRecord,
      earnedFlairEventIds: [...(finalRecord.earnedFlairEventIds ?? []), ...trainer.events.map((event) => event.id)],
    }
    await db.raceResults.put({ id: attempt.id, data: committedRecord as unknown as Record<string, unknown>, createdAt: now })
    return {
      profile: nextProfile,
      uma: completedUma,
      record: committedRecord,
      timeline,
      alreadyRecorded: false,
    }
  })
}

/** Rebuild a read-only replay input from an append-only result without consulting mutable Uma state. */
export function preparedRaceFromRecord(content: LoadedContent, record: RaceResultRecord): PreparedRace {
  const race = content.races.byId.get(record.raceId)
  if (!race) throw new Error(`Race history content is missing race ${record.raceId}`)
  const byGate = [...record.field].sort((left, right) => left.gate - right.gate)
  const playerIndex = byGate.findIndex((runner) => runner.isPlayer)
  if (playerIndex < 0) throw new Error('Race history is missing the player')
  return {
    engineVersion: record.engineVersion ?? 1,
    id: raceAttemptId(record.umaId, record.sequence),
    contentVersion: record.contentVersion,
    umaId: record.umaId,
    raceId: record.raceId,
    sequence: record.sequence,
    seed: record.seed,
    strategy: record.strategy,
    startLevel: record.startLevel,
    startExp: record.startExp,
    startStats: { ...record.startStats },
    raceBonus: record.raceBonus,
    playerIndex,
    input: {
      course: record.course ? { ...record.course } : { distance: race.distance, surface: race.surface },
      runners: byGate.map((runner) => ({
        id: runner.umaId,
        label: String(runner.gate + 1),
        stats: { ...runner.stats },
        strategy: runner.strategy,
        aptitude: { ...runner.aptitude },
        gate: runner.gate,
        ...(runner.skills ? { skills: [...runner.skills] } : {}),
      })),
      seed: record.seed,
    },
    runners: byGate.map((runner) => ({ templateId: runner.umaId, isPlayer: runner.isPlayer })),
  }
}
