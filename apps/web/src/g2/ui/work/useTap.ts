// One tap through the game port (docs/rework/02-check-ins-and-notifications.md §9; T140): the port's `run` applies it
// through the domain's `recheck` and answers `done`, `ask` or `say`. While it runs the tap is pending and its busy key
// held, so a second tap does nothing; a `say` keeps the rule's words beside the button, an `ask` its question with the
// input that answers yes, and anything unexpected reads "That didn't work. Try again." (the outbox retries by itself).
// T142's `useOperation` is the check-in's own runner; this one serves the place pieces.
import type { OperationInput, OperationName, Words } from '@racer/domain/rework/check-in'
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

export function useTap(): Tap {
  const run = useRun()
  const [pending, setPending] = useState<string | null>(null)
  const [note, setNote] = useState<TapNote | null>(null)

  const tap = useCallback(async <N extends OperationName>(name: N, input: OperationInput<N>, busyKey: string): Promise<G2Answer<N> | null> => {
    setPending(busyKey)
    setNote(null)
    try {
      const answer = await run(name, input, busyKey)
      if (answer.kind === 'say') setNote({ kind: 'say', words: answer.words })
      else if (answer.kind === 'ask') setNote({ kind: 'ask', words: answer.question, yes: () => tap(name, answer.input, busyKey) })
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

/** What filling a template needs on screen: names from the game's content, and the device's offset now. */
export function useWordsContext(): WordsContext {
  const { game } = useRuntime()
  const now = useNow()
  const umas = useGame((snapshot) => snapshot.env?.content.umas)
  const utcOffsetMin = game.utcOffsetMin(now)
  return useMemo(() => ({ umaName: (outfitId: string) => umas?.get(outfitId)?.name ?? '', utcOffsetMin }), [umas, utcOffsetMin])
}
