// Lazy chapter map; all navigation is derived from accepted checkpoints (docs/design/uma-rpg.md, T095).
import { isRpgBattleNode, rpgChapterChoices, rpgEnemyWeaknesses, RPG_TIER_MAX_LEVEL, rpgInspirationReward, type RpgChapterNode, type RpgCommandRequest } from '@racer/domain'
import { liveQuery } from 'dexie'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/AuthProvider'
import { firebaseEnabled, loadAuth } from '../../auth/firebase'
import { useContent } from '../../content/ContentProvider'
import { rpgContentLibrary } from '../../content/rpg'
import type { LoadedContent } from '../../content/runtime'
import { RpgChapterHost, type RpgChapterView } from '../../game/rpg-chapter-host'
import { gameRuntime } from '../../game/runtime'
import { Button } from '../../ui/Button'
import { MinigameHeader } from '../../ui/minigames/MinigameShell'
import { PagedGuide } from '../../ui/PagedGuide'
import { RpgModalFocus } from '../../ui/rpg/RpgModalFocus'
import { RpgElementLegend, RpgPortrait } from '../../ui/rpg/RpgPortrait'
import { RpgEnemyPortrait, useRpgPresentation } from '../../ui/rpg/RpgEnemyPortrait'
import { decodeInspirationReward } from '../../game/rpg-battle-host'
import { RpgInspirationReward } from '../../ui/rpg/RpgInspirationReward'

export function useRpgAccountId() {
  const auth = useAuth()
  const [uid, setUid] = useState<string | null>(firebaseEnabled ? null : 'local-dev')
  useEffect(() => {
    if (!firebaseEnabled) return
    let cancelled = false
    setUid(null)
    void loadAuth().then((firebase) => { if (!cancelled) setUid(firebase.currentUser?.uid ?? null) }).catch(() => { if (!cancelled) setUid(null) })
    return () => { cancelled = true }
  }, [auth.ready, auth.user?.email])
  return uid
}

