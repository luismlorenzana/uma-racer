// The Scenario Gate (T141; docs/game/03-uma-progression.md §4, §5, §10.8; 04 §9; 11 §3.3, §6): every Uma's career at
// `/racing/scenario-gate`, one Uma's at `/:umaId`, the Advance sheet (`?sheet=advance`), the Promote sheet
// (`?sheet=promote`, only for an Uma who holds a completed run: before phase 9, the dev proof), and the full-screen
// ceremony at `/:umaId/ceremony?op=` after either. Both operations run through the port with their flair in the same
// transaction; a refused or stale tap redraws the sheet under "Her build changed." and keeps the button.
import { badgeStateId, STATS, type DistanceCategory } from '@racer/domain'
import type { Place } from '@racer/domain/hub'
import { scenarioNumber } from '@racer/domain/tiers'
import { sameData } from '@racer/domain/save'
import type { OperationRecord, UmaState } from '@racer/domain/state'
import { m } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { buildFlairFanfare, buildTrainerFlairFanfare } from './flair-view'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { Crest } from '../../ui/Crest'
import { FlairCards } from '../../ui/FlairCards'
import { RaceMarkIcon } from '../../ui/RaceMarkIcon'
import { SegmentedControl } from '../../ui/SegmentedControl'
import { NO_RECORDS, useGame, useNow, useRuntime, type G2Applied } from '../../app/game'
import { useReducedMotionSetting } from '../../app/motion'
import { PlaceHeader } from '../../ui/PlaceHeader'
import { placeName, TapNoteLine, useTap } from '../../ui/work'
import { UmaArt, UmaFace } from '../../ui/UmaArt'
import type { PageProps } from '../registry'
import { useRaceContent } from './content'
import { deviceRows, eventsOfCommit, leaveFlair } from './flair'
import { advanceSheet, careerRow, careerRows, promoteInput, promoteSheet, type AdvanceSheet as AdvanceView, type CareerRow } from './gate'
import { useRecords } from './records'
import { rowsOf } from './today'
import { profilePath } from '../stable/model'
import { amount, racingWords } from './words'
import type { LoadedContent } from '../../content/runtime'
import type { OperationEnv } from '@racer/domain/check-in'
import { clockTime } from '@racer/domain/check-in'
import { endsAt, type WorkRow } from '@racer/domain/work'

const PRESET_NAME: Record<DistanceCategory, string> = { sprint: 'Sprint', mile: 'Mile', medium: 'Medium', long: 'Long' }
const STAT_SHORT = { speed: 'Spd', stamina: 'Sta', power: 'Pow', guts: 'Gut', wit: 'Wit' } as const

/** The device's flair for an Uma leaving her scenario (advance, promotion). */
const leaveDevice = (content: LoadedContent, env: OperationEnv, umaId: string) => (applied: G2Applied) =>
  deviceRows(leaveFlair({ state: applied.state, records: applied.records, content, env, now: applied.at }, applied.before.umas[umaId]!, applied.state.umas[umaId]!, applied.id))

function useNames(content: LoadedContent | null) {
  return useMemo(() => ({
    uma: (umaId: string) => content?.umas.byId.get(umaId)?.name ?? umaId,
    race: (raceId: string) => content?.races.byId.get(raceId)?.name ?? raceId,
  }), [content])
}

