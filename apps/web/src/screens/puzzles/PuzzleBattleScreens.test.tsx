// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { StrictMode, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { applyPuzzleBattleAction, addPuzzleExp, puzzleBattleResult, puzzleData, type PuzzleBattleTransition } from '@racer/domain'
import { createPuzzleUiProofEnvironment } from './PuzzleUiProofScreen'
import { PuzzleProvider } from './PuzzleContext'
import { PuzzleBattleScreen } from './PuzzleBattleScreen'
import { PuzzleResultScreen } from './PuzzleResultScreen'
import { PuzzleGuide, puzzleGuideMemory, puzzleGuidePages } from './PuzzleGuide'
import { PuzzlePracticeScreen } from './PuzzlePracticeScreen'
import { puzzlePracticeInput } from '../../game/puzzles/practice-input'
import { puzzleResultEntrants } from '../../game/puzzles/battle-presentation'
import type { PuzzleSceneOptions } from '../../scenes/puzzles/PuzzleBattleScene'
const scene = vi.hoisted(() => ({ options: null as PuzzleSceneOptions | null, cancel: vi.fn(), pause: vi.fn(), destroy: vi.fn() }))
vi.mock('../../scenes/puzzles/load', () => ({ createPuzzleScene: vi.fn(async (options: PuzzleSceneOptions) => {
  scene.options = options
  return { cancel: scene.cancel, pause: scene.pause, destroy: scene.destroy, setState: vi.fn(), setVisuals: vi.fn(),
    setBoardArt: vi.fn(), active: async () => {} }
}) }))
let seq = 0, env: Awaited<ReturnType<typeof createPuzzleUiProofEnvironment>>, values: Map<string, string>
function mount(node: ReactNode, account = false) {
  return render(<StrictMode><MemoryRouter><LazyMotion features={domAnimation} strict>{account ? <PuzzleProvider environment={env}>{node}</PuzzleProvider> : node}</LazyMotion></MemoryRouter></StrictMode>)
}
beforeEach(async () => {
  values = new Map([['puzzle-proof-guide-v2', '1']])
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) })
  env = await createPuzzleUiProofEnvironment(`puzzle-proof-t113-screen-${++seq}`)
})
afterEach(async () => { cleanup(); await env.database.delete(); vi.clearAllMocks(); vi.unstubAllGlobals() })
async function begin() {
  const a = await env.host.account(), p = a.parties[0]!, c = a.checkpoints[0]!
  const v = await env.host.begin({ partyId: p.partyId, scenarioId: c.scenarioId, nodeId: 'pzn:ura-finale:o1a', darkVariant: null,
    partyRevision: p.revision, checkpointRevision: c.revision }, 'screen-begin')
  if (v.kind !== 'battle') throw new Error('Expected battle'); v.lease.release(); return v
}
describe('battle DOM, guide and receipt surfaces', () => {
  it('Strict Mode replay enables the restored screen and portrait taps preview, never cast', async () => {
    const v = await begin(), append = vi.spyOn(env.host, 'append')
    mount(<PuzzleBattleScreen battleIdOverride={v.open.input.battleId} />, true)
    const button = await screen.findByRole('button', { name: /Amber Ribbon: Front/ })
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(button); await screen.findByRole('dialog', { name: 'Amber Ribbon' })
    expect((screen.getByRole('button', { name: 'Confirm active' }) as HTMLButtonElement).disabled).toBe(true)
    expect(append).not.toHaveBeenCalled(); expect(scene.pause).toHaveBeenCalledWith(true)
  })
  it('guide context is right on first paint; memory is reusable and blocked storage is harmless', () => {
    values.delete('puzzle-proof-guide-v2')
    mount(<PuzzleGuide open startAt="elements" isolated onClose={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Read the elemental matchup' })).toBeTruthy()
    expect(screen.getByText('How to play · 4 of 8')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close the guide' })); expect(puzzleGuideMemory(true).seen()).toBe(true)
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } })
    expect(puzzleGuideMemory(true).seen()).toBe(false); expect(() => puzzleGuideMemory(true).remember()).not.toThrow()
    expect(puzzleGuidePages('/practice').map(p => p.id)).toEqual(['levels', 'drag', 'combos', 'elements', 'hp', 'actives', 'map', 'materials'])
  })
  it('illustrated guide reads domain numbers/unlocks and never starts or spends a fight', () => {
    mount(<PuzzleGuide open startAt="drag" isolated onClose={() => {}} />)
    expect(screen.getByText(/Your 7-second clock starts on the first swap/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Try isolated touch practice' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText(/Four-orb · ×1.25 · PL 5/)).toBeTruthy()
    expect(screen.getByText(/Row · ×1.25 · PL 10/)).toBeTruthy()
    const source = readFileSync('src/screens/puzzles/PuzzleGuide.tsx', 'utf8')
    expect(source).not.toMatch(/host\.|begin\(|commit\(|confirmMaterial\(/)
  })
  it('opening battle guide cancels a drag, background pauses and restore stays separate from input', async () => {
    const v = await begin(); mount(<PuzzleBattleScreen battleIdOverride={v.open.input.battleId} />, true)
    const button = await screen.findByRole('button', { name: /Amber Ribbon: Front/ })
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Uma Puzzles battle guide' }))
    expect(scene.cancel).toHaveBeenCalled(); expect(screen.getByRole('heading', { name: 'One orb, one flowing path' })).toBeTruthy()
    fireEvent(document, new Event('visibilitychange')); expect(scene.pause).toHaveBeenCalledWith(true)
  })
  it('result renders all five EXP carries/stat deltas, an authored unlock and gross/debt/net from the receipt', async () => {
    const v = await begin(), step = applyPuzzleBattleAction(v.state, { type: 'abandon' }), source = v.state.input.entrants[0]!.source
    const gain = addPuzzleExp(source, { level: 4, exp: 120 }, 40)
    const receipt = { schemaVersion: 1 as const, battleId: v.open.input.battleId, input: v.open.input, inputHash: v.open.inputHash,
      result: puzzleBattleResult(step.state), fact: { schemaVersion: 1 as const, scenarioId: 'ura-finale', partyId: 'puzzle-party-1',
        nodeId: 'pzn:ura-finale:o1a', battleId: v.open.input.battleId, attempt: 0, outcome: 'abandon' as const },
      exp: [{ outfitId: source.templateId, frozenLevel: 4, amount: 40, before: gain.before, after: gain.after }],
      materials: [{ itemId: 'constellation:ura-finale:front', gross: 12, debtPaid: 7, net: 5 }], createdAt: 1 }
    // Presentation fixture is deliberately partial to verify zero rows never disappear; never submitted as a receipt.
    expect(puzzleResultEntrants(receipt)[0]!.unlocked).toEqual(['puzzle:four'])
    mount(<PuzzleResultScreen view={{ kind: 'result', receipt, pending: true, summary: { combos: 8, bestCombos: 5, damage: 1234, healed: 25, massHits: 2 } }} retry={async () => {}} />, true)
    await screen.findByRole('region', { name: 'Exact entrant EXP and level changes' })
    expect(screen.getByRole('region', { name: 'Exact entrant EXP and level changes' }).children).toHaveLength(5)
    expect(screen.getByText('+40 EXP · PL 4 → 5')).toBeTruthy(); expect(screen.getByText(/New equip choices: Four-orb/)).toBeTruthy()
    expect(screen.getByText('12', { selector: 'td' })).toBeTruthy(); expect(screen.getByText('7', { selector: 'td' })).toBeTruthy()
    expect(screen.getByText('+5', { selector: 'td' })).toBeTruthy()
  })
  it('practice uses the real engine/components but never touches the account host or Dexie rows', async () => {
    const host = vi.spyOn(env.host, 'account'), before = await Promise.all(env.database.tables.map(t => t.count()))
    mount(<PuzzlePracticeScreen />); await screen.findByRole('heading', { name: 'Touch practice' })
    await waitFor(() => expect(scene.options).not.toBeNull())
    const input = puzzlePracticeInput()
    expect(input.rewards).toEqual([])
    const action = { type: 'drag' as const, path: [{ row: 0, column: 0 }, { row: 0, column: 1 }], elapsedMs: 100, focusId: null }
    await scene.options!.act(action, async (_step: PuzzleBattleTransition) => {})
    await screen.findByText('1/30')
    expect(host).not.toHaveBeenCalled(); expect(await Promise.all(env.database.tables.map(t => t.count()))).toEqual(before)
    const code = readFileSync('src/screens/puzzles/PuzzlePracticeScreen.tsx', 'utf8').split('\n').filter(line => !line.startsWith('//')).join('\n')
    expect(code).not.toMatch(/usePuzzles|PersistentPuzzleHost|Dexie|\.host|\.commit|\.begin/)
    // Full navigations re-create the right provider tree on either side of standalone practice.
    expect(code).toContain('<Link reloadDocument')
    expect(readFileSync('src/screens/puzzles/PuzzleGuide.tsx', 'utf8')).toContain('<Link reloadDocument')
    expect(readFileSync('src/screens/puzzles/PuzzleBattleStage.tsx', 'utf8')).toContain('backReloadDocument={practice}')
    expect(puzzleData(input).seed).toBe('invented-practice-v1')
  })
})
