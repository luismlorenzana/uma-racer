// Global Item inventory, first surfaced inside Stable Farm (docs/design/farm.md#global-item-inventory, T085).

import { SCENARIOS, STATS, TRAINING_EXP_PER_LEVEL, TRAINING_LEVEL_UP_TICKET_ID, scenarioForTier, inspirationToken, inspirationTokenId, inspirationTokenName, type StatKey } from '@racer/domain'
import { FARM_CROPS } from '@racer/domain/farm'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { buildItemInventory, produceItemDefinitions, resolveItemLink } from '../../game/items/view'
import {
  loadItemInventoryPreferences,
  saveItemInventoryPreferences,
  type ItemInventoryDensity,
  type ItemInventoryPreferences,
} from '../../game/items/preferences'
import { BottomSheet } from '../../ui/BottomSheet'
import { Crest } from '../../ui/Crest'
import { Panel } from '../../ui/Panel'
import { SegmentedControl } from '../../ui/SegmentedControl'
import { TypeIcon } from '../../ui/TypeIcon'
import { CropMark } from '../../ui/farm/CropMark'
import { ViewGridIcon, ViewListIcon } from '../../ui/icons'
import { useGame } from '../../game/store'
import { Meter } from '../../ui/Meter'
import { LevelUpIcon } from '../../ui/icons'
import { useFarmScreen } from './FarmScreen'
import { InspirationTokenIcon } from '../../ui/InspirationTokenIcon'

const DEFAULTS: ItemInventoryPreferences = {
  visibility: 'owned', stat: null, scenarioTier: null, density: 'comfortable',
}
const DEFINITIONS = produceItemDefinitions(FARM_CROPS)

function ItemTile({ item, density, open }: {
  item: ReturnType<typeof buildItemInventory<typeof DEFINITIONS[number]>>['items'][number]
  density: ItemInventoryDensity
  open: () => void
}) {
  const crop = item.definition?.crop
  if (!crop) return <Panel className="p-3" aria-label={`Unknown saved item, quantity ${item.quantity}`}>
    <p className="text-[13px] font-semibold">Unknown saved item</p>
    <p className="text-[11px] text-ink-soft">Quantity {item.quantity} · preserved as a diagnostic</p>
  </Panel>
  const label = `${crop.name}, ${crop.stat}, ${scenarioForTier(crop.scenarioTier)?.name ?? `scenario ${crop.scenarioTier}`}, quantity ${item.quantity}`
  return <button type="button" onClick={open} aria-label={label} className={`rounded-md border border-hairline bg-panel text-left shadow-1 ${density === 'compact' ? 'flex min-h-16 items-center gap-3 p-2' : 'min-h-40 p-3'}`}>
    <span className={density === 'compact' ? '' : 'flex items-start justify-between'}>
      <span className={item.quantity === 0 ? 'opacity-35 grayscale' : ''}><CropMark crop={crop} size={density === 'compact' ? 44 : 58} /></span>
      <Crest tone={item.quantity > 0 ? 'accent' : 'neutral'}>×{item.quantity}</Crest>
    </span>
    <span className={density === 'compact' ? 'min-w-0 flex-1' : 'mt-2 block'}>
      <span className="block truncate text-[14px] font-semibold">{crop.name}</span>
      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-soft"><TypeIcon type={crop.stat} size={16} />{crop.stat}</span>
      <span className="mt-0.5 block truncate text-[10px] text-ink-faint">T{crop.scenarioTier} · {scenarioForTier(crop.scenarioTier)?.name}</span>
    </span>
  </button>
}

