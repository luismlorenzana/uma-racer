import { useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Strategy } from '@racer/domain'
import { useContent } from '../../content/ContentProvider'
import type { SparkOrb } from '../../game/minigames/spark-rival'
import { useGame } from '../../game/store'
import { SparkRivalProofScene, type SparkRivalProofHud } from '../../scenes/spark-rival/SparkRivalProofScene'
import { sparkProofCast } from '../../scenes/spark-rival/proof-cast'
import { useArtSet } from '../../ui/album/useArt'
import { QuestionIcon, SparkIcon } from '../../ui/icons'
import { SPARK_ORB_COLORS, SPARK_STRATEGY_LABELS } from '../../ui/minigames/spark-rival-presentation'
import { rememberSparkRivalGuideSeen, SparkRivalGuide, sparkRivalGuideSeen, type SparkRivalGuidePageId } from './SparkRivalGuide'

const ratio = (value: number, maximum: number) => maximum <= 0 ? 0 : Math.max(0, Math.min(1, value / maximum))

function Gauge({ label, value, maximum, color }: { label: string; value: number; maximum: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[10px] font-bold tracking-[0.08em] uppercase">
        <span>{label}</span><span className="numeral text-xs">{value}/{maximum}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/35" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={value}>
        <div className={`h-full origin-left rounded-full ${color} transition-transform duration-200`} style={{ transform: `scaleX(${ratio(value, maximum)})` }} />
      </div>
    </div>
  )
}

