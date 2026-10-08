// Read-only lazy preflight; no Home/gameplay activation (docs/technical/puzzle-content.md).
import { useEffect, useState } from 'react'
import { puzzleUsesPlaceholderArt } from '@racer/domain'
import { useNavigate } from 'react-router'
import { useContent } from '../../content/ContentProvider'
import { puzzleContentLibrary, puzzleContentDiagnostic, type PuzzlePresentationLease } from '../../content/puzzles'
import { PuzzleContentUnavailable } from '../../content/puzzles/Unavailable'
import { Button } from '../../ui/Button'
export function PuzzleContentScreen() {
  const content = useContent(), navigate = useNavigate(), [attempt, setAttempt] = useState(0)
  const [lease, setLease] = useState<PuzzlePresentationLease | null>(null), [busy, setBusy] = useState(false)
  const [diagnostic, setDiagnostic] = useState<string | undefined>()
  const manifest = content.status === 'ready' ? content.content.manifest : null
  useEffect(() => {
    let cancelled = false, acquired: PuzzlePresentationLease | undefined
    setLease(null); setDiagnostic(undefined)
    if (!manifest) { setBusy(false); return }
    setBusy(true)
    void puzzleContentLibrary(manifest).acquire().then(value => {
      acquired = value; if (cancelled) value.release(); else setLease(value)
    }).catch(error => { if (!cancelled) { setLease(null); setDiagnostic(puzzleContentDiagnostic(error)) } }).finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true; acquired?.release() }
  }, [manifest, attempt])
  if (!lease) return <PuzzleContentUnavailable busy={busy} diagnostic={diagnostic} back={() => navigate('/')} retry={() => {
    setAttempt(a => a + 1); if ('retry' in content) void content.retry()
  }} />
  return <main className="min-h-dvh bg-stage px-5 pt-safe pb-safe text-ink-on-dark">
    <h1 className="pt-5 text-2xl font-display">Enemy content verified</h1>
    <p className="py-3 text-sm">Read-only preview. {puzzleUsesPlaceholderArt(lease.pack) ? 'Placeholder enemy art · original stand-ins, not PAD portraits.' : 'Verified private enemy portraits.'}</p>
    <div className="grid grid-cols-2 gap-3">
      {lease.pack.members.map(member => {
        const frame = lease.atlas.frames.find(f => f.id === member.art.frameId)!, page = lease.atlas.pages[frame.page]!
        return <div key={member.id}><div role="img" aria-label={member.name} className="mx-auto h-32 w-32" style={{
          backgroundImage: `url(${lease.pageUrls[frame.page]})`, backgroundSize: `${page.width / 2}px ${page.height / 2}px`,
          backgroundPosition: `-${frame.x / 2}px -${frame.y / 2}px` }} /><p className="text-center text-xs">{member.name}</p></div>
      })}
    </div><Button className="my-6 w-full" onClick={() => navigate('/')}>Return</Button>
  </main>
}
