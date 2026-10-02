// Five-member phone stage; commands and outcomes come only from the host (docs/design/uma-rpg.md).
import { combatSkill, combatStateHash, type CombatState, type CombatUnit } from '@racer/domain'
import { liveQuery } from 'dexie'
import { m, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../auth/AuthProvider'
import { firebaseEnabled, loadAuth } from '../../auth/firebase'
import { useContent } from '../../content/ContentProvider'
import type { LoadedContent } from '../../content/runtime'
import { DexieRpgBattleHost, type RpgBattleHost, type RpgBattleView } from '../../game/rpg-battle-host'
import { gameRuntime } from '../../game/runtime'
import { Button } from '../../ui/Button'
import { MinigameHeader, MinigameShell } from '../../ui/minigames/MinigameShell'
import { battleChoices, battleTargets, chosenAction, describeCue, humanize, projectBattleChoice, targetRelation } from '../../ui/rpg/battle-presentation'
import { IdentityGlyph, RpgPortrait, RPG_WEAPON_LABELS } from '../../ui/rpg/RpgPortrait'
import { useBattlePlayback } from '../../ui/rpg/useBattlePlayback'
import { RpgBattleGuide } from './RpgBattleGuide'

function Gauge({ label, value, maximum, mp = false }: { label: string; value: number; maximum: number; mp?: boolean }) {
  return <div className="flex min-w-0 items-center gap-1 text-[10px] leading-3">
    <span className="w-4 shrink-0 text-ink-on-dark-soft">{label}</span>
    <span role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={maximum}
      className="h-1.5 min-w-3 flex-1 overflow-hidden rounded-full bg-white/10">
      <span className={`block h-full origin-left ${mp ? 'bg-info' : 'bg-success'}`} style={{ transform: `scaleX(${maximum ? value / maximum : 0})` }} />
    </span><span className="numeral min-w-12 text-right">{value}/{maximum}</span>
  </div>
}

function BattleDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const backdrop = ref.current?.parentElement
    const siblings = [...backdrop?.parentElement?.children ?? []].filter((child): child is HTMLElement => child instanceof HTMLElement && child !== backdrop)
    const inertBefore = siblings.map((child) => child.inert)
    for (const child of siblings) child.inert = true
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { siblings.forEach((child, index) => { child.inert = inertBefore[index]! }); previous?.focus() }
  }, [])
  return <div className="fixed inset-0 z-50 flex items-end bg-black/65" onClick={onClose}>
    <m.div ref={ref} role="dialog" aria-modal="true" aria-label={title} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="pb-safe flex max-h-[90dvh] w-full flex-col rounded-t-lg border border-hairline-dark bg-stage-soft text-ink-on-dark"
      onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
        if (event.key === 'Escape') { event.stopPropagation(); onClose() }
        if (event.key !== 'Tab') return
        const controls = [...ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,[tabindex="0"]')]
        const first = controls[0], last = controls.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }}>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-hairline-dark px-4 py-2">
        <h2 className="text-lg">{title}</h2><button className="min-h-11 rounded-sm border border-hairline-dark px-4" onClick={onClose}>Close</button>
      </header><div className="min-h-0 overflow-y-auto overscroll-contain p-4 text-[13px] leading-6">{children}</div>
    </m.div>
  </div>
}

function HostNotice({ view }: { view: RpgBattleView }) {
  const text = view.kind === 'pending' ? view.phase === 'result' ? 'Result pending · not yet earned' : view.phase === 'takeover'
    ? 'Takeover pending · wait for sync' : 'Entry pending sync · play stays on this device'
    : view.kind === 'accepted' ? 'Result acknowledged' : view.kind === 'open' ? `Saved on device · action ${view.actionCount}`
      : humanize(view.kind)
  return <p className="shrink-0 border-b border-hairline-dark bg-stage-soft px-3 py-1 text-center text-[10px] text-ink-on-dark-soft" role="status">{text}</p>
}

