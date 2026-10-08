// UI lifecycle over the real journal port. Durable append precedes every animation (implementation §5).
import { puzzleBattleStateHash, type PuzzleBattleAction, type PuzzleBattleTransition } from '@racer/domain'
import type { PuzzleBattleView, PuzzleHost, PuzzleLoadedBattle } from './host'
export type PuzzleBattlePhase = 'restoring' | 'ready' | 'saving' | 'animating' | 'committing' | 'error' | 'result' | 'recovery'
export class PuzzleBattleSession {
  view: PuzzleLoadedBattle | null = null
  phase: PuzzleBattlePhase = 'restoring'
  error: string | null = null
  private generation = 0
  private disposed = false
  private busy = false
  private restoreQueued = false
  constructor(readonly host: Pick<PuzzleHost, 'loadBattle' | 'append' | 'commit' | 'takeover'>, readonly battleId: string,
    private readonly changed: () => void) {}
  private replace(view: PuzzleLoadedBattle) {
    if (this.view?.kind === 'battle') this.view.lease.release()
    this.view = view
  }
  async restore() {
    if (this.disposed) return
    if (this.busy) { this.restoreQueued = true; return }
    this.busy = true; const gen = ++this.generation
    this.phase = 'restoring'; this.error = null; this.changed()
    try {
      const view = await this.host.loadBattle(this.battleId)
      if (this.disposed || gen !== this.generation) { if (view.kind === 'battle') view.lease.release(); return }
      this.replace(view); this.phase = view.kind === 'battle' ? 'ready' : view.kind
      if (view.kind === 'battle' && view.state.outcome !== 'active') await this.settle(view)
    } catch (e) {
      if (!this.disposed) { this.error = e instanceof Error ? e.message : 'Restore failed. Your journal is retained.'; this.phase = 'error' }
    } finally { await this.finish() }
  }
  private async settle(view: PuzzleBattleView) {
    this.phase = 'committing'; this.changed()
    const result = await this.host.commit({ battleId: this.battleId, ownerEpoch: view.open.ownerEpoch,
      expectedCount: view.state.actionCount, stateHash: puzzleBattleStateHash(view.state) })
    if (this.disposed) return
    this.replace(result); this.phase = 'result'
  }
  async act(action: PuzzleBattleAction, animate: (step: PuzzleBattleTransition) => Promise<void>) {
    if (this.busy || this.disposed || this.phase !== 'ready' || this.view?.kind !== 'battle') return false
    this.busy = true; const view = this.view
    this.phase = 'saving'; this.changed()
    try {
      const step = await this.host.append(this.battleId, view.open.ownerEpoch, view.state.actionCount, action)
      // Keep the accepted state even if rendering/navigation fails. Resume replays this exact action.
      const accepted = { ...view, state: step.state, stateHash: puzzleBattleStateHash(step.state), actions: [...view.actions, action], lastStep: step }
      if (this.disposed) return true
      this.phase = 'animating'; this.changed(); await animate(step)
      if (this.disposed) return true
      this.view = accepted
      if (step.state.outcome !== 'active') await this.settle(accepted)
      else this.phase = 'ready'
      return true
    } catch (e) {
      if (this.disposed) return false
      const message = e instanceof Error ? e.message : 'The action could not be saved.'
      try {
        const restored = await this.host.loadBattle(this.battleId)
        if (this.disposed) { if (restored.kind === 'battle') restored.lease.release(); return false }
        this.replace(restored)
      } catch { /* Keep last accepted board, locked. */ }
      if (this.disposed) return false
      this.error = message; this.phase = 'error'; return false
    } finally { await this.finish() }
  }
  private async finish() {
    this.busy = false
    if (this.disposed) return
    if (this.restoreQueued) { this.restoreQueued = false; await this.restore() }
    else this.changed()
  }
  dispose() { this.disposed = true; this.generation++; if (this.view?.kind === 'battle') this.view.lease.release() }
}