function CareerCard({ row, link }: { row: CareerRow; link: boolean }) {
  const body = (
    <>
      <div className="flex items-center gap-3">
        <UmaFace outfitId={row.umaId} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{row.name}</p>
          <p className="truncate text-[12px] text-ink-soft">{racingWords('gate-row', { tier: row.tier, scenario: row.scenarioName, level: row.level })}</p>
        </div>
        {row.ready && <span className="font-display shrink-0 rounded-full bg-accent px-2 text-[11px] leading-5 font-bold text-ink">{racingWords('ready-to-advance')}</span>}
      </div>
      <p className="mt-2 text-[13px] font-semibold text-ink">{row.stage}</p>
      {row.held !== null && !row.atGate && <p className="text-[12px] text-ink-soft">{racingWords('gate-held', { level: row.held })}</p>}
      <ul className="mt-1.5 grid gap-1" aria-label={racingWords('goal-races')}>
        {row.goals.map((goal) => (
          <li key={`${goal.raceId}:${goal.set ?? ''}`} className="flex min-h-6 items-center gap-2 text-[12px]">
            <RaceMarkIcon kind={goal.set ? 'set' : 'goal'} label={goal.won ? 'Won' : 'To win'} className={`h-4 w-4 shrink-0 ${goal.won ? 'text-accent-strong' : 'text-ink-faint'}`} />
            <span className={`min-w-0 flex-1 truncate ${goal.won ? 'text-ink-soft line-through' : 'font-semibold text-ink'}`}>{goal.name}</span>
          </li>
        ))}
      </ul>
    </>
  )
  return link
    ? <Link to={`/racing/scenario-gate/${encodeURIComponent(row.umaId)}`} state={{ back: true }} className="block rounded-md border border-hairline bg-panel p-3 shadow-1" data-career={row.umaId}>{body}</Link>
    : <div className="rounded-md border border-hairline bg-panel p-3 shadow-1" data-career={row.umaId}>{body}</div>
}

function StatTable({ sheet, preset }: { sheet: AdvanceView; preset: DistanceCategory }) {
  const delta = sheet.presets.find((entry) => entry.preset === preset)!
  return (
    <table className="w-full text-[13px]" aria-label={racingWords('stats-before-after', { preset: PRESET_NAME[preset] })}>
      <tbody>
        {STATS.map((stat) => (
          <tr key={stat} className="border-b border-ink/5">
            <th scope="row" className="py-1 text-left font-semibold text-ink-soft">{STAT_SHORT[stat]}</th>
            <td className="py-1 text-right tabular-nums">{delta.before.stats[stat]}</td>
            <td className="py-1 text-center text-ink-faint">→</td>
            <td className="font-display py-1 text-right font-semibold tabular-nums">{delta.after.stats[stat]}</td>
            <td className="py-1 pl-2 text-right text-[11px] text-ink-soft">{racingWords('stat-cap', { cap: amount(delta.after.caps[stat]) })}</td>
          </tr>
        ))}
        <tr>
          <th scope="row" className="py-1 text-left font-semibold text-ink-soft">{racingWords('sp')}</th>
          <td className="py-1 text-right tabular-nums">{delta.before.skillPoints}</td>
          <td className="py-1 text-center text-ink-faint">→</td>
          <td className="font-display py-1 text-right font-semibold tabular-nums">{delta.after.skillPoints}</td>
          <td className="py-1 pl-2 text-right text-[11px] text-ink-soft">{racingWords('stat-cap', { cap: amount(delta.after.spCap) })}</td>
        </tr>
      </tbody>
    </table>
  )
}

