// Safe PWA update lifecycle: never reload across an uncommitted gameplay action.

export type UpdateSource = 'waiting-worker' | 'new-controller'
export type UpdateStatus = 'current' | 'ready' | 'activating' | 'restarting'

export interface UpdateSnapshot {
  status: UpdateStatus
  source: UpdateSource | null
  activeActions: number
  restartRequested: boolean
}

type Effect = () => void | Promise<void>

const CURRENT: UpdateSnapshot = {
  status: 'current',
  source: null,
  activeActions: 0,
  restartRequested: false,
}

export class UpdateLifecycle {
  private snapshot: UpdateSnapshot = CURRENT
  private readonly listeners = new Set<() => void>()
  private activate: Effect | null = null
  private reload: Effect | null = null

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getSnapshot = (): UpdateSnapshot => this.snapshot

  private update(next: Partial<UpdateSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...next }
    for (const listener of this.listeners) listener()
  }

  workerWaiting(activate: Effect): void {
    this.activate = activate
    this.update({ status: 'ready', source: 'waiting-worker' })
    this.advance()
  }

  workerControlled(reload: Effect): void {
    this.reload = reload
    this.update({ status: 'ready', source: 'new-controller' })
    this.advance()
  }

  beginCriticalAction(): () => void {
    this.update({ activeActions: this.snapshot.activeActions + 1 })
    let finished = false
    return () => {
      if (finished) return
      finished = true
      this.update({ activeActions: Math.max(0, this.snapshot.activeActions - 1) })
      this.advance()
    }
  }

  requestRestart(): void {
    if (this.snapshot.status === 'current' || this.snapshot.status === 'restarting') return
    this.update({ restartRequested: true })
    this.advance()
  }

  private advance(): void {
    if (!this.snapshot.restartRequested || this.snapshot.activeActions > 0) return
    if (this.snapshot.source === 'new-controller' && this.reload && this.snapshot.status !== 'restarting') {
      const reload = this.reload
      this.update({ status: 'restarting' })
      void Promise.resolve(reload())
      return
    }
    if (this.snapshot.source === 'waiting-worker' && this.activate && this.snapshot.status !== 'activating') {
      const activate = this.activate
      this.update({ status: 'activating' })
      void Promise.resolve(activate()).catch(() => {
        this.update({ status: 'ready', restartRequested: false })
      })
    }
  }
}

export const appUpdateLifecycle = new UpdateLifecycle()

export async function criticalGameplayAction<T>(action: () => Promise<T>): Promise<T> {
  const finish = appUpdateLifecycle.beginCriticalAction()
  try {
    return await action()
  } finally {
    finish()
  }
}
