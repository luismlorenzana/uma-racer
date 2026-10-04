// Lazy Home entry (docs/design/uma-rpg.md#phone-presentation); manifest-only until tapped.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { hasRpgReleaseFiles } from '../../content/rpg-manifest'
import type { RpgRelease } from '../../content/rpg-release'
import type { LoadedContent } from '../../content/runtime'
import { Button } from '../Button'
import { Panel } from '../Panel'

const verify = async (content: LoadedContent) => (await import('../../content/rpg-release')).verifyRpgRelease(content)
export function RpgHomeCard({ content, verifyContent = verify }: { content: LoadedContent; verifyContent?: (content: LoadedContent) => Promise<RpgRelease> }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = useRef<LoadedContent | null>(content)
  const lock = useRef(false)
  useEffect(() => { current.current = content; setError(null); return () => { current.current = null } }, [content])
  const published = hasRpgReleaseFiles(content.manifest)
  const open = async () => {
    if (lock.current || !published) return
    lock.current = true; setBusy(true); setError(null)
    try {
      const release = await verifyContent(content)
      if (current.current !== content) return
      if (release.status === 'ready') navigate('/rpg')
      else setError(release.reason)
    } catch (reason) { if (current.current === content) setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { lock.current = false; if (current.current) setBusy(false) }
  }
  return <Panel label="Global Uma RPG">
    <h2 className="font-display text-lg font-bold">Your five-outfit adventure</h2>
    <p className="mt-1 text-xs leading-5 text-ink-soft">Independent RPG levels, branching battles and scenario Inspiration tokens. Free entry and retry.</p>
    {!published && <p role="status" className="mt-2 text-xs text-ink-soft">Campaign unavailable: the private URA chapter has not been published. Racing and Farm remain available.</p>}
    {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
    <Button disabled={!published || busy} className="mt-3 w-full" onClick={() => { void open() }}>{busy ? 'Checking chapter and portraits…' : error ? 'Retry RPG availability' : 'Open Uma RPG'}</Button>
  </Panel>
}
