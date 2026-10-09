// Global material views on the campaign shell; no screen writes Dexie (Uma Puzzles §§7–9).
import { SCENARIOS, STRATEGIES, TRAINING_LEVEL_UP_TICKET_ID, puzzleMaterialId, parsePuzzleMaterialId } from '@racer/domain'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { exchangeBatch } from '../../game/items/cl'
import type { PuzzleHost, PuzzleMaterialPreview } from '../../game/puzzles/host'
import { ConstellationMaterials } from '../../ui/ConstellationMaterials'
import { ConstellationTicketIcon, TICKET_STYLE_NAME } from '../../ui/ConstellationTicketIcon'
import { LevelUpIcon } from '../../ui/icons'
import { ClSpendSheet, MaterialOperationStatus } from '../../ui/puzzles/ClSpendSheet'
import { PuzzleButton, PuzzleCard, PuzzleOptions } from '../../ui/puzzles/components'
import { PuzzleFrame, usePuzzleAccount, usePuzzles } from './PuzzleContext'

export function PuzzleItemsScreen() {
  const { host, root, content, state } = usePuzzles(), account = usePuzzleAccount()
  const [visibility, setVisibility] = useState<'owned' | 'all'>('owned'), [scenario, setScenario] = useState('all'), [spend, setSpend] = useState<{ id: string; tier: number } | null>(null)
  return <PuzzleFrame title="Global Items" back={root}>{account && <>
    <div className="grid gap-2"><PuzzleOptions<'owned' | 'all'> label="Item visibility" value={visibility} onChange={setVisibility} options={[{ value: 'owned', label: 'Owned' }, { value: 'all', label: 'All items' }]} /><PuzzleOptions label="Destination scenario" value={scenario} onChange={setScenario} options={[{ value: 'all', label: 'All scenarios' }, ...SCENARIOS.map(s => ({ value: String(s.tier), label: s.name }))]} /></div>
    <PuzzleCard className="mt-3"><div className="flex items-center gap-2"><LevelUpIcon size={32} /><span className="text-sm">Legacy Universal CL Ticket · ×{account.stocks[TRAINING_LEVEL_UP_TICKET_ID] ?? 0}</span></div><p className="mt-2 text-xs text-ink-on-dark-soft">Preserved stock can raise any eligible outfit’s unlocked scenario. No new universal tickets are minted by this mode.</p></PuzzleCard>
    <ConstellationMaterials stocks={account.stocks} bank={account.bank} visibility={visibility} scenarioTier={scenario === 'all' ? null : Number(scenario)} itemsTo={`${root}/items`} exchangeTo={`${root}/exchange`}
      stylePicker={(style, onChange) => <PuzzleOptions label="Ticket source style" value={style ?? 'all'} options={[{ value: 'all', label: 'All styles' }, ...STRATEGIES.map(s => ({ value: s, label: TICKET_STYLE_NAME[s] }))]} onChange={s => onChange(s === 'all' ? null : s as typeof style)} />} recipients={id => {
      const material = parsePuzzleMaterialId(id), tier = SCENARIOS.find(s => s.id === material?.scenarioId)?.tier
      if (!material || !tier) return []
      return account.umas.filter(u => u.scenarios.some(s => s.tier === tier) && content.umas.byId.get(u.templateId)?.aptitudes.strategy[material.style] === 'A').map(u => ({ id: u.templateId, name: content.umas.byId.get(u.templateId)?.name ?? u.templateId,
        href: `/constellation/${encodeURIComponent(u.templateId)}?tier=${tier}`, select: () => setSpend({ id: u.templateId, tier }) }))
    }} />
    {account.materialOperations.filter(o => o.status !== 'accepted').map(o => <MaterialOperationStatus key={o.id} account={account} id={o.id} />)}
    {!root.startsWith('/dev/') && <Link to="/farm/items" className="mt-3 flex min-h-11 items-center justify-center rounded-sm border border-hairline-dark">Produce and Inspiration in Global Items</Link>}
    {spend && <ClSpendSheet host={host} account={account} outfitId={spend.id} tier={spend.tier} onClose={() => setSpend(null)} refresh={async () => state.publish(await host.account())} />}
  </>}</PuzzleFrame>
}
type ExchangePreview = PuzzleMaterialPreview & { exchange: Awaited<ReturnType<PuzzleHost['previewExchange']>>['exchange'] }
export function PuzzleExchangeScreen() {
  const { host, root, state } = usePuzzles(), account = usePuzzleAccount(), [params] = useSearchParams(), initial = parsePuzzleMaterialId(params.get('from'))
  const [edge, setEdge] = useState(String(Math.max(0, SCENARIOS.findIndex(s => s.id === initial?.scenarioId) - 1)))
  const [style, setStyle] = useState(initial?.style ?? 'front'), [direction, setDirection] = useState(initial?.scenarioId === SCENARIOS[Number(edge) + 1]?.id ? 'down' : 'up'), [batch, setBatch] = useState('1')
  const [preview, setPreview] = useState<ExchangePreview | null>(null), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), [ack, setAck] = useState(false), [stale, setStale] = useState(false)
  const [saved, setSaved] = useState<{ id: string; exchange: ExchangePreview['exchange'] } | null>(null)
  const inFlight = useRef(false), operation = useRef<{ confirmation: string; id: string } | null>(null)
  const low = SCENARIOS[Number(edge)]!, high = SCENARIOS[Number(edge) + 1]!, down = direction === 'down', quantity = exchangeBatch(batch, down)
  const from = puzzleMaterialId(down ? high.id : low.id, style), to = puzzleMaterialId(down ? low.id : high.id, style)
  const unlocked = account?.bank?.openingClears.includes(high.id) ?? false
  const request = async () => {
    setPreview(null); setAck(false); setStale(false); setError(null); operation.current = null; setSaved(null)
    if (quantity !== null && unlocked) try { setPreview(await host.previewExchange(from, to, quantity)) } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }
  useEffect(() => { let active = true; setPreview(null); setAck(false); setStale(false); setError(null); setSaved(null); operation.current = null
    if (quantity !== null && unlocked) void host.previewExchange(from, to, quantity).then(p => { if (active) setPreview(p) }).catch(e => { if (active) setError(e instanceof Error ? e.message : String(e)) })
    return () => { active = false }
  }, [host, from, to, quantity, unlocked])
  const changed = preview !== null && (preview.revision !== account?.bank?.revision || JSON.stringify(preview.stocks) !== JSON.stringify(account?.stocks))
  const confirm = async () => {
    if (!preview || inFlight.current || stale || (changed && !operation.current) || (preview.exchange.irreversible && !ack)) return
    inFlight.current = true; setBusy(true); setError(null)
    operation.current = operation.current?.confirmation === preview.confirmation ? operation.current : { confirmation: preview.confirmation, id: crypto.randomUUID() }
    try { const receipt = await host.confirmMaterial(preview, operation.current.id); if (receipt.exchange) setSaved({ id: operation.current.id, exchange: receipt.exchange }); state.publish(await host.account()) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); setStale(e instanceof Error && /changed|stale|reused|review/i.test(e.message)); state.publish(await host.account()) }
    finally { setBusy(false); inFlight.current = false }
  }
  const output = saved?.exchange ?? preview?.exchange
  const rejected = account?.materialOperations.some(o => o.id === saved?.id && (o.status === 'rejected' || o.status === 'blocked')) ?? false
  return <PuzzleFrame title="Ticket exchange" back={root} footer={unlocked ? <>
    {(changed || stale || saved) && <PuzzleButton secondary className="mb-2 w-full" disabled={busy} onClick={() => { void request() }}>Refresh preview</PuzzleButton>}
    {!saved && <PuzzleButton className="w-full" disabled={!preview || (changed && !operation.current) || stale || busy || (preview.exchange.irreversible && !ack)} onClick={() => { void confirm() }}>{busy ? 'Saving locally…' : operation.current ? 'Retry same exchange' : 'Confirm exchange'}</PuzzleButton>}
  </> : undefined}><div className="space-y-3">
    <p className="text-xs text-ink-on-dark-soft">Same style, adjacent scenarios only. Exchange one higher ticket for two lower tickets, or two lower for one higher. Output repays its matching bank first; repaid output cannot be exchanged back.</p>
    <PuzzleOptions label="Adjacent scenario edge" value={edge} disabled={busy} onChange={setEdge} options={SCENARIOS.slice(0, -1).map((s, i) => ({ value: String(i), label: `${s.name} / ${SCENARIOS[i + 1]!.name}` }))} />
    <PuzzleOptions<typeof style> label="Exchange ticket style" value={style} disabled={busy} onChange={setStyle} options={STRATEGIES.map(s => ({ value: s, label: TICKET_STYLE_NAME[s] }))} />
    <PuzzleOptions label="Exchange direction" value={direction} disabled={busy} onChange={setDirection} options={[{ value: 'up', label: `2 ${low.name} → 1 ${high.name}` }, { value: 'down', label: `1 ${high.name} → 2 ${low.name}` }]} />
    <div className="grid grid-cols-2 gap-2">{[down ? high : low, down ? low : high].map((s, i) => <PuzzleCard key={s.id}><ConstellationTicketIcon style={style} tier={s.tier} /><h2 className="mt-2 text-sm">{i === 0 ? 'Input' : 'Output'} · {s.name}</h2><p className="mt-1 text-xs">Owned {account?.stocks[i === 0 ? from : to] ?? 0} · Bank {account?.bank?.balances[i === 0 ? from : to] ?? 0}</p></PuzzleCard>)}</div>
    {!unlocked ? <PuzzleCard><h2 className="font-semibold">Exchange edge locked</h2><p className="mt-2 text-xs">Clear {high.name}’s Opening Guardian with any party and sync the accepted clear to unlock both directions account-wide.</p><Link to={`${root}/chapters?scenario=${high.id}`} className="mt-2 flex min-h-11 items-center text-accent">Open {high.name} chapter</Link></PuzzleCard> : <>
      <label className="block text-xs">Exchange batches<input aria-label="Exchange batches" type="number" inputMode="numeric" min="1" step="1" disabled={busy} value={batch} onChange={e => setBatch(e.target.value)} className="mt-1 h-11 w-full rounded-sm border border-hairline-dark bg-stage px-3" /></label>
      <p className="text-xs">Consumes {quantity ?? '—'} input tickets · {down ? '1 higher per batch' : '2 lower per batch'}</p>
      {error && <p role="alert" className="text-sm">{error}</p>}
      {output && <PuzzleCard><h2 className="font-semibold">{rejected ? 'Exchange not accepted' : saved ? 'Exchange saved' : 'Exchange preview'}</h2>{rejected ? <><p className="mt-2 text-xs">Current stock: input {account?.stocks[from] ?? 0} · output {account?.stocks[to] ?? 0}</p><p className="mt-1 text-xs">Current output bank {account?.bank?.balances[to] ?? 0}</p></> : <><p className="mt-2">Gross {output.gross} → Repaid {output.debtPaid} → Items +{output.net}</p><p className="mt-2 text-xs">Stock after: input {output.stocksAfter.find(s => s.itemId === from)?.quantity ?? 0} · output {output.stocksAfter.find(s => s.itemId === to)?.quantity ?? 0}</p><p className="mt-1 text-xs">Output bank after {output.bankAfter.balances[to] ?? 0}</p></>}
        {!saved && output.irreversible && <label className="mt-3 flex min-h-11 items-center gap-3 text-xs"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />I understand {output.debtPaid} output tickets repay debt irreversibly and cannot be exchanged back.</label>}
      </PuzzleCard>}
      {saved && account && <MaterialOperationStatus account={account} id={saved.id} />}
      {!saved && (changed || stale) && <p role="alert">The preview changed. Refresh and explicitly reconfirm.</p>}
    </>}
  </div></PuzzleFrame>
}
