// Five saved presets and true resumes, not a per-Uma launch picker (docs/design/uma-puzzles.md §9).
import { Link, useLocation } from 'react-router'
import { puzzleChapter } from '@racer/domain'
import { foregroundPuzzleScenario, openPuzzleNode, openPuzzleParty, puzzlePartySummary } from '../../game/puzzles/presentation'
import { PuzzleCard, PuzzleOutfitIcon } from '../../ui/puzzles/components'
import { PuzzleElementMark } from '../../ui/puzzles/ElementMark'
import { puzzleLeaderLabel } from '../../ui/puzzles/kit'
import { PuzzleFrame, usePuzzleAccount, usePuzzles } from './PuzzleContext'
import { puzzleNodeName } from '../../game/puzzles/presentation'
export function PuzzleHubScreen() {
  const { root, content, memory } = usePuzzles(), account = usePuzzleAccount()
  return <PuzzleFrame title="Puzzle parties"><div className="grid gap-3">
    <p className="text-xs text-ink-on-dark-soft">Five independent journeys. All five slots must be filled to enter. No required colour or running-style mix.</p>
    {account?.parties.map(party => {
      const summary = puzzlePartySummary(party, account), open = openPuzzleParty(account, party.partyId), node = open && openPuzzleNode(open)
      const scenarioId = open?.scenarioId ?? foregroundPuzzleScenario(party) ?? memory.read().scenarioId
      const chapter = puzzleChapter(scenarioId)
      return <PuzzleCard key={party.partyId}><div className="flex items-center justify-between gap-2"><h2 className="text-base">{party.name}</h2><span className="text-xs text-ink-on-dark-soft">{summary.members.length}/5 · {summary.average === null ? 'PL —' : `PL ${summary.average.toFixed(1)}`}</span></div>
        <div className="mt-2 grid grid-cols-5 gap-2">{party.slots.map((slot, i) => <div key={i}>{slot ? <PuzzleOutfitIcon id={slot.outfitId} name={content.umas.byId.get(slot.outfitId)?.name ?? slot.outfitId} content={content}
          outfit={account.outfits.find(o => o.outfitId === slot.outfitId)} leader={i === 0} /> : <div className="flex aspect-square items-center justify-center rounded-md border border-dashed border-hairline-dark text-xs text-ink-on-dark-soft" aria-label={`Empty slot ${i + 1}`}>{i + 1}</div>}</div>)}</div>
        <div className="mt-2 flex gap-1">{summary.coverage.map(e => <PuzzleElementMark key={e} element={e} size={16} />)}<p className="ml-1 text-[11px] text-ink-on-dark-soft">{puzzleLeaderLabel(party.leaderId)}</p></div>
        <div className="mt-3 grid grid-cols-[1fr_1.6fr] gap-2"><Link className="flex min-h-11 items-center justify-center rounded-sm border border-hairline-dark text-sm" to={`${root}/party/${party.partyId}`}>Edit party</Link>
          <Link className="flex min-h-11 items-center justify-center rounded-sm bg-accent px-2 text-center text-xs font-semibold text-ink" onClick={() => memory.choose(party.partyId, scenarioId)} to={open || party.foregroundChapter ? `${root}/party/${party.partyId}/${scenarioId}` : `${root}/chapters?party=${party.partyId}`}>
            {open && node ? `Resume ${puzzleNodeName(node)}` : party.foregroundChapter ? `Continue ${chapter.name}` : 'Choose chapter'}</Link></div>
      </PuzzleCard>
    })}
  </div></PuzzleFrame>
}
export function PuzzleUnavailableSection() {
  const { root } = usePuzzles(), location = useLocation(), items = location.pathname.endsWith('/items')
  return <PuzzleFrame title={items ? 'Puzzle items' : 'Puzzle exchange'} back={root}><PuzzleCard><h2 className="text-lg">{items ? 'Your materials, next' : 'Adjacent exchanges, next'}</h2>
    <p className="mt-3 text-sm text-ink-on-dark-soft">{items ? 'T114 adds the scenario and running-style inventory, repayment balances and constellation spending. This screen does not grant or spend anything.' : 'T114 adds confirmed adjacent-scenario exchanges. Clearing the higher chapter’s Opening Guardian unlocks that edge; nothing is exchanged here yet.'}</p>
    <Link className="mt-4 flex min-h-11 items-center justify-center rounded-sm border border-hairline-dark" to={`${root}/chapters`}>Explore chapters</Link>
  </PuzzleCard></PuzzleFrame>
}
