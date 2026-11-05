// One tap on a career screen (D387): the operation through the port, the rule's own words when it refuses, and a busy
// flag so a double tap does nothing.
import { useCallback, useState } from 'react'
import { useRun } from '../../app/game'

const FAILED = "That didn't work. Try again."

export function useCareerOp(): {
  readonly go: (name: string, input: unknown) => Promise<boolean>
  readonly busy: boolean
  readonly error: string | null
  readonly clear: () => void
} {
  const run = useRun()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const go = useCallback(async (name: string, input: unknown) => {
    setBusy(true)
    setError(null)
    try {
      const answer = await run(name, input, name)
      if (answer.kind === 'refused') setError(answer.text)
      return answer.kind === 'done'
    } catch {
      setError(FAILED)
      return false
    } finally {
      setBusy(false)
    }
  }, [run])
  const clear = useCallback(() => setError(null), [])
  return { go, busy, error, clear }
}