function AdvancePanel({ uma, content, env, onClose }: { uma: UmaState; content: LoadedContent; env: OperationEnv; onClose: () => void }) {
  const navigate = useNavigate()
  const { game } = useRuntime()
  const state = useGame((snapshot) => snapshot.state)!
  const now = useNow()
  const names = useNames(content)
  const [preset, setPreset] = useState<DistanceCategory>(uma.raceDefaults.selectedPreset)
  const [busy, setBusy] = useState(false)
  const [changed, setChanged] = useState(false)
  // The Uma the owner has seen: a race or session that changes her after this redraws the sheet first (03 §10.8). It is
  // compared by content: every sync or pull hands the store an equal copy of her, which is no change at all.
  const seen = useRef(uma)
  const sheet = useMemo(() => advanceSheet(state, uma.outfitId, env, now, names.race), [state, uma.outfitId, env, now, names])
  if (sheet === null) return <p className="py-6 text-center text-[13px] text-ink-soft">{racingWords('her-build-changed')}</p>

  const advance = async () => {
    if (busy) return
    const current = game.getSnapshot().state?.umas[uma.outfitId]
    if (!sameData(current, seen.current)) {
      seen.current = current ?? uma
      setChanged(true)
      return
    }
    setBusy(true)
    const answer = await game.run('advance-scenario', { umaId: uma.outfitId }, `advance:${uma.outfitId}`, { device: leaveDevice(content, env, uma.outfitId) })
    setBusy(false)
    if (answer.kind === 'done') {
      navigate(`/racing/scenario-gate/${encodeURIComponent(uma.outfitId)}/ceremony?op=${encodeURIComponent(answer.id)}`, { replace: true })
      return
    }
    seen.current = game.getSnapshot().state?.umas[uma.outfitId] ?? uma
    setChanged(true)
  }

  return (
    <div className="flex flex-col gap-3" data-g2="advance-sheet">
      <h2 className="font-display text-xl font-semibold">{racingWords('advance-title', { name: names.uma(uma.outfitId) })}</h2>
      {changed && <p role="status" className="rounded-sm bg-warning/15 px-3 py-2 text-[13px] font-semibold text-warning">{racingWords('her-build-changed')}</p>}
      <div className="flex items-center gap-2">
        <Crest tone="neutral">T{sheet.from.T}</Crest>
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{racingWords('advance-move', { from: sheet.from.name, to: sheet.to.name })}</span>
        <Crest tone="accent">T{sheet.to.T}</Crest>
      </div>
      <p className="font-display text-[15px] font-semibold text-accent-strong">{racingWords('advance-level', { from: sheet.levelFrom, to: sheet.levelTo })}</p>
      <SegmentedControl
        label={racingWords('stats-before-after', { preset: PRESET_NAME[preset] })}
        value={preset}
        onChange={setPreset}
        options={sheet.presets.map((entry) => ({ value: entry.preset, label: PRESET_NAME[entry.preset] }))}
      />
      <StatTable sheet={sheet} preset={preset} />
      <div>
        <p className="font-display text-[13px] font-semibold">{racingWords('new-layer')}</p>
        <p className="text-[13px] text-ink-soft">{sheet.layer.join(' · ')}</p>
        {sheet.unfinished.map((line) => <p key={line} className="text-[13px] text-ink-soft">{line}</p>)}
      </div>
      <div>
        <p className="font-display text-[13px] font-semibold">{racingWords('new-buff')}</p>
        <p className="text-[13px] text-ink-soft"><span className="font-semibold text-ink">{sheet.buff.name}</span> · {sheet.buff.rule}</p>
      </div>
      <div>
        <p className="font-display text-[13px] font-semibold">{racingWords('new-career')}</p>
        <ul className="mt-1 grid gap-0.5 text-[13px]">
          {sheet.career.map((goal) => <li key={`${goal.raceId}:${goal.set ?? ''}`} className="truncate">{goal.name}</li>)}
        </ul>
      </div>
      <p className="font-display text-center text-[15px] font-semibold text-success">{racingWords('free')}</p>
      <div className="grid grid-cols-2 gap-2 pb-2">
        <Button variant="secondary" onClick={onClose}>{racingWords('not-yet')}</Button>
        <Button disabled={busy} onClick={() => void advance()} data-advance>{racingWords('advance')}</Button>
      </div>
    </div>
  )
}

function workOf(row: WorkRow | undefined, now: number) {
  const entry = row?.entries[row.entries.length - 1]
  const building = row?.slot?.building
  if (!row || !entry || !building) return null
  const end = endsAt(entry)
  return { place: placeName(building), end, ready: end <= now, startedAt: entry.startedAt, queued: row.queue.length }
}

