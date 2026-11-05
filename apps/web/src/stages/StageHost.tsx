// The stage host (docs/game/07-stages.md §4–§5, D384; 02 §4–§5): one full-screen play of a mini-game. It opens on the
// game's rule card (one verb, one sentence, Play and Practice, which pays nothing), loads the game's view lazily, feeds
// each tap through the rules, and keeps the journal on this device on every move and again when the page hides, so a
// play closed or killed mid-way resumes by replay. On the last move it settles: a career play commits `settle-stage`
// (the device and the server replay the same moves and pay the grade), and practice is graded here by the same
// function and pays nothing. The result shows the grade, the pay and Play again. The screen stays on while playing,
// and reduced motion keeps the moves and drops the flourishes. The career screens (T158) open it for a season's Play
// and the header's Play again, and hear each settled career play through `onSettled`.
import { Button, CloseIcon, IconButton, Panel, useReducedMotionSetting } from '@luismlorenzana/uma-kit/ui'
import { STATS } from '@racer/domain'
import { STAGE_PAY_AT_A } from '@racer/domain/career'
import {
  isReplayFailure, replay, STAGE_NAMES, stageRules, type Journal, type SettleStageReceipt, type StageInput, type StageKind,
} from '@racer/domain/stages'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRuntime, useSnapshot, type StoredJournal } from '../app/game'
import { TypeIcon, typeLabel } from '../ui/TypeIcon'
import {
  journalId, newSeed, resultOf, sameSetup, settledBefore, settlePractice, stageConfigFor, type StageMode, type StageResult,
} from './session'
import { STAGE_VIEWS } from './views'
import { useWakeLock } from './wakeLock'

export interface StageHostProps {
  readonly kind: StageKind
  /** The career the play is for: its deck, bonds and season. Null outside a career. */
  readonly careerId: string | null
  /** `career`: Play pays into her wallet and Practice doesn't. `practice`: Practice only. */
  readonly mode: StageMode
  /** Leaves the stage; an unfinished play stays open and resumes next time. */
  readonly onExit: () => void
  /** A career play settled (not practice): its receipt, so the career screens can mark the season's Play (T158). */
  readonly onSettled?: (receipt: SettleStageReceipt) => void
}

type Play = { readonly journal: Journal; readonly state: unknown }
type Phase =
  | { readonly name: 'opening' }
  | { readonly name: 'rules'; readonly note?: string }
  | ({ readonly name: 'playing' } & Play)
  | ({ readonly name: 'settling' } & Play)
  | ({ readonly name: 'result'; readonly result: StageResult } & Play)
  | ({ readonly name: 'stuck'; readonly words: string; readonly retry: boolean } & Play)
  | { readonly name: 'unavailable'; readonly words: string }

const WORDS = {
  changed: 'Her deck or season changed since that play, so it starts again.',
  stale: 'That play can\'t be resumed on these rules, so it starts again.',
  opening: 'That didn\'t settle yet: the game is still opening. Try again.',
  unsettled: 'That play didn\'t settle.',
}

function PayRows({ result }: { result: StageResult }) {
  if (result.practice) return <p className="text-[14px] text-ink-soft" data-racer="stage-pay">Practice pays nothing.</p>
  const drills = STATS.filter((stat) => result.pay.drills[stat] > 0)
  return (
    <ul className="space-y-1.5 text-[14px]" data-racer="stage-pay" aria-label="Pay">
      {drills.map((stat) => (
        <li key={stat} className="flex items-center gap-2">
          <TypeIcon type={stat} size={20} />
          <span className="flex-1">{typeLabel(stat)} drills</span>
          <span className="numeral font-semibold">+{result.pay.drills[stat]}</span>
        </li>
      ))}
      {result.pay.bond > 0 && <li className="flex justify-between"><span>Bond</span><span className="numeral font-semibold">+{result.pay.bond}</span></li>}
      <li className="flex justify-between"><span>SP</span><span className="numeral font-semibold">+{result.pay.sp}</span></li>
    </ul>
  )
}

