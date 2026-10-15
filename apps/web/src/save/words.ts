// The save's plain words (docs/game/02-check-ins-and-notifications.md §9; T136). Every sentence the save layer can put
// on a screen comes from 02 §9 through the check-in's own table: offline, anything unexpected, and "Already collected."
// for a line the other device collected. A refusal is said in its rule's words. No code, number or protocol word
// reaches a screen: a failure kind is for the lane, and only its sentence leaves this module.
import { CHECK_IN_WORDS, fill, say, type Words } from '@racer/domain/check-in'
import type { Refusal } from '@racer/domain/state'
import type { SaveFailure } from './api'

export const SAVE_WORDS = Object.freeze({
  offline: CHECK_IN_WORDS.offline,
  unexpected: CHECK_IN_WORDS.unexpected,
  'already-collected': CHECK_IN_WORDS['already-collected'],
})

/** What a failure says (02 §9): offline is "Saved on this phone…", and everything else "That didn't work. Try again." */
export const failureWords = (failure: SaveFailure): string => (failure === 'offline' ? SAVE_WORDS.offline : SAVE_WORDS.unexpected)

/** A refused tap, in its rule's words; the screen fills names from the data. */
export const refusalWords = (refusal: Refusal): Words => say(refusal.reason, refusal.data)

/** A tap the server couldn't run at all. */
export const unexpectedWords = (): Words => say(SAVE_WORDS.unexpected)

/** A sentence filled from its data, as `fill` does. */
export const sentence = (words: Words): string => fill(words)
