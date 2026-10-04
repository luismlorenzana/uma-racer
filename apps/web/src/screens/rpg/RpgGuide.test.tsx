// @vitest-environment jsdom
import { RPG_DEPTH_GATES, RPG_SLOT_TOKEN_REWARD, RPG_SKILL_TOKEN_BUDGET } from '@racer/domain'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RpgGuide } from './RpgGuide'
vi.mock('motion/react', async original => ({ ...await original<typeof import('motion/react')>(), useReducedMotion: () => true }))
afterEach(cleanup)
describe('full campaign guide', () => {
  it('opens the requested contextual page without briefly rendering the party page', () => {
    render(<LazyMotion features={domAnimation} strict><RpgGuide onClose={() => undefined} startAt="turn" /></LazyMotion>)
    expect(screen.getByRole('dialog', { name: 'Five outfits, one team' })).toBeTruthy()
    expect(screen.queryByLabelText('5 required party slots')).toBeNull()
  })
  it('covers all nine pages without any save/host calls and uses rule constants', () => {
    const close = vi.fn()
    render(<LazyMotion features={domAnimation} strict><RpgGuide onClose={close} /></LazyMotion>)
    expect(screen.getByRole('dialog', { name: 'Build your adventure party' })).toBeTruthy()
    expect(screen.getByText(/never required/)).toBeTruthy()
    for (let i = 0; i < 7; i++) fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('dialog', { name: 'Levels, skills and promotion' })).toBeTruthy()
    expect(screen.getByText(new RegExp(RPG_DEPTH_GATES.join(' / ')))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText(`${RPG_SLOT_TOKEN_REWARD} Slot · boss`)).toBeTruthy()
    expect(screen.getByText(`At least ${RPG_SKILL_TOKEN_BUDGET} Skill · shortest route`)).toBeTruthy()
    expect(screen.getByText(/repays matching scenario\/type debt/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to RPG' }))
    expect(close).toHaveBeenCalledTimes(1)
  })
})
