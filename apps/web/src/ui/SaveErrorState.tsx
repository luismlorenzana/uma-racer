import { useState } from 'react'
import { APP_BUILD_ID } from '../app/build'
import { Panel } from './Panel'

/**
 * The screen a save that cannot open shows (D157): the reason, a way to try again once a fix has shipped, and the
 * details to pass on. It never offers to clear anything: the local save may hold the only copy of recent progress.
 */
export function SaveErrorState({ detail }: { detail: string | null }) {
  const [copied, setCopied] = useState(false)
  const reason = detail ?? 'The local save could not be opened.'
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Uma Racer save error\nBuild ${APP_BUILD_ID}\n${new Date().toISOString()}\n${reason}`)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <Panel className="mt-3 text-center" role="alert">
      <p className="font-display text-lg font-bold">Save needs attention</p>
      <p className="mt-1 text-sm text-ink-soft">{reason}</p>
      <p className="mt-2 text-[12px] text-ink-faint">Your progress is kept as it is. Nothing is cleared.</p>
      <div className="mt-4 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="font-display inline-flex min-h-11 items-center rounded-sm bg-accent px-5 font-semibold text-ink shadow-1"
        >
          Try again
        </button>
        <button type="button" onClick={() => void copy()} className="inline-flex min-h-11 items-center rounded-sm border border-line px-4 font-semibold">
          {copied ? 'Copied' : 'Copy details'}
        </button>
      </div>
    </Panel>
  )
}
