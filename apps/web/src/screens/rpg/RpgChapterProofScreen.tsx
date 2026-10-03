// DEV-only complete synthetic campaign rehearsal; absent from the production build.
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ChapterProof } from './chapter-proof-host'
import { RpgChapterMap } from './RpgChapterScreen'
import { RpgBattleStage } from './RpgBattleScreen'
import { RpgProgressionEditor } from '../../ui/rpg/RpgProgressionEditor'
import { MinigameHeader, MinigameShell } from '../../ui/minigames/MinigameShell'
const proof = new ChapterProof()
const names = { 'test-outfit-0': 'Ember', 'test-outfit-1': 'Rill', 'test-outfit-2': 'Beacon', 'test-outfit-3': 'Dawn', 'test-outfit-4': 'Volt',
  'test-scout': 'Test scout', 'test-elite': 'Test elite', 'test-captain': 'Test captain', 'test-wall': 'Test wall' }
export function RpgChapterProofScreen() {
  const [params, setParams] = useSearchParams()
  const [ready, setReady] = useState(false)
  const [tools, setTools] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { void proof.ready.then(() => setReady(true)).catch((e: unknown) => setError(String(e))) }, [])
  const chapterId = params.get('chapter') ?? 'test-chapter'
  const hold = params.get('hold') === '1'
  const route = (battle: boolean, chapter = chapterId) => { setParams({ chapter, ...(battle ? { view: 'battle' } : {}), ...(hold ? { hold: '1' } : {}) }) }
  const backTo = `/dev/rpg-chapter-proof?chapter=${chapterId}${hold ? '&hold=1' : ''}`
  const sync = () => { if (!hold) void proof.sync().catch((e: unknown) => setError(String(e))) }
  const reset = (promotion = false) => {
    setReady(false); setTools(false); setError('')
    void (promotion ? proof.promotionProbe() : proof.reset()).then(() => {
      if (promotion) setParams({ view: 'skills', outfit: 'test-outfit-0' })
      else route(false, 'test-chapter')
      setReady(true)
    }).catch((e: unknown) => setError(String(e)))
  }
  if (!ready) return <p>{error || 'Opening isolated chapter proof…'}</p>
  const headerTools = <button aria-label="Chapter proof tools" className="min-h-11 min-w-11 rounded-sm border border-hairline-dark text-xs" onClick={() => setTools(!tools)}>DEV</button>
  return <>
    {params.get('view') === 'skills' ? <MinigameShell><MinigameHeader backTo={backTo} backLabel="Return to proof map" title={`${names[params.get('outfit') as keyof typeof names] ?? 'Test outfit'} · RPG profile`} eyebrow="Isolated progression proof" onGuide={() => setTools(!tools)} guideLabel="Progression proof tools" trailing={headerTools} />
      <main className="min-h-0 flex-1 overflow-y-auto bg-page p-4 pb-safe"><RpgProgressionEditor host={proof.progression} outfitId={params.get('outfit') ?? 'test-outfit-0'} onSync={sync} showProfile /></main></MinigameShell>
      : params.get('view') === 'battle' ? <RpgBattleStage key={chapterId} host={proof.host.battle} checkpointId={`party-1:${chapterId}`} content={null}
      uid={proof.uid} proof names={names} backTo={backTo} onSync={sync} headerTools={headerTools} />
      : <RpgChapterMap host={proof.host} presetId="party-1" chapterId={chapterId} content={null} uid={proof.uid} proof onSync={sync}
        onSelect={(id) => route(false, id)} onBattle={() => route(true)} headerTools={headerTools} />}
    {tools && <div className="fixed inset-x-3 top-16 z-40 rounded-md border border-hairline-dark bg-stage-soft p-3 text-ink-on-dark">
      <p className="text-xs">Invented data · isolated local client/account · no actual EXP/Items</p>{error && <p role="alert">{error}</p>}
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={hold} onChange={(e) => { const next = new URLSearchParams(params); if (e.target.checked) next.set('hold', '1'); else next.delete('hold'); setParams(next) }} />Hold account acknowledgement</label>
      <button className="min-h-11 rounded-sm border border-hairline-dark px-3 text-xs" onClick={() => { void proof.sync(); setTools(false) }}>Acknowledge queued commands</button>
      <button className="ml-2 min-h-11 rounded-sm border border-hairline-dark px-3 text-xs" onClick={() => { void proof.staleDevice(); setTools(false) }}>Simulate stale device</button>
      <button className="mt-2 min-h-11 rounded-sm border border-hairline-dark px-3 text-xs" onClick={() => reset(true)}>Reset proof to Lv50 promotion</button>
      <button className="mt-2 min-h-11 rounded-sm border border-hairline-dark px-3 text-xs" onClick={() => reset()}>Reset this proof only</button>
    </div>}
  </>
}