/** Synthetic, development-only interaction proof. Production Spark Match remains untouched until T073. */
export function SparkRivalProofScreen() {
  const systemReducedMotion = useReducedMotion()
  const contentState = useContent()
  const featuredUmaId = useGame((state) => state.profile?.featuredUmaId ?? null)
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<SparkRivalProofScene | null>(null)
  const [hud, setHud] = useState<SparkRivalProofHud | null>(null)
  const [forceReducedMotion, setForceReducedMotion] = useState(false)
  const [guide, setGuide] = useState<{ open: boolean; startAt: SparkRivalGuidePageId }>(() => ({ open: !sparkRivalGuideSeen(), startAt: 'circuit' }))
  const reducedMotion = Boolean(systemReducedMotion) || forceReducedMotion
  const content = contentState.status === 'ready' ? contentState.content : null
  const cast = useMemo(() => sparkProofCast(content?.umas.items ?? [], featuredUmaId), [content, featuredUmaId])
  const artIds = useMemo(() => cast ? [...new Set([...Object.values(cast.orbs), ...Object.values(cast.rivals)])].map((id) => `${id}-a`) : [], [cast])
  const chibis = useArtSet(content, 'chibi', artIds)
  const orbArt = useMemo<Partial<Record<SparkOrb, string | null>>>(() => cast ? Object.fromEntries(
    Object.entries(cast.orbs).map(([orb, id]) => [orb, chibis.get(`${id}-a`) ?? null]),
  ) : {}, [cast, chibis])
  const rivalArt = useMemo<Partial<Record<Strategy, string | null>>>(() => cast ? Object.fromEntries(
    Object.entries(cast.rivals).map(([strategy, id]) => [strategy, chibis.get(`${id}-a`) ?? null]),
  ) : {}, [cast, chibis])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const scene = new SparkRivalProofScene(setHud)
    sceneRef.current = scene
    scene.setReducedMotion(reducedMotion)
    void scene.mount(host)
    return () => {
      sceneRef.current = null
      scene.destroy()
    }
  }, []) // The Pixi application owns its lifecycle; options are forwarded separately.

  useEffect(() => sceneRef.current?.setReducedMotion(reducedMotion), [reducedMotion])
  useEffect(() => { void sceneRef.current?.setArt(orbArt, rivalArt) }, [orbArt, rivalArt])

  const closeGuide = () => {
    rememberSparkRivalGuideSeen()
    setGuide((current) => ({ ...current, open: false }))
  }

  return (
    <main className="game-surface flex h-dvh w-full flex-col overflow-hidden bg-stage pt-safe pb-safe text-ink-on-dark">
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-hairline-dark bg-stage/95 px-3 py-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/50 bg-accent/15 text-accent"><SparkIcon size={24} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold tracking-[0.16em] text-accent uppercase">Development touch proof · synthetic data</p>
          <h1 className="truncate text-lg">Spark Match · Rival Circuit</h1>
        </div>
        <button type="button" onClick={() => setGuide({ open: true, startAt: 'circuit' })} aria-label="How to play Spark Rival" className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-hairline-dark bg-stage-soft text-accent">
          <QuestionIcon size={20} />
        </button>
        <div className="rounded-full border border-hairline-dark bg-stage-soft px-3 py-1 text-center">
          <p className="text-[9px] text-ink-on-dark-soft uppercase">Wave</p><p className="numeral numeral-on-dark text-lg">{hud?.wave ?? 1}/3</p>
        </div>
      </header>

      <section className="grid shrink-0 grid-cols-[1fr_auto] gap-3 border-b border-hairline-dark bg-stage-soft/90 px-3 py-2" aria-label="Battle status">
        <div className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2">
          <Gauge label="Rival Resolve" value={hud?.resolve ?? 0} maximum={hud?.maxResolve ?? 1} color="bg-danger" />
          <Gauge label="Drive" value={hud?.drive ?? 0} maximum={hud?.maxDrive ?? 100} color="bg-success" />
          <Gauge label="Spark Shift" value={hud?.sparkCharge ?? 0} maximum={hud?.sparkTarget ?? 9} color="bg-accent" />
          <button type="button" onClick={() => setGuide({ open: true, startAt: 'advantage' })} className="flex min-h-11 items-center justify-between rounded-xs border border-hairline-dark bg-black/15 px-2 py-1 text-left text-xs" style={hud ? { borderColor: SPARK_ORB_COLORS[hud.rivalStrategy] } : undefined}>
            <span className="min-w-0 truncate"><b>{hud?.rivalLabel ?? 'Matchups'}</b>{hud && <span style={{ color: SPARK_ORB_COLORS[hud.rivalStrategy] }}> · {SPARK_STRATEGY_LABELS[hud.rivalStrategy].split(' ')[0]}</span>}<span className="block truncate text-[10px] text-ink-on-dark-soft">Next · {hud?.intent ?? '—'}</span></span>
            <span className="numeral ml-2 text-base">{hud?.countdown ?? '—'}</span>
          </button>
        </div>
        <div className="flex min-w-14 flex-col items-center justify-center rounded-sm border border-hairline-dark bg-black/20 px-2">
          <span className="text-[9px] text-ink-on-dark-soft uppercase">Move</span>
          <span className="numeral numeral-on-dark text-xl">{(hud?.waveTurn ?? 0) + 1}<small className="text-xs text-ink-on-dark-soft">/8</small></span>
          <span className="text-[9px] text-accent">{hud?.movementRemainingMs === null || hud?.movementRemainingMs === undefined ? 'PLAN' : `${(hud.movementRemainingMs / 1_000).toFixed(1)}s`}</span>
        </div>
      </section>

      <div ref={hostRef} className="min-h-0 flex-1" />

      <section className="shrink-0 border-t border-hairline-dark bg-stage/95 px-3 pt-2 pb-2">
        <p className="min-h-5 truncate text-center text-xs font-semibold text-ink-on-dark" role="status" aria-live="polite">{hud?.status ?? 'Preparing deterministic board…'}</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          <button type="button" className="min-h-11 rounded-sm border border-hairline-dark bg-stage-soft px-1 text-[11px] font-bold disabled:opacity-40" disabled={!hud || hud.inputLocked} onClick={() => sceneRef.current?.reset()}>Reset</button>
          <button type="button" className="min-h-11 rounded-sm border border-hairline-dark bg-stage-soft px-1 text-[11px] font-bold disabled:opacity-40" disabled={!hud || hud.inputLocked || hud.outcome !== null} onClick={() => sceneRef.current?.toggleHeldDemo()}>{hud?.dragging ? 'Cancel hold' : 'Hold drag'}</button>
          <button type="button" className="min-h-11 rounded-sm bg-accent px-1 text-[11px] font-bold text-ink shadow-2 disabled:opacity-40" disabled={!hud || hud.inputLocked || hud.dragging || hud.outcome !== null} onClick={() => sceneRef.current?.playBestAdjacentDemo()}>Demo combo</button>
          <button type="button" className="min-h-11 rounded-sm border border-accent/50 bg-accent/10 px-1 text-[11px] font-bold text-accent disabled:opacity-40" disabled={!hud || hud.inputLocked || hud.dragging || hud.sparkCharge < hud.sparkTarget} onClick={() => sceneRef.current?.triggerShift()}>Spark Shift</button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-ink-on-dark-soft">
          <label className="flex min-h-11 items-center gap-2 rounded-sm px-1">
            <input type="checkbox" checked={forceReducedMotion} onChange={(event) => setForceReducedMotion(event.target.checked)} className="h-5 w-5 accent-amber-500" />
            Reduced motion
          </label>
          <p className="text-right font-mono leading-tight" aria-label="Pixi pool and frame diagnostics">
            sprites {hud?.debug.boardSprites ?? '0/30'} · fx {hud?.debug.activeEffects ?? 0}/{hud?.debug.effectCapacity ?? 24} · {hud?.debug.fps ?? 0} fps<br />
            pointer→React {hud?.debug.pointerMoveReactUpdates ?? 0} · ignored {hud?.debug.ignoredPointers ?? 0}
          </p>
        </div>
      </section>
      <SparkRivalGuide open={guide.open} startAt={guide.startAt} onClose={closeGuide} />
    </main>
  )
}
