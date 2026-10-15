// The Racecourse's counter, computed (T141 "Counter"; docs/rework/09-racing-rewards-and-exchange.md §4): featured
// bonuses still open today, 0–3. Loaded lazily by `counters.ts`, so the shell's entry holds none of the draw.
import type { AccountProfile } from '@racer/domain/rework/tiers'
import type { OperationEnv } from '@racer/domain/rework/check-in'
import type { LoadedContent } from '../../../content/runtime'
import { featuredView, localDayAt } from './view'

export function featuredOpen(profile: Pick<AccountProfile, 'purse'>, env: OperationEnv, loaded: LoadedContent | null, now: number, utcOffsetMin: number): number {
  return featuredView(profile, localDayAt(now, utcOffsetMin), loaded?.races.items ?? env.content.races).open
}
