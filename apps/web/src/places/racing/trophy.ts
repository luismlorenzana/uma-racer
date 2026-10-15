// The Trophy Hall's reads (T141 "Trophy Hall"; docs/design/badges.md; 11 §3.3): today's pure badge views on the
// generation-2 catalogue, fed from the rework state through `umaSaveOf` (careerView), the race rows as today's records,
// and the device's `badges/…` and `flairEvents`. The counter is flair newer than this device's last visit, a device
// convenience under `uma-racer:g2:trophy-hall-seen` (01 §4.2).
import { badgeStateId, buildTrainerAchievementCatalog, buildUmaFlairCatalog, type BadgeStateV1, type FlairEventV1, type UmaBadgeStateV1, type UmaSave } from '@racer/domain'
import type { WorkState } from '@racer/domain/work'
import type { LoadedContent } from '../../content/runtime'
import type { G2Records } from '../../app/game'
import { TRAINER_BADGE_ID } from './flair'
import { linkedHistoryOf, umaSaveOf, type LinkedRaceRecord } from './today'
export { readSeen, TROPHY_HALL_SEEN_KEY, writeSeen } from './seen'

/** Flair earned after the last visit on this device: the Trophy Hall's counter. */
export const newFlairCount = (events: G2Records['flairEvents'], seen: number): number =>
  Object.values(events).filter((event) => event.earnedAt > seen).length

/** Every event with its id, as today's views read them. */
export const eventList = (records: G2Records): (FlairEventV1 & { id: string })[] =>
  Object.entries(records.flairEvents).map(([id, event]) => ({ ...event, id }))

/** Every Uma's save as today's views read it, by outfit id. */
export const savesOf = (state: Pick<WorkState, 'umas'>): Record<string, UmaSave> =>
  Object.fromEntries(Object.values(state.umas).map((uma) => [uma.outfitId, umaSaveOf(uma)]))

/** Every race as today's record with its row's id, every Uma's in sequence. */
export const raceRecords = (state: Pick<WorkState, 'umas'>, records: G2Records): LinkedRaceRecord[] =>
  Object.keys(state.umas).sort().flatMap((umaId) => linkedHistoryOf(records.raceResults, umaId))

export const umaBadge = (records: G2Records, umaId: string): UmaBadgeStateV1 | null => {
  const state = records.badges[badgeStateId(umaId)]
  return state?.scope === 'uma' ? state : null
}

export const trainerBadge = (records: G2Records) => {
  const state = records.badges[TRAINER_BADGE_ID]
  return state?.scope === 'trainer' ? state : null
}

export interface RecentFlair {
  readonly id: string
  readonly label: string
  readonly owner: string
  readonly stage: FlairEventV1['stage']
  readonly earnedAt: number
}

/** Recent flair (today's Home panel), newest first, labelled from the generation-2 catalogues. */
export function recentFlair(content: LoadedContent, records: G2Records, limit = 6): RecentFlair[] {
  const catalogs = new Map<string, Map<string, string>>()
  const labelOf = (event: FlairEventV1): string => {
    if (event.scope === 'trainer') {
      let labels = catalogs.get(TRAINER_BADGE_ID)
      if (!labels) {
        labels = new Map(buildTrainerAchievementCatalog({ umas: content.umas.items, cards: content.cards.items, races: content.races.items })
          .definitions.map((row) => [row.awardKey, row.label]))
        catalogs.set(TRAINER_BADGE_ID, labels)
      }
      return labels.get(event.awardKey) ?? event.awardKey
    }
    const state = event.umaId ? umaBadge(records, event.umaId) : null
    if (!state) return event.awardKey
    let labels = catalogs.get(state.umaId)
    if (!labels) {
      labels = new Map(buildUmaFlairCatalog({ state, races: content.races.items }).definitions.map((row) => [row.awardKey, row.label]))
      catalogs.set(state.umaId, labels)
    }
    return labels.get(event.awardKey) ?? (event.kind === 'trophy-earned' ? event.awardKey.replace(/^trophy:/, '') : event.awardKey)
  }
  return eventList(records)
    .sort((a, b) => b.earnedAt - a.earnedAt || b.id.localeCompare(a.id))
    .slice(0, limit)
    .map((event) => ({
      id: event.id,
      label: labelOf(event),
      owner: event.umaId ? content.umas.byId.get(event.umaId)?.name ?? event.umaId : trainerBadge(records)?.preferences.displayName ?? 'Trainer',
      stage: event.stage,
      earnedAt: event.earnedAt,
    }))
}

/** A badge state's row, as the device writes it. */
export const badgeRow = (state: BadgeStateV1): Record<string, BadgeStateV1> =>
  ({ [state.scope === 'trainer' ? TRAINER_BADGE_ID : badgeStateId(state.umaId)]: state })
