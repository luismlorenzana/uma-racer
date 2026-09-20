import { scenarioForTier, type SupportCardType } from '@racer/domain'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { redeemCardCoupon } from '../game/actions'
import { buildCardSelection, type CardSelectionItem } from '../game/collection-view'
import { useGame } from '../game/store'
import { AtlasSprite } from '../ui/AtlasSprite'
import { BottomSheet } from '../ui/BottomSheet'
import { GameButton } from '../ui/GameButton'
import { Panel } from '../ui/Panel'
import { ScreenState } from '../ui/ScreenState'

const TYPES: Array<'all' | SupportCardType> = ['all', 'speed', 'stamina', 'power', 'guts', 'wit', 'friend', 'group']
const label = (value: string) => value === 'all' ? 'All types' : `${value[0]!.toUpperCase()}${value.slice(1)}`

function SelectionTile({ item, onClick }: { item: CardSelectionItem; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-h-44 rounded-2xl border-2 border-white bg-white/95 p-2 text-left shadow-sm">
      <AtlasSprite asset={item.asset} alt={`${item.template.charName} support card`} className="mx-auto w-full rounded-xl bg-slate-100" fallback={<div className="flex h-full items-center justify-center text-3xl">🃏</div>} />
      <p className="mt-2 line-clamp-2 text-xs font-extrabold">{item.template.charName}</p>
      <p className="truncate text-[10px] font-bold text-ink-soft">{label(item.template.type)} · Tier {item.template.era}</p>
    </button>
  )
}

export function CardRedeemScreen() {
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const lifecycleError = useGame((state) => state.error)
  const profile = useGame((state) => state.profile)
  const cards = useGame((state) => state.cards)
  const persistent = useGame((state) => state.persistent)
  const sync = useGame((state) => state.sync)
  const pushToast = useGame((state) => state.pushToast)
  const navigate = useNavigate()
  const [type, setType] = useState<'all' | SupportCardType>('all')
  const [era, setEra] = useState<number | null>(null)
  const [selected, setSelected] = useState<CardSelectionItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selection = useMemo(() => contentState.status === 'ready' && profile
    ? buildCardSelection(contentState.content, cards, profile, { type, era }) : null,
  [cards, contentState, era, profile, type])

  if (contentState.status === 'signed-out' || status === 'signed-out') return <ScreenState title="Sign in to redeem a Card Coupon" detail="Your private catalog and saved collection require your owner account." action={{ label: 'Open Settings', to: '/settings' }} />
  if (contentState.status === 'empty') return <ScreenState title="Content is not imported" detail="Publish private content before selecting a card." />
  if (contentState.status === 'error') return <ScreenState title="Content unavailable" detail={contentState.error.message} />
  if (status === 'error') return <ScreenState title="Save needs attention" detail={lifecycleError ?? 'The local save could not be opened.'} />
  if (contentState.status !== 'ready' || status !== 'ready' || !profile || !selection) return <ScreenState title="Opening Card Select…" detail="Loading your private card catalog." />
  const eras = selection.eras.map((group) => group.key)
  const redeem = () => {
    if (!selected || busy || profile.cardCoupons < 1) return
    setBusy(true)
    setError(null)
    void redeemCardCoupon(selected.template.id)
      .then((result) => {
        pushToast(result.alreadyRedeemed ? 'Card already redeemed' : 'New support card acquired')
        navigate(`/collection/reveal/card/${encodeURIComponent(selected.template.id)}`, { replace: true })
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not redeem this coupon'))
      .finally(() => setBusy(false))
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      <Panel className="bg-gradient-to-br from-violet-50 to-white">
        <Link to="/cards" className="inline-flex min-h-11 items-center text-sm font-extrabold text-violet-700">← Card album</Link>
        <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-extrabold tracking-wide text-violet-700 uppercase">Card Select</p><h1 className="text-2xl font-extrabold">Choose one SSR</h1></div><p className="text-right text-sm font-extrabold">{selection.couponBalance} coupon{selection.couponBalance === 1 ? '' : 's'}<br />{selection.owned}/{selection.total} owned</p></div>
        <p className="mt-2 text-sm font-bold text-ink-soft">Any unowned card is eligible. Future-era cards remain locked for equipping until an Uma reaches that tier.</p>
        {!persistent && <p className="mt-2 rounded-xl bg-amber-50 p-2 text-xs font-extrabold">Memory only — acquisition will not survive reload or sync.</p>}
        {persistent && sync.status === 'offline' && <p className="mt-2 rounded-xl bg-amber-50 p-2 text-xs font-extrabold">Offline — acquisition commits locally and will sync when the connection returns.</p>}
        {persistent && (sync.status === 'pending' || sync.status === 'syncing') && <p className="mt-2 rounded-xl bg-sky-50 p-2 text-xs font-extrabold text-sky-deep">Local changes are saved · cloud sync {sync.status === 'syncing' ? 'in progress' : 'pending'}.</p>}
      </Panel>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button type="button" onClick={() => setEra(null)} className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-extrabold ${era === null ? 'bg-violet-600 text-white' : 'bg-white'}`}>All eras</button>
        {eras.map((value) => <button key={value} type="button" onClick={() => setEra(value)} className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-extrabold ${era === value ? 'bg-violet-600 text-white' : 'bg-white'}`}>Tier {value}</button>)}
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TYPES.map((value) => <button key={value} type="button" onClick={() => setType(value)} className={`min-h-11 shrink-0 rounded-full px-3 text-xs font-extrabold ${type === value ? 'bg-sky-deep text-white' : 'bg-white'}`}>{label(value)}</button>)}
      </div>
      {selection.couponBalance < 1 && <Panel className="border-amber-300 bg-amber-50 py-3 text-sm font-bold">No Card Select Coupons. Max an owned card at LB4 and level 25 to earn one.</Panel>}
      {selection.items.length > 0 ? <div className="grid grid-cols-2 gap-3">{selection.items.map((item) => <SelectionTile key={item.template.id} item={item} onClick={() => { setSelected(item); setError(null) }} />)}</div> : <Panel className="text-center text-sm font-bold text-ink-soft">No unowned cards match these filters.</Panel>}
      <BottomSheet open={selected !== null} onClose={() => { if (!busy) { setSelected(null); setError(null) } }}>
        {selected && <div>
          <div className="flex gap-3"><AtlasSprite asset={selected.asset} alt={`${selected.template.charName} support card`} className="h-24 w-24 shrink-0 rounded-2xl bg-slate-100" fallback={<div className="flex h-full items-center justify-center text-4xl">🃏</div>} /><div><p className="text-xs font-extrabold text-violet-700">{label(selected.template.type)} · {scenarioForTier(selected.template.era)?.name ?? `Tier ${selected.template.era}`}</p><h2 className="text-xl font-extrabold">{selected.template.charName}</h2><p className="text-sm font-bold text-ink-soft">{selected.template.title || 'Support card'}</p></div></div>
          {selected.acquisitionNote && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold">{selected.acquisitionNote}</p>}
          <div className="my-4 flex items-center justify-between rounded-2xl bg-violet-50 p-3 font-extrabold"><span>Card Select Coupon</span><span>1 → {Math.max(0, profile.cardCoupons - 1)}</span></div>
          {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-danger">{error}</p>}
          <GameButton disabled={busy || profile.cardCoupons < 1} onClick={redeem}>{busy ? 'Adding to collection…' : 'Redeem 1 Coupon'}</GameButton>
        </div>}
      </BottomSheet>
    </div>
  )
}
