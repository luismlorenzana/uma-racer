// Standalone real touch lesson. No account host, auth, Dexie or rewards (Uma Puzzles §9).
import { useRef, useState } from 'react'
import { applyPuzzleBattleAction, createPuzzleBattle } from '@racer/domain'
import { puzzlePracticeInput } from '../../game/puzzles/practice-input'
import type { PuzzleBattlePhase } from '../../game/puzzles/battle-session'
import { PuzzleBattleStage } from './PuzzleBattleStage'
import { PuzzleButton } from '../../ui/puzzles/components'
import { MinigameShell } from '../../ui/minigames/MinigameShell'
import { Link } from 'react-router'
import { PUZZLES_RELEASE_ENABLED } from '../../game/puzzles/capability'
export function PuzzlePracticeEntry() {
  return PUZZLES_RELEASE_ENABLED ? <PuzzlePracticeScreen /> : <MinigameShell><div className="m-auto grid max-w-sm gap-4 p-5">
    <h1 className="text-xl">Uma Puzzles is not released yet</h1><p>Touch practice opens with the release. No account or save was loaded here.</p>
    <Link reloadDocument className="flex min-h-11 items-center" to="/">Return home</Link></div></MinigameShell>
}
export function PuzzlePracticeScreen() {
  const [state, setState] = useState(() => createPuzzleBattle(puzzlePracticeInput())), current = useRef(state), busy = useRef(false)
  const [phase, setPhase] = useState<PuzzleBattlePhase>('ready'), [error, setError] = useState<string | null>(null)
  const isolated = location.pathname.startsWith('/dev/'), back = isolated ? '/dev/puzzles-ui-proof' : '/puzzles'
  if (state.outcome !== 'active') return <MinigameShell><div className="m-auto grid max-w-sm gap-4 p-5"><h1 className="text-xl">Practice {state.outcome === 'win' ? 'clear' : 'finished'}</h1><p>No EXP, Items or account writes. Refresh restarts the same invented lesson.</p><PuzzleButton onClick={() => { const s = createPuzzleBattle(puzzlePracticeInput()); current.current = s; setState(s); setPhase('ready'); setError(null) }}>Practice again</PuzzleButton><Link reloadDocument className="flex min-h-11 items-center" to={back}>Return to Puzzle parties</Link></div></MinigameShell>
  return <PuzzleBattleStage state={state} phase={phase} error={error} isolated practice backTo={back} practiceTo={location.pathname}
    restore={async () => { setState(current.current); setPhase(busy.current ? 'animating' : 'ready'); setError(null) }}
    act={async (action, animate) => {
      if (busy.current) return
      busy.current = true; setPhase('animating')
      try { const step = applyPuzzleBattleAction(current.current, action); current.current = step.state; await animate(step); setState(step.state); setPhase('ready') }
      catch (e) { setError(e instanceof Error ? e.message : 'Invalid practice action'); setPhase('error') }
      finally { busy.current = false }
    }} />
}
