// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NodeButton, type NodeState } from './ExtraStatsScreen'

afterEach(cleanup)

const node = (state: NodeState, index = 2, onPress = vi.fn()) =>
  render(<NodeButton stat="stamina" index={index} state={state} pay={40} cropName="Sweet Potato" disabled={false} onPress={onPress} />)

describe('Extra stats node buttons (D235)', () => {
  it('names each state and its action for assistive tech, never by colour alone', () => {
    node('on')
    expect(screen.getByRole('button', { name: 'Stamina node 2, on, +40. Turn off' }).getAttribute('aria-pressed')).toBe('true')
    cleanup()
    node('off')
    expect(screen.getByRole('button', { name: 'Stamina node 2, off. Turn on' }).getAttribute('aria-pressed')).toBe('false')
    cleanup()
    node('next', 3)
    expect(screen.getByRole('button', { name: 'Buy Stamina node 3 for 3 Sweet Potato' }).textContent).toContain('×3')
    cleanup()
    node('locked', 4)
    expect((screen.getByRole('button', { name: 'Stamina node 4, locked: buy node 3 first' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('reports its state when pressed', () => {
    const onPress = vi.fn()
    node('off', 1, onPress)
    fireEvent.click(screen.getByRole('button'))
    expect(onPress).toHaveBeenCalledWith('off')
  })
})
