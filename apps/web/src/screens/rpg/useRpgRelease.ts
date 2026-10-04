// Campaign reference availability, not a save flag (docs/design/uma-rpg.md#phone-presentation).
import { useEffect, useState } from 'react'
import { verifyRpgRelease, type RpgRelease } from '../../content/rpg-release'
import type { LoadedContent } from '../../content/runtime'
export function useRpgRelease(content: LoadedContent | null) {
  const [state, setState] = useState<RpgRelease | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setState(null)
    if (content) void verifyRpgRelease(content).then(value => { if (!cancelled) setState(value) }).catch((error: unknown) => {
      if (!cancelled) setState({ status: 'unavailable', reason: error instanceof Error ? error.message : String(error) })
    })
    return () => { cancelled = true }
  }, [content, attempt])
  return { state, retry: () => setAttempt(n => n + 1) }
}
