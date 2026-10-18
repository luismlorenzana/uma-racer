// A tap's answer for uma-kit's frames (SD4): the kit's sheets (the Warehouse's sell, the Exchange's buy, the unlock
// confirm) take a promise that resolves on success and rejects with the words to show. So a rule's words, a question
// or the unexpected become the rejection's message, in the same plain words `TapNoteLine` shows (02 §9).
import { CHECK_IN_WORDS } from '@racer/domain/check-in'
import type { G2Answer } from '../../app/game'
import { showWords, type WordsContext } from './words'

export type DoneAnswer<A extends G2Answer> = Extract<A, { readonly kind: 'done' }>

/** The tap's `done` answer, or an error carrying the words its sheet shows. */
export function doneOrThrow<A extends G2Answer>(answer: A | null, context: WordsContext): DoneAnswer<A> {
  if (answer === null) throw new Error(CHECK_IN_WORDS.unexpected)
  if (answer.kind === 'say') throw new Error(showWords(answer.words, context))
  if (answer.kind === 'ask') throw new Error(showWords(answer.question, context))
  return answer as DoneAnswer<A>
}
