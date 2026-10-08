// @vitest-environment jsdom
import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PuzzleContentUnavailable } from './Unavailable'
import { PuzzleEnemyPlaceholder } from './Placeholder'
afterEach(cleanup)
describe('Puzzle content failures and explicit temporary art', () => {
  it('offers working Retry/Return without changing the save or hiding a failure', () => {
    const retry = vi.fn(), back = vi.fn()
    render(<LazyMotion strict features={domAnimation}><PuzzleContentUnavailable retry={retry} back={back} /></LazyMotion>)
    expect(screen.getByRole('heading').textContent).toBe('Uma Puzzles content unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' })); fireEvent.click(screen.getByRole('button', { name: 'Return' }))
    expect(retry).toHaveBeenCalledOnce(); expect(back).toHaveBeenCalledOnce()
  })
  it('keeps placeholder art explicitly named and never passes it off as private PAD content', () => {
    render(<PuzzleEnemyPlaceholder element="wood" />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('wood enemy placeholder')
    expect(document.querySelector('svg image')).toBeNull()
  })
})
