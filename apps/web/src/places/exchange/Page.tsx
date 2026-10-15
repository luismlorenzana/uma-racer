// The Exchange (docs/rework/09-racing-rewards-and-exchange.md §5.5; T138): a header with Prize Money, Speed Tickets held
// and T141's purse bar; Speed Tickets ×1, ×10, ×50 or a typed amount with the total and Buy; raw ingredients in eight
// family tabs, one row per stocked grade with its price, Warehouse count and the planner's badge, a quantity sheet of
// 1–99, and the next grade's lock. The purse bar is T141's view (09 §3.5). Buy is off with "Need 120 more" when short and asks once at 1,000 or more. Deep
// links: `?row=speed-tickets`, `?family=:id&grade=:g`.
import { FAMILIES, FAMILY_IDS, SPEED_TICKET_ID, type FamilyId } from '@racer/domain/items'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { LockedIcon, TicketIcon } from '../../ui/icons'
import { Panel } from '../../ui/Panel'
import { useGame, useNow, useRuntime } from '../../app/game'
import { CoinIcon } from '../../ui/icons'
import { amount } from '../../ui/labels'
import { PlaceHeader } from '../../ui/PlaceHeader'
import { TapNoteLine, useTap } from '../../ui/work'
import { Sheet } from '../../ui/Sheet'
import { ItemIcon } from '../../ui/ItemIcon'
import { localDayAt, purseBar } from '../racing/view'
import type { PageProps } from '../registry'
import { buyCheck, buyQuestion, exchangeView, rawFamily, RAW_PER_PURCHASE, SPEED_TICKET_STEPS, speedTicketPrice, typedQty, type RawRow } from './model'

const isFamily = (value: string | null): value is FamilyId => FAMILY_IDS.includes(value as FamilyId)

