// Local-first progression race preparation and persistence (docs/tasks/T005-progression-races-and-rewards.md).

import {
  bestStrategy,
  compileRaceSkill,
  compileRaceCourseLayout,
  GATE_SHARD_REWARD,
  UMA_LEVEL_TICKET_REWARD,
  equippedRaceBonus,
  fieldForm,
  isGateLevel,
  isLocalDay,
  npcRaceStats,
  parseCardSave,
  parsePlayerProfileOrThrow,
  parseRaceResultRecord,
  parseUmaSave,
  playerRaceStats,
  progressionFieldSize,
  raceAttemptId,
  raceAttemptSeed,
  raceSkillSupported,
  resolveRaceExperience,
  selectBaselineRaceSkills,
  summarizeSkillLoadout,
  tierOfLevel,
  yourForm,
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
import { createRng, simulateRace, simulateRaceV1, simulateRaceV2, type RaceInput, type RaceTimeline } from '@racer/race'
import type { LoadedContent } from '../content/runtime'
import { db, type LogRow } from './db'
import { queueInTransaction } from './persistence'

export interface PreparedRaceRunner {
  templateId: string
  isPlayer: boolean
}

export interface PreparedRace {
  engineVersion: 1 | 2 | 3
  id: string
  contentVersion: string
  umaId: string
  raceId: string
  sequence: number
  seed: number
  strategy: Strategy
  startLevel: number
  startExp: number
  startStats: UmaSave['stats']
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
  attempt.engineVersion === 1 ? simulateRaceV1(attempt.input) : attempt.engineVersion === 2 ? simulateRaceV2(attempt.input) : simulateRace(attempt.input)

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
  return uma.deckCardIds.map((id) => {
    const save = cardsById[id]
    if (!save) throw new Error(`Race deck card is not owned: ${id}`)
    const template = content.cards.byId.get(id)
    if (!template) throw new Error(`Race content is missing card ${id}`)
    return { save, template }
  })
}

function compiledSupported(template: SkillTemplate | undefined): CompiledRaceSkill[] {
  if (!template) return []
  const compiled = compileRaceSkill(template)
  return raceSkillSupported(compiled) ? [compiled] : []
}

function baselineNpcSkills(content: LoadedContent): CompiledRaceSkill[] {
  return selectBaselineRaceSkills(content.skills.items)
}

function playerRaceSkills(content: LoadedContent, uma: UmaSave, template: UmaTemplate): CompiledRaceSkill[] {
  const summary = summarizeSkillLoadout(uma, template, content.skills.byId)
  if (!summary.valid) throw new Error(summary.errors[0])
  const own = template.uniqueSkillId ? compiledSupported(content.skills.byId.get(template.uniqueSkillId)) : []
  const equipped = summary.skills.map((skill) => compileRaceSkill(skill))
  const unsupported = equipped.find((skill) => !raceSkillSupported(skill))
  if (unsupported) throw new Error(`Equipped skill ${unsupported.id} is not supported by the basic race engine`)
  return [...own, ...equipped]
}

export function buildPreparedRace(input: BuildRaceInput): PreparedRace {
  const { content, profile, uma, raceId, strategy, sequence } = input
  if (uma.trainingsThisScenario < 1) throw new Error('Complete one Training turn to unlock races for this Uma')
  if (isGateLevel(uma.level)) throw new Error('Promote this Uma before entering another race')
  const template = content.umas.byId.get(uma.templateId)
  if (!template) throw new Error(`Race content is missing Uma ${uma.templateId}`)
  const race = content.races.byId.get(raceId)
  if (!race) throw new Error(`Race content is missing race ${raceId}`)
  const course = content.courses.byId.get(race.courseId)
  if (!course) throw new Error(`Race content is missing course ${race.courseId}`)
  const layout = compileRaceCourseLayout(course, race.distance, race.direction)
  const seed = raceAttemptSeed(profile.createdAt, content.manifest.version, uma.templateId, race.id, strategy, sequence)
  const fieldSize = progressionFieldSize(race)
  const opponents = shuffled(uniqueOpponentPool(template, content.umas.items), seed ^ 0x9e3779b9)
  if (opponents.length < fieldSize - 1) {
    throw new Error(`${race.name} needs ${fieldSize - 1} distinct opponent characters`)
  }
  const selected = opponents.slice(0, fieldSize - 1)
  const rng = createRng(seed ^ 0x5bd1e995)
  const playerGate = Math.floor(rng.next() * fieldSize)
  const raceBonus = equippedRaceBonus(tierOfLevel(uma.level), equippedCards(content, uma, input.cardsById))
  const playerSkills = playerRaceSkills(content, uma, template)
  const baselineSkills = baselineNpcSkills(content)
  const npcStats = npcRaceStats(tierOfLevel(uma.level), race.grade, race.distanceCategory, uma.level)
  let rivalIndex = 0
  const runners = Array.from({ length: fieldSize }, (_, gate) => {
    if (gate === playerGate) {
      return {
        template: template,
        display: { templateId: template.id, isPlayer: true },
        engine: {
          id: template.id,
          label: String(gate + 1),
          stats: playerRaceStats(uma),
          strategy,
          aptitude: {
            distance: uma.aptitudes.distance[race.distanceCategory],
            surface: uma.aptitudes.surface[race.surface],
            strategy: uma.aptitudes.strategy[strategy],
          },
          gate,
          skills: playerSkills,
        },
      }
    }
    const rival = selected[rivalIndex++]!
    const rivalStrategy = bestStrategy(rival)
    return {
      template: rival,
      display: { templateId: rival.id, isPlayer: false },
      engine: {
        id: rival.id,
        label: String(gate + 1),
        stats: { ...npcStats },
        strategy: rivalStrategy,
        aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const,
        gate,
        skills: [...compiledSupported(content.skills.byId.get(rival.uniqueSkillId ?? '')), ...baselineSkills],
      },
    }
  })
  return {
    engineVersion: 3,
    id: raceAttemptId(uma.templateId, sequence),
    contentVersion: content.manifest.version,
    umaId: uma.templateId,
    raceId: race.id,
    sequence,
    seed,
    strategy,
    startLevel: uma.level,
    startExp: uma.exp,
    startStats: { ...uma.stats },
    raceBonus,
    playerIndex: playerGate,
    input: {
      course: { distance: race.distance, surface: race.surface, season: race.season, layout },
      runners: runners.map((runner) => runner.engine),
      seed,
    },
    runners: runners.map((runner) => runner.display),
  }
}

function sameAttempt(left: PreparedRace, right: PreparedRace): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function resultRecord(
  attempt: PreparedRace,
  race: RaceTemplate,
  uma: UmaSave,
  timeline: RaceTimeline,
  createdAt: number,
): { record: RaceResultRecord; uma: UmaSave; ticketReward: number; shardReward: number } {
  const playerResult = timeline.results.find((result) => result.runner === attempt.playerIndex)
  if (!playerResult) throw new Error('Race result is missing the player')
  const progress = resolveRaceExperience(uma, race.grade, playerResult.placement, attempt.raceBonus)
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
  return {
    uma: progress.uma,
    ticketReward: progress.ticketReward,
    shardReward: progress.shardReward,
    record: {
      engineVersion: 3,
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
      expGained: progress.expGained,
      levelsGained: progress.levelsGained,
      ticketReward: progress.ticketReward,
      shardReward: progress.shardReward,
      field,
      createdAt,
    },
  }
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

export async function readRaceHistory(limit = 20): Promise<RaceResultRecord[]> {
  const rows = await db.raceResults.orderBy('createdAt').reverse().toArray()
  return rows.map(parseHistoryRow).slice(0, limit)
}

async function savedRaceInputs(content: LoadedContent, umaId: string) {
  const profileRow = await db.profile.get('main')
  const umaRow = await db.umas.get(umaId)
  if (!profileRow) throw new Error('Local profile is missing')
  if (!umaRow) throw new Error('Race Uma is not owned')
  const profile = parsePlayerProfileOrThrow(profileRow.data)
  const uma = parsedUma(umaId, umaRow.data)
  const rows = await db.cards.bulkGet(uma.deckCardIds)
  const cardsById = Object.fromEntries(uma.deckCardIds.map((id, index) => {
    const row = rows[index]
    if (!row) throw new Error(`Race deck card is not owned: ${id}`)
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
    if (existing.raceId !== attempt.raceId || existing.seed !== attempt.seed) throw new Error('Race result id collision')
    return { profile, uma, record: existing, timeline: simulatePreparedRace(attempt), alreadyRecorded: true }
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
  const result = resultRecord(attempt, race, uma, timeline, now)
  return {
    profile: {
      ...profile,
      tickets: profile.tickets + result.ticketReward,
      umaShards: profile.umaShards + result.shardReward,
    },
    uma: result.uma,
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
  return db.transaction('rw', [db.profile, db.umas, db.cards, db.raceResults, db.ledger, db.outbox], async () => {
    const existingRow = await db.raceResults.get(attempt.id)
    if (existingRow) {
      const record = parseHistoryRow(existingRow)
      if (record.raceId !== attempt.raceId || record.seed !== attempt.seed) throw new Error('Race result id collision')
      const saved = await savedRaceInputs(content, attempt.umaId)
      return {
        profile: saved.profile,
        uma: saved.uma,
        record,
        timeline: simulatePreparedRace(attempt),
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
    const resolved = resultRecord(attempt, race, uma, timeline, now)
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
    await db.umas.put({ ...umaRow, data: resolved.uma })
    await db.raceResults.add({
      id: attempt.id,
      data: resolved.record as unknown as Record<string, unknown>,
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
    return {
      profile: nextProfile,
      uma: resolved.uma,
      record: resolved.record,
      timeline,
      alreadyRecorded: false,
    }
  })
}

export function raceFormSummary(uma: UmaSave): { player: number; field: number } {
  return { player: yourForm(uma.level), field: fieldForm(uma.level) }
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
