// Separate account selectors and guarded lazy campaign shell (docs/design/uma-puzzles.md §9).
import { liveQuery } from 'dexie'
import { puzzleUsesPlaceholderArt } from '@racer/domain'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Outlet } from 'react-router'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { useContent } from '../../content/ContentProvider'
import { puzzleContentLibrary } from '../../content/puzzles'
import type { LoadedContent } from '../../content/runtime'
import { PUZZLES_RELEASE_ENABLED } from '../../game/puzzles/capability'
import type { PuzzleAccount, PuzzleCastLease, PuzzleHost } from '../../game/puzzles/host'
import { createPuzzleNavigation } from '../../game/puzzles/navigation'
import { useGame } from '../../game/store'
import { MinigameHeader, MinigameShell } from '../../ui/minigames/MinigameShell'
import { PuzzleButton, PuzzleTabs } from '../../ui/puzzles/components'
import { usePuzzlePreparation } from '../../game/puzzles/preparation-store'
import { PuzzleBackupButton } from '../../ui/puzzles/PuzzleBackupButton'
import { PuzzleGuide, puzzleGuideMemory } from './PuzzleGuide'

export interface PuzzleEnvironment {
  host: PuzzleHost; content: LoadedContent; ownedIds: readonly string[]; root: string; isolated: boolean; placeholderArt?: boolean
  acquire(identity?: PuzzleCastLease['identity']): Promise<PuzzleCastLease>
}
export function createPuzzleAccountStore() {
  const store = createStore<{ account: PuzzleAccount | null; error: string | null }>(() => ({ account: null, error: null }))
  return { store, publish(account: PuzzleAccount) {
    // Journals live outside this subscription. Equal host re-reads must not fan out to screens.
    if (JSON.stringify(account) !== JSON.stringify(store.getState().account)) store.setState({ account, error: null })
  } }
}
type Value = PuzzleEnvironment & { state: ReturnType<typeof createPuzzleAccountStore>; memory: ReturnType<typeof createPuzzleNavigation>
  busy: boolean; notice: string | null; command(key: string, action: (operationId: string) => Promise<unknown>): Promise<boolean> }
const Context = createContext<Value | null>(null)
export function usePuzzles() { const value = useContext(Context); if (!value) throw new Error('Puzzle screen needs its account provider'); return value }
export function usePuzzleAccount() { return useStore(usePuzzles().state.store, s => s.account) }

