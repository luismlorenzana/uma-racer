// Atomic local-first scenario start and advance (docs/design/uma-progression.md).

import {
  activeScenario,
  advanceScenario,
  deriveUma,
  parsePlayerProfileOrThrow,
  parseUmaSave,
  scenarioAdvanceReadiness,
  startScenario,
  type BadgeStateV1,
  type CardSave,
  type PlayerProfile,
  type ScenarioAdvanceResult,
  type UmaSave,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { db } from './db'
import { updateScenarioBadgeFacts } from './badges'
import { reconcileTrainerInTransaction } from './trainer'
import { queueInTransaction } from './persistence'

export interface ScenarioMutation {
  profile: PlayerProfile
  uma: UmaSave
  /** Null when the scenario was already started, which makes the action idempotent. */
  result: ScenarioAdvanceResult | null
  alreadyStarted: boolean
  badgeStates?: Record<string, BadgeStateV1>
  earnedFlairEventIds: string[]
}

/** Aptitudes the new run's goals are frozen against, derived from its (empty) constellation. */
function aptitudesFor(
  content: LoadedContent,
  uma: UmaSave,
  cardsById: Readonly<Record<string, CardSave>>,
) {
  const template = content.umas.byId.get(uma.templateId)
  if (!template) throw new Error(`Scenario Uma content is missing: ${uma.templateId}`)
  return deriveUma({
    uma,
    umaTemplate: template,
    cardSaves: new Map(Object.entries(cardsById)),
    cardTemplates: content.cards.byId,
    umaTemplates: content.umas.byId,
    skillTemplates: content.skills.byId,
  }).aptitudes
}

export function startMemoryScenario(
  content: LoadedContent,
  profile: PlayerProfile,
  uma: UmaSave,
  cardsById: Readonly<Record<string, CardSave>>,
): ScenarioMutation {
  const template = content.umas.byId.get(uma.templateId)
  if (!template) throw new Error(`Scenario Uma content is missing: ${uma.templateId}`)
  if (activeScenario(uma).started) {
    return { profile, uma, result: null, alreadyStarted: true, earnedFlairEventIds: [] }
  }
  const started = startScenario({
    uma,
    umaTemplate: template,
    aptitudes: aptitudesFor(content, uma, cardsById),
    races: content.races.items,
  })
  return { profile, uma: started, result: null, alreadyStarted: false, earnedFlairEventIds: [] }
}

export function advanceMemoryUma(
  content: LoadedContent,
  profile: PlayerProfile,
  uma: UmaSave,
  cardsById: Readonly<Record<string, CardSave>>,
  now: number,
): ScenarioMutation {
  const template = content.umas.byId.get(uma.templateId)
  if (!template) throw new Error(`Scenario Uma content is missing: ${uma.templateId}`)
  const result = advanceScenario({
    profile,
    uma,
    umaTemplate: template,
    // The next tier opens with nothing configured, so its goals see her base aptitudes.
    aptitudes: aptitudesFor(content, uma, cardsById),
    races: content.races.items,
    now,
  })
  return {
    profile: result.profile,
    uma: result.uma,
    result,
    alreadyStarted: false,
    earnedFlairEventIds: [],
  }
}

async function readState(umaId: string) {
  const profileRow = await db.profile.get('main')
  const umaRow = await db.umas.get(umaId)
  if (!profileRow) throw new Error('Local profile is missing')
  if (!umaRow) throw new Error('Scenario Uma is not owned')
  const uma = parseUmaSave(umaRow.data)
  if (!uma || uma.templateId !== umaId) throw new Error(`Invalid local Uma save: ${umaId}`)
  return { profileRow, umaRow, profile: parsePlayerProfileOrThrow(profileRow.data), uma }
}

async function ownedCards(): Promise<Record<string, CardSave>> {
  const rows = await db.cards.toArray()
  return Object.fromEntries(rows.map((row) => [row.id, row.data as CardSave]))
}

/** Confirms the active scenario's start, freezing its goals. Safe to call twice. */
export async function startPersistentScenario(
  content: LoadedContent,
  umaId: string,
  now: number,
): Promise<ScenarioMutation> {
  return db.transaction('rw', [db.profile, db.umas, db.cards, db.badges, db.raceResults, db.ledger, db.flairEvents, db.outbox], async () => {
    const { umaRow, profile, uma } = await readState(umaId)
    const mutation = startMemoryScenario(content, profile, uma, await ownedCards())
    if (mutation.alreadyStarted) return mutation

    await db.umas.put({ ...umaRow, data: mutation.uma })
    await queueInTransaction('umas', umaId, 'upsert', now)
    const flair = await updateScenarioBadgeFacts({ content, before: uma, after: mutation.uma, completedTier: null, now })
    const trainer = await reconcileTrainerInTransaction(content, now, false, `scenario:${umaId}:${now}`)
    return {
      ...mutation,
      badgeStates: { ...flair.states, trainer: trainer.state },
      earnedFlairEventIds: [...flair.events, ...trainer.events].map((event) => event.id),
    }
  })
}

/** Unlocks the next scenario: spends tickets, opens a fresh run, and closes the old journey. */
export async function advancePersistentUma(
  content: LoadedContent,
  umaId: string,
  now: number,
): Promise<ScenarioMutation> {
  return db.transaction('rw', [db.profile, db.umas, db.cards, db.badges, db.raceResults, db.ledger, db.flairEvents, db.outbox], async () => {
    const { profileRow, umaRow, profile, uma } = await readState(umaId)
    const readiness = scenarioAdvanceReadiness(profile, uma)
    if (!readiness.ready) throw new Error(readiness.reason ?? 'This Uma cannot advance yet')

    const mutation = advanceMemoryUma(content, profile, uma, await ownedCards(), now)
    const result = mutation.result!

    // The ledger id is the idempotency key: a retry after a partial write cannot spend twice.
    const ledgerRows = await db.ledger.bulkGet(result.ledger.map((entry) => entry.id))
    if (ledgerRows.some((row) => row !== undefined)) throw new Error('This scenario advance was already recorded')

    await db.profile.put({ ...profileRow, data: mutation.profile })
    await queueInTransaction('profile', 'main', 'upsert', now)
    for (const entry of result.ledger) {
      await db.ledger.add({ id: entry.id, data: entry.data, createdAt: entry.data.createdAt })
      await queueInTransaction('ledger', entry.id, 'append', now)
    }
    await db.umas.put({ ...umaRow, data: mutation.uma })
    await queueInTransaction('umas', umaId, 'upsert', now)

    const flair = await updateScenarioBadgeFacts({
      content,
      before: uma,
      after: mutation.uma,
      completedTier: result.fromTier,
      now,
    })
    const trainer = await reconcileTrainerInTransaction(content, now, false, `scenario:${umaId}:${now}`)
    return {
      ...mutation,
      badgeStates: { ...flair.states, trainer: trainer.state },
      earnedFlairEventIds: [...flair.events, ...trainer.events].map((event) => event.id),
    }
  })
}
