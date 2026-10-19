// A card's page (docs/game/06-cards-and-bonds.md §6, §10; T138): the illustration at 4:5 (the art viewer on tap); type,
// era, style and distance; what it pays in the lens (`cardPay`: the split, SP per node for Friend and Group, the eraPct
// it keeps later in the tier, the full Race Bonus); its skills by node, golds first; the bond's real time per tier, with
// no item (D375); who is bonded and where, then who could bond it now; and Bond in the thumb zone, which opens the Uma picker and
// goes on to T139's Dojo session with her, this card and its room. A bond in progress reads "In session · bonds in 2h 10m".
import { Button, Panel } from '@luismlorenzana/uma-kit/ui'
import { scenarioRow } from '@racer/domain/tiers'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ArtViewer } from '../../ui/ArtViewer'
import { useArt } from '../../ui/useContentArt'
import { DistanceTypeIcon, RunningStyleIcon } from '../../ui/CardFocusIcons'
import { TypeIcon } from '../../ui/TypeIcon'
import { useG2Content } from '../../app/content'
import { useGame, useNow } from '../../app/game'
import { useAlbumPrefs } from '@luismlorenzana/uma-kit/album'
import { CardSquare } from '../../ui/ArtSquare'
import { DISTANCE_LABEL, STAT_LABEL, STYLE_LABEL } from '../../ui/labels'
import { PlacePageHeader } from '../PlacePageHeader'
import { RacerUmaPicker as UmaPicker } from '../../ui/racerAlbum'
import { umaName } from '../../ui/words'
import type { PageProps } from '../registry'
import {
  bondChoice, bondCosts, bondedTo, bondSessionPath, cardName, cardSkills, eraLabel, LENS_MODES, lensOf, LIBRARY_ALBUM,
  LIBRARY_DEFAULT_QUERY, LIBRARY_FACETS, LIBRARY_SORTS, payWords, pendingBond, PLAYABLE, raceBonusWords, TYPE_LABEL,
} from './model'
import { cardFocus, cardPay } from '@racer/domain/training'

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel className="p-3" aria-label={title}>
      <h2 className="text-micro mb-2">{title}</h2>
      {children}
    </Panel>
  )
}