function PromotePanel({ uma, content, env, onClose }: { uma: UmaState; content: LoadedContent; env: OperationEnv; onClose: () => void }) {
  const navigate = useNavigate()
  const { game } = useRuntime()
  const state = useGame((snapshot) => snapshot.state)!
  const records = useRecords() ?? NO_RECORDS
  const now = useNow()
  const names = useNames(content)
  const [busy, setBusy] = useState(false)
  const [changed, setChanged] = useState(false)
  const tap = useTap()
  const sheet = promoteSheet(state, uma.outfitId, rowsOf(records.raceResults, uma.outfitId), content.races.byId)
  if (sheet === null) return <p className="py-6 text-center text-[13px] text-ink-soft">{racingWords('her-build-changed')}</p>
  const work = workOf(state.work[uma.outfitId] as WorkRow | undefined, now)
  const offset = game.utcOffsetMin(now)
  const badge = records.badges[badgeStateId(uma.outfitId)]
  const tierRange = [5 * (uma.tier - 1) + 1, 5 * uma.tier] as const
  const titles = badge?.scope === 'uma' ? badge.awards.titles.filter((title) => (title.source.tier ?? 0) >= tierRange[0] && (title.source.tier ?? 0) <= tierRange[1]).length : 0
  // Collect, Recall and −30m are the work operations as every place runs them (T140's `useTap`): nothing new here.
  const workKey = `work:${uma.outfitId}`
  const working = tap.pending !== null
  const promote = async () => {
    if (busy) return
    setBusy(true)
    const current = game.getSnapshot().state!.umas[uma.outfitId]!
    const answer = await game.run('promote', promoteInput(current, env), `promote:${uma.outfitId}`, { device: leaveDevice(content, env, uma.outfitId) })
    setBusy(false)
    if (answer.kind === 'done') {
      navigate(`/racing/scenario-gate/${encodeURIComponent(uma.outfitId)}/ceremony?op=${encodeURIComponent(answer.id)}`, { replace: true })
      return
    }
    setChanged(true)
  }

  return (
    <div className="flex flex-col gap-3" data-g2="promote-sheet">
      <h2 className="font-display text-xl font-semibold">{racingWords('promote-title', { name: names.uma(uma.outfitId) })}</h2>
      {changed && <p role="status" className="rounded-sm bg-warning/15 px-3 py-2 text-[13px] font-semibold text-warning">{racingWords('her-build-changed')}</p>}
      <div className="flex items-center gap-3">
        <UmaFace outfitId={uma.outfitId} size={48} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2"><Crest>T{sheet.from}</Crest><span className="text-[15px] font-semibold">{racingWords('promote-move', { from: sheet.from, to: sheet.to })}</span><Crest tone="accent">T{sheet.to}</Crest></p>
          <p className="text-[13px] text-ink-soft">{sheet.arrive}</p>
        </div>
      </div>
      <div className="rounded-md bg-sunken p-3 text-[13px]">
        <p className="font-display font-semibold">{racingWords('tier-numbers')}</p>
        <p>{racingWords('tier-races', { races: sheet.races, wins: sheet.wins, g1: sheet.g1Wins })}</p>
        <p>{racingWords('tier-titles', { n: titles })}</p>
        <p>{racingWords('tier-expedition', { wins: sheet.expeditionWins })}</p>
      </div>
      <div className="grid gap-1 text-[13px]">
        <p><span className="font-semibold">{racingWords('resets')}:</span> {racingWords('resets-list')}</p>
        <p><span className="font-semibold">{racingWords('carries')}:</span> {racingWords('carries-list')}</p>
      </div>
      <div className="rounded-md border border-hairline p-3">
        <p className="font-display text-[13px] font-semibold">{racingWords('her-work')}</p>
        {work === null ? <p className="text-[13px] font-semibold text-success">{racingWords('free')}</p> : (
          <>
            <p className="text-[13px]">
              {work.ready ? racingWords('work-ready', { place: work.place }) : racingWords('work-running', { place: work.place, time: clockTime(work.end, offset) })}
              {work.queued > 0 ? ` · ${racingWords('work-queued', { n: work.queued })}` : ''}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Button variant="secondary" size="sm" disabled={busy || working || !work.ready} onClick={() => void tap.run('collect', { outfitId: uma.outfitId }, workKey)}>{racingWords('collect')}</Button>
              <Button variant="secondary" size="sm" disabled={busy || working} onClick={() => void tap.run('recall', { outfitId: uma.outfitId }, workKey)}>{racingWords('recall')}</Button>
              <Button variant="secondary" size="sm" disabled={busy || working || work.ready} onClick={() => void tap.run('speed-up', { outfitId: uma.outfitId, startedAt: work.startedAt, tickets: 1 }, workKey)}>{racingWords('speed-up')}</Button>
            </div>
            <TapNoteLine tap={tap} className="mt-2" />
          </>
        )}
      </div>
      <p className="font-display text-center text-[15px] font-semibold text-accent-strong">{racingWords('uma-ticket', { n: sheet.ticket })}</p>
      <div className="grid grid-cols-2 gap-2 pb-2">
        <Button variant="secondary" onClick={onClose}>{racingWords('not-yet')}</Button>
        <Button disabled={busy || !sheet.ready} onClick={() => void promote()} data-promote>{racingWords('promote')}</Button>
      </div>
    </div>
  )
}

