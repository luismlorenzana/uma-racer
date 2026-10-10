// Named meal map, canonical racing stats and explicitly separate pending previews (Farm design §§9–10).
import { DISTANCE_CATEGORIES, SCENARIOS, STATS, capProfile, deriveUma, zeroStats, type CardSave, type DistanceCategory, type Stats, type UmaSave } from '@racer/domain'
import { FARM_EXTRA_NODES, FARM_KITCHEN_CATALOGUE, farmExtraCapacity, farmExtraVector, farmIngredientBlock, farmMealId, previewFarmStats,
  type FarmExtraNode, type FarmExtraBlock } from '@racer/domain/farm/kitchen'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { useStore } from 'zustand'
import type { LoadedContent } from '../../content/runtime'
import type { RacerDb } from '../../game/db'
import type { FarmKitchenHost, FarmMutation } from '../../game/farm/kitchen/host'
import { createFarmKitchenStore, observeFarmKitchen } from '../../game/farm/kitchen/store'
import type { FarmKitchenView } from '../../game/farm/kitchen/view'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { Panel } from '../../ui/Panel'
import { ScreenState } from '../../ui/ScreenState'
import { FarmFoodMark } from '../../ui/farm/FarmKitchenMarks'
import { TypeIcon, typeLabel } from '../../ui/TypeIcon'
import { RpgModalFocus } from '../../ui/rpg/RpgModalFocus'

export interface FarmExtraScreenProps {
  database: RacerDb; host: FarmKitchenHost; content: LoadedContent; uma: UmaSave; cards: Readonly<Record<string, CardSave>>
  tier: number; farmRoot: string; back: string; renderRaceProof?: (map: FarmExtraBlock) => ReactNode
}
const takeVector = (ids: string[]): Stats => { const r = farmExtraVector(ids); if (!r.ok) throw new Error(r.error.detail); return r.value }
const total = (stats: Stats) => STATS.reduce((n, stat) => n + stats[stat], 0)
const label = (value: string) => value[0]!.toUpperCase() + value.slice(1)
const groups = [...STATS, 'dual', 'sun'] as const
type Group = (typeof groups)[number] | 'all'

/** Families, not prerequisite paths. Every unordered stat pair has its own bridge in the named list. */
function FarmNodeMap({ onGroup }: { onGroup: (group: Group) => void }) {
  const positions = [[170, 35], [275, 90], [240, 190], [100, 190], [65, 90]] as const
  return <div className="relative mx-auto h-60 max-w-[340px] rounded-lg bg-stage text-white" aria-label="Five clusters, ten pair families and central Suns">
    <svg viewBox="0 0 340 240" className="absolute h-full w-full" aria-hidden="true">
      {positions.flatMap(([x, y], i) => positions.slice(i + 1).map(([endX, endY], j) =>
        <line key={`pair-${i}-${j}`} x1={x} y1={y} x2={endX} y2={endY} stroke="#A8B6C6" opacity={0.3} strokeDasharray="3 5" />))}
      {positions.map(([x, y], i) => <line key={i} x1="170" y1="115" x2={x} y2={y} stroke="#A8B6C6" strokeDasharray="3 5" />)}
    </svg>
    {STATS.map((stat, i) => <button key={stat} onClick={() => onGroup(stat)} className="absolute flex h-14 w-14 flex-col items-center justify-center rounded-full border border-white/30 bg-stage text-[10px]"
      style={{ left: `${positions[i]![0] / 340 * 100}%`, top: `${positions[i]![1] / 240 * 100}%`, transform: 'translate(-50%, -50%)' }} aria-label={`Show ${typeLabel(stat)} cluster`}>
      <TypeIcon type={stat} size={22} />{typeLabel(stat)}
    </button>)}
    <button onClick={() => onGroup('sun')} className="absolute left-1/2 top-[48%] h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent bg-stage text-xs font-bold text-accent">Suns</button>
    <button onClick={() => onGroup('dual')} className="absolute right-2 bottom-1 min-h-11 px-2 text-[11px] font-bold">Pair bridges</button>
  </div>
}

