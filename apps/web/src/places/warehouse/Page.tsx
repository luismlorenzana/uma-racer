// The Warehouse (docs/game/07-farm.md §10; docs/game/09-racing-rewards-and-exchange.md §6, §8; T138): Raw · Crafted
// · Dishes · Tickets shelves, family and grade filters, a row per stack with what's held, reserved, coming and needed,
// and the stock sheet: what it is, the recipes that use it, Make more (T140's job sheet), and Sell ×1 / ×10 / Surplus /
// All free at the live price, asking the one question 09 §6.1 asks before it sells.
import { FAMILIES, FAMILY_IDS, itemById, type FamilyId } from '@racer/domain/items'
import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { useGame, useNow } from '../../app/game'
import { CoinIcon } from '../../ui/icons'
import { amount } from '../../ui/labels'
import { PlaceHeader } from '../../ui/PlaceHeader'
import { Tabs } from '../../ui/Tabs'
import { TapNoteLine, useTap } from '../../ui/work'
import { umaName } from '../../ui/words'
import type { PageProps } from '../registry'
import { ItemIcon } from '../../ui/ItemIcon'
import {
  EMPTY_WORDS, filterRows, makeAt, recipesUsing, SELL_LABEL, sellQuestion, sellSheet, SHELF_LABEL, SHELVES, sizeOffWords, warehouse,
  type SellOption, type Shelf, type StockRow, type Warehouse,
} from './model'

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

function Counts({ row }: { row: StockRow }) {
  const cell = (label: string, n: number) => (
    <span className={n === 0 ? 'text-ink-faint' : ''}><span className="text-ink-soft">{label}</span> <span className="tabular-nums">{n}</span></span>
  )
  return (
    <span className="flex flex-wrap gap-x-2.5 text-[12px]">
      {cell('reserved', row.reserved)}
      {cell('coming', row.coming)}
      {cell('needed', row.needed)}
    </span>
  )
}

function StockSheet({ row, house, onClose }: { row: StockRow | null; house: Warehouse; onClose: () => void }) {
  const tap = useTap()
  const [said, setSaid] = useState<string | null>(null)
  const location = useLocation()
  const content = useGame((snapshot) => snapshot.env?.content ?? null)
  const [asking, setAsking] = useState<{ option: SellOption; question: string } | null>(null)
  if (row === null) return <BottomSheet open={false} onClose={onClose}>{null}</BottomSheet>
  // The sheet reads the live stack, so a sale or a sync redraws it.
  const live = house.counts(row.item.id) ?? { ...row, held: 0, reserved: 0, coming: 0, needed: 0 }
  const sheet = sellSheet(live)
  const recipes = recipesUsing(row.item.id)
  const building = makeAt(row.item)
  const back = `${location.pathname}${location.search}`
  const key = `sell:${row.item.id}`
  const sell = async (option: SellOption) => {
    setAsking(null)
    setSaid(null)
    const answer = await tap.run('sell', { itemId: row.item.id, qty: option.qty, unitPrice: option.unitPrice }, key)
    if (answer?.kind === 'done') setSaid(`Sold ${answer.receipt.qty} for ${amount(answer.receipt.total)}.`)
  }
  const choose = (option: SellOption) => {
    const question = sellQuestion(live, option, house.plan, (outfitId) => umaName(content, outfitId))
    if (question === null) void sell(option)
    else setAsking({ option, question })
  }
  return (
    <>
    <BottomSheet open onClose={onClose} label={row.item.name}>
      <div className="space-y-3" data-g2="stock-sheet">
        <div className="flex items-center gap-3">
          <ItemIcon item={row.item.id} scale={2} decorative />
          <div className="min-w-0">
            <h2 data-sheet-heading tabIndex={-1} className="font-display text-xl font-bold outline-none">{row.item.name}</h2>
            <p className="text-[13px] text-ink-soft">{live.line}</p>
          </div>
        </div>
        <dl className="grid grid-cols-5 gap-1 text-center text-[12px]">
          {([['Held', live.held], ['Reserved', live.reserved], ['Coming', live.coming], ['Needed', live.needed], ['Free', sheet.counts.free]] as const).map(([label, n]) => (
            <div key={label} className="rounded-sm bg-sunken/60 py-1">
              <dt className="text-ink-soft">{label}</dt>
              <dd className="font-display text-[15px] font-semibold tabular-nums">{n}</dd>
            </div>
          ))}
        </dl>
        {recipes.length > 0 && (
          <section aria-label="Used in">
            <h3 className="text-micro mb-1">Used in</h3>
            <ul className="flex flex-wrap gap-1.5 text-[13px]">
              {recipes.map(({ item, qty }) => (
                <li key={item.id} className="flex items-center gap-1 rounded-full bg-sunken/60 py-0.5 pr-2 pl-0.5">
                  <ItemIcon item={item.id} decorative />{item.name} ×{qty}
                </li>
              ))}
            </ul>
          </section>
        )}
        {building !== null && (
          <Link to={`/farm/${building}?job=${encodeURIComponent(row.item.id)}&back=${encodeURIComponent(back)}`} state={{ back: true }}
            className="font-display flex min-h-12 items-center justify-center rounded-sm border border-hairline-strong bg-panel font-semibold shadow-1">
            Make more
          </Link>
        )}
        {sheet.noSale !== null ? <p className="text-[13px] text-ink-soft">{sheet.noSale}</p> : (
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Sell">
            {sheet.options.map((option) => (
              <div key={option.size}>
                <Button className="w-full" variant={option.size === 'surplus' ? 'primary' : 'secondary'} disabled={option.qty === 0 || tap.pending !== null}
                  onClick={() => choose(option)} aria-label={`${SELL_LABEL[option.size]}: ${option.qty} for ${amount(option.total)}`}>
                  <span className="flex flex-col items-center leading-tight">
                    <span>{SELL_LABEL[option.size]}{option.size === 'surplus' || option.size === 'allFree' ? ` ×${option.qty}` : ''}</span>
                    <span className="flex items-center gap-1 text-[12px] font-normal"><CoinIcon size={16} variant="duotone" />{amount(option.total)}</span>
                  </span>
                </Button>
                {option.qty === 0 && <p className="mt-0.5 text-center text-[11px] text-ink-soft">{sizeOffWords(option.size)}</p>}
              </div>
            ))}
          </div>
        )}
        {sheet.unitPrice !== null && <p className="text-center text-[12px] text-ink-soft">Each sells for {amount(sheet.unitPrice)}. Reserved items stay in their jobs.</p>}
        <TapNoteLine tap={tap} />
        {said !== null && <p role="status" className="text-[13px] text-ink">{said}</p>}
      </div>
    </BottomSheet>
      <BottomSheet open={asking !== null} onClose={() => setAsking(null)} label="Sell">
        {asking !== null && (
          <div className="space-y-3" data-g2="sell-question">
            <p data-sheet-heading tabIndex={-1} className="text-[15px] outline-none">{asking.question}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setAsking(null)}>Keep</Button>
              <Button onClick={() => void sell(asking.option)}>Sell</Button>
            </div>
          </div>
        )}
      </BottomSheet>
    </>
  )
}

