// One tap through the game port (docs/rework/02-check-ins-and-notifications.md §9; T140): the port's `run` applies it
// through the domain's `recheck` and answers `done`, `ask` or `say`. While it runs the tap is pending and its busy key
// held, so a second tap does nothing; a `say` keeps the rule's words beside the button, an `ask` its question with the
// input that answers yes, and anything unexpected reads "That didn't work. Try again." (the outbox retries by itself).
// `useTap` serves one button or one card; `useTaps` (T142) serves a list whose lines each keep their own answer, as the
// check-in summary's Free, Queue stopped and Couldn't repeat lines do, with one tap in flight for the whole list.
import type { OperationInput, OperationName, Words } from '@racer/domain/check-in'
import { useCallback, useMemo, useState } from 'react'
import { useGame, useNow, useRun, useRuntime, type G2Answer } from '../../app/game'
import type { WordsContext } from './words'

/** What a tap left to show: a rule, a question with the yes it would run, or the unexpected. */
export type TapNote =
  | { readonly kind: 'say'; readonly words: Words }
  | { readonly kind: 'ask'; readonly words: Words; readonly yes: () => Promise<G2Answer | null> }
  | { readonly kind: 'unexpected' }

export interface Tap {
  /** Runs one operation under `busyKey`; resolves with its answer, or null when it couldn't run. */
  run<N extends OperationName>(name: N, input: OperationInput<N>, busyKey: string): Promise<G2Answer<N> | null>
  /** The busy key of the tap in flight, if any. */
  readonly pending: string | null
  readonly note: TapNote | null
  clear(): void
}

/** The note an answer leaves: a rule's words, or a question whose yes runs the answer's input; nothing when done. */
function noteOf<N extends OperationName>(answer: G2Answer<N>, again: (input: OperationInput<N>) => Promise<G2Answer | null>): TapNote | null {
  if (answer.kind === 'say') return { kind: 'say', words: answer.words }
  if (answer.kind === 'ask') return { kind: 'ask', words: answer.question, yes: () => again(answer.input) }
  return null
}

export function useTap(): Tap {
  const run = useRun()
  const [pending, setPending] = useState<string | null>(null)
  const [note, setNote] = useState<TapNote | null>(null)

  const tap = useCallback(async <N extends OperationName>(name: N, input: OperationInput<N>, busyKey: string): Promise<G2Answer<N> | null> => {
    setPending(busyKey)
    setNote(null)
    try {
      const answer = await run(name, input, busyKey)
      setNote(noteOf(answer, (yes) => tap(name, yes, busyKey)))
      return answer
    } catch {
      setNote({ kind: 'unexpected' })
      return null
    } finally {
      setPending(null)
    }
  }, [run])

  const clear = useCallback(() => setNote(null), [])
  return useMemo(() => ({ run: tap, pending, note, clear }), [tap, pending, note, clear])
}

/** A list's taps (T142): each line keeps its own answer, and one busy key is in flight for the whole list. */
export interface Taps {
  /** Runs one operation for `line` under `busyKey`; resolves with its answer, or null when it couldn't run. */
  run<N extends OperationName>(line: string, name: N, input: OperationInput<N>, busyKey: string): Promise<G2Answer<N> | null>
  /** The busy key of the tap in flight, if any. */
  readonly pending: string | null
  /** Every line's answer still shown, by line: one whose line has left the screen can be shown elsewhere. */
  readonly notes: Readonly<Record<string, TapNote>>
  /** The line's answer as a `Tap`, for `TapNoteLine`. */
  line(line: string): Tap
  /** Forgets one line's answer, or every line's. */
  clear(line?: string): void
}

export function useTaps(): Taps {
  const run = useRun()
  const [pending, setPending] = useState<string | null>(null)
  const [notes, setNotes] = useState<Readonly<Record<string, TapNote>>>({})

  const setNote = useCallback((line: string, note: TapNote | null) => setNotes((all) => {
    const next: Record<string, TapNote> = { ...all }
    if (note === null) delete next[line]
    else next[line] = note
    return next
  }), [])

  const tap = useCallback(async <N extends OperationName>(line: string, name: N, input: OperationInput<N>, busyKey: string): Promise<G2Answer<N> | null> => {
    setPending(busyKey)
    setNote(line, null)
    try {
      const answer = await run(name, input, busyKey)
      setNote(line, noteOf(answer, (yes) => tap(line, name, yes, busyKey)))
      return answer
    } catch {
      setNote(line, { kind: 'unexpected' })
      return null
    } finally {
      setPending(null)
    }
  }, [run, setNote])

  const clear = useCallback((line?: string) => (line === undefined ? setNotes({}) : setNote(line, null)), [setNote])
  const lineTap = useCallback((line: string): Tap => ({
    run: (name, input, busyKey) => tap(line, name, input, busyKey),
    pending,
    note: notes[line] ?? null,
    clear: () => setNote(line, null),
  }), [tap, pending, notes, setNote])
  return useMemo(() => ({ run: tap, pending, notes, line: lineTap, clear }), [tap, pending, notes, lineTap, clear])
}

/** What filling a template needs on screen: names from the game's content, and the device's offset now. */
export function useWordsContext(): WordsContext {
  const { game } = useRuntime()
  const now = useNow()
  const umas = useGame((snapshot) => snapshot.env?.content.umas)
  const utcOffsetMin = game.utcOffsetMin(now)
  return useMemo(() => ({ umaName: (outfitId: string) => umas?.get(outfitId)?.name ?? '', utcOffsetMin }), [umas, utcOffsetMin])
}
