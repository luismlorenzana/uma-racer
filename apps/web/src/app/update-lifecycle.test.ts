import { describe, expect, it, vi } from 'vitest'
import { UpdateLifecycle } from './update-lifecycle'

describe('PWA update lifecycle', () => {
  it('offers a restart when a worker is waiting', () => {
    const lifecycle = new UpdateLifecycle()
    lifecycle.workerWaiting(vi.fn())
    expect(lifecycle.getSnapshot()).toMatchObject({ status: 'ready', source: 'waiting-worker', restartRequested: false })
  })

  it('blocks activation during an action and restarts only after that action commits', async () => {
    const lifecycle = new UpdateLifecycle()
    const activate = vi.fn()
    const reload = vi.fn()
    lifecycle.workerWaiting(activate)
    const commit = lifecycle.beginCriticalAction()

    lifecycle.requestRestart()
    expect(activate).not.toHaveBeenCalled()
    expect(lifecycle.getSnapshot()).toMatchObject({ status: 'ready', activeActions: 1, restartRequested: true })

    commit()
    expect(activate).toHaveBeenCalledOnce()
    expect(lifecycle.getSnapshot().status).toBe('activating')
    lifecycle.workerControlled(reload)
    await Promise.resolve()
    expect(reload).toHaveBeenCalledOnce()
    expect(lifecycle.getSnapshot().status).toBe('restarting')
  })

  it('offers a controlled update instead of silently reloading', () => {
    const lifecycle = new UpdateLifecycle()
    const reload = vi.fn()
    lifecycle.workerControlled(reload)
    expect(reload).not.toHaveBeenCalled()
    expect(lifecycle.getSnapshot()).toMatchObject({ status: 'ready', source: 'new-controller' })
    lifecycle.requestRestart()
    expect(reload).toHaveBeenCalledOnce()
  })
})
