// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LevelUpTicketsPanel } from './TrainingLevelUp'

afterEach(cleanup)

const panel = (over: Partial<Parameters<typeof LevelUpTicketsPanel>[0]> = {}) => render(
  <LevelUpTicketsPanel owned={3} bank={850} trainingLevel={6} trainingExp={0} opensFor={(count) => count * 2} count={1}
    onCount={vi.fn()} pending={false} onUse={vi.fn()} {...over} />,
)

describe('Level-Up Tickets on the start screen (T088)', () => {
  it('shows what is owned and banked, and is disabled with a hint when none are owned', () => {
    panel({ owned: 0 })
    expect(screen.getByText('Owned 0 · EXP bank 850 / 1,250')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Use/ })).toBeNull()
    expect(screen.getByText(/Earned from EXP past TL10/)).toBeTruthy()
  })

  it('previews the levels and nodes, and caps the count at the levels left to TL10', () => {
    const onCount = vi.fn()
    const onUse = vi.fn()
    panel({ owned: 9, trainingLevel: 8, count: 5, onCount, onUse })
    // Two levels are left, so five asked for is two.
    expect(screen.getByText(/TL8 → TL10 · opens 4 nodes/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'One ticket more' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'One ticket fewer' }))
    expect(onCount).toHaveBeenCalledWith(1)
    fireEvent.click(screen.getByRole('button', { name: 'Use 2 tickets' }))
    expect(onUse).toHaveBeenCalled()
  })
})
