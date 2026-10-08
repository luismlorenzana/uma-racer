// Visible content failure, never a rewarded fallback (docs/technical/puzzle-content.md).
import { Button } from '../../ui/Button'
export function PuzzleContentUnavailable({ retry, back, busy = false, diagnostic }: { retry: () => void; back: () => void; busy?: boolean; diagnostic?: string }) {
  return <section className="flex min-h-dvh flex-col justify-center gap-5 bg-stage px-6 pt-safe pb-safe text-ink-on-dark" aria-live="polite">
    <p className="text-micro">Private enemy content</p><h1 className="text-2xl font-display">Uma Puzzles content unavailable</h1>
    <p className="text-sm">Verified enemy art and a compatible pack are required. Your save has not changed.</p>
    {diagnostic && <p className="text-sm">{diagnostic}</p>}
    <Button onClick={retry} disabled={busy}>{busy ? 'Checking content…' : 'Retry'}</Button>
    <Button variant="secondary" onClick={back}>Return</Button>
  </section>
}
