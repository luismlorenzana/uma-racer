// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { createPuzzleAccountStore, PuzzleProvider, PuzzleShell, puzzleUiGate, type PuzzleEnvironment } from './PuzzleContext'
import { createPuzzleUiProofEnvironment } from './PuzzleUiProofScreen'
import { PuzzleHubScreen } from './PuzzleHubScreen'
import { PuzzleItemsScreen } from './PuzzleMaterialsScreen'
import { PuzzleRosterScreen, PuzzleProfileScreen } from './PuzzleRosterScreen'
import { PuzzlePartyScreen } from './PuzzlePartyScreen'
import { PuzzleChaptersScreen } from './PuzzleChaptersScreen'
import { PuzzleMapScreen } from './PuzzleMapScreen'
import { puzzleBattleStateHash } from '@racer/domain'
let sequence = 0
let environment: Awaited<ReturnType<typeof createPuzzleUiProofEnvironment>>
const root = '/dev/puzzles-ui-proof'
function mount(node: ReactNode, path = root, route = root, env: PuzzleEnvironment = environment) {
  return render(<MemoryRouter initialEntries={[path]}><LazyMotion features={domAnimation} strict><PuzzleProvider environment={env}><Routes><Route path={route} element={node} /></Routes></PuzzleProvider></LazyMotion></MemoryRouter>)
}
beforeEach(async () => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, v: string) => { values.set(key, v) } })
  values.set('puzzle-proof-guide-v2', '1')
  environment = await createPuzzleUiProofEnvironment(`puzzle-proof-ui-test-${++sequence}`)
})
afterEach(async () => { cleanup(); await environment?.database.delete(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('Puzzle guarded screens on the real isolated host', () => {
  it('a first-use Hub invites enrollment above all ten parties without auto-enrolling', async () => {
    await environment.database.puzzleOutfits.clear()
    const { container } = mount(<PuzzleHubScreen />)
    await screen.findByText('Start by enrolling Umas in the Roster')
    expect(screen.getByRole('link', { name: 'Open Roster' }).getAttribute('href')).toBe(`${root}/roster`)
    expect(screen.getAllByRole('link', { name: 'Edit party' })).toHaveLength(10)
    expect(container.querySelector('select')).toBeNull()
    expect(await environment.database.puzzleOutfits.count()).toBe(0)
  })
  it('Swap replaces the leader in place with the incoming default kit, preserving other slots and progress', async () => {
    await environment.host.enroll('invented-ui-10', 'fire', 'free-to-swap')
    const before = await environment.host.account()
    mount(<PuzzlePartyScreen />, `${root}/party/puzzle-party-1`, `${root}/party/:partyId`)
    fireEvent.click(await screen.findAllByRole('button', { name: 'Swap' }).then(buttons => buttons[0]!))
    fireEvent.click(await screen.findByRole('button', { name: 'Choose Lilac Noon, Puzzle Level 1' }))
    await waitFor(async () => expect((await environment.host.account()).parties[0]!.slots[0]?.outfitId).toBe('invented-ui-10'))
    const after = await environment.host.account()
    expect(after.parties[0]!.slots[0]!.kit).toEqual(after.outfits.find(o => o.outfitId === 'invented-ui-10')!.kit)
    expect(after.parties[0]!.slots.slice(1)).toEqual(before.parties[0]!.slots.slice(1))
    expect(after.checkpoints).toEqual(before.checkpoints)
    const slot = within(screen.getByRole('region', { name: 'Slot 1 · Leader' }))
    expect(slot.getByLabelText('Leader')).toBeTruthy()
    expect(slot.getByRole('link', { name: 'Profile: Lilac Noon' }).getAttribute('href')).toBe(`${root}/roster/invented-ui-10?party=puzzle-party-1`)
  })
  it('a profile opened from a party has five strip links, party-name Back and EXP; roster entry still returns to Roster', async () => {
    const { container } = mount(<PuzzleProfileScreen />, `${root}/roster/invented-ui-0?party=puzzle-party-1`, `${root}/roster/:outfitId`)
    const strip = await screen.findByRole('navigation', { name: 'First Lights members' })
    const links = within(strip).getAllByRole('link')
    expect(links).toHaveLength(5); expect(links.every(a => a.getAttribute('href')?.endsWith('?party=puzzle-party-1'))).toBe(true)
    expect(links[0]!.getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'First Lights' }).getAttribute('href')).toBe(`${root}/party/puzzle-party-1`)
    expect(screen.getByText('In First Lights')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Puzzle EXP' }).getAttribute('aria-valuenow')).toBe('10')
    expect(container.querySelector('select')).toBeNull()
    cleanup(); mount(<PuzzleProfileScreen />, `${root}/roster/invented-ui-0?party=puzzle-party-2`, `${root}/roster/:outfitId`)
    await screen.findByRole('link', { name: 'Back to Puzzle roster' })
    expect(screen.queryByRole('navigation', { name: /members/ })).toBeNull()
  })
  it('off deep link needs no providers/host/content, and DEV storage never names the owner DB', () => {
    render(<MemoryRouter><LazyMotion features={domAnimation} strict><PuzzleShell enabled={false} /></LazyMotion></MemoryRouter>)
    expect(screen.getByText('Uma Puzzles is not released yet')).toBeTruthy(); expect(environment.database.name).toMatch(/^puzzle-proof-/)
    const main = readFileSync('src/main.tsx', 'utf8')
    expect(main).toContain('isolatedPuzzleProof ? app :'); expect(main).toContain('if (!isolatedPuzzleProof) registerAppUpdates()')
    expect(puzzleUiGate(false, null, false)).toBe('disabled'); expect(puzzleUiGate(true, null, false)).toBe('loading')
  })
  it('Hub has ten real presets, Fill party for partial presets, a named Resume and internal navigation', async () => {
    mount(<PuzzleHubScreen />); await screen.findByText('First Lights')
    expect(screen.getAllByRole('link', { name: 'Edit party' })).toHaveLength(10)
    expect(screen.getAllByRole('link', { name: 'Fill party' })).toHaveLength(8)
    expect(screen.getAllByRole('link', { name: 'Fill party' })[0]!.getAttribute('href')).toBe(`${root}/party/puzzle-party-2`)
    expect(screen.getByRole('link', { name: 'Resume Debut · Stage 1' }).getAttribute('href')).toBe(`${root}/party/puzzle-party-3/ura-finale`)
    expect(screen.getByRole('navigation', { name: 'Puzzle sections' }).textContent).toContain('ExchangeItems')
    fireEvent.click(screen.getByRole('button', { name: 'Uma Puzzles guide' })); expect(await screen.findByRole('dialog')).toBeTruthy()
  })
  it('roster renders five-across owned rows, overlays, enrolled first and no-A visibly unavailable', async () => {
    const { container } = mount(<PuzzleRosterScreen />); await screen.findByText('Amber Ribbon')
    expect(within(screen.getByRole('region', { name: 'Enrolled' })).getAllByRole('link')).toHaveLength(10)
    expect(within(screen.getByRole('region', { name: 'Not enrolled' })).getAllByRole('link')).toHaveLength(2)
    expect(container.querySelector('select')).toBeNull()
    expect(screen.getByRole('link', { name: /Amber Ribbon, fire, Puzzle Level 10/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Quiet Comet, No original A/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Original A style: End' })); expect(screen.queryByText('Amber Ribbon')).toBeNull()
  })
  it('enrollment suggestion never selects/commits; explicit choice and confirmation use the host only', async () => {
    const enroll = vi.spyOn(environment.host, 'enroll')
    mount(<PuzzleProfileScreen />, `${root}/roster/invented-ui-10`, `${root}/roster/:outfitId`); await screen.findByText('Register element')
    const confirm = screen.getByRole('button', { name: 'Confirm enrollment' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true); expect(enroll).not.toHaveBeenCalled()
    expect(screen.getByText(/Roster balance suggestion/).textContent).toContain('not a selection')
    fireEvent.click(screen.getByRole('button', { name: /Fire/ })); fireEvent.click(confirm)
    await waitFor(() => expect(enroll).toHaveBeenCalledOnce()); await screen.findByText('Default kit')
    expect((await environment.host.account()).outfits.find(o => o.outfitId === 'invented-ui-10')!.enrollment.element).toBe('fire')
  })
  it('no-A owned profile explains unavailability and cannot enroll', async () => {
    mount(<PuzzleProfileScreen />, `${root}/roster/invented-ui-11`, `${root}/roster/:outfitId`)
    await screen.findByText(/No original A running style/); expect(screen.queryByRole('button', { name: 'Confirm enrollment' })).toBeNull()
  })
  it('first-entry profile remains element-locked and open party kit controls are disabled', async () => {
    mount(<PuzzleProfileScreen />, `${root}/roster/invented-ui-5`, `${root}/roster/:outfitId`)
    await screen.findByText('Element locked at first entry', { exact: false })
    expect(screen.queryByText('Correct enrollment')).toBeNull(); expect(within(screen.getByRole('group', { name: 'Active' })).getAllByRole('button').every(b => b.matches(':disabled'))).toBe(true)
    expect(screen.getByText(/losing or abandoning does not undo/)).toBeTruthy()
  })
  it('partial editor has a free-only picker with no Move mode and links empty state to Roster', async () => {
    mount(<PuzzlePartyScreen />, `${root}/party/puzzle-party-2`, `${root}/party/:partyId`); await screen.findByText('Slot 1 · Leader')
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Uma' })[0]!); await screen.findByRole('dialog', { name: 'Add enrolled Uma' })
    expect(screen.queryByRole('button', { name: /Choose Amber Ribbon/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Move from another party' })).toBeNull()
    expect(screen.getByText(/Every enrolled Uma is already in a party/)).toBeTruthy()
    expect(within(screen.getByRole('dialog')).getByRole('link', { name: 'Open Roster' }).getAttribute('href')).toBe(`${root}/roster`)
    expect((await environment.host.account()).parties[0]!.slots[0]?.outfitId).toBe('invented-ui-0')
  })
  it('stale Add sheet is rejected, not silently refreshed and assigned', async () => {
    await environment.host.enroll('invented-ui-10', 'fire', 'enroll-free')
    mount(<PuzzlePartyScreen />, `${root}/party/puzzle-party-2`, `${root}/party/:partyId`); await screen.findByText('Slot 1 · Leader')
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Uma' })[0]!)
    const a = await environment.host.account(); await environment.host.saveParty({ ...a.parties[1]!, name: 'Changed elsewhere' }, 'invented-stale-edit')
    fireEvent.click(await screen.findByRole('button', { name: /Choose Lilac Noon/ })); await screen.findAllByRole('alert')
    expect((await environment.host.account()).parties[1]!.slots[0]).toBeNull()
  })
  it('only unlocked kit options are offered, and slot order updates leader preview', async () => {
    const { container } = mount(<PuzzlePartyScreen />, `${root}/party/puzzle-party-1`, `${root}/party/:partyId`); await screen.findByRole('region', { name: 'Slot 1 · Leader' })
    const slot = within(screen.getByRole('region', { name: 'Slot 1 · Leader' }))
    expect(within(slot.getByRole('group', { name: 'Active' })).getAllByRole('button')).toHaveLength(1)
    expect(within(slot.getByRole('group', { name: 'Pattern' })).getAllByRole('button')).toHaveLength(3)
    expect(container.querySelector('select')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Move slot 1 right' })); await waitFor(() => expect(screen.getByRole('group', { name: /Slot 1 leader · Blue Bell/ })).toBeTruthy())
  })
  it('shows every chapter regardless of racing ownership, warns low levels and prevents partial launch', async () => {
    const { container } = mount(<PuzzleChaptersScreen />); await screen.findByText('URA Finale')
    expect(screen.getAllByRole('button', { name: /Open chapter|Continue chapter/ })).toHaveLength(14)
    expect(screen.getAllByText(/Low-level party/).length).toBeGreaterThan(0)
    expect(container.querySelector('select')).toBeNull()
    expect(within(screen.getByRole('group', { name: 'Party' })).getAllByRole('button')).toHaveLength(10)
    fireEvent.click(screen.getByRole('button', { name: /Next Horizons/ }))
    expect(screen.getAllByRole('button', { name: 'Open chapter' }).every(b => (b as HTMLButtonElement).disabled)).toBe(true)
  })
  it('map shows 26 labelled stages in four sections; explicit Dark choice and Begin freeze a real journal', async () => {
    const begin = vi.spyOn(environment.host, 'begin')
    mount(<PuzzleMapScreen />, `${root}/party/puzzle-party-1/ura-finale`, `${root}/party/:partyId/:scenarioId`)
    await screen.findByRole('region', { name: 'Debut section' })
    // D301: Debut, Classic and Senior run six stages and a Guardian each, then the Finals' five Champions.
    expect(['Debut', 'Classic', 'Senior', 'Finals'].map(s => within(screen.getByRole('region', { name: `${s} section` })).getAllByRole('button').length)).toEqual([7, 7, 7, 5])
    const states = [...document.querySelectorAll('[data-state]')].map(b => b.getAttribute('data-state'))
    expect(states.filter(s => s === 'won')).toHaveLength(21); expect(states.filter(s => s === 'next')).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: /Dark Champion, PL 10/ })); await screen.findByText(/Choose the Dark Champion’s ticket family to view/)
    expect((screen.getByRole('button', { name: /Begin battle/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Pace constellation tickets/ })); await screen.findByText('Repay 0 · Inventory +12')
    await waitFor(() => expect((screen.getByRole('button', { name: /Begin battle/ }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: /Begin battle/ }))
    await waitFor(() => expect(begin).toHaveBeenCalledOnce())
    await waitFor(async () => expect(await environment.database.puzzleJournals.count()).toBe(1))
  })
  it('content failure exposes Retry/Return and releases leases; unavailable Items is honest', async () => {
    const env = { ...environment, acquire: vi.fn(async () => { throw new Error('Invented missing pack') }) }
    mount(<PuzzleMapScreen />, `${root}/party/puzzle-party-1/ura-finale`, `${root}/party/:partyId/:scenarioId`, env)
    fireEvent.click(await screen.findByRole('button', { name: /Debut · Stage 1, PL 1/ })); await screen.findByText('Invented missing pack')
    expect(screen.getByRole('button', { name: 'Retry content' })).toBeTruthy(); expect(screen.getByRole('button', { name: 'Return to map' })).toBeTruthy()
    cleanup(); mount(<PuzzleItemsScreen />, `${root}/items`, `${root}/items`); await screen.findByText('Constellation Tickets')
  })
  it('foreign journal is read-only with explicit online takeover, same seed and no new reservation', async () => {
    const initial = (await environment.host.account()).checkpoints[1]!.open!, begin = vi.spyOn(environment.host, 'begin')
    mount(<PuzzleMapScreen />, `${root}/party/puzzle-party-3/ura-finale`, `${root}/party/:partyId/:scenarioId`); fireEvent.click(await screen.findByRole('button', { name: 'Resume Debut · Stage 1' }))
    await screen.findByRole('button', { name: 'Review online takeover' }); expect(await environment.database.puzzleJournals.count()).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Review online takeover' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm online takeover' }))
    await screen.findByText(/Journal restored/, undefined, { timeout: 5000 }) // the takeover replays the journal; slow CI runners need more than 1 s
    const after = (await environment.host.account()).checkpoints[1]!.open!
    expect(after.input.seed).toBe(initial.input.seed); expect(after.ownerEpoch).toBe(initial.ownerEpoch + 1); expect(begin).not.toHaveBeenCalled()
    const restored = await environment.host.loadBattle(after.input.battleId); if (restored.kind !== 'battle') throw new Error('Expected restored proof'); expect(puzzleBattleStateHash(restored.state)).toHaveLength(16); restored.lease.release()
  })
  it('account selectors ignore equal reads / journal writes, and holding/releasing a preview is balanced', async () => {
    const store = createPuzzleAccountStore(), a = await environment.host.account(), subscriber = vi.fn(); store.store.subscribe(subscriber)
    store.publish(a); store.publish(structuredClone(a)); expect(subscriber).toHaveBeenCalledOnce()
    const release = vi.fn(), acquire = vi.fn(async () => ({ ...await environment.acquire(), release }))
    mount(<PuzzleMapScreen />, `${root}/party/puzzle-party-1/ura-finale`, `${root}/party/:partyId/:scenarioId`, { ...environment, acquire })
    fireEvent.click(await screen.findByRole('button', { name: /Debut · Stage 1, PL 1/ })); await screen.findAllByText('Invented training sprite')
    fireEvent.click(screen.getByRole('button', { name: 'Close' })); expect(release).toHaveBeenCalledOnce(); expect(subscriber).toHaveBeenCalledOnce()
  })
  it('actual journal append does not publish a different account or change the frozen board on reload', async () => {
    const a = await environment.host.account(), party = a.parties[0]!, checkpoint = a.checkpoints[0]!
    const view = await environment.host.begin({ partyId: party.partyId, scenarioId: 'ura-finale', nodeId: 'pzn:ura-finale:o1a',
      darkVariant: null, partyRevision: party.revision, checkpointRevision: checkpoint.revision }, 'invented-proof-begin')
    if (view.kind !== 'battle') throw new Error('Expected genuine isolated fight')
    view.lease.release()
    const state = createPuzzleAccountStore(), changed = vi.fn(); state.publish(await environment.host.account()); state.store.subscribe(changed)
    const step = await environment.host.append(view.open.input.battleId, view.open.ownerEpoch, 0, { type: 'drag', path: [{ row: 0, column: 0 }, { row: 0, column: 1 }], elapsedMs: 150, focusId: null })
    state.publish(await environment.host.account()); expect(changed).not.toHaveBeenCalled()
    const loaded = await environment.host.loadBattle(view.open.input.battleId)
    if (loaded.kind !== 'battle') throw new Error('Expected replayed fight')
    expect(loaded.stateHash).toBe(puzzleBattleStateHash(step.state)); expect(loaded.state.board).toEqual(step.state.board); loaded.lease.release()
  })
  it('proof refresh keeps pending edits and recovery replays their canonical bases without double applying', async () => {
    const before = await environment.host.account()
    await environment.host.saveParty({ ...before.parties[0]!, name: 'Resumable proof edit' }, 'invented-reload-edit')
    const reopened = await createPuzzleUiProofEnvironment(environment.database.name)
    try {
      expect((await reopened.host.account()).parties[0]!.name).toBe('Resumable proof edit')
      const foreign = (await reopened.host.account()).checkpoints[1]!.open!
      const restored = await reopened.host.takeover(foreign.input.battleId, foreign.ownerEpoch)
      if (restored.kind !== 'battle') throw new Error('Expected acknowledged same-seed recovery')
      restored.lease.release(); expect((await reopened.host.account()).parties[0]!.revision).toBe(before.parties[0]!.revision + 1)
      expect(await reopened.database.pendingPuzzleOperations.count()).toBe(0)
    } finally { reopened.database.close() }
  })
})
