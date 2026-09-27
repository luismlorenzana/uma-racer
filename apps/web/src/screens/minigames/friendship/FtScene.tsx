import { FT_BOND_GAUGE, FT_FORMATIONS, type FtSetup, type FtState, type StatKey, type Surface } from '@racer/domain'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getContentAsset, type LoadedContent } from '../../../content/runtime'
import { AtlasSprite } from '../../../ui/AtlasSprite'
import { useArt } from '../../../ui/album/useArt'
import { CheckIcon, RaceIcon, SparkIcon, HeartIcon } from '../../../ui/icons'
import { TypeIcon } from '../../../ui/TypeIcon'

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

/** Where she is, in words: the headline over the season track. */
function whereNow(setup: FtSetup, state: FtState, current: number): { title: string; detail: string } {
  const stages = setup.races.length
  if (state.phase === 'won') return { title: 'Season cleared', detail: `${stages} stage${stages === 1 ? '' : 's'} won` }
  const stage = Math.min(Math.floor(current / 3), stages - 1)
  const slot = current - stage * 3
  const race = setup.races[stage]!
  const grade = race.grade.toUpperCase()
  const title = state.phase === 'lost' ? 'Run over'
    : slot >= 3 ? `Stage ${stage + 1} cleared`
      : slot === 2 ? `${grade} race` : `Training week ${slot + 1}`
  const detail = slot >= 3 ? (stage + 1 < stages ? 'Next: a skill, the shop, then stage ' + (stage + 2) : 'Last stage done')
    : slot === 2 ? `Stage ${stage + 1} of ${stages} · win it to clear the stage`
      : `Stage ${stage + 1} of ${stages} · ${slot === 0 ? 'two weeks' : 'one week'}, then the ${grade} race`
  return { title, detail }
}

/**
 * The season track (D183): every training week and race of the run, big enough to read at a glance, with where she is
 * now in words above it. A trained week shows the facility's icon; the race shows its grade.
 */
