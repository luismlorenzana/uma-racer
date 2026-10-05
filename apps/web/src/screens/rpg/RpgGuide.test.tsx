// @vitest-environment jsdom
import { RPG_BATTLE_TOKENS, RPG_DEPTH_GATES } from '@racer/domain'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RpgGuide } from './RpgGuide'
vi.mock('motion/react', async original => ({ ...await original<typeof import('motion/react')>(), useReducedMotion: () => true }))
afterEach(cleanup)
describe('campaign guide (D261–D263)', () => {
  it('opens the requested contextual page without briefly rendering the party page', () => {
    render(<LazyMotion features={domAnimation} strict><RpgGuide onClose={() => undefined} startAt="weakness" /></LazyMotion>)
    expect(screen.getByRole('dialog', { name: 'Weakness, Down and One More' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Five Umas, one party' })).toBeNull()
  })
  it('covers all seven pages with the rule constants and closes once', () => {
    const close = vi.fn()
    render(<LazyMotion features={domAnimation} strict><RpgGuide onClose={close} /></LazyMotion>)
    expect(screen.getByRole('dialog', { name: 'Five Umas, one party' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText(new RegExp(RPG_DEPTH_GATES.join(' / ')))).toBeTruthy()
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('dialog', { name: 'The map and rewards' })).toBeTruthy()
    expect(screen.getByText(new RegExp(`${RPG_BATTLE_TOKENS.fight.slot} Slot \\+ ${RPG_BATTLE_TOKENS.fight.skill} Skill per fight`))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(close).toHaveBeenCalledTimes(1)
  })
})