/** Buy with its rule: off with `prize-money`'s words, and one question at 1,000 or more. */
function BuyButton({ sku, name, qty, unitPrice, prizeMoney, label = 'Buy' }: {
  sku: string
  name: string
  qty: number | null
  unitPrice: number
  prizeMoney: number
  label?: string
}) {
  const tap = useTap()
  const [said, setSaid] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const key = `buy:${sku}`
  const check = qty === null ? null : buyCheck(prizeMoney, unitPrice, qty)
  const buy = async () => {
    setAsking(false)
    if (qty === null) return
    setSaid(null)
    const answer = await tap.run('buy', { sku, qty, unitPrice }, key)
    if (answer?.kind === 'done') setSaid(`Bought ${answer.receipt.qty} ${name} for ${amount(answer.receipt.total)}.`)
  }
  return (
    <div>
      <Button className="w-full" disabled={check === null || check.short !== null || tap.pending !== null} onClick={() => (check?.asks ? setAsking(true) : void buy())}>
        {label}{check !== null && <span className="flex items-center gap-1"><CoinIcon size={16} variant="duotone" />{amount(check.total)}</span>}
      </Button>
      {check?.short != null && <p className="mt-1 text-center text-[12px] text-danger" data-reason>{check.short}</p>}
      {qty === null && <p className="mt-1 text-center text-[12px] text-ink-soft">Type how many, from 1.</p>}
      <TapNoteLine tap={tap} className="mt-2" />
      {said !== null && <p role="status" className="text-[13px] text-ink">{said}</p>}
      <Sheet open={asking} onClose={() => setAsking(false)} label="Buy">
        {asking && check !== null && qty !== null && (
          <div className="space-y-3" data-g2="buy-question">
            <p data-sheet-heading tabIndex={-1} className="text-[15px] outline-none">{buyQuestion(qty, name, check.total)}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setAsking(false)}>Not now</Button>
              <Button onClick={() => void buy()}>Buy</Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}

function RawSheet({ row, prizeMoney, onClose }: { row: RawRow | null; prizeMoney: number; onClose: () => void }) {
  const [qty, setQty] = useState(1)
  useEffect(() => setQty(1), [row?.item.id])
  if (row === null) return <BottomSheet open={false} onClose={onClose}>{null}</BottomSheet>
  return (
    <BottomSheet open onClose={onClose} label={row.item.name}>
      <div className="space-y-3" data-g2="raw-sheet">
        <div className="flex items-center gap-3">
          <ItemIcon item={row.item.id} scale={2} decorative />
          <div>
            <h2 data-sheet-heading tabIndex={-1} className="font-display text-xl font-bold outline-none">{row.item.name}</h2>
            <p className="text-[13px] text-ink-soft">{FAMILIES[row.item.family].name} · grade {row.grade} · {amount(row.price)} each · {row.held} in the Warehouse</p>
          </div>
        </div>
        <label className="block text-[13px]">
          <span className="flex justify-between"><span>How many</span><strong className="tabular-nums">{qty}</strong></span>
          <input type="range" min={1} max={RAW_PER_PURCHASE} value={qty} onChange={(event) => setQty(Number(event.target.value))}
            className="h-11 w-full accent-[var(--color-accent)]" aria-label="How many" />
        </label>
        <div className="flex gap-1.5">
          {[1, 10, 25, RAW_PER_PURCHASE].map((n) => <Chip key={n} selected={qty === n} className="min-h-11 min-w-11 justify-center" onClick={() => setQty(n)}>×{n}</Chip>)}
        </div>
        <BuyButton sku={row.item.id} name={row.item.name} qty={qty} unitPrice={row.price} prizeMoney={prizeMoney} />
      </div>
    </BottomSheet>
  )
}

export default function ExchangePage({ place, rest }: PageProps) {
  const [params, setParams] = useSearchParams()
  const { game } = useRuntime()
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const now = useNow()
  const tickets = useRef<HTMLElement>(null)
  const [typed, setTyped] = useState('')
  const [step, setStep] = useState<number | null>(1)
  const asked = params.get('family')
  const family: FamilyId = isFamily(asked) ? asked : 'vegetables'
  const view = useMemo(() => (state === null || env === null ? null : exchangeView(state, now, env)), [state, env, now])
  const raw = useMemo(() => (view === null ? null : rawFamily(view.current, view.plan, family)), [view, family])
  const gradeParam = Number(params.get('grade'))
  const openRow = raw?.rows.find((row) => row.grade === gradeParam) ?? null

  useEffect(() => {
    if (params.get('row') === 'speed-tickets') tickets.current?.scrollIntoView?.({ block: 'start' })
  }, [params, view !== null])

  if (view === null || raw === null) return <PlaceHeader place={place} rest={rest} />
  const { current } = view
  const prizeMoney = current.profile.prizeMoney
  const held = current.items[SPEED_TICKET_ID] ?? 0
  const price = speedTicketPrice()
  const qty = step ?? typedQty(typed)
  const bar = purseBar(current.profile.purse, localDayAt(now, game.utcOffsetMin(now)))
  const setParam = (changes: Readonly<Record<string, string | null>>) => setParams((current) => {
    const next = new URLSearchParams(current)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    return next
  }, { replace: true })

  return (
    <div data-place-page="exchange">
      <PlaceHeader place={place} rest={rest} lines={['Speed Tickets take 30 minutes off one running job or session. Raw ingredients are stocked up to the highest grade any Uma has opened.']} />
      <div className="space-y-3 px-4 pt-3 pb-24">
        <Panel className="flex items-center justify-around p-3" data-g2="exchange-header">
          <span className="flex items-center gap-1.5 text-[15px]"><CoinIcon size={20} variant="duotone" /><strong className="tabular-nums">{amount(prizeMoney)}</strong><span className="sr-only">Prize Money</span></span>
          <span className="flex items-center gap-1.5 text-[15px]"><TicketIcon size={20} variant="duotone" /><strong className="tabular-nums">{held}</strong><span className="sr-only">Speed Tickets held</span></span>
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
        <section ref={tickets} aria-label="Speed Tickets" className="scroll-mt-16" data-row="speed-tickets">
          <Panel className="space-y-2 p-3">
            <h2 className="flex items-center justify-between text-[15px] font-semibold">
              <span>Speed Tickets</span><span className="text-[13px] font-normal text-ink-soft">{price} each</span>
            </h2>
            <div className="flex gap-1.5" role="group" aria-label="How many Speed Tickets">
              {SPEED_TICKET_STEPS.map((n) => (
                <Chip key={n} selected={step === n} className="min-h-11 min-w-11 justify-center" onClick={() => { setStep(n); setTyped('') }}>×{n}</Chip>
              ))}
              <input inputMode="numeric" value={typed} placeholder="Other" aria-label="Type how many Speed Tickets"
                onChange={(event) => { setTyped(event.target.value); setStep(null) }}
                className="min-h-11 w-20 min-w-0 flex-1 rounded-full border border-hairline-strong bg-panel px-3 text-[14px]" />
            </div>
            <BuyButton sku={SPEED_TICKET_ID} name="Speed Tickets" qty={qty} unitPrice={price} prizeMoney={prizeMoney} />
          </Panel>
        </section>
        <section aria-label="Raw ingredients" className="space-y-2">
          <h2 className="text-[15px] font-semibold">Raw ingredients</h2>
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]" role="tablist" aria-label="Families">
            {FAMILY_IDS.map((id) => (
              <Chip key={id} role="tab" aria-selected={family === id} selected={family === id} className="min-h-11" onClick={() => setParam({ family: id, grade: null })}>
                {FAMILIES[id].name}
              </Chip>
            ))}
          </div>
          <ul className="space-y-1.5" data-g2="raw-rows">
            {raw.rows.map((row) => (
              <li key={row.item.id}>
                <button type="button" onClick={() => setParam({ family, grade: String(row.grade) })} data-item={row.item.id}
                  className="flex min-h-14 w-full items-center gap-3 rounded-sm border border-hairline bg-panel px-2 py-1.5 text-left shadow-1">
                  <ItemIcon item={row.item.id} decorative />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{row.item.name} · G{row.grade}</span>
                    <span className="block text-[12px] text-ink-soft">{row.held} in the Warehouse{row.badge !== null && <> · <span className="font-semibold text-warning">{row.badge}</span></>}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 font-semibold tabular-nums"><CoinIcon size={16} variant="duotone" />{row.price}</span>
                </button>
              </li>
            ))}
            {raw.next !== null && (
              <li className="flex min-h-14 items-center gap-3 rounded-sm border border-dashed border-hairline-strong px-2 py-1.5 text-ink-soft" data-g2="next-grade">
                <span className="opacity-45"><ItemIcon item={raw.next.item.id} decorative /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{raw.next.item.name} · G{raw.next.item.grade}</span>
                  <span className="block text-[12px]">{raw.next.words}</span>
                </span>
                <LockedIcon size={20} title="Not stocked yet" />
              </li>
            )}
          </ul>
        </section>
        <div className="grid gap-1.5 text-[14px]">
          <Link to="/town/warehouse" state={{ back: true }} className="flex min-h-11 items-center justify-between rounded-sm bg-sunken/60 px-3 font-semibold">
            <span>Sell surplus</span><span aria-hidden>→ Warehouse</span>
          </Link>
          <p className="px-1 text-[13px] text-ink-soft">Upgrades are bought at each building.</p>
        </div>
      </div>
      <RawSheet row={openRow} prizeMoney={prizeMoney} onClose={() => setParam({ grade: null })} />
    </div>
  )
}