export function StageHost({ kind, careerId, mode, onExit, onSettled }: StageHostProps) {
  const { game } = useRuntime()
  const snapshot = useSnapshot()
  const reducedMotion = useReducedMotionSetting()
  const rules = stageRules(kind)
  const entry = STAGE_VIEWS[kind]
  const name = STAGE_NAMES[kind]
  const id = journalId(kind, careerId, mode)
  const [phase, setPhase] = useState<Phase>(rules === null || entry === undefined ? { name: 'unavailable', words: `${name} isn't built yet.` } : { name: 'opening' })
  // The live play, read by every tap (taps can outrun a render) and by the flush when the page hides.
  const live = useRef<Play | null>(null)
  const writes = useRef<Promise<void>>(Promise.resolve())
  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot
  const settledRef = useRef(onSettled)
  settledRef.current = onSettled

  const persist = useCallback((journal: Journal) => {
    const row: StoredJournal = { id, careerId: mode === 'career' ? careerId : null, journal }
    writes.current = writes.current.then(() => game.journal?.write(row)).catch(() => {})
    return writes.current
  }, [careerId, game, id, mode])

  const forget = useCallback(() => {
    live.current = null
    writes.current = writes.current.then(() => game.journal?.clear(id)).catch(() => {})
    return writes.current
  }, [game, id])

  const finish = useCallback(async ({ journal, state }: Play) => {
    if (rules === null) return
    const play: Play = { journal, state }
    live.current = null
    setPhase({ name: 'settling', ...play })
    const { config, inputs } = play.journal
    if (config.practice) {
      const result = settlePractice(play.journal, rules)
      await forget()
      setPhase(result === null ? { name: 'stuck', words: WORDS.unsettled, retry: false, ...play } : { name: 'result', result, ...play })
      return
    }
    const prior = careerId === null ? null : settledBefore(snapshotRef.current.receipts, careerId, kind, config.seed)
    if (prior !== null) {
      await forget()
      settledRef.current?.(prior)
      setPhase({ name: 'result', result: resultOf(prior), ...play })
      return
    }
    try {
      const answer = await game.run<SettleStageReceipt>('settle-stage', {
        careerId, kind, seed: config.seed, version: play.journal.version, inputs, practice: false,
      }, `settle-stage:${id}`)
      await forget()
      if (answer.kind === 'done') settledRef.current?.(answer.receipt)
      setPhase(answer.kind === 'done' ? { name: 'result', result: resultOf(answer.receipt), ...play } : { name: 'stuck', words: answer.text, retry: false, ...play })
    } catch {
      live.current = play
      setPhase({ name: 'stuck', words: WORDS.opening, retry: true, ...play })
    }
  }, [careerId, forget, game, id, kind, rules])

  // Opens the play this phone kept, by replay; else the rule card.
  const ready = snapshot.status === 'ready' && snapshot.state !== null && snapshot.env !== null
  useEffect(() => {
    if (phase.name !== 'opening' || !ready || rules === null) return
    let current = true
    void (async () => {
      const row = await game.journal?.read(id).catch(() => null) ?? null
      if (!current) return
      if (row === null) return setPhase({ name: 'rules' })
      const { state, env } = snapshotRef.current
      const fresh = stageConfigFor(kind, careerId, row.journal.config.practice, row.journal.config.seed, state!, env!)
      if (typeof fresh === 'string' || !sameSetup(fresh, row.journal.config)) {
        await forget()
        return setPhase({ name: 'rules', note: WORDS.changed })
      }
      const replayed = replay(row.journal, rules)
      if (isReplayFailure(replayed)) {
        await forget()
        return setPhase({ name: 'rules', note: WORDS.stale })
      }
      const play = { journal: row.journal, state: replayed }
      if (rules.done(replayed)) return void finish(play)
      live.current = play
      setPhase({ name: 'playing', ...play })
    })()
    return () => {
      current = false
    }
  }, [careerId, finish, forget, game, id, kind, phase.name, ready, rules])

  const start = useCallback((practice: boolean) => {
    const { state, env } = snapshotRef.current
    if (rules === null || state === null || env === null) return
    const config = stageConfigFor(kind, careerId, practice, newSeed(), state, env)
    if (typeof config === 'string') return setPhase({ name: 'unavailable', words: config })
    const play = { journal: { config, version: rules.version, inputs: [] }, state: rules.init(config) }
    live.current = play
    void persist(play.journal)
    setPhase({ name: 'playing', ...play })
  }, [careerId, kind, persist, rules])

  const onMove = useCallback((move: Omit<StageInput, 'tick'>) => {
    const play = live.current
    if (play === null || rules === null) return
    const input: StageInput = { ...move, tick: play.journal.inputs.length }
    const state = rules.step(play.state, input)
    if (state === null) return
    const next = { journal: { ...play.journal, inputs: [...play.journal.inputs, input] }, state }
    void persist(next.journal)
    if (rules.done(state)) return void finish(next)
    live.current = next
    setPhase({ name: 'playing', ...next })
  }, [finish, persist, rules])

  // Flushes the journal when the page hides or is put away: what a kill leaves is what resumes.
  useEffect(() => {
    const flush = () => {
      if (live.current !== null) void persist(live.current.journal)
    }
    const hidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', flush)
    }
  }, [persist])

  useWakeLock(phase.name === 'playing')

  const leave = () => {
    if (live.current !== null) void persist(live.current.journal)
    onExit()
  }

  const practice = 'journal' in phase ? phase.journal.config.practice : mode === 'practice'
  const View = entry?.View
  return (
    <div className="pt-safe pb-safe flex min-h-full flex-col bg-page" data-racer="stage-host" data-stage={kind} data-phase={phase.name}>
      <header className="flex items-center gap-2 px-2 py-1">
        <IconButton aria-label={`Leave ${name}`} onClick={leave}><CloseIcon size={24} /></IconButton>
        <h1 className="font-display flex-1 truncate text-lg font-bold">{name}</h1>
        {phase.name !== 'rules' && phase.name !== 'opening' && practice && (
          <span className="rounded-full bg-accent-wash px-2.5 py-1 text-[12px] font-semibold text-ink" aria-label="Practice: pays nothing">Practice</span>
        )}
      </header>

      {phase.name === 'rules' && entry !== undefined && (
        <div className="flex flex-1 flex-col justify-end gap-4 px-4 pb-6">
          <Panel className="space-y-2" data-racer="rule-card">
            <p className="font-display text-3xl font-bold">{entry.verb}</p>
            <p className="text-[15px]">{entry.rule}</p>
            {mode === 'career' && (
              <p className="text-[13px] text-ink-soft">
                A play pays {STAGE_PAY_AT_A[kind].drills > 0 ? `${STAGE_PAY_AT_A[kind].drills} drills and ` : ''}{STAGE_PAY_AT_A[kind].bond > 0 ? `${STAGE_PAY_AT_A[kind].bond} Bond and ` : ''}{STAGE_PAY_AT_A[kind].sp} SP at grade A, more at S.
              </p>
            )}
            {phase.note !== undefined && <p className="text-[13px] text-ink-soft" role="status">{phase.note}</p>}
          </Panel>
          <div className="grid gap-2">
            {mode === 'career' && <Button size="lg" onClick={() => start(false)}>Play</Button>}
            <Button size="lg" variant={mode === 'career' ? 'secondary' : 'primary'} onClick={() => start(true)}>Practice (pays nothing)</Button>
          </div>
        </div>
      )}

      {(phase.name === 'playing' || phase.name === 'settling') && View !== undefined && (
        <Suspense fallback={<p className="flex flex-1 items-center justify-center text-ink-soft" role="status">Opening {name}…</p>}>
          <View config={phase.journal.config} state={phase.state} onMove={onMove} reducedMotion={reducedMotion} locked={phase.name !== 'playing'} />
        </Suspense>
      )}
      {phase.name === 'settling' && <p className="px-4 pb-2 text-center text-[13px] text-ink-soft" role="status">Settling…</p>}

      {phase.name === 'result' && entry !== undefined && (
        <div className="flex flex-1 flex-col justify-end gap-4 px-4 pb-6" data-racer="stage-result">
          <Panel className="space-y-3">
            <div className="flex items-end gap-3">
              <p className="font-display text-6xl font-bold leading-none" aria-label={`Grade ${phase.result.grade}`}>{phase.result.grade}</p>
              {entry.score === undefined
                ? <p className="pb-1 text-[14px] text-ink-soft">Score <span className="numeral font-semibold text-ink">{phase.result.score}</span></p>
                : <p className="pb-1 text-[15px] font-semibold" data-racer="stage-score">{entry.score(phase.result.score)}</p>}
            </div>
            <ul className="space-y-1 text-[14px]" aria-label="Bonus tasks">
              {entry.tasks.map((task, i) => (
                <li key={task} className={phase.result.tasks[i] ? 'text-ink' : 'text-ink-faint'}>
                  {phase.result.tasks[i] ? 'Done: ' : 'Not yet: '}{task}
                </li>
              ))}
            </ul>
            <PayRows result={phase.result} />
          </Panel>
          <div className="grid gap-2">
            <Button size="lg" onClick={() => start(phase.result.practice || mode === 'practice')}>Play again</Button>
            <Button size="lg" variant="secondary" onClick={onExit}>Done</Button>
          </div>
        </div>
      )}

      {(phase.name === 'stuck' || phase.name === 'unavailable') && (
        <div className="flex flex-1 flex-col justify-end gap-4 px-4 pb-6">
          <Panel><p className="text-[15px]" role="alert">{phase.words}</p></Panel>
          <div className="grid gap-2">
            {phase.name === 'stuck' && phase.retry && <Button size="lg" onClick={() => void finish(phase)}>Try again</Button>}
            {phase.name === 'stuck' && !phase.retry && <Button size="lg" onClick={() => start(practice)}>Play again</Button>}
            <Button size="lg" variant="secondary" onClick={onExit}>Done</Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default StageHost
