// @vitest-environment jsdom
// The planner's own views (docs/game/02-check-ins-and-notifications.md §6; T142) on the synthetic seeds: her Needs tab
// in T138's profile shows `needsFor`'s lines, its estimate and its startable lines; the target toggle in her header
// marks and removes, refusing past five; the roster view orders, moves and removes targets, or reads automatic, and
// shows `rosterTotals`; a gated line names its gate and the Exchange's row when `buyFor` sells it.
import { CHECK_IN_REFUSALS, hasBannedWord } from '@racer/domain/check-in'
import { automaticTargets, layerProgress, needsFor, rosterTotals, type PlanLine } from '@racer/domain/planner'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { G2Game } from '../../app/game'
import { createMemoryGame } from '../../dev/memory'
import type { G2Seed } from '../../dev/seed'
import { renderG2, seed, stubStorage } from '../../__fixtures__/testing'
import { workView } from '../../ui/work/view'
import { placeName } from '../../ui/work/words'
import { apply, farmAccount, farmSeed, uma } from '../farm/__fixtures__/farm'
import { lineView, movedTarget, toggledTargets } from './model'
import { NEEDS_WORDS } from './words'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(stubStorage)

function recorded(made: G2Seed) {
  const base = createMemoryGame(made, () => 0)
  const calls: { name: string; input: unknown }[] = []
  const game: G2Game = { ...base, run: (name, input, busyKey, options) => { calls.push({ name, input }); return base.run(name, input, busyKey, options) } }
  return { game, calls }
}

const state = (game: G2Game) => game.getSnapshot().state!
const context = (made: G2Seed) => ({ umaName: (id: string) => made.env.content.umas.get(id)?.name ?? '', utcOffsetMin: 0, now: made.at })

describe('her Needs tab (02 §6)', () => {
  it("shows her layer progress, the domain's cascade, the estimate and her startable lines, and Start runs the suggestion", async () => {
    const made = seed('busy')
    const outfitId = 'sim-uma-06'
    const { game, calls } = recorded(made)
    renderG2(`/town/stable/outfit/${outfitId}/needs`, game)
    const tab = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-g2="needs-tab"]')
      expect(found).not.toBeNull()
      return found!
    })
    const progress = layerProgress(made.state.umas[outfitId]!).map((p) => `${placeName(p.facility)} ${p.done}/${p.total}`).join(' · ')
    within(tab).getByText(progress)
    const needs = needsFor(made.state, outfitId, made.at, { env: made.env, utcOffsetMin: 0, chosen: {} })
    const mine = needs.plan.targets[0]!
    const wanted = [...mine.dishes, ...mine.crafted, ...mine.raw].filter((line) => line.need > line.have).map((line) => line.item)
    expect([...tab.querySelectorAll<HTMLElement>('[data-need-line]')].map((el) => el.dataset.needLine)).toEqual(wanted)
    if (needs.estimateSeconds > 0) within(tab).getByText(/^about [\d,]+ Uma-hours of work$/)
    const startable = [...tab.querySelectorAll<HTMLElement>('[data-startable]')]
    expect(startable.map((el) => el.dataset.startable)).toEqual(needs.startable.map((entry) => entry.line.item))
    if (needs.startable.length > 0) {
      const first = needs.startable[0]!.start
      fireEvent.click(within(startable[0]!).getByRole('button', { name: /^Start / }))
      await waitFor(() => expect(calls.at(-1)).toEqual({ name: 'start', input: { outfitId: first.outfitId, slot: first.slot, request: first.request } }))
    }
    for (const text of (tab.textContent ?? '').replace(/[\d,]+/g, '3').split('\n')) expect(hasBannedWord(text), text).toBe(false)
  })

  it('reads "N bonds: pick cards" with her Dojo sheet when a bond waits for a card', async () => {
    const made = seed('busy')
    const withBond = Object.keys(made.state.umas).find((id) => needsFor(made.state, id, made.at, { env: made.env, chosen: {} }).plan.targets[0]!.pickCards > 0)
    expect(withBond).toBeDefined()
    renderG2(`/town/stable/outfit/${withBond!}/needs`, recorded(made).game)
    const link = await screen.findByRole('link', { name: /^\d+ bonds: pick cards$/ })
    expect(link.getAttribute('href')).toBe(`/training/dojo?session=${withBond!}&back=%2Ftown%2Fstable%2Foutfit%2F${withBond!}%2Fneeds`)
  })

  it("names a line's gate and offers the Exchange's row when buyFor sells the item", () => {
    const made = seed('busy')
    const line: PlanLine = { item: 'carrot', level: 'raw', grade: 1, need: 3, have: 0, coming: 0, comingFrom: [], short: 3, gate: { needsLevel: 1, highestFree: 0 } }
    const view = lineView(line, workView(made.state, made.at, made.env).settled, context(made))
    expect(view.gate).toBe('Grade 1 needs Farm Lv 1 · highest free Uma: Lv 0')
    expect(view.buy).toEqual({ price: 162, to: '/town/exchange?family=vegetables&grade=1' })
    expect(lineView({ ...line, gate: null }, made.state, context(made)).buy).toBeNull()
  })
})

