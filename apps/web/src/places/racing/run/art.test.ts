import { describe, expect, it, vi } from 'vitest'
import { holdRaceBusts } from './art'

describe('race bust requests (SB6)', () => {
  it('loads only outfit busts once per distinct outfit, keeps runner order, and releases once', async () => {
    const release = vi.fn()
    const hold = vi.fn(() => release)
    const load = vi.fn(async (_kind: string, id: string) => id === 'bad' ? Promise.reject(new Error('bad art')) : `blob:${id}`)
    const busts = holdRaceBusts({ has: (_kind, id) => id !== 'missing', load, hold }, ['invented-b', 'invented-a', 'invented-b', 'missing', 'bad'])
    expect(await busts.urls).toEqual(['blob:invented-b', 'blob:invented-a', 'blob:invented-b', null, null])
    expect(load.mock.calls).toEqual([['bust', 'invented-b'], ['bust', 'invented-a'], ['bust', 'bad']])
    expect(hold.mock.invocationCallOrder[0]).toBeLessThan(load.mock.invocationCallOrder[0]!)
    busts.release(); busts.release()
    expect(release).toHaveBeenCalledTimes(3)
  })
})
