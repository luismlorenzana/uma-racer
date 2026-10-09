// Real resumable journal screen; the release-gated parent owns auth/content (implementation §§5–7).
import { useEffect, useReducer, useState } from 'react'
import { useParams } from 'react-router'
import { PuzzleBattleSession } from '../../game/puzzles/battle-session'
import { PuzzleButton } from '../../ui/puzzles/components'
import { PuzzleGate, usePuzzleAccount, usePuzzles } from './PuzzleContext'
import { PuzzleBattleStage } from './PuzzleBattleStage'
import { PuzzleResultScreen } from './PuzzleResultScreen'
export function PuzzleBattleScreen({ battleIdOverride }: { battleIdOverride?: string } = {}) {
  const { battleId: routeId = '' } = useParams(), battleId = battleIdOverride ?? routeId, environment = usePuzzles(), account = usePuzzleAccount()
  const [, update] = useReducer(n => n + 1, 0), [takeover, setTakeover] = useState(false)
  const [session, setSession] = useState<PuzzleBattleSession | null>(null)
  useEffect(() => {
    let mounted = true
    const s = new PuzzleBattleSession(environment.host, battleId, () => { if (mounted) update() })
    setSession(s); void s.restore()
    return () => { mounted = false; s.dispose() }
  }, [environment.host, battleId])
  // Canonical adoption can correct pending reward deltas; never recreate rewards in the view.
  useEffect(() => { if (session?.view?.kind === 'result') void session.restore() }, [account, session])
  if (!session) return <PuzzleGate title="Restoring saved fight">Reading the accepted journal.</PuzzleGate>
  const view = session.view
  if (view?.kind === 'result') return <PuzzleResultScreen view={view} />
  if (view?.kind === 'battle') return <PuzzleBattleStage state={view.state} phase={session.phase} error={session.error} content={environment.content}
    lease={view.lease} isolated={environment.isolated} backTo={`${environment.root}/party/${view.open.input.partyId}/${view.open.input.scenarioId}`}
    practiceTo={environment.isolated ? '/dev/puzzles-practice' : '/puzzles/practice'} act={(a, animate) => session.act(a, animate)} restore={() => session.restore()} />
  if (view?.kind === 'recovery') return <PuzzleGate title="Frozen fight recovery" retry={() => { void session.restore() }}><p>{view.message}</p>
    <p className="mt-3">No replacement board has been reserved. Online takeover keeps the same frozen input and seed, restarts its journal at turn 0 and invalidates the other device.</p>
    {view.open && <><PuzzleButton className="mt-4 w-full" disabled={!navigator.onLine || environment.busy} onClick={() => setTakeover(true)}>Review online takeover</PuzzleButton>
      {takeover && <div className="mt-3 grid gap-2"><p>Take over owner epoch {view.open.ownerEpoch}?</p><PuzzleButton disabled={environment.busy} onClick={() => {
        void environment.command(`takeover:${battleId}:${view.open!.ownerEpoch}`, async () => { const next = await environment.host.takeover(battleId, view.open!.ownerEpoch); if (next.kind === 'battle') next.lease.release() }).then(ok => { if (ok) { setTakeover(false); void session.restore() } })
      }}>Confirm online takeover</PuzzleButton><PuzzleButton secondary onClick={() => setTakeover(false)}>Keep read-only</PuzzleButton></div>}</>}
    {(environment.notice || session.error) && <p role="alert" className="mt-3">{environment.notice ?? session.error}</p>}
    <a className="mt-3 flex min-h-11 items-center" href={environment.root}>Return to Puzzle parties</a></PuzzleGate>
  return <PuzzleGate title={session.error ? 'Saved fight unavailable' : 'Restoring accepted journal'} retry={session.error ? () => { void session.restore() } : undefined}>
    {session.error ?? 'The same board, entrants, seed and accepted actions will be replayed before input is enabled.'}</PuzzleGate>
}
