// Local-first badge fact persistence and bootstrap (docs/tasks/T015-accomplishment-facts-and-badge-state.md).

import {
  applyDynastyFact,
  applyLegacyFact,
  applyParentedStartFact,
  applyRaceBadgeFacts,
  applyScenarioCompletionFact,
  applyTrainingBadgeFacts,
  badgeStateId,
  createUmaBadgeState,
  parseBadgeState,
  parseRaceResultRecord,
  parseUmaSave,
  raceAttemptId,
  tierOfLevel,
  type RaceAccomplishmentFactsV1,
  type RaceResultRecord,
  type BadgeStateV1,
  type ScenarioCompletionFact,
  type UmaBadgeStateV1,
  type UmaSave,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { db, type LogRow } from './db'
import { queueInTransaction } from './persistence'
import { projectLegacyAccomplishmentFacts } from './race-facts'

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

export async function readUmaBadgeState(uma: UmaSave, now: number): Promise<{ id: string; version: number; state: UmaBadgeStateV1 }> {
  const id = badgeStateId(uma.templateId)
  const row = await db.badges.get(id)
  if (!row) return { id, version: 0, state: createUmaBadgeState(uma, now) }
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

/** Create every missing per-Uma state from authoritative local history in one resumable transaction. */
export async function bootstrapBadgeFacts(content: LoadedContent, now: number): Promise<number> {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Badge bootstrap time is invalid')
  return db.transaction('rw', [db.umas, db.badges, db.raceResults, db.outbox], async () => {
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
      let state = createUmaBadgeState(uma, now)
      const results = histories.filter((record) => record.umaId === row.id)
        .sort((left, right) => left.sequence - right.sequence || raceAttemptId(left.umaId, left.sequence).localeCompare(raceAttemptId(right.umaId, right.sequence)))
      results.forEach((record, index) => {
        if (record.sequence !== index) throw new Error(`Race history sequence is incomplete for ${row.id}`)
        state = applyRaceBadgeFacts(state, raceAttemptId(record.umaId, record.sequence), record, projectLegacyAccomplishmentFacts(content, record))
      })
      states.set(row.id, { version: 0, state, created: true, dirty: true })
    }

    // Only facts still evidenced by finite active/latest lineage are seeded; earlier discarded selections remain unknown.
    for (const row of umaRows) {
      const child = parseUmaRow(row.id, row.data)
      const childEntry = states.get(child.templateId)!
      const activeTier = tierOfLevel(child.level)
      if (child.currentParents.length > 0) {
        const next = applyParentedStartFact(childEntry.state, activeTier, child.currentParents.map((parent) => parent.umaId), now)
        childEntry.dirty ||= next !== childEntry.state
        childEntry.state = next
        for (const parent of child.currentParents) {
          const parentEntry = states.get(parent.umaId)
          if (parentEntry) {
            const parentNext = applyLegacyFact(parentEntry.state, child.templateId, activeTier, now)
            parentEntry.dirty ||= parentNext !== parentEntry.state
            parentEntry.state = parentNext
          }
        }
      }
      const snapshot = child.parentSnapshot
      if (snapshot) {
        const childNext = applyParentedStartFact(childEntry.state, snapshot.completedTier, snapshot.parents.map((parent) => parent.umaId), snapshot.takenAt)
        childEntry.dirty ||= childNext !== childEntry.state
        childEntry.state = childNext
        for (const parent of snapshot.parents) {
          const parentEntry = states.get(parent.umaId)
          if (parentEntry) {
            const parentNext = applyLegacyFact(parentEntry.state, child.templateId, snapshot.completedTier, snapshot.takenAt)
            parentEntry.dirty ||= parentNext !== parentEntry.state
            parentEntry.state = parentNext
          }
        }
      }
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

export async function updateTrainingBadgeFacts(input: {
  before: UmaSave
  after: UmaSave
  friendship: boolean
  presentCardCount: number
  now: number
}): Promise<UmaBadgeStateV1> {
  const row = await readUmaBadgeState(input.before, input.now)
  const next = applyTrainingBadgeFacts({
    state: row.state,
    before: input.before,
    after: input.after,
    friendship: input.friendship,
    presentCardCount: input.presentCardCount,
  })
  await putUmaBadgeState(row.id, row.version, next, input.now)
  return next
}

export async function updateRaceBadgeFacts(input: {
  umaBefore: UmaSave
  umaAfter: UmaSave
  resultId: string
  record: RaceResultRecord
  facts: RaceAccomplishmentFactsV1
  now: number
}): Promise<UmaBadgeStateV1> {
  const row = await readUmaBadgeState(input.umaBefore, input.now)
  let next = applyRaceBadgeFacts(row.state, input.resultId, input.record, input.facts)
  next = {
    ...next,
    facts: {
      ...next.facts,
      levelPeak: Math.max(next.facts.levelPeak, input.umaAfter.level),
      statPeaks: Object.fromEntries(Object.entries(next.facts.statPeaks).map(([key, value]) => [
        key,
        Math.max(value, input.umaAfter.stats[key as keyof UmaSave['stats']]),
      ])) as UmaSave['stats'],
    },
  }
  await putUmaBadgeState(row.id, row.version, next, input.now)
  return next
}

export function scenarioCompletionFact(input: {
  uma: UmaSave
  content: LoadedContent
  badgeState: UmaBadgeStateV1
  tier: number
  completedAt: number
}): ScenarioCompletionFact {
  const journey = input.uma.scenarioJourneys.find((entry) => entry.tier === input.tier)
  const completedGoalIds = journey?.tracking === 'tracked'
    ? journey.goals.filter((goal) => goal.status === 'completed').map((goal) => goal.id).sort()
    : []
  const training = input.badgeState.facts.trainingByTier.find((entry) => entry.tier === input.tier)
  const deckEras = input.uma.deckCardIds.map((id) => {
    const card = input.content.cards.byId.get(id)
    if (!card) throw new Error(`Scenario completion is missing card content: ${id}`)
    return card.era
  })
  const parentUmaIds = input.uma.currentParents.map((parent) => parent.umaId)
  const grandparentUmaIds = [...new Set(input.uma.currentParents.flatMap((parent) => parent.parents.map((grandparent) => grandparent.umaId)))].sort()
  return {
    tier: input.tier,
    completedAt: input.completedAt,
    trainingLevel: input.uma.trainingLevel,
    stats: { ...input.uma.stats },
    deckCardIds: [...input.uma.deckCardIds],
    deckEras,
    trainingTurns: training?.turns ?? input.uma.trainingsThisScenario,
    friendshipTrainings: training?.friendshipTrainings ?? 0,
    raceStarts: input.badgeState.facts.starts - input.badgeState.facts.completions.reduce((sum, fact) => sum + fact.raceStarts, 0),
    completedGoalIds,
    honors: completedGoalIds.length === 3,
    parentUmaIds,
    grandparentUmaIds,
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
}): Record<string, BadgeStateV1> {
  const next = { ...input.badges }
  const read = (umaId: string): UmaBadgeStateV1 | null => {
    const current = next[badgeStateId(umaId)]
    if (current?.scope === 'uma') return current
    const uma = input.umas[umaId]
    return uma ? createUmaBadgeState(uma, input.now) : null
  }
  const childId = badgeStateId(input.before.templateId)
  const childPrior = read(input.before.templateId)
  if (!childPrior) throw new Error('Memory child badge state is missing')
  let child = applyParentedStartFact(
    childPrior,
    tierOfLevel(input.after.level),
    input.after.currentParents.map((parent) => parent.umaId),
    input.now,
  )
  if (input.completedTier !== null) {
    child = applyScenarioCompletionFact(child, scenarioCompletionFact({
      uma: input.before,
      content: input.content,
      badgeState: child,
      tier: input.completedTier,
      completedAt: input.now,
    }))
  }
  next[childId] = child
  for (const parent of input.after.currentParents) {
    const parentState = read(parent.umaId)
    if (parentState) next[badgeStateId(parent.umaId)] = applyLegacyFact(
      parentState,
      input.before.templateId,
      tierOfLevel(input.after.level),
      input.now,
    )
  }
  if (input.completedTier !== null) {
    const grandparentIds = [...new Set(input.before.currentParents.flatMap((parent) =>
      parent.parents.map((grandparent) => grandparent.umaId)))]
    for (const grandparentId of grandparentIds) {
      const grandparentState = read(grandparentId)
      if (grandparentState) next[badgeStateId(grandparentId)] = applyDynastyFact(
        grandparentState,
        input.before.templateId,
        input.completedTier,
        input.now,
      )
    }
  }
  return next
}

export async function updateScenarioBadgeFacts(input: {
  content: LoadedContent
  before: UmaSave
  after: UmaSave
  completedTier: number | null
  now: number
}): Promise<Record<string, UmaBadgeStateV1>> {
  const changed = new Map<string, { id: string; version: number; state: UmaBadgeStateV1 }>()
  const childRow = await readUmaBadgeState(input.before, input.now)
  let child = applyParentedStartFact(childRow.state, tierOfLevel(input.after.level), input.after.currentParents.map((parent) => parent.umaId), input.now)
  if (input.completedTier !== null) {
    child = applyScenarioCompletionFact(child, scenarioCompletionFact({
      uma: input.before,
      content: input.content,
      badgeState: child,
      tier: input.completedTier,
      completedAt: input.now,
    }))
  }
  changed.set(input.before.templateId, { ...childRow, state: child })
  for (const parent of input.after.currentParents) {
    const parentUmaRow = await db.umas.get(parent.umaId)
    if (!parentUmaRow) continue
    const saved = parseUmaRow(parent.umaId, parentUmaRow.data)
    const badge = changed.get(parent.umaId) ?? await readUmaBadgeState(saved, input.now)
    badge.state = applyLegacyFact(badge.state, input.before.templateId, tierOfLevel(input.after.level), input.now)
    changed.set(parent.umaId, badge)
  }
  if (input.completedTier !== null) {
    for (const grandparentId of [...new Set(input.before.currentParents.flatMap((parent) => parent.parents.map((grandparent) => grandparent.umaId)))]) {
      const grandparentUmaRow = await db.umas.get(grandparentId)
      if (!grandparentUmaRow) continue
      const saved = parseUmaRow(grandparentId, grandparentUmaRow.data)
      const badge = changed.get(grandparentId) ?? await readUmaBadgeState(saved, input.now)
      badge.state = applyDynastyFact(badge.state, input.before.templateId, input.completedTier, input.now)
      changed.set(grandparentId, badge)
    }
  }
  for (const entry of changed.values()) await putUmaBadgeState(entry.id, entry.version, entry.state, input.now)
  return Object.fromEntries([...changed].map(([id, entry]) => [id, entry.state]))
}
