// Account (docs/game/11-hub-and-places.md §3.1; docs/game/02-check-ins-and-notifications.md §3, §9, §10; D157; M034;
// T138, SD4): uma-kit's Account frame (`AccountPage`), filled with this game's content: the trainer's name, saved as
// the trainer badge row this device writes; the wallet (Prize Money, Speed Tickets, Uma Tickets); this phone's
// Appearance (the kit's card); then this game's sections: check-in times (`set-check-in-times`), sync and Sync now,
// reduced motion and default race speed, and in dev builds only a dev section that loads the synthetic fixtures and
// runs `dev-grant`; App build and Content; and Sign out (the kit's auth). No notifications slot: push is off (D336).
// `?row=sync` opens at the sync row.
import { AccountPage as AccountFrame } from '@luismlorenzana/uma-kit/places'
import { Button, Chip, CloseIcon, Panel, UiMark } from '@luismlorenzana/uma-kit/ui'
import { SPEED_TICKET_ID } from '@racer/domain/items'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { APP_BUILD_ID } from '../../app/build'
import { useG2Content } from '../../app/content'
import { useGame, useHub, useRuntime } from '../../app/game'
import { amount } from '../../ui/labels'
import { badgeRow } from '../racing/trophy'
import { RACE_SPEEDS, setRaceSpeed, setReducedMotion, useDevicePrefs } from '../../ui/devicePrefs'
import { PlacePageHeader } from '../PlacePageHeader'
import { TapNoteLine, useTap } from '../../ui/work'
import { RacerUmaPicker as UmaPicker } from '../../ui/racerAlbum'
import { umaName } from '../../ui/words'
import type { PageProps } from '../registry'
import { checkInTimes, clockOf, DEV_GRANTS, MAX_CHECK_INS, renamedTrainer, SYNC_WORDS, TRAINER_NAME_MAX } from './model'

