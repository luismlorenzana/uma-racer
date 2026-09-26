import { FT_BOND_GAUGE, FT_FORMATIONS, type FtSetup, type FtState, type StatKey, type Surface } from '@racer/domain'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { LoadedContent } from '../../../content/runtime'
import { useArt } from '../../../ui/album/useArt'
import { CheckIcon, RaceIcon, SparkIcon, StaminaIcon } from '../../../ui/icons'
import { STAT_BG, STAT_ICONS } from './FtCard'

// The run's sense of place (M020): a season map across the top, and a living scene where the main card's character
// trains. Everything moves by transform and opacity; the global reduced-motion rule stills the loops.

type NodeStatus = 'done' | 'current' | 'next' | 'lost'

/** Where the run is in its season: every week and race, cleared, current or ahead. */
function seasonPosition(setup: FtSetup, state: FtState): { current: number; lost: boolean } {
  const stageBase = state.stage * 3
  switch (state.phase) {
    case 'won': return { current: setup.races.length * 3, lost: false }
    case 'lost': return { current: stageBase + Math.min(state.week, 2), lost: true }
    case 'reward': return { current: stageBase + state.week + 1, lost: false }
    case 'skill':
    case 'shop': return { current: stageBase + 3, lost: false }
    default: return { current: stageBase + Math.min(state.week, 2), lost: false }
  }
}

export function SeasonMap({ setup, state }: { setup: FtSetup; state: FtState }) {
  const { current, lost } = seasonPosition(setup, state)
  return (
    <ol className="flex items-center gap-1" aria-label={`Season: stage ${state.stage + 1} of ${setup.races.length}`}>
      {setup.races.map((race, stage) => (
        <li key={race.id} className="flex min-w-0 flex-1 items-center">
          {[0, 1, 2].map((slot) => {
            const index = stage * 3 + slot
            const status: NodeStatus = index < current ? 'done' : index === current ? (lost ? 'lost' : 'current') : 'next'
            const stat = slot < 2 ? state.weeksTrained[stage * 2 + slot] : undefined
            return (
              <span key={slot} className="flex min-w-0 flex-1 items-center">
                {slot > 0 && <span className={`h-0.5 flex-1 ${index <= current ? 'bg-accent/70' : 'bg-white/15'}`} />}
                <MapNode status={status} stat={stat} race={slot === 2 ? race.grade.toUpperCase() : undefined} />
              </span>
            )
          })}
          {stage < setup.races.length - 1 && <span className="mx-1 h-3 w-px bg-white/20" aria-hidden />}
        </li>
      ))}
    </ol>
  )
}

function MapNode({ status, stat, race }: { status: NodeStatus; stat?: StatKey; race?: string }) {
  const label = race ? `${race} race` : stat ? `${stat} week` : 'week'
  const shape = race ? 'h-7 min-w-9 rounded-sm px-1' : 'h-6 w-6 rounded-full'
  const Icon = stat ? STAT_ICONS[stat] : null
  const tone = status === 'lost' ? 'bg-danger text-white'
    : status === 'done' ? (stat && !race ? `${STAT_BG[stat]} text-white` : 'bg-accent text-ink')
      : status === 'current' ? 'border-2 border-accent bg-stage text-accent'
        : 'border border-white/20 bg-stage text-white/40'
  return (
    <span className={`relative flex shrink-0 items-center justify-center ${shape} ${tone}`} aria-label={`${label}, ${status}`}>
      {status === 'current' && <span className="absolute inset-0 animate-[ft-pulse_1.6s_ease-in-out_infinite] rounded-[inherit] border-2 border-accent" aria-hidden />}
      {race ? <span className="font-display flex items-center gap-0.5 text-[10px] font-bold"><RaceIcon size={16} />{race}</span>
        : Icon ? <Icon size={16} />
          : status === 'done' ? <CheckIcon size={16} /> : null}
    </span>
  )
}

