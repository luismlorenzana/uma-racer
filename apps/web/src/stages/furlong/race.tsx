// Furlong Hand's race, the top of the screen (docs/game/09-furlong-hand.md §11): the leg strip from the real course
// (straights, corners, climbs, then the spurt), the place ladder with her face and the rivals' (uma-kit album faces),
// each rival's next move under its face, her band shaded, and her bust with Breath, Drive and her place. Theme tokens
// only; every mark has words for a screen reader.
import { FaceTile, UmaBust } from '@luismlorenzana/uma-kit/album'
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, FinishIcon, GateIcon, MoreIcon, RaceIcon } from '@luismlorenzana/uma-kit/ui'
import {
  BREATH_MAX, DRIVE_BASE, DRIVE_MAX, LENGTH, MOVE, placings, type FurlongState, type FurlongTerrain,
} from '@racer/domain/stages'
import type { ReactNode } from 'react'
import { STYLE_LABEL } from '../../ui/labels'

export const TERRAIN_WORD: Readonly<Record<FurlongTerrain, string>> = { straight: 'Straight', corner: 'Corner', climb: 'Climb' }
const TERRAIN_FAVOURS: Readonly<Record<FurlongTerrain, string>> = { straight: 'Speed', corner: 'Power', climb: 'Power' }
export const favoured = (terrain: FurlongTerrain): string => TERRAIN_FAVOURS[terrain]

function TerrainIcon({ terrain, size }: { terrain: FurlongTerrain | 'spurt'; size: 16 | 20 }) {
  if (terrain === 'spurt') return <FinishIcon size={size} />
  if (terrain === 'corner') return <ChevronRightIcon size={size} />
  if (terrain === 'climb') return <ArrowUpIcon size={size} />
  return <RaceIcon size={size} />
}

/** The legs and the spurt, the spread under way marked. */
export function LegStrip({ state }: { state: FurlongState }) {
  const stops = [...state.legs.map((terrain) => terrain as FurlongTerrain | 'spurt'), 'spurt' as const]
  return (
    <ol className="flex gap-1" aria-label="The course" data-racer="furlong-legs">
      {stops.map((stop, i) => {
        const now = i === state.spread && state.phase !== 'finished'
        const past = i < state.spread || state.phase === 'finished'
        const word = stop === 'spurt' ? 'The spurt' : `Leg ${i + 1}: ${TERRAIN_WORD[stop]}`
        return (
          <li
            key={i}
            aria-current={now ? 'step' : undefined}
            aria-label={word}
            className={`flex h-7 flex-1 items-center justify-center gap-1 rounded-sm text-[11px] font-semibold ${now ? 'bg-accent text-accent-ink' : past ? 'bg-sunken text-ink-faint' : 'bg-raised text-ink-soft'}`}
          >
            <TerrainIcon terrain={stop} size={16} />
            <span className="hidden min-[360px]:inline">{stop === 'spurt' ? 'Spurt' : TERRAIN_WORD[stop].slice(0, 4)}</span>
          </li>
        )
      })}
    </ol>
  )
}

const MOVE_WORD = ['Surges', 'Holds', 'Fades', 'Closes the rail'] as const

function MoveMark({ move }: { move: number }) {
  const word = MOVE_WORD[move] ?? 'Holds'
  const icon: ReactNode = move === MOVE.surge ? <ArrowUpIcon size={16} />
    : move === MOVE.fade ? <ArrowDownIcon size={16} />
      : move === MOVE.rail ? <GateIcon size={16} />
        : <MoreIcon size={16} />
  const tone = move === MOVE.surge ? 'text-danger' : move === MOVE.fade ? 'text-success' : move === MOVE.rail ? 'text-warning' : 'text-ink-faint'
  return <span className={`flex h-4 items-center justify-center ${tone}`} role="img" aria-label={word} data-move={word}>{icon}</span>
}