function CheckInTimes() {
  const saved = useGame((snapshot) => snapshot.state?.profile.checkIns ?? [])
  const tap = useTap()
  const [said, setSaid] = useState<string | null>(null)
  const [fields, setFields] = useState<readonly string[]>(() => saved.map(clockOf))
  const key = saved.join(',')
  useEffect(() => setFields(saved.map(clockOf)), [key])
  const times = checkInTimes(fields)
  const changed = times === null || times.join(',') !== key
  return (
    <Panel className="space-y-2 p-3" aria-label="Check-in times" data-g2="check-in-times">
      <h2 className="text-[15px] font-semibold">Check-in times</h2>
      <p className="text-[13px] text-ink-soft">The size picker marks the job that fits the next one. One to four a day.</p>
      <ul className="space-y-1.5">
        {fields.map((value, i) => (
          <li key={i} className="flex items-center gap-2">
            <input type="time" value={value} aria-label={`Check-in ${i + 1}`} required
              onChange={(event) => setFields((all) => all.map((field, j) => (j === i ? event.target.value : field)))}
              className="min-h-11 flex-1 rounded-sm border border-hairline-strong bg-panel px-3 text-[15px]" />
            <button type="button" aria-label={`Remove check-in ${i + 1}`} disabled={fields.length <= 1}
              onClick={() => setFields((all) => all.filter((_, j) => j !== i))}
              className="flex size-11 items-center justify-center rounded-sm text-ink-soft disabled:opacity-30">
              <CloseIcon size={20} />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={fields.length >= MAX_CHECK_INS} onClick={() => setFields((all) => [...all, '12:00'])}>Add a time</Button>
        <Button size="sm" className="flex-1" disabled={!changed || times === null || tap.pending !== null}
          onClick={() => times !== null && void tap.run('set-check-in-times', { times }, 'set-check-in-times').then((answer) => {
            setSaid(answer?.kind === 'done' ? `Saved: ${answer.receipt.times.map(clockOf).join(', ')}.` : null)
          })}>
          Save times
        </Button>
      </div>
      {fields.length >= MAX_CHECK_INS && <p className="text-[12px] text-ink-soft">Four is the most.</p>}
      {times === null && <p className="text-[12px] text-danger">Fill in every time, or remove it.</p>}
      <TapNoteLine tap={tap} />
      {said !== null && <p role="status" className="text-[13px] text-ink">{said}</p>}
    </Panel>
  )
}

function DevSection() {
  const { game } = useRuntime()
  const featured = useHub()?.featured ?? null
  const content = useGame((snapshot) => snapshot.env?.content ?? null)
  const tap = useTap()
  const [said, setSaid] = useState<string | null>(null)
  const [umaId, setUmaId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const who = umaId ?? featured
  const fixtures = game.fixtures ?? []
  return (
    <Panel className="space-y-3 border-dashed p-3" aria-label="Dev" data-g2="dev">
      <h2 className="text-[15px] font-semibold">Dev</h2>
      <p className="text-[13px] text-ink-soft">Dev builds only. Grants are ledger rows marked as dev grants, so the server's copy follows.</p>
      {fixtures.length > 0 && (
        <div>
          <p className="text-micro mb-1">Load a synthetic account</p>
          <div className="flex flex-wrap gap-1.5">
            {fixtures.map((name) => (
              <Chip key={name} className="min-h-11" disabled={loading !== null}
                onClick={() => { setLoading(name); void game.loadFixture?.(name).finally(() => setLoading(null)) }}>
                {loading === name ? 'Loading…' : name}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-1.5">
        {DEV_GRANTS.map((grant) => (
          <Button key={grant.key} variant="secondary" size="sm" disabled={tap.pending !== null}
            onClick={() => void tap.run('dev-grant', grant.input, `dev-grant:${grant.key}`).then((answer) => {
              setSaid(answer?.kind === 'done' ? 'Granted.' : null)
            })}>
            {grant.label}
          </Button>
        ))}
      </div>
      <div className="space-y-1.5">
        <button type="button" onClick={() => setPicking(true)} className="min-h-11 w-full rounded-sm border border-hairline-strong bg-panel px-3 text-left text-[13px] font-semibold">
          Uma: {who === null ? 'none yet' : umaName(content, who)}
        </button>
        <div className="grid grid-cols-2 gap-1.5">
          <Button variant="secondary" size="sm" disabled={who === null || tap.pending !== null}
            onClick={() => who !== null && void tap.run('dev-grant', { finish: who }, 'dev-grant:finish').then((answer) => {
              setSaid(answer?.kind !== 'done' ? null : answer.receipt.finished === null ? 'Nothing of hers was running.' : 'Her work ends now.')
            })}>
            Finish her work
          </Button>
          <Button variant="secondary" size="sm" disabled={who === null || tap.pending !== null}
            onClick={() => who !== null && void tap.run('dev-grant', { gate: who }, 'dev-grant:gate').then((answer) => {
              setSaid(answer?.kind === 'done' ? `At her gate, Racing Lv ${answer.receipt.gate?.level ?? ''}.` : null)
            })}>
            Jump to her gate
          </Button>
        </div>
        {who === null && <p className="text-[12px] text-ink-soft">Unlock an Uma first.</p>}
      </div>
      <TapNoteLine tap={tap} />
      {said !== null && <p role="status" className="text-[13px] text-ink">{said}</p>}
      <UmaPicker open={picking} onClose={() => setPicking(false)} title="Dev grants for" selectedIds={who === null ? [] : [who]} onPick={setUmaId} />
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
        <p className="text-[14px]" data-g2="sync-words">{SYNC_WORDS[sync]}</p>
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
  const name = useGame((snapshot) => snapshot.trainerName)
  const stored = useGame((snapshot) => snapshot.badges?.['trainer'])
  const profile = useGame((snapshot) => snapshot.state?.profile ?? null)
  const speedTickets = useGame((snapshot) => snapshot.state?.items[SPEED_TICKET_ID] ?? 0)
  const content = useG2Content()
  const writeDevice = game.writeDevice
  const signOut = game.signOut

  return (
    <div data-place-page="account">
      <PlacePageHeader place={place} rest={rest} lines={['Settings for this account and this phone.']} />
      <AccountFrame
        {...(writeDevice === undefined ? {} : {
          rename: {
            value: name || 'Trainer',
            maxLength: TRAINER_NAME_MAX,
            onSave: (next: string) => writeDevice({ badges: badgeRow(renamedTrainer(stored, next, game.now())) }),
          },
        })}
        wallet={profile === null ? [] : [
          { key: 'prize-money', icon: <UiMark mark="currency/prize-money" />, value: amount(profile.prizeMoney), label: 'Prize Money' },
          { key: 'speed-tickets', icon: <UiMark mark="currency/speed-ticket" />, value: speedTickets, label: 'Speed Tickets' },
          { key: 'uma-tickets', icon: <UiMark mark="currency/uma-ticket" />, value: profile.umaTickets, label: 'Uma Tickets' },
        ]}
        sections={(
          <>
            <CheckInTimes />
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
