// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { buildFriendshipSetup, ftBotPlay } from '@racer/domain'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { globalCardContent, globalCardState, globalCards } from '../game/__fixtures__/global-cards'
import { adoptGameState, clearGameState } from '../game/store'
import { MinigameHostTestDouble, installMinigameHost } from '../game/minigame-host'
import { installMinigameJournal } from '../game/minigame-journal'
import { CardPage } from './CardPage'
import { CardsScreen } from './CardsScreen'
import { FriendshipTrainingScreen } from './minigames/friendship/FriendshipTrainingScreen'

vi.mock('../content/ContentProvider', () => ({ useContent: () => ({ status: 'ready', content: globalCardContent }) }))
vi.mock('motion/react', async (original) => ({ ...await original<typeof import('motion/react')>(), useReducedMotion: () => true }))
let removeHost = () => {}, removeJournal = () => {}
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
const mount = (path: string) => render(<LazyMotion features={domAnimation} strict><MemoryRouter initialEntries={[path]}><Routes>
  <Route path="/cards" element={<CardsScreen />} />
  <Route path="/cards/:cardId" element={<CardPage />} />
  <Route path="/minigames/friendship-training/:cardId" element={<FriendshipTrainingScreen />} />
</Routes></MemoryRouter></LazyMotion>)
beforeEach(() => {
  adoptGameState(globalCardState())
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  HTMLElement.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  cleanup(); removeHost(); removeJournal(); clearGameState(); vi.unstubAllGlobals()
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView
})

describe('global card phone screens', () => {
  it('offers Bond in Collection and returns to that lens rather than the training context', async () => {
    mount('/cards?lens=collection')
    fireEvent.click(await screen.findByRole('button', { name: /Ember support card/ }))
    const link = await screen.findByRole('link', { name: /Bond/ })
    const href = new URL(link.getAttribute('href')!, 'https://example.invalid')
    expect(href.searchParams.get('tier')).toBe('1')
    expect(href.searchParams.get('return')).toBe('/cards?lens=collection')
    expect(screen.getByText('1★ globally')).toBeTruthy()
  })

  it('has one global Bond action and retains a separate scenario-scaling list', async () => {
    const port = new MinigameHostTestDouble()
    removeHost = installMinigameHost(port)
    mount('/cards/invented-card-0?tier=2')
    await waitFor(() => expect(screen.getByRole('link', { name: /Bond globally/ })).toBeTruthy())
    expect(screen.getAllByRole('link', { name: /Bond/ })).toHaveLength(1)
    expect(screen.getByText('Global stars')).toBeTruthy()
    expect(screen.getByText('Scenario scaling')).toBeTruthy()
    const picker = screen.getByRole('combobox', { name: 'Training context' })
    fireEvent.change(picker, { target: { value: '14' } })
    expect(screen.getByRole('link', { name: /Bond globally/ }).getAttribute('href')).toContain('tier=14')
  })

  it('does not offer a new run at global max but exposes an existing paid run for recovery', async () => {
    adoptGameState(globalCardState(3))
    const port = new MinigameHostTestDouble()
    removeHost = installMinigameHost(port)
    await port.beginRun('friendship-training', { kind: 'friendship-training', cardId: globalCards[0]!.id, tier: 1 })
    mount('/cards/invented-card-0')
    expect(await screen.findByRole('link', { name: 'Resume saved training' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Bond globally/ })).toBeNull()
    expect(screen.getByText('3★ · Max everywhere')).toBeTruthy()
  })

  it('restores a terminal paid run in its frozen scenario and names its saved reward global', async () => {
    adoptGameState(globalCardState(0))
    const port = new MinigameHostTestDouble()
    removeHost = installMinigameHost(port); removeJournal = installMinigameJournal(port)
    const target = { kind: 'friendship-training' as const, cardId: globalCards[0]!.id, tier: 2 }
    const ticket = await port.beginRun('friendship-training', target)
    const setup = buildFriendshipSetup({ seed: 101, tier: 2, mainStars: 0, mainCard: globalCards[0]!,
      setCardIds: globalCards.slice(1, 6).map(c => c.id), owned: globalCards.map(template => ({ template, stars: 3 })),
      skills: [], races: globalCardContent.races.items })
    port.setups.set(ticket.runId, setup)
    const played = ftBotPlay(setup)
    expect(played.state.phase).toBe('won')
    for (const [index, action] of played.actions.entries()) await port.append(ticket.runId, index, action)
    mount('/minigames/friendship-training/invented-card-0?tier=2')
    fireEvent.click(await screen.findByRole('button', { name: 'Close the guide' }))
    fireEvent.click(await screen.findByRole('button', { name: /Resume/ }))
    expect(await screen.findByText('Global stars')).toBeTruthy()
    expect(screen.getByText('Every Uma, scenario and distance preset benefits.')).toBeTruthy()
    expect(screen.getByText(/Unity Cup/)).toBeTruthy()
    expect(port.beginCalls).toHaveLength(2) // prepare fixture, then resume, never a new reservation
  })
})
