// The check-in summary (docs/rework/02-check-ins-and-notifications.md §1, §2, §4, §5, §9; T142), in T137's `?sheet=
// check-in` slot: a modal bottom sheet read top to bottom, with **Repeat all** in the thumb zone.
// - **Collect all** reaches it with `{ collect: true }` in navigation state: it runs `collect-all { shown: readySlots }`
//   once, then keeps the operation's id in that history entry's state, so a reload shows the same receipt and never
//   collects again. Repeat all's id is kept the same way. The pill's Check-in opens it without collecting.
// - **Sections** are `checkInSummary`'s, in its order, without the empty ones, over the receipts of this sheet's
//   operations (the server's once it has answered, else this device's), plus the Repeated lines with their notes and
//   **Switch**. A section's header folds it, remembered on this device.
// - **Every tap** is one operation through the port's `run`, its answer beside the line; a pending tap disables every
//   button in the sheet; spending asks once with the amount.
// - `since` is this device's last showing, written when the sheet closes. Offline, the footer says so in one line; the
//   save's refused taps show there too, until dismissed.
import { hubWords } from '@racer/domain/hub'
import { CHECK_IN_WORDS, type CollectAllReceipt, type RepeatReceipt, type Words } from '@racer/domain/rework/check-in'
import { isFree, type WorkState } from '@racer/domain/rework/work'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ChevronDownIcon } from '../../../ui/icons'
import { useGame, useHub, useNow, useRuntime, type G2Answer } from '../../app/game'
import { navState, type G2NavState } from '../../hub/nav'
import type { CheckInSheetProps } from '../registry'
import { Tabs } from '../../ui/Tabs'
import { UmaFace } from '../../ui/UmaArt'
import { StoppedQueueCard } from '../../ui/work/StoppedQueueCard'
import { TapNoteLine } from '../../ui/work/TapNote'
import { useTaps, useWordsContext, type Taps } from '../../ui/work/useTap'
import { useWorkView } from '../../ui/work/view'
import { grouped, placeName, showWords, workWords, type WordsContext } from '../../ui/work/words'
import { readCollapsed, readShownAt, writeCollapsed, writeShownAt, type SheetSection } from './device'
import { useOffline, useReceipt } from './hooks'
import {
  advanceLink, collectedView, freeLines, headerWords, moneyWords, nextWords, raceLink, repeatedView, sectionOf, skipViews, summaryOf,
  type FixView, type FreeLine, type SkipView,
} from './model'
import { SpeedUpAll } from './SpeedUpAll'
import { summaryWords } from './words'

const BUTTON = 'font-display inline-flex min-h-11 items-center justify-center rounded-sm px-3 text-[14px] font-semibold shadow-1 disabled:opacity-45 disabled:shadow-none'
const PRIMARY = `${BUTTON} bg-accent text-ink`
const SECONDARY = `${BUTTON} border border-hairline-strong bg-panel text-ink`
/** T138's Account at its sync row, where Sync now is. */
const SYNC_ROW = '/town/account?row=sync'
const SIZINGS = [{ value: 'same', label: summaryWords('same') }, { value: 'fit', label: summaryWords('fit') }] as const
const LINK = 'inline-flex min-h-11 items-center rounded-sm border border-hairline-strong bg-panel px-3 text-[14px] font-semibold shadow-1'