export function PuzzleProvider({ environment, children }: { environment: PuzzleEnvironment; children: ReactNode }) {
  const state = useMemo(createPuzzleAccountStore, [environment.host])
  const memory = useMemo(() => createPuzzleNavigation(environment.isolated ? 'puzzle-proof-ui-navigation' : 'uma-racer:puzzle-navigation-v1'), [environment.isolated])
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState<string | null>(null)
  const inFlight = useRef(false), operations = useRef(new Map<string, string>())
  useEffect(() => {
    const subscription = liveQuery(() => environment.host.account()).subscribe({ next: a => state.publish(a),
      error: e => state.store.setState({ error: e instanceof Error ? e.message : 'Saved Puzzle state needs recovery.' }) })
    return () => subscription.unsubscribe()
  }, [environment.host, state])
  const command = useCallback(async (key: string, action: (operationId: string) => Promise<unknown>) => {
    if (inFlight.current) return false
    inFlight.current = true; setBusy(true); setNotice(null)
    const id = operations.current.get(key) ?? crypto.randomUUID(); operations.current.set(key, id)
    try { await action(id); state.publish(await environment.host.account()); operations.current.delete(key); return true }
    catch (error) { setNotice(error instanceof Error ? error.message : 'The change could not be saved. Retry or return.'); return false }
    finally { inFlight.current = false; setBusy(false) }
  }, [environment.host, state])
  const value = useMemo(() => ({ ...environment, state, memory, busy, notice, command }), [environment, state, memory, busy, notice, command])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function PuzzleGate({ title, children, retry }: { title: string; children: ReactNode; retry?: () => void }) {
  return <MinigameShell><div className="m-auto grid w-full max-w-md gap-4 p-5"><h1 className="text-xl">{title}</h1><div className="text-sm text-ink-on-dark-soft">{children}</div>
    {retry && <PuzzleButton onClick={retry}>Retry</PuzzleButton>}<a href="/" className="flex min-h-11 items-center justify-center rounded-sm border border-hairline-dark">Return home</a></div></MinigameShell>
}
export function puzzleUiGate(enabled: boolean, account: PuzzleAccount | null, verified: boolean) {
  if (!enabled) return 'disabled'
  if (!account) return 'loading'
  if (account.readiness !== 'active') return account.readiness
  return verified ? 'ready' : 'content'
}
function ProductionPuzzleShell() {
  const phase = usePuzzlePreparation(s => s.phase)
  const contentState = useContent(), status = useGame(s => s.status), persistent = useGame(s => s.persistent), owned = useGame(s => s.umas)
  const content = contentState.status === 'ready' ? contentState.content : null
  const [environment, setEnvironment] = useState<PuzzleEnvironment | null>(null), [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setEnvironment(null); setError(null)
    if (!content || status !== 'ready' || !persistent) return
    let cancelled = false, lease: PuzzleCastLease | null = null
    void (async () => {
      const { gameRuntime } = await import('../../game/runtime'), host = await gameRuntime.puzzleHost()
      const account = await host.account()
      if (puzzleUiGate(true, account, true) !== 'ready') throw new Error('Constellation preservation is not active. Return to current training or retry preparation.')
      const acquired = await puzzleContentLibrary(content.manifest).acquire()
      lease = { ...acquired, presentation: acquired }
      if (cancelled) { lease.release(); return }
      if (!cancelled) setEnvironment({ host, content, ownedIds: Object.keys(owned), root: '/puzzles', isolated: false, placeholderArt: puzzleUsesPlaceholderArt(acquired.pack),
        acquire: async identity => { const held = await puzzleContentLibrary(content.manifest).acquire(identity); return { ...held, presentation: held } } })
    })().catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Verified Puzzle content is unavailable.') })
    return () => { cancelled = true; lease?.release() }
  }, [content, status, persistent, attempt, phase])
  if (!content || status !== 'ready' || !persistent) return <PuzzleGate title="Saved account required">Load your saved game and verified content first. No Puzzle operation is available here.</PuzzleGate>
  if (error) return <PuzzleGate title="Uma Puzzles unavailable" retry={() => {
    void import('../../game/runtime').then(({ gameRuntime }) => gameRuntime.flush()).catch(e => setError(String(e))).finally(() => setAttempt(n => n + 1))
  }}><p>{error}</p><div className="mt-4"><PuzzleBackupButton /></div></PuzzleGate>
  if (!environment || environment.content !== content) return <PuzzleGate title="Preparing Uma Puzzles">Verified content and an active saved account are required. Current training remains available.</PuzzleGate>
  return <PuzzleProvider environment={{ ...environment, ownedIds: Object.keys(owned) }}><Outlet /></PuzzleProvider>
}
/** Off flag is checked before mounting a component capable of host/content/account I/O. */
export function PuzzleShell({ enabled = PUZZLES_RELEASE_ENABLED }: { enabled?: boolean } = {}) {
  return enabled ? <ProductionPuzzleShell /> : <PuzzleGate title="Uma Puzzles is not released yet">The setup screens are being prepared. Spark Match and current training remain available; this link cannot enable the new mode.</PuzzleGate>
}
export function PuzzleFrame({ title, eyebrow = 'Uma Puzzles', back, backLabel, children, footer }: { title: string; eyebrow?: string; back?: string; backLabel?: string; children: ReactNode; footer?: ReactNode }) {
  const value = usePuzzles(), account = usePuzzleAccount(), error = useStore(value.state.store, s => s.error)
  const [guide, setGuide] = useState(() => !puzzleGuideMemory(value.isolated).seen())
  if (error) return <PuzzleGate title="Saved state unavailable" retry={() => { void value.host.account().then(value.state.publish).catch(() => {}) }}>{error}</PuzzleGate>
  if (!account) return <PuzzleGate title="Loading Puzzle account">Reading this mode's own saved roster and parties.</PuzzleGate>
  if (puzzleUiGate(true, account, true) !== 'ready') return <PuzzleGate title="Account preparation required">Return to current training. No Puzzle operation is available until preservation is active.</PuzzleGate>
  return <MinigameShell playing><MinigameHeader backTo={back ?? (value.isolated ? value.root : '/')} backLabel={backLabel ?? (back?.endsWith('/roster') ? 'Back to Puzzle roster' : back ? 'Back to Puzzle parties' : value.isolated ? 'Back to isolated proof' : 'Return home')} title={title}
    eyebrow={value.isolated ? 'Isolated DEV proof · original placeholders' : eyebrow} onGuide={() => setGuide(true)} guideLabel="Uma Puzzles guide"
    trailing={value.isolated ? <a href="/" className="flex min-h-11 min-w-11 items-center justify-center text-xs text-ink-on-dark-soft">Exit</a> : undefined} />
    <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col px-3 pt-3"><PuzzleTabs root={value.root} />
      {value.notice && <p role="alert" className="mb-2 shrink-0 rounded-sm border border-accent p-2 text-sm">{value.notice}</p>}
      {value.placeholderArt && <p className="mb-2 shrink-0 text-[11px] text-ink-on-dark-soft">Placeholder enemy art · real progression and rewards</p>}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">{children}</div>
      {footer && <div className="shrink-0 border-t border-hairline-dark pt-2 pb-safe">{footer}</div>}
    </div><PuzzleGuide open={guide} onClose={() => setGuide(false)} isolated={value.isolated} practiceTo={value.isolated ? '/dev/puzzles-practice' : '/puzzles/practice'} /></MinigameShell>
}
