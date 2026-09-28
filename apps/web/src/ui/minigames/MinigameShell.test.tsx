// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import { MemoryRouter } from 'react-router'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MinigameGauge } from './MinigameGauge'
import { MinigameResult } from './MinigameResult'
import { MinigameHeader, MinigameShell } from './MinigameShell'
import { MinigameStart } from './MinigameStart'
import { createGuideMemory } from './guide-memory'

const withShell = (node: ReactNode) => render(
  <MemoryRouter>
    <LazyMotion features={domAnimation} strict>{node}</LazyMotion>
  </MemoryRouter>,
)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Minigame shell', () => {
  it('uses the validated return path and locks scrolling only during play', () => {
    const onGuide = vi.fn()
    const view = withShell(
      <MinigameShell playing>
        <MinigameHeader
          backTo="/cards?lens=1"
          backLabel="Leave training"
          eyebrow="Friendship Training"
          title="Synthetic Card"
          onGuide={onGuide}
          guideLabel="How to play training"
          headline={{ label: 'Fans', value: 12, ariaLabel: '12 fans' }}
        />
      </MinigameShell>,
    )
    expect(screen.getByRole('link', { name: 'Leave training' }).getAttribute('href')).toBe('/cards?lens=1')
    expect(screen.getByLabelText('12 fans').textContent).toContain('12')
    fireEvent.click(screen.getByRole('button', { name: 'How to play training' }))
    expect(onGuide).toHaveBeenCalledOnce()
    expect(view.container.firstElementChild?.className).toContain('overflow-hidden')
  })

  it('returns a scrolled preview to the header when play starts', () => {
    const view = withShell(<MinigameShell><div>Preview</div></MinigameShell>)
    const shell = view.container.firstElementChild as HTMLElement
    shell.scrollTop = 96
    view.rerender(
      <MemoryRouter>
        <LazyMotion features={domAnimation} strict>
          <MinigameShell playing><div>Playing</div></MinigameShell>
        </LazyMotion>
      </MemoryRouter>,
    )
    expect(shell.scrollTop).toBe(0)
  })
})

describe('Minigame start', () => {
  it('names the ticket price and disables the action when tickets are short', () => {
    const onBegin = vi.fn()
    withShell(
      <MinigameStart
        artwork={<span>Subject art</span>}
        eyebrow="Test game"
        title="Synthetic Subject"
        stake={<span>One star</span>}
        rules={['One rule']}
        cost={2}
        tickets={1}
        onBegin={onBegin}
        onGuide={() => undefined}
      />,
    )
    const button = screen.getByRole('button', { name: 'Need 2 tickets' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(document.body.textContent).toContain('You need 2 tickets.')
    fireEvent.click(button)
    expect(onBegin).not.toHaveBeenCalled()
  })

  it('resumes without presenting a second ticket charge', () => {
    withShell(
      <MinigameStart
        artwork={<span>Subject art</span>}
        eyebrow="Test game"
        title="Synthetic Subject"
        stake={<span>One star</span>}
        rules={['One rule']}
        cost={2}
        tickets={0}
        resume
        onBegin={() => undefined}
        onGuide={() => undefined}
      />,
    )
    expect((screen.getByRole('button', { name: 'Resume' }) as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('Minigame result', () => {
  it('renders the clear treatment, reward slot, Done and priced Again action', () => {
    withShell(
      <MinigameResult
        outcome="cleared"
        eyebrow="Circuit cleared"
        headline="+900 Training EXP"
        reason="All rivals defeated."
        artwork={<span>Winner art</span>}
        reward={<span>TL 2 and First Light</span>}
        doneTo="/constellation/synthetic"
        again={{ label: 'Run again', cost: 1, tickets: 1, onClick: () => undefined }}
      />,
    )
    expect(screen.getByText('+900 Training EXP')).toBeTruthy()
    expect(screen.getByText('TL 2 and First Light')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Done' }).getAttribute('href')).toBe('/constellation/synthetic')
    expect(screen.getByRole('button', { name: 'Run again · 1 ticket' })).toBeTruthy()
  })

  it('renders a loss reason and retry slot while a commit failed', () => {
    const retry = vi.fn()
    withShell(
      <MinigameResult
        outcome="lost"
        eyebrow="Run over"
        headline="Not this time"
        reason="Drive was depleted."
        error="Could not save"
        onRetry={retry}
        doneTo="/cards"
      />,
    )
    expect(screen.getByText('Drive was depleted.')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('Could not save')
    expect(screen.queryByRole('link', { name: 'Done' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry saving' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})

describe('Minigame gauge and guide memory', () => {
  it('exposes the same gauge values it prints', () => {
    render(<MinigameGauge label="Drive" value={42} maximum={100} tone="success" />)
    const meter = screen.getByRole('meter', { name: 'Drive' })
    expect(meter.getAttribute('aria-valuenow')).toBe('42')
    expect(meter.getAttribute('aria-valuemax')).toBe('100')
    expect(meter.textContent).toContain('42/100')
  })

  it('works when device storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    const memory = createGuideMemory('synthetic-guide')
    expect(memory.seen()).toBe(false)
    expect(() => memory.remember()).not.toThrow()
  })
})
