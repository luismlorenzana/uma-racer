// DEV-only read-only layout proof; no database, transport, enrollment or rewards.
import { useState } from 'react'
import { RpgGuide } from './RpgGuide'
import { RpgHubContent } from './RpgScreen'
import { releaseProofFixture, releaseProofNames } from './release-proof-fixture'
const fixture = releaseProofFixture()
export function RpgReleaseProofScreen() {
  const [guide, setGuide] = useState(false)
  return <div className="flex h-dvh flex-col bg-page">
    <header className="pt-safe shrink-0 border-b border-hairline bg-panel px-4"><div className="flex min-h-14 items-center justify-between gap-2"><h1 className="font-display text-xl">Uma RPG</h1><button className="min-h-11 rounded-sm border border-hairline px-3 text-xs" onClick={() => setGuide(true)}>How to play</button></div><p className="pb-2 text-[11px] text-ink-soft">DEV · invented portraits · read-only layout</p></header>
    <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-safe"><RpgHubContent view={fixture.view} content={null} ownedIds={Object.keys(releaseProofNames)} names={releaseProofNames} release={fixture.release} retryRelease={() => undefined} /></main>
    {guide && <RpgGuide onClose={() => setGuide(false)} proof />}
  </div>
}
