// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ShieldBadge, WeaknessIcons } from './rpg-ui'

afterEach(cleanup)
describe('break-potential icons (D265, D279)', () => {
  it('shows the shield count, or BREAK while it is down', () => {
    render(<><ShieldBadge value={4} /><ShieldBadge value={0} broken /></>)
    expect(screen.getByRole('img', { name: 'Shield 4' }).textContent).toBe('4')
    expect(screen.getByRole('img', { name: 'Broken' })).toBeTruthy()
  })
  it('lists element weaknesses first, then weapon kinds', () => {
    render(<WeaknessIcons weaknesses={{ elements: ['lightning', 'dark'], weapons: ['spear', 'short-sword'] }} />)
    expect(screen.getByLabelText('Weak to Lightning, Dark, Spear, Short Sword')).toBeTruthy()
    expect(screen.getAllByRole('img').map((node) => node.getAttribute('aria-label'))).toEqual(['Lightning', 'Dark', 'Spear', 'Short Sword'])
  })
})
