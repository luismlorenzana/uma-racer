import { CARD_EFFECTS, MAX_LIMIT_BREAK, cardExpToNext, scenarioForTier, type CardEffect, type SupportCardType } from '@racer/domain'
import { m, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { useContent } from '../content/ContentProvider'
import { promoteSupportCard } from '../game/actions'
import { buildCardAlbum, type CardAlbumFilters, type CardAlbumItem, type CardTypeFilter } from '../game/cards-view'
import { useGame } from '../game/store'
import { AtlasSprite } from '../ui/AtlasSprite'
import { BottomSheet } from '../ui/BottomSheet'
import { GameButton } from '../ui/GameButton'
import { Meter } from '../ui/Meter'
import { Panel } from '../ui/Panel'
import { ScreenState } from '../ui/ScreenState'

const TYPE_LABEL: Record<SupportCardType, string> = {
  speed: 'Speed', stamina: 'Stamina', power: 'Power', guts: 'Guts', wit: 'Wit', friend: 'Friend', group: 'Group',
}
const EFFECT_LABEL: Record<CardEffect, string> = {
  trainingBonus: 'Training Bonus', friendshipBonus: 'Friendship Bonus', statBonus: 'Stat Bonus',
  skillPointBonus: 'Skill Point Bonus', specialtyPriority: 'Specialty Priority', hintFrequency: 'Hint Frequency',
  raceBonus: 'Race Bonus', initialStats: 'Initial Stats',
}
const PERCENT_EFFECTS = new Set<CardEffect>(['trainingBonus', 'friendshipBonus', 'hintFrequency', 'raceBonus'])
const FILTER_TYPES: CardTypeFilter[] = ['all', 'speed', 'stamina', 'power', 'guts', 'wit', 'friend', 'group']

const effectValue = (effect: CardEffect, value: number) =>
  PERCENT_EFFECTS.has(effect) ? `${Math.round(value * 1000) / 10}%` : `+${Math.round(value * 10) / 10}`

function LimitPips({ value }: { value: number }) {
  return <span aria-label={`Limit break ${value}`} className="flex gap-0.5">{Array.from({ length: MAX_LIMIT_BREAK }, (_, index) => <span key={index} className={`h-2 w-3 rounded-sm ${index < value ? 'bg-gold' : 'bg-slate-200'}`} />)}</span>
}

function CardTile({ item, onClick }: { item: CardAlbumItem; onClick: () => void }) {
  const era = scenarioForTier(item.template.era)?.name ?? `Era ${item.template.era}`
  return (
    <button type="button" onClick={onClick} className={`min-h-44 rounded-2xl border-2 p-2 text-left shadow-sm ${item.maxed ? 'border-gold bg-gradient-to-b from-amber-50 to-white' : 'border-white bg-white/90'}`}>
      <AtlasSprite
        asset={item.asset}
        alt={`${item.template.charName} support card`}
        className={`mx-auto w-full rounded-xl bg-slate-100 ${item.owned ? '' : 'opacity-45 brightness-0'}`}
        fallback={<div className="flex h-full items-center justify-center text-3xl">🃏</div>}
      />
      <p className="mt-2 truncate text-xs font-extrabold">{item.owned ? item.template.charName : 'Unowned SSR'}</p>
      <p className="truncate text-[10px] font-bold text-ink-soft">{TYPE_LABEL[item.template.type]} · {era}</p>
      {item.save ? (
        <div className="mt-1 flex items-center justify-between gap-1 text-[10px] font-extrabold"><span>Lv {item.save.level}</span><LimitPips value={item.save.limitBreak} /></div>
      ) : <p className="mt-1 text-[10px] font-extrabold text-ink-soft">Silhouette</p>}
    </button>
  )
}

function CardDetail({ item, busy, error, celebration, onPromote }: {
  item: CardAlbumItem
  busy: boolean
  error: string | null
  celebration: number
  onPromote: () => void
}) {
  const reducedMotion = useReducedMotion()
  const save = item.save
  const next = new Map(item.nextEffects?.map((row) => [row.effect, row.value]) ?? [])
  const usable = item.template.type !== 'friend' && item.template.type !== 'group'
  return (
    <div className="max-h-[76vh] overflow-y-auto pb-2">
      <div className="flex gap-3">
        <m.div key={celebration} initial={reducedMotion || celebration === 0 ? false : { scale: 1.15, opacity: 0.65 }} animate={{ scale: 1, opacity: 1 }} className="w-24 shrink-0">
          <AtlasSprite asset={item.asset} alt={`${item.template.charName} support card`} className={`rounded-2xl bg-slate-100 ${item.owned ? '' : 'opacity-45 brightness-0'}`} fallback={<div className="flex h-full items-center justify-center text-4xl">🃏</div>} />
        </m.div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold text-sky-deep">{TYPE_LABEL[item.template.type]} · {scenarioForTier(item.template.era)?.name ?? `Era ${item.template.era}`}</p>
          <h2 className="mt-1 text-lg leading-tight font-extrabold">{item.template.charName}</h2>
          <p className="text-sm font-bold text-ink-soft">{item.template.title || 'Support card'}</p>
          {save && <div className="mt-2 flex items-center gap-2"><span className="font-extrabold">Lv {save.level}</span><LimitPips value={save.limitBreak} /></div>}
        </div>
      </div>

      {!usable && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold">Friend/Group gameplay arrives after the MVP. This card can be collected but not equipped yet.</div>}
      {!item.owned && <div className="mt-3 rounded-xl bg-slate-100 p-3 text-sm font-bold">Unowned. Card Select redemption arrives in T011.</div>}

      {save && (
        <>
          <div className="mt-4">
            <div className="flex justify-between text-xs font-extrabold"><span>Card EXP</span><span>{item.maxed ? 'MAX' : `${save.exp}/${item.expToNext}`}</span></div>
            <Meter value={item.maxed ? 1 : save.exp / item.expToNext} color="linear-gradient(90deg,#8b5cf6,#d8b4fe)" height={9} />
          </div>
          <div className="mt-4 grid gap-2">
            <h3 className="font-extrabold">Generated effects</h3>
            {item.currentEffects.filter((row) => item.template.effectProfile[row.effect] > 0).map((row) => {
              const nextValue = next.get(row.effect)
              return (
                <div key={row.effect} className="flex min-h-11 items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm">
                  <span className="font-bold">{EFFECT_LABEL[row.effect]}{row.signatureBonus > 0 ? ' ★' : ''}</span>
                  <span className="text-right font-extrabold text-sky-deep">
                    {row.value === 0 ? `LB${row.unlockLimitBreak}` : effectValue(row.effect, row.value)}
                    {nextValue !== undefined && nextValue > row.value && <span className="ml-1 text-xs text-turf-deep">→ {effectValue(row.effect, nextValue)}</span>}
                  </span>
                </div>
              )
            })}
            {CARD_EFFECTS.every((effect) => item.template.effectProfile[effect] === 0) && <p className="text-sm text-ink-soft">No generated MVP effects in this profile.</p>}
          </div>
          <p className="mt-3 text-xs font-bold text-ink-soft">Hints: {item.template.hintSkillIds.length} · Gold hints unlock at LB3 · Original numeric effects are not copied.</p>
          {error && <div role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-danger">{error}</div>}
          <div className="mt-4 grid gap-2">
            <GameButton disabled={busy || item.promotionLock !== null} onClick={onPromote}>
              {busy ? 'Limit breaking…' : item.promotionCost ? `Limit Break · ${item.promotionCost} 🎫` : 'Maximum limit break'}
            </GameButton>
            {item.promotionLock && <p className="text-center text-xs font-bold text-ink-soft">{item.promotionLock}</p>}
            {save.maxCouponGranted && <p className="text-center text-xs font-extrabold text-violet-700">Card Select Coupon earned</p>}
          </div>
        </>
      )}
    </div>
  )
}

export function CardsScreen() {
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const lifecycleError = useGame((state) => state.error)
  const persistent = useGame((state) => state.persistent)
  const profile = useGame((state) => state.profile)
  const cards = useGame((state) => state.cards)
  const pushToast = useGame((state) => state.pushToast)
  const [filters, setFilters] = useState<CardAlbumFilters>({ ownership: 'all', type: 'all' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [celebration, setCelebration] = useState(0)

  const album = useMemo(() => contentState.status === 'ready' && profile
    ? buildCardAlbum(contentState.content, cards, profile.tickets, filters)
    : null, [cards, contentState, filters, profile])
  const selected = useMemo(() => contentState.status === 'ready' && profile && selectedId
    ? buildCardAlbum(contentState.content, cards, profile.tickets).items.find((item) => item.template.id === selectedId) ?? null
    : null, [cards, contentState, profile, selectedId])

  if (contentState.status === 'signed-out' || status === 'signed-out') return <ScreenState title="Sign in to view Cards" detail="Your private card collection is part of the saved Stable." action={{ label: 'Open Settings', to: '/settings' }} />
  if (contentState.status === 'empty') return <ScreenState title="Content is not imported" detail="Publish private content before opening the card album." />
  if (contentState.status === 'error') return <ScreenState title="Content unavailable" detail={contentState.error.message} />
  if (status === 'error') return <ScreenState title="Save needs attention" detail={lifecycleError ?? 'The local save could not be opened.'} />
  if (contentState.status !== 'ready' || status !== 'ready' || !profile || !album) return <ScreenState title="Opening Cards…" detail="Loading your private SSR album." />
  if (album.total === 0) return <ScreenState title="No support cards imported" detail="Run and publish the private content pipeline first." />

  const groups = album.items.reduce<Map<number, CardAlbumItem[]>>((result, item) => {
    const group = result.get(item.template.era)
    if (group) group.push(item)
    else result.set(item.template.era, [item])
    return result
  }, new Map())
  const promote = () => {
    if (!selected || !selected.save || busy) return
    setBusy(true)
    setError(null)
    void promoteSupportCard(selected.template.id)
      .then((mutation) => {
        setCelebration((value) => value + 1)
        pushToast(`LB${mutation.result.toLimitBreak} · Card Lv ${mutation.result.levelGained}`)
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not limit break this card'))
      .finally(() => setBusy(false))
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <Panel className="bg-gradient-to-br from-violet-50 to-white">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-xs font-extrabold tracking-wide text-violet-700 uppercase">SSR collection</p><h1 className="text-2xl font-extrabold">Support Cards</h1></div>
          <div className="text-right text-sm font-extrabold"><p>{album.owned} / {album.total} owned</p><p className="text-gold-deep">{album.maxed} maxed</p></div>
        </div>
        <p className="mt-2 text-sm font-bold text-ink-soft">{profile.cardCoupons} Card Select Coupon{profile.cardCoupons === 1 ? '' : 's'} · redemption arrives in T011</p>
        {!persistent && <p className="mt-2 rounded-xl bg-amber-50 p-2 text-xs font-extrabold">Memory only — progression works for this session but cannot persist or sync.</p>}
        {album.orphanedIds.length > 0 && <p className="mt-2 rounded-xl bg-red-50 p-2 text-xs font-bold text-danger">{album.orphanedIds.length} owned card reference{album.orphanedIds.length === 1 ? '' : 's'} need restored content.</p>}
      </Panel>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['all', 'owned', 'unowned'] as const).map((ownership) => <button key={ownership} type="button" onClick={() => setFilters((value) => ({ ...value, ownership }))} className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-extrabold ${filters.ownership === ownership ? 'bg-violet-600 text-white' : 'bg-white'}`}>{ownership[0]!.toUpperCase() + ownership.slice(1)}</button>)}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTER_TYPES.map((type) => <button key={type} type="button" onClick={() => setFilters((value) => ({ ...value, type }))} className={`min-h-11 shrink-0 rounded-full px-3 text-xs font-extrabold ${filters.type === type ? 'bg-sky-deep text-white' : 'bg-white'}`}>{type === 'all' ? 'All types' : TYPE_LABEL[type]}</button>)}
      </div>

      {album.items.length === 0 && <Panel className="text-center text-sm font-bold text-ink-soft">No cards match these filters.</Panel>}
      {[...groups.entries()].map(([era, items]) => (
        <section key={era}>
          <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-extrabold">Tier {era} · {scenarioForTier(era)?.name ?? 'Future scenario'}</h2><span className="text-xs font-bold text-ink-soft">{items.filter((item) => item.owned).length}/{items.length}</span></div>
          {[...items.reduce<Map<SupportCardType, CardAlbumItem[]>>((result, item) => {
            const group = result.get(item.template.type)
            if (group) group.push(item)
            else result.set(item.template.type, [item])
            return result
          }, new Map()).entries()].map(([type, typeItems]) => (
            <div key={type} className="mb-4 [content-visibility:auto]">
              <h3 className="mb-2 text-xs font-extrabold tracking-wide text-ink-soft uppercase">{TYPE_LABEL[type]} · {typeItems.filter((item) => item.owned).length}/{typeItems.length}</h3>
              <div className="grid grid-cols-2 gap-3">{typeItems.map((item) => <CardTile key={item.template.id} item={item} onClick={() => { setSelectedId(item.template.id); setError(null) }} />)}</div>
            </div>
          ))}
        </section>
      ))}

      <BottomSheet open={selected !== null} onClose={() => { if (!busy) { setSelectedId(null); setError(null) } }}>
        {selected && <CardDetail item={selected} busy={busy} error={error} celebration={celebration} onPromote={promote} />}
      </BottomSheet>
    </div>
  )
}
