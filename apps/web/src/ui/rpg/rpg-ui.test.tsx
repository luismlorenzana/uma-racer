// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ShieldBadge, WeaknessIcons } from './rpg-ui'

afterEach(cleanup)
describe('break-potential icons (D265)', () => {
  it('shows the shield count, or BREAK while it is down', () => {
    render(<><ShieldBadge value={4} /><ShieldBadge value={0} broken /></>)
    expect(screen.getByRole('img', { name: 'Shield 4' }).textContent).toBe('4')
    expect(screen.getByRole('img', { name: 'Broken' })).toBeTruthy()
  })
  it('lists the element weakness first, then weapon kinds', () => {
    render(<WeaknessIcons weaknesses={{ element: 'lightning', weapons: ['spear', 'staff'] }} />)
    expect(screen.getByLabelText('Weak to lightning, Spear, Staff')).toBeTruthy()
    expect(screen.getAllByRole('img').map((node) => node.getAttribute('aria-label'))).toEqual(['Lightning', 'Spear', 'Staff'])
  })
})
