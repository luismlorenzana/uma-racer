// Account (docs/rework/11-hub-and-places.md §3.1; docs/rework/02-check-ins-and-notifications.md §3, §9, §10; D157; M034;
// T138): the trainer's name (edited in the Trophy Hall), check-in times (`set-check-in-times`), sync and Sync now, this
// device's reduced motion and default race speed, App build and Content, sign-out, and in dev builds only a dev section
// that loads the synthetic fixtures and runs `dev-grant`. `?row=sync` opens at the sync row. Notifications are phase 4.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '../../../ui/Button'
import { Chip } from '../../../ui/Chip'
import { CloseIcon } from '../../../ui/icons'
import { Panel } from '../../../ui/Panel'
import { useG2Content } from '../../app/content'
import { useGame, useHub, useRuntime } from '../../app/game'
import { RACE_SPEEDS, setRaceSpeed, setReducedMotion, useDevicePrefs } from '../../ui/devicePrefs'
import { PlaceHeader } from '../../ui/PlaceHeader'
import { TapNoteLine, useTap } from '../../ui/work'
import { UmaPicker } from '../../ui/UmaPicker'
import { umaName } from '../../ui/words'
import type { PageProps } from '../registry'
import { checkInTimes, clockOf, DEV_GRANTS, MAX_CHECK_INS, SYNC_WORDS } from './model'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 text-[14px]">
      <span className="text-ink-soft">{label}</span>
      <span className="min-w-0 text-right font-semibold">{children}</span>
    </div>
  )
}

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

export default function AccountPage({ place, rest }: PageProps) {
  const [params] = useSearchParams()
  const { game } = useRuntime()
  const name = useGame((snapshot) => snapshot.trainerName)
  const sync = useGame((snapshot) => snapshot.sync)
  const content = useG2Content()
  const prefs = useDevicePrefs()
  const syncRow = useRef<HTMLElement>(null)
  const [signingOut, setSigningOut] = useState(false)
  useEffect(() => {
    if (params.get('row') === 'sync') syncRow.current?.scrollIntoView?.({ block: 'start' })
  }, [params])

  return (
    <div data-place-page="account">
      <PlaceHeader place={place} rest={rest} lines={['Settings for this account and this phone. Notifications come later.']} />
      <div className="space-y-3 px-4 pt-3 pb-24">
        <Panel className="p-3" aria-label="Trainer">
          <Row label="Trainer">{name || 'Trainer'}</Row>
          <Link to="/racing/trophy-hall/trainer" state={{ back: true }} className="flex min-h-11 items-center text-[13px] font-semibold text-accent-strong">
            Change the name in the Trophy Hall
          </Link>
        </Panel>
        <CheckInTimes />
        <section ref={syncRow} aria-label="Sync" className="scroll-mt-16" data-row="sync">
          <Panel className="space-y-2 p-3">
            <h2 className="text-[15px] font-semibold">Sync</h2>
            <p className="text-[14px]" data-g2="sync-words">{SYNC_WORDS[sync]}</p>
            <Button variant="secondary" size="sm" disabled={game.syncNow === undefined || sync === 'paused'} onClick={() => game.syncNow?.()}>Sync now</Button>
            {game.syncNow === undefined && <p className="text-[12px] text-ink-soft">Nothing is waiting to sync.</p>}
            {game.syncNow !== undefined && sync === 'paused' && <p className="text-[12px] text-ink-soft">Sign in first.</p>}
          </Panel>
        </section>
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
        <Panel className="p-3" aria-label="About">
          <Row label="App build">{__APP_BUILD_ID__}</Row>
          <Row label="Content">{content === null ? 'Not loaded here' : `${content.manifest.version} · ${content.origin === 'offline-cache' ? 'offline' : 'network'}`}</Row>
        </Panel>
        <div>
          <Button variant="destructive" className="w-full" disabled={game.signOut === undefined || signingOut}
            onClick={() => { setSigningOut(true); void game.signOut?.().finally(() => setSigningOut(false)) }}>
            Sign out
          </Button>
          {game.signOut === undefined && <p className="mt-1 text-center text-[12px] text-ink-soft">Nobody is signed in on this phone.</p>}
        </div>
        {import.meta.env.DEV && <DevSection />}
      </div>
    </div>
  )
}