export default function WarehousePage({ place, rest }: PageProps) {
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const now = useNow()
  const [shelf, setShelf] = useState<Shelf>('raw')
  const [family, setFamily] = useState<FamilyId | null>(null)
  const [grade, setGrade] = useState<number | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const house = useMemo(() => (state === null || env === null ? null : warehouse(state, now, env)), [state, env, now])
  if (house === null) return <PlaceHeader place={place} rest={rest} />
  const rows = filterRows(house.rows, { shelf, family: shelf === 'tickets' ? null : family, grade: shelf === 'tickets' ? null : grade })
  const openRow = open === null ? null : house.counts(open) ?? null
  return (
    <div data-place-page="warehouse">
      <PlaceHeader place={place} rest={rest} lines={['Reserved items sit inside running jobs. Coming items are being made. Needed is what the planner holds back for your targets; selling it asks first.']} />
      <div className="space-y-3 px-4 pt-3 pb-24">
        <Tabs label="Shelves" value={shelf} onChange={setShelf} options={SHELVES.map((value) => ({ value, label: SHELF_LABEL[value] }))} />
        {shelf !== 'tickets' && (
          <>
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]" role="group" aria-label="Family">
              <Chip selected={family === null} className="min-h-11" onClick={() => setFamily(null)}>Every family</Chip>
              {FAMILY_IDS.map((id) => (
                <Chip key={id} selected={family === id} className="min-h-11" onClick={() => setFamily(family === id ? null : id)}>{FAMILIES[id].name}</Chip>
              ))}
            </div>
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]" role="group" aria-label="Grade">
              <Chip selected={grade === null} className="min-h-11" onClick={() => setGrade(null)}>Every grade</Chip>
              {GRADES.map((g) => <Chip key={g} selected={grade === g} className="min-h-11 min-w-11 justify-center" onClick={() => setGrade(grade === g ? null : g)}>G{g}</Chip>)}
            </div>
          </>
        )}
        {house.rows.length === 0 && <p className="rounded-md border border-hairline bg-panel p-4 text-center text-[14px]" data-g2="empty">{EMPTY_WORDS}</p>}
        {house.rows.length > 0 && rows.length === 0 && <p className="text-center text-[13px] text-ink-soft">Nothing on this shelf.</p>}
        <ul className="space-y-1.5" data-g2="stock-rows">
          {rows.map((row) => (
            <li key={row.item.id}>
              <button type="button" onClick={() => setOpen(row.item.id)} data-item={row.item.id}
                className="flex min-h-14 w-full items-center gap-3 rounded-sm border border-hairline bg-panel px-2 py-1.5 text-left shadow-1">
                <ItemIcon item={row.item.id} decorative />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{row.line}</span>
                  <Counts row={row} />
                </span>
                <span className="font-display shrink-0 text-lg font-semibold tabular-nums" aria-label={`${row.held} held`}>{row.held}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <StockSheet row={openRow ?? (open === null ? null : { item: itemById(open)!, shelf, family: null, grade: null, line: itemById(open)!.name, held: 0, reserved: 0, coming: 0, needed: 0 })}
        house={house} onClose={() => setOpen(null)} />
    </div>
  )
}