export function FarmExtraStatsScreen(props: FarmExtraScreenProps) {
  const { database, host, content, uma, tier, farmRoot, back } = props
  const scenario = SCENARIOS.find(s => s.tier === tier)!, block = farmIngredientBlock(tier), capacity = farmExtraCapacity(tier)
  const [params, setParams] = useSearchParams(), location = useLocation()
  const queryDistance = params.get('distance'), distance = DISTANCE_CATEGORIES.includes(queryDistance as DistanceCategory) ? queryDistance as DistanceCategory : uma.activePreset
  const [mode, setMode] = useState<'map' | 'list'>('map'), [group, setGroup] = useState<Group>('all'), [search, setSearch] = useState('')
  const [detail, setDetail] = useState<{ node: FarmExtraNode; confirmed: FarmKitchenView } | null>(null)
  const [autoactivate, setAutoactivate] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null)
  const [last, setLast] = useState<FarmMutation | null>(null)
  const store = useMemo(createFarmKitchenStore, [database, host, uma.templateId, scenario.id])
  useEffect(() => observeFarmKitchen(host, database, store, { outfitId: uma.templateId, scenarioId: scenario.id }), [host, database, store, uma.templateId, scenario.id])
  const state = useStore(store), view = state.view
  useEffect(() => {
    if (!last || last.status !== 'pending') return
    let live = true
    void host.read({ outfitId: uma.templateId, scenarioId: scenario.id, operationIds: [last.operationId] }).then(v => {
      if (!live) return
      const receipt = v.receipts[last.operationId], pending = v.pending.find(p => p.id === last.operationId)
      if (receipt) { setLast({ ...last, status: 'applied', receipt }); setMessage(receipt.result.kind === 'buy-node' ? `${receipt.result.nodeName} bought${receipt.result.activated ? ' and active' : ' · idle'}` : 'Build saved · races use these nodes') }
      else if (pending && pending.status !== 'pending') { setLast({ ...last, status: pending.status, reason: pending.reason }); setMessage(pending.reason ?? 'Map change needs attention') }
    }).catch(error => { if (live) setMessage(String(error)) })
    return () => { live = false }
  }, [host, last?.operationId, last?.status, view?.revision.pending, uma.templateId, scenario.id])
  const base = useMemo(() => deriveUma({ uma, tier, preset: distance, umaTemplate: content.umas.byId.get(uma.templateId)!,
    cardSaves: new Map(Object.entries(props.cards)), cardTemplates: content.cards.byId, umaTemplates: content.umas.byId,
    skillTemplates: content.skills.byId, farmStats: zeroStats() }), [uma, tier, distance, content, props.cards])
  if (!view || state.status === 'loading') return <ScreenState title="Opening meal map…" detail="Reading this outfit’s acknowledged build." />
  if (state.status === 'error' || view.mode !== 'active' || !view.extra) return <ScreenState title="Farm map needs recovery" detail={state.error ?? view.message ?? 'Keep the save and export Farm recovery.'} action={{ label: 'Open Farm', to: farmRoot }} />
  const map = view.extra.canonical, projected = view.extra.projected
  const active = map.activeByScenario[scenario.id]?.[distance] ?? [], previewActive = projected.activeByScenario[scenario.id]?.[distance] ?? []
  const vector = takeVector(active), pendingVector = takeVector(previewActive), before = base.farmSources!.baseAndCards, caps = capProfile(tier)
  const r = previewFarmStats(before, vector, caps), p = previewFarmStats(before, pendingVector, caps)
  if (!r.ok || !p.ok) return <ScreenState title="Stat preview needs recovery" detail="No purchases were changed." />
  const blocked = busy || view.extra.pending || !state.controlsReady
  const open = (node: FarmExtraNode) => { setDetail({ node, confirmed: view }); setAutoactivate(active.length < capacity); setMessage(null) }
  const change = async (kind: 'buy' | 'toggle') => {
    if (!detail || blocked) return
    setBusy(true); setMessage(null)
    try {
      const intentId = await host.createIntent(), fields = { intentId, expectedRevision: detail.confirmed.revision, outfitId: uma.templateId, scenarioId: scenario.id, distance }
      const result = kind === 'buy' ? await host.buyNode({ ...fields, nodeId: detail.node.id, autoactivate })
        : await host.setActive({ ...fields, nodeIds: active.includes(detail.node.id) ? active.filter(id => id !== detail.node.id) : [...active, detail.node.id] })
      setLast(result); setMessage(result.status === 'pending' ? 'Saved' : result.reason ?? 'Build saved')
      setDetail(null)
    } catch (error) {
      setMessage(`${error instanceof Error ? error.message : String(error)}. Review and confirm again.`)
      try {
        const current = await host.read({ outfitId: uma.templateId, scenarioId: scenario.id })
        setDetail(old => old ? { ...old, confirmed: current } : null)
        setAutoactivate((current.extra?.canonical.activeByScenario[scenario.id]?.[distance].length ?? 0) < capacity)
      } catch {
        setDetail(null) // Keep the recovery message; never submit again against an unreadable revision.
      }
    } finally { setBusy(false) }
  }
  const shown = FARM_EXTRA_NODES.filter(node => (group === 'all' || node.kind === group || node.kind === 'pure' && node.signature === group) && node.name.toLowerCase().includes(search.toLowerCase()))
  const nodeButton = (node: FarmExtraNode) => {
    const bought = map.boughtNodeIds.includes(node.id), on = active.includes(node.id)
    return <button key={node.id} type="button" onClick={() => open(node)} aria-label={`${node.name}, ${on ? 'Active' : bought ? 'Bought, idle' : 'Not bought'}`} className={`flex min-h-11 items-center gap-2 rounded-sm border p-2 text-left ${on ? 'border-accent bg-accent-wash' : 'border-hairline bg-panel'}`}>
      <span className="flex shrink-0">{STATS.filter(stat => node.stats[stat]).map(stat => <TypeIcon key={stat} type={stat} size={16} />)}</span><span className="min-w-0 flex-1"><strong className="block text-[11px]">{node.name}</strong><span className="block text-[10px] text-ink-soft">{on ? 'Active' : bought ? 'Bought · idle' : '1 meal'} · {STATS.filter(stat => node.stats[stat]).map(stat => `+${node.stats[stat]} ${typeLabel(stat)}`).join(' · ')}</span></span>
    </button>
  }
  const node = detail?.node, bought = !!node && map.boughtNodeIds.includes(node.id), on = !!node && active.includes(node.id)
  const meal = node ? FARM_KITCHEN_CATALOGUE.foodsById.get(farmMealId(block, node.signature))! : null
  const stock = meal ? view.items[meal.id]?.canonical ?? 0 : 0, reserved = meal ? view.items[meal.id]?.reserved ?? 0 : 0
  const hypothetical = node ? on ? active.filter(id => id !== node.id) : [...active, node.id] : active
  const h = previewFarmStats(before, takeVector(hypothetical), caps)
  const returnTo = `${location.pathname}?distance=${distance}`, recipeLink = meal ? `${farmRoot}/recipes?block=${block}&recipe=${encodeURIComponent(meal.id)}&returnTo=${encodeURIComponent(returnTo)}` : farmRoot
  return <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-safe text-ink">
    <Link to={back} className="flex min-h-11 items-center text-sm font-semibold text-accent-strong">Back to Training</Link>
    <h2 className="font-display text-xl font-bold">{content.umas.byId.get(uma.templateId)?.name} · meal map</h2>
    <p className="text-[12px] text-ink-soft">{scenario.name} · {label(distance)} · Block {block} (scenarios {(block - 1) * 5 + 1}–{Math.min(block * 5, SCENARIOS.length)})</p>
    <div role="tablist" aria-label="Distance build" className="my-2 grid grid-cols-4 gap-1">{DISTANCE_CATEGORIES.map(d => <button key={d} type="button" role="tab" aria-selected={distance === d} disabled={busy} className={`min-h-11 rounded-sm text-[12px] font-semibold ${d === distance ? 'bg-accent-wash text-accent-strong' : 'bg-sunken'}`} onClick={() => { setDetail(null); setParams(next => { next.set('distance', d); return next }, { replace: true }) }}>{label(d)}</button>)}</div>
    <Panel className="p-3"><p className="text-[12px] font-semibold">Bought {map.boughtNodeIds.length}/65 · Active {active.length}/{capacity}</p><p className="mt-1 text-[11px] text-ink-soft">Farm +{total(vector)} flat · +{total(r.value.marginal)} after caps · {total(r.value.farmWaste)} wasted</p>
      <div className="mt-2 grid grid-cols-5 gap-1">{STATS.map(stat => <div key={stat} className="text-center"><TypeIcon type={stat} size={20} /><strong className="block text-[13px]">{r.value.stats[stat]}</strong><span className="block text-[9px] text-ink-soft">Farm +{vector[stat]}</span></div>)}</div>
      <details className="mt-2 text-[11px]"><summary className="flex min-h-11 cursor-pointer items-center">Base/cards, growth and cap breakdown</summary>{STATS.map(stat => <p key={stat}>{typeLabel(stat)}: {before[stat].toFixed(1)} + {vector[stat]} = {r.value.beforeCap[stat].toFixed(1)} → {r.value.stats[stat]} (cap {caps[stat]})</p>)}</details>
      {view.extra.pending && <p role="status" className="mt-2 text-[12px] text-warning">Pending preview · {previewActive.length}/{capacity} active · +{total(pendingVector)} flat. These bonuses are not race-ready.</p>}
    </Panel>
    {message && <p role="status" className="my-2 rounded-sm bg-sunken p-2 text-[12px]">{message}</p>}
    {last && (last.status === 'rejected' || last.status === 'blocked') && <Link to={`${farmRoot}/retry`} className="flex min-h-11 items-center text-accent-strong">Review pending/rejected operation</Link>}
    {props.renderRaceProof?.(map)}
    <div className="my-2 grid grid-cols-2 gap-2">{(['map', 'list'] as const).map(value => <button key={value} className="min-h-11 rounded-sm bg-sunken text-sm font-semibold" aria-pressed={mode === value} onClick={() => setMode(value)}>{label(value)}</button>)}</div>
    {mode === 'map' && <FarmNodeMap onGroup={setGroup} />}
    <p className="my-2 text-[11px] text-ink-soft">Any node can be bought first. Lines identify meal families, never prerequisites.</p>
    <label className="block text-[12px] font-semibold">Find a node<input type="search" value={search} onChange={e => setSearch(e.target.value)} className="mt-1 min-h-11 w-full rounded-sm border border-hairline bg-panel px-3" /></label>
    <div className="my-2 flex gap-1 overflow-x-auto" aria-label="Node groups">{(['all', ...groups] as const).map(g => <button key={g} onClick={() => setGroup(g)} aria-pressed={group === g} className={`min-h-11 shrink-0 rounded-sm px-3 text-xs ${g === group ? 'bg-accent-wash' : 'bg-sunken'}`}>{g === 'dual' ? 'Pairs' : label(g)}</button>)}</div>
    {groups.map(g => { const nodes = shown.filter(n => n.kind === g || n.kind === 'pure' && n.signature === g); return nodes.length ? <section key={g} className="my-3" aria-label={`${label(g)} nodes`}><h3 className="mb-2 font-display font-semibold">{g === 'dual' ? 'Pair bridges' : g === 'sun' ? 'Central Suns' : `${typeLabel(g)} cluster`}</h3><div className="grid gap-1.5">{nodes.map(nodeButton)}</div></section> : null })}
    {!shown.length && <p className="py-4 text-sm">No nodes match. Try another name or group.</p>}
    {detail && node && meal && <RpgModalFocus onClose={() => { if (!busy) setDetail(null) }}><BottomSheet open label={`${node.name} details`} onClose={() => { if (!busy) setDetail(null) }}><div className="p-4"><h2 className="font-display text-xl font-bold">{node.name}</h2><p className="mt-1 text-sm">{on ? 'Active' : bought ? 'Bought · idle' : 'Not bought'} · {label(distance)} · {scenario.name}</p><p className="mt-2 text-sm">{STATS.filter(stat => node.stats[stat]).map(stat => `+${node.stats[stat]} ${typeLabel(stat)}`).join(' · ')}</p>
      <p className="mt-2 text-[12px]">{h.ok ? STATS.filter(stat => node.stats[stat]).map(stat => `${typeLabel(stat)} ${h.value.stats[stat] - r.value.stats[stat] >= 0 ? '+' : ''}${h.value.stats[stat] - r.value.stats[stat]} after cap`).join(' · ') : 'Preview unavailable'}{!on && h.ok ? ` · ${total(h.value.farmWaste) - total(r.value.farmWaste)} points wasted` : ''}</p>
      {!bought && <><div className="my-3 flex items-center gap-2"><FarmFoodMark food={meal} size={42} /><p className="text-[12px]">Costs 1 {meal.name} · Block {block}<br />Stock {stock} · Reserved {reserved} · After purchase {Math.max(0, stock - reserved - 1)}</p></div><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={autoactivate} disabled={active.length >= capacity || blocked} onChange={e => setAutoactivate(e.target.checked)} />Activate in this build after purchase</label>{active.length >= capacity && <p className="text-[12px] text-ink-soft">Capacity full. Purchase stays idle; turn a node off to activate it.</p>}<Link to={recipeLink} className="my-2 flex min-h-11 items-center text-sm font-semibold text-accent-strong">{stock - reserved < 1 ? 'Get this meal · recipe & wishlist' : 'View matching recipe'}</Link><Button className="w-full" disabled={blocked || stock - reserved < 1} onClick={() => { void change('buy') }}>Buy for 1 meal{autoactivate && active.length < capacity ? ' & activate' : ' · idle'}</Button></>}
      {bought && <><p className="mt-3 text-[12px]">Already bought with 1 {meal.name} · Block {block}<br />Meal stock {stock} · Reserved {reserved}</p><Link to={recipeLink} className="flex min-h-11 items-center text-sm font-semibold text-accent-strong">View matching recipe</Link><Button className="w-full" disabled={blocked || !on && active.length >= capacity} onClick={() => { void change('toggle') }}>{on ? 'Turn off · free' : active.length >= capacity ? 'Capacity full · turn one off first' : 'Activate · free'}</Button></>}
      <p className="mt-2 text-[11px] text-ink-soft">Purchases are permanent and shared by this outfit’s block. Activations change only this scenario and distance.</p>{message && <p role="alert" className="mt-2 text-[12px] text-danger">{message}</p>}</div></BottomSheet></RpgModalFocus>}
  </div>
}
