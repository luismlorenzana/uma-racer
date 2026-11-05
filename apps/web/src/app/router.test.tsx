// @vitest-environment jsdom
// The live router's routes (`ROUTES`, which `createRouter` and `createLiveRouter` serve; docs/game/11-hub-and-places.md
// §2.4, §7; T152) in a memory router: the two pages and every place under its own page land where they were asked;
// retired paths, the seeds' old mount and unknown paths reach `/`; and `/` opens the last page, or Town Hall.
import { cleanup, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryGame } from '../__fixtures__/memory'
import { renderRacer, stubStorage } from '../__fixtures__/testing'
import { BOOTING_GAME } from './game'
import { careerPath } from '../hub/nav'
import { CAREER, careerGame, startedState } from '../places/career/__fixtures__/career'
import { LAST_CAREER_KEY, LAST_PAGE_KEY, startPath } from './start'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(stubStorage)

/** Where `path` lands while the game is still opening, so `/` stays put. */
async function landing(path: string): Promise<string> {
  const { where } = renderRacer(path, BOOTING_GAME, { rules: null })
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

describe('the routes (§7)', () => {
  it('opens both pages, and every place under its own page with its sub-routes', async () => {
    expect(await landing('/town')).toBe('/town')
    expect(await landing('/career')).toBe('/career')
    expect(await landing('/town?peek=stable')).toBe('/town?peek=stable')
    expect(await landing('/town/account?row=sync')).toBe('/town/account?row=sync')
    expect(await landing('/town/stable/outfit/invented-uma-01')).toBe('/town/stable/outfit/invented-uma-01')
    expect(await landing('/career/careers')).toBe('/career/careers')
    expect(await landing('/career/training-yard')).toBe('/career/training-yard')
  })

  it.each([
    '/farm', '/training', '/racing', '/racing/racecourse/run', '/farm/kitchen', '/training/dojo/x', '/town/warehouse', '/town/exchange',
    '/collection/reveal/uma/invented-uma-01', '/dev/seeds', '/dev/seeds/town', '/dev/check-in',
    '/nowhere', '/town/nowhere', '/town/careers', '/career/stable', '/a/b/c/d',
  ])('sends %s to /', async (path) => {
    expect(await landing(path)).toBe('/')
  })
})

describe('the start rule (§2.4)', () => {
  it('opens Town Hall the first time, else the last page viewed', async () => {
    const opened = async () => {
      const { where } = renderRacer('/', memoryGame())
      await waitFor(() => expect(where()).not.toBe('/'))
      const at = where()
      cleanup()
      return at
    }
    expect(await opened()).toBe('/town')
    localStorage.setItem(LAST_PAGE_KEY, 'career')
    expect(await opened()).toBe('/career')
  })

  it('remembers each page visited, and ignores a stored value that is no page', async () => {
    const { where } = renderRacer('/career', memoryGame())
    await waitFor(() => expect(localStorage.getItem(LAST_PAGE_KEY)).toBe('career'))
    expect(where()).toBe('/career')
    localStorage.setItem(LAST_PAGE_KEY, 'farm')
    expect(startPath()).toBe('/town')
  })

  it('reopens her career page while it runs (T158), remembering the career on screen and forgetting it elsewhere', async () => {
    const opened = async (state = startedState()) => {
      const { where } = renderRacer('/', careerGame(state))
      await waitFor(() => expect(where()).not.toBe('/'))
      const at = where()
      cleanup()
      return at
    }
    const shown = renderRacer(`${careerPath(CAREER)}/upgrade?tab=tree`, careerGame())
    await waitFor(() => expect(localStorage.getItem(LAST_CAREER_KEY)).toBe(CAREER))
    expect(localStorage.getItem(LAST_PAGE_KEY)).toBe('career')
    shown.unmount()
    expect(await opened()).toBe(careerPath(CAREER))
    // A completed career, or one not in the save, opens the last page instead.
    const started = startedState()
    expect(await opened({ ...started, careers: { [CAREER]: { ...started.careers[CAREER]!, completedAt: 1 } } })).toBe('/career')
    expect(await opened({ ...started, careers: {} })).toBe('/career')
    // Any other screen forgets it.
    renderRacer('/town', careerGame())
    await waitFor(() => expect(localStorage.getItem(LAST_CAREER_KEY)).toBeNull())
    expect(startPath('town', CAREER, () => true)).toBe(careerPath(CAREER))
    expect(startPath('town', null, () => true)).toBe('/town')
  })

  it('waits on `/` while the game opens', async () => {
    expect(await landing('/')).toBe('/')
  })
})
