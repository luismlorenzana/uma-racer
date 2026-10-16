// A tap's answer beside its button (docs/game/02-check-ins-and-notifications.md §9): a rule in plain words ("Needs Farm
// Lv 16."), or one question with the new numbers and its yes ("Only 3 left now. Start ×3?"), or the unexpected. Never an
// instruction to reload or retry.
import { CHECK_IN_WORDS } from '@racer/domain/check-in'
import type { G2Answer } from '../../app/game'
import { useWordsContext, type Tap } from './useTap'
import { showWords, workWords } from './words'

export function TapNoteLine({ tap, onDone, className = '' }: {
  tap: Tap
  /** Called when a question's yes applies, as the first tap's own result would be. */
  onDone?: (answer: G2Answer) => void
  className?: string
}) {
  const context = useWordsContext()
  const note = tap.note
  if (note === null) return null
  if (note.kind === 'unexpected') return <p role="status" className={`text-[13px] text-danger ${className}`}>{CHECK_IN_WORDS.unexpected}</p>
  if (note.kind === 'say') return <p role="status" className={`text-[13px] text-ink-soft ${className}`}>{showWords(note.words, context)}</p>
  return (
    <div role="status" className={`flex flex-wrap items-center gap-2 text-[13px] text-ink ${className}`}>
      <span className="min-w-0 flex-1">{showWords(note.words, context)}</span>
      <button
        type="button"
        onClick={() => void note.yes().then((answer) => {
          if (answer?.kind === 'done') onDone?.(answer)
        })}
        disabled={tap.pending !== null}
        className="font-display min-h-11 rounded-sm bg-accent px-4 font-semibold text-accent-ink shadow-1 disabled:opacity-45"
      >
        {workWords('yes')}
      </button>
      <button type="button" onClick={tap.clear} className="min-h-11 rounded-sm px-3 font-semibold text-ink-soft">
        {workWords('not-now')}
      </button>
    </div>
  )
}
