// Development-only rehearsal, never production navigation (docs/design/uma-rpg.md, T094).
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useContent } from '../../content/ContentProvider'
import { ProofBattleHost, type ProofMode } from './proof-host'
import { RpgBattleStage } from './RpgBattleScreen'

// A tiny DEV-only port cache, like the app's global Dexie instance. StrictMode cleanup must not close a reused port.
const ports = new Map<ProofMode, ProofBattleHost>()
function proofPort(mode: ProofMode) {
  const current = ports.get(mode)
  if (current) return current
  const host = new ProofBattleHost(mode)
  ports.set(mode, host)
  return host
}

export function RpgBattleProofScreen() {
  const [params, setParams] = useSearchParams()
  const mode: ProofMode = params.get('mode') === 'loss' ? 'loss' : params.get('mode') === 'boss' ? 'boss' : 'practice'
  const contentState = useContent()
  const content = contentState.status === 'ready' ? contentState.content : null
  const host = useMemo(() => proofPort(mode), [mode])
  const [tools, setTools] = useState(false)
  // Runtime art only; the engine keeps invented identities and never reads real progression or enemy packs.
  const portraits = useMemo(() => Object.fromEntries((content?.umas.items ?? []).slice(0, 5).map((uma, index) => [`ally-${index}`, uma.id])), [content])
  return <>
    <RpgBattleStage key={mode} host={host} checkpointId="proof" content={params.get('art') === 'off' ? null : content} uid="proof"
      headerTools={<button aria-expanded={tools} onClick={() => setTools((value) => !value)} className="min-h-11 min-w-11 rounded-sm border border-hairline-dark text-[10px]" aria-label="Development proof tools">DEV</button>}
      proof portraits={portraits} names={{ 'ally-0': 'Ember', 'ally-1': 'Rill', 'ally-2': 'Beacon', 'ally-3': 'Dawn', 'ally-4': 'Volt',
        'proof-captain': 'Test captain', 'proof-scout': 'Test scout', 'proof-mage': 'Test mage' }} />
    {tools && <div className="fixed inset-x-3 top-16 z-30 rounded-md border border-hairline-dark bg-stage-soft p-3 text-ink-on-dark">
      <p className="text-xs">Separate synthetic database · no account writes</p>
      <div className="mt-2 grid grid-cols-3 gap-2">{(['practice', 'boss', 'loss'] as const).map((candidate) => <button key={candidate} className="min-h-11 rounded-sm border border-hairline-dark" onClick={() => { setTools(false); setParams({ mode: candidate }) }}>{candidate}</button>)}</div>
      <button className="mt-2 min-h-11 rounded-sm border border-hairline-dark px-3" onClick={() => { void host.reset('proof'); setTools(false) }}>Reset this proof only</button>
    </div>}
  </>
}