/** Port injection is used only by the DEV proof and component tests; production always uses the real host. */
export function RpgBattleStage({ host, checkpointId, content, uid, proof = false, names = {}, portraits = {}, headerTools, onSync }: {
  host: RpgBattleHost; checkpointId: string; content: LoadedContent | null; uid: string | null; proof?: boolean;
  names?: Readonly<Record<string, string>>; portraits?: Readonly<Record<string, string>>; headerTools?: ReactNode; onSync?: () => void
}) {
  const [view, setView] = useState<RpgBattleView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actorId, setActorId] = useState('')
  const [choiceId, setChoiceId] = useState('attack')
  const [targetId, setTargetId] = useState('')
  const [dialog, setDialog] = useState<'guide' | 'skills' | 'preview' | 'leave' | 'takeover' | 'intents' | null>(null)
  const [busy, setBusy] = useState(false)
  const [forceReduced, setForceReduced] = useState(false)
  const [announcement, setAnnouncement] = useState('Select an outfit, action and target.')
  const [beforePlayback, setBeforePlayback] = useState<CombatState | null>(null)
  const submitting = useRef(false)
  const reducedMotion = Boolean(useReducedMotion()) || forceReduced
  const playback = useBattlePlayback(reducedMotion)
  useLayoutEffect(() => {
    const body = document.body.style.overflow, html = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'; document.documentElement.style.overflow = 'hidden'
    return () => { document.body.style.overflow = body; document.documentElement.style.overflow = html }
  }, [])
  useEffect(() => {
    setView(null); setError(null)
    let cancelled = false
    let subscription: { unsubscribe: () => void } | undefined
    // DEV hosts may initialize their separate journal on first use; a liveQuery itself is strictly read-only.
    void host.resume(checkpointId).then((initial) => {
      if (cancelled) return
      setView(initial)
      subscription = liveQuery(() => host.resume(checkpointId)).subscribe({ next: setView,
        error: (reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)) })
    }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason)) })
    const refresh = () => { void host.resume(checkpointId).then(setView).catch((reason: unknown) => setError(String(reason))) }
    window.addEventListener('focus', refresh)
    return () => { cancelled = true; subscription?.unsubscribe(); window.removeEventListener('focus', refresh) }
  }, [host, checkpointId])

  const state = view?.state ?? null
  const display = playback.playing && beforePlayback ? beforePlayback : state
  const name = (id: string) => names[id] ?? content?.umas.byId.get(id)?.name ?? humanize(id)
  const inputAvailable = view && ((view.kind === 'open' && view.recovery === 'none') ||
    (view.kind === 'pending' && view.phase === 'entry' && view.recovery !== 'restart-journal')) && state?.outcome === 'active'
  const locked = busy || playback.playing || !inputAvailable
  const eligible = state?.input.allies.filter((ally) => state.units.some((unit) => unit.id === ally.id && unit.hp > 0) && !state.acted.includes(ally.id)) ?? []
  const actor = eligible.find((ally) => ally.id === actorId) ?? eligible[0]
  const choices = useMemo(() => state && actor ? battleChoices(state, actor.id) : [], [state, actor])
  const choice = choices.find((part) => part.id === choiceId) ?? choices.find((part) => part.kind === 'attack')
  const targets = state && actor && choice ? battleTargets(state, actor.id, choice) : []
  const target = targets.find((part) => part.id === targetId) ?? targets.find((part) => !part.error)
  const preview = state && actor && choice && target ? projectBattleChoice(state, actor.id, target.id, choice) : null
  const impact = preview?.cues.find((cue) => cue.kind === 'hit' || cue.kind === 'heal')
  const impactAmount = impact && 'amount' in impact ? impact.amount ?? 0 : 0
  const cueText = playback.cue && display ? describeCue(playback.cue, view?.cueState ?? display, name, view?.lastAction ?? undefined) : announcement
  const selectedIntent = display?.intents.find((part) => part.enemyId === target?.id) ?? display?.intents[0]
  const enemy = display?.input.enemies.find((part) => part.id === selectedIntent?.enemyId)
  const enemyMove = enemy && [...enemy.moves, ...enemy.phaseTwo?.moves ?? []].find((part) => part.id === selectedIntent?.moveId)
  const intentText = selectedIntent ? `${name(selectedIntent.enemyId)}: ${enemyMove?.intentText ?? 'Intent'} → ${name(selectedIntent.targetId)}` : 'No enemy intent'

  async function command(operation: () => Promise<RpgBattleView>) {
    if (submitting.current) return
    submitting.current = true; setBusy(true); setError(null); setDialog(null)
    try { setView(await operation()); setAnnouncement('Saved battle updated.'); onSync?.() }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { submitting.current = false; setBusy(false) }
  }
  async function confirm() {
    if (locked || !state || !view || !actor || !choice || !target || !preview || preview.error || submitting.current) return
    submitting.current = true; setBusy(true); setError(null)
    const action = chosenAction(actor.id, target.id, choice)
    try {
      const next = await host.submitAction(checkpointId, view.actionCount, action)
      if (!next.state || combatStateHash(next.state) !== preview.hash) {
        setView(next); throw new Error('Battle changed while confirming. Review the saved turn before acting again.')
      }
      setBeforePlayback(state); setView(next)
      const message = next.cues.filter((cue) => cue.kind !== 'intent').map((cue) => describeCue(cue, state, name, action)).join('. ')
      setAnnouncement(message || 'Action saved.')
      await playback.play(next.cues)
      setBeforePlayback(null); setActorId(''); setTargetId(''); setChoiceId('attack')
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { submitting.current = false; setBusy(false) }
  }
  const result = view && (view.kind === 'accepted' || view.kind === 'loss' || view.kind === 'pending' && view.phase === 'result')
  const unavailable = view && (view.kind === 'frozen-content-unavailable' || view.kind === 'conflict' ||
    view.kind === 'open' && view.recovery !== 'none' || view.kind === 'pending' && (view.phase === 'takeover' || view.recovery === 'restart-journal'))
  const loss = view && (view.kind === 'loss' || view.kind === 'accepted' && view.outcome === 'loss' || state?.outcome === 'loss')
  const retry = () => {
    if (!uid) throw new Error('Sign in before retrying this battle')
    const nodeId = view?.checkpoint.frozenEntry?.nodeId ?? (proof ? 'proof-node' : null)
    if (!nodeId) throw new Error('Frozen battle entry is unavailable; no replacement encounter was generated')
    return host.enter(uid, checkpointId, nodeId)
  }
  function combatant(unit: CombatUnit) {
    if (!display) return null
    const ally = display.input.allies.find((part) => part.id === unit.id)
    const foe = display.input.enemies.find((part) => part.id === unit.id)
    const stats = ally?.stats ?? foe!.stats
    const targeting = targets.find((part) => part.id === unit.id)
    const selected = playback.playing ? (ally ? view?.lastAction?.actorId : view?.lastAction?.targetId) === unit.id : ally ? actor?.id === unit.id : target?.id === unit.id
    const highlighted = playback.cue && 'targetId' in playback.cue && playback.cue.targetId === unit.id
    const statusLabel = unit.statuses.map((part) => `${humanize(part.kind)}, ${part.stacks} stacks, ${part.turns} turns`).join('; ')
    const label = ally ? `${name(unit.id)}, ${RPG_WEAPON_LABELS[ally.weapon]}, ${humanize(ally.signature)}, HP ${unit.hp} of ${stats.hp}, MP ${unit.mp} of ${stats.mp}${unit.hp === 0 ? ', KO' : ''}${display.acted.includes(unit.id) ? ', acted' : ''}${statusLabel ? `, ${statusLabel}` : ''}`
      : `${name(unit.id)}, ${humanize(foe!.element)}, HP ${unit.hp} of ${stats.hp}, phase ${unit.phase}`
    const selectAsTarget = choice?.target === 'ally' || choice?.target === 'all-allies' || choice?.target === 'self'
    const disabled = locked || (ally && !selectAsTarget ? unit.hp === 0 || display.acted.includes(unit.id) : !targeting || Boolean(targeting.error))
    return <m.button key={unit.id} type="button" aria-label={label} aria-pressed={Boolean(selected || selectAsTarget && target?.id === unit.id)}
      disabled={Boolean(disabled)} onClick={() => {
        if (ally && !selectAsTarget) { setActorId(unit.id); setChoiceId('attack'); setTargetId('') }
        else setTargetId(unit.id)
      }} animate={{ scale: highlighted ? 1.025 : 1, opacity: unit.hp === 0 ? 0.45 : 1 }} transition={{ duration: reducedMotion ? 0 : 0.12 }}
      className={`relative flex min-h-14 min-w-0 items-center gap-1.5 rounded-sm border px-1.5 py-1 text-left ${selected || selectAsTarget && target?.id === unit.id ? 'border-accent bg-accent/10' : 'border-hairline-dark bg-stage-soft'} ${ally ? '' : 'w-40 shrink-0'} [@media(max-height:700px)]:min-h-12`}>
      {ally ? <RpgPortrait compact content={content} outfitId={portraits[ally.id] ?? ally.id} name={name(ally.id)} weapon={ally.weapon} element={ally.signature}
        className="h-12 w-10 shrink-0 [@media(max-height:700px)]:h-10" />
        : <span className="flex h-10 w-8 shrink-0 flex-col items-center justify-center rounded-sm bg-white/5"><IdentityGlyph element={foe!.element} /><span className="mt-0.5 text-[9px]">P{unit.phase}</span></span>}
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-1 text-[11px] font-semibold"><span className="truncate">{name(unit.id)}</span><span className="text-[9px] text-accent">{unit.hp === 0 ? 'KO' : ally && display.acted.includes(unit.id) ? 'Done' : ''}</span></span>
        <span className="block truncate text-[9px] text-ink-on-dark-soft">{ally ? `${RPG_WEAPON_LABELS[ally.weapon]} · ${humanize(ally.signature)}` : `${humanize(foe!.element)} · ${choice ? targetRelation(display, unit.id, choice) : ''}`}</span>
        <Gauge label="HP" value={unit.hp} maximum={stats.hp} />{ally && <Gauge label="MP" value={unit.mp} maximum={stats.mp} mp />}
        {unit.statuses.length > 0 && <span className="block truncate text-[9px] text-accent" title={unit.statuses.map((part) => `${humanize(part.kind)} ×${part.stacks}, ${part.turns} turns`).join('; ')}>{unit.statuses.map((part) => `${humanize(part.kind)} ${part.turns}t`).join(' · ')}</span>}
        {unit.guardingFor && <span className="block truncate text-[9px] text-accent">Guarding {name(unit.guardingFor)}</span>}
      </span>
    </m.button>
  }

  return <MinigameShell playing className="!touch-pan-y">
    <MinigameHeader backTo="/rpg" backLabel="Leave battle, keep saved turn" eyebrow={proof ? 'Development proof · no rewards' : 'Global Uma RPG'}
      title="RPG battle" headline={{ label: 'Round', value: display?.round ?? '—' }} onGuide={() => setDialog('guide')} guideLabel="Battle guide" trailing={headerTools} />
    {view && <HostNotice view={view} />}
    {error && <p role="alert" className="shrink-0 px-3 py-2 text-[12px] text-red-300">{error}<button onClick={() => { void host.resume(checkpointId).then(setView).then(() => setError(null)).catch((reason: unknown) => setError(String(reason))) }} className="ml-2 min-h-11 underline">Reload saved view</button></p>}
    {!view && !error && <p className="p-6" role="status">Restoring frozen battle…</p>}
    {unavailable && view && <section className="min-h-0 flex-1 overflow-y-auto p-4">
      <h2 className="text-xl">{view.kind === 'conflict' ? 'Battle changed on another device' : view.kind === 'frozen-content-unavailable' ? 'Frozen content unavailable' : view.kind === 'pending' && view.phase === 'takeover' ? 'Waiting for takeover' : view.kind === 'open' && view.recovery === 'takeover-required' ? 'Battle belongs to another device' : 'Local journal unavailable'}</h2>
      <p className="mt-3 text-sm text-ink-on-dark-soft">{view.kind === 'conflict' ? 'Your local history is preserved. Return to the accepted checkpoint; no provisional rewards were applied.' : view.kind === 'frozen-content-unavailable' ? 'The exact saved kit cannot be loaded. No replacement enemy, seed or reward has been generated.' : 'The saved seed, party and enemy kit stay fixed. Recovery never grants a new board or rewards.'}</p>
      {'reason' in view && <p className="mt-2 break-all text-xs text-ink-on-dark-soft">{view.reason}</p>}
      {view.kind === 'open' && view.recovery === 'takeover-required' && <Button className="mt-4 w-full" onClick={() => setDialog('takeover')}>Review takeover</Button>}
      {(view.kind === 'open' || view.kind === 'pending') && view.recovery === 'restart-journal' && <Button className="mt-4 w-full" disabled={busy} onClick={() => { void command(() => host.restartFromFrozenEntry(checkpointId)) }}>Restart same frozen battle</Button>}
      {view.kind === 'pending' && view.phase === 'takeover' && <Button className="mt-4 w-full" disabled={busy} onClick={onSync}>Try sync</Button>}
      <Link to="/rpg" className="mt-4 flex min-h-11 items-center text-accent">Return to RPG checkpoint</Link>
    </section>}
    {!unavailable && result && view && !playback.playing && <section className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4" aria-label="Battle result">
      <p className="text-micro text-accent">{view.kind === 'pending' ? 'Projected result · not yet earned' : 'Acknowledged result'}</p>
      <h2 className="mt-1 text-3xl">{loss ? 'Party defeated' : 'Victory'}</h2>
      <p className="mt-2 text-[13px] text-ink-on-dark-soft">{state ? `Round ${state.round} · ${view.actionCount} saved actions` : 'Saved result; the local replay is unavailable.'}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">{state?.input.allies.map((ally) => <div key={ally.id} className="rounded-sm border border-hairline-dark bg-stage-soft p-2">
        <p className="text-[12px] font-semibold">{name(ally.id)} · {state.units.find((part) => part.id === ally.id)?.hp === 0 ? 'KO' : 'Standing'}</p>
        <p className="text-[10px] text-ink-on-dark-soft">{RPG_WEAPON_LABELS[ally.weapon]} · {humanize(ally.signature)}</p>
        <p className="mt-1 text-xs">RPG EXP {view.evidence?.memberExp.find((part) => part.outfitId === ally.id)?.delta ?? 0}</p>
      </div>)}</div>
      <h3 className="mt-4 text-sm">Decisive actions</h3>
      <ul className="mt-1 space-y-1 text-[12px] text-ink-on-dark-soft">{state && view.cues.filter((cue) => cue.kind !== 'intent').map((cue, index) => <li key={index}>{describeCue(cue, view.cueState ?? state, name, view.lastAction ?? undefined)}</li>)}</ul>
      <p className="mt-4 rounded-sm border border-hairline-dark bg-stage-soft p-3 text-[12px]">{proof ? 'Test encounter: no RPG EXP, Items or account progress awarded.' : view.kind === 'pending' ? 'Not yet earned. EXP, Items and the next map node remain unavailable until the result is acknowledged.' : 'EXP is read from the accepted receipt. Item and campaign rewards are not configured yet.'}</p>
      {view.kind === 'pending' && <Button className="mt-3 w-full" disabled={busy} onClick={() => { void command(() => host.complete(checkpointId)) }}>Submit result / try sync</Button>}
      {loss && view.kind !== 'pending' && <Button className="mt-3 w-full" disabled={busy || !uid} onClick={() => { void command(retry) }}>Retry free · same seed and enemy kit</Button>}
      <Link to="/rpg" className="mt-3 flex min-h-11 items-center justify-center text-accent">Return to RPG</Link>
    </section>}
    {!unavailable && (!result || playback.playing) && display && <>
      <section className="flex min-h-0 flex-1 flex-col justify-center gap-2 px-3 py-2 [@media(max-height:700px)]:gap-1 [@media(max-height:700px)]:py-1" aria-label="Battle formation">
        <div className="flex shrink-0 gap-2 overflow-x-auto overscroll-contain pb-1" aria-label="Enemy targets">{display.units.filter((unit) => unit.side === 'enemy').map(combatant)}</div>
        <button onClick={() => setDialog('intents')} className="flex min-h-11 shrink-0 items-center justify-between gap-1 text-left text-[10px] text-ink-on-dark-soft" aria-label="Review all enemy intents"><span className="truncate">{intentText}</span><span className="shrink-0 text-accent">Plans</span></button>
        <div className="grid shrink-0 grid-cols-2 gap-1.5" aria-label="Five party members">{display.units.filter((unit) => unit.side === 'ally').map(combatant)}</div>
        <m.p aria-hidden animate={{ opacity: playback.cue ? 1 : 0.8, y: playback.cue ? -2 : 0 }} transition={{ duration: reducedMotion ? 0 : 0.1 }}
          className="line-clamp-2 min-h-7 shrink-0 text-center text-[11px] leading-[14px] text-accent">{cueText}</m.p>
      </section>
      <footer className="shrink-0 border-t border-hairline-dark bg-stage-soft px-3 pt-2 pb-2">
        <p className="truncate text-[10px] text-ink-on-dark-soft">Actor: <b className="text-ink-on-dark">{playback.playing && view?.lastAction ? name(view.lastAction.actorId) : actor ? name(actor.id) : '—'}</b> · Target: <b className="text-ink-on-dark">{playback.playing && view?.lastAction ? name(view.lastAction.targetId) : target ? name(target.id) : '—'}</b></p>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {(['attack', 'skill', 'guard'] as const).map((kind) => <button type="button" key={kind} disabled={locked || kind === 'skill' && !choices.some((part) => part.kind === 'skill')}
            aria-pressed={choice?.kind === kind} onClick={() => { if (kind === 'skill') setDialog('skills'); else { setChoiceId(choices.find((part) => part.kind === kind)?.id ?? kind); setTargetId('') } }}
            className={`min-h-11 rounded-sm border text-sm font-semibold disabled:opacity-40 ${choice?.kind === kind ? 'border-accent bg-accent/15 text-accent' : 'border-hairline-dark bg-stage'}`}>{humanize(kind)}</button>)}
        </div>
        <button disabled={locked} onClick={() => setDialog('preview')} className="mt-1 flex min-h-11 w-full items-center justify-between gap-2 text-left text-[11px] leading-4 disabled:opacity-60" aria-label="Review projected action effect">
          <span className="min-w-0"><b className="block truncate">{choice?.label ?? 'Select action'} · {choice?.mp ?? 0} MP · {choice ? humanize(choice.channel) : ''}</b>
            <span className="block truncate text-ink-on-dark-soft">{preview?.error ? humanize(preview.error) : choice && target && state ? `${targetRelation(state, target.id, choice)} · ${impactAmount} ${choice.kind === 'guard' ? 'Guard ally' : choice.target.includes('allies') || choice.target === 'ally' ? 'HP restored' : 'first impact'} · Details` : 'Select a legal target'}</span></span>
          <span className="shrink-0 text-accent">Details</span>
        </button>
        {playback.playing ? <Button className="w-full" onClick={playback.skip}>Skip animation · action already saved</Button>
          : <Button className="w-full" disabled={locked || !preview || Boolean(preview.error)} onClick={() => { void confirm() }}>Confirm {choice?.kind === 'skill' ? 'skill' : choice?.label.toLowerCase() ?? 'action'}</Button>}
      </footer>
    </>}
    <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
    {dialog === 'guide' && <RpgBattleGuide onClose={() => setDialog(null)} reduced={forceReduced} setReduced={setForceReduced} onAbandon={() => setDialog('leave')} canAbandon={Boolean(inputAvailable) && !busy && !playback.playing} proof={proof} />}
    {dialog && dialog !== 'guide' && <BattleDialog title={dialog === 'skills' ? 'Equipped skills' : dialog === 'preview' ? 'Projected action effect' : dialog === 'intents' ? 'Enemy intents' : dialog === 'takeover' ? 'Take over this battle?' : 'Leave this battle?'} onClose={() => setDialog(null)}>
      {dialog === 'intents' && display && <div className="space-y-3">{display.intents.map((intent) => {
        const foe = display.input.enemies.find((part) => part.id === intent.enemyId)!
        const move = [...foe.moves, ...foe.phaseTwo?.moves ?? []].find((part) => part.id === intent.moveId)!
        return <div key={intent.enemyId}><p className="font-semibold">{name(foe.id)} → {name(intent.targetId)}</p><p>{move.intentText} · {humanize(move.kind)} · {humanize(move.channel)} · {move.element ? humanize(move.element) : 'Neutral'}{move.status ? ` · ${humanize(move.status)}` : ''}</p></div>
      })}</div>}
      {dialog === 'skills' && <div className="space-y-2">{choices.filter((part) => part.kind === 'skill').map((part) => {
        const legal = state && actor ? battleTargets(state, actor.id, part).some((candidate) => !candidate.error) : false
        return <button key={part.id} disabled={!legal || locked} className="flex min-h-14 w-full items-center justify-between rounded-sm border border-hairline-dark bg-stage p-3 text-left disabled:opacity-40"
          onClick={() => { setChoiceId(part.id); setTargetId(''); setDialog(null) }}><span>{part.label}<small className="block text-ink-on-dark-soft">Tier {part.skill?.tier} · Depth {part.skill?.depth} · {humanize(part.target)}</small></span><span>{part.mp} MP{!legal && <small className="block">Unavailable</small>}</span></button>
      })}</div>}
      {dialog === 'preview' && state && actor && choice && target && preview && <div className="space-y-2">
        <p><b>{name(actor.id)} → {name(target.id)}</b></p><p>{choice.label} · {humanize(choice.channel)} · {choice.mp} MP</p>
        <p>Base ×{choice.base.toFixed(2)}{choice.rider > 0 ? ` + ${humanize(choice.element!)} elemental rider ×${choice.rider.toFixed(2)}` : ' · no physical rider'}</p>
        <p>{targetRelation(state, target.id, choice)} · {humanize(choice.target)}{choice.skill && combatSkill(choice.skill)?.status ? ` · ${humanize(combatSkill(choice.skill)!.status!)}` : ''}</p>
        <p className="text-ink-on-dark-soft">{intentText}</p>
        <p className="font-semibold">Engine projection{state.input.allies.filter((ally) => state.units.some((unit) => unit.id === ally.id && unit.hp > 0) && !state.acted.includes(ally.id)).length === 1 ? ' · includes enemy round' : ''}</p>
        <ul>{preview.cues.map((cue, index) => <li key={index}>{describeCue(cue, state, name, chosenAction(actor.id, target.id, choice))}</li>)}</ul>
      </div>}
      {dialog === 'takeover' && <><p>This makes the former device stale. Wait for sync acknowledgement, then explicitly restart the identical frozen seed, party and enemy kit. Its old action history remains archived.</p><Button className="mt-3 w-full" disabled={busy} onClick={() => { void command(() => host.takeover(checkpointId)) }}>Confirm same-seed takeover</Button></>}
      {dialog === 'leave' && <><p>Abandon earns nothing. Retry remains free with the same frozen enemy kit and seed. To keep the exact turn, close this dialog and use Back instead.</p><Button className="mt-3 w-full" disabled={busy || !inputAvailable} onClick={() => { void command(() => host.abandonToCheckpoint(checkpointId)) }}>Confirm abandon · no rewards</Button></>}
    </BattleDialog>}
  </MinigameShell>
}

export function RpgBattleScreen() {
  const { checkpointId = '' } = useParams()
  const contentState = useContent()
  const auth = useAuth()
  const [uid, setUid] = useState<string | null>(firebaseEnabled ? null : 'local-dev')
  useEffect(() => {
    if (!firebaseEnabled) return
    let cancelled = false
    setUid(null)
    void loadAuth().then((firebase) => { if (!cancelled) setUid(firebase.currentUser?.uid ?? null) }).catch(() => { if (!cancelled) setUid(null) })
    return () => { cancelled = true }
  }, [auth.ready, auth.user?.email])
  const host = useMemo(() => new DexieRpgBattleHost(), [])
  return <RpgBattleStage host={host} checkpointId={checkpointId} content={contentState.status === 'ready' ? contentState.content : null}
    uid={uid} onSync={() => gameRuntime.schedule(0)} />
}
