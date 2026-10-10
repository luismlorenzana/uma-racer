// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FarmKitchenSheet } from './FarmKitchenSheet'

afterEach(cleanup)
function inert(node: HTMLElement | null): boolean {
  // jsdom exposes this as an assigned property without reflecting the browser's inert attribute.
  for (let current = node; current; current = current.parentElement) if (current.inert) return true
  return false
}
describe('Farm whole-sheet focus boundary', () => {
  it('keeps Close reachable while isolating the background, and wraps Tab across all sheet actions', () => {
    const close = vi.fn()
    render(<LazyMotion features={domAnimation} strict><div><button>Outside Farm action</button><FarmKitchenSheet open close={close}><button>Confirm Farm action</button></FarmKitchenSheet></div></LazyMotion>)
    const exit = screen.getByRole('button', { name: 'Close' })
    const confirm = screen.getByRole('button', { name: 'Confirm Farm action' })
    expect(inert(exit)).toBe(false)
    expect(inert(confirm)).toBe(false)
    expect(inert(screen.getByText('Outside Farm action'))).toBe(true)
    expect(document.activeElement).toBe(exit)
    fireEvent.keyDown(exit, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirm)
    fireEvent.keyDown(confirm, { key: 'Tab' })
    expect(document.activeElement).toBe(exit)
    fireEvent.click(exit); expect(close).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(confirm, { key: 'Escape' }); expect(close).toHaveBeenCalledTimes(2)
  })
})
