// All registered chapters; no race-scenario ownership gate (docs/design/uma-puzzles.md §§6,9).
import { SCENARIOS, STRATEGIES, puzzleChapter } from '@racer/domain'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { getContentAsset } from '../../content/runtime'
import { openPuzzleNode, openPuzzleParty, puzzleMapStatus, puzzleNodeName, puzzlePartySummary } from '../../game/puzzles/presentation'
import { AtlasSprite } from '../../ui/AtlasSprite'
import { ScenarioIcon } from '../../ui/icons'
import { PuzzleButton, PuzzleCard, PuzzleMaterialMark } from '../../ui/puzzles/components'
import { PuzzleFrame, usePuzzleAccount, usePuzzles } from './PuzzleContext'
export function PuzzleChaptersScreen() {
  const { root, content, host, command, busy, memory } = usePuzzles(), account = usePuzzleAccount(), navigate = useNavigate(), [search] = useSearchParams()
  const [partyId, setPartyId] = useState(() => search.get('party') ?? memory.read().partyId)
  const focus = SCENARIOS.find(s => s.id === search.get('scenario'))
  const party = account?.parties.find(p => p.partyId === partyId), summary = party && account && puzzlePartySummary(party, account), open = account && party && openPuzzleParty(account, party.partyId)
  const launch = async (scenarioId: string) => {
    if (!party || !summary?.full || busy || open && open.scenarioId !== scenarioId) return
    memory.choose(partyId, scenarioId)
    if (!party.revision && !await command(`create:${partyId}`, id => host.saveParty(party, id))) return
    if (await command(`chapter:${partyId}:${scenarioId}`, id => host.openChapter(partyId, scenarioId, id))) navigate(`${root}/party/${partyId}/${scenarioId}`)
  }
  return <PuzzleFrame title="Puzzle chapters" back={root}><div className="grid gap-3">
    {account && <div role="group" aria-label="Party" className="flex gap-2 overflow-x-auto pb-1">{account.parties.map(p => <button key={p.partyId} aria-pressed={partyId === p.partyId}
      className={`min-h-11 min-w-11 shrink-0 rounded-sm border px-3 text-left text-xs ${partyId === p.partyId ? 'border-accent text-accent bg-accent/10' : 'border-hairline-dark text-ink-on-dark-soft'}`}
      onClick={() => { setPartyId(p.partyId); memory.choose(p.partyId, memory.read().scenarioId) }}><span className="block">{p.name}</span><span className="block text-[10px]">{p.slots.filter(Boolean).length}/5</span></button>)}</div>}
    <p className="text-xs text-ink-on-dark-soft">{summary?.full ? `Average PL ${summary.average!.toFixed(1)} · range ${summary.min}–${summary.max}. Every chapter is open to this party.` : 'Fill all five party slots before opening a chapter.'} Wins and open encounters are separate for each party.</p>
    {focus && <p className="text-xs">Materials for {focus.name} · <a className="inline-flex min-h-11 items-center text-accent" href={`${root}/chapters?party=${partyId}`}>Show all chapters</a></p>}
    {(focus ? [focus] : SCENARIOS).map(s => {
      const chapter = puzzleChapter(s.id), status = account && party && puzzleMapStatus(account, party.partyId, s.id), suspended = open?.scenarioId === s.id, node = suspended && open && openPuzzleNode(open)
      return <PuzzleCard key={s.id}><div className="flex gap-3"><div className="h-12 w-12 shrink-0"><AtlasSprite asset={getContentAsset(content, 'scenario-icons', s.id)} alt={`${chapter.name} crest`} fallback={<ScenarioIcon size={32} />} /></div>
        <div className="min-w-0 flex-1"><h2 className="text-base">{chapter.name}</h2><p className="text-xs text-ink-on-dark-soft">PL {chapter.levelStart}–{chapter.levelEnd} · {status?.cleared.length ?? 0}/28 wins{status?.full ? ' · Full map cleared' : status?.complete ? ' · Chapter complete' : ''}</p></div></div>
        <div className="mt-2 flex justify-between">{STRATEGIES.map(style => <PuzzleMaterialMark key={style} style={style} />)}</div>
        {summary?.average !== null && summary?.average !== undefined && summary.average < chapter.levelStart && <p className="mt-2 text-xs text-accent">Low-level party: below recommended PL {chapter.levelStart}. A warning, not a gate.</p>}
        <PuzzleButton className="mt-3 w-full" disabled={busy || !summary?.full || Boolean(open && !suspended)} onClick={() => { void launch(s.id) }}>{suspended && node ? `Resume ${puzzleNodeName(node)}` : status?.checkpoint ? 'Continue chapter' : 'Open chapter'}</PuzzleButton>
        {open && !suspended && <p className="mt-1 text-[10px] text-ink-on-dark-soft">Resume the party’s open encounter before changing chapters.</p>}
      </PuzzleCard>
    })}
  </div></PuzzleFrame>
}
