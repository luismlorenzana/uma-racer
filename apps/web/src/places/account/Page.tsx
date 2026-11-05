// Account (docs/game/11-hub-and-places.md §3.1; D157; M034; T138, SD4, T152): uma-kit's Account frame (`AccountPage`),
// filled with this game's content: the wallet (Uma Tickets and Card Tickets); this phone's Appearance (the kit's card);
// then this game's sections: sync and Sync now, reduced motion and the default race speed, and in dev builds only a dev
// section that runs `dev-grant` for tickets; App build and Content; and Sign out (the kit's auth). No notifications slot:
// push is off (D336). `?row=sync` opens at the sync row.
import { AccountPage as AccountFrame } from '@luismlorenzana/uma-kit/places'
import { Button, Chip, Panel, UiMark } from '@luismlorenzana/uma-kit/ui'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { APP_BUILD_ID } from '../../app/build'
import { useLoadedContent } from '../../app/content'
import { useGame, useHub, useRuntime } from '../../app/game'
import { RACE_SPEEDS, setRaceSpeed, setReducedMotion, useDevicePrefs } from '../../ui/devicePrefs'
import { PlacePageHeader } from '../PlacePageHeader'
import type { PageProps } from '../registry'
import { DEV_GRANTS, SYNC_WORDS } from './model'

function DevSection() {
  const { game } = useRuntime()
  const [pending, setPending] = useState<string | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const grant = async (key: string, input: unknown) => {
    setPending(key)
    setSaid(null)
    try {
      const answer = await game.run('dev-grant', input, `dev-grant:${key}`)
      setSaid(answer.kind === 'done' ? 'Granted.' : answer.text)
    } catch {
      setSaid("That didn't work. Try again.")
    } finally {
      setPending(null)
    }
  }
  return (
    <Panel className="space-y-3 border-dashed p-3" aria-label="Dev" data-racer="dev">
      <h2 className="text-[15px] font-semibold">Dev</h2>
      <p className="text-[13px] text-ink-soft">Dev builds only. Grants run on the server too, where it allows dev operations.</p>
      <div className="grid gap-1.5">
        {DEV_GRANTS.map((entry) => (
          <Button key={entry.key} variant="secondary" size="sm" disabled={pending !== null} onClick={() => void grant(entry.key, entry.input)}>
            {entry.label}
          </Button>
        ))}
      </div>
      {said !== null && <p role="status" className="text-[13px] text-ink">{said}</p>}
    </Panel>
  )
}

function SyncSection() {
  const [params] = useSearchParams()
  const { game } = useRuntime()
  const sync = useGame((snapshot) => snapshot.sync)
  const row = useRef<HTMLElement>(null)
  useEffect(() => {
    if (params.get('row') === 'sync') row.current?.scrollIntoView?.({ block: 'start' })
  }, [params])
  return (
    <section ref={row} aria-label="Sync" className="scroll-mt-16" data-row="sync">
      <Panel className="space-y-2 p-3">
        <h2 className="text-[15px] font-semibold">Sync</h2>
        <p className="text-[14px]" data-racer="sync-words">{SYNC_WORDS[sync]}</p>
        <Button variant="secondary" size="sm" disabled={game.syncNow === undefined || sync === 'paused'} onClick={() => game.syncNow?.()}>Sync now</Button>
        {game.syncNow === undefined && <p className="text-[12px] text-ink-soft">Nothing is waiting to sync.</p>}
      </Panel>
    </section>
  )
}

/** Reduced motion and the default race speed, on this phone only (Appearance is the kit's own card). */
function ThisPhone() {
  const prefs = useDevicePrefs()
  return (
    <Panel className="space-y-2 p-3" aria-label="This phone">
      <h2 className="text-[15px] font-semibold">This phone</h2>
      <label className="flex min-h-11 items-center justify-between gap-3 text-[14px]">
        <span>Reduce motion</span>
        <input type="checkbox" role="switch" checked={prefs.reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} className="size-6 accent-[var(--color-accent)]" />
      </label>
      <div className="flex min-h-11 items-center justify-between gap-3 text-[14px]">
        <span>Race speed</span>
        <span className="flex gap-1.5" role="group" aria-label="Race speed">
          {RACE_SPEEDS.map((speed) => <Chip key={speed} selected={prefs.raceSpeed === speed} className="min-h-11 min-w-11 justify-center" onClick={() => setRaceSpeed(speed)}>{speed}×</Chip>)}
        </span>
      </div>
      <p className="text-[12px] text-ink-soft">Kept on this phone only.</p>
    </Panel>
  )
}

export default function AccountPage({ place, rest }: PageProps) {
  const { game } = useRuntime()
  const wallet = useHub()?.wallet ?? null
  const content = useLoadedContent()
  const signOut = game.signOut

  return (
    <div data-place-page="account">
      <PlacePageHeader place={place} rest={rest} lines={['Settings for this account and this phone.']} />
      <AccountFrame
        wallet={wallet === null ? [] : [
          { key: 'uma-tickets', icon: <UiMark mark="currency/uma-ticket" />, value: wallet.umaTickets, label: 'Uma Tickets' },
          { key: 'card-tickets', icon: <UiMark mark="currency/card-ticket" />, value: wallet.cardTickets, label: 'Card Tickets' },
        ]}
        sections={(
          <>
            <SyncSection />
            <ThisPhone />
            {import.meta.env.DEV && <DevSection />}
          </>
        )}
        info={[
          { label: 'App build', value: APP_BUILD_ID },
          { label: 'Content', value: content === null ? 'Not loaded here' : `${content.manifest.version} · ${content.origin === 'offline-cache' ? 'offline' : 'network'}` },
        ]}
        {...(signOut === undefined ? {} : { onSignOut: () => signOut() })}
      />
    </div>
  )
}
