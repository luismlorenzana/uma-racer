// The Warehouse (docs/game/07-farm.md §10; docs/game/09-racing-rewards-and-exchange.md §6, §8; T138, SD4): uma-kit's
// shelves (`ShelfView`), filled with this game's stock. Raw · Crafted · Dishes · Tickets, the kit's grade chips (every
// grade, one grade, or the highest held per family), a row per stack held with what's reserved, coming and needed, and
// the kit's stock sheet with this game's lines: what it is, what's free, the recipes that use it, Make more (T140's job
// sheet), and Sell ×1, ×10 or All at the live price (reserved items aren't held: they're inside their jobs), asking the
// one question 09 §6.1 asks before it sells, which covers what the planner needs.
import { ShelfView } from '@luismlorenzana/uma-kit/places'
import { UiMark } from '@luismlorenzana/uma-kit/ui'
import { useMemo } from 'react'
import { Link, useLocation } from 'react-router'
import { useGame, useNow } from '../../app/game'
import { ItemIcon, itemIconScale } from '../../ui/ItemIcon'
import { amount } from '../../ui/labels'
import { doneOrThrow, useTap, useWordsContext } from '../../ui/work'
import { umaName } from '../../ui/words'
import { PlacePageHeader } from '../PlacePageHeader'
import type { PageProps } from '../registry'
import {
  EMPTY_WORDS, makeAt, recipesUsing, salePrice, sellQuestion, sellSheet, SHELF_LABEL, SHELVES, stockItems, warehouse,
  type StockRow,
} from './model'

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

/** The stock sheet's own lines (the kit draws the icon, what's held, and the sell sizes). */
function StockDetails({ row }: { row: StockRow }) {
  const location = useLocation()
  const sheet = sellSheet(row)
  const recipes = recipesUsing(row.item.id)
  const building = makeAt(row.item)
  const back = `${location.pathname}${location.search}`
  return (
    <div className="space-y-3" data-g2="stock-sheet">
      <p className="text-[13px] text-ink-soft">{row.line}</p>
      <dl className="grid grid-cols-4 gap-1 text-center text-[12px]">
        {([['Reserved', row.reserved], ['Coming', row.coming], ['Needed', row.needed], ['Free', sheet.counts.free]] as const).map(([label, n]) => (
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
      {sheet.noSale !== null ? <p className="text-[13px] text-ink-soft">{sheet.noSale}</p>
        : row.reserved > 0 && <p className="text-[12px] text-ink-soft">Reserved items stay in their jobs.</p>}
    </div>
  )
}

export default function WarehousePage({ place, rest }: PageProps) {
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const now = useNow()
  const tap = useTap()
  const context = useWordsContext()
  const house = useMemo(() => (state === null || env === null ? null : warehouse(state, now, env)), [state, env, now])
  const items = useMemo(() => (house === null ? [] : stockItems(house.rows)), [house])
  if (house === null) return <PlacePageHeader place={place} rest={rest} />
  // The sheet reads the live stack, so a sale or a sync redraws it.
  const live = (row: StockRow): StockRow => house.counts(row.item.id) ?? { ...row, held: 0, reserved: 0, coming: 0, needed: 0 }
  return (
    <div data-place-page="warehouse">
      <PlacePageHeader place={place} rest={rest} lines={['Reserved items sit inside running jobs. Coming items are being made. Needed is what the planner holds back for your targets; selling it asks first.']} />
      <ShelfView
        shelves={SHELVES.map((key) => ({ key, label: SHELF_LABEL[key] }))}
        items={items}
        layout="rows"
        renderItem={(item, size) => <ItemIcon item={item.id} scale={itemIconScale(size)} decorative />}
        rowDetail={(item) => <Counts row={item.row} />}
        details={(item) => <StockDetails row={live(item.row)} />}
        price={(item) => {
          const each = salePrice(item.row)
          return each === null ? null : { mark: <UiMark mark="currency/prize-money" />, amount: each }
        }}
        ask={(item, option) => sellQuestion(live(item.row), option, house.plan, (outfitId) => umaName(env?.content ?? null, outfitId))}
        onSell={async (item, qty) => {
          const unitPrice = salePrice(item.row)
          if (unitPrice === null) return
          const answer = doneOrThrow(await tap.run('sell', { itemId: item.id, qty, unitPrice }, `sell:${item.id}`), context)
          return `Sold ${answer.receipt.qty} for ${amount(answer.receipt.total)}.`
        }}
        header={house.rows.length === 0 ? <p className="rounded-md border border-hairline bg-panel p-4 text-center text-[14px]" data-g2="empty">{EMPTY_WORDS}</p> : undefined}
      />
    </div>
  )
}