const SPARKS = [
  { left: '12%', delay: '0s', size: 16 as const },
  { left: '26%', delay: '1.3s', size: 16 as const },
  { left: '41%', delay: '2.4s', size: 20 as const },
  { left: '63%', delay: '0.7s', size: 16 as const },
  { left: '78%', delay: '1.9s', size: 20 as const },
  { left: '90%', delay: '3s', size: 16 as const },
]

/** The main card's character: their standing chibi (celebrating once bonded), else their race face. */
function useCharacterArt(content: LoadedContent, setup: FtSetup, cheer: boolean) {
  const main = setup.cards[setup.mainCardId]!
  const uma = content.umas.items.find((entry) => entry.charaId === main.charaId && content.art.has('chibi', `${entry.id}-a`))
  const chibi = useArt(content, 'chibi', uma ? `${uma.id}-${cheer && content.art.has('chibi', `${uma.id}-b`) ? 'b' : 'a'}` : null)
  const face = useArt(content, 'face', uma ? null : main.charaId)
  return { chibi, face, name: main.name }
}

export interface SceneProps {
  content: LoadedContent
  setup: FtSetup
  state: FtState
  /** A week at a facility, a race on its surface, or a rest between them. */
  place: { kind: 'week'; stat: StatKey } | { kind: 'race'; surface: Surface } | { kind: 'rest' }
  cheer?: boolean
  children?: ReactNode
}

