// A card's page (docs/game/02-unlocks.md §3, docs/game/11-hub-and-places.md §3.1; D386),
// `/town/card-library/card/:cardId`: its art and type, its era as the first scenario it can be used in, its running-style
// and distance focus, **Unlock · 1 Card Ticket** while it's locked (committing `unlock-card`, then a short reveal of its
// art), its power as a bar against its type's median, its real effects at level 50 named in plain words, its unique
// effect's description, and its hint and event skills. Every number comes from the private content at runtime.
import { Button, EraIcon, Panel, UiMark } from '@luismlorenzana/uma-kit/ui'
import { cardFocus } from '@racer/domain'
import { effectLines, uniqueEffectLines, type EffectLine, type Place } from '@racer/domain/hub'
import { m } from 'motion/react'
import { useMemo, useState, type ReactNode } from 'react'
import { useLoadedContent } from '../../app/content'
import { useGame, useRun } from '../../app/game'
import { CardSquare } from '../../ui/ArtSquare'
import { SkillNames } from '../../ui/BuildFacts'
import { DistanceTypeIcon, RunningStyleIcon } from '../../ui/CardFocusIcons'
import { DISTANCE_LABEL, STYLE_LABEL } from '../../ui/labels'
import { Meter } from '../../ui/Meter'
import { TypeIcon, typeLabel } from '../../ui/TypeIcon'
import { useArt } from '../../ui/useContentArt'
import { titledCardName } from '../../ui/words'
import { PlacePageHeader } from '../PlacePageHeader'
import { eraReading, libraryWords, powerReading, powerText } from './model'

