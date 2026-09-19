// Local-first Trainer aggregation and reconciliation (docs/tasks/T018-trainer-achievements-and-profile.md).

import {
  createTrainerBadgeState,
  parseBadgeState,
  parseCardSave,
  parseLedgerEntry,
  parseRaceResultRecord,
  parseUmaSave,
  raceAttemptId,
  reconcileTrainerState,
  trainerUmaAwardRef,
  awardRefsForState,
  createUmaBadgeState,
  type BadgeStateV1,
  type CardSave,
  type FlairEventRecord,
  type LedgerEntry,
  type RaceResultRecord,
  type TrainerBadgeStateV1,
  type UmaBadgeStateV1,
  type UmaSave,
} from '@racer/domain'
import type { LoadedContent } from '../content/runtime'
import { appendFlairEvents } from './badges'
import { db } from './db'
import { queueInTransaction } from './persistence'

export interface TrainerMutation {
  state: TrainerBadgeStateV1
  events: FlairEventRecord[]
  changed: boolean
}

function parseUma(id: string, value: unknown): UmaSave {
  const parsed = parseUmaSave(value)
  if (!parsed || parsed.templateId !== id) throw new Error(`Invalid Trainer Uma contributor: ${id}`)
  return parsed
}

function parseCard(id: string, value: unknown): CardSave {
  const parsed = parseCardSave(value)
  if (!parsed || parsed.templateId !== id) throw new Error(`Invalid Trainer Card contributor: ${id}`)
  return parsed
}

function parseRace(id: string, value: unknown, createdAt: number): RaceResultRecord {
  const parsed = parseRaceResultRecord(value)
  if (!parsed || raceAttemptId(parsed.umaId, parsed.sequence) !== id || parsed.createdAt !== createdAt) {
    throw new Error(`Invalid Trainer race contributor: ${id}`)
  }
  return parsed
}

function parseLedger(id: string, value: unknown, createdAt: number): { id: string; data: LedgerEntry } {
  const parsed = parseLedgerEntry(value)
  if (!parsed || parsed.createdAt !== createdAt) throw new Error(`Invalid Trainer ledger contributor: ${id}`)
  return { id, data: parsed }
}

export function trainerAllowedAwardRefs(states: readonly BadgeStateV1[]): Set<string> {
  const refs = new Set<string>()
  for (const state of states) {
    if (state.scope === 'trainer') awardRefsForState(state).forEach((ref) => refs.add(ref))
    else awardRefsForState(state).forEach((ref) => refs.add(trainerUmaAwardRef(state.umaId, ref)))
  }
  return refs
}

export async function reconcileTrainerInTransaction(
  content: LoadedContent,
  now: number,
  retroactive: boolean,
  sourceId?: string,
): Promise<TrainerMutation> {
  const [trainerRow, umaRows, cardRows, badgeRows, ledgerRows, raceRows] = await Promise.all([
    db.badges.get('trainer'),
    db.umas.toArray(),
    db.cards.toArray(),
    db.badges.toArray(),
    db.ledger.toArray(),
    db.raceResults.toArray(),
  ])
  const state = trainerRow ? parseBadgeState(trainerRow.data) : createTrainerBadgeState(now)
  if (!state || state.scope !== 'trainer') throw new Error('Invalid local Trainer badge state')
  const contributors = badgeRows.flatMap((row): UmaBadgeStateV1[] => {
    if (row.id === 'trainer') return []
    const parsed = parseBadgeState(row.data)
    if (!parsed || parsed.scope !== 'uma' || row.id !== `uma:${parsed.umaId}`) throw new Error(`Invalid Trainer badge contributor: ${row.id}`)
    return [parsed]
  })
  const contributorIds = new Set(contributors.map((state) => state.umaId))
  for (const row of umaRows) {
    if (contributorIds.has(row.id)) continue
    const state = createUmaBadgeState(parseUma(row.id, row.data), now)
    await db.badges.add({ id: `uma:${row.id}`, version: 0, data: state })
    await queueInTransaction('badges', `uma:${row.id}`, 'upsert', now)
    contributors.push(state)
  }
  contributors.sort((left, right) => left.umaId.localeCompare(right.umaId))
  const result = reconcileTrainerState({
    state,
    contentVersion: content.manifest.version,
    umas: content.umas.items,
    cards: content.cards.items,
    races: content.races.items,
    ownedUmas: umaRows.map((row) => parseUma(row.id, row.data)),
    ownedCards: cardRows.map((row) => parseCard(row.id, row.data)),
    contributors,
    ledger: ledgerRows.map((row) => parseLedger(row.id, row.data, row.createdAt)),
    raceResults: raceRows.map((row) => parseRace(row.id, row.data, row.createdAt)),
    now,
    retroactive,
    sourceId,
  })
  if (!trainerRow || result.changed) {
    await db.badges.put({ id: 'trainer', version: trainerRow?.version ?? 0, data: result.state })
    await queueInTransaction('badges', 'trainer', 'upsert', now)
  }
  await appendFlairEvents(result.events, now)
  return result
}

export async function reconcileTrainerPersistent(
  content: LoadedContent,
  now: number,
  retroactive = false,
  sourceId?: string,
): Promise<TrainerMutation> {
  return db.transaction('rw', [db.umas, db.cards, db.badges, db.raceResults, db.ledger, db.flairEvents, db.outbox], () =>
    reconcileTrainerInTransaction(content, now, retroactive, sourceId))
}

export function reconcileTrainerMemory(input: {
  content: LoadedContent
  state: TrainerBadgeStateV1
  umas: readonly UmaSave[]
  cards: readonly CardSave[]
  badges: readonly BadgeStateV1[]
  ledger: readonly { id: string; data: LedgerEntry }[]
  raceResults: readonly RaceResultRecord[]
  now: number
  retroactive: boolean
  sourceId?: string
}): TrainerMutation {
  const contributors = input.badges.filter((state): state is UmaBadgeStateV1 => state.scope === 'uma')
  return reconcileTrainerState({
    state: input.state,
    contentVersion: input.content.manifest.version,
    umas: input.content.umas.items,
    cards: input.content.cards.items,
    races: input.content.races.items,
    ownedUmas: input.umas,
    ownedCards: input.cards,
    contributors,
    ledger: input.ledger,
    raceResults: input.raceResults,
    now: input.now,
    retroactive: input.retroactive,
    sourceId: input.sourceId,
  })
}
