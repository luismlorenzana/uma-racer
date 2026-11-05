// @vitest-environment jsdom
// Every tap target is 44 pt or more (docs/design/ux.md; T157, D386): each button, link, field and tab on the Stable, a
// profile, the Card Library, a card's page, Careers and Account, rendered at 390 × 844, carries a 44 pt-or-taller class
// (Tailwind's `min-h-11`, `size-11`, `h-11` or larger), or sits in a label row that does. jsdom draws no layout, so the
// classes are what holds the rule.
import { initialSave, careerId } from '@racer/domain/save'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cardId, umaId } from '../__fixtures__/content'
import { MEMORY_AT, memoryGame } from '../__fixtures__/memory'
import { renderRacer, stubPointerEvents, stubStorage } from '../__fixtures__/testing'
import { careerPath, cardPath, profilePath } from '../hub/nav'
import { atPhoneSize } from '../stages/__fixtures__/stages'

beforeEach(() => {
  stubStorage()
  stubPointerEvents()
  atPhoneSize()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const TALL = /(?:^|\s)(?:min-h-(?:1[1-9]|[2-9]\d)|size-(?:1[1-9]|[2-9]\d)|h-(?:1[1-9]|[2-9]\d))(?:\s|$)/

/** A target is tall enough by its own class, an ancestor's within its tile, or its label row's. */
function tallEnough(element: HTMLElement): boolean {
  for (let node: HTMLElement | null = element; node !== null && node.dataset.racer !== 'place'; node = node.parentElement) {
    if (TALL.test(node.className)) return true
    if (node !== element && (node.tagName === 'LABEL' || node.tagName === 'BUTTON' || node.tagName === 'A')) return TALL.test(node.className)
  }
  return false
}

function state() {
  const base = initialSave(MEMORY_AT).state
  const zero = { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }
  return {
    ...base,
    umas: { [umaId(1)]: { unlockedAt: MEMORY_AT }, [umaId(2)]: { unlockedAt: MEMORY_AT } },
    cards: { [cardId(1)]: { unlockedAt: MEMORY_AT } },
    careers: {
      [careerId(umaId(1), 1)]: {
        umaId: umaId(1), T: 1, startedAt: MEMORY_AT, season: 2, objectives: [], finale: { step: 0, won: false }, deck: [], posts: {},
        pips: zero, camps: [null, null], skills: [], spSpent: 0, wallet: { drills: zero, bond: 0, sp: 0 }, completedAt: null, racingBuild: null,
      },
    },
  }
}

describe('tap targets (44 pt)', () => {
  it.each([
    ['the Stable, Owned', '/town/stable?tab=owned'],
    ['the Stable, Locked', '/town/stable?tab=locked'],
    ['a profile', profilePath(umaId(1))],
    ['a locked profile', profilePath(umaId(5))],
    ['the Card Library, Owned', '/town/card-library?tab=owned'],
    ['the Card Library, Locked', '/town/card-library?tab=locked'],
    ['a card', cardPath(cardId(2))],
    ['Careers', '/career/careers'],
    ['a career', careerPath(careerId(umaId(1), 1))],
    ['Account', '/town/account'],
  ])('%s', async (_, path) => {
    renderRacer(path, memoryGame({ state: state() }))
    await screen.findByRole('heading', { level: 1 })
    const place = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-racer="place"] [data-place-page]')
      expect(found).not.toBeNull()
      return found!
    })
    const targets = [...place.querySelectorAll<HTMLElement>('button, a, input, [role="tab"]')]
    expect(targets.length).toBeGreaterThan(1)
    const short = targets.filter((target) => !tallEnough(target)).map((target) => target.outerHTML.slice(0, 120))
    expect(short).toEqual([])
  })
})
