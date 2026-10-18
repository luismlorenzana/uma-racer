// The Exchange (docs/game/09-racing-rewards-and-exchange.md §5.5; T138, SD4): a header with Prize Money, Speed Tickets
// held and T141's purse bar (09 §3.5), this game's rows above uma-kit's; then uma-kit's buy rows (`ExchangeRows`) with
// this game's goods: Speed Tickets (×1, ×10, ×50 or a typed amount), and raw ingredients in eight family tabs, one row
// per stocked grade with its price, Warehouse count and the planner's badge, then the next grade's lock. Each row opens
// the kit's buy sheet: how many, the total, and Buy, off with "Need 120 more" when short. Deep links: `?row=speed-tickets`
// and `?family=:id&grade=:g`, which opens the family's tab at that grade's row.
import { ExchangeRows, type ExchangeRow } from '@luismlorenzana/uma-kit/places'
import { Chip, Panel, UiMark } from '@luismlorenzana/uma-kit/ui'
import { buyPrice } from '@racer/domain/economy'
import { FAMILIES, FAMILY_IDS, SPEED_TICKET_ID, type FamilyId } from '@racer/domain/items'
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useGame, useNow, useRuntime } from '../../app/game'
import { amount } from '../../ui/labels'
import { PlacePageHeader } from '../PlacePageHeader'
import { doneOrThrow, useTap, useWordsContext } from '../../ui/work'
import { ItemIcon } from '../../ui/ItemIcon'
import { localDayAt, purseBar } from '../racing/view'
import type { PageProps } from '../registry'
import {
  boughtWords, exchangeView, rawFamily, RAW_PER_PURCHASE, SPEED_TICKET_STEPS, SPEED_TICKETS, speedTicketPrice, type CountedName,
} from './model'

const isFamily = (value: string | null): value is FamilyId => FAMILY_IDS.includes(value as FamilyId)

/** Speed Tickets have no limit but the balance (09 §5); the sheet takes a typed amount up to this. */
const SPEED_TICKET_MAX = 99_999
const RAW_STEPS = [1, 10, 25, RAW_PER_PURCHASE] as const
const PRICE_MARK = <UiMark mark="currency/prize-money" />

/** Each row's line, read live: the kit's buy sheet keeps the row it opened with, so after a buy its count would go stale. */
const RowLines = createContext<ReadonlyMap<string, ReactNode>>(new Map())
function RowLine({ of }: { of: string }) {
  return <>{useContext(RowLines).get(of)}</>
}

