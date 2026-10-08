// Global Items category reused by Farm Items and Uma Puzzles; quantities are ordinary Item stacks (§7–8).
import { SCENARIOS, STRATEGIES, type ConstellationBankSaveV1, type Strategy } from '@racer/domain'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { buildItemInventory, constellationItemDefinitions, savedOrphanItem } from '../game/items/view'
import { BottomSheet } from './BottomSheet'
import { ConstellationTicketIcon, TICKET_STYLE_NAME, TicketStyleLegend } from './ConstellationTicketIcon'

export function ConstellationBankPanel({ bank, itemsTo }: { bank: ConstellationBankSaveV1 | null; itemsTo: string }) {
  if (!bank) return null
  const total = -Object.values(bank.balances).reduce((n, b) => n + b, 0)
  return <section aria-label="Constellation repayment bank" className="rounded-md border border-current/20 p-3 text-xs">
    <h3 className="font-semibold">Constellation advance · {total} to repay</h3><p className="mt-2">Existing CL and inventory stay usable. Future matching tickets repay the nonpositive bank first; only the remainder enters Items. This is not negative inventory.</p>
    <details><summary className="flex min-h-11 cursor-pointer items-center font-semibold">Scenario/style balances</summary>{constellationItemDefinitions().filter(d => Object.hasOwn(bank.balances, d.id)).map(d => <Link key={d.id} to={`${itemsTo}?item=${encodeURIComponent(d.id)}`} className="flex min-h-11 items-center gap-2"><ConstellationTicketIcon style={d.material.style} tier={d.material.scenarioTier} size={24} /><span className="flex-1">{d.name}</span><span>{bank.balances[d.id]}</span></Link>)}</details>
  </section>
}
export function ConstellationMaterials({ stocks, bank, visibility = 'owned', scenarioTier = null, recipients, exchangeTo, itemsTo, chaptersTo }: {
  stocks: Readonly<Record<string, number>>; bank: ConstellationBankSaveV1 | null; visibility?: 'owned' | 'all'; scenarioTier?: number | null
  recipients(itemId: string): readonly { id: string; name: string; href: string; select?: () => void }[]
  exchangeTo?: string; itemsTo: string; chaptersTo?: string
}) {
  const [style, setStyle] = useState<Strategy | null>(null), [params, setParams] = useSearchParams()
  const definitions = constellationItemDefinitions(), materialStocks = Object.entries(stocks).filter(([id]) => id.startsWith('constellation:'))
  const inventory = buildItemInventory(definitions, materialStocks.map(([itemId, quantity]) => ({ itemId, quantity, updatedAt: 0 })), {
    visibility, facets: { scenario: scenarioTier === null ? null : String(scenarioTier), style } })
  const id = params.get('item'), selected = definitions.find(d => d.id === id), orphan = savedOrphanItem(id, Object.fromEntries(materialStocks), definitions)
  const open = (item: string | null) => { const next = new URLSearchParams(params); if (item) next.set('item', item); else next.delete('item'); setParams(next, { replace: true }) }
  return <section aria-label="Constellation materials" className="mt-3 space-y-3">
    <div className="flex items-center justify-between gap-2"><h3 className="text-lg font-display">Constellation Tickets</h3><span className="text-xs">{inventory.catalogTotal} kinds</span></div>
    <p className="text-xs">One ticket raises one eligible outfit’s scenario CL by one. Daily Training Tickets pay for minigame entry, not CL.</p>
    <ConstellationBankPanel bank={bank} itemsTo={itemsTo} /><TicketStyleLegend />
    <label className="block text-xs">Source style<select aria-label="Ticket source style" value={style ?? 'all'} onChange={e => setStyle(e.target.value === 'all' ? null : e.target.value as Strategy)} className="mt-1 min-h-11 w-full rounded-sm border border-current/20 bg-transparent px-2"><option value="all">All styles</option>{STRATEGIES.map(s => <option key={s} value={s}>{TICKET_STYLE_NAME[s]}</option>)}</select></label>
    <p role="status" className="text-xs">{inventory.items.length} materials shown · {inventory.ownedUnique} owned kinds</p>
    {id?.startsWith('constellation:') && !selected && !orphan && <p role="alert" className="text-xs">This Constellation item link is unavailable. Saved stock is unchanged.</p>}
    {inventory.items.length === 0 && <p className="text-xs">No matching tickets yet. Choose All items to browse every scenario/style.</p>}
    <div className="grid grid-cols-2 gap-2">{inventory.items.map(item => <button key={item.itemId} type="button" onClick={() => open(item.itemId)} className="min-h-28 rounded-md border border-current/20 p-3 text-left" aria-label={`${item.definition?.name ?? item.itemId}, quantity ${item.quantity}`}>
      <div className="flex items-center justify-between gap-1">{item.definition ? <ConstellationTicketIcon style={item.definition.material.style} tier={item.definition.material.scenarioTier} /> : <span>?</span>}<strong>×{item.quantity}</strong></div>
      <p className="mt-2 text-xs">{item.definition?.name ?? `Unknown saved item · ${item.itemId}`}</p>
      {(bank?.balances[item.itemId] ?? 0) < 0 && <p className="mt-1 text-xs">Bank {bank!.balances[item.itemId]} (separate)</p>}
    </button>)}</div>
    <BottomSheet open={Boolean(selected || orphan)} onClose={() => open(null)}>{selected ? <div className="space-y-3">
      <ConstellationTicketIcon style={selected.material.style} tier={selected.material.scenarioTier} size={64} /><h2 className="font-display text-xl">{selected.name}</h2>
      <p>{stocks[selected.id] ?? 0} in global inventory · Bank {bank?.balances[selected.id] ?? 0}</p><p className="text-xs text-ink-soft">The bank is separate from spendable stock. Only original A {TICKET_STYLE_NAME[selected.material.style]} outfits with this racing scenario unlocked can spend this ticket. CL is shared across four distance presets.</p>
      <Link to={`${chaptersTo ?? itemsTo.replace(/\/items$/, '/chapters')}?scenario=${selected.material.scenarioId}`} className="flex min-h-11 items-center font-semibold text-accent-strong">Earn in {SCENARIOS.find(s => s.id === selected.material.scenarioId)?.name}</Link>
      {exchangeTo && <Link to={`${exchangeTo}?from=${encodeURIComponent(selected.id)}`} className="flex min-h-11 items-center font-semibold text-accent-strong">Exchange this style</Link>}
      <h3 className="font-semibold">Eligible recipients</h3>{recipients(selected.id).length ? recipients(selected.id).map(r => r.select ? <button key={r.id} onClick={() => { open(null); r.select!() }} className="flex min-h-11 w-full items-center rounded-sm bg-sunken px-3 text-sm font-semibold">{r.name} · Level up</button> : <Link key={r.id} to={r.href} className="flex min-h-11 items-center rounded-sm bg-sunken px-3 text-sm font-semibold">{r.name}</Link>) : <p className="text-xs">No owned outfit has both the original A style and this scenario unlocked.</p>}
    </div> : orphan && <div className="space-y-3"><h2 className="text-xl">Unknown saved item</h2><p className="break-all">{orphan}</p><p>{stocks[orphan]} in global inventory</p><p>This future or missing definition is preserved. It cannot be spent or exchanged until verified.</p></div>}</BottomSheet>
  </section>
}