function Section({ kind, title, collapsed, onToggle, action, children }: {
  kind: SheetSection
  title: string
  collapsed: boolean
  onToggle: (kind: SheetSection) => void
  action?: ReactNode
  children: ReactNode
}) {
  const body = `check-in-${kind}`
  return (
    <section data-section={kind} aria-label={title} className="border-t border-hairline py-2">
      <div className="flex items-center gap-2">
        <h3 className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={body}
            onClick={() => onToggle(kind)}
            className="text-micro flex min-h-11 w-full items-center gap-1.5 text-left"
          >
            <ChevronDownIcon size={16} className={`shrink-0 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
            <span className="truncate">{title}</span>
          </button>
        </h3>
        {action}
      </div>
      <div id={body} hidden={collapsed} className="space-y-2 pb-1">{children}</div>
    </section>
  )
}

function Face({ outfitId }: { outfitId: string }) {
  return (
    <span className="block size-8 shrink-0 overflow-hidden rounded-full bg-sunken">
      <UmaFace outfitId={outfitId} size={32} />
    </span>
  )
}

/** A spend asks once with its amount (02 §1, §4): the question, its yes, and Not now. */
function Ask({ question, busy, onYes, onNo }: { question: string; busy: boolean; onYes: () => void; onNo: () => void }) {
  return (
    <div role="group" data-g2="check-in-ask" className="flex flex-wrap items-center gap-2 rounded-sm bg-accent-wash p-2 text-[13px]">
      <span className="min-w-0 flex-1">{question}</span>
      <button type="button" disabled={busy} onClick={onYes} className={PRIMARY}>{workWords('yes')}</button>
      <button type="button" onClick={onNo} className="min-h-11 px-3 font-semibold text-ink-soft">{workWords('not-now')}</button>
    </div>
  )
}

/** Words a done tap leaves on its line that the answer itself doesn't: a per-Uma Repeat's skip. */
type LineWords = Readonly<Record<string, Words>>

function FreeRow({ line, taps, context, words, onRepeat }: {
  line: FreeLine
  taps: Taps
  context: WordsContext
  words: Words | undefined
  onRepeat: (outfitId: string) => void
}) {
  const name = context.umaName(line.outfitId) || line.outfitId
  return (
    <li data-free={line.outfitId} className="space-y-1">
      <div className="flex items-center gap-2">
        <Link
          to={line.to}
          state={{ back: true }}
          aria-label={`${name}: ${line.words}`}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-sm px-1 active:bg-ink/5"
        >
          <Face outfitId={line.outfitId} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold">{name}</span>
            <span className={`block text-[13px] tabular-nums ${line.suggestion === null ? 'text-ink-soft' : 'text-ink'}`}>{line.words}</span>
          </span>
        </Link>
        {line.canRepeat && (
          <button
            type="button"
            data-action="repeat-one"
            disabled={taps.pending !== null}
            onClick={() => onRepeat(line.outfitId)}
            aria-label={summaryWords('repeat-label', { uma: name })}
            className={SECONDARY}
          >
            {summaryWords('repeat')}
          </button>
        )}
      </div>
      {words !== undefined && <p role="status" className="pl-11 text-[13px] text-ink-soft">{showWords(words, context)}</p>}
      <TapNoteLine tap={taps.line(`free:${line.outfitId}`)} className="pl-11" />
    </li>
  )
}

function SkipRow({ skip, taps, context, asking, setAsking, words, onBuyRepeat, onStart }: {
  skip: SkipView
  taps: Taps
  context: WordsContext
  asking: string | null
  setAsking: (key: string | null) => void
  words: Words | undefined
  onBuyRepeat: (skip: SkipView, fix: Extract<FixView, { kind: 'buy' }>) => void
  onStart: (line: string, fix: Extract<FixView, { kind: 'make' | 'suggestion' }>) => void
}) {
  const name = context.umaName(skip.outfitId) || skip.outfitId
  const busy = taps.pending !== null
  const line = `skip:${skip.outfitId}`
  const buy = skip.fixes.find((fix): fix is Extract<FixView, { kind: 'buy' }> => fix.kind === 'buy')
  // The Dojo's skip reads "Pick cards", the same as its fix's button: say it once.
  const echoes = skip.fixes.some((fix) => fix.kind === 'pick-cards') && showWords(skip.words, context) === summaryWords('fix-pick-cards')
  // Her card above, scrolled into the sheet's own list (scrollIntoView could pan the page under a fixed sheet).
  const locate = () => {
    const card = document.getElementById(`stopped-${skip.outfitId}`)
    const list = card?.closest<HTMLElement>('.overflow-y-auto')
    if (card === null || card === undefined) return
    if (list !== null && list !== undefined) list.scrollTop += card.getBoundingClientRect().top - list.getBoundingClientRect().top - 16
    card.focus({ preventScroll: true })
  }
  return (
    <li data-skip={skip.outfitId} className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Face outfitId={skip.outfitId} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold">{name}</span>
          {!echoes && <span className="block text-[13px] text-ink-soft">{showWords(skip.words, context)}</span>}
        </span>
      </div>
      {asking === line && buy !== undefined ? (
        <Ask
          question={summaryWords('fix-buy-ask', { items: buy.items, price: grouped(buy.price), uma: name })}
          busy={busy}
          onYes={() => onBuyRepeat(skip, buy)}
          onNo={() => setAsking(null)}
        />
      ) : skip.fixes.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-10" data-g2="skip-fixes">
          {skip.fixes.map((fix) => {
            switch (fix.kind) {
              case 'buy':
                return <button key="buy" type="button" data-fix="buy" disabled={busy} onClick={() => setAsking(line)} className={PRIMARY}>{summaryWords('fix-buy', { n: fix.n, price: grouped(fix.price) })}</button>
              case 'make':
                return <button key="make" type="button" data-fix="make" disabled={busy} onClick={() => onStart(line, fix)} className={SECONDARY}>{summaryWords('fix-make', { place: fix.place, n: fix.n })}</button>
              case 'suggestion':
                return <button key="suggestion" type="button" data-fix="suggestion" disabled={busy} onClick={() => onStart(line, fix)} className={SECONDARY}>{summaryWords('fix-suggestion', { what: fix.words })}</button>
              case 'pick-another':
                return <Link key="pick-another" to={fix.to} state={{ back: true }} data-fix="pick-another" className={LINK}>{summaryWords('fix-pick-another')}</Link>
              case 'pick-cards':
                return <Link key="pick-cards" to={fix.to} state={{ back: true }} data-fix="pick-cards" className={LINK}>{summaryWords('fix-pick-cards')}</Link>
              case 'queue-stopped':
                return <button key="queue-stopped" type="button" data-fix="queue-stopped" onClick={locate} className={SECONDARY}>{summaryWords('fix-queue-stopped')}</button>
            }
          })}
        </div>
      )}
      {words !== undefined && <p role="status" className="pl-10 text-[13px] text-ink-soft">{showWords(words, context)}</p>}
      <TapNoteLine tap={taps.line(line)} className="pl-10" />
    </li>
  )
}


export default function CheckInSheet({ collect }: CheckInSheetProps) {
  const { game } = useRuntime()
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const notices = useGame((snapshot) => snapshot.notices)
  const now = useNow()
  const hub = useHub()
  const work = useWorkView()
  const context = useWordsContext()
  const offline = useOffline()
  const location = useLocation()
  const navigate = useNavigate()
  const taps = useTaps()
  const [since] = useState(readShownAt)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mode, setMode] = useState<'summary' | 'speed-up'>('summary')
  const [asking, setAsking] = useState<string | null>(null)
  const [lineWords, setLineWords] = useState<LineWords>({})
  const [starting, setStarting] = useState(false)
  const latest = useRef(location)
  latest.current = location
  const nav = navState(location)
  const offset = context.utcOffsetMin

  /** Keeps fields in this history entry's state, so a reload or Back shows the same receipts. */
  const remember = useCallback((fields: G2NavState) => {
    const at = latest.current
    navigate(`${at.pathname}${at.search}${at.hash}`, { replace: true, state: { ...navState(at), ...fields } })
  }, [navigate])

  // Collect all, once: StrictMode's second effect and a re-render find `asked` set.
  const asked = useRef(false)
  useEffect(() => {
    if (!collect || asked.current || hub === null) return
    asked.current = true
    void taps.run('footer', 'collect-all', { shown: hub.readySlots }, 'check-in:collect').then((answer) => {
      remember(answer?.kind === 'done' ? { collect: false, collectId: answer.id } : { collect: false })
    })
  }, [collect, hub, taps, remember])

  // `since` is written when the sheet closes: its route drops `?sheet=check-in` (it stays mounted while it slides away),
  // or, failing that, it unmounts. StrictMode's pretend unmount re-mounts at once and writes nothing.
  const open = new URLSearchParams(location.search).get('sheet') === 'check-in'
  const wrote = useRef(false)
  const close = useCallback(() => {
    if (wrote.current) return
    wrote.current = true
    writeShownAt(game.now())
  }, [game])
  useEffect(() => {
    if (!open) close()
  }, [open, close])
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      queueMicrotask(() => {
        if (!alive.current) close()
      })
    }
  }, [close])

  const collected = useReceipt(nav.collectId ?? null) as CollectAllReceipt | null
  const repeated = useReceipt(nav.repeatId ?? null) as RepeatReceipt | null
  const summary = useMemo(
    () => (state === null || env === null ? null : summaryOf(state, env, now, offset, since, collected, repeated)),
    [state, env, now, offset, since, collected, repeated],
  )
  const settled: WorkState | null = work?.settled ?? null
  const back = `${location.pathname}${location.search}`

  const toggle = (kind: SheetSection) => setCollapsed((current) => {
    const next = new Set(current)
    if (next.has(kind)) next.delete(kind)
    else next.add(kind)
    writeCollapsed(next)
    return next
  })
  const say = (line: string, words: Words | null) => setLineWords((all) => {
    const next: Record<string, Words> = { ...all }
    if (words === null) delete next[line]
    else next[line] = words
    return next
  })
  /** A per-Uma Repeat's own skip, worded on her line (Repeat never refuses: a skip is its answer). */
  const repeatOne = async (line: string, outfitId: string) => {
    say(line, null)
    const answer = await taps.run(line, 'repeat', { outfitIds: [outfitId], utcOffsetMin: offset }, 'check-in:repeat-one')
    const skip = answer?.kind === 'done' ? answer.receipt.skipped.find((entry) => entry.outfitId === outfitId) : undefined
    if (skip !== undefined) say(line, skip.words)
  }

  if (mode === 'speed-up') return <SpeedUpAll taps={taps} onBack={() => setMode('summary')} />
  if (summary === null || settled === null || env === null) {
    return <h2 data-sheet-heading tabIndex={-1} className="pb-2 text-lg outline-none">{hubWords('check-in-title')}</h2>
  }

  const busy = taps.pending !== null || starting
  const collecting = collect && nav.collectId === undefined
  const free = sectionOf(summary, 'free')
  const lines = free === undefined ? [] : freeLines(free, settled, back, offset)
  const startable = lines.filter((line) => line.suggestion !== null)
  const stoppedSection = sectionOf(summary, 'queue-stopped')
  const stoppedNow = new Set(stoppedSection?.queues.map((queue) => queue.outfitId) ?? [])
  const skipped = sectionOf(summary, 'couldnt-repeat')
  const skips = skipped === undefined ? [] : skipViews(skipped, settled, now, offset, back).filter((skip) => isFree(settled, skip.outfitId))
  const collectedSection = sectionOf(summary, 'collected')
  const collectedLines = collectedSection === undefined ? null : collectedView(collectedSection, env, context)
  const repeatedLines = repeated === null ? null : repeatedView(repeated, settled, context)
  const training = sectionOf(summary, 'training-done')
  const advancing = sectionOf(summary, 'ready-to-advance')
  const next = sectionOf(summary, 'next')
  const money = sectionOf(summary, 'money')
  const name = (outfitId: string) => context.umaName(outfitId) || outfitId
  const shown = (kind: SheetSection) => collapsed.has(kind)

  const startSuggestions = async () => {
    if (starting) return
    setStarting(true)
    try {
      for (const line of startable) {
        const s = line.suggestion!
        await taps.run(`free:${s.outfitId}`, 'start', { outfitId: s.outfitId, slot: s.slot, request: s.request }, 'check-in:start')
      }
    } finally {
      setStarting(false)
    }
  }
  const repeatAll = async () => {
    const answer = await taps.run('footer', 'repeat', { utcOffsetMin: offset }, 'check-in:repeat')
    if (answer?.kind === 'done') remember({ repeatId: answer.id })
  }
  const buyAndRepeat = async (skip: SkipView, fix: Extract<FixView, { kind: 'buy' }>) => {
    setAsking(null)
    const line = `skip:${skip.outfitId}`
    for (const buy of fix.lines) {
      const bought: G2Answer | null = await taps.run(line, 'buy', { sku: buy.sku, qty: buy.qty, unitPrice: buy.unitPrice }, 'check-in:fix')
      if (bought?.kind !== 'done') return
    }
    await repeatOne(line, skip.outfitId)
  }
  const startFix = (line: string, fix: Extract<FixView, { kind: 'make' | 'suggestion' }>) => {
    const s = fix.suggestion
    void taps.run(line, 'start', { outfitId: s.outfitId, slot: s.slot, request: s.request }, 'check-in:fix')
  }
  const switchTo = async (outfitId: string, to: NonNullable<ReturnType<typeof repeatedView>['lines'][number]['switchTo']>) => {
    const line = `switch:${outfitId}`
    const recalled = await taps.run(line, 'recall', { outfitId }, 'check-in:switch')
    if (recalled?.kind !== 'done') return
    await taps.run(line, 'start', { outfitId, slot: to.slot, request: to.request }, 'check-in:switch')
  }
  const nothing = summary.sections.length === 0 && repeatedLines === null && !collecting

  return (
    <div data-g2="check-in" className="flex flex-col">
      <h2 data-sheet-heading tabIndex={-1} className="pb-2 text-lg outline-none">{headerWords(hubWords('check-in-title'), since, now, offset)}</h2>
      {collecting && <p role="status" className="pb-2 text-[13px] text-ink-soft">{summaryWords('collecting')}</p>}
      {nothing && <p className="pb-2 text-[14px] text-ink-soft">{summaryWords('nothing-to-do')}</p>}

      {collectedLines !== null && (
        <Section kind="collected" title={summaryWords('collected')} collapsed={shown('collected')} onToggle={toggle}>
          {collectedLines.totals !== null && <p data-totals className="font-display text-[15px] font-semibold tabular-nums">{collectedLines.totals}</p>}
          {collectedLines.notes.length > 0 && (
            <ul className="space-y-1">
              {collectedLines.notes.map((note, i) => (
                <li key={i}>
                  <Link to={note.to} state={{ back: true }} className="flex min-h-11 items-center gap-2 rounded-sm px-1 text-[13px] active:bg-ink/5">
                    <Face outfitId={note.outfitId} />
                    <span className="min-w-0 flex-1">{note.words}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {collectedLines.movedOn !== null && <p className="text-[13px] text-ink-soft">{collectedLines.movedOn}</p>}
          {collected !== null && collected.lines.some((line) => line.words !== null) && (
            <ul data-g2="collect-words" className="space-y-0.5 text-[13px] text-ink-soft">
              {collected.lines.filter((line) => line.words !== null).map((line, i) => (
                <li key={i}>{summaryWords('line-label', { uma: line.outfitId === null ? placeName(line.slot.building) : name(line.outfitId), what: showWords(line.words!, context) })}</li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {repeatedLines !== null && (
        <Section kind="repeated" title={summaryWords('repeated', { n: repeatedLines.count })} collapsed={shown('repeated')} onToggle={toggle}>
          <ul className="space-y-1.5">
            {repeatedLines.lines.map((line) => (
              <li key={line.outfitId} data-repeated={line.outfitId} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Face outfitId={line.outfitId} />
                  <span className="min-w-0 flex-1 text-[13px] tabular-nums">{line.words}</span>
                  {line.switchTo !== null && (
                    <button
                      type="button"
                      data-action="switch"
                      disabled={busy}
                      onClick={() => void switchTo(line.outfitId, line.switchTo!)}
                      aria-label={summaryWords('switch-label', { uma: name(line.outfitId), grade: line.switchTo.grade })}
                      className={SECONDARY}
                    >
                      {summaryWords('switch')}
                    </button>
                  )}
                </div>
                <TapNoteLine tap={taps.line(`switch:${line.outfitId}`)} className="pl-10" />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {free !== undefined && (
        <Section
          kind="free"
          title={summaryWords('free', { n: lines.length })}
          collapsed={shown('free')}
          onToggle={toggle}
          action={startable.length > 0 && (
            <button type="button" data-action="start-suggestions" disabled={busy} onClick={() => void startSuggestions()} className={PRIMARY}>
              {summaryWords('start-suggestions', { n: startable.length })}
            </button>
          )}
        >
          <ul className="space-y-1.5">
            {lines.map((line) => (
              <FreeRow
                key={line.outfitId}
                line={line}
                taps={taps}
                context={context}
                words={lineWords[`free:${line.outfitId}`]}
                onRepeat={(outfitId) => void repeatOne(`free:${outfitId}`, outfitId)}
              />
            ))}
          </ul>
        </Section>
      )}

      {stoppedSection !== undefined && (
        <Section kind="queue-stopped" title={summaryWords('stopped', { n: stoppedSection.queues.length })} collapsed={shown('queue-stopped')} onToggle={toggle}>
          {stoppedSection.queues.map((queue) => (
            <StoppedQueueCard key={queue.outfitId} queue={queue} tap={taps.line(`stopped:${queue.outfitId}`)} />
          ))}
        </Section>
      )}

      {skips.length > 0 && (
        <Section kind="couldnt-repeat" title={summaryWords('couldnt-repeat', { n: skips.length })} collapsed={shown('couldnt-repeat')} onToggle={toggle}>
          <ul className="space-y-2">
            {skips.map((skip) => (
              <SkipRow
                key={skip.outfitId}
                skip={skip}
                taps={taps}
                context={context}
                asking={asking}
                setAsking={setAsking}
                words={lineWords[`skip:${skip.outfitId}`]}
                onBuyRepeat={(entry, fix) => void buyAndRepeat(entry, fix)}
                onStart={startFix}
              />
            ))}
          </ul>
        </Section>
      )}

      {training !== undefined && (
        <Section kind="training-done" title={summaryWords('training-done', { n: training.umas.length })} collapsed={shown('training-done')} onToggle={toggle}>
          <ul className="space-y-1.5">
            {training.umas.map((uma) => (
              <li key={uma.outfitId} data-trained={uma.outfitId} className="flex items-center gap-2">
                <Face outfitId={uma.outfitId} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{name(uma.outfitId)}</span>
                  <span className="block text-[13px] text-ink-soft">{showWords({ text: CHECK_IN_WORDS['training-done'], data: { scenario: uma.scenario } }, context)}</span>
                </span>
                <Link to={raceLink(uma.outfitId)} state={{ back: true }} aria-label={summaryWords('race-label', { uma: name(uma.outfitId) })} className={LINK}>{summaryWords('race')}</Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {advancing !== undefined && (
        <Section kind="ready-to-advance" title={summaryWords('ready-to-advance', { n: advancing.umas.length })} collapsed={shown('ready-to-advance')} onToggle={toggle}>
          <ul className="space-y-1.5">
            {advancing.umas.map((uma) => (
              <li key={uma.outfitId} data-advance={uma.outfitId} className="flex items-center gap-2">
                <Face outfitId={uma.outfitId} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{name(uma.outfitId)}</span>
                  <span className="block text-[13px] text-ink-soft">{summaryWords('advance-line', { from: uma.from.scenario })}</span>
                </span>
                <Link to={advanceLink(uma.outfitId)} state={{ back: true }} aria-label={summaryWords('advance-label', { uma: name(uma.outfitId) })} className={LINK}>{summaryWords('advance')}</Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(next !== undefined || money !== undefined) && (
        <div className="space-y-1 border-t border-hairline py-2 text-[13px]">
          {next !== undefined && <p data-g2="next" className="tabular-nums">{nextWords(next, offset)}</p>}
          {money !== undefined && (
            <div className="flex items-center gap-2">
              <p data-g2="money" className="min-w-0 flex-1 tabular-nums">{moneyWords(money)}</p>
              <button type="button" data-action="speed-up" disabled={busy} onClick={() => setMode('speed-up')} className={SECONDARY}>{summaryWords('speed-up')}</button>
            </div>
          )}
        </div>
      )}

      <div data-g2="check-in-footer" className="sticky -bottom-4 -mx-4 mt-1 space-y-2 border-t border-hairline bg-panel px-4 pt-2 pb-4">
        {(notices ?? []).map((notice) => (
          <div key={notice.id} role="status" data-notice className="flex items-center gap-2 text-[13px] text-ink">
            <span className="min-w-0 flex-1">{showWords(notice.words, context)}</span>
            {game.dismissNotice !== undefined && (
              <button type="button" onClick={() => game.dismissNotice?.(notice.id)} className="min-h-11 px-3 font-semibold text-ink-soft">{summaryWords('ok')}</button>
            )}
          </div>
        ))}
        {offline && (
          <Link to={SYNC_ROW} state={{ back: true }} role="status" data-g2="offline" className="flex min-h-11 items-center text-[13px] text-ink-soft">
            {CHECK_IN_WORDS.offline}
          </Link>
        )}
        {/* A stopped queue another device already put back leaves its card; its answer stays here. */}
        {Object.keys(taps.notes).filter((line) => line.startsWith('stopped:') && !stoppedNow.has(line.slice('stopped:'.length))).map((line) => (
          <div key={line} data-orphan={line} className="space-y-0.5">
            <p className="text-[12px] font-semibold text-ink-soft">{name(line.slice('stopped:'.length))}</p>
            <TapNoteLine tap={taps.line(line)} />
          </div>
        ))}
        <TapNoteLine tap={taps.line('footer')} />
        {summary.repeatAll > 0 && (
          <div className="flex items-center gap-2">
            <Tabs
              label={summaryWords('sizing')}
              value={state?.profile.repeatSizing ?? 'same'}
              options={SIZINGS}
              onChange={(sizing) => {
                if (!busy && sizing !== state?.profile.repeatSizing) void taps.run('footer', 'set-repeat-sizing', { sizing }, 'check-in:sizing')
              }}
              className="w-44 shrink-0"
            />
            <button type="button" data-action="repeat-all" disabled={busy || collecting} onClick={() => void repeatAll()} className={`${PRIMARY} min-h-12 flex-1 text-[15px]`}>
              {summaryWords('repeat-all', { n: summary.repeatAll })}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
