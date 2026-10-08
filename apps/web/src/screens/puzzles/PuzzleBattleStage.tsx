// Shared real battle/practice view; DOM HUD and Pixi board have separate update rates (Uma Puzzles §9).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { PUZZLE_ACTIVES, PUZZLE_ELEMENTS, PUZZLE_MOVEMENT_MS, PUZZLE_TURN_LIMIT, puzzleEnemyIntentViews, puzzleFocus,
  type PuzzleBattleAction, type PuzzleBattleStateV1, type PuzzleBattleTransition } from '@racer/domain'
import { getContentAsset, type LoadedContent } from '../../content/runtime'
import type { PuzzleCastLease } from '../../game/puzzles/host'
import type { PuzzleBattlePhase } from '../../game/puzzles/battle-session'
import { puzzleTurnAnnouncement } from '../../game/puzzles/battle-presentation'
import { useArtSet } from '../../ui/album/useArt'
import { AtlasSprite } from '../../ui/AtlasSprite'
import { MinigameHeader, MinigameShell } from '../../ui/minigames/MinigameShell'
import { PuzzleButton, PuzzleModal } from '../../ui/puzzles/components'
import { PuzzleElementMark } from '../../ui/puzzles/ElementMark'
import { puzzleActiveLabel, puzzleLeaderLabel, puzzlePatternLabel } from '../../ui/puzzles/kit'
import { StableIcon } from '../../ui/icons'
import { PuzzleGuide, PuzzleWeaknessLegend, puzzleGuideMemory } from './PuzzleGuide'
import type { PuzzleBattleScene, PuzzleSceneHud, PuzzleSceneImage } from '../../scenes/puzzles/PuzzleBattleScene'
import { createPuzzleScene } from '../../scenes/puzzles/load'
export interface PuzzleBattleStageProps {
  state: PuzzleBattleStateV1; phase: PuzzleBattlePhase; error?: string | null; content?: LoadedContent
  lease?: PuzzleCastLease; isolated: boolean; practice?: boolean; backTo: string; practiceTo: string
  act(action: PuzzleBattleAction, animate: (step: PuzzleBattleTransition) => Promise<void>): Promise<unknown>
  restore(): Promise<unknown>
}
export function puzzleEnemyAssets(state: PuzzleBattleStateV1, lease?: PuzzleCastLease): (PuzzleSceneImage | null)[] {
  const p = lease?.presentation
  return state.input.enemies.map(e => {
    const m = p?.pack.members.find(m => m.id === e.castId), f = m && p?.atlas.frames.find(f => f.id === m.art.frameId)
    const page = f && p?.atlas.pages[f.page], url = f && p?.pageUrls[f.page]
    return f && page && url ? { url, frame: f } : null
  })
}
function visualPreference() { try { return localStorage.getItem('uma-racer:puzzle-orbs') === 'plain' } catch { return false } }
export function PuzzleBattleStage(props: PuzzleBattleStageProps) {
  const { state, phase, content, isolated, practice, backTo, practiceTo } = props
  const latest = useRef(props); latest.current = props
  const node = useRef<HTMLDivElement>(null), scene = useRef<PuzzleBattleScene | null>(null), focusRef = useRef<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null), [sheet, setSheet] = useState<'legend' | 'abandon' | number | string | null>(null)
  const [guide, setGuide] = useState(() => !practice && !puzzleGuideMemory(isolated).seen())
  const [plain, setPlain] = useState(visualPreference), reduced = Boolean(useReducedMotion())
  const [landscape, setLandscape] = useState(() => innerWidth > innerHeight)
  const [sceneError, setSceneError] = useState<string | null>(null), [sceneRetry, setSceneRetry] = useState(0), [sceneReady, setSceneReady] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [hud, setHud] = useState<PuzzleSceneHud>({ remaining: PUZZLE_MOVEMENT_MS, dragging: false, foeHeight: 95, feedback: 'Drag an orb through its neighbours.' })
  const blocked = useRef(false); blocked.current = guide || sheet !== null || landscape || Boolean(props.error || sceneError)
  focusRef.current = focus
  const identity = state.input.battleId, epoch = state.input.ownerEpoch
  const ids = useMemo(() => state.input.entrants.map(e => `${e.outfitId}-a`), [identity])
  const chibis = useArtSet(content ?? null, 'chibi', ids)
  const boardJoin = useMemo(() => Object.fromEntries(PUZZLE_ELEMENTS.map((element, i) => [element,
    state.input.entrants.find(e => e.element === element) ?? state.input.entrants[i % state.input.entrants.length]!])), [identity])
  useEffect(() => {
    let cancelled = false; setSceneReady(false); setSceneError(null)
    const initial = latest.current
    void (async () => {
      const board = Object.fromEntries(PUZZLE_ELEMENTS.map(e => [e, content ? getContentAsset(content, 'uma-icons', boardJoin[e]!.outfitId) ?? undefined : undefined]))
      const created = await createPuzzleScene({ host: node.current!, state: initial.state,
        art: { board, enemies: puzzleEnemyAssets(initial.state, initial.lease), isolated }, plain, reducedMotion: reduced,
        canInput: () => latest.current.phase === 'ready' && !document.hidden && !blocked.current,
        focus: () => focusRef.current,
        act: async (action, animate) => latest.current.act(action, async step => { await animate(step); if (!cancelled) setAnnouncement(puzzleTurnAnnouncement(step)) }),
        hud: h => { if (!cancelled) setHud(h) } })
      if (cancelled) { created.destroy(); return }
      scene.current = created; created.pause(document.hidden || guide || landscape); setSceneReady(true)
    })().catch(e => { if (!cancelled) setSceneError(e instanceof Error ? e.message : 'Board renderer unavailable; the journal is retained.') })
    return () => { cancelled = true; scene.current?.destroy(); scene.current = null }
  }, [identity, epoch, content, isolated, sceneRetry])
  useEffect(() => { scene.current?.setState(state) }, [state, sceneReady])
  useEffect(() => { scene.current?.setVisuals(plain, reduced) }, [plain, reduced, sceneReady])
  useEffect(() => {
    const sources = Object.fromEntries(PUZZLE_ELEMENTS.flatMap(e => { const url = chibis.get(`${boardJoin[e]!.outfitId}-a`); return url ? [[e, url]] : [] }))
    void scene.current?.setBoardArt(sources)
  }, [chibis, boardJoin, sceneReady])
  useEffect(() => { scene.current?.pause(guide || sheet !== null || landscape || document.hidden) }, [guide, sheet, landscape, sceneReady])
  useEffect(() => {
    const visibility = () => { scene.current?.pause(true); if (!document.hidden) void latest.current.restore().then(() => scene.current?.pause(blocked.current)) }
    const viewport = () => { scene.current?.cancel(); setLandscape(innerWidth > innerHeight) }
    document.addEventListener('visibilitychange', visibility); window.addEventListener('resize', viewport)
    window.visualViewport?.addEventListener('resize', viewport); window.addEventListener('orientationchange', viewport)
    return () => { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('resize', viewport)
      window.visualViewport?.removeEventListener('resize', viewport); window.removeEventListener('orientationchange', viewport) }
  }, [])
  const target = puzzleFocus(state, focus), intents = puzzleEnemyIntentViews(state)
  const locked = phase !== 'ready' || !sceneReady || hud.dragging || !!sceneError
  const activeSlot = typeof sheet === 'number' ? sheet : null, active = activeSlot === null ? null : PUZZLE_ACTIVES.find(a => a.id === state.input.entrants[activeSlot]!.kit.activeId)!
  const selectedEnemy = typeof sheet === 'string' ? state.enemies.find(e => e.id === sheet) : null
  const selectedIndex = selectedEnemy ? state.enemies.indexOf(selectedEnemy) : -1
  const intent = selectedEnemy && intents.find(v => v.enemyId === selectedEnemy.id)
  const def = selectedIndex >= 0 ? state.input.enemies[selectedIndex]! : null
  const confirmBlocked = activeSlot === null || !active || locked || state.members[activeSlot]!.usedInGap ||
    state.members[activeSlot]!.charge < active.charge ||
    active.effect === 'delay' && Boolean(intents.find(i => i.enemyId === target)?.delayImmune || state.enemies.find(e => e.id === target)?.delayed) ||
    active.effect === 'shield' && state.shield >= active.reduction ||
    active.effect === 'convert' && !state.board.some(o => o !== 'heart' && o !== state.input.entrants[activeSlot]!.element)
  const name = (id: string) => content?.umas.byId.get(id)?.name ?? `Practice Uma ${state.input.entrants.findIndex(e => e.outfitId === id) + 1}`
  return <MinigameShell playing><MinigameHeader backTo={backTo} backReloadDocument={practice} backLabel="Suspend and return to map" title={practice ? 'Touch practice' : 'Uma Puzzles'}
    eyebrow={isolated ? 'Isolated · Original DEV sprites' : `PL ${state.input.encounterLevel} · ${state.input.kind}`}
    onGuide={() => { scene.current?.cancel(); setGuide(true) }} guideLabel="Uma Puzzles battle guide"
    headline={{ label: 'Drag', value: `${state.turn}/${PUZZLE_TURN_LIMIT}` }} />
    <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col px-2">
      <div className="shrink-0 pt-2" aria-label={`Party HP ${state.hp} of ${state.maxHp}`}>
        <div className="flex justify-between text-xs"><span>HP <b className="numeral numeral-on-dark">{state.hp}/{state.maxHp}</b></span><span className="text-ink-on-dark-soft">RCV {state.rcv}{state.shield > 0 ? ` · Shield ${Math.round(state.shield * 100)}%` : ''}</span></div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stage-soft"><div className="h-full bg-puzzle-heart" style={{ width: `${100 * state.hp / state.maxHp}%` }} /></div>
      </div>
      <div className="relative min-h-0 flex-1" data-testid="puzzle-stage">
        <div ref={node} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex" style={{ height: hud.foeHeight }}>
          {state.enemies.map((e, i) => {
            const d = state.input.enemies[i]!, v = intents.find(v => v.enemyId === e.id), selected = target === e.id
            const foeName = props.lease?.presentation?.pack.members.find(m => m.id === d.castId)?.name ?? `Practice foe ${i + 1}`
            return <button key={e.id} disabled={locked || !e.hp} aria-pressed={selected} aria-label={`${foeName}, ${e.element}, HP ${e.hp}, countdown ${e.countdown}, ${selected ? 'target' : 'choose target and inspect'}`}
              className={`pointer-events-auto flex min-h-11 min-w-11 flex-1 flex-col justify-between rounded-sm px-1 py-1 text-[10px] ${selected ? 'border border-accent' : 'border border-transparent'}`}
              onClick={() => { scene.current?.cancel(); setFocus(e.id); setSheet(e.id) }}>
              <span className="grid w-full gap-0.5 rounded-sm bg-stage/85 px-1"><span className="truncate text-[9px]">{foeName}</span><span className="flex items-center justify-center gap-1"><PuzzleElementMark element={e.element} size={15} />{selected ? 'Target · ' : ''}{e.hp ? `in ${e.countdown}` : 'Defeated'}</span></span>
              <span className="grid w-full gap-0.5 rounded-sm bg-stage/90 px-1"><span>{e.hp}/{d.maxHp} HP</span><span className="h-1 rounded-full bg-stage-soft"><span className="block h-1 bg-accent" style={{ width: `${100 * e.hp / d.maxHp}%` }} /></span>
                <span>{v?.mitigatedDamage !== null && v?.mitigatedDamage !== undefined ? `Next hit ${v.mitigatedDamage}` : v?.intent.type ?? 'Done'}{e.phaseFired ? ' · Rage' : d.phase ? ` · Phase <${d.phase.atHpPercent}%` : ''}</span>
                {(e.guard || e.ward) && <span>{e.guard ? `Guard ${e.guard.comboThreshold}+` : `Ward ${e.ward!.comboThreshold}+`} combos · {Math.max(0, (e.guard ?? e.ward)!.expiresAfterTurn - state.turn)} drags</span>}</span>
            </button>
          })}
        </div>
        {!sceneReady && !sceneError && <p role="status" className="absolute inset-0 grid place-items-center bg-stage/80">Restoring board renderer…</p>}
      </div>
      <div className="flex h-6 shrink-0 items-center justify-between gap-2 text-[11px]"><span className="truncate">{phase === 'ready' ? hud.feedback : phase === 'saving' ? 'Saving your path…' : phase === 'animating' ? hud.feedback : phase === 'committing' ? 'Saving rewards…' : 'Input paused'}</span><span className="numeral numeral-on-dark shrink-0 text-accent" aria-hidden="true">{(hud.remaining / 1000).toFixed(1)}s</span></div>
      <div className="grid shrink-0 grid-cols-5 gap-1" aria-label="Party actives">
        {state.input.entrants.map((e, i) => { const a = PUZZLE_ACTIVES.find(a => a.id === e.kit.activeId)!, m = state.members[i]!, ready = m.charge >= a.charge && !m.usedInGap
          return <button key={e.outfitId} disabled={locked} onClick={() => { scene.current?.cancel(); setSheet(i) }} aria-label={`${name(e.outfitId)}: ${puzzleActiveLabel(a.id)}, ${m.charge}/${a.charge} charge, ${ready ? 'ready' : 'charging'}, inspect`}
            className={`relative min-h-11 overflow-hidden rounded-sm border ${ready ? 'border-accent' : 'border-hairline-dark'} bg-stage-soft`}>
            <div className="relative h-12"><AtlasSprite asset={content ? getContentAsset(content, 'uma-icons', e.outfitId) : null} alt="" fallback={<span className="grid h-full place-items-center text-accent"><StableIcon size={32} /></span>} />
              <span className="absolute right-0 top-0 rounded-bl-sm bg-stage/95"><PuzzleElementMark element={e.element} size={16} /></span>
              {i === 0 && <span className="absolute left-0 top-0 bg-stage/95 px-1 text-[9px]">Leader</span>}</div>
            <span className="block truncate px-1 text-[9px]">{a.effect === 'convert' ? 'Convert' : a.effect === 'shield' ? 'Shield' : 'Delay'} · {m.usedInGap ? 'Used' : `${m.charge}/${a.charge}`}</span>
          </button> })}
      </div>
      <div className="grid shrink-0 grid-cols-3 gap-2 py-2"><PuzzleButton secondary onClick={() => { scene.current?.cancel(); setSheet('legend') }}>Matchups</PuzzleButton>
        <PuzzleButton secondary aria-pressed={plain} onClick={() => { scene.current?.cancel(); setPlain(!plain); try { localStorage.setItem('uma-racer:puzzle-orbs', !plain ? 'plain' : 'chibi') } catch { /* Device preference only. */ } }}>{plain ? 'Chibi orbs' : 'Plain orbs'}</PuzzleButton>
        <PuzzleButton secondary disabled={locked} onClick={() => { scene.current?.cancel(); setSheet('abandon') }}>Leave fight</PuzzleButton></div>
    </div>
    <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
    {(props.error || sceneError) && <PuzzleModal title="Saved fight needs attention" onClose={() => { /* Locked until Retry or navigation. */ }}><p role="alert">{props.error ?? sceneError}</p><p className="my-3 text-sm">The accepted journal is retained. No replacement fight was reserved.</p><PuzzleButton onClick={() => { if (sceneError) setSceneRetry(n => n + 1); void props.restore() }}>Retry restore</PuzzleButton><a className="ml-4 inline-flex min-h-11 items-center" href={backTo}>Return to map</a></PuzzleModal>}
    {landscape && <PuzzleModal title="Continue in portrait" onClose={() => {}}><p>Rotate back to portrait. Your accepted board is preserved; the unfinished drag was cancelled.</p><a className="mt-3 flex min-h-11 items-center" href={backTo}>Return to map</a></PuzzleModal>}
    {sheet === 'legend' && <PuzzleModal title="Element matchups" onClose={() => setSheet(null)}><PuzzleWeaknessLegend /></PuzzleModal>}
    {sheet === 'abandon' && <PuzzleModal title="Leave this fight?" onClose={() => setSheet(null)}><p>Abandon gives zero EXP and materials. Earlier progress stays saved. Back instead suspends this same board.</p><PuzzleButton className="mt-4 w-full" onClick={() => { setSheet(null); void props.act({ type: 'abandon' }, async step => { setAnnouncement(puzzleTurnAnnouncement(step)) }) }}>Confirm abandonment</PuzzleButton></PuzzleModal>}
    {active && activeSlot !== null && <PuzzleModal title={name(state.input.entrants[activeSlot]!.outfitId)} onClose={() => setSheet(null)}>
      <div className="grid gap-3 text-sm"><p>{puzzleActiveLabel(active.id)}</p><p>{puzzlePatternLabel(state.input.entrants[activeSlot]!.kit.patternId)}</p>
        {activeSlot === 0 && <p>Leader: {puzzleLeaderLabel(state.input.leaderId)}</p>}
        <p>{active.effect === 'convert' ? `Converts up to ${active.count} eligible non-Heart orbs to this Uma’s element. Conversion alone does not resolve a drag.` : active.effect === 'shield' ? 'Protects the next damaging enemy phase, including all its attacks. Does not stack.' : `Delays the current target by ${active.steps} drag. Immune targets cannot be cast on.`}</p>
        <p>Charge {state.members[activeSlot]!.charge}/{active.charge}{state.members[activeSlot]!.usedInGap ? ' · already used in this gap' : ''}.</p>
        <PuzzleButton disabled={confirmBlocked} onClick={() => { const slot = activeSlot; setSheet(null); void scene.current?.active({ type: 'use-active', slot, focusId: target }) }}>Confirm active</PuzzleButton>
      </div></PuzzleModal>}
    {selectedEnemy && def && intent && <PuzzleModal title="Target and next intent" onClose={() => setSheet(null)}>
      <div className="grid gap-3 text-sm"><PuzzleElementMark element={selectedEnemy.element} label /><p>HP {selectedEnemy.hp}/{def.maxHp} · Defence {def.defense} · In {intent.countdown} drags</p>
        <p>{intent.intent.type === 'attack' ? `Displayed hit ${intent.displayedDamage}; after guard/shield ${intent.mitigatedDamage}.` : intent.intent.type === 'heal' ? `Heals the lowest-HP ally by up to ${intent.intent.amount}.` : intent.intent.type === 'convert' ? `Converts ${intent.intent.count} ${intent.intent.from} orbs to ${intent.intent.to}.` : `${intent.intent.type}: ${Math.round(intent.intent.reduction * 100)}% reduction, break at ${intent.intent.comboThreshold}+ combos, ${intent.intent.durationDrags} drags.`}</p>
        {[selectedEnemy.guard, selectedEnemy.ward].map((b, i) => b && <p key={i}>{i ? 'Ward' : 'Guard'}: {Math.round(b.reduction * 100)}% · {b.comboThreshold}+ combos to break · {Math.max(0, b.expiresAfterTurn - state.turn)} drags remaining</p>)}
        <p>{intent.delayImmune ? 'Immune to delay' : 'Can be delayed'}</p>{def.phase && <p>{selectedEnemy.phaseFired ? 'Rage active' : `Rage below ${def.phase.atHpPercent}% HP`}: hit ×{def.phase.damageMultiplier}, countdown {def.phase.countdown}{def.phase.element ? `, element becomes ${def.phase.element}` : ''}. This gives a full warned interval.</p>}
      </div></PuzzleModal>}
    <PuzzleGuide open={guide} startAt="drag" onClose={() => setGuide(false)} isolated={isolated} practiceTo={practiceTo} />
  </MinigameShell>
}
