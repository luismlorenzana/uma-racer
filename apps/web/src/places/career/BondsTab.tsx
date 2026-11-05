// Upgrade's Bonds (D387): each deck card's bond track as a 0–100 bar with its stops marked (a tick at every hint, the
// friendship stop at 80, the event skills at 100), her bond on it, and what the next stop brings, the next hint's skill
// named. **Pour** is preselected to the Bond that reaches the next stop, or all she has when that's less
// (`pour-bond`).
import { Button, HeartIcon } from '@luismlorenzana/uma-kit/ui'
import type { SkillTemplate, SupportCardTemplate } from '@racer/domain'
import type { CareerRecord, OperationEnv, SaveState } from '@racer/domain/save'
import { CardSquare } from '../../ui/ArtSquare'
import { TypeIcon } from '../../ui/TypeIcon'
import { titledCardName } from '../../ui/words'
import { careersWords, trackView, type TrackView } from './model'
import { useCareerOp } from './useCareerOp'

const STOP_TONE = { hint: 'bg-ink/30', friendship: 'bg-accent-strong', events: 'bg-tier-gold' } as const

/** The bar: her bond as a scaled fill (transform only), the stops as ticks over it. */
function BondBar({ track, label }: { track: TrackView; label: string }) {
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={track.value}
      className="relative h-3 w-full overflow-hidden rounded-full bg-sunken" data-racer="bond-bar">
      <div className="h-full w-full origin-left rounded-full bg-stat-guts transition-transform duration-300" style={{ transform: `scaleX(${track.value / 100})` }} />
      {track.stops.map((stop) => (
        <span key={`${stop.kind}-${stop.at}`} aria-hidden data-stop={stop.kind} data-at={stop.at}
          className={`absolute top-0 h-full ${stop.kind === 'hint' ? 'w-px' : 'w-0.5'} ${STOP_TONE[stop.kind]}`}
          style={{ left: `calc(${stop.at}% - ${stop.at === 100 ? 2 : 1}px)` }} />
      ))}
    </div>
  )
}

/** What the next stop brings, in words: the next hint's skill, friendship, or the event skills. */
export function nextStopWords(track: TrackView, card: SupportCardTemplate, skills: ReadonlyMap<string, SkillTemplate>): string {
  if (track.next === null) return careersWords('bond-full')
  if (track.next.kind === 'friendship') return careersWords('next-friendship', { at: track.next.at })
  if (track.next.kind === 'events') return careersWords('next-events', { at: track.next.at })
  const skillId = card.hintSkillIds.length === 0 ? undefined : card.hintSkillIds[track.hints % card.hintSkillIds.length]
  const skill = skillId === undefined ? undefined : skills.get(skillId)
  return skill === undefined ? careersWords('next-hint-plain', { at: track.next.at }) : careersWords('next-hint', { skill: skill.name, at: track.next.at })
}

export function BondsTab({ careerId, career, state, env }: { careerId: string; career: CareerRecord; state: SaveState; env: OperationEnv }) {
  const op = useCareerOp()
  const have = career.wallet.bond
  return (
    <div className="space-y-3" data-racer="bonds-tab">
      <p className="flex items-center gap-1.5 text-[14px] font-semibold" aria-label={`${careersWords('bond-wallet')} ${have}`}>
        <HeartIcon size={20} variant="solid" className="text-stat-guts" />
        <span aria-hidden>{careersWords('bond-wallet')}</span>
        <span aria-hidden className="numeral">{have}</span>
      </p>
      {career.deck.length === 0 ? <p className="rounded-md border border-hairline bg-panel p-4 text-center text-[14px] text-ink-soft">{careersWords('no-deck')}</p> : (
        <ul className="space-y-2">
          {career.deck.map((id) => {
            const card = env.content.cards.get(id)
            const track = trackView(career, state, env.content.cards, id)
            if (card === undefined || track === null) return null
            const amount = track.next === null ? 0 : Math.min(track.toNext, have)
            const name = titledCardName(card)
            return (
              <li key={id} className="space-y-2 rounded-md border border-hairline bg-panel p-2" data-bond-card={id} data-bond={track.value}>
                <div className="flex items-center gap-2">
                  <span className="w-11 shrink-0"><CardSquare cardId={id} name={name} tight bottomLeft={<TypeIcon type={card.type} size={16} />} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{name}</span>
                    <span className="block truncate text-[12px] text-ink-soft" data-racer="next-stop">{nextStopWords(track, card, env.content.skills)}</span>
                  </span>
                  <span className="numeral font-display text-xl font-bold" aria-hidden>{track.value}</span>
                </div>
                <BondBar track={track} label={careersWords('bond-of', { card: name, value: track.value })} />
                <Button size="sm" className="w-full" disabled={amount === 0 || op.busy} data-pour={amount}
                  onClick={() => void op.go('pour-bond', { careerId, cardId: id, amount })}>
                  <span className="flex items-center justify-center gap-1"><HeartIcon size={16} />{amount === 0 ? careersWords('pour-none') : careersWords('pour', { n: amount })}</span>
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      {op.error !== null && <p role="alert" className="text-[13px] text-danger">{op.error}</p>}
    </div>
  )
}