/**
 * The operation's log row for the ceremony, read through the port as the device save keeps it (T136): the state never
 * carries it once the tap is confirmed. Undefined while it reads; null when the device has none.
 */
function useOperation(opId: string): OperationRecord | null | undefined {
  const { game } = useRuntime()
  const [found, setFound] = useState<{ readonly opId: string; readonly row: OperationRecord | null } | null>(null)
  useEffect(() => {
    let live = true
    const read = game.logs?.operation(opId) ?? Promise.resolve(null)
    read.then((row) => { if (live) setFound({ opId, row }) }, () => { if (live) setFound({ opId, row: null }) })
    return () => { live = false }
  }, [game, opId])
  return found === null || found.opId !== opId ? undefined : found.row
}

/**
 * After Advance or Promote (03 §5, 04 §9): her awards play, then her profile opens; Skip or reduced motion go at once.
 * It always has its way out: the buttons show from the first frame, and the timer starts once the operation has been
 * read, found or not, so a ceremony whose tap the device can't find still leaves for her profile.
 */
function Ceremony({ umaId }: { umaId: string }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // The app's rule (`app/motion.tsx`): the system setting or Account's switch, as the run's result reads it.
  const reduced = useReducedMotionSetting()
  const state = useGame((snapshot) => snapshot.state)
  const records = useRecords()
  const content = useRaceContent()
  const op = useOperation(params.get('op') ?? '')
  const read = op !== undefined
  const leave = () => navigate(profilePath(umaId), { replace: true })
  useEffect(() => {
    if (!read) return
    const timer = setTimeout(() => navigate(profilePath(umaId), { replace: true }), reduced ? 2500 : 6000)
    return () => clearTimeout(timer)
  }, [read, reduced, navigate, umaId])
  const uma = state?.umas[umaId]
  const events = records && op ? eventsOfCommit(records, umaId, op.at) : []
  const badge = records?.badges[badgeStateId(umaId)]
  const flair = content && badge?.scope === 'uma' ? buildFlairFanfare(content, badge, events, events.filter((event) => event.scope === 'uma').map((event) => event.id)) : []
  const trainer = records?.badges.trainer
  const trainerFlair = content && trainer?.scope === 'trainer' ? buildTrainerFlairFanfare(content, trainer, events, events.map((event) => event.id)) : []
  const promoted = op?.name === 'promote'
  const receipt = (op?.receipt ?? {}) as { readonly from?: unknown; readonly to?: unknown; readonly ticketsPaid?: number }
  const fromTier = promoted ? Number(receipt.from) : null
  const toTier = promoted ? Number(receipt.to) : null
  const graduate = flair.find((item) => item.awardKey.endsWith(':graduate'))
  const title = promoted ? racingWords('promoted-title', { tier: toTier ?? '' }) : graduate?.label ?? racingWords('graduate-title', { scenario: uma ? String(scenarioNumber(uma)) : '' })
  return (
    <div className="pt-safe pb-safe fixed inset-0 z-40 flex flex-col items-center gap-4 overflow-y-auto bg-stage px-6 py-8 text-ink-on-dark" data-g2="ceremony" data-op={op === undefined ? 'reading' : op === null ? 'missing' : 'found'}>
      {promoted && (
        <div className="relative flex h-8 items-center justify-center">
          <m.span className="absolute" initial={{ opacity: 1, scale: 1 }} animate={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }} transition={{ duration: reduced ? 0 : 0.6, delay: reduced ? 0 : 0.4 }}><Crest>T{fromTier}</Crest></m.span>
          <m.span className="absolute" initial={reduced ? false : { opacity: 0, scale: 1.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reduced ? 0 : 0.5, delay: reduced ? 0 : 0.9 }}><Crest tone="accent">T{toTier}</Crest></m.span>
        </div>
      )}
      <UmaArt outfitId={umaId} size={140} />
      {op && <m.h1 className="font-display text-center text-2xl font-bold" initial={reduced ? false : { y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: reduced ? 0 : 0.3 }}>{title}</m.h1>}
      <div className="w-full max-w-sm text-ink">
        {flair.length > 0 && <FlairCards title={racingWords('promoted-awards')} items={flair} animate={!reduced} />}
        {promoted && (receipt.ticketsPaid ?? 0) > 0 && (
          <m.p className="font-display mt-2 rounded-md bg-accent px-3 py-2 text-center font-bold text-ink" initial={reduced ? false : { scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: reduced ? 0 : 1.6 }}>
            {racingWords('uma-ticket', { n: receipt.ticketsPaid ?? 0 })}
          </m.p>
        )}
        {trainerFlair.length > 0 && <div className="mt-2"><FlairCards title={racingWords('trainer-flair')} items={trainerFlair} animate={!reduced} /></div>}
      </div>
      <div className="grid w-full max-w-sm grid-cols-2 gap-2">
        <Button variant="secondary" onClick={leave}>{racingWords('skip')}</Button>
        <Button onClick={leave}>{racingWords('open-profile')}</Button>
      </div>
    </div>
  )
}

