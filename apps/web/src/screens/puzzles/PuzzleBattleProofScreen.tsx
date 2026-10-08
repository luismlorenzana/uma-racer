// DEV-only original fixture generator. Uses the real journal/receipt path, never an account database.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { puzzleBotAction, puzzleBattleStateHash } from '@racer/domain'
import { createPuzzleUiProofEnvironment } from './PuzzleUiProofScreen'
import { PuzzleProvider, PuzzleGate, type PuzzleEnvironment } from './PuzzleContext'
import { PuzzleBattleScreen } from './PuzzleBattleScreen'
const CASES = ['start', 'mid', 'phase', 'win', 'loss'] as const
type Case = typeof CASES[number]
const boots = new Map<Case, Promise<{ env: PuzzleEnvironment; id: string }>>()
async function prepare(mode: Case) {
  const env = await createPuzzleUiProofEnvironment(`puzzle-proof-t113-${mode}-${mode === 'phase' ? 'v2' : 'v1'}`)
  // One-time setup of this invented fixture, not a progression mutation path in the game.
  const prior = (await env.host.account()).checkpoints[0]!
  const pendingResults = (await env.database.pendingPuzzleOperations.toArray()).flatMap(p => p.prediction.logs.filter(l => l.kind === 'puzzleResults'))
  let id = prior.open?.input.battleId ?? (await env.database.puzzleResults.toArray()).at(-1)?.id ?? pendingResults.at(-1)?.id
  if (!id) {
    await env.database.puzzleOutfits.toCollection().modify(row => { if (Number(row.id.split('-').at(-1)) < 5) row.data.enrollment.level = mode === 'phase' ? 20 : mode === 'loss' ? 10 : 30 })
    const a = await env.host.account(), p = a.parties[0]!, c = a.checkpoints[0]!
    const v = await env.host.begin({ partyId: p.partyId, scenarioId: c.scenarioId, nodeId: `pzn:ura-finale:${mode === 'win' || mode === 'phase' ? 'c-fire' : 'o1a'}`,
      darkVariant: null, partyRevision: p.revision, checkpointRevision: c.revision }, `proof:${mode}`)
    if (v.kind !== 'battle') throw new Error(v.kind === 'recovery' ? v.message : 'Invented fixture already has a result')
    id = v.open.input.battleId
    let state = v.state
    const stop = () => mode === 'start' || mode === 'mid' && state.turn >= 6 || mode === 'phase' && state.enemies.some(e => e.phaseFired)
    while (state.outcome === 'active' && !stop()) {
      const action = mode === 'mid' || mode === 'loss'
        ? { type: 'drag' as const, path: [{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 0 }], elapsedMs: 100, focusId: null }
        : puzzleBotAction(state, 'competent')
      state = (await env.host.append(id, 0, state.actionCount, action)).state
    }
    v.lease.release()
    if (state.outcome !== 'active') await env.host.commit({ battleId: id, ownerEpoch: 0, expectedCount: state.actionCount, stateHash: puzzleBattleStateHash(state) })
    const loaded = await env.host.loadBattle(id)
    if (mode === 'phase' && loaded.kind !== 'battle') throw new Error('Phase fixture ended before its warning; no phase evidence claimed')
    if (loaded.kind === 'battle') {
      if (mode === 'mid' && loaded.state.enemies.filter(e => e.hp > 0).length !== 3 ||
        mode === 'phase' && !loaded.state.enemies.some(e => e.phaseFired)) throw new Error('Fixture does not show its intended state')
      loaded.lease.release()
    }
  }
  return { env, id }
}
export function PuzzleBattleProofScreen() {
  const { proofCase } = useParams(), mode = CASES.includes(proofCase as Case) ? proofCase as Case : null
  const [ready, setReady] = useState<{ env: PuzzleEnvironment; id: string } | null>(null), [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false; setReady(null); setError(null)
    if (mode) {
      let p = boots.get(mode); if (!p) { p = prepare(mode); boots.set(mode, p) }
      void p.then(v => { if (!cancelled) setReady(v) }).catch(e => { if (!cancelled) setError(String(e)) })
    }
    return () => { cancelled = true }
  }, [mode])
  if (!mode) return <PuzzleGate title="Isolated battle evidence"><p>Original invented data only; no owner save, API or private art.</p>{CASES.map(c => <Link key={c} className="mt-2 flex min-h-11 items-center rounded-sm border border-hairline-dark px-3 capitalize" to={`/dev/puzzles-battle-proof/${c}`}>Open {c} fixture</Link>)}</PuzzleGate>
  if (!ready) return <PuzzleGate title="Preparing isolated battle">{error ?? 'Replaying actual synthetic actions through the real host.'}</PuzzleGate>
  return <PuzzleProvider environment={ready.env}><PuzzleBattleScreen battleIdOverride={ready.id} /></PuzzleProvider>
}
