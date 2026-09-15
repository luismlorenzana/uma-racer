import { STRATEGIES, type Strategy } from '@racer/domain'
import { formatMargin, simulateRace } from '@racer/race'
import { AnimatePresence, m } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { RaceScene, type RaceHudState, type SceneRunner } from '../../scenes/race/RaceScene'
import { GameButton } from '../../ui/GameButton'
import { Meter } from '../../ui/Meter'
import { buildDemoField, DEMO_RACES, GRADE_LABEL, STRATEGY_LABEL } from './demoRaces'

const PHASES = ['Opening', 'Middle leg', 'Final leg', 'Last spurt']
const RIVAL_COLORS = [0x5b8def, 0xef6f6c, 0x8e6cef, 0x3cb4a4, 0xf29e4c, 0x6c8ea4, 0xd96fb6, 0x7bbf4a]

const ordinal = (n: number) => {
  const suffix = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${suffix[(v - 20) % 10] ?? suffix[v] ?? 'th'}`
}
const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`

/** Full-screen race scene (docs/design/ux.md#race-pixijs-scene). */
export function RaceRunScreen() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const race = DEMO_RACES.find((r) => r.id === params.get('race')) ?? DEMO_RACES[3]!
  const strategy = (STRATEGIES as readonly string[]).includes(params.get('strategy') ?? '')
    ? (params.get('strategy') as Strategy)
    : 'pace'
  const seed = Number(params.get('seed') ?? 1) || 1

  const { field, timeline } = useMemo(() => {
    const field = buildDemoField(race, strategy, seed)
    return { field, timeline: simulateRace(field.input) }
  }, [race, strategy, seed])

  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<RaceScene | null>(null)
  const [hud, setHud] = useState<RaceHudState | null>(null)
  const [speed, setSpeed] = useState(1)
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    setShowResults(false)
    setHud(null)
    const runners: SceneRunner[] = field.input.runners.map((r, i) => ({
      label: r.label,
      color: i === field.playerIndex ? 0xff8a3d : RIVAL_COLORS[i % RIVAL_COLORS.length]!,
      isPlayer: i === field.playerIndex,
      lane: r.gate,
    }))
    const scene = new RaceScene(timeline, runners, field.playerIndex, setHud, () => setTimeout(() => setShowResults(true), 900))
    sceneRef.current = scene
    if (import.meta.env.DEV) (window as unknown as { __raceScene?: RaceScene }).__raceScene = scene
    void scene.mount(host)
    return () => {
      scene.destroy()
      sceneRef.current = null
    }
  }, [field, timeline])

  useEffect(() => {
    sceneRef.current?.setSpeed(speed)
  }, [speed, timeline])

  // Keep the screen awake during a race where supported (Safari 18.4+).
  useEffect(() => {
    let lock: WakeLockSentinel | undefined
    navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined)
    return () => void lock?.release()
  }, [])

  const playerResult = timeline.results.find((r) => r.runner === field.playerIndex)!
  const remaining = hud ? Math.max(0, race.distance - hud.playerDistance) : race.distance

  return (
    <div className="game-surface fixed inset-0 flex flex-col bg-gradient-to-b from-sky-top via-[#bfe6ff] to-turf">
      {/* Top HUD */}
      <div className="pt-safe px-3">
        <div className="flex items-center justify-between gap-2 py-2">
          <button
            type="button"
            onClick={() => navigate('/race')}
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-white/85 text-xl font-extrabold"
            aria-label="Back"
          >
            ‹
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-lg leading-tight font-extrabold text-white text-outline">{race.name}</p>
            <p className="text-xs font-extrabold text-white/90 text-outline">
              {GRADE_LABEL[race.grade]} · {race.distance}m · {STRATEGY_LABEL[strategy]}
            </p>
          </div>
          <div className="flex gap-1">
            {[1, 2].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSpeed(n)}
                className={`h-10 min-w-10 rounded-full border-2 border-white px-2 text-sm font-extrabold ${speed === n ? 'bg-sky text-white' : 'bg-white/85'}`}
              >
                {n}×
              </button>
            ))}
            <button
              type="button"
              onClick={() => sceneRef.current?.skipToEnd()}
              className="h-10 min-w-10 rounded-full border-2 border-white bg-white/85 px-2 text-sm font-extrabold"
              aria-label="Skip"
            >
              ⏭
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-2xl border-2 border-white/80 bg-ink/35 px-3 py-1.5 text-white">
          <m.span
            key={hud?.phase ?? 0}
            initial={{ x: -12, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className={`font-extrabold ${hud?.phase === 3 ? 'text-gold' : ''}`}
          >
            {PHASES[hud?.phase ?? 0]}
          </m.span>
          <span className="font-extrabold tabular-nums">{Math.round(remaining)}m left</span>
        </div>
      </div>

      {/* Track */}
      <div ref={hostRef} className="relative min-h-0 flex-1" />

      {/* Bottom HUD */}
      <div className="pb-safe px-3">
        <div className="mb-2 rounded-2xl border-2 border-white bg-white/90 p-3 shadow-[var(--shadow-panel)]">
          <div className="relative mb-3 h-3 rounded-full bg-ink/10">
            {(hud?.shares ?? field.input.runners.map(() => 0)).map((share, i) => (
              <span
                key={i}
                className={`absolute top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full border border-white ${
                  i === field.playerIndex ? 'z-10 h-4 w-4 bg-[#ff8a3d]' : 'h-2.5 w-2.5 bg-ink/45'
                }`}
                style={{ left: `${Math.min(1, share) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="w-14 text-2xl font-extrabold tabular-nums">{hud ? ordinal(hud.playerPosition) : '—'}</span>
            <div className="flex-1">
              <p className="mb-1 text-xs font-extrabold text-ink-soft">STAMINA</p>
              <Meter
                value={hud?.playerHp ?? 1}
                color={(hud?.playerHp ?? 1) < 0.2 ? '#ff5a5f' : 'linear-gradient(90deg,#2ec27e,#8be07a)'}
                height={12}
                motion="linear"
              />
            </div>
            <span className="w-16 text-right text-sm font-extrabold tabular-nums text-ink-soft">{formatTime(hud?.seconds ?? 0)}</span>
          </div>
        </div>
      </div>

      {/* Results */}
      <AnimatePresence>
        {showResults && (
          <m.div className="fixed inset-0 z-40 flex items-end bg-ink/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <m.div
              className="pb-safe w-full rounded-t-[1.75rem] border-t-2 border-white bg-cream px-4 pt-4"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            >
              <m.p
                className={`text-center text-6xl font-extrabold text-outline ${playerResult.placement === 1 ? 'text-gold' : 'text-sky-deep'}`}
                initial={{ scale: 2.4, rotate: -12, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.15 }}
              >
                {playerResult.placement === 1 ? '1st!' : ordinal(playerResult.placement)}
              </m.p>
              <p className="mt-1 text-center text-sm font-extrabold text-ink-soft">
                {formatTime(playerResult.finishTime)} · spurt {playerResult.spurtMaxed ? 'at full power' : 'held back'}
              </p>
              <ol className="mt-3 max-h-[38dvh] overflow-y-auto rounded-2xl border-2 border-white bg-white">
                {timeline.results.map((result, i) => {
                  const isPlayer = result.runner === field.playerIndex
                  return (
                    <m.li
                      key={result.id}
                      initial={{ x: 40, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.3 + i * 0.03 }}
                      className={`flex items-center gap-3 border-b border-ink/5 px-3 py-2 ${isPlayer ? 'bg-gold/20' : ''}`}
                    >
                      <span className="w-8 font-extrabold tabular-nums">{result.placement}</span>
                      <span className="flex-1 font-extrabold">
                        {isPlayer ? '★ You' : `Rival #${field.input.runners[result.runner]!.label}`}
                        <span className="ml-2 text-xs text-ink-soft">
                          {STRATEGY_LABEL[field.input.runners[result.runner]!.strategy]}
                        </span>
                      </span>
                      <span className="text-sm text-ink-soft">{formatMargin(result.marginLengths)}</span>
                    </m.li>
                  )
                })}
              </ol>
              <div className="mt-3 grid grid-cols-2 gap-3 pb-4">
                <GameButton variant="secondary" onClick={() => navigate('/race')}>
                  Races
                </GameButton>
                <GameButton
                  variant="go"
                  onClick={() => {
                    const next = new URLSearchParams(params)
                    next.set('seed', String(Math.floor(Math.random() * 2 ** 31)))
                    setParams(next, { replace: true })
                  }}
                >
                  Race again
                </GameButton>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
