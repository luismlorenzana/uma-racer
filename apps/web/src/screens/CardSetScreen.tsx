import {
  BOND_RECALL_TICKET_COST,
  CARD_SET_SIZE,
  MAX_LIMIT_BREAK,
  autoCardSet,
  cardLimitBreak,
  cardNodeCount,
  cardNodeValue,
  cardSpPerNode,
  paysSkillPoints,
  type SupportDeckCard,
} from '@racer/domain'
import { useState } from 'react'
import { Link } from 'react-router'
import { setUmaDeck } from '../game/actions'
import { bondRecallHref } from '../game/bond-links'
import { buildDeckView, formatRaceBonus } from '../game/deck-view'
import { useGame } from '../game/store'
import { AtlasSprite } from '../ui/AtlasSprite'
import { BondPips } from '../ui/BondPips'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { Crest } from '../ui/Crest'
import { Numeral } from '../ui/Numeral'
import { CardPickerSheet } from '../ui/album/CardPickerSheet'
import { useTraining } from './TrainingScene'

const titleCase = (value: string) => value.slice(0, 1).toUpperCase() + value.slice(1)

/**
 * The active scenario's six cards, and the place to bond them (M016). Edits save as they are made, like the
 * constellation beside it: there is no draft to lose.
 */
export function CardSetScreen() {
  const { content, save, uma, cards, umas, tickets } = useTraining()
  const pushToast = useGame((state) => state.pushToast)
  const [busy, setBusy] = useState(false)
  const [actionsFor, setActionsFor] = useState<number | null>(null)
  const [pickFor, setPickFor] = useState<number | null>(null)

  const { run, derived } = uma
  const tier = run.tier
  const ids = run.cardSetIds
  const deck = buildDeckView(save, cards, content)
  const here = `/constellation/${encodeURIComponent(save.templateId)}/cards`
  const canBond = tickets >= BOND_RECALL_TICKET_COST
  const cardNodes = ids.reduce((total, id) => total + cardNodeCount(run, id), 0)
  const full = ids.length >= CARD_SET_SIZE

  const commit = async (next: string[], success: string | null) => {
    if (busy) return
    setBusy(true)
    try {
      await setUmaDeck(save.templateId, next)
      if (success) pushToast(success)
    } catch (reason) {
      pushToast(reason instanceof Error ? reason.message : 'Could not change the card set')
    } finally {
      setBusy(false)
    }
  }

  const place = (index: number, cardId: string) => {
    const next = index < ids.length ? ids.map((id, at) => (at === index ? cardId : id)) : [...ids, cardId]
    setPickFor(null)
    void commit(next, index < ids.length ? 'Card replaced · it took over the old card’s nodes' : null)
  }

  const fillEmpty = () => {
    const owned = Object.values(cards).flatMap((card): SupportDeckCard[] => {
      const template = content.cards.byId.get(card.templateId)
      return template ? [{ save: card, template }] : []
    })
    const characters = new Set(ids.map((id) => content.cards.byId.get(id)?.charaId))
    const next = [...ids]
    for (const id of autoCardSet(uma.template, tier, owned)) {
      if (next.length >= CARD_SET_SIZE) break
      const template = content.cards.byId.get(id)
      if (!template || next.includes(id) || characters.has(template.charaId)) continue
      next.push(id)
      characters.add(template.charaId)
    }
    if (next.length === ids.length) {
      pushToast('No other owned card is eligible for this scenario')
      return
    }
    void commit(next, `${next.length - ids.length} card${next.length - ids.length === 1 ? '' : 's'} added`)
  }

  const acting = actionsFor !== null ? ids[actionsFor] ?? null : null
  const actingTemplate = acting ? content.cards.byId.get(acting) : undefined

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-safe">
      <section className="rounded-lg bg-panel p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[13px] font-semibold">{uma.scenario?.name ?? `Tier ${tier}`} card set</h2>
          <span className="text-micro">{ids.length} / {CARD_SET_SIZE}</span>
        </div>
        <p className="mt-1 text-[12px] text-ink-soft">
          A card pays only on the constellation nodes it fills. Bond raises what each node pays — here, and for every
          Uma in this scenario.
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-md bg-sunken px-1 py-1.5">
            <Numeral className="block text-[15px] leading-none">{cardNodes}</Numeral>
            <span className="text-micro">card nodes</span>
          </div>
          <div className="rounded-md bg-sunken px-1 py-1.5">
            <Numeral className="block text-[15px] leading-none">{derived.skillPoints}</Numeral>
            <span className="text-micro">skill points</span>
          </div>
          <div className="rounded-md bg-sunken px-1 py-1.5">
            <span className="font-display block text-[15px] leading-none font-semibold">{formatRaceBonus(deck.raceBonus)}</span>
            <span className="text-micro">race bonus</span>
          </div>
        </div>
      </section>

      <p className="mt-3 mb-1.5 flex items-baseline justify-between px-1 text-[11px] text-ink-soft">
        <span>Bond Recall · {BOND_RECALL_TICKET_COST} tickets a run</span>
        <span>You have <Numeral className="text-ink">{tickets}</Numeral></span>
      </p>

      <div className="grid gap-1.5">
        {Array.from({ length: CARD_SET_SIZE }, (_, index) => {
          const cardId = ids[index]
          if (!cardId) {
            const next = index === ids.length
            return (
              <button
                key={`empty-${index}`}
                type="button"
                disabled={!next || busy}
                onClick={() => setPickFor(index)}
                className="flex min-h-16 items-center gap-3 rounded-lg border border-dashed border-hairline-strong px-3 text-left disabled:opacity-45"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-sunken text-lg text-ink-faint">+</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold">{next ? 'Add a card' : 'Empty'}</span>
                  <span className="text-micro block">Slot {index + 1}</span>
                </span>
              </button>
            )
          }

          const template = content.cards.byId.get(cardId)
          const owned = cards[cardId]
          if (!template || !owned) {
            return (
              <button key={cardId} type="button" onClick={() => setActionsFor(index)} className="min-h-16 rounded-lg bg-danger/10 px-3 text-left text-[12px] font-semibold text-danger">
                Slot {index + 1} holds {cardId}, which is missing or not owned · tap to replace
              </button>
            )
          }
          const bond = cardLimitBreak(owned, tier)
          const nodes = cardNodeCount(run, cardId)
          const skillPoints = paysSkillPoints(template)
          const pays = skillPoints
            ? `${Math.round(cardSpPerNode(tier, { template, limitBreak: bond }))} SP per node`
            : `${Math.round(cardNodeValue(tier, { template, limitBreak: bond }))} per node`
          return (
            <div key={cardId} className={`flex items-stretch gap-1.5 rounded-lg border bg-panel p-1.5 ${skillPoints ? 'border-accent' : 'border-hairline'}`}>
              <button
                type="button"
                onClick={() => setActionsFor(index)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                aria-label={`${template.charName}, slot ${index + 1}`}
              >
                <AtlasSprite
                  asset={deck.slots[index]?.card?.asset ?? null}
                  decorative
                  className="h-14 w-14 shrink-0 rounded-md bg-sunken"
                  fallback={<div className="flex h-full items-center justify-center text-ink-faint">?</div>}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-semibold">{template.charName}</span>
                    {skillPoints && <Crest tone="accent">Skill points</Crest>}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="text-micro">{titleCase(template.type)}</span>
                    <BondPips value={bond} />
                  </span>
                  <span className={`block text-[11px] ${nodes === 0 ? 'text-warning' : 'text-ink-soft'}`}>
                    {pays} · {nodes === 0 ? 'on no nodes yet' : `on ${nodes} node${nodes === 1 ? '' : 's'}`}
                  </span>
                </span>
              </button>
              {bond >= MAX_LIMIT_BREAK ? (
                <span className="flex w-16 shrink-0 items-center justify-center rounded-md bg-sunken text-[11px] font-semibold text-ink-faint">Max</span>
              ) : canBond ? (
                <Link
                  to={bondRecallHref({ cardId, tier, umaId: save.templateId, returnTo: here })}
                  className="font-display flex w-16 shrink-0 flex-col items-center justify-center rounded-md border border-accent bg-accent-wash text-[13px] font-semibold text-ink"
                >
                  Bond
                  <span className="text-[10px] font-normal">{bond} → {bond + 1}</span>
                </Link>
              ) : (
                <span className="flex w-16 shrink-0 flex-col items-center justify-center rounded-md bg-sunken text-[11px] font-semibold text-ink-faint">
                  Bond
                  <span className="text-[10px] font-normal">need {BOND_RECALL_TICKET_COST}</span>
                </span>
              )}
            </div>
          )
        })}
      </div>

      {deck.validationErrors.length > 0 && (
        <p className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">{deck.validationErrors[0]}</p>
      )}

      {!full && (
        <Button variant="secondary" className="mt-3 w-full" disabled={busy} onClick={fillEmpty}>
          Fill empty slots
        </Button>
      )}
      <p className="mt-2 mb-4 px-1 text-[11px] text-ink-faint">
        Friend and Group cards pay skill points instead of stats, in any slot. A set without one earns no skill points.
      </p>

      <BottomSheet open={acting !== null} onClose={() => setActionsFor(null)}>
        {acting !== null && actionsFor !== null && (
          <div className="grid gap-1.5 px-4 pb-6">
            <h3 className="font-display mb-1 text-lg font-bold">{actingTemplate?.charName ?? acting}</h3>
            <Link
              to={`/cards/${encodeURIComponent(acting)}?tier=${tier}`}
              className="font-display flex min-h-12 items-center justify-center rounded-sm border border-hairline-strong bg-panel text-[15px] font-semibold"
            >
              Open card
            </Link>
            <Button variant="secondary" disabled={busy} onClick={() => { const index = actionsFor; setActionsFor(null); setPickFor(index) }}>
              Replace · keeps its nodes
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => { const index = actionsFor; setActionsFor(null); void commit(ids.filter((_, at) => at !== index), 'Card removed · its nodes are empty') }}
            >
              Remove
            </Button>
          </div>
        )}
      </BottomSheet>

      <CardPickerSheet
        open={pickFor !== null}
        onClose={() => setPickFor(null)}
        content={content}
        cards={cards}
        umas={umas}
        tier={tier}
        excludeIds={ids}
        onPick={(entry) => { if (pickFor !== null) place(pickFor, entry.id) }}
      />
    </div>
  )
}