const ordinal = (n: number): string => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`
export const placeWord = ordinal

/** The place ladder, 1st on the left: her face and the rivals', each rival's next move, her band shaded. */
export function Ladder({ state, umaId, nameOf }: { state: FurlongState; umaId: string; nameOf: (id: string) => string }) {
  const { her, rivals } = placings(state.ground, state.rivalGround)
  const showMoves = state.phase !== 'finished'
  const slots = Array.from({ length: state.rivals.length + 1 }, (_, i) => {
    const place = i + 1
    if (place === her) return { place, her: true as const }
    const r = rivals.indexOf(place)
    return { place, her: false as const, rival: r }
  })
  return (
    <ol className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }} aria-label="The field, first to last" data-racer="furlong-ladder">
      {slots.map((slot) => {
        const inBand = slot.place >= state.band[0] && slot.place <= state.band[1]
        const id = slot.her ? umaId : state.rivals[slot.rival]!.umaId
        const name = nameOf(id)
        const move = slot.her ? null : state.rivals[slot.rival]!.script[state.spread]
        const label = slot.her ? `${placeWord(slot.place)}: you, ${name}` : `${placeWord(slot.place)}: ${name}${showMoves && move !== undefined && move !== null ? `, ${MOVE_WORD[move]?.toLowerCase()}` : ''}`
        return (
          <li key={slot.place} aria-label={label} className={`flex min-w-0 flex-col items-center gap-0.5 rounded-sm py-0.5 ${inBand ? 'bg-accent-wash' : ''}`} data-her={slot.her ? 'true' : undefined} data-place={slot.place}>
            <span className="numeral text-[10px] font-semibold text-ink-soft">{slot.place}</span>
            <span className={`block rounded-full ${slot.her ? 'ring-2 ring-accent' : ''}`}>
              <FaceTile outfitId={id} size={32} round label={name} />
            </span>
            {showMoves && move !== null && move !== undefined ? <MoveMark move={move} /> : <span className="h-4" />}
          </li>
        )
      })}
    </ol>
  )
}

function Gauge({ label, value, max, text, tone }: { label: string; value: number; max: number; text: string; tone: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between text-[11px] text-ink-soft">
        <span>{label}</span>
        <span className="numeral font-semibold text-ink">{text}</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-sunken" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <div className={`absolute inset-0 origin-left ${tone} transition-transform duration-300`} style={{ transform: `scaleX(${Math.max(0, Math.min(1, value / max))})` }} />
      </div>
    </div>
  )
}

/** Her bust, her place against the leader and her band, Breath and Drive. */
export function HerGauges({ state, umaId, name }: { state: FurlongState; umaId: string; name: string }) {
  const { her } = placings(state.ground, state.rivalGround)
  const leader = Math.max(...state.rivalGround)
  const gap = (state.ground - leader) / LENGTH
  const gapWord = gap >= 0 ? `${gap.toFixed(1)} L clear` : `${(-gap).toFixed(1)} L behind`
  const times = (DRIVE_BASE + Math.min(DRIVE_MAX, state.drive)) / DRIVE_BASE
  return (
    <div className="flex items-center gap-3" data-racer="furlong-her">
      <span className="block size-16 shrink-0 overflow-hidden rounded-md bg-raised">
        <UmaBust outfitId={umaId} label={name} size={64} />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="flex items-baseline gap-2 text-[13px]">
          <span className="font-display text-[20px] leading-none font-bold" data-racer="furlong-place">{placeWord(her)}</span>
          <span className="text-ink-soft">{gapWord}</span>
          <span className="ml-auto truncate text-[11px] text-ink-faint">{STYLE_LABEL[state.strategy]} {state.band[0]}–{state.band[1]}</span>
        </p>
        <div className="flex gap-3">
          <Gauge label="Breath" value={state.breath} max={BREATH_MAX} text={`${state.breath}`} tone={state.breath === 0 ? 'bg-danger' : 'bg-stat-stamina'} />
          <Gauge label="Drive" value={Math.min(DRIVE_MAX, state.drive)} max={DRIVE_MAX} text={`${state.drive} · ×${times.toFixed(1)}`} tone="bg-accent" />
        </div>
      </div>
    </div>
  )
}
