// Receipt-owned CL facts, never irreversible predicted flair (docs/technical/uma-puzzles-implementation.md §5).
import { applyTrainingBadgeFacts, createTrainerBadgeState, createUmaBadgeState, parseBadgeState, parseLedgerEntry,
  parseRaceResultRecord, parseUmaSaveOrThrow, puzzleCanonical, puzzleData, type BadgeStateV1, type FlairEventRecord } from '@racer/domain'
import type { LoadedContent } from '../../content/runtime'
import { badgeSubject, evaluateUmaBadgeState, trainingSnapshot } from '../badges'
import { RacerDb } from '../db'
import { reconcileTrainerMemory } from '../trainer'
import { canonicalPuzzleUmaForSync } from './operations'

/** Caller includes Uma/card/badge/ledger/race/flair/outbox tables in its economic transaction. */
export async function reconcilePuzzleFlairInTransaction(database: RacerDb, content: LoadedContent, now: number, sourceId: string): Promise<void> {
  const queue = async (kind: 'badges' | 'flairEvents', id: string, op: 'upsert' | 'append') => {
    await database.outbox.where('[kind+id]').equals([kind, id]).delete()
    await database.outbox.add({ kind, id, op, queuedAt: now })
  }
  const append = async (events: readonly FlairEventRecord[]) => {
    for (const event of events) if (!await database.flairEvents.get(event.id)) {
      await database.flairEvents.add({ id: event.id, data: event.data, createdAt: event.data.earnedAt })
      await queue('flairEvents', event.id, 'append')
    }
  }
  const umaRows = await database.umas.toArray(), ledgerRows = await database.ledger.toArray(), states: BadgeStateV1[] = []
  const umas = []
  for (const row of umaRows) {
    const uma = parseUmaSaveOrThrow(await canonicalPuzzleUmaForSync(database, row.id, puzzleData(row.data)))
    umas.push(uma)
    const id = `uma:${row.id}`, prior = await database.badges.get(id)
    const state = prior ? parseBadgeState(prior.data) : createUmaBadgeState(uma, badgeSubject(content, uma), now)
    if (!state || state.scope !== 'uma') throw new Error('Invalid CL badge contributor')
    const runs = new Map<number, number>()
    for (const l of ledgerRows) if (l.id.startsWith(`spark-match:${row.id}:`)) {
      const tier = Number(l.id.slice(`spark-match:${row.id}:`.length).split(':')[0])
      if (Number.isSafeInteger(tier) && tier > 0) runs.set(tier, (runs.get(tier) ?? 0) + 1)
    }
    const facts = applyTrainingBadgeFacts(state, trainingSnapshot(uma, runs))
    const evaluated = evaluateUmaBadgeState(content, facts, { source: { kind: 'training', id: sourceId, tier: uma.unlockedTier }, earnedAt: now, retroactive: false })
    states.push(evaluated.state)
    if (!prior || puzzleCanonical(prior.data) !== puzzleCanonical(evaluated.state)) {
      await database.badges.put({ id, version: prior?.version ?? 0, data: evaluated.state }); await queue('badges', id, 'upsert')
      await append(evaluated.events)
    }
  }
  const trainer = await database.badges.get('trainer'), state = trainer ? parseBadgeState(trainer.data) : createTrainerBadgeState(now)
  if (!state || state.scope !== 'trainer') throw new Error('Invalid CL trainer state')
  const result = reconcileTrainerMemory({ content, state, umas, cards: (await database.cards.toArray()).map(r => r.data), badges: states,
    ledger: ledgerRows.map(r => {
      const data = parseLedgerEntry(r.data); if (!data) throw new Error('Invalid CL trainer ledger')
      return { id: r.id, data }
    }), raceResults: (await database.raceResults.toArray()).map(r => {
      const parsed = parseRaceResultRecord(r.data); if (!parsed) throw new Error('Invalid CL trainer race')
      return parsed
    }), now, retroactive: false, sourceId })
  if (!trainer || result.changed) {
    await database.badges.put({ id: 'trainer', data: result.state, version: trainer?.version ?? 0 }); await queue('badges', 'trainer', 'upsert')
    await append(result.events)
  }
}
