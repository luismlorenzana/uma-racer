// DEV-only isolated rehearsal. The same panel and pure reducer; no auth, owner database or network.
import { useState } from 'react'
import { preservationFixture } from '@racer/domain/puzzles-preservation-fixtures'
import type { PuzzlePreparationState } from '../../game/puzzles/preparation-store'
import { PuzzlePreparationPanel } from '../../ui/puzzles/PuzzlePreparation'
import { Button } from '../../ui/Button'
const makeFixture = () => {
  const f = preservationFixture(40)
  for (const row of f.entities.values()) if (row.kind === 'umas') {
    const unit = (row.data.scenarios as { trainingLevel: number; trainingExp: number }[])[0]!
    unit.trainingLevel = 4; unit.trainingExp = 700
  }
  return f
}
export function PuzzlePreservationProofScreen() {
  const [fixture] = useState(makeFixture), [state, setState] = useState<PuzzlePreparationState>({ phase: 'preparing', busy: false, preview: true,
    message: 'Synthetic preview only. No real account has been read or changed.', summary: fixture.apply(fixture.request('preview')).response.summary })
  const step = () => {
    const result = fixture.apply().response
    setState({ phase: result.status === 'active' ? 'active' : 'preparing', busy: false, preview: false, message: result.message, summary: result.summary })
  }
  return <main className="min-h-dvh bg-stage px-4 pb-safe pt-safe text-ink-on-dark">
    <div className="mx-auto max-w-sm py-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">Isolated synthetic rehearsal · T115</p>
      <h1 className="mt-2 font-display text-2xl">Prepare Uma Puzzles</h1>
      <p className="mt-2 text-sm text-ink-on-dark-soft">Forty invented outfits. All earned builds stay. Production capability remains off.</p>
      <PuzzlePreparationPanel state={state} retry={step} />
      <div className="grid grid-cols-2 gap-2">
        <Button disabled={state.phase === 'active'} onClick={() => setState(s => ({ ...s, phase: 'recoverable-error', preview: false,
          message: 'Synthetic interrupted connection. The frozen cohort and completed receipts are kept; Retry resumes them.' }))}>Simulate interruption</Button>
        <Button disabled={state.phase === 'active'} onClick={() => { let r; do { r = fixture.apply().response } while (r.status === 'preparing');
          setState({ phase: 'active', busy: false, preview: false, message: r.message, summary: r.summary }) }}>Complete rehearsal</Button>
      </div>
      <p className="mt-4 text-xs text-ink-on-dark-soft">This rehearsal has no API or account persistence. Real cutover also verifies private content and drains old commits before freeze. Never clear app data for recovery.</p>
    </div>
  </main>
}