/** A backdrop that moves, the character who trains, their friendship hearts, and each train's result as it lands. */
export function FtScene({ content, setup, state, place, cheer = false, children }: SceneProps) {
  const reducedMotion = useReducedMotion()
  const { chibi, face, name } = useCharacterArt(content, setup, cheer || state.bonded)
  const encounter = state.encounter
  const trained = encounter?.trainsUsed ?? 0
  const result = state.lastTrain

  // A train makes the character hop and its score rise; the bond gets its own burst.
  const [pop, setPop] = useState<{ key: number; title: string; total: number } | null>(null)
  const [hops, setHops] = useState(0)
  const seen = useRef({ trained, bonded: state.bonded })
  const [burst, setBurst] = useState(0)
  useEffect(() => {
    if (trained > seen.current.trained && result) {
      setPop({ key: trained, title: FT_FORMATIONS[result.formation].name, total: result.total })
      setHops((count) => count + 1)
      const timer = setTimeout(() => setPop(null), 1500)
      seen.current.trained = trained
      return () => clearTimeout(timer)
    }
    seen.current.trained = trained
  }, [trained, result])
  useEffect(() => {
    if (state.bonded && !seen.current.bonded) setBurst((count) => count + 1)
    seen.current.bonded = state.bonded
  }, [state.bonded])

  const race = place.kind === 'race'
  const background = place.kind === 'week'
    ? `radial-gradient(120% 90% at 50% 105%, color-mix(in oklab, var(--color-stat-${place.stat}) 55%, transparent) 0%, transparent 72%), linear-gradient(180deg, var(--color-stage-soft), var(--color-stage))`
    : race
      ? 'linear-gradient(180deg, color-mix(in oklab, var(--color-info) 30%, var(--color-stage)) 0%, color-mix(in oklab, var(--color-info) 55%, var(--color-stage)) 58%, transparent 58%)'
      : 'radial-gradient(110% 80% at 50% 110%, color-mix(in oklab, var(--color-accent) 30%, transparent) 0%, transparent 70%), linear-gradient(180deg, var(--color-stage-soft), var(--color-stage))'

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-hairline-dark" style={{ background }}>
      {race && (
        <>
          <div className={`absolute inset-x-0 bottom-0 h-[42%] ${place.surface === 'dirt' ? 'bg-dirt' : 'bg-turf'}`} />
          {/* The inner rail slides past: the field is running. */}
          <div className="absolute bottom-[42%] left-0 h-3 w-[200%] animate-[ft-rails_0.5s_linear_infinite]"
            style={{ background: 'repeating-linear-gradient(90deg, rgb(255 255 255 / 0.85) 0 4px, transparent 4px 48px)' }} />
          <div className="absolute bottom-[calc(42%+10px)] inset-x-0 h-0.5 bg-white/80" />
          <div className="absolute bottom-[14%] left-0 h-1 w-[200%] animate-[ft-rails_0.5s_linear_infinite] opacity-30"
            style={{ background: 'repeating-linear-gradient(90deg, white 0 24px, transparent 24px 48px)' }} />
        </>
      )}
      {place.kind === 'week' && SPARKS.map((spark) => (
        <span key={spark.left} className="absolute bottom-[8%] animate-[ft-drift_3.6s_linear_infinite] opacity-0" style={{ left: spark.left, animationDelay: spark.delay, color: `var(--color-stat-${place.stat})` }} aria-hidden>
          <SparkIcon size={spark.size} variant="solid" />
        </span>
      ))}
      <div className="absolute bottom-[5%] left-1/2 h-4 w-40 -translate-x-1/2 rounded-[50%] bg-black/30 blur-sm" aria-hidden />

      {/* The character, bobbing at rest and quicker in a race; a train makes them hop. */}
      <div className="absolute bottom-[4%] left-1/2 flex h-[82%] max-h-56 -translate-x-1/2 items-end">
      <m.div
        key={hops}
        className="h-full"
        animate={hops > 0 && !reducedMotion ? { y: [0, -22, 0] } : undefined}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className={`h-full ${race ? 'animate-[ft-run_0.45s_ease-in-out_infinite]' : 'animate-[ft-bob_2.4s_ease-in-out_infinite]'}`}>
          {chibi ? <img src={chibi} alt={name} className="h-full w-auto object-contain drop-shadow-[0_6px_8px_rgb(0_0_0_/_0.45)]" draggable={false} />
            : face ? <img src={face} alt={name} className="mt-auto h-24 w-24 rounded-full border-2 border-accent object-cover" draggable={false} />
              : null}
        </div>
      </m.div>
      </div>

      {/* Friendship hearts: three trains together bond the card. */}
      <div className="absolute right-3 bottom-3 flex flex-col items-center gap-0.5" aria-label={state.bonded ? 'Bonded' : `Friendship ${state.gauge} of ${FT_BOND_GAUGE}`}>
        <span className="flex gap-0.5">
          {Array.from({ length: FT_BOND_GAUGE }, (_, index) => (
            <StaminaIcon key={index} size={20} variant="solid"
              className={state.bonded ? 'text-accent' : index < state.gauge ? 'text-stat-guts' : 'text-white/25'} />
          ))}
        </span>
        <span className="text-[10px] font-semibold tracking-wide text-ink-on-dark-soft uppercase">{state.bonded ? 'Bonded' : 'Friendship'}</span>
      </div>

      {children && <div className="absolute inset-x-3 top-2.5">{children}</div>}

      <AnimatePresence>
        {pop && (
          <m.div
            key={pop.key}
            className="pointer-events-none absolute inset-x-0 top-[24%] flex flex-col items-center"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 14, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -18 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <span className="font-display text-[15px] font-bold text-accent [text-shadow:0_2px_6px_rgb(0_0_0_/_0.6)]">{pop.title}</span>
            <span className="font-display text-[34px] leading-none font-black text-white [text-shadow:0_3px_10px_rgb(0_0_0_/_0.6)]">+{pop.total}</span>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {burst > 0 && (
          <m.div key={burst} className="pointer-events-none absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 1.2, duration: 0.5 }}
            onAnimationComplete={() => setBurst(0)}>
            {!reducedMotion && Array.from({ length: 8 }, (_, index) => {
              const angle = (index / 8) * Math.PI * 2
              return (
                <m.span key={index} className="absolute text-accent" initial={{ x: 0, y: 0, scale: 0.4 }}
                  animate={{ x: Math.cos(angle) * 90, y: Math.sin(angle) * 70, scale: 1 }} transition={{ duration: 0.7, ease: 'easeOut' }}>
                  <SparkIcon size={24} variant="solid" />
                </m.span>
              )
            })}
            <span className="font-display rounded-full bg-accent px-4 py-1 text-[18px] font-black text-ink shadow-2">Bonded!</span>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
