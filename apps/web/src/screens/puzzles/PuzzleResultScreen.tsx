// Every value comes from the saved receipt, not the battle animation (Uma Puzzles §9).
import { SCENARIOS, nextPuzzleLevelExp, parsePuzzleMaterialId } from '@racer/domain'
import { Link, useNavigate } from 'react-router'
import type { PuzzleResultView } from '../../game/puzzles/host'
import { puzzleResultEntrants } from '../../game/puzzles/battle-presentation'
import { PuzzleButton, PuzzleCard, PuzzleMaterialMark, PuzzleOutfitIcon } from '../../ui/puzzles/components'
import { puzzleActiveLabel, puzzlePatternLabel } from '../../ui/puzzles/kit'
import { PuzzleFrame, usePuzzleAccount, usePuzzles } from './PuzzleContext'
export function PuzzleResultScreen({ view, retry }: { view: PuzzleResultView; retry(): Promise<unknown> }) {
  const { receipt: r, summary } = view, env = usePuzzles(), account = usePuzzleAccount(), navigate = useNavigate()
  const map = `${env.root}/party/${r.input.partyId}/${r.input.scenarioId}`, scenario = SCENARIOS.find(s => s.id === r.input.scenarioId)!.name
  const replay = () => {
    const party = account?.parties.find(p => p.partyId === r.input.partyId), checkpoint = account?.checkpoints.find(c => c.checkpointId === r.input.checkpointId)
    if (!party || !checkpoint) return
    void env.command(`replay:${r.battleId}`, async operationId => {
      const v = await env.host.begin({ partyId: party.partyId, scenarioId: r.input.scenarioId, nodeId: r.fact.nodeId,
        darkVariant: r.fact.nodeId.endsWith(':c-dark') ? r.input.rewards[0]!.style as 'pace' | 'late' : null,
        partyRevision: party.revision, checkpointRevision: checkpoint.revision }, operationId)
      if (v.kind === 'battle') { const id = v.open.input.battleId; v.lease.release(); navigate(`${env.root}/battle/${encodeURIComponent(id)}`) }
      else if (v.kind === 'recovery') throw new Error(v.message)
      else navigate(`${env.root}/battle/${encodeURIComponent(v.receipt.battleId)}`)
    })
  }
  return <PuzzleFrame title={r.result.outcome === 'win' ? 'Encounter cleared' : r.result.outcome === 'loss' ? 'Fight lost' : 'Fight abandoned'} back={map}>
    <div className="grid gap-3"><PuzzleCard><p className="text-micro text-accent">{scenario} · {r.input.kind}</p><h2 className="mt-1 text-xl">{r.result.outcome === 'win' ? 'Your party moved forward' : 'Previous progress is safe'}</h2>
      <p className="mt-2 text-sm">{r.result.drags} drags · {r.result.hpRemaining} HP remaining</p>
      {summary ? <p className="mt-1 text-sm">{summary.combos} combos · Best {summary.bestCombos} · {summary.damage} damage · {summary.healed} HP healed</p> : <p className="mt-2 text-xs text-ink-on-dark-soft">Local combat detail is unavailable on this device. Exact rewards below are from the saved receipt.</p>}
      <p role="status" className="mt-3 text-xs text-accent">{view.pending ? 'Pending sync · replay-validated locally. Canonical totals may be corrected.' : 'Synced · canonical reward receipt'}</p>
      <PuzzleButton secondary className="mt-2" onClick={() => { void retry() }}>Refresh saved receipt</PuzzleButton>
      {r.result.outcome !== 'win' && <p className="mt-3 text-sm">Zero new EXP and materials. {r.result.reason === 'hp-zero' ? 'Party HP reached zero.' : r.result.reason === 'turn-limit' ? 'The drag limit was reached.' : 'You chose to abandon.'} Earlier levels, Items and map wins were not removed.</p>}
    </PuzzleCard>
    <section aria-label="Exact entrant EXP and level changes" className="grid gap-2">{puzzleResultEntrants(r).map(row => <PuzzleCard key={row.entrant.outfitId}>
      <div className="flex items-center gap-3"><div className="w-14 shrink-0"><PuzzleOutfitIcon id={row.entrant.outfitId} name={env.content.umas.byId.get(row.entrant.outfitId)?.name ?? row.entrant.outfitId} content={env.content} /></div>
        <div className="min-w-0"><h3 className="text-sm">{env.content.umas.byId.get(row.entrant.outfitId)?.name ?? row.entrant.outfitId}</h3><p className="text-sm text-accent">+{row.amount} EXP · PL {row.before.level} → {row.after.level}</p><p className="text-xs text-ink-on-dark-soft">EXP {row.before.exp}/{nextPuzzleLevelExp(row.before.level)} → {row.after.exp}/{nextPuzzleLevelExp(row.after.level)}</p></div></div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">{Object.entries(row.deltas).map(([stat, value]) => <span key={stat}>{stat.toUpperCase()} +{value}</span>)}</div>
      {row.unlocked.length ? <div className="mt-2 text-xs text-accent">New equip choices: {row.unlocked.map(id => id === 'puzzle:four' || id === 'puzzle:row' ? puzzlePatternLabel(id) : puzzleActiveLabel(id)).join('; ')}<Link className="mt-1 flex min-h-11 items-center underline" to={`${env.root}/roster/${encodeURIComponent(row.entrant.outfitId)}`}>Review outfit kit</Link></div> : <p className="mt-1 text-xs text-ink-on-dark-soft">No new kit choice this fight; EXP carry is retained.</p>}
    </PuzzleCard>)}</section>
<PuzzleCard><h3 className="text-sm">Materials · {scenario}</h3><table className="mt-2 w-full text-left text-xs"><caption className="sr-only">Gross drops, negative balance repaid, net gain to Items</caption><thead><tr><th className="py-2">Family</th><th>Gross</th><th>Repaid</th><th>Items</th></tr></thead><tbody>{r.materials.map(m => { const id = parsePuzzleMaterialId(m.itemId)!; return <tr key={m.itemId} className="border-t border-hairline-dark"><td className="py-3"><Link aria-label={`Inspect ${id.style} tickets in ${scenario}`} to={`${env.root}/items?item=${encodeURIComponent(m.itemId)}`} className="flex min-h-11 items-center"><PuzzleMaterialMark style={id.style} tier={SCENARIOS.find(s => s.id === id.scenarioId)!.tier} size={48} /></Link></td><td>{m.gross}</td><td>{m.debtPaid}</td><td className="text-accent">+{m.net}</td></tr> })}</tbody></table>{!r.materials.length && <p className="mt-2 text-xs">No material reward on loss or abandonment.</p>}</PuzzleCard>
    <div className="grid grid-cols-2 gap-2"><Link to={map} className="flex min-h-11 items-center justify-center rounded-sm bg-accent text-ink">Continue map</Link><PuzzleButton secondary disabled={env.busy || !account || account.checkpoints.some(c => c.progress.partyId === r.input.partyId && c.open)} onClick={replay}>Replay encounter</PuzzleButton>
      <Link to={`${env.root}/items`} className="col-span-2 flex min-h-11 items-center justify-center rounded-sm border border-hairline-dark">Open Items</Link></div>
    </div>
  </PuzzleFrame>
}