describe('targets (02 §6)', () => {
  it('her header marks and removes her; past five the rule says so', async () => {
    const made = seed('busy')
    expect(made.state.profile.targets).toHaveLength(5)
    const { game, calls } = recorded(made)
    renderG2('/town/stable/outfit/sim-uma-06/needs', game)
    fireEvent.click(await screen.findByRole('button', { name: NEEDS_WORDS.mark }))
    await screen.findByText(CHECK_IN_REFUSALS.targets)
    expect(calls.at(-1)).toEqual({ name: 'set-targets', input: { outfitIds: [...made.state.profile.targets, 'sim-uma-06'] } })
    expect(state(game).profile.targets).toEqual(made.state.profile.targets)
    cleanup()

    const second = made.state.profile.targets[1]!
    renderG2(`/town/stable/outfit/${second}/needs`, game)
    await screen.findByText('Target 2 of 5')
    fireEvent.click(screen.getByRole('button', { name: NEEDS_WORDS.remove }))
    await waitFor(() => expect(state(game).profile.targets).toEqual(made.state.profile.targets.filter((id) => id !== second)))
    await screen.findByRole('button', { name: NEEDS_WORDS.mark })
  })

  it('toggles and moves within the list without restating the five', () => {
    expect(toggledTargets(['a', 'b'], 'c')).toEqual(['a', 'b', 'c'])
    expect(toggledTargets(['a', 'b'], 'a')).toEqual(['b'])
    expect(movedTarget(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(movedTarget(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c'])
  })
})

describe('the roster view (02 §6)', () => {
  it('lists the targets in order with up, down and remove, then unlocks left per Uma and the dishes short', async () => {
    const made = seed('busy')
    const { game, calls } = recorded(made)
    renderG2('/town/stable/needs', game)
    const view = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-g2="roster-needs"]')
      expect(found?.querySelector('[data-roster]')).toBeTruthy()
      return found!
    })
    const names = made.state.profile.targets.map((id) => made.env.content.umas.get(id)!.name)
    names.forEach((name, i) => within(view).getByText(`${i + 1}. ${name}`))
    fireEvent.click(within(view).getByRole('button', { name: `Move ${names[0]} down` }))
    await waitFor(() => expect(calls.at(-1)).toEqual({ name: 'set-targets', input: { outfitIds: movedTarget(made.state.profile.targets, made.state.profile.targets[0]!, 1) } }))
    const totals = rosterTotals(made.state, made.at, { env: made.env, chosen: {} })
    const rows = [...view.querySelectorAll<HTMLElement>('[data-roster]')].map((el) => el.dataset.roster)
    expect(rows.slice(5)).toEqual(totals.order.filter((entry) => entry.unlocksLeft > 0).map((entry) => entry.outfitId))
    const dishes = [...view.querySelectorAll<HTMLElement>('[data-need-line]')].map((el) => el.dataset.needLine)
    expect(dishes).toEqual(totals.plan.dishes.filter((line) => line.short > 0).map((line) => line.item))
    fireEvent.click(within(view).getByRole('button', { name: `Remove ${names[1]} from the targets` }))
    await waitFor(() => expect(state(game).profile.targets).not.toContain(made.state.profile.targets[1]))
  })

  it('reads "Automatic: the five furthest behind" with none marked, and lists them', async () => {
    const { state: account, at } = farmAccount(3)
    const made = farmSeed(apply(account, 'set-targets', { outfitIds: [] }, at).state, at)
    renderG2('/town/stable/needs', recorded(made).game)
    await screen.findByText(NEEDS_WORDS.automatic)
    const auto = automaticTargets(made.state, {})
    auto.forEach((id, i) => screen.getByText(`${i + 1}. ${made.env.content.umas.get(id)!.name}`))
    expect(auto).toContain(uma(1))
  })
})
