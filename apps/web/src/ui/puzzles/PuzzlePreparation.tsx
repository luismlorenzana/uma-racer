// One recovery panel for startup and the isolated migration rehearsal (implementation §8).
import type { PuzzlePreparationState } from '../../game/puzzles/preparation-store'
import { usePuzzlePreparation } from '../../game/puzzles/preparation-store'
import { PUZZLES_RELEASE_ENABLED } from '../../game/puzzles/capability'
import { Button } from '../Button'
export function PuzzlePreparationPanel({ state, retry }: { state: PuzzlePreparationState; retry: () => void }) {
  if (state.phase === 'unavailable') return null
  const title = state.phase === 'active' ? 'Constellation Levels preserved' : state.preview ? 'Your preservation preview' :
    state.phase === 'recoverable-error' ? 'Preparation needs attention' : state.phase === 'needs-sync' ? 'Sync before preparing' : 'Preparing Uma Puzzles'
  const s = state.summary
  return <section aria-label="Puzzle preparation" className="my-3 rounded-md border border-accent/35 bg-panel p-4 text-ink shadow-1">
    <h2 className="font-display text-lg font-semibold">{title}</h2>
    <p role="status" className="mt-2 text-sm text-ink-soft">{state.message ?? (state.phase === 'active'
      ? 'Every earned level and saved build is kept. New progress uses Constellation materials.'
      : 'Your levels, cards, four presets, Inspiration and Extra stats are kept. Racing, Farm and RPG remain available.')}</p>
    {s && <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      <dt>Units preserved</dt><dd className="text-right tabular-nums">{state.preview ? s.units : `${s.completed} / ${s.units}`}</dd>
      <dt>Legacy debt</dt><dd className="text-right tabular-nums">{Object.values(s.debt).reduce((n, v) => n + v, 0)} materials</dd>
      <dt>Unapplied EXP</dt><dd className="text-right tabular-nums">{s.rawExp.toLocaleString()}</dd>
      <dt>Universal tickets</dt><dd className="text-right tabular-nums">{s.originalStock} + {s.credited} = {s.stockAfter}</dd>
    </dl>}
    {state.phase !== 'active' && <>
      <p className="mt-3 text-xs text-ink-soft">Old Spark and EXP/ticket spending pause after the cohort freezes. Never clear app data to retry.</p>
      <Button className="mt-3 w-full" disabled={state.busy} onClick={retry}>{state.busy ? 'Preparing…' : state.preview ? 'Continue preparation' : 'Retry safely'}</Button>
    </>}
  </section>
}
export function PuzzlePreparationNotice() {
  const state = usePuzzlePreparation()
  if (!PUZZLES_RELEASE_ENABLED || state.phase === 'unavailable' || state.phase === 'active') return null
  return <PuzzlePreparationPanel state={state} retry={() => { void import('../../game/runtime').then(({ gameRuntime }) => gameRuntime.flush()) }} />
}
