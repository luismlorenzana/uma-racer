// Local-first badge facts, award evaluation, and flair log persistence (docs/design/badges.md#catalog-v1).

import {
  applyDynastyFact,
  applyLegacyFact,
  applyParentedStartFact,
  applyRaceBadgeFacts,
  applyScenarioCompletionFact,
  applyTrainingBadgeFacts,
  activeScenario,
  MAX_TRAINING_LEVEL,
  type TrainingBadgeSnapshot,
  constellationTemplate,
  deriveUma,
  type BadgeSubject,
  type CardSave,
  type StatKey,
  type Stats,
  badgeStateId,
  buildUmaFlairCatalog,
  createUmaBadgeState,
  evaluateUmaFlair,
  flairSourceId,
  parseBadgeState,
  parseFlairEvent,
  parseRaceResultRecord,
  parseUmaSave,
  raceAttemptId,
  tierOfLevel,
  type RaceAccomplishmentFactsV1,
  type RaceResultRecord,
  type BadgeStateV1,
  type FlairEventRecord,
  type FlairTrigger,
  type ScenarioCompletionFact,
  type UmaBadgeStateV1,
  type UmaSave,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { db, type LogRow } from './db'

/**
 * Badge facts read derived stats and the derived library, so building a state needs content. Without card
 * saves a subject reports base stats, which is honest for a state created before anything is configured.
 */
export function badgeSubject(
  content: LoadedContent,
  uma: UmaSave,
  cardSaves: Readonly<Record<string, CardSave>> = {},
): BadgeSubject {
  const template = content.umas.byId.get(uma.templateId)
  if (!template) throw new Error(`Badge Uma content is missing: ${uma.templateId}`)
  const derived = deriveUma({
    uma,
    umaTemplate: template,
    cardSaves: new Map(Object.entries(cardSaves)),
    cardTemplates: content.cards.byId,
    umaTemplates: content.umas.byId,
  })
  return { tier: derived.tier, trainingLevel: derived.trainingLevel, stats: derived.stats, library: derived.library }
}

/** Lineage template ids currently slotted in an Uma's active constellation (D123). */
export function lineageIds(uma: UmaSave): { parents: string[]; grandparents: string[] } {
  const run = activeScenario(uma)
  const template = constellationTemplate(run.tier)
  const idsFor = (kind: 'parent' | 'grandparent') => [...new Set(template.nodes
    .filter((node) => node.kind === kind)
    .map((node) => run.assignments[node.id])
    .flatMap((assignment) => (assignment?.kind === 'lineage' ? [assignment.templateId] : [])))].sort()
  return { parents: idsFor('parent'), grandparents: idsFor('grandparent') }
}
import { queueInTransaction } from './persistence'
import { projectLegacyAccomplishmentFacts } from './race-facts'

export interface UmaFlairMutation {
  state: UmaBadgeStateV1
  events: FlairEventRecord[]
}

export interface ScenarioFlairMutation {
  states: Record<string, BadgeStateV1>
  events: FlairEventRecord[]
}

function parseUmaRow(id: string, value: unknown): UmaSave {
  const uma = parseUmaSave(value)
  if (!uma || uma.templateId !== id) throw new Error(`Invalid local Uma save: ${id}`)
  return uma
}

function parseRaceRow(row: LogRow): RaceResultRecord {
  const record = parseRaceResultRecord(row.data)
  if (!record || row.id !== raceAttemptId(record.umaId, record.sequence) || row.createdAt !== record.createdAt) {
    throw new Error(`Invalid local race result: ${row.id}`)
  }
  return record
}

export async function readUmaBadgeState(uma: UmaSave, subject: BadgeSubject, now: number): Promise<{ id: string; version: number; state: UmaBadgeStateV1 }> {
  const id = badgeStateId(uma.templateId)
  const row = await db.badges.get(id)
  if (!row) return { id, version: 0, state: createUmaBadgeState(uma, subject, now) }
  const parsed = parseBadgeState(row.data)
  if (!parsed || parsed.scope !== 'uma' || parsed.umaId !== uma.templateId) throw new Error(`Invalid local badge state: ${id}`)
  return { id, version: row.version, state: parsed }
}

export async function putUmaBadgeState(
  id: string,
  version: number,
  state: UmaBadgeStateV1,
  now: number,
): Promise<void> {
  const parsed = parseBadgeState(state)
  if (!parsed || parsed.scope !== 'uma' || badgeStateId(parsed.umaId) !== id) throw new Error('Badge transition produced invalid state')
  await db.badges.put({ id, version, data: parsed })
  await queueInTransaction('badges', id, 'upsert', now)
}

/**
 * Records newly earned flair. An event id names one award, so an id already recorded is that award earned before: the
 * first copy stands and the repeat is dropped (D156), as the server treats every append-only log (D149). A repeat
 * happens when a badge state is restored from an older copy and its awards are earned again with a later date.
 */
export async function appendFlairEvents(events: readonly FlairEventRecord[], queuedAt: number): Promise<void> {
  for (const event of events) {
    const parsed = parseFlairEvent(event.data)
    if (!parsed || parsed.earnedAt !== event.data.earnedAt) throw new Error(`Flair event is invalid: ${event.id}`)
    if (await db.flairEvents.get(event.id)) continue
    await db.flairEvents.add({ id: event.id, data: parsed, createdAt: parsed.earnedAt })
    await queueInTransaction('flairEvents', event.id, 'append', queuedAt)
  }
}

export function evaluateUmaBadgeState(
  content: LoadedContent,
  state: UmaBadgeStateV1,
  trigger: FlairTrigger,
  courseRecordIds?: ReadonlySet<string>,
  courseRecordSources?: ReadonlyMap<string, { resultId: string; achievedAt: number }>,
): UmaFlairMutation {
  return evaluateUmaFlair(buildUmaFlairCatalog({
    state,
    races: content.races.items,
    courseRecordIds,
    courseRecordSources,
  }), state, trigger)
}

async function persistEvaluation(
  id: string,
  version: number,
  evaluation: UmaFlairMutation,
  queuedAt: number,
): Promise<void> {
  await putUmaBadgeState(id, version, evaluation.state, queuedAt)
  await appendFlairEvents(evaluation.events, queuedAt)
}

/** An Uma's Spark Match runs per scenario, from the synced ledger's run ids, `spark-match:<uma>:<tier>:<attempt>`. */
export async function sparkRunsByTier(umaId: string): Promise<Map<number, number>> {
  const prefix = `spark-match:${umaId}:`
  const runs = new Map<number, number>()
  for (const id of await db.ledger.where('id').startsWith(prefix).primaryKeys()) {
    const tier = Number(String(id).slice(prefix.length).split(':')[0])
    if (Number.isSafeInteger(tier) && tier >= 1) runs.set(tier, (runs.get(tier) ?? 0) + 1)
  }
  return runs
}

/** What her save and her runs say about her training (T056): the runs, each TL10, and each constellation filled. */
export function trainingSnapshot(uma: UmaSave, runsByTier: ReadonlyMap<number, number>): TrainingBadgeSnapshot {
  const full = (run: UmaSave['scenarios'][number]) => constellationTemplate(run.tier).nodes
    .filter((node) => node.kind === 'card' || node.kind === 'stat')
    .every((node) => run.assignments[node.id] !== undefined)
  return {
    runsByTier,
    fullyTrainedTiers: uma.scenarios.filter((run) => run.trainingLevel >= MAX_TRAINING_LEVEL).map((run) => run.tier),
    fullTreeTiers: uma.scenarios.filter(full).map((run) => run.tier),
  }
}

/**
 * Brings an Uma's training facts up to date and awards what they earn (T056), inside the caller's transaction, which
 * must cover badges, ledger, flair events and the outbox. Does nothing when nothing changed.
 */
export async function updateTrainingBadgeFacts(input: { content: LoadedContent; uma: UmaSave; sourceId: string; now: number }): Promise<void> {
  const row = await readUmaBadgeState(input.uma, badgeSubject(input.content, input.uma), input.now)
  const next = applyTrainingBadgeFacts(row.state, trainingSnapshot(input.uma, await sparkRunsByTier(input.uma.templateId)))
  if (next === row.state && row.version > 0) return
  const evaluation = evaluateUmaBadgeState(input.content, next, {
    source: { kind: 'training', id: input.sourceId, tier: input.uma.unlockedTier },
    earnedAt: input.now,
    retroactive: false,
  })
  await persistEvaluation(row.id, row.version, evaluation, input.now)
}

/** Create every missing per-Uma state from authoritative local history in one resumable transaction. */
export async function bootstrapBadgeFacts(content: LoadedContent, now: number): Promise<number> {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Badge bootstrap time is invalid')
  return db.transaction('rw', [db.umas, db.badges, db.raceResults, db.ledger, db.outbox], async () => {
    const umaRows = await db.umas.toArray()
    const raceRows = await db.raceResults.toArray()
    const histories = raceRows.map(parseRaceRow)
    const states = new Map<string, { version: number; state: UmaBadgeStateV1; created: boolean; dirty: boolean }>()
    for (const row of umaRows) {
      const uma = parseUmaRow(row.id, row.data)
      const id = badgeStateId(row.id)
      const existing = await db.badges.get(id)
      if (existing) {
        const parsed = parseBadgeState(existing.data)
        if (!parsed || parsed.scope !== 'uma' || parsed.umaId !== row.id) throw new Error(`Invalid local badge state: ${id}`)
        states.set(row.id, { version: existing.version, state: parsed, created: false, dirty: false })
        continue
      }
      let state = createUmaBadgeState(uma, badgeSubject(content, uma), now)
      const results = histories.filter((record) => record.umaId === row.id)
        .sort((left, right) => left.sequence - right.sequence || raceAttemptId(left.umaId, left.sequence).localeCompare(raceAttemptId(right.umaId, right.sequence)))
      results.forEach((record, index) => {
        if (record.sequence !== index) throw new Error(`Race history sequence is incomplete for ${row.id}`)
        state = applyRaceBadgeFacts(state, raceAttemptId(record.umaId, record.sequence), record, projectLegacyAccomplishmentFacts(content, record))
      })
      states.set(row.id, { version: 0, state, created: true, dirty: true })
    }

    // Lineage evidence is whatever is slotted right now; discarded selections were never recorded.
    for (const row of umaRows) {
      const child = parseUmaRow(row.id, row.data)
      const childEntry = states.get(child.templateId)!
      const { parents } = lineageIds(child)
      if (parents.length === 0) continue
      const next = applyParentedStartFact(childEntry.state, child.unlockedTier, parents, now)
      childEntry.dirty ||= next !== childEntry.state
      childEntry.state = next
      for (const parentId of parents) {
        const parentEntry = states.get(parentId)
        if (!parentEntry) continue
        const parentNext = applyLegacyFact(parentEntry.state, child.templateId, child.unlockedTier, now)
        parentEntry.dirty ||= parentNext !== parentEntry.state
        parentEntry.state = parentNext
      }
    }

    // Training facts come from the ledger and the saves, so every state with training to count, old or new, is brought
    // up to date (T056); one with none is left alone rather than rewritten and synced for nothing.
    for (const row of umaRows) {
      const uma = parseUmaRow(row.id, row.data)
      const entry = states.get(uma.templateId)!
      const snapshot = trainingSnapshot(uma, await sparkRunsByTier(uma.templateId))
      if (snapshot.runsByTier.size === 0 && snapshot.fullyTrainedTiers.length === 0 && snapshot.fullTreeTiers.length === 0) continue
      const next = applyTrainingBadgeFacts(entry.state, snapshot)
      entry.dirty ||= next !== entry.state
      entry.state = next
    }

    let created = 0
    for (const [umaId, entry] of [...states].sort(([left], [right]) => left.localeCompare(right))) {
      if (!entry.dirty) continue
      await putUmaBadgeState(badgeStateId(umaId), entry.version, entry.state, now)
      if (entry.created) created += 1
    }
    return created
  })
}

function strictCourseRecords(
  content: LoadedContent,
  histories: readonly RaceResultRecord[],
  umaId: string,
): Map<string, { resultId: string; achievedAt: number }> {
  const bests = new Map<string, number>()
  const records = new Map<string, { resultId: string; achievedAt: number }>()
  const ordered = histories.filter((record) => record.umaId === umaId)
    .sort((left, right) => left.sequence - right.sequence || raceAttemptId(left.umaId, left.sequence).localeCompare(raceAttemptId(right.umaId, right.sequence)))
  for (const [index, record] of ordered.entries()) {
    if (record.sequence !== index) throw new Error(`Race history sequence is incomplete for ${umaId}`)
    const facts = projectLegacyAccomplishmentFacts(content, record)
    const player = record.field.find((entry) => entry.isPlayer)
    if (!facts || !player) continue
    const prior = bests.get(facts.courseId)
    if (prior !== undefined && player.finishTime < prior && !records.has(facts.courseId)) {
      records.set(facts.courseId, {
        resultId: raceAttemptId(record.umaId, record.sequence),
        achievedAt: record.createdAt,
      })
    }
    if (prior === undefined || player.finishTime < prior) bests.set(facts.courseId, player.finishTime)
  }
  return records
}

/** Reconcile every Uma against the current catalog in one event-idempotent transaction. */
export async function bootstrapUmaFlair(content: LoadedContent, now: number): Promise<number> {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Flair bootstrap time is invalid')
  return db.transaction('rw', [db.badges, db.raceResults, db.flairEvents, db.outbox], async () => {
    const histories = (await db.raceResults.toArray()).map(parseRaceRow)
    const rows = await db.badges.toArray()
    let awardCount = 0
    for (const row of rows.sort((left, right) => left.id.localeCompare(right.id))) {
      const parsed = parseBadgeState(row.data)
      if (!parsed || parsed.scope !== 'uma' || badgeStateId(parsed.umaId) !== row.id) {
        if (parsed?.scope === 'trainer') continue
        throw new Error(`Invalid local badge state: ${row.id}`)
      }
      const courseRecords = strictCourseRecords(content, histories, parsed.umaId)
      const evaluation = evaluateUmaBadgeState(
        content,
        parsed,
        { source: { kind: 'migration', id: null, tier: null }, earnedAt: now, retroactive: true },
        new Set(courseRecords.keys()),
        courseRecords,
      )
      if (JSON.stringify(evaluation.state) === JSON.stringify(parsed) && evaluation.events.length === 0) continue
      await persistEvaluation(row.id, row.version, evaluation, now)
      awardCount += evaluation.events.length
    }
    return awardCount
  })
}

export function updateMemoryRaceBadgeFacts(input: {
  content: LoadedContent
  state: UmaBadgeStateV1
  umaBefore: UmaSave
  umaAfter: UmaSave
  resultId: string
  record: RaceResultRecord
  facts: RaceAccomplishmentFactsV1
  now: number
}): UmaFlairMutation {
  let facts = applyRaceBadgeFacts(input.state, input.resultId, input.record, input.facts)
  facts = {
    ...facts,
    facts: {
      ...facts.facts,
      levelPeak: Math.max(facts.facts.levelPeak, input.umaAfter.level),
      statPeaks: Object.fromEntries(Object.entries(facts.facts.statPeaks).map(([key, value]) => [
        key,
        Math.max(value, input.record.startStats[key as StatKey]),
      ])) as Stats,
    },
  }
  const courseRecordIds = courseRecordIdsForResult(input.state, input.facts, input.record)
  const evaluation = evaluateUmaBadgeState(input.content, facts, {
    source: { kind: 'race', id: input.resultId, tier: tierOfLevel(input.record.startLevel) },
    earnedAt: input.now,
    retroactive: false,
  }, courseRecordIds)
  return evaluation
}

export function courseRecordIdsForResult(
  state: UmaBadgeStateV1,
  facts: RaceAccomplishmentFactsV1,
  record: RaceResultRecord,
): ReadonlySet<string> | undefined {
  const priorBest = state.facts.courseBests.find((entry) => entry.courseId === facts.courseId)
  const player = record.field.find((entry) => entry.isPlayer)
  if (!player) throw new Error('Race badge facts are missing the player')
  return priorBest && player.finishTime < priorBest.finishTime ? new Set([facts.courseId]) : undefined
}

export async function updateRaceBadgeFacts(input: {
  content: LoadedContent
  umaBefore: UmaSave
  umaAfter: UmaSave
  resultId: string
  record: RaceResultRecord
  facts: RaceAccomplishmentFactsV1
  now: number
}): Promise<UmaFlairMutation> {
  const row = await readUmaBadgeState(input.umaBefore, badgeSubject(input.content, input.umaBefore), input.now)
  const evaluation = updateMemoryRaceBadgeFacts({ ...input, state: row.state })
  await persistEvaluation(row.id, row.version, evaluation, input.now)
  return evaluation
}

export function scenarioCompletionFact(input: {
  uma: UmaSave
  content: LoadedContent
  badgeState: UmaBadgeStateV1
  subject: BadgeSubject
  tier: number
  completedAt: number
}): ScenarioCompletionFact {
  const journey = input.uma.scenarios.find((entry) => entry.tier === input.tier)?.journey
  const completedGoalIds = journey?.tracking === 'tracked'
    ? journey.goals.filter((goal) => goal.status === 'completed').map((goal) => goal.id).sort()
    : []
  const run = input.uma.scenarios.find((entry) => entry.tier === input.tier) ?? activeScenario(input.uma)
  const cardSetIds = [...run.cardSetIds]
  const deckEras = cardSetIds.map((id) => {
    const card = input.content.cards.byId.get(id)
    if (!card) throw new Error(`Scenario completion is missing card content: ${id}`)
    return card.era
  })
  const lineage = lineageIds(input.uma)
  return {
    tier: input.tier,
    completedAt: input.completedAt,
    trainingLevel: run.trainingLevel,
    stats: { ...input.subject.stats },
    deckCardIds: cardSetIds,
    deckEras,
    // Training turns no longer exist; the fact keeps its shape as a permanent zero (D120).
    trainingTurns: 0,
    friendshipTrainings: 0,
    raceStarts: input.badgeState.facts.starts - input.badgeState.facts.completions.reduce((sum, fact) => sum + fact.raceStarts, 0),
    completedGoalIds,
    honors: journey?.tracking === 'tracked' && journey.goals.length > 0 && completedGoalIds.length === journey.goals.length,
    parentUmaIds: lineage.parents,
    grandparentUmaIds: lineage.grandparents,
  }
}

/** Mirror the persistent multi-Uma transition when IndexedDB is unavailable. */
export function updateMemoryScenarioBadgeFacts(input: {
  content: LoadedContent
  before: UmaSave
  after: UmaSave
  completedTier: number | null
  badges: Readonly<Record<string, BadgeStateV1>>
  umas: Readonly<Record<string, UmaSave>>
  now: number
}): ScenarioFlairMutation {
  const next = { ...input.badges }
  const changedIds = new Set<string>()
  const read = (umaId: string): UmaBadgeStateV1 | null => {
    const current = next[badgeStateId(umaId)]
    if (current?.scope === 'uma') return current
    const uma = input.umas[umaId]
    return uma ? createUmaBadgeState(uma, badgeSubject(input.content, uma), input.now) : null
  }
  const childId = badgeStateId(input.before.templateId)
  const childPrior = read(input.before.templateId)
  if (!childPrior) throw new Error('Memory child badge state is missing')
  const afterLineage = lineageIds(input.after)
  let child = applyParentedStartFact(childPrior, input.after.unlockedTier, afterLineage.parents, input.now)
  if (input.completedTier !== null) {
    child = applyScenarioCompletionFact(child, scenarioCompletionFact({
      uma: input.before,
      content: input.content,
      badgeState: child,
      subject: badgeSubject(input.content, input.before),
      tier: input.completedTier,
      completedAt: input.now,
    }))
  }
  next[childId] = child
  changedIds.add(input.before.templateId)
  for (const parentId of afterLineage.parents) {
    const parentState = read(parentId)
    if (parentState) {
      next[badgeStateId(parentId)] = applyLegacyFact(parentState, input.before.templateId, input.after.unlockedTier, input.now)
      changedIds.add(parentId)
    }
  }
  if (input.completedTier !== null) {
    for (const grandparentId of lineageIds(input.before).grandparents) {
      const grandparentState = read(grandparentId)
      if (grandparentState) {
        next[badgeStateId(grandparentId)] = applyDynastyFact(
          grandparentState,
          input.before.templateId,
          input.completedTier,
          input.now,
        )
        changedIds.add(grandparentId)
      }
    }
  }
  const tier = input.completedTier ?? tierOfLevel(input.after.level)
  const events: FlairEventRecord[] = []
  for (const umaId of [...changedIds].sort((left, right) => left.localeCompare(right))) {
    const current = next[badgeStateId(umaId)]
    if (!current || current.scope !== 'uma') throw new Error(`Memory badge state is missing: ${umaId}`)
    const evaluation = evaluateUmaBadgeState(input.content, current, {
      source: { kind: 'scenario', id: flairSourceId('scenario', input.before.templateId, String(tier)), tier },
      earnedAt: input.now,
      retroactive: false,
    })
    next[badgeStateId(umaId)] = evaluation.state
    events.push(...evaluation.events)
  }
  return { states: next, events }
}

export async function updateScenarioBadgeFacts(input: {
  content: LoadedContent
  before: UmaSave
  after: UmaSave
  completedTier: number | null
  now: number
}): Promise<ScenarioFlairMutation> {
  const changed = new Map<string, { id: string; version: number; state: UmaBadgeStateV1 }>()
  const childSubject = badgeSubject(input.content, input.before)
  const childRow = await readUmaBadgeState(input.before, childSubject, input.now)
  const afterLineage = lineageIds(input.after)
  let child = applyParentedStartFact(childRow.state, input.after.unlockedTier, afterLineage.parents, input.now)
  if (input.completedTier !== null) {
    child = applyScenarioCompletionFact(child, scenarioCompletionFact({
      uma: input.before,
      content: input.content,
      badgeState: child,
      subject: childSubject,
      tier: input.completedTier,
      completedAt: input.now,
    }))
  }
  changed.set(input.before.templateId, { ...childRow, state: child })
  for (const parentId of afterLineage.parents) {
    const parentUmaRow = await db.umas.get(parentId)
    if (!parentUmaRow) continue
    const saved = parseUmaRow(parentId, parentUmaRow.data)
    const badge = changed.get(parentId) ?? await readUmaBadgeState(saved, badgeSubject(input.content, saved), input.now)
    badge.state = applyLegacyFact(badge.state, input.before.templateId, input.after.unlockedTier, input.now)
    changed.set(parentId, badge)
  }
  if (input.completedTier !== null) {
    for (const grandparentId of lineageIds(input.before).grandparents) {
      const grandparentUmaRow = await db.umas.get(grandparentId)
      if (!grandparentUmaRow) continue
      const saved = parseUmaRow(grandparentId, grandparentUmaRow.data)
      const badge = changed.get(grandparentId) ?? await readUmaBadgeState(saved, badgeSubject(input.content, saved), input.now)
      badge.state = applyDynastyFact(badge.state, input.before.templateId, input.completedTier, input.now)
      changed.set(grandparentId, badge)
    }
  }
  const tier = input.completedTier ?? input.after.unlockedTier
  const events: FlairEventRecord[] = []
  for (const [umaId, entry] of [...changed].sort(([left], [right]) => left.localeCompare(right))) {
    const evaluation = evaluateUmaBadgeState(input.content, entry.state, {
      source: { kind: 'scenario', id: flairSourceId('scenario', input.before.templateId, String(tier)), tier },
      earnedAt: input.now,
      retroactive: false,
    })
    await persistEvaluation(entry.id, entry.version, evaluation, input.now)
    entry.state = evaluation.state
    events.push(...evaluation.events)
    changed.set(umaId, entry)
  }
  return { states: Object.fromEntries([...changed].map(([id, entry]) => [id, entry.state])), events }
}
