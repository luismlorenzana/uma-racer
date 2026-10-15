// @vitest-environment jsdom
// 44 pt touch targets (CLAUDE.md "Conventions"; ux "Accessibility and comfort") where the rehearsal measured less: the
// albums' view toggle (Stable, Card Library, Uma picker, Dojo card picker), the Library's era chips, and the Advance
// sheet's preset tabs. jsdom has no layout, so this holds the size classes; the browser check measures them.
import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderG2, seedGame, stubStorage } from '../__fixtures__/testing'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(stubStorage)

/** At least 44 pt tall and wide: `h-11 w-11`, or `min-h-11` with `min-w-11` (or a full-width share of a row). */
const tall = (element: Element) => /\b(min-)?h-11\b/.test(element.className)
const wide = (element: Element) => /\b(min-)?w-11\b/.test(element.className) || /\bflex-1\b/.test(element.className)

describe('44 pt targets', () => {
  it("gives the album's view toggle and the Library's era chips 44 × 44", async () => {
    renderG2('/town/card-library', seedGame('busy'))
    const views = await screen.findByRole('group', { name: 'View' })
    const toggles = within(views).getAllByRole('button')
    expect(toggles.map((button) => button.getAttribute('aria-label'))).toEqual(['Icon view', 'Card view', 'List view'])
    for (const button of toggles) expect(tall(button) && wide(button), button.className).toBe(true)
    const chips = within(screen.getByRole('group', { name: 'Lens' })).getAllByRole('button')
    expect(chips.length).toBeGreaterThan(10)
    for (const chip of chips) expect(tall(chip) && wide(chip), `${chip.textContent}: ${chip.className}`).toBe(true)
  })

  it("gives the Advance sheet's preset tabs 44 pt", async () => {
    const game = seedGame('gate')
    const umaId = Object.values(game.getSnapshot().state!.umas).find((uma) => uma.racing.level === 10)!.outfitId
    renderG2(`/racing/scenario-gate/${umaId}?sheet=advance`, game)
    const tabs = within(await screen.findByRole('tablist')).getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Sprint', 'Mile', 'Medium', 'Long'])
    for (const tab of tabs) expect(tall(tab) && wide(tab), tab.className).toBe(true)
  })
})
