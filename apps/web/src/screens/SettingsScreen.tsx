import { useQuery } from '@tanstack/react-query'
import { useReducedMotion } from 'motion/react'
import { contentApi } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
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
  const reduced = useReducedMotion()
  // Signed-out requests would only ever 401, so don't make them; label the state honestly instead.
  const signedIn = !auth.authRequired || auth.user !== null
  const manifest = useQuery({ queryKey: ['content-manifest'], queryFn: contentApi.manifest, enabled: signedIn })
  const contentLabel = !signedIn
    ? 'Sign in first'
    : manifest.isError
      ? 'API offline'
      : manifest.data
        ? (manifest.data.version ?? 'Not imported')
        : '…'
  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="px-1 text-2xl font-extrabold text-white text-outline">Settings</h1>
      <Panel>
        <Row label="Signed in as" value={auth.user?.email ?? auth.user?.name ?? '—'} />
        <Row label="Local save" value={persistent ? 'IndexedDB' : 'Memory only'} />
        <Row
          label="Content packs"
          value={contentLabel}
        />
        <Row label="Home Screen app" value={standalone ? 'Yes' : 'No (Safari tab)'} />
        <Row label="Reduced motion" value={reduced ? 'On' : 'Off'} />
      </Panel>
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