function Lines({ lines, label }: { lines: readonly EffectLine[]; label: string }) {
  return (
    <ul aria-label={label} className="divide-y divide-hairline" data-racer="effects">
      {lines.map((line) => (
        <li key={line.id} className="flex min-h-10 items-center justify-between gap-3 text-[14px]" data-effect={line.id}>
          <span>{line.name}</span>
          <span className="numeral font-display font-bold">{line.value}</span>
        </li>
      ))}
    </ul>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5" aria-label={title}>
      <h3 className="font-display text-[15px] font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function Art({ cardId, name, owned, revealed }: { cardId: string; name: string; owned: boolean; revealed: boolean }) {
  const content = useLoadedContent()
  const art = useArt(content, 'card', cardId)
  const body = art !== null
    ? <img src={art} alt={name} draggable={false} className={`size-full select-none object-cover object-top ${owned ? '' : 'opacity-45 saturate-50'}`} />
    : <CardSquare cardId={cardId} name={name} dimmed={!owned} className="size-full" />
  return (
    <m.div
      key={revealed ? 'revealed' : 'still'}
      className="aspect-square w-32 shrink-0 overflow-hidden rounded-md bg-sunken shadow-1"
      initial={revealed ? { scale: 0.85, opacity: 0.4 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 20 }}
      data-racer="card-art"
    >
      {body}
    </m.div>
  )
}

export function CardPage({ place, rest, cardId }: { place: Place; rest: string; cardId: string }) {
  const run = useRun()
  const content = useGame((snapshot) => snapshot.env?.content ?? null)
  const owned = useGame((snapshot) => snapshot.state?.cards[cardId] !== undefined)
  const tickets = useGame((snapshot) => snapshot.state?.account.cardTickets ?? 0)
  const [busy, setBusy] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const card = content?.cards.get(cardId)
  const power = useMemo(() => (card === undefined || content === null ? null : powerReading(card, content.cards)), [card, content])

  if (card === undefined || content === null) {
    return (
      <div data-place-page="card-library" data-racer="card-page">
        <PlacePageHeader place={place} rest={rest} />
        <p className="px-4 py-6 text-[14px] text-ink-soft">{libraryWords('unknown-card')}</p>
      </div>
    )
  }

  const name = titledCardName(card)
  const focus = cardFocus(card, content.skills)
  const era = eraReading(card.era)
  const effects = effectLines(card.effects)
  const unique = card.uniqueEffect
  const uniqueLines = uniqueEffectLines(card)
  const mark = <UiMark mark="currency/card-ticket" />

  const unlock = async () => {
    setBusy(true)
    setError(null)
    try {
      const answer = await run('unlock-card', { cardId }, `unlock-card:${cardId}`)
      if (answer.kind === 'done') setRevealed(true)
      else setError(answer.text)
    } catch {
      setError(libraryWords('failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-place-page="card-library" data-racer="card-page" data-card={cardId}>
      <PlacePageHeader place={place} rest={rest} title={card.charName} />
      <div className="space-y-4 px-4 pt-3 pb-24">
        <section className="flex gap-3">
          <Art cardId={cardId} name={name} owned={owned} revealed={revealed} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft">
              <TypeIcon type={card.type} size={20} />{typeLabel(card.type)}
            </p>
            <h2 className="text-lg leading-tight">{card.charName}</h2>
            {card.title.trim() !== '' && <p className="text-[13px] text-ink-soft">{card.title}</p>}
            <p className="flex items-center gap-1 text-[12px] text-ink-soft" data-racer="card-era">
              <EraIcon size={16} />{libraryWords('era', { scenario: era.scenario })}
            </p>
            {(focus.style !== 'generalist' || focus.distance !== 'generalist') && (
              <p className="flex items-center gap-1.5" data-racer="card-focus">
                {focus.style !== 'generalist' && <RunningStyleIcon style={focus.style} size={22} title={`${libraryWords('style-focus')}: ${STYLE_LABEL[focus.style]}`} />}
                {focus.distance !== 'generalist' && <DistanceTypeIcon distance={focus.distance} size={22} title={`${libraryWords('distance-focus')}: ${DISTANCE_LABEL[focus.distance]}`} />}
              </p>
            )}
          </div>
        </section>

        {owned ? (
          revealed && <p role="status" className="text-[14px] font-semibold text-success">{libraryWords('unlocked')}</p>
        ) : (
          <Panel className="space-y-2 p-3" data-racer="card-unlock">
            <p className="flex items-center gap-1.5 text-[15px]" aria-label={libraryWords('tickets-move', { n: tickets, next: Math.max(0, tickets - 1) })}>
              {mark}
              <span aria-hidden className="font-display font-bold tabular-nums">{tickets} → {Math.max(0, tickets - 1)}</span>
              <span className="text-[13px] text-ink-soft">{tickets < 1 ? libraryWords('no-tickets') : libraryWords('final')}</span>
            </p>
            <Button className="w-full" disabled={busy || tickets < 1} onClick={() => void unlock()}>
              <span className="flex items-center justify-center gap-1.5">{mark}{libraryWords('unlock')}</span>
            </Button>
            {error !== null && <p role="alert" className="text-[13px] text-danger">{error}</p>}
          </Panel>
        )}

        <p className="text-[13px] text-ink-soft">{era.open ? libraryWords('era-open') : libraryWords('era-later')}</p>

        {power !== null && (
          <Section title={libraryWords('power')}>
            <div className="space-y-1" data-racer="card-power">
              <Meter value={power.max > 0 ? power.power / power.max : 0} marker={power.max > 0 ? power.median / power.max : undefined} color="var(--color-accent)" height={8} />
              <p className="text-[13px]">
                {libraryWords('power-line', { power: powerText(power.power), type: typeLabel(card.type), median: powerText(power.median) })}
              </p>
              <p className="text-[12px] text-ink-soft">{libraryWords('power-note')}</p>
            </div>
          </Section>
        )}

        <Section title={libraryWords('effects')}>
          {effects.length === 0 ? <p className="text-[13px] text-ink-soft">{libraryWords('no-effects')}</p> : <Lines lines={effects} label={libraryWords('effects')} />}
        </Section>

        {unique !== null && (
          <Section title={libraryWords('unique')}>
            {unique.description !== null && unique.description.trim() !== ''
              ? <p className="text-[14px] leading-relaxed" data-racer="unique-description">{unique.description}</p>
              : uniqueLines.length > 0 && <Lines lines={uniqueLines} label={libraryWords('unique')} />}
          </Section>
        )}

        <Section title={libraryWords('hint-skills')}>
          <SkillNames ids={card.hintSkillIds} skills={content.skills} empty={libraryWords('no-skills')} />
        </Section>
        <Section title={libraryWords('event-skills')}>
          <SkillNames ids={card.eventSkillIds} skills={content.skills} empty={libraryWords('no-skills')} />
        </Section>
      </div>
    </div>
  )
}
