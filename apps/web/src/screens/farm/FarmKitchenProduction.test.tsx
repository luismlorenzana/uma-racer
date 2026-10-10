// @vitest-environment jsdom
// Direct-link lifecycle regression: acquiring the host is read-only, only after the save/content are ready.
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import type { ContentState } from '../../content/ContentProvider'
import { diagnoseLoadedContent, SIGNED_OUT_CONTENT } from '../../content/diagnostics'
import { globalCardContent } from '../../game/__fixtures__/global-cards'
import { useGame } from '../../game/store'
import { FarmKitchenProductionShell } from './FarmKitchenProduction'

const acquire = vi.hoisted(() => vi.fn(async () => ({})))
let content: ContentState = { status: 'loading' }
vi.mock('../../content/ContentProvider', () => ({ useContent: () => content }))
vi.mock('../../game/runtime', () => ({ gameRuntime: { farmKitchenHost: acquire } }))
vi.mock('./FarmKitchenScreen', () => ({ FarmKitchenCommonShell: () => <div>Read-only Farm host ready</div> }))

const readyContent = (): ContentState => ({ status: 'ready', content: globalCardContent, diagnostic: diagnoseLoadedContent(globalCardContent), retry: async () => {} })
beforeEach(() => { acquire.mockClear(); content = { status: 'loading' }; useGame.setState({ status: 'booting', error: null, persistent: true, umas: {} }) })
afterEach(() => { cleanup(); useGame.setState({ status: 'booting', error: null }) })

describe('production Farm direct links', () => {
  it('waits through content/save bootstrap, then opens without a reload or preparation call', async () => {
    const view = render(<MemoryRouter><FarmKitchenProductionShell /></MemoryRouter>)
    expect(screen.getByText('Opening Stable Kitchen…')).toBeDefined()
    expect(acquire).not.toHaveBeenCalled()
    content = readyContent(); view.rerender(<MemoryRouter><FarmKitchenProductionShell /></MemoryRouter>)
    expect(acquire).not.toHaveBeenCalled()
    act(() => useGame.setState({ status: 'ready' }))
    await screen.findByText('Read-only Farm host ready')
    expect(acquire).toHaveBeenCalledTimes(1)
  })
  it('drops the previous host on sign-out and acquires the new generation only after another ready save', async () => {
    content = readyContent(); useGame.setState({ status: 'ready' })
    const view = render(<MemoryRouter><FarmKitchenProductionShell /></MemoryRouter>)
    await screen.findByText('Read-only Farm host ready')
    content = { status: 'signed-out', diagnostic: SIGNED_OUT_CONTENT }
    act(() => useGame.setState({ status: 'signed-out' }))
    expect(screen.getByText('Sign in to open Farm')).toBeDefined()
    expect(screen.queryByText('Read-only Farm host ready')).toBeNull()
    content = readyContent(); act(() => useGame.setState({ status: 'booting' }))
    view.rerender(<MemoryRouter><FarmKitchenProductionShell /></MemoryRouter>)
    expect(acquire).toHaveBeenCalledTimes(1)
    act(() => useGame.setState({ status: 'ready' }))
    await waitFor(() => expect(acquire).toHaveBeenCalledTimes(2))
    await screen.findByText('Read-only Farm host ready')
  })
  it('shows a failed save bootstrap instead of leaving the Farm spinning or acquiring a host', () => {
    content = readyContent(); useGame.setState({ status: 'error', error: 'Invented durable-storage failure' })
    render(<MemoryRouter><FarmKitchenProductionShell /></MemoryRouter>)
    expect(screen.getByText('Invented durable-storage failure')).toBeDefined()
    expect(acquire).not.toHaveBeenCalled()
  })
})
