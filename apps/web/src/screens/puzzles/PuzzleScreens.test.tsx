// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { PUZZLES_RELEASE_ENABLED } from '../../game/puzzles/capability'
import { createPuzzleAccountStore, PuzzleProvider, PuzzleShell, puzzleUiGate, type PuzzleEnvironment } from './PuzzleContext'
import { createPuzzleUiProofEnvironment } from './PuzzleUiProofScreen'
import { PuzzleHubScreen, PuzzleUnavailableSection } from './PuzzleHubScreen'
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
  it('off deep link needs no providers/host/content, and DEV storage never names the owner DB', () => {
    expect(PUZZLES_RELEASE_ENABLED).toBe(false)
    render(<MemoryRouter><LazyMotion features={domAnimation} strict><PuzzleShell /></LazyMotion></MemoryRouter>)
    expect(screen.getByText('Uma Puzzles is not released yet')).toBeTruthy(); expect(environment.database.name).toMatch(/^puzzle-proof-/)
    const main = readFileSync('src/main.tsx', 'utf8')
    expect(main).toContain('isolatedPuzzleProof ? app :'); expect(main).toContain('if (!isolatedPuzzleProof) registerAppUpdates()')
    expect(puzzleUiGate(false, null, false)).toBe('disabled'); expect(puzzleUiGate(true, null, false)).toBe('loading')
  })
  it('Hub has exactly five real presets, a named Resume and internal navigation', async () => {
    mount(<PuzzleHubScreen />); await screen.findByText('First Lights')
    expect(screen.getAllByRole('link', { name: 'Edit party' })).toHaveLength(5)
    expect(screen.getByRole('link', { name: 'Resume Squad 1A' }).getAttribute('href')).toBe(`${root}/party/puzzle-party-3/ura-finale`)
    expect(screen.getByRole('navigation', { name: 'Puzzle sections' }).textContent).toContain('ExchangeItems')
    fireEvent.click(screen.getByRole('button', { name: 'Uma Puzzles guide' })); expect(await screen.findByRole('dialog')).toBeTruthy()
  })
  it('roster renders five-across owned rows, overlays, enrolled first and no-A visibly unavailable', async () => {
    const { container } = mount(<PuzzleRosterScreen />); await screen.findByText('Amber Ribbon')
    expect(container.querySelector('.grid-cols-5')?.children).toHaveLength(12)
    expect(screen.getByRole('link', { name: /Amber Ribbon, fire, Puzzle Level 10/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Quiet Comet, No original A/ })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Original A style'), { target: { value: 'end' } }); expect(screen.queryByText('Amber Ribbon')).toBeNull()
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
    expect(screen.queryByText('Correct enrollment')).toBeNull(); expect((screen.getByLabelText('Active') as HTMLSelectElement).disabled).toBe(true)
    expect(screen.getByText(/losing or abandoning does not undo/)).toBeTruthy()
  })
  it('partial editor excludes assigned outfits normally and requires explicit named transfer', async () => {
    mount(<PuzzlePartyScreen />, `${root}/party/puzzle-party-2`, `${root}/party/:partyId`); await screen.findByText('Slot 1 · Leader')
    fireEvent.click(screen.getByRole('button', { name: 'Add Uma' })); await screen.findByRole('dialog', { name: 'Add enrolled Uma' })
    expect(screen.queryByRole('button', { name: /Choose Amber Ribbon/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Move from another party' }))
    expect((screen.getByRole('button', { name: /Choose Frost Ribbon/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Choose Amber Ribbon from First Lights/ })); expect(screen.getByText(/source slot becomes empty/)).toBeTruthy()
    expect((await environment.host.account()).parties[0]!.slots[0]?.outfitId).toBe('invented-ui-0')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm transfer' })); await waitFor(async () => expect((await environment.host.account()).parties[1]!.slots[0]?.outfitId).toBe('invented-ui-0'))
    expect((await environment.host.account()).parties[0]!.slots[0]).toBeNull(); expect((await environment.host.account()).checkpoints[0]!.progress.cleared.length).toBe(13)
  })
  it('stale transfer confirmation is rejected, not silently refreshed and moved', async () => {
    mount(<PuzzlePartyScreen />, `${root}/party/puzzle-party-2`, `${root}/party/:partyId`); await screen.findByText('Slot 1 · Leader')
    fireEvent.click(screen.getByRole('button', { name: 'Add Uma' })); fireEvent.click(screen.getByRole('button', { name: 'Move from another party' })); fireEvent.click(screen.getByRole('button', { name: /Choose Amber Ribbon/ }))
    const a = await environment.host.account(); await environment.host.saveParty({ ...a.parties[0]!, name: 'Changed elsewhere' }, 'invented-stale-edit')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm transfer' })); await screen.findAllByRole('alert')
    expect((await environment.host.account()).parties[1]!.slots[0]).toBeNull()
  })
  it('only unlocked kit options are offered, and slot order updates leader preview', async () => {
    mount(<PuzzlePartyScreen />, `${root}/party/puzzle-party-1`, `${root}/party/:partyId`); await screen.findByLabelText('Active')
    expect(within(screen.getByLabelText('Active')).getAllByRole('option')).toHaveLength(1)
    expect(within(screen.getByLabelText('Pattern')).getAllByRole('option')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Move slot right' })); await waitFor(() => expect(screen.getByLabelText(/Slot 1 leader · Blue Bell/)).toBeTruthy())
  })
  it('shows every chapter regardless of racing ownership, warns low levels and prevents partial launch', async () => {
    mount(<PuzzleChaptersScreen />); await screen.findByText('URA Finale')
    expect(screen.getAllByRole('button', { name: /Open chapter|Continue chapter/ })).toHaveLength(14)
    expect(screen.getAllByText(/Low-level party/).length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText('Party'), { target: { value: 'puzzle-party-2' } })
    expect(screen.getAllByRole('button', { name: 'Open chapter' }).every(b => (b as HTMLButtonElement).disabled)).toBe(true)
  })
  it('map shows 28 labelled preview targets; explicit Dark choice and Begin freeze a real journal', async () => {
    const begin = vi.spyOn(environment.host, 'begin')
    mount(<PuzzleMapScreen />, `${root}/party/puzzle-party-1/ura-finale`, `${root}/party/:partyId/:scenarioId`)
    await screen.findByRole('list', { name: 'Chapter path, top to bottom' })
    expect(within(screen.getByRole('list')).getAllByRole('button')).toHaveLength(28)
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
    fireEvent.click(await screen.findByRole('button', { name: /Squad 1A, PL 1/ })); await screen.findByText('Invented missing pack')
    expect(screen.getByRole('button', { name: 'Retry content' })).toBeTruthy(); expect(screen.getByRole('button', { name: 'Return to map' })).toBeTruthy()
    cleanup(); mount(<PuzzleUnavailableSection />, `${root}/items`, `${root}/items`); await screen.findByText(/T114 adds the scenario/)
  })
  it('foreign journal is read-only with explicit online takeover, same seed and no new reservation', async () => {
    const initial = (await environment.host.account()).checkpoints[1]!.open!, begin = vi.spyOn(environment.host, 'begin')
    mount(<PuzzleMapScreen />, `${root}/party/puzzle-party-3/ura-finale`, `${root}/party/:partyId/:scenarioId`); fireEvent.click(await screen.findByRole('button', { name: 'Resume Squad 1A' }))
    await screen.findByRole('button', { name: 'Review online takeover' }); expect(await environment.database.puzzleJournals.count()).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Review online takeover' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm online takeover' }))
    await screen.findByText(/Journal restored/)
    const after = (await environment.host.account()).checkpoints[1]!.open!
    expect(after.input.seed).toBe(initial.input.seed); expect(after.ownerEpoch).toBe(initial.ownerEpoch + 1); expect(begin).not.toHaveBeenCalled()
    const restored = await environment.host.loadBattle(after.input.battleId); if (restored.kind !== 'battle') throw new Error('Expected restored proof'); expect(puzzleBattleStateHash(restored.state)).toHaveLength(16); restored.lease.release()
  })
  it('account selectors ignore equal reads / journal writes, and holding/releasing a preview is balanced', async () => {
    const store = createPuzzleAccountStore(), a = await environment.host.account(), subscriber = vi.fn(); store.store.subscribe(subscriber)
    store.publish(a); store.publish(structuredClone(a)); expect(subscriber).toHaveBeenCalledOnce()
    const release = vi.fn(), acquire = vi.fn(async () => ({ ...await environment.acquire(), release }))
    mount(<PuzzleMapScreen />, `${root}/party/puzzle-party-1/ura-finale`, `${root}/party/:partyId/:scenarioId`, { ...environment, acquire })
    fireEvent.click(await screen.findByRole('button', { name: /Squad 1A, PL 1/ })); await screen.findAllByText('Invented training sprite')
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