function UmaCareer({ place, umaId }: { place: Place; umaId: string }) {
  const [params, setParams] = useSearchParams()
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const content = useRaceContent()
  const names = useNames(content)
  const uma = state?.umas[umaId]
  const sheet = params.get('sheet')
  const close = () => {
    const next = new URLSearchParams(params)
    next.delete('sheet')
    setParams(next, { replace: true })
  }
  if (!state || !env || !content) return <PlaceHeader place={place} rest={umaId} />
  if (!uma) return <Navigate to="/racing/scenario-gate" replace />
  const row = careerRow(uma, names.uma, names.race)
  const promotable = uma.expedition.runs.some((run) => run.completed) && uma.tier !== 3
  return (
    <div data-place-page="scenario-gate">
      <PlaceHeader place={place} rest={umaId} title={row.name} />
      <div className="flex flex-col gap-3 p-3">
        <CareerCard row={row} link={false} />
        {row.ready && <Button onClick={() => setParams({ sheet: 'advance' }, { replace: true })}>{racingWords('open-advance')}</Button>}
        {promotable && <Button onClick={() => setParams({ sheet: 'promote' }, { replace: true })}>{racingWords('promote')}</Button>}
        <Link to={`/racing/racecourse?uma=${encodeURIComponent(umaId)}`} className="font-display flex min-h-11 items-center justify-center rounded-sm border border-hairline bg-panel font-semibold">{racingWords('races')}</Link>
      </div>
      <BottomSheet open={sheet === 'advance' && row.ready} onClose={close} label={racingWords('advance-title', { name: row.name })}>
        {sheet === 'advance' && <AdvancePanel uma={uma} content={content} env={env} onClose={close} />}
      </BottomSheet>
      <BottomSheet open={sheet === 'promote' && promotable} onClose={close} label={racingWords('promote-title', { name: row.name })}>
        {sheet === 'promote' && <PromotePanel uma={uma} content={content} env={env} onClose={close} />}
      </BottomSheet>
    </div>
  )
}

function Careers({ place }: { place: Place }) {
  const state = useGame((snapshot) => snapshot.state)
  const content = useRaceContent()
  const names = useNames(content)
  const rows = state ? careerRows(state, names.uma, names.race) : []
  const ready = rows.filter((row) => row.ready)
  const rest = rows.filter((row) => !row.ready)
  return (
    <div data-place-page="scenario-gate">
      <PlaceHeader place={place} />
      <div className="flex flex-col gap-2 p-3">
        {ready.length > 0 && <h2 className="font-display text-[15px] font-semibold">{racingWords('ready-to-advance')}</h2>}
        {ready.map((row) => <CareerCard key={row.umaId} row={row} link />)}
        {rest.length > 0 && <h2 className="font-display mt-2 text-[15px] font-semibold">{racingWords('careers')}</h2>}
        {rest.map((row) => <CareerCard key={row.umaId} row={row} link />)}
      </div>
    </div>
  )
}

export default function ScenarioGate({ place, rest }: PageProps) {
  const parts = rest.split('/').filter(Boolean)
  if (parts.length === 2 && parts[1] === 'ceremony') return <Ceremony umaId={parts[0]!} />
  if (parts.length === 1) return <UmaCareer key={parts[0]} place={place} umaId={parts[0]!} />
  return <Careers place={place} />
}

