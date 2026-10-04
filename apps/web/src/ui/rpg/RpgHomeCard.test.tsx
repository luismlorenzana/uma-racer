// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RpgRelease } from '../../content/rpg-release'
import type { LoadedContent } from '../../content/runtime'
import { RpgHomeCard } from './RpgHomeCard'
const content = { manifest: { files: [{ path: 'data/rpg-catalog.12345678.json' }, { path: 'data/rpg-chapters.12345678.json' }] } } as LoadedContent
function Location() { return <p data-testid="location">{useLocation().pathname}</p> }
const mount = (verifyContent: (c: LoadedContent) => Promise<RpgRelease>, source = content) => render(<LazyMotion features={domAnimation} strict><MemoryRouter><RpgHomeCard content={source} verifyContent={verifyContent} /><Location /></MemoryRouter></LazyMotion>)
afterEach(cleanup)
describe('lazy Home RPG entry', () => {
  it('does not fetch at startup and disables missing content honestly', () => {
    const verify = vi.fn(); mount(verify, { manifest: { files: [] } } as unknown as LoadedContent)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Open Uma RPG' }).disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toMatch(/not been published/)
    expect(verify).not.toHaveBeenCalled()
  })
  it('checks once on tap and does not navigate until validated', async () => {
    let resolve!: (value: RpgRelease) => void
    const verify = vi.fn(() => new Promise<RpgRelease>(r => { resolve = r }))
    mount(verify); expect(verify).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Open Uma RPG' }))
    fireEvent.click(screen.getByRole('button', { name: /Checking/ }))
    expect(verify).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('location').textContent).toBe('/')
    resolve({ status: 'ready', chapterId: 'invented', pack: {} as Extract<RpgRelease, { status: 'ready' }>['pack'] })
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/rpg'))
  })
  it('never navigates on missing or broken content and offers an explicit retry', async () => {
    const verify = vi.fn().mockRejectedValueOnce(new Error('Portrait hash mismatch')).mockResolvedValueOnce({ status: 'unavailable', reason: 'Opening chapter missing' })
    mount(verify); fireEvent.click(screen.getByRole('button', { name: 'Open Uma RPG' }))
    expect((await screen.findByRole('alert')).textContent).toContain('hash mismatch')
    fireEvent.click(screen.getByRole('button', { name: 'Retry RPG availability' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Opening chapter missing'))
    expect(screen.getByTestId('location').textContent).toBe('/')
  })
  it('ignores a late availability response after content/session replacement', async () => {
    let resolve!: (value: RpgRelease) => void
    const verify = vi.fn(() => new Promise<RpgRelease>(r => { resolve = r }))
    const view = mount(verify)
    fireEvent.click(screen.getByRole('button', { name: 'Open Uma RPG' }))
    const replaced = { manifest: { files: [] } } as unknown as LoadedContent
    view.rerender(<LazyMotion features={domAnimation} strict><MemoryRouter><RpgHomeCard content={replaced} verifyContent={verify} /><Location /></MemoryRouter></LazyMotion>)
    await act(async () => { resolve({ status: 'ready', chapterId: 'invented', pack: {} as Extract<RpgRelease, { status: 'ready' }>['pack'] }) })
    expect(screen.getByTestId('location').textContent).toBe('/')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Open Uma RPG' }).disabled).toBe(true)
  })
})
