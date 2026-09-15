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
  const manifest = useQuery({ queryKey: ['content-manifest'], queryFn: contentApi.manifest })
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
          value={manifest.isError ? 'API offline' : manifest.data?.version ?? (manifest.isLoading ? '…' : 'Not imported')}
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
