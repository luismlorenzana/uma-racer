// @vitest-environment jsdom
// The new game's routes (docs/rework/11-hub-and-places.md §2.4, §7) in a memory router: every §7.2 row lands on its
// "After" with its params and search; deleted paths, `/training/<umaId>`, `/cards/redeem` and unknown paths reach `/`;
// and `/` opens by the start rule's three cases and the last page.
import { cleanup, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderG2, seedGame, stubStorage } from '../testing'
import { BOOTING_GAME } from './game'
import { REDIRECTS, redirectPath } from './redirects'
import { LAST_PAGE_KEY, startPath } from './start'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(stubStorage)

const SAMPLE: Readonly<Record<string, string>> = { umaId: 'sim-uma-07', cardId: 'sim-card-wit-e2', districtId: 'garden' }
const filled = (path: string) => path.replace(/:(\w+)/g, (_, name: string) => SAMPLE[name] ?? name)

/** Where `path` lands while the game is still opening, so `/` stays put. */
async function landing(path: string): Promise<string> {
  const { where } = renderG2(path, BOOTING_GAME, null)
  let last = ''
  await waitFor(() => {
    const now = where()
    const settled = now === last
    last = now
    expect(settled).toBe(true)
  })
  cleanup()
  return last
}

describe("today's routes (§7.2)", () => {
  it.each(REDIRECTS.map((row) => [row.from, row.to]))('%s lands on %s, carrying its params and search', async (from, to) => {
    const expected = to === '/' ? '/' : `${redirectPath(to, SAMPLE)}?from=old`
    expect(await landing(`${filled(from)}?from=old`)).toBe(expected)
  })

  it("keeps the routes that already match: /farm is the Farm page, an Uma's reveal is the reveal", async () => {
    expect(await landing('/farm')).toBe('/farm')
    expect(await landing('/collection/reveal/uma/sim-uma-07')).toBe('/collection/reveal/uma/sim-uma-07')
  })

  it.each([
    '/cards/redeem', '/training/sim-uma-07', '/rpg/roster', '/rpg/party/1/2/fight', '/puzzles', '/puzzles/practice', '/puzzles/content',
    '/minigames/spark-match/sim-uma-07', '/minigames/friendship-training/c', '/minigames/bond-recall', '/farm/section/crops', '/farm/workers',
    '/farm/crops', '/farm/nowhere', '/collection/reveal/card/sim-card-wit-e2', '/dev/farm-kitchen-proof', '/dev/spark-rival-proof',
    '/nowhere', '/town/nowhere', '/town/kitchen', '/racing/stable/outfit/x', '/a/b/c/d',
  ])('sends %s to /', async (path) => {
    expect(await landing(path)).toBe('/')
  })

  it('opens every place under its own page, and its sub-routes', async () => {
    expect(await landing('/town/stable/outfit/sim-uma-07/skills')).toBe('/town/stable/outfit/sim-uma-07/skills')
    expect(await landing('/town/account?row=sync')).toBe('/town/account?row=sync')
    expect(await landing('/training/dojo/sim-uma-07')).toBe('/training/dojo/sim-uma-07')
    expect(await landing('/racing/racecourse/run')).toBe('/racing/racecourse/run')
  })
})

describe('the start rule (§2.4)', () => {
  it('opens the Stable\'s Locked tab with no Umas, the Farm when anything needs a tap, else the last page or Town Hall', async () => {
    const opened = async (name: string) => {
      const { where } = renderG2('/', seedGame(name))
      await waitFor(() => expect(where()).not.toBe('/'))
      const at = where()
      cleanup()
      return at
    }
    expect(await opened('fresh')).toBe('/town/stable?tab=locked')
    expect(await opened('busy')).toBe('/farm')
    localStorage.clear()
    expect(await opened('quiet')).toBe('/town')
    localStorage.setItem(LAST_PAGE_KEY, 'racing')
    expect(await opened('quiet')).toBe('/racing')
  })

  it('remembers each page visited, and ignores a stored value that is no page', async () => {
    const { where } = renderG2('/training', seedGame('quiet'))
    await waitFor(() => expect(localStorage.getItem(LAST_PAGE_KEY)).toBe('training'))
    expect(where()).toBe('/training')
    localStorage.setItem(LAST_PAGE_KEY, 'puzzles')
    expect(startPath({ umas: 3, needsATap: 0 })).toBe('/town')
    expect(startPath({ umas: 0, needsATap: 9 })).toBe('/town/stable?tab=locked')
  })

  it('waits on `/` while the game opens', async () => {
    expect(await landing('/')).toBe('/')
  })
})
