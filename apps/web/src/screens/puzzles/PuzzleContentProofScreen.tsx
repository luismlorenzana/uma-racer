// DEV-only original placeholders/unavailable-state proof; no account access, tickets or rewards.
import { useState } from 'react'
import { PUZZLE_ELEMENTS } from '@racer/domain'
import { puzzlePlaceholderSvg, type PlaceholderRank } from '../../../../../scripts/assets/src/puzzle-placeholder-art'
import { PuzzleContentUnavailable } from '../../content/puzzles/Unavailable'
import { Button } from '../../ui/Button'
import { PuzzleHomeCard } from '../../ui/puzzles/PuzzleHomeCard'
import { puzzleUiProofData } from './ui-proof-data'
export function PuzzleContentProofScreen() {
  const [unavailable, setUnavailable] = useState(false)
  const [rank, setRank] = useState<PlaceholderRank>('scout')
  const [home, setHome] = useState(false)
  if (home) {
    const content = puzzleUiProofData().content
    content.manifest.files = ['data/puzzles-catalog.aaaaaaaa.json', 'data/puzzles-cast.bbbbbbbb.json'].map(path => ({ path, bytes: 1, sha256: 'a'.repeat(64) }))
    return <main className="min-h-dvh space-y-5 bg-page p-5 pt-safe text-ink"><h1 className="pt-5 font-display text-xl">Isolated Home entry preview</h1>
      <p className="text-sm">The production Home card below. This preview cannot open the owner account.</p>
      <PuzzleHomeCard content={content} enabled verifyContent={async () => { throw new Error('Isolated visual preview only; no production account was accessed.') }} />
      <Button onClick={() => setHome(false)}>Return to placeholder cast</Button></main>
  }
  if (unavailable) return <PuzzleContentUnavailable retry={() => setUnavailable(false)} back={() => setUnavailable(false)} />
  return <main className="flex min-h-dvh flex-col gap-5 bg-stage px-5 pt-safe pb-safe text-ink-on-dark">
    <header className="pt-5"><p className="text-micro">Development proof · no save changes</p><h1 className="mt-2 text-2xl font-display">Original placeholder cast</h1></header>
    <p className="text-sm">Same original SVG source as the verified production atlas. Permitted PAD art remains a later upgrade.</p>
    <button type="button" className="min-h-11 rounded-sm border border-hairline-dark px-3" onClick={() => setHome(true)}>Preview Home entry</button>
    <div className="flex gap-2">{(['scout', 'guardian', 'champion'] as const).map(r => <button key={r} type="button" aria-pressed={rank === r} onClick={() => setRank(r)} className="min-h-11 flex-1 rounded-sm border border-hairline-dark px-2 capitalize">{r}</button>)}</div>
    <div className="grid grid-cols-2 gap-4">{PUZZLE_ELEMENTS.map(element => <figure key={element}>
      <div className="mx-auto aspect-square max-w-[140px]"><img className="h-full w-full" src={`data:image/svg+xml,${encodeURIComponent(puzzlePlaceholderSvg(element, rank))}`} alt={`${element} ${rank} original placeholder`} /></div><figcaption className="text-center text-sm capitalize">{element} · {rank}</figcaption>
    </figure>)}</div>
    <Button className="mb-5" onClick={() => setUnavailable(true)}>Preview missing-content state</Button>
  </main>
}
