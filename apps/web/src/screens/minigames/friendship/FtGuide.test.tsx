// @vitest-environment jsdom
// The How to play guide (M020): pages in order, opening at the page that fits the moment, the current scenario's twist
// marked, and numbers read from the rules rather than written into the copy.
import { FT_FORMATIONS, FT_SHOP_PRICES, FT_TWISTS } from '@racer/domain'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FtGuide, guideSeen, rememberGuideSeen } from './FtGuide'

const guide = (props: Partial<Parameters<typeof FtGuide>[0]> = {}) => render(
  <LazyMotion features={domAnimation} strict>
    <FtGuide open tier={1} onClose={() => undefined} {...props} />
  </LazyMotion>,
)
const title = () => document.getElementById('ft-guide-title')?.textContent

// An in-memory store: the runtime's own localStorage may be a stub without the Storage methods.
beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
    clear: () => values.clear(),
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Friendship Training guide', () => {
  it('opens on the goal and walks the pages in order', () => {
    guide()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(title()).toBe('Train a card, earn a star')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(title()).toBe('The season map')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(title()).toBe('Train a card, earn a star')
  })

  it('opens at the page that fits the moment, and ends with a way into the run', () => {
    const onClose = vi.fn()
    guide({ startAt: 'tips', onClose })
    expect(title()).toBe('Tips')
    fireEvent.click(screen.getByRole('button', { name: 'Let’s train' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('reads its numbers from the rules', () => {
    guide({ startAt: 'formations' })
    expect(screen.getByText(`+${FT_FORMATIONS['rainbow-team'].points} · ×${FT_FORMATIONS['rainbow-team'].mult}`)).toBeTruthy()
    cleanup()
    guide({ startAt: 'skills' })
    expect(document.body.textContent).toContain(`a gold skill ${FT_SHOP_PRICES.gold}`)
  })

  it('marks this run’s scenario twist', () => {
    guide({ startAt: 'twists', tier: 3 })
    const marked = screen.getByText('this run').closest('p')!
    expect(marked.textContent).toContain(FT_TWISTS[2]!.name)
  })

  it('remembers that this device has seen it', () => {
    expect(guideSeen()).toBe(false)
    rememberGuideSeen()
    expect(guideSeen()).toBe(true)
  })
})
