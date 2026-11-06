// The season card's steps (docs/game/11-hub-and-places.md §8; D387): a step's head (its number, a check once done, its
// icon, name and line), its frame by state, and whether a play of a game is open on this phone to resume.
import { CheckIcon } from '@luismlorenzana/uma-kit/ui'
import type { StageKind } from '@racer/domain/stages'
import { useEffect, useState, type ReactNode } from 'react'
import { useRuntime } from '../../app/game'
import { journalId } from '../../stages/ids'

export type StepState = 'next' | 'done' | 'open'

/** One of the season's three steps: its number (a check once done), its icon and name, a line, and what's at its end. */
export function StepHead({ n, state, icon, title, line, end }: { n: number; state: StepState; icon: ReactNode; title: string; line?: ReactNode; end?: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2.5">
      <span aria-hidden className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${state === 'done' ? 'bg-success text-ink-on-dark' : state === 'next' ? 'bg-accent text-accent-ink' : 'bg-sunken text-ink-soft'}`}>
        {state === 'done' ? <CheckIcon size={16} /> : n}
      </span>
      <span aria-hidden className="shrink-0 text-ink-soft">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] font-semibold leading-tight">{title}</span>
        {line !== undefined && <span className="block truncate text-[12px] text-ink-soft">{line}</span>}
      </span>
      {end}
    </span>
  )
}

export const stepFrame = (state: StepState) =>
  `flex min-h-14 w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left ${state === 'next' ? 'border-accent bg-accent-wash' : 'border-hairline bg-panel'}`

/** Whether a play of this game is open on this phone for the career: its journal waits to resume. */
export function usePlayOpen(careerId: string, kind: StageKind): boolean {
  const { game } = useRuntime()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let live = true
    void (game.journal?.read(journalId(kind, careerId, 'career')) ?? Promise.resolve(null))
      .then((row) => { if (live) setOpen(row !== null) })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [careerId, game, kind])
  return open
}
