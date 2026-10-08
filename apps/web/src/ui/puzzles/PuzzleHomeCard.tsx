// Manifest-only discovery at Home; real account/content checks are lazy on entry (Uma Puzzles §9; D289).
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { hasPuzzleContentFiles } from '../../content/puzzles/discovery'
import type { LoadedContent } from '../../content/runtime'
import { PUZZLES_RELEASE_ENABLED } from '../../game/puzzles/capability'
import { usePuzzlePreparation } from '../../game/puzzles/preparation-store'
import { Button } from '../Button'
import { Panel } from '../Panel'
const verify = async (content: LoadedContent) => {
  const { gameRuntime } = await import('../../game/runtime'), host = await gameRuntime.puzzleHost()
  if ((await host.account()).readiness !== 'active') {
    await gameRuntime.flush()
    if ((await host.account()).readiness !== 'active') throw new Error('Account preservation is preparing. Its progress and safe Retry are shown above; your earned levels are kept.')
  }
  const { puzzleContentLibrary } = await import('../../content/puzzles'), lease = await puzzleContentLibrary(content.manifest).acquire()
  lease.release()
}
export function PuzzleHomeCard({ content, verifyContent = verify, enabled = PUZZLES_RELEASE_ENABLED }: {
  content: LoadedContent; verifyContent?: (content: LoadedContent) => Promise<void>; enabled?: boolean
}) {
  const navigate = useNavigate(), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  const phase = usePuzzlePreparation(s => s.phase), preparing = usePuzzlePreparation(s => s.busy)
  const current = useRef<LoadedContent | null>(content), lock = useRef(false)
  useEffect(() => { current.current = content; setError(null); return () => { current.current = null } }, [content])
  useEffect(() => { if (phase === 'active') setError(null) }, [phase])
  if (!enabled) return null
  const published = hasPuzzleContentFiles(content.manifest)
  const open = async () => {
    if (lock.current || !published) return
    lock.current = true; setBusy(true); setError(null)
    try { await verifyContent(content); if (current.current === content) navigate('/puzzles') }
    catch (reason) { if (current.current === content) setError(reason instanceof Error ? reason.message : 'Uma Puzzles could not be verified. Retry safely.') }
    finally { lock.current = false; if (current.current) setBusy(false) }
  }
  return <Panel label="Uma Puzzles">
    <h2 className="font-display text-lg font-bold">Your five-Uma puzzle campaign</h2>
    <p className="mt-1 text-xs leading-5 text-ink-soft">Independent Puzzle Levels, free battles and scenario materials for Constellation Levels.</p>
    <p className="mt-1 text-xs text-ink-soft">Placeholder enemy art · real progression and rewards</p>
    {!published && <p role="status" className="mt-2 text-xs text-ink-soft">Puzzle content is not published. Your existing progress stays available.</p>}
    {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
    <Button disabled={!published || busy || preparing} className="mt-3 w-full" onClick={() => { void open() }}>{busy ? 'Checking saved campaign…' : preparing ? 'Preserving your progress…' : error ? 'Retry Uma Puzzles' : 'Open Uma Puzzles'}</Button>
  </Panel>
}
