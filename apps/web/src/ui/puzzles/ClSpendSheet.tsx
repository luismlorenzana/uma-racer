// One sheet, one real host mutation for Profile/Training/Constellation (Uma Puzzles §7, T114).
import { STATS, TRAINING_LEVEL_UP_TICKET_ID, type PuzzleMaterialInput } from '@racer/domain'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { clScenario, clSpendVector, clTicketRows } from '../../game/items/cl'
import type { PuzzleAccount, PuzzleClResult, PuzzleHost, PuzzleMaterialPreview } from '../../game/puzzles/host'
import { ConstellationTicketIcon } from '../ConstellationTicketIcon'
import { LevelUpIcon } from '../icons'
import { PuzzleButton, PuzzleModal } from './components'

export function MaterialOperationStatus({ account, id }: { account: PuzzleAccount; id: string | null }) {
  const status = account.materialOperations.find(o => o.id === id)
  return id ? <p role={status?.status === 'rejected' || status?.status === 'blocked' ? 'alert' : 'status'} className="mt-3 rounded-sm border border-current/20 p-2 text-xs">{status?.status === 'accepted' ? 'Synced · accepted receipt' : status?.status === 'rejected' || status?.status === 'blocked' ? `Sync needs review: ${status.reason ?? status.status}. This change was not accepted. Stock and CL follow the canonical save; your configuration is retained for review.` : 'Saved locally · pending sync. A canonical rejection can undo this projection.'}</p> : null
}
function ClDelta({ result }: { result: PuzzleClResult }) {
  return <section className="space-y-2 text-sm"><p className="text-lg font-semibold">CL {result.before} → {result.after}</p>
    <p>Crossed {Array.from({ length: result.after - result.before }, (_, i) => `CL ${result.before + i + 1}`).join(', ')}</p>
    {result.delta ? <div className="grid grid-cols-3 gap-2">{STATS.map(s => <p key={s} className="rounded-sm bg-stage p-2 text-xs capitalize">{s} {result.delta!.stats[s] >= 0 ? '+' : ''}{result.delta!.stats[s]}</p>)}<p className="rounded-sm bg-stage p-2 text-xs">SP +{result.delta.skillPoints}</p></div> : <p>Stat/SP projection unavailable until verified templates load. No assignments change.</p>}
    {result.nodes.length ? <div><h3 className="font-semibold">Card nodes opened</h3>{result.nodes.map(n => <Link key={n.id} to={`${result.href}&node=${encodeURIComponent(n.id)}`} className="flex min-h-11 items-center text-accent">{n.label} · {n.id}</Link>)}</div> : <p>No new card nodes. {result.spOnly ? 'CL9/10 increase baseline SP, not base stats.' : 'Nothing opened.'}</p>}
    <p className="text-xs text-ink-on-dark-soft">Card/lineage assignments, Inspiration, Extra stats and global card stars stay unchanged. All four distance presets share this CL.</p>
  </section>
}
function TicketChoice({ row, count, remaining, disabled, onChange }: { row: ReturnType<typeof clTicketRows>[number]; count: string; remaining: number; disabled: boolean; onChange(count: string): void }) {
  return <label className="flex min-h-14 items-center gap-2 rounded-sm border border-hairline-dark p-2"><ConstellationTicketIcon style={row.style} tier={row.scenarioTier} size={24} /><span className="min-w-0 flex-1 text-xs">{row.name}<span className="block text-ink-on-dark-soft">Owned {row.owned}{row.reason ? ` · ${row.reason}` : ''}</span></span><input aria-label={`Spend ${row.name}`} type="number" inputMode="numeric" min="0" max={Math.min(row.owned, remaining)} step="1" disabled={!row.eligible || row.owned === 0 || disabled} value={count} onChange={e => onChange(e.target.value)} className="h-11 w-14 rounded-sm border border-hairline-dark bg-stage px-2 disabled:opacity-45" /></label>
}
export function ClSpendSheet({ host, account, outfitId, tier, onClose, refresh }: {
  host: PuzzleHost; account: PuzzleAccount; outfitId: string; tier: number; onClose(): void; refresh(): Promise<void>
}) {
  const scenario = clScenario(tier), uma = account.umas.find(u => u.templateId === outfitId), unit = uma?.scenarios.find(s => s.tier === tier)
  const [rows, setRows] = useState<ReturnType<typeof clTicketRows>>([]), [counts, setCounts] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<(PuzzleMaterialPreview & { cl: PuzzleClResult }) | null>(null)
  const [result, setResult] = useState<PuzzleClResult | null>(null), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false)
  const [confirmedId, setConfirmedId] = useState<string | null>(null), [stale, setStale] = useState(false)
  const operation = useRef<{ confirmation: string; id: string } | null>(null), inFlight = useRef(false)
  useEffect(() => { let active = true; setRows([])
    void host.registration(outfitId).then(r => { if (active && scenario) setRows(clTicketRows(r.source, scenario.id, account.stocks)) }).catch(e => { if (active) setError(String(e)) })
    return () => { active = false }
  }, [host, outfitId, scenario, account.stocks])
  const universal = account.stocks[TRAINING_LEVEL_UP_TICKET_ID] ?? 0, vector = clSpendVector(counts, rows, universal, 10 - (unit?.trainingLevel ?? 10))
  const vectorKey = JSON.stringify(vector)
  useEffect(() => { if (operation.current) return; let active = true; setPreview(null); setStale(false)
    if (!scenario || !unit || !vector) return
    void host.previewCl(outfitId, scenario.id, vector).then(p => { if (active) { setPreview(p); setError(null) } }).catch(e => { if (active) setError(e instanceof Error ? e.message : String(e)) })
    return () => { active = false }
    // A preview is pinned until an explicit refresh; account changes must never auto-confirm new economics.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, outfitId, scenario, vectorKey])
  const changed = preview !== null && (preview.revision !== account.bank?.revision || JSON.stringify(preview.stocks) !== JSON.stringify(account.stocks))
  const rejected = account.materialOperations.some(o => o.id === confirmedId && (o.status === 'rejected' || o.status === 'blocked'))
  const review = async () => { setPreview(null); operation.current = null; setStale(false); setError(null)
    await refresh(); if (scenario && vector) { try { setPreview(await host.previewCl(outfitId, scenario.id, vector)) } catch (e) { setError(String(e)) } }
  }
  const confirm = async () => {
    if (!preview || (changed && !operation.current) || stale || inFlight.current) return
    inFlight.current = true; setBusy(true); setError(null)
    operation.current = operation.current?.confirmation === preview.confirmation ? operation.current : { confirmation: preview.confirmation, id: crypto.randomUUID() }
    try { const saved = await host.confirmMaterial(preview, operation.current.id); setConfirmedId(operation.current.id); setResult(saved.cl); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); setStale(e instanceof Error && /changed|stale|reused|review/i.test(e.message)); await refresh() }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <PuzzleModal title="Constellation Level" onClose={() => { if (!busy) onClose() }} footer={!result && scenario && unit && (unit.trainingLevel < 10 || operation.current) ? <>
    {(changed || stale) && <PuzzleButton secondary className="mb-2 w-full" disabled={busy} onClick={() => { void review() }}>Refresh preview</PuzzleButton>}
    <PuzzleButton className="w-full" disabled={!preview || (changed && !operation.current) || stale || busy} onClick={() => { void confirm() }}>{busy ? 'Saving locally…' : operation.current ? 'Retry same CL spend' : 'Confirm CL spend'}</PuzzleButton>
  </> : undefined}>
    <p className="mb-3 text-xs">{scenario?.name ?? 'Unknown scenario'} · {uma?.activePreset ?? 'distance'} preset · CL {unit?.trainingLevel ?? '—'}/10</p>
    {error && <p role="alert" className="my-2 text-sm">{error}</p>}
    {!scenario || !unit ? <p>Unlock this racing scenario first. No ticket can be spent here.</p> : result ? <>{rejected ? <p className="font-semibold">Spend not accepted · current CL {unit.trainingLevel}/10</p> : <ClDelta result={result} />}<MaterialOperationStatus account={account} id={confirmedId} /><Link to={result.href} className="mt-3 flex min-h-11 items-center justify-center rounded-sm bg-accent text-ink">Open this constellation</Link><PuzzleButton secondary className="mt-2 w-full" onClick={onClose}>Done</PuzzleButton></> : unit.trainingLevel === 10 && !operation.current ? <p>CL10 · Maxed. No further spend; all card nodes and baseline SP levels are available.</p> : <>
      <p className="mb-3 text-xs text-ink-on-dark-soft">Choose up to {10 - unit.trainingLevel} tickets. One ticket = one CL. Original A style eligibility only; preserved universal tickets are separate.</p>
      <div className="space-y-2">{rows.filter(row => row.eligible).map(row => <TicketChoice key={row.id} row={row} count={counts[row.id] ?? '0'} remaining={10 - unit.trainingLevel} disabled={busy} onChange={count => { operation.current = null; setCounts({ ...counts, [row.id]: count }) }} />)}
      <label className="flex min-h-14 items-center gap-2 rounded-sm border border-hairline-dark p-2"><LevelUpIcon size={24} /><span className="flex-1 text-xs">Legacy Universal CL Ticket<span className="block text-ink-on-dark-soft">Preserved · owned {universal} · no debt interception on spending</span></span><input aria-label="Spend Legacy Universal CL Ticket" type="number" inputMode="numeric" min="0" max={Math.min(universal, 10 - unit.trainingLevel)} disabled={universal === 0 || busy || !rows.some(r => r.eligible)} value={counts[TRAINING_LEVEL_UP_TICKET_ID] ?? '0'} onChange={e => { setCounts({ ...counts, [TRAINING_LEVEL_UP_TICKET_ID]: e.target.value }); operation.current = null }} className="h-11 w-14 rounded-sm border border-hairline-dark bg-stage px-2" /></label></div>
      <details className="mt-2 rounded-sm border border-hairline-dark px-2"><summary className="flex min-h-11 cursor-pointer items-center text-xs">Inspect ineligible tickets</summary><div className="space-y-2 pb-2">{rows.filter(row => !row.eligible).map(row => <TicketChoice key={row.id} row={row} count="0" remaining={0} disabled onChange={() => {}} />)}</div></details>
      {!vector && <p className="my-2 text-xs">Choose positive whole counts within stock and the CL10 limit.</p>}
      {preview && <div className="mt-3 rounded-md border border-accent p-3"><p className="mb-2 font-semibold">Total cost {preview.payload.kind === 'cl-spend' ? preview.payload.inputs.reduce((n, r: PuzzleMaterialInput) => n + r.quantity, 0) : 0} tickets</p><ClDelta result={preview.cl} /></div>}
      {(changed || stale) && <p role="alert" className="my-2 text-sm">Stocks, debt, CL or source changed. Refresh and review again before confirming.</p>}
    </>}
  </PuzzleModal>
}
