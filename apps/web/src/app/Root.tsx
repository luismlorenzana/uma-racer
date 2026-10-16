// The new game's root route (T137): every route renders inside it. A save that can't open says why, with Try again and
// Copy details, and never offers to clear anything (ux "Principles", D157).
import { Button, Panel } from '@luismlorenzana/uma-kit/ui'
import { hubWords } from '@racer/domain/hub'
import { useState } from 'react'
import { Outlet } from 'react-router'
import { APP_BUILD_ID } from './build'
import { useSnapshot } from './game'

function SaveError({ words }: { words: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Uma Racer\nBuild ${APP_BUILD_ID}\n${new Date().toISOString()}\n${words}`)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="pt-safe pb-safe fixed inset-0 flex items-center px-4">
      <Panel className="w-full text-center" role="alert">
        <p className="font-display text-lg font-bold">{hubWords('save-error-title')}</p>
        <p className="mt-1 text-sm text-ink-soft">{words}</p>
        <p className="mt-2 text-[12px] text-ink-faint">{hubWords('save-error-kept')}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => window.location.reload()}>{hubWords('try-again')}</Button>
          <Button variant="secondary" onClick={() => void copy()}>{copied ? hubWords('copied') : hubWords('copy-details')}</Button>
        </div>
      </Panel>
    </div>
  )
}

export function Root() {
  const snapshot = useSnapshot()
  if (snapshot.status === 'error') return <SaveError words={snapshot.words ?? hubWords('save-error-reason')} />
  return <Outlet />
}