export function ItemInventoryScreen() {
  const farm = useFarmScreen()
  const umas = useGame(s => s.umas)
  const [searchParams, setSearchParams] = useSearchParams()
  const [preferences, setPreferences] = useState<ItemInventoryPreferences>(DEFAULTS)
  const [loadedPreferences, setLoadedPreferences] = useState(false)
  useEffect(() => {
    let active = true
    void loadItemInventoryPreferences().then((loaded) => {
      if (active) { setPreferences(loaded); setLoadedPreferences(true) }
    })
    return () => { active = false }
  }, [])
  const update = (next: ItemInventoryPreferences) => {
    setPreferences(next)
    if (loadedPreferences) void saveItemInventoryPreferences(next)
  }
  // Training items have their own section; the grid below is the produce catalog.
  const stacks = useMemo(() => Object.entries(farm.view.inventory)
    .filter(([itemId]) => itemId !== TRAINING_LEVEL_UP_TICKET_ID && !inspirationToken(itemId))
    .map(([itemId, quantity]) => ({ itemId, quantity, updatedAt: 0 })), [farm.view.inventory])
  const levelUpTickets = farm.view.inventory[TRAINING_LEVEL_UP_TICKET_ID] ?? 0
  const ownedStacks = Object.values(farm.view.inventory).filter(q => q > 0)
  const trainingExpBank = useGame((state) => state.profile?.trainingExpBank ?? 0)
  const inventory = useMemo(() => buildItemInventory(DEFINITIONS, stacks, {
    visibility: preferences.visibility,
    facets: { stat: preferences.stat, scenario: preferences.scenarioTier === null ? null : String(preferences.scenarioTier) },
  }), [preferences.scenarioTier, preferences.stat, preferences.visibility, stacks])
  const itemParam = searchParams.get('item')
  const token = itemParam ? inspirationToken(itemParam) : null
  const link = resolveItemLink(itemParam, DEFINITIONS)
  const selected = link.status === 'ready' ? link.definition.crop : null
  const invalidLink = link.status === 'invalid' && !token
  const selectedQuantity = selected ? farm.view.inventory[selected.id] ?? 0 : 0
  const closeDetail = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('item')
    setSearchParams(next, { replace: true })
  }
  const openDetail = (itemId: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('item', itemId)
    setSearchParams(next, { replace: true })
  }

  return <div className="pb-4">
    <div className="mb-3 px-1">
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-lg font-bold">Global Items</h2><p className="text-[12px] text-ink-soft">{ownedStacks.length} owned kinds · {ownedStacks.reduce((sum, q) => sum + q, 0)} items</p></div><Crest>{inventory.catalogTotal} crops</Crest></div>
      {inventory.orphanedStacks > 0 && <p className="mt-2 rounded-sm bg-warning/10 p-2 text-[11px] text-warning">{inventory.orphanedStacks} future or missing item stack{inventory.orphanedStacks === 1 ? '' : 's'} preserved.</p>}
    </div>

    <Panel className="mb-3" aria-label={`Training Level-Up Tickets, ${levelUpTickets} owned; Training EXP bank ${trainingExpBank} of ${TRAINING_EXP_PER_LEVEL}`}>
      <p className="text-micro">Training</p>
      <div className="mt-2 flex items-center gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-accent/15 text-accent-strong ${levelUpTickets === 0 ? 'opacity-45' : ''}`}><LevelUpIcon size={24} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold">Training Level-Up Ticket</p>
          <p className="text-[11px] text-ink-soft">One Training Level for the Uma you train. Earned from EXP past TL10.</p>
        </div>
        <Crest tone={levelUpTickets > 0 ? 'accent' : 'neutral'}>×{levelUpTickets}</Crest>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-ink-soft"><span>Training EXP bank</span><span className="font-semibold text-ink">{trainingExpBank.toLocaleString()} / {TRAINING_EXP_PER_LEVEL.toLocaleString()}</span></div>
      <div className="mt-1"><Meter value={trainingExpBank / TRAINING_EXP_PER_LEVEL} color="var(--color-accent)" /></div>
    </Panel>

    <SegmentedControl label="Item visibility" value={preferences.visibility} onChange={(visibility) => update({ ...preferences, visibility })} options={[
      { value: 'owned', label: 'Owned' }, { value: 'all', label: 'All items' },
    ]} />
    <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
      <label className="text-[10px] font-semibold text-ink-soft">Scenario<select aria-label="Destination scenario" value={preferences.scenarioTier ?? 'all'} onChange={(event) => update({ ...preferences, scenarioTier: event.target.value === 'all' ? null : Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-sm border border-hairline-strong bg-panel px-2 text-[12px] text-ink"><option value="all">All</option>{SCENARIOS.map((scenario) => <option key={scenario.tier} value={scenario.tier}>{scenario.tier} · {scenario.name}</option>)}</select></label>
      <label className="text-[10px] font-semibold text-ink-soft">Stat<select aria-label="Produce stat" value={preferences.stat ?? 'all'} onChange={(event) => update({ ...preferences, stat: event.target.value === 'all' ? null : event.target.value as StatKey })} className="mt-1 min-h-11 w-full rounded-sm border border-hairline-strong bg-panel px-2 text-[12px] text-ink"><option value="all">All</option>{STATS.map((stat) => <option key={stat} value={stat}>{stat}</option>)}</select></label>
      <button type="button" aria-label={preferences.density === 'comfortable' ? 'Use compact list' : 'Use comfortable grid'} onClick={() => update({ ...preferences, density: preferences.density === 'comfortable' ? 'compact' : 'comfortable' })} className="mt-4 flex h-11 w-11 items-center justify-center rounded-sm border border-hairline-strong bg-panel">
        {preferences.density === 'comfortable' ? <ViewListIcon size={20} /> : <ViewGridIcon size={20} />}
      </button>
    </div>
    <p role="status" className="mt-2 px-1 text-[11px] text-ink-soft">Produce: showing {inventory.items.length} of {preferences.visibility === 'owned' ? inventory.ownedUnique : inventory.catalogTotal + inventory.orphanedStacks}</p>
    <section className="mt-3 space-y-2" aria-label="Inspiration tokens"><h3 className="font-display text-lg">Inspiration</h3><p className="text-xs text-ink-soft">RPG regular battles earn skill tokens; bosses earn slot tokens. Each opens one position for one Uma in its scenario.</p>
      {SCENARIOS.filter(s => preferences.scenarioTier === null || s.tier === preferences.scenarioTier).flatMap(s => (['slot', 'skill'] as const).map(kind => ({ tier: s.tier, kind, id: inspirationTokenId(s.tier, kind) })))
        .filter(t => preferences.visibility === 'all' || (farm.view.inventory[t.id] ?? 0) > 0).map(t => <button key={t.id} onClick={() => openDetail(t.id)} className="flex min-h-16 w-full items-center gap-3 rounded-md border border-hairline bg-panel p-3 text-left"><InspirationTokenIcon kind={t.kind} /><span className="min-w-0 flex-1 text-sm font-semibold">{inspirationTokenName(t.tier, t.kind)}</span><Crest>×{farm.view.inventory[t.id] ?? 0}</Crest></button>)}
    </section>

    {invalidLink && <Panel className="mt-3 border-warning/40 bg-warning/10"><p className="text-[13px] font-semibold">Item link unavailable</p><p className="mt-1 text-[11px] text-ink-soft">This item id is unsafe, unknown, or no longer in the catalog. Saved stacks remain untouched.</p><button type="button" onClick={closeDetail} className="mt-2 min-h-11 font-semibold text-accent-strong">Clear item link</button></Panel>}
    {inventory.items.length === 0 ? <Panel className="mt-3 text-center"><p className="font-semibold">No produce here yet</p><p className="mt-1 text-[12px] text-ink-soft">Harvest a ready crop, or choose All items to browse the catalog.</p></Panel>
      : <div className={`mt-3 grid gap-2 ${preferences.density === 'comfortable' ? 'grid-cols-2' : 'grid-cols-1'}`}>{inventory.items.map((item) => <ItemTile key={item.itemId} item={item} density={preferences.density} open={() => { if (item.definition) openDetail(item.itemId) }} />)}</div>}

    <BottomSheet open={token !== null} onClose={closeDetail}>{token && <div className="space-y-3 pb-safe"><InspirationTokenIcon kind={token.kind} size={64} /><h2 className="font-display text-xl">{inspirationTokenName(token.tier, token.kind)}</h2><p className="font-semibold">{farm.view.inventory[itemParam!] ?? 0} in global inventory</p><p className="text-sm text-ink-soft">{token.kind === 'slot' ? 'Earned from an accepted RPG boss clear. Opens one parent or grandparent slot and its inherited unique.' : 'Earned from accepted RPG regular/elite battles. Opens one natural-gold position on a filled lineage slot; equipping still uses SP.'} Choose a trained Uma:</p>{Object.values(umas).filter(u => u.scenarios.some(r => r.tier === token.tier)).map(u => <Link key={u.templateId} to={`/constellation/${u.templateId}/inspiration?tier=${token.tier}`} className="flex min-h-11 items-center rounded-sm bg-sunken px-3 font-semibold text-accent-strong">{farm.templates.get(u.templateId)?.name ?? 'Owned Uma'}</Link>)}</div>}</BottomSheet>
    <BottomSheet open={selected !== null} onClose={closeDetail}>
      {selected && <div>
        <div className="flex items-center gap-3"><CropMark crop={selected} size={64} /><div><p className="text-micro">Global Item · Produce</p><h2 className="font-display text-xl font-bold">{selected.name}</h2><p className="flex items-center gap-1 text-[12px] text-ink-soft"><TypeIcon type={selected.stat} size={18} />{selected.stat} · T{selected.scenarioTier} {scenarioForTier(selected.scenarioTier)?.name}</p></div></div>
        <div className="mt-4 rounded-md bg-sunken p-4 text-center"><p className="text-micro">In inventory</p><p className="font-display text-3xl font-bold">{selectedQuantity}</p></div>
        <dl className="mt-3 grid gap-2 rounded-sm border border-hairline p-3 text-[13px]"><div className="flex justify-between gap-3"><dt className="text-ink-soft">Source</dt><dd className="font-semibold">Stable Farm</dd></div><div className="flex justify-between gap-3"><dt className="text-ink-soft">Growth time</dt><dd className="font-semibold">12 hours</dd></div><div className="flex justify-between gap-3"><dt className="text-ink-soft">Future use</dt><dd className="text-right font-semibold">Scenario {selected.scenarioTier} Produce node</dd></div></dl>
        <p className="mt-3 rounded-sm bg-warning/10 p-3 text-[12px] text-ink-soft">Produce nodes are not available yet. This item is safely stored until that later update.</p>
      </div>}
    </BottomSheet>
  </div>
}
