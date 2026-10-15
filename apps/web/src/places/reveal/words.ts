// The save's state under a reveal, in 02 §9's words (docs/rework/02-check-ins-and-notifications.md §9; T138): never a
// code or an error, only where the unlock is kept and whether it has synced. Offline is 02 §9's own sentence.
import { CHECK_IN_WORDS } from '@racer/domain/check-in'
import type { G2Sync } from '../../app/game'

export const SAVE_WORDS: Readonly<Record<G2Sync, string>> = Object.freeze({
  synced: 'Saved on this phone and synced.',
  offline: CHECK_IN_WORDS.offline,
  paused: "Saved on this phone. It'll sync once you sign in.",
  waiting: "Saved on this phone. It's waiting to sync.",
  failing: "Saved on this phone. Sync isn't going through yet; it keeps trying.",
})

export const saveWords = (sync: G2Sync): string => SAVE_WORDS[sync]
