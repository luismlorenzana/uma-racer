// @vitest-environment jsdom
// The place's scroll position (D176; `app/scroll.ts`): a place opened by a link starts at the top, Back returns to where
// the earlier place was, and a sheet over the page (a change of search alone) keeps the page where it is. jsdom keeps an
// element's scrollTop as set, which is all this needs.
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderG2, seedGame, stubStorage } from '../__fixtures__/testing'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(stubStorage)

const scroller = () => document.querySelector<HTMLElement>('[data-g2="place"]')!

function scrollTo(top: number): void {
  act(() => {
    scroller().scrollTop = top
    fireEvent.scroll(scroller())
  })
}

describe("the place's scroll position (D176)", () => {
  it('starts a place opened by a link at the top, and Back returns to where the last one was', async () => {
    const { where } = renderG2('/town/account', seedGame('busy'))
    await screen.findByText('This phone')
    scrollTo(817)
    // The Uma Tickets pill opens the Stable: a new place, from the top, with its title and Back in view.
    fireEvent.click(document.querySelector('a[href="/town/stable?tab=locked"]')!)
    await waitFor(() => expect(where()).toBe('/town/stable?tab=locked'))
    await screen.findByText(/^\d+ owned · \d+ locked$/)
    expect(scroller().scrollTop).toBe(0)
    fireEvent.click(await screen.findByRole('button', { name: /^Back to/ }))
    await waitFor(() => expect(where()).toBe('/town/account'))
    await screen.findByText('This phone')
    expect(scroller().scrollTop).toBe(817)
  })

  it('keeps the page where it is under a sheet', async () => {
    const { where } = renderG2('/town/account', seedGame('busy'))
    await screen.findByText('This phone')
    scrollTo(300)
    fireEvent.click(screen.getByRole('link', { name: 'Menu: every place' }))
    await waitFor(() => expect(where()).toBe('/town/account?sheet=menu'))
    expect(scroller().scrollTop).toBe(300)
  })
})