export function RpgChapterMap({ host, presetId, chapterId, content, uid, onSync, onSelect, onBattle, headerTools, proof = false }: {
  host: RpgChapterHost; presetId: string; chapterId?: string; content: LoadedContent | null; uid: string | null
  onSync: () => void | Promise<void>; onSelect: (chapterId: string) => void; onBattle: (checkpointId: string) => void
  headerTools?: ReactNode; proof?: boolean
}) {
  const [view, setView] = useState<RpgChapterView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [partyOpen, setPartyOpen] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [guide, setGuide] = useState(false)
  const [recover, setRecover] = useState(false)
  const lock = useRef(false)
  useEffect(() => {
    setView(null)
    const subscription = liveQuery(() => host.read(presetId, chapterId)).subscribe({ next: setView, error: (reason: unknown) => setError(String(reason)) })
    const focus = () => { void host.read(presetId, chapterId).then(setView).catch((e: unknown) => setError(String(e))) }
    window.addEventListener('focus', focus)
    return () => { subscription.unsubscribe(); window.removeEventListener('focus', focus) }
  }, [host, presetId, chapterId])
  async function command(operation: () => Promise<void>) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(null)
    try { await operation(); await onSync(); if (!proof) await gameRuntime.refreshLocalState(); setView(await host.read(presetId, chapterId)) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { lock.current = false; setBusy(false) }
  }
  const cp = view?.checkpoint, chapter = view?.chapter, preset = view?.preset
  const presentation = useRpgPresentation(content, chapter)
  const pending = Boolean(view?.pending.length)
  const queuedEntry = view?.pending.some((r) => r.status === 'pending' && (r.body as RpgCommandRequest).action === 'begin-battle' &&
    (r.body as RpgCommandRequest).upserts.some((u) => u.kind === 'rpgCheckpoints' && u.id === cp?.id))
  const conflict = view?.pending.some((p) => p.status === 'conflict')
  const foreground = view?.checkpoints.find((c) => c.data.chapterId === preset?.data.foregroundChapterId)
  const switchBlocked = foreground?.data.chapterId !== chapter?.id && Boolean(foreground && ['in-battle', 'pending-result'].includes(foreground.data.status))
  const party = preset?.data.slots.flatMap((slot) => {
    if (!slot) return []
    const profile = view?.outfits.find((o) => o.id === slot.outfitId)?.data.profile
    return profile ? [{ slot, profile }] : []
  }) ?? []
  const average = party.length ? party.reduce((sum, { profile: p }) => sum + (p.tier - 1) * RPG_TIER_MAX_LEVEL + p.level, 0) / party.length : 0
  const warning = chapter && average < (chapter.recommendedTier - 1) * RPG_TIER_MAX_LEVEL + chapter.recommendedLevel
  const disabled = busy || pending || !uid || Boolean(view?.unavailable)
  const choices = cp && chapter && !view?.unavailable ? rpgChapterChoices(chapter, cp.data) : []
  const collecting = cp?.data.frozenEntry && decodeInspirationReward(cp.data.frozenEntry.enemyKitJson)
  const earned = view?.tokenGrants.reduce((r, g) => ({ tier: g.source.tier,
    slot: r.slot + (g.itemId.endsWith(':slot') ? g.delta : 0), skill: r.skill + (g.itemId.endsWith(':skill') ? g.delta : 0) }), { tier: 1, slot: 0, skill: 0 }) ?? null
  const name = (id: string) => content?.umas.byId.get(id)?.name ?? (proof ? ['Ember', 'Rill', 'Beacon', 'Dawn', 'Volt'][Number(id.at(-1))] ?? id : id)
  const choose = (node: RpgChapterNode) => command(async () => {
    if (!uid || !chapter) return
    const destination = await host.choose(uid, presetId, chapter.id, node.id)
    if (destination === 'battle') onBattle(cp!.id)
  })
  return <div className="flex h-dvh flex-col bg-stage text-ink-on-dark">
    <div className="shrink-0 pt-safe"><MinigameHeader backTo="/rpg" backLabel="RPG parties" eyebrow={proof ? 'Development chapter · isolated save' : 'Global Uma RPG'} title="Chapter map" trailing={headerTools} onGuide={() => setGuide(true)} guideLabel="Chapter guide" /></div>
    <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-safe">
      <div className="mx-auto max-w-xl space-y-3 pt-2 pb-8">
        {error && <p role="alert" className="rounded-sm border border-danger p-3 text-sm">{error}</p>}
        {!view && <p role="status">Reading accepted checkpoint…</p>}
        {view?.unavailable && <div role="status" className="rounded-md border border-hairline-dark bg-stage-soft p-4"><h2 className="text-xl">Chapter content unavailable</h2><p className="mt-2 text-sm text-ink-on-dark-soft">{view.unavailable}</p></div>}
        {view && !preset && <p>Save a five-outfit party in the RPG party menu first.</p>}
        {preset && <>
          <div className="flex items-center justify-between gap-2"><span className="text-sm">{preset.data.name} · {party.length}/5</span><button aria-expanded={partyOpen} onClick={() => setPartyOpen(!partyOpen)} className="min-h-11 rounded-sm border border-hairline-dark px-3 text-xs">{partyOpen ? 'Hide party' : 'Review party'}</button></div>
          {partyOpen && <div className="grid grid-cols-2 gap-2" aria-label="Five-outfit party">{party.map(({ slot, profile }) => <div key={slot.outfitId}><RpgPortrait content={content} outfitId={slot.outfitId} name={name(slot.outfitId)} weapon={profile.weapon} element={slot.signature} className="h-32" /><p className="mt-1 text-xs text-ink-on-dark-soft">Tier {profile.tier} · Lv{profile.level}</p></div>)}</div>}
          <details className="rounded-sm border border-hairline-dark bg-stage-soft"><summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm">Choose chapter / paused routes</summary><div className="space-y-2 px-3 pb-3">{view?.pack?.chapters.map((c) => {
            const saved = view.checkpoints.find((r) => r.data.chapterId === c.id)
            return <button key={c.id} onClick={() => { setError(null); onSelect(c.id) }} className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-sm border p-2 text-left text-xs ${chapter?.id === c.id ? 'border-accent' : 'border-hairline-dark'}`}><span>{c.title}</span><span>{saved?.data.status === 'cleared' ? 'Cleared' : saved ? 'Saved route' : 'Not started'}</span></button>
          })}</div></details>
          {chapter && <>
            <div><p className="text-micro text-accent">{chapter.surface} · {chapter.distance} · Tier {chapter.recommendedTier} Lv{chapter.recommendedLevel}</p><h2 className="mt-1 text-2xl">{chapter.title}</h2><p className="mt-1 text-xs text-ink-on-dark-soft">{cp ? `Attempt ${cp.data.attemptIndex} · ${cp.data.lastClearedNodeId ? chapter.nodes.find((n) => n.id === cp.data.lastClearedNodeId)?.name : 'At the entrance'}` : 'Free entry · five filled slots required'}</p></div>
            {warning && <p className="text-xs text-accent">Your party average is below the recommendation. You can still enter.</p>}
            {pending && <div role="status" className="rounded-sm border border-warning/40 bg-stage-soft p-3"><p className="text-sm">{conflict ? 'Conflict · local history preserved' : 'Pending sync · map progress not yet accepted'}</p><p className="mt-1 text-xs text-ink-on-dark-soft">No next node or clear reward opens before acknowledgement.</p><Button className="mt-2 w-full" onClick={() => { if (conflict) setRecover(true); else void onSync() }}>{conflict ? 'Review account recovery' : 'Try sync'}</Button></div>}
            {!cp && <Button className="w-full" disabled={disabled || switchBlocked || party.length !== 5} onClick={() => { void command(() => host.start(presetId, chapter.id)) }}>Start chapter · free</Button>}
            {cp && preset.data.foregroundChapterId !== chapter.id && <Button className="w-full" disabled={disabled || switchBlocked} onClick={() => { void command(() => host.focus(presetId, chapter.id)) }}>Resume this saved chapter</Button>}
            {switchBlocked && foreground?.data.status === 'pending-result' && <Button className="w-full" onClick={() => onSelect(foreground.data.chapterId)}>Return to foreground result</Button>}
            {foreground?.data.status === 'in-battle' && foreground.data.chapterId !== chapter.id && <div className="rounded-sm border border-hairline-dark p-3"><p className="text-xs">Switching chapters forfeits only the open fight's actions. Its seed and enemy kit stay fixed for a free retry.</p><Button className="mt-2 w-full" disabled={pending || busy} onClick={() => { void command(async () => { await host.battle.abandonToCheckpoint(foreground.id) }) }}>Pause foreground fight · no reward</Button></div>}
            {cp && !view.unavailable && <>
              {cp.data.status === 'cleared' && <div role="status" className="rounded-md border border-accent bg-stage-soft p-4"><h3 className="text-xl">Chapter cleared</h3><p className="mt-2 text-xs text-ink-on-dark-soft">Accepted route saved. {proof ? 'Synthetic EXP and Items stay in this isolated account.' : 'Battle EXP and collected tokens are recorded.'}</p><Button className="mt-3 w-full" disabled={disabled || switchBlocked} onClick={() => { void command(() => host.start(presetId, chapter.id, true)) }}>Replay chapter · new attempt</Button></div>}
              {(cp.data.status === 'in-battle' || queuedEntry) && <Button className="w-full" disabled={busy} onClick={() => onBattle(cp.id)}>Continue frozen battle</Button>}
              {cp.data.status === 'pending-result' && <><RpgInspirationReward reward={collecting || null} label="Collect on map acknowledgement · not yet in Items" /><Button className="w-full" disabled={disabled} onClick={() => { void command(() => host.advance(presetId, chapter.id)) }}>Accept win & collect · {cp.data.frozenEntry?.nodeId === chapter.bossNodeId ? 'clear chapter' : 'continue map'}</Button></>}
              {cp.data.status === 'at-checkpoint' && cp.data.frozenEntry && <Button className="w-full" disabled={disabled || preset.data.foregroundChapterId !== chapter.id} onClick={() => { void choose(chapter.nodes.find((n) => n.id === cp.data.frozenEntry!.nodeId)!) }}>Retry free · same encounter</Button>}
              {cp.data.status === 'at-checkpoint' && preset.data.foregroundChapterId === chapter.id && choices.length > 0 && <section aria-label="Available paths" className="space-y-3"><h3 className="text-sm text-ink-on-dark-soft">{choices.length > 1 ? 'Choose your path · both routes rejoin' : 'Next checkpoint'}</h3>{choices.map((node) => <article key={node.id} className="rounded-md border border-hairline-dark bg-stage-soft p-3">
                <p className="text-micro text-accent">{node.kind}</p><h4 className="mt-1 text-lg">{node.name}</h4><p className="mt-1 text-xs leading-5 text-ink-on-dark-soft">{node.detail}</p>
                {node.enemies.length > 0 && <div aria-label="Enemy formation" className="mt-2 space-y-2">{node.enemies.map((id, index) => {
                  const actor = view.pack!.actors.find((a) => a.id === id)!
                  return <div key={id} className="flex items-center gap-2 border-l-2 border-accent pl-2 text-xs"><RpgEnemyPortrait content={content} artId={presentation.portraits[id]} name={actor.name} className="h-12 w-10 shrink-0" /><div><p>{index === 0 ? 'Front' : `Slot ${index + 1}`} · {actor.name} · {actor.combat.element}</p><p className="mt-0.5 text-ink-on-dark-soft">{actor.role} · Weak to {rpgEnemyWeaknesses(actor.combat.element).join(', ')}</p></div></div>
                })}<button aria-expanded={preview === node.id} onClick={() => setPreview(preview === node.id ? null : node.id)} className="min-h-11 w-full rounded-sm border border-hairline-dark px-2 text-left text-xs">{preview === node.id ? 'Hide' : 'Review'} enemy intents and phases</button>{preview === node.id && node.enemies.map((id) => {
                  const actor = view.pack!.actors.find((a) => a.id === id)!
                  return <div key={id} className="text-xs leading-5 text-ink-on-dark-soft"><p>{actor.name}: {actor.combat.moves.map((m) => m.intentText).join(' · ')}</p>{actor.combat.phaseTwo && <p>At {actor.combat.phaseTwo.thresholdPercent}% HP: {actor.combat.phaseTwo.moves.map((m) => m.intentText).join(' · ')}</p>}</div>
                })}</div>}
                {isRpgBattleNode(node) && <RpgInspirationReward reward={rpgInspirationReward(chapter, node)} label="Reward preview · win and collect" />}
                <Button className="mt-3 w-full" disabled={disabled} onClick={() => { void choose(node) }}>{isRpgBattleNode(node) ? 'Enter battle' : 'Continue'} · {node.name}</Button>
              </article>)}</section>}
              <details className="rounded-sm border border-hairline-dark"><summary className="flex min-h-11 cursor-pointer items-center px-3 text-xs">Accepted route · {cp.data.selectedPath.length} checkpoints</summary><ol className="space-y-1 px-6 pb-3 text-xs text-ink-on-dark-soft">{cp.data.selectedPath.map((id) => <li key={id}>{chapter.nodes.find((n) => n.id === id)?.name}</li>)}</ol></details>
            </>}
          </>}
          <RpgInspirationReward reward={earned} label="Collected this attempt · acknowledged Items" />
          {!proof && earned && earned.slot + earned.skill > 0 && <div><Link to="/farm/items" className="flex min-h-11 items-center text-sm text-accent">Open global Items</Link>{party.map(({ slot }) => <Link key={slot.outfitId} to={`/constellation/${slot.outfitId}/inspiration?tier=${earned.tier}`} className="flex min-h-11 items-center text-sm text-accent">{name(slot.outfitId)} · Inspiration</Link>)}</div>}
          <RpgElementLegend />
          {cp && chapter && ['at-checkpoint', 'cleared'].includes(cp.data.status) && !view.pending.length && <section className="mt-3 space-y-1" aria-label="Safe checkpoint skill setup"><h3 className="text-sm">Set up RPG skills</h3><p className="text-xs text-ink-on-dark-soft">Spend earned points, equip skills or promote before the next fight.</p>{party.map(({ slot }) => <Link key={slot.outfitId} to={proof ? `/dev/rpg-chapter-proof?chapter=${chapter.id}&view=skills&outfit=${slot.outfitId}` : `/rpg/roster/${slot.outfitId}`} className="flex min-h-11 items-center text-sm text-accent">{name(slot.outfitId)} · profile & skills</Link>)}</section>}
          <Link to={`/rpg/parties/${presetId}`} className="flex min-h-11 items-center text-sm text-accent">Edit future party entries</Link>
        </>}
      </div>
    </main>
    {recover && <RpgModalFocus onClose={() => setRecover(false)}><div role="dialog" aria-modal="true" aria-label="Recover accepted account" className="fixed inset-0 z-50 flex items-center bg-stage/95 p-4"><div className="w-full rounded-md border border-hairline-dark bg-stage-soft p-4"><h2 className="text-xl">Use the accepted account checkpoint?</h2><p className="mt-3 text-sm">Rejected queued commands will be discarded, not retried. Battle journals stay on this device for diagnosis. No reward or replacement seed is created.</p><Button className="mt-4 w-full" onClick={() => { setRecover(false); void command(() => host.refreshAccount(true)) }}>Discard rejected commands and refresh</Button><Button className="mt-2 w-full" onClick={() => setRecover(false)}>Keep local history</Button></div></div></RpgModalFocus>}
    {guide && <RpgModalFocus onClose={() => setGuide(false)}><PagedGuide open startAt="route" titleId="rpg-chapter-guide" finishLabel="Back to map" onClose={() => setGuide(false)} pages={[
      { id: 'route', title: 'Choose a route', body: <p>Five filled slots enter for free. Levels are recommendations, not gates. Review enemy roles, weaknesses and visible phase plans before choosing a path.</p> },
      { id: 'accepted', title: 'Accepted checkpoints', body: <p>Battle actions save on this device. A win opens the next checkpoint only after account acknowledgement and map acceptance. Pending results grant nothing. You can edit future party entries at safe checkpoints.</p> },
      { id: 'tokens', title: 'Build your Inspiration', body: <p>Regular and elite wins supply scenario Skill Tokens; the boss supplies Slot Tokens. Collect at the map checkpoint. One slot token opens one parent or grandparent; one skill token opens one natural gold. Entry and retry are free. A mirrored grandparent outfit on both sides uses normal SP; a single-side grandparent's unique and golds cost twice the SP.</p> },
      { id: 'pause', title: 'Pause, retry, replay', body: <p>Leaving a battle keeps its turn. Switching chapters explicitly forfeits its actions but preserves the same seed and kit for a free retry. Earlier clears remain. Only replaying a cleared chapter creates a new attempt.</p> },
    ]} /></RpgModalFocus>}
  </div>
}

export function RpgChapterScreen() {
  const { presetId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const contentState = useContent()
  const content = contentState.status === 'ready' ? contentState.content : null
  const uid = useRpgAccountId()
  const navigate = useNavigate()
  const host = useMemo(() => {
    return new RpgChapterHost(identity => content ? rpgContentLibrary(content).load(identity) : Promise.resolve(null))
  }, [content])
  return <RpgChapterMap host={host} presetId={presetId} chapterId={params.get('chapter') ?? undefined} content={content} uid={uid}
    onSelect={(id) => setParams({ chapter: id })} onBattle={(id) => { void navigate(`/rpg/battle/${encodeURIComponent(id)}`) }}
    onSync={() => gameRuntime.schedule(0)} />
}
