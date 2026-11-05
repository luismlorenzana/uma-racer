// The save's plain words (docs/design/ux.md "Principles", D157; T136, T152). Every sentence the save layer can put on a
// screen is here: offline, anything unexpected, and a refusal in its rule's own words. No code, number or protocol word
// reaches a screen: a failure kind is for the lane, and only its sentence leaves this module.
import type { Refusal } from '@racer/domain/save'
import type { SaveFailure } from './api'

export const SAVE_WORDS = Object.freeze({
  /** Anything unexpected; the outbox retries by itself. */
  unexpected: "That didn't work. Try again.",
  offline: "Saved on this phone. It'll sync when you're back online.",
})

/** Words a screen never shows: protocol words, sync errors and HTTP statuses. */
export const BANNED_WORDS = Object.freeze(['operation', 'receipt', 'revision', 'generation', 'version', 'stale', 'conflict', 'payload', 'id'] as const)

const BANNED = new RegExp(`\\b(${BANNED_WORDS.join('|')})s?\\b|\\bsync (error|failed)\\b|\\b[1-5]\\d\\d\\b`, 'i')

/** Whether a sentence holds a word a screen never shows. */
export const hasBannedWord = (text: string): boolean => BANNED.test(text)

/** What a failure says: offline is "Saved on this phone…", and everything else "That didn't work. Try again." */
export const failureWords = (failure: SaveFailure): string => (failure === 'offline' ? SAVE_WORDS.offline : SAVE_WORDS.unexpected)

/** A refused tap, in its rule's words. */
export const refusalWords = (refusal: Refusal): string => refusal.reason
