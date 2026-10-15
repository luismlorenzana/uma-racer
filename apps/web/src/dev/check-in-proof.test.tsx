// @vitest-environment jsdom
// The check-in's dev proof (T142) at `/dev/check-in` in dev builds: the size chips from the seed's clock, marked
// "Fits 13:00" at 09:00 and "Overnight" at 23:00 and preselected with nothing confirmed; each queue's finish times as
// `projectWork` projects them, with the warning before a short entry would start; and every stopped queue's card.
import { clockTime } from '@racer/domain/rework/check-in'
import { endsAt } from '@racer/domain/rework/work'
import { projectWork } from '@racer/domain/rework/planner'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { G2Game } from '../app/game'
import { renderG2, seed, stubStorage } from '../testing'
import { apply, farmAccount, farmSeed, uma } from '../places/farm/fixtures'
import { createMemoryGame } from './memory'
import { seedAt, type G2Seed } from './seed'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(stubStorage)

function recorded(made: G2Seed) {
  const base = createMemoryGame(made, () => 0)
  const calls: string[] = []
  const game: G2Game = { ...base, run: (name, input, busyKey, options) => { calls.push(name); return base.run(name, input, busyKey, options) } }
  return { game, calls }
}

async function proof(made: G2Seed) {
  const { game, calls } = recorded(made)
  renderG2('/dev/check-in', game)
  const page = await waitFor(() => {
    const found = document.querySelector<HTMLElement>('[data-g2="check-in-proof"]')
    expect(found).not.toBeNull()
    return found!
  })
  return { page, game, calls }
}

describe('the size chips from the clock (02 §3)', () => {
  it('mark "Fits 13:00" at 09:00 and "Overnight" at 23:00, preselected, with nothing confirmed', async () => {
    const morning = await proof(seedAt(seed('busy'), '09:00'))
    within(morning.page).getByText(/^Clock 09:00 · next check-in 13:00$/)
    const gather = morning.page.querySelector<HTMLElement>('[data-proof-kind="Gather, grade 1"]')!
    const marked = gather.querySelector<HTMLElement>('[data-marked]')!
    expect(marked.getAttribute('aria-label')).toMatch(/, Fits 13:00$/)
    await waitFor(() => expect(marked.getAttribute('aria-checked')).toBe('true'))
    expect(within(gather).getByRole('radio', { name: /^×\d+, ends \d\d:\d\d · then free until 13:00, Fits 13:00$/ })).toBe(marked)
    expect(morning.calls).toEqual([])
    cleanup()

    const night = await proof(seedAt(seed('busy'), '23:00'))
    for (const kind of night.page.querySelectorAll<HTMLElement>('[data-proof-kind]')) {
      expect(kind.querySelector('[data-marked]')!.getAttribute('aria-label')).toMatch(/, Overnight$/)
    }
  })
})

describe('queues (02 §3)', () => {
  it("show each queued entry's finish as projectWork projects it", async () => {
    const made = seed('busy')
    const { page } = await proof(made)
    const projection = projectWork(made.state, made.at, made.env)
    const queued = Object.values(projection.current.work).filter((row) => row.queue.length > 0)
    expect(queued.length).toBeGreaterThan(0)
    for (const row of queued) {
      const block = page.querySelector<HTMLElement>(`[data-proof-queue="${row.outfitId}"]`)!
      const started = projection.ahead.work[row.outfitId]!.entries[row.entries.length]!
      within(block).getByText(new RegExp(`→ ${clockTime(endsAt(started), 0)}$`))
    }
  })

  it('warns on a queued entry the Warehouse won\'t cover, before it would start', async () => {
    const { state: account, at } = farmAccount(1)
    let next = apply(account, 'dev-grant', { items: { wheat: 1 } }, at).state
    next = apply(next, 'start', { outfitId: uma(1), slot: { building: 'pantry', slot: 0 }, request: { kind: 'craft', item: 'wheat-flour', count: 1 } }, at).state
    next = apply(next, 'queue', { outfitId: uma(1), add: { request: { kind: 'craft', item: 'wheat-flour', count: 2 }, building: 'pantry' } }, at).state
    const { page } = await proof(farmSeed(next, at))
    const block = page.querySelector<HTMLElement>(`[data-proof-queue="${uma(1)}"]`)!
    within(block).getByText('Short 2 Wheat.')
    within(block).getByText('then Wheat Flour ×2')
  })
})

describe('stopped queues (02 §4)', () => {
  it("show every stopped queue's card on the stopped seed", async () => {
    const { page } = await proof(seed('stopped'))
    expect([...page.querySelectorAll<HTMLElement>('[data-g2="stopped-queue"]')].map((card) => card.dataset.outfit).sort()).toEqual(['sim-uma-02', 'sim-uma-20', 'sim-uma-23'])
    within(page).getByRole('button', { name: 'Buy 10 and restart · 1,080' })
    expect(screen.getByRole('link', { name: /^Collect all · \d+ ready$/ }).getAttribute('href')).toBe('/dev/check-in?sheet=check-in')
  })
})
