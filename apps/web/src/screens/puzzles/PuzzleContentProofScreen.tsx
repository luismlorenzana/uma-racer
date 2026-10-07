// DEV-only original placeholders/unavailable-state proof; no account access, tickets or rewards.
import { useState } from 'react'
import { PUZZLE_ELEMENTS } from '@racer/domain'
import { PuzzleEnemyPlaceholder } from '../../content/puzzles/Placeholder'
import { PuzzleContentUnavailable } from '../../content/puzzles/Unavailable'
import { Button } from '../../ui/Button'
export function PuzzleContentProofScreen() {
  const [unavailable, setUnavailable] = useState(false)
  if (unavailable) return <PuzzleContentUnavailable retry={() => setUnavailable(false)} back={() => setUnavailable(false)} />
  return <main className="flex min-h-dvh flex-col gap-5 bg-stage px-5 pt-safe pb-safe text-ink-on-dark">
    <header className="pt-5"><p className="text-micro">Development proof · no save changes</p><h1 className="mt-2 text-2xl font-display">Temporary enemy cast</h1></header>
    <p className="text-sm">Original placeholders only. Real PAD art is pinned for the final content pass.</p>
    <div className="grid grid-cols-2 gap-4">{PUZZLE_ELEMENTS.map(element => <figure key={element}>
      <div className="aspect-square"><PuzzleEnemyPlaceholder element={element} /></div><figcaption className="text-center text-sm capitalize">{element} · placeholder</figcaption>
    </figure>)}</div>
    <Button className="mb-5" onClick={() => setUnavailable(true)}>Preview missing-content state</Button>
  </main>
}
