// Ten saved presets and true resumes, not a per-Uma launch picker (docs/design/uma-puzzles.md §9).
import { Link, useSearchParams } from 'react-router'
import { puzzleChapter } from '@racer/domain'
import { foregroundPuzzleScenario, openPuzzleNode, openPuzzleParty, puzzlePartySummary } from '../../game/puzzles/presentation'
import { PuzzleCard, PuzzleOutfitIcon } from '../../ui/puzzles/components'
import { PuzzleElementMark } from '../../ui/puzzles/ElementMark'
import { puzzleLeaderLabel } from '../../ui/puzzles/kit'
import { PuzzleFrame, usePuzzleAccount, usePuzzles } from './PuzzleContext'
import { puzzleNodeName } from '../../game/puzzles/presentation'
import { ConstellationBankPanel } from '../../ui/ConstellationMaterials'
import { PuzzleBackupButton } from '../../ui/puzzles/PuzzleBackupButton'
export function PuzzleHubScreen() {
  const [params] = useSearchParams()
  const { root, content, memory, isolated } = usePuzzles(), account = usePuzzleAccount()
  return <PuzzleFrame title="Puzzle parties"><div className="grid gap-3">
    {params.get('notice') === 'spark-retired' && <p role="status" className="rounded-md border border-accent/35 p-3 text-sm text-ink-on-dark-soft">Spark has retired. Your earned Constellation Levels and saved builds are preserved. Choose and enroll a party here when you’re ready; no outfit was enrolled automatically.</p>}
    {!account?.outfits.length && <PuzzleCard><p className="text-sm">Start by enrolling Umas in the Roster</p><p className="mt-1 text-xs text-ink-on-dark-soft">Any Uma with an A running style can join.</p><Link to={`${root}/roster`} className="mt-2 flex min-h-11 items-center justify-center rounded-sm bg-accent text-sm font-semibold text-ink">Open Roster</Link></PuzzleCard>}
    <p className="text-xs text-ink-on-dark-soft">Ten independent journeys. All five slots must be filled to enter. No required colour or running-style mix.</p>
    {account?.parties.map(party => {
      const summary = puzzlePartySummary(party, account), open = openPuzzleParty(account, party.partyId), node = open && openPuzzleNode(open)
      const scenarioId = open?.scenarioId ?? foregroundPuzzleScenario(party) ?? memory.read().scenarioId
      const chapter = puzzleChapter(scenarioId)
      return <PuzzleCard key={party.partyId}><div className="flex items-center justify-between gap-2"><h2 className="text-base">{party.name}</h2><span className="text-xs text-ink-on-dark-soft">{summary.members.length}/5 · {summary.average === null ? 'PL —' : `PL ${summary.average.toFixed(1)}`}</span></div>
        <div className="mt-2 grid grid-cols-5 gap-2">{party.slots.map((slot, i) => <div key={i}>{slot ? <PuzzleOutfitIcon id={slot.outfitId} name={content.umas.byId.get(slot.outfitId)?.name ?? slot.outfitId} content={content}
          outfit={account.outfits.find(o => o.outfitId === slot.outfitId)} leader={i === 0} /> : <div className="flex aspect-square items-center justify-center rounded-md border border-dashed border-hairline-dark text-xs text-ink-on-dark-soft" aria-label={`Empty slot ${i + 1}`}>{i + 1}</div>}</div>)}</div>
        <div className="mt-2 flex gap-1">{summary.coverage.map(e => <PuzzleElementMark key={e} element={e} size={16} />)}<p className="ml-1 text-[11px] text-ink-on-dark-soft">{puzzleLeaderLabel(party.leaderId)}</p></div>
        <div className="mt-3 grid grid-cols-[1fr_1.6fr] gap-2"><Link className="flex min-h-11 items-center justify-center rounded-sm border border-hairline-dark text-sm" to={`${root}/party/${party.partyId}`}>Edit party</Link>
          <Link className="flex min-h-11 items-center justify-center rounded-sm bg-accent px-2 text-center text-xs font-semibold text-ink" onClick={() => memory.choose(party.partyId, scenarioId)} to={open ? `${root}/party/${party.partyId}/${scenarioId}` : !summary.full ? `${root}/party/${party.partyId}` : party.foregroundChapter ? `${root}/party/${party.partyId}/${scenarioId}` : `${root}/chapters?party=${party.partyId}`}>
            {open && node ? `Resume ${puzzleNodeName(node)}` : !summary.full ? 'Fill party' : party.foregroundChapter ? `Continue ${chapter.name}` : 'Choose chapter'}</Link></div>
      </PuzzleCard>
    })}
    <ConstellationBankPanel bank={account?.bank ?? null} itemsTo={`${root}/items`} />
    {!isolated && <PuzzleBackupButton />}
  </div></PuzzleFrame>
}
