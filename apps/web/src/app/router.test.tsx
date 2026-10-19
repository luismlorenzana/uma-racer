// @vitest-environment jsdom
// The live router's routes (`G2_ROUTES`, which `createG2Router` serves; docs/game/11-hub-and-places.md §2.4, §7; T143
// check 6) in a memory router: every §7.2 row lands on its "After" with its params and search; deleted paths,
// `/training/<umaId>`, `/cards/redeem`, the seeds' path and unknown paths reach `/`; and `/` opens by the start rule's
// three cases and the last page.
import { cleanup, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderG2, seedGame, stubStorage } from '../__fixtures__/testing'
import { BOOTING_GAME } from './game'
import { isSeedsPath, SEEDS_PATH } from './router'
import { RULES } from './rules'
import { LAST_PAGE_KEY, startPath } from './start'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(stubStorage)

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
  it("keeps the routes that already match: /farm is the Farm page, an Uma's reveal is the reveal", async () => {
    expect(await landing('/farm')).toBe('/farm')
    expect(await landing('/collection/reveal/uma/sim-uma-07')).toBe('/collection/reveal/uma/sim-uma-07')
  })

  it.each([
    '/stable', '/collection', '/races', '/cards/redeem', '/training/sim-uma-07', '/rpg/roster', '/rpg/party/1/2/fight', '/puzzles', '/puzzles/practice', '/puzzles/content',
    '/minigames/spark-match/sim-uma-07', '/minigames/friendship-training/c', '/minigames/bond-recall', '/farm/section/crops', '/farm/workers',
    '/farm/crops', '/farm/nowhere', '/collection/reveal/card/sim-card-wit-e2', '/dev/farm-kitchen-proof', '/dev/spark-rival-proof',
    '/dev/seeds', '/dev/seeds/town',
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
    localStorage.setItem(LAST_PAGE_KEY, 'nowhere')
    expect(startPath({ umas: 3, needsATap: 0 })).toBe('/town')
    expect(startPath({ umas: 0, needsATap: 9 })).toBe('/town/stable?tab=locked')
  })

  it('waits on `/` while the game opens', async () => {
    expect(await landing('/')).toBe('/')
  })
})

describe("the seeds' mount (dev builds, T145)", () => {
  it('serves its root, with or without the trailing slash, and everything under it, and nothing else', () => {
    expect(['/dev/seeds', '/dev/seeds/', '/dev/seeds/town', '/dev/seeds/dev/check-in'].map(isSeedsPath)).toEqual([true, true, true, true])
    expect(['/', '/dev', '/dev/seedsx', '/dev/seed', '/town'].map(isSeedsPath)).toEqual([false, false, false, false, false])
  })

  it.each(['/dev/seeds', '/dev/seeds/'])('lands %s where the live root lands, by the start rule', async (root) => {
    const live = renderG2('/', seedGame('busy'))
    await waitFor(() => expect(live.where()).not.toBe('/'))
    const expected = live.where()
    cleanup()
    const seeds = renderG2(root, seedGame('busy'), RULES, SEEDS_PATH)
    await waitFor(() => expect(seeds.where()).toBe(expected))
    expect(expected).toBe('/farm')
  })
})
