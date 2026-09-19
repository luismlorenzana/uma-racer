import { useReducedMotion } from 'motion/react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useContent } from '../content/ContentProvider'
import { useGame } from '../game/store'
import { GameButton } from '../ui/GameButton'
import { Panel } from '../ui/Panel'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-ink-soft">{label}</span>
      <span className="font-extrabold">{value}</span>
    </div>
  )
}

export function SettingsScreen() {
  const auth = useAuth()
  const persistent = useGame((s) => s.persistent)
  const gameStatus = useGame((s) => s.status)
  const sync = useGame((s) => s.sync)
  const orphanedUmas = useGame((s) => s.orphanedUmaIds.length)
  const orphanedCards = useGame((s) => s.orphanedCardIds.length)
  const reduced = useReducedMotion()
  const content = useContent()
  const contentLabel =
    content.status === 'signed-out'
      ? 'Sign in first'
      : content.status === 'error'
        ? 'Unavailable'
        : content.status === 'empty'
          ? 'Not imported'
          : content.status === 'ready'
            ? `${content.content.manifest.version}${content.content.origin === 'offline-cache' ? ' · offline' : ''}`
            : '…'
  const contentCounts =
    content.status === 'ready'
      ? `${content.content.umas.items.length} Umas · ${content.content.cards.items.length} cards · ${content.content.skills.items.length} skills · ${content.content.races.items.length} races · ${content.content.courses.items.length} courses · 2 atlases`
      : '—'
  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="px-1 text-2xl font-extrabold text-white text-outline">Settings</h1>
      <Panel>
        <Row label="Signed in as" value={auth.user?.email ?? auth.user?.name ?? '—'} />
        <Row label="Local save" value={persistent ? 'IndexedDB' : 'Memory only'} />
        <Row label="Save state" value={gameStatus} />
        <Row label="Cloud sync" value={`${sync.status}${sync.pending ? ` · ${sync.pending} pending` : ''}`} />
        <Row label="Last synced" value={sync.lastSuccessAt ? new Date(sync.lastSuccessAt).toLocaleString() : '—'} />
        {(orphanedUmas > 0 || orphanedCards > 0) && <Row label="Missing references" value={`${orphanedUmas} Umas · ${orphanedCards} cards`} />}
        {sync.error && <p className="border-t border-sky-100 pt-2 text-xs font-bold text-red-700">{sync.error}</p>}
        <Row label="Content packs" value={contentLabel} />
        <div className="border-t border-sky-100 pt-2 text-right text-xs font-bold text-ink-soft">{contentCounts}</div>
        <Row label="Home Screen app" value={standalone ? 'Yes' : 'No (Safari tab)'} />
        <Row label="Reduced motion" value={reduced ? 'On' : 'Off'} />
      </Panel>
      {gameStatus === 'ready' && <Link to="/trainer" className="flex min-h-11 items-center justify-center rounded-xl bg-white px-4 font-extrabold text-violet-700 shadow-sm">Open Trainer profile</Link>}
      {auth.authRequired && (
        <GameButton variant="secondary" onClick={() => (auth.user ? auth.signOut() : auth.signIn())}>
          {auth.user ? 'Sign out' : 'Sign in with Google'}
        </GameButton>
      )}
      <p className="px-1 text-center text-xs text-ink-soft">
        Tip: on iPhone, turn off Safari → Advanced → Feature Flags → “Prefer Page Rendering Updates near 60fps” for 120 Hz.
      </p>
    </div>
  )
}