export function SeasonMap({ setup, state }: { setup: FtSetup; state: FtState }) {
  const { current, lost } = seasonPosition(setup, state)
  const stages = setup.races.length
  const { title, detail } = whereNow(setup, state, current)
  const size = stages >= 3 ? 'sm' : 'md'
  return (
    <section className="rounded-md border border-hairline-dark bg-stage-soft px-3 pt-2 pb-2.5" aria-label={`Season: ${title}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display truncate text-[15px] font-semibold">{title}</p>
        <p className="shrink-0 text-[11px] font-semibold text-ink-on-dark-soft tabular-nums">
          {Math.min(current + (lost ? 1 : 0), stages * 3)} / {stages * 3}
        </p>
      </div>
      <p className="truncate text-[11px] text-ink-on-dark-soft">{detail}</p>
      <ol className="mt-2 flex gap-2">
        {setup.races.map((race, stage) => (
          <li key={race.id} className="min-w-0 flex-1">
            <p className={`mb-1 text-center text-[9px] font-bold tracking-wide uppercase ${Math.floor(current / 3) === stage ? 'text-accent' : 'text-ink-on-dark-soft'}`}>Stage {stage + 1}</p>
            <div className="flex items-start">
              {[0, 1, 2].map((slot) => {
                const index = stage * 3 + slot
                const status: NodeStatus = index < current ? 'done' : index === current ? (lost ? 'lost' : 'current') : 'next'
                const stat = slot < 2 ? state.weeksTrained[stage * 2 + slot] : undefined
                return (
                  <span key={slot} className={`flex min-w-0 items-start ${slot > 0 ? 'flex-1' : ''}`}>
                    {slot > 0 && <span className={`mt-[15px] h-0.5 min-w-1 flex-1 ${index <= current ? 'bg-accent/70' : 'bg-white/15'} ${size === 'sm' ? 'mt-[13px]' : ''}`} />}
                    <MapNode status={status} stat={stat} size={size}
                      label={slot === 2 ? race.grade.toUpperCase() : `Week ${slot + 1}`} race={slot === 2} />
                  </span>
                )
              })}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function MapNode({ status, stat, label, race, size }: { status: NodeStatus; stat?: StatKey; label: string; race: boolean; size: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-7' : 'h-8'
  const shape = race ? `${box} ${size === 'sm' ? 'min-w-9' : 'min-w-11'} rounded-sm px-1` : `${box} ${size === 'sm' ? 'w-7' : 'w-8'} rounded-full`
  const tone = status === 'lost' ? 'bg-danger text-white'
    : status === 'done' ? (race ? 'bg-accent text-ink' : 'bg-white/10 text-white')
      : status === 'current' ? 'border-2 border-accent bg-stage text-accent'
        : 'border border-white/20 bg-stage text-white/40'
  return (
    <span className="relative flex shrink-0 flex-col items-center gap-0.5" aria-label={`${label}, ${status === 'current' ? 'now' : status}`}>
      <span className={`relative flex items-center justify-center ${shape} ${tone}`}>
        {status === 'current' && <span className="absolute inset-0 animate-[ft-pulse_1.6s_ease-in-out_infinite] rounded-[inherit] border-2 border-accent" aria-hidden />}
        {race ? <span className="font-display flex items-center gap-0.5 text-[11px] font-bold">{status === 'done' ? <CheckIcon size={16} /> : <RaceIcon size={16} />}{label}</span>
          : status === 'done' && stat ? <TypeIcon type={stat} size={size === 'sm' ? 28 : 32} />
            : status === 'done' ? <CheckIcon size={16} />
              : <span className="font-display text-[12px] font-bold">{label.slice(-1)}</span>}
      </span>
      <span className={`text-[9px] leading-3 font-semibold whitespace-nowrap ${status === 'current' ? 'text-accent' : 'text-ink-on-dark-soft'}`}>
        {status === 'current' ? 'Now' : race ? 'Race' : label}
      </span>
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

/**
 * The main card's character: their standing chibi (celebrating once bonded), else their race face, else, for the staff
 * and team cards whose characters are not Umas, the card's own icon.
 */
function useCharacterArt(content: LoadedContent, setup: FtSetup, cheer: boolean) {
  const main = setup.cards[setup.mainCardId]!
  const uma = content.umas.items.find((entry) => entry.charaId === main.charaId && content.art.has('chibi', `${entry.id}-a`))
  const chibi = useArt(content, 'chibi', uma ? `${uma.id}-${cheer && content.art.has('chibi', `${uma.id}-b`) ? 'b' : 'a'}` : null)
  const face = useArt(content, 'face', uma ? null : main.charaId)
  return { chibi, face, icon: getContentAsset(content, 'card-icons', setup.mainCardId), name: main.name }
}

export interface SceneProps {
  content: LoadedContent
  setup: FtSetup
  state: FtState
  /** A week at a facility, a race on its surface, or a rest between them. */
  place: { kind: 'week'; stat: StatKey } | { kind: 'race'; surface: Surface } | { kind: 'rest' }
  cheer?: boolean
  /** A short strip between choices, rather than the stage that fills a training week. */
  compact?: boolean
  children?: ReactNode
}

/** A backdrop that moves, the character who trains, their friendship hearts, and each train's result as it lands. */
export function FtScene({ content, setup, state, place, cheer = false, compact = false, children }: SceneProps) {
  const reducedMotion = useReducedMotion()
  const { chibi, face, icon, name } = useCharacterArt(content, setup, cheer || state.bonded)
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
    <div className={`relative overflow-hidden rounded-lg border border-hairline-dark ${compact ? 'h-28 shrink-0' : 'min-h-0 flex-1'}`} style={{ background }}>
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
            : face ? <img src={face} alt={name} className={`mt-auto rounded-full border-2 border-accent object-cover ${compact ? 'h-16 w-16' : 'h-24 w-24'}`} draggable={false} />
              : <AtlasSprite asset={icon} alt={name} className={`mt-auto rounded-[22%] border-2 border-accent ${compact ? 'h-16 w-16' : 'h-24 w-24'}`} />}
        </div>
      </m.div>
      </div>

      {/* Friendship hearts: three trains together bond the card, and it then counts as every type. */}
      <div className="absolute right-3 bottom-3 flex flex-col items-center gap-0.5" aria-label={state.bonded ? 'Bonded' : `Friendship ${state.gauge} of ${FT_BOND_GAUGE}`}>
        <span className="flex gap-0.5">
          {Array.from({ length: FT_BOND_GAUGE }, (_, index) => (
            <HeartIcon key={index} size={20} variant="solid"
              className={state.bonded ? 'text-accent' : index < state.gauge ? 'text-stat-guts' : 'text-white/25'} />
          ))}
        </span>
        <span className="text-[10px] font-semibold tracking-wide text-ink-on-dark-soft uppercase">
          {state.bonded ? 'Bonded · every type' : `Friendship ${state.gauge}/${FT_BOND_GAUGE}`}
        </span>
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
