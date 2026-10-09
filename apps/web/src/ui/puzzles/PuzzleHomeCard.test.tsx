// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LoadedContent } from '../../content/runtime'
import { PuzzleHomeCard } from './PuzzleHomeCard'
import { usePuzzlePreparation } from '../../game/puzzles/preparation-store'
const content = { manifest: { files: [{ path: 'data/puzzles-catalog.12345678.json' }, { path: 'data/puzzles-cast.12345678.json' }] } } as LoadedContent
function Location() { return <p data-testid="location">{useLocation().pathname}</p> }
const mount = (verifyContent: (c: LoadedContent) => Promise<void>, source = content, enabled = true) => render(<LazyMotion features={domAnimation} strict><MemoryRouter><PuzzleHomeCard content={source} verifyContent={verifyContent} enabled={enabled} /><Location /></MemoryRouter></LazyMotion>)
afterEach(() => { cleanup(); usePuzzlePreparation.setState({ phase: 'unavailable', busy: false }) })
describe('released Puzzle Home entry', () => {
  it('does no host/content I/O before tap; off or unpublished content cannot enter', () => {
    const verify = vi.fn(); const view = mount(verify, content, false)
    expect(screen.queryByRole('button')).toBeNull(); view.unmount()
    mount(verify, { manifest: { files: [] } } as unknown as LoadedContent)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Open Uma Puzzles' }).disabled).toBe(true)
    expect(verify).not.toHaveBeenCalled()
  })
  it('enters only after one verified saved-account check without guessing art provenance', async () => {
    let done!: () => void
    const verify = vi.fn(() => new Promise<void>(resolve => { done = resolve }))
    mount(verify); expect(screen.getByText(/Free battles · real progression and rewards/)).toBeTruthy()
    expect(screen.queryByText(/Placeholder enemy art/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open Uma Puzzles' })); fireEvent.click(screen.getByRole('button', { name: /Checking/ }))
    expect(verify).toHaveBeenCalledOnce(); expect(screen.getByTestId('location').textContent).toBe('/')
    await act(async () => done()); await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/puzzles'))
  })
  it('broken content remains unavailable with Retry, never a fallback or reroll', async () => {
    const verify = vi.fn().mockRejectedValueOnce(new Error('Atlas hash mismatch')).mockResolvedValueOnce(undefined)
    mount(verify); fireEvent.click(screen.getByRole('button', { name: 'Open Uma Puzzles' }))
    expect((await screen.findByRole('alert')).textContent).toContain('hash mismatch')
    expect(screen.getByTestId('location').textContent).toBe('/')
    fireEvent.click(screen.getByRole('button', { name: 'Retry Uma Puzzles' })); await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/puzzles'))
  })
})