export default function ExchangePage({ place, rest }: PageProps) {
  const [params, setParams] = useSearchParams()
  const { game } = useRuntime()
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const now = useNow()
  const tap = useTap()
  const context = useWordsContext()
  const tickets = useRef<HTMLElement>(null)
  const rawList = useRef<HTMLElement>(null)
  const asked = params.get('family')
  const family: FamilyId = isFamily(asked) ? asked : 'vegetables'
  const view = useMemo(() => (state === null || env === null ? null : exchangeView(state, now, env)), [state, env, now])
  const raw = useMemo(() => (view === null ? null : rawFamily(view.current, view.plan, family)), [view, family])
  const askedRow = raw?.rows.find((row) => row.grade === Number(params.get('grade')))?.item.id ?? null

  useEffect(() => {
    if (params.get('row') === 'speed-tickets') tickets.current?.scrollIntoView?.({ block: 'start' })
  }, [params, view !== null])
  // A link to one grade (the Farm's "buy it" and the Peek's shortage) brings its row into view, one tap from its sheet.
  useEffect(() => {
    if (askedRow !== null) rawList.current?.querySelector(`[data-row="${askedRow}"]`)?.scrollIntoView?.({ block: 'center' })
  }, [askedRow, view !== null])

  if (view === null || raw === null) return <PlacePageHeader place={place} rest={rest} />
  const { current } = view
  const prizeMoney = current.profile.prizeMoney
  const held = current.items[SPEED_TICKET_ID] ?? 0
  const bar = purseBar(current.profile.purse, localDayAt(now, game.utcOffsetMin(now)))
  const names = new Map<string, CountedName>([[SPEED_TICKET_ID, SPEED_TICKETS], ...raw.rows.map((row) => [row.item.id, row.item.name] as const)])
  const buy = async (row: ExchangeRow, qty: number): Promise<string> => {
    const answer = doneOrThrow(await tap.run('buy', { sku: row.key, qty, unitPrice: row.price.amount }, `buy:${row.key}`), context)
    return boughtWords(answer.receipt.qty, names.get(row.key) ?? row.name, answer.receipt.total)
  }
  const lines = new Map<string, ReactNode>([[SPEED_TICKET_ID, `${held} held · 30 minutes off one running job or session`]])
  for (const row of raw.rows) {
    lines.set(row.item.id, <>{row.held} in the Warehouse{row.badge !== null && <> · <span className="font-semibold text-warning">{row.badge}</span></>}</>)
  }
  const speedRows: ExchangeRow[] = [{
    key: SPEED_TICKET_ID,
    icon: <ItemIcon item={SPEED_TICKET_ID} decorative />,
    name: 'Speed Ticket',
    detail: <RowLine of={SPEED_TICKET_ID} />,
    price: { mark: PRICE_MARK, amount: speedTicketPrice() },
  }]
  const rawRows: ExchangeRow[] = [
    ...raw.rows.map((row): ExchangeRow => ({
      key: row.item.id,
      icon: <ItemIcon item={row.item.id} decorative />,
      name: `${row.item.name} · G${row.grade}`,
      detail: <RowLine of={row.item.id} />,
      price: { mark: PRICE_MARK, amount: row.price },
    })),
    ...(raw.next === null ? [] : [{
      key: raw.next.item.id,
      icon: <span className="opacity-45"><ItemIcon item={raw.next.item.id} decorative /></span>,
      name: `${raw.next.item.name} · G${raw.next.item.grade}`,
      price: { mark: PRICE_MARK, amount: buyPrice(raw.next.item.id) ?? 0 },
      disabled: raw.next.words,
    }]),
  ]
  const setParam = (changes: Readonly<Record<string, string | null>>) => setParams((current) => {
    const next = new URLSearchParams(current)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    return next
  }, { replace: true })

  return (
    <RowLines.Provider value={lines}>
      <div data-place-page="exchange">
        <PlacePageHeader place={place} rest={rest} lines={['Speed Tickets take 30 minutes off one running job or session. Raw ingredients are stocked up to the highest grade any Uma has opened.']} />
        <div className="space-y-3 px-4 pt-3 pb-24">
          <Panel className="flex items-center justify-around p-3" data-g2="exchange-header">
            <span className="flex items-center gap-1.5 text-[15px]"><UiMark mark="currency/prize-money" /><strong className="tabular-nums">{amount(prizeMoney)}</strong><span className="sr-only">Prize Money</span></span>
            <span className="flex items-center gap-1.5 text-[15px]"><UiMark mark="currency/speed-ticket" /><strong className="tabular-nums">{held}</strong><span className="sr-only">Speed Tickets held</span></span>
          </Panel>
          <div className="rounded-md border border-hairline bg-panel px-3 py-2 shadow-1" data-g2="purse-bar" data-band={bar.band}>
            <p className="text-[13px] font-semibold text-ink">{bar.words}</p>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/10" aria-hidden>
              <div
                className={`h-full origin-left rounded-full transition-transform duration-500 ${bar.band === 'full' ? 'bg-success' : bar.band === 'tired' ? 'bg-warning' : 'bg-danger'}`}
                style={{ transform: `scaleX(${Math.max(0, Math.min(1, bar.fill))})` }}
              />
            </div>
          </div>
          <section ref={tickets} aria-label="Speed Tickets" className="scroll-mt-16 space-y-2" data-row="speed-tickets">
            <h2 className="text-[15px] font-semibold">Speed Tickets</h2>
            <ExchangeRows rows={speedRows} balance={prizeMoney} quantities={SPEED_TICKET_STEPS} max={SPEED_TICKET_MAX} onBuy={buy} />
          </section>
          <section ref={rawList} aria-label="Raw ingredients" className="space-y-2" data-g2="raw-rows">
            <h2 className="text-[15px] font-semibold">Raw ingredients</h2>
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]" role="tablist" aria-label="Families">
              {FAMILY_IDS.map((id) => (
                <Chip key={id} role="tab" aria-selected={family === id} selected={family === id} className="min-h-11" onClick={() => setParam({ family: id, grade: null })}>
                  {FAMILIES[id].name}
                </Chip>
              ))}
            </div>
            <ExchangeRows rows={rawRows} balance={prizeMoney} quantities={RAW_STEPS} max={RAW_PER_PURCHASE} onBuy={buy} />
          </section>
          <div className="grid gap-1.5 text-[14px]">
            <Link to="/town/warehouse" state={{ back: true }} className="flex min-h-11 items-center justify-between rounded-sm bg-sunken/60 px-3 font-semibold">
              <span>Sell surplus</span><span aria-hidden>→ Warehouse</span>
            </Link>
            <p className="px-1 text-[13px] text-ink-soft">Upgrades are bought at each building.</p>
          </div>
        </div>
      </div>
    </RowLines.Provider>
  )
}