export default function CardPage({ place, rest, cardId }: PageProps & { cardId: string }) {
  const location = useLocation()
  const navigate = useNavigate()
  const now = useNow()
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const g2Content = useG2Content()
  const art = useArt(g2Content, 'card', cardId)
  const prefs = useAlbumPrefs(LIBRARY_ALBUM, { fallback: LIBRARY_DEFAULT_QUERY, facets: LIBRARY_FACETS, sorts: LIBRARY_SORTS, modes: LENS_MODES })
  const [viewing, setViewing] = useState(false)
  const [bonding, setBonding] = useState(false)
  const card = env?.content.cards.get(cardId) ?? null
  const lens = lensOf(prefs.query.mode)
  // In All, a card pays as it does in its own scenario (or the last playable one).
  const T = lens === 'all' ? Math.min(card?.era ?? 1, PLAYABLE.at(-1)!) : lens
  const pay = useMemo(() => (card === null ? null : cardPay(card, T)), [card, T])
  const choices = useMemo(() => (state === null || env === null || card === null ? new Map() : new Map(Object.values(state.umas).map((uma) => [uma.outfitId, bondChoice(state, uma, card, now, env)]))), [state, env, card, now])

  // Opening its page is what clears a card's NEW mark (ux "Shared behaviours"), as her profile does an Uma's. A device
  // that has never opened the Library first takes every card as seen, as the Library would, so only cards a content
  // update adds read NEW there.
  useEffect(() => {
    if (card === null || env === null) return
    prefs.see(prefs.fresh ? [...env.content.cards.keys()] : [cardId])
    // Once per card.
  }, [cardId, card !== null])

  if (state === null || env === null) return <PlacePageHeader place={place} rest={rest} />
  if (card === null || pay === null) {
    return (
      <div>
        <PlacePageHeader place={place} rest={rest} title="Card" />
        <Panel className="m-4 text-center">
          <p>That card isn't in the Library.</p>
          <Link to="/town/card-library" replace className="font-display mt-3 inline-flex min-h-12 items-center rounded-sm bg-accent px-5 font-semibold text-accent-ink shadow-1">Open the Library</Link>
        </Panel>
      </div>
    )
  }
  const content = env.content
  const name = cardName(card)
  const focus = cardFocus(card, content.skills)
  const skills = cardSkills(card, content)
  const costs = bondCosts(card)
  const who = bondedTo(state, card)
  const pending = pendingBond(state, card, now)
  const back = `${location.pathname}${location.search}`
  const chip = 'inline-flex min-h-8 items-center gap-1 rounded-full border border-hairline bg-sunken px-2.5 text-[12px] font-semibold'

  return (
    <div data-place-page="card" data-card={cardId}>
      <PlacePageHeader place={place} rest={rest} title={name} />
      <div className="space-y-3 px-4 pt-3 pb-4">
        <button type="button" onClick={() => art !== null && setViewing(true)} aria-label={art !== null ? `View ${name}'s art` : name}
          className="relative block aspect-[4/5] w-full overflow-hidden rounded-md border border-hairline bg-sunken shadow-1" data-g2="card-art">
          {art !== null
            ? <img src={art} alt="" className="absolute inset-0 size-full object-cover object-top" draggable={false} />
            : <span className="absolute inset-0 flex items-center justify-center p-10"><span className="w-full"><CardSquare cardId={cardId} name={name} /></span></span>}
          <span className="art-scrim absolute inset-x-0 bottom-0 h-1/3" aria-hidden />
          <span className="absolute bottom-2 left-3 text-left text-ink-on-dark">
            <span className="font-display block text-lg leading-tight font-bold">{card.charName}</span>
            <span className="block text-[13px]">{card.title}</span>
          </span>
          <span className="absolute top-2 right-2"><TypeIcon type={card.type} size={32} title={TYPE_LABEL[card.type]} /></span>
        </button>
        <div className="flex flex-wrap gap-1.5" data-g2="card-chips">
          <span className={chip}><TypeIcon type={card.type} size={16} />{TYPE_LABEL[card.type]}</span>
          <span className={chip}>{eraLabel(card.era)}</span>
          <span className={chip}>{focus.style !== 'generalist' && <RunningStyleIcon style={focus.style} size={16} />}{focus.style === 'generalist' ? 'Generalist style' : STYLE_LABEL[focus.style]}</span>
          <span className={chip}>{focus.distance !== 'generalist' && <DistanceTypeIcon distance={focus.distance} size={16} />}{focus.distance === 'generalist' ? 'Generalist distance' : DISTANCE_LABEL[focus.distance]}</span>
        </div>
        {pending.length > 0 && (
          <ul className="space-y-1" data-g2="pending-bond">
            {pending.map((line) => <li key={line.umaId} className="rounded-sm bg-accent-wash px-3 py-2 text-[13px] font-semibold">{umaName(content, line.umaId)} · {line.words}</li>)}
          </ul>
        )}
        <Block title={`What it pays · scenario ${T} · ${scenarioRow(T).name}`}>
          {!pay.eligible ? <p className="text-[14px]">{eraLabel(card.era)}: not in a set before scenario {card.era}.</p> : (
            <div className="space-y-1.5 text-[14px]" data-g2="card-pay">
              {pay.split.length > 0 && (
                <p className="flex flex-wrap items-center gap-2">
                  {pay.split.map(([stat, share]) => <span key={stat} className="flex items-center gap-1"><TypeIcon type={stat} size={16} />{STAT_LABEL[stat]} {share}%</span>)}
                </p>
              )}
              <p className="font-semibold">{payWords(pay)} · {pay.eraPct}% for its era</p>
              {pay.later.length > 0 && <p className="text-[13px] text-ink-soft">Later this tier: {pay.later.map((later) => `${later.eraPct}% in ${later.T}`).join(' · ')}</p>}
              <p className="text-[13px] text-ink-soft">Up to {pay.nodeCap} nodes of one tree. Before her preset's scenario buff.</p>
            </div>
          )}
          <p className="mt-1.5 text-[14px]">Race Bonus {raceBonusWords(pay.raceBonus)}</p>
        </Block>
        {skills.length > 0 && (
          <Block title="Skills">
            <ul className="space-y-1 text-[14px]" data-g2="card-skills">
              {skills.map((skill) => (
                <li key={`${skill.skillId}:${skill.node}`} className="flex justify-between gap-2">
                  <span className={skill.gold ? 'font-semibold text-accent-strong' : ''}>{skill.name}</span>
                  <span className="shrink-0 text-ink-soft">node {skill.node}</span>
                </li>
              ))}
            </ul>
          </Block>
        )}
        <Block title="Bond cost">
          <ul className="space-y-1 text-[14px]" data-g2="bond-costs">
            {costs.map((cost) => (
              <li key={cost.tiers} className="flex justify-between gap-2">
                <span className="text-ink-soft">{cost.tiers}</span>
                <span>{cost.time === null ? 'Not in this tier' : `No item · ${cost.time}`}</span>
              </li>
            ))}
          </ul>
        </Block>
        <Block title="Bonded to">
          {who.bonded.length === 0 ? <p className="text-[13px] text-ink-soft">No Uma yet.</p> : (
            <ul className="space-y-1.5 text-[14px]" data-g2="bonded-to">
              {who.bonded.map((row) => (
                <li key={row.umaId}>
                  <Link to={`/town/stable/outfit/${encodeURIComponent(row.umaId)}`} state={{ back: true }} className="flex min-h-11 flex-col justify-center rounded-sm bg-sunken/60 px-3">
                    <span className="font-semibold">{umaName(content, row.umaId)} <span className="font-normal text-ink-soft">{row.at}</span></span>
                    {row.presets.length > 0 && <span className="text-[12px] text-ink-soft">{row.presets.join(' · ')}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {who.could.length > 0 && <p className="mt-2 text-[13px] text-ink-soft">Could bond it now: {who.could.map((id) => umaName(content, id)).join(', ')}</p>}
        </Block>
      </div>
      <div className="sticky bottom-0 z-10 border-t border-hairline bg-panel/95 px-4 py-2 backdrop-blur">
        <Button className="w-full" size="lg" onClick={() => setBonding(true)} disabled={Object.keys(state.umas).length === 0}>Bond</Button>
        {Object.keys(state.umas).length === 0 && <p className="mt-1 text-center text-[12px] text-ink-soft">Unlock an Uma in the Stable first.</p>}
      </div>
      <ArtViewer src={viewing ? art : null} title={name} subtitle={eraLabel(card.era)} onClose={() => setViewing(false)} />
      <UmaPicker
        open={bonding}
        onClose={() => setBonding(false)}
        title={`Bond ${card.charName}`}
        work
        disabledReason={(entry) => choices.get(entry.id)?.reason ?? null}
        describe={(entry) => choices.get(entry.id)?.line ?? null}
        action={(entry) => {
          const choice = choices.get(entry.id)
          if (choice === undefined) return null
          if (choice.canQueue) {
            return (
              <button type="button" onClick={() => navigate(bondSessionPath(entry.id, card, back, true), { state: { back: true } })}
                className="font-display mt-1 min-h-11 w-full rounded-sm bg-accent px-3 text-[13px] font-semibold text-accent-ink shadow-1">
                Queue
              </button>
            )
          }
          return null
        }}
        onPick={(umaId) => navigate(bondSessionPath(umaId, card, back), { state: { back: true } })}
      />
    </div>
  )
}
