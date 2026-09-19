// Atomic local-first Badge preference commands (docs/tasks/T017-badge-page-showcases-and-timeline.md).

import {
  awardRefsForState,
  badgeStateId,
  createTrainerBadgeState,
  parseBadgeState,
  replaceBadgePreferences,
  replaceTrainerPreferences,
  type BadgePreferences,
  type BadgeStateV1,
  type FlairEventKind,
  type FlairEventV1,
  type TrainerBadgePreferences,
} from '@racer/domain'
import { db } from './db'
import { queueInTransaction } from './persistence'
import { trainerAllowedAwardRefs } from './trainer'

export interface BadgePreferenceMutation {
  state: BadgeStateV1
  changed: boolean
}

export interface FlairTimelineCursor {
  earnedAt: number
  id: string
}

export interface FlairTimelinePage {
  items: (FlairEventV1 & { id: string })[]
  nextCursor: FlairTimelineCursor | null
}

export async function bootstrapTrainerBadgeState(now: number): Promise<boolean> {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Trainer badge bootstrap time is invalid')
  return db.transaction('rw', [db.badges, db.outbox], async () => {
    const existing = await db.badges.get('trainer')
    if (existing) {
      const parsed = parseBadgeState(existing.data)
      if (!parsed || parsed.scope !== 'trainer') throw new Error('Invalid local trainer badge state')
      return false
    }
    await db.badges.add({ id: 'trainer', version: 0, data: createTrainerBadgeState(now) })
    await queueInTransaction('badges', 'trainer', 'upsert', now)
    return true
  })
}

export function replaceMemoryBadgePreferences(
  state: BadgeStateV1,
  desired: BadgePreferences | TrainerBadgePreferences,
  allowedAwardRefs = new Set(awardRefsForState(state)),
  ownedUmaIds?: ReadonlySet<string>,
): BadgePreferenceMutation {
  const next = state.scope === 'trainer'
    ? replaceTrainerPreferences(state, desired, allowedAwardRefs, ownedUmaIds)
    : replaceBadgePreferences(state, desired, allowedAwardRefs)
  return { state: next, changed: JSON.stringify(next.preferences) !== JSON.stringify(state.preferences) }
}

export async function persistBadgePreferences(
  id: string,
  desired: BadgePreferences | TrainerBadgePreferences,
  now: number,
): Promise<BadgePreferenceMutation> {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Badge preference time is invalid')
  return db.transaction('rw', [db.umas, db.badges, db.outbox], async () => {
    const row = await db.badges.get(id)
    if (!row) throw new Error('Badge state is missing')
    const current = parseBadgeState(row.data)
    if (!current || (current.scope === 'uma' ? id !== badgeStateId(current.umaId) : id !== 'trainer')) {
      throw new Error('Badge state is invalid')
    }
    if (current.scope === 'uma' && !(await db.umas.get(current.umaId))) throw new Error('Badge Uma is not owned')
    const states = current.scope === 'trainer'
      ? (await db.badges.toArray()).map((entry) => parseBadgeState(entry.data)).filter((entry): entry is BadgeStateV1 => entry !== null)
      : [current]
    const allowedAwardRefs = current.scope === 'trainer' ? trainerAllowedAwardRefs(states) : new Set(awardRefsForState(current))
    const mutation = replaceMemoryBadgePreferences(
      current,
      desired,
      allowedAwardRefs,
      current.scope === 'trainer' ? new Set((await db.umas.toArray()).map((entry) => entry.id)) : undefined,
    )
    if (!mutation.changed) return mutation
    await db.badges.put({ ...row, data: mutation.state })
    await queueInTransaction('badges', id, 'upsert', now)
    return mutation
  })
}

export function pageMemoryFlairTimeline(
  events: readonly (FlairEventV1 & { id: string })[],
  umaId: string,
  before: FlairTimelineCursor | null,
  kind: FlairEventKind | null,
  limit: number,
): FlairTimelinePage {
  validatePageInput(umaId, before, kind, limit)
  const matching = events.filter((event) => event.scope === 'uma' && event.umaId === umaId && (!kind || event.kind === kind) &&
    (!before || event.earnedAt < before.earnedAt || (event.earnedAt === before.earnedAt && event.id < before.id)))
    .sort((left, right) => right.earnedAt - left.earnedAt || right.id.localeCompare(left.id))
  const items = matching.slice(0, limit)
  const last = items.at(-1)
  return { items, nextCursor: matching.length > limit && last ? { earnedAt: last.earnedAt, id: last.id } : null }
}

function validatePageInput(
  umaId: string,
  before: FlairTimelineCursor | null,
  kind: FlairEventKind | null,
  limit: number,
): void {
  const kinds: FlairEventKind[] = ['badge-tier', 'one-off', 'goal-ribbon', 'honors', 'title', 'trophy-earned', 'trainer-achievement']
  if (!umaId || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
    (kind !== null && !kinds.includes(kind)) ||
    (before !== null && (!Number.isSafeInteger(before.earnedAt) || before.earnedAt < 0 || !before.id))) {
    throw new Error('Flair timeline page is invalid')
  }
}

export async function readFlairTimelinePage(
  umaId: string,
  before: FlairTimelineCursor | null,
  kind: FlairEventKind | null,
  limit = 30,
): Promise<FlairTimelinePage> {
  validatePageInput(umaId, before, kind, limit)
  const rows = await db.flairEvents.orderBy('createdAt').reverse().filter((row) =>
    row.data.scope === 'uma' && row.data.umaId === umaId && (!kind || row.data.kind === kind) &&
    (!before || row.createdAt < before.earnedAt || (row.createdAt === before.earnedAt && row.id < before.id))).limit(limit + 1).toArray()
  const items = rows.map((row) => ({ id: row.id, ...row.data }))
    .sort((left, right) => right.earnedAt - left.earnedAt || right.id.localeCompare(left.id))
  const page = items.slice(0, limit)
  const last = page.at(-1)
  return { items: page, nextCursor: items.length > limit && last ? { earnedAt: last.earnedAt, id: last.id } : null }
}
