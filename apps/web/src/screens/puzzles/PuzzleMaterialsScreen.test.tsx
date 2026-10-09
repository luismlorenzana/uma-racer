// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { puzzleBattleStateHash, puzzleBotAction, puzzleData, resolvePuzzleOperations, type PuzzleStoredEntity } from '@racer/domain'
import { ClSpendSheet } from '../../ui/puzzles/ClSpendSheet'
import { ClLevelUpButton, GlobalMaterialItems } from '../../ui/puzzles/ClLevelUp'
import { PersistentPuzzleHost } from '../../game/puzzles/host'
import { PuzzleProvider, usePuzzleAccount, usePuzzles } from './PuzzleContext'
import { createPuzzleUiProofEnvironment } from './PuzzleUiProofScreen'
import { PuzzleItemsScreen, PuzzleExchangeScreen } from './PuzzleMaterialsScreen'
let seq = 0
let env: Awaited<ReturnType<typeof createPuzzleUiProofEnvironment>>
beforeEach(async () => {
  const memory = new Map([['puzzle-proof-guide-v2', '1']]); vi.stubGlobal('localStorage', { getItem: (id: string) => memory.get(id) ?? null, setItem: (id: string, v: string) => memory.set(id, v) })
  env = await createPuzzleUiProofEnvironment(`puzzle-proof-material-test-${++seq}`)
})
afterEach(async () => { cleanup(); await env.database.delete(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function mount(node: ReactNode, path = `${env.root}/items`) { return render(<MemoryRouter initialEntries={[path]}><LazyMotion features={domAnimation} strict><PuzzleProvider environment={env}>{node}</PuzzleProvider></LazyMotion></MemoryRouter>) }
function Spend({ id = 'invented-ui-0', tier = 1 }: { id?: string; tier?: number }) {
  const p = usePuzzles(), a = usePuzzleAccount()
  return a && <ClSpendSheet host={p.host} account={a} outfitId={id} tier={tier} onClose={() => {}} refresh={async () => p.state.publish(await p.host.account())} />
}
describe('material surfaces using the real isolated host', () => {
  it('off adapters do not construct a host or need providers; all three callers use the same lazy sheet', () => {
    const { container } = render(<><ClLevelUpButton enabled={false} outfitId="invented" tier={1} level={1} /><GlobalMaterialItems enabled={false} visibility="all" scenarioTier={null} /></>)
    expect(container.childElementCount).toBe(0)
    for (const file of ['UmaProfileScreen.tsx', 'TrainingScene.tsx', 'ConstellationScreen.tsx']) expect(readFileSync(`src/screens/${file}`, 'utf8')).toContain('<ClLevelUpButton outfitId={save.templateId}')
  })
  it('All lists 56 definitions and preserved orphan, intersects facets; details separate debt from stock and link eligible recipients', async () => {
    mount(<PuzzleItemsScreen />); await screen.findByText('Constellation Tickets')
    fireEvent.click(within(screen.getByRole('group', { name: 'Item visibility' })).getByRole('button', { name: 'All items' })); await screen.findByText('57 materials shown · 5 owned kinds')
    fireEvent.click(within(screen.getByRole('group', { name: 'Destination scenario' })).getByRole('button', { name: 'URA Finale' })); fireEvent.click(within(screen.getByRole('group', { name: 'Ticket source style' })).getByRole('button', { name: 'Front' }))
    expect(await screen.findByText('1 materials shown · 5 owned kinds')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'URA Finale · Front Constellation Ticket, quantity 5' }))
    await screen.findByText('5 in global inventory · Bank -7')
    expect(screen.getByRole('button', { name: 'Amber Ribbon · Level up' })).toBeTruthy(); expect(screen.queryByRole('button', { name: /Blue Bell · Level up/ })).toBeNull()
  })
  it('unknown item deep link is inspectable, never a spendable substitute', async () => {
    mount(<PuzzleItemsScreen />, `${env.root}/items?item=constellation:invented-future:front`)
    const dialog = await screen.findByRole('dialog'); expect(within(dialog).getByText('1 in global inventory')).toBeTruthy(); expect(within(dialog).getByText(/cannot be spent or exchanged/)).toBeTruthy()
  })
  it('a missing or unsafe material deep link cannot fabricate an item or recipient', async () => {
    mount(<PuzzleItemsScreen />, `${env.root}/items?item=constellation:missing:front`)
    await screen.findByText('This Constellation item link is unavailable. Saved stock is unchanged.')
    expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.queryByRole('button', { name: /Level up/ })).toBeNull()
    expect((await env.host.account()).stocks['constellation:missing:front']).toBeUndefined()
  })
  it('requires an account Opening guardian, rejects unsafe batches and previews both directions', async () => {
    const confirm = vi.spyOn(env.host, 'confirmMaterial'); mount(<PuzzleExchangeScreen />, `${env.root}/exchange`)
    await screen.findByText('Gross 1 → Repaid 0 → Items +1')
    fireEvent.change(screen.getByLabelText('Exchange batches'), { target: { value: '0' } }); expect((screen.getByRole('button', { name: 'Confirm exchange' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Exchange batches'), { target: { value: '1' } }); await screen.findByText('Gross 1 → Repaid 0 → Items +1')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm exchange' })); await screen.findByText('Exchange saved'); expect(confirm).toHaveBeenCalledOnce()
    expect((await env.host.account()).stocks['constellation:ura-finale:front']).toBe(3)
    fireEvent.click(within(screen.getByRole('group', { name: 'Adjacent scenario edge' })).getByRole('button', { name: 'Unity Cup / Trackblazer' })); await screen.findByText('Exchange edge locked'); expect(screen.queryByRole('button', { name: 'Confirm exchange' })).toBeNull()
  })
  it('full interception requires explicit irreversible acknowledgement; exact operation double tap pays only once', async () => {
    const confirm = vi.spyOn(env.host, 'confirmMaterial'); mount(<PuzzleExchangeScreen />, `${env.root}/exchange?from=constellation:unity-cup:front`)
    await screen.findByText('Gross 2 → Repaid 2 → Items +0'); const button = screen.getByRole('button', { name: 'Confirm exchange' }) as HTMLButtonElement
    expect(button.disabled).toBe(true); fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(button); fireEvent.click(button)
    await screen.findByText('Exchange saved'); expect(confirm).toHaveBeenCalledOnce()
    expect((await env.host.account()).stocks['constellation:ura-finale:front']).toBe(5); expect((await env.host.account()).bank!.balances['constellation:ura-finale:front']).toBe(-5)
  })
  it('partial interception previews gross/repaid/net and remaining bank', async () => {
    mount(<PuzzleExchangeScreen />, `${env.root}/exchange?from=constellation:unity-cup:front`); await screen.findByText('Exchange preview')
    fireEvent.change(screen.getByLabelText('Exchange batches'), { target: { value: '6' } }); await screen.findByText('Gross 12 → Repaid 7 → Items +5'); expect(screen.getByText('Output bank after 0')).toBeTruthy()
  })
  it('an exchange with a lost acknowledgement retries the same receipt instead of paying twice', async () => {
    const original = env.host.confirmMaterial.bind(env.host), ids: string[] = []; let lost = true
    vi.spyOn(env.host, 'confirmMaterial').mockImplementation(async (p, id) => { ids.push(id); const receipt = await original(p, id); if (lost) { lost = false; throw new Error('Acknowledgement lost') } return receipt })
    mount(<PuzzleExchangeScreen />); await screen.findByText('Exchange preview'); fireEvent.click(screen.getByRole('button', { name: 'Confirm exchange' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Retry same exchange' })); await screen.findByText('Exchange saved')
    expect(ids).toHaveLength(2); expect(ids[0]).toBe(ids[1]); expect((await env.host.account()).stocks['constellation:ura-finale:front']).toBe(3)
  })
  it('a rejected exchange replaces the projected reward with canonical stock and debt', async () => {
    const entities = new Map<string, PuzzleStoredEntity>()
    for (const kind of ['umas', 'items', 'constellationBank', 'puzzleOutfits', 'puzzlePresets', 'puzzleCheckpoints']) for (const row of await env.database.table(kind).toArray()) entities.set(`${kind}/${row.id}`, { kind, id: row.id, data: puzzleData(row.data), version: row.version, updatedAt: 1, deleted: false })
    mount(<PuzzleExchangeScreen />); await screen.findByText('Exchange preview'); fireEvent.click(screen.getByRole('button', { name: 'Confirm exchange' })); await screen.findByText('Exchange saved')
    const host = env.host; if (!(host instanceof PersistentPuzzleHost)) throw new Error('Proof must use the real host')
    const ops = await host.coordinator.nextBatch(), stock = entities.get('items/constellation:ura-finale:front')!; stock.version++; stock.data.quantity = 0
    const canonical = resolvePuzzleOperations({ enabled: true, accountSeed: 'invented-ui-cutover', now: 20, entities, logs: new Map() }, ops)
    expect(canonical.responses[0]!.status).toBe('rejected'); await host.coordinator.adopt(ops, canonical.responses, 20)
    await screen.findByText('Exchange not accepted'); expect(screen.queryByText('Gross 1 → Repaid 0 → Items +1')).toBeNull()
    expect(screen.getByText('Current stock: input 0 · output 6')).toBeTruthy(); expect(screen.getByText('Current output bank 0')).toBeTruthy()
  })
  it('stale exchange needs explicit refresh/reconfirmation, not a silently changed spend', async () => {
    mount(<PuzzleExchangeScreen />); await screen.findByText('Exchange preview')
    const row = (await env.database.items.get('constellation:ura-finale:front'))!; await env.database.items.put({ ...row, data: { ...row.data, quantity: 4 } })
    await screen.findByText('The preview changed. Refresh and explicitly reconfirm.')
    expect((screen.getByRole('button', { name: 'Confirm exchange' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh preview' })); await waitFor(() => expect((screen.getByRole('button', { name: 'Confirm exchange' }) as HTMLButtonElement).disabled).toBe(false))
  })
  it('mixed source-A + preserved universal spends actual CL, names nodes, preserves all preset state', async () => {
    const before = (await env.database.umas.get('invented-ui-0'))!.data; mount(<Spend />)
    const front = await screen.findByLabelText('Spend URA Finale · Front Constellation Ticket'); expect((screen.getByLabelText('Spend URA Finale · Pace Constellation Ticket') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('Spend Unity Cup · Front Constellation Ticket') as HTMLInputElement).disabled).toBe(true)
    fireEvent.change(front, { target: { value: '2' } }); fireEvent.change(screen.getByLabelText('Spend Legacy Universal CL Ticket'), { target: { value: '1' } })
    await screen.findByText('Total cost 3 tickets'); await screen.findByText('CL 1 → 4')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm CL spend' })); await screen.findByText('Saved locally · pending sync. A canonical rejection can undo this projection.')
    const after = (await env.database.umas.get('invented-ui-0'))!.data
    expect(after.scenarios[0]!.trainingLevel).toBe(4); expect(after.scenarios[0]!.presets).toEqual(before.scenarios[0]!.presets); expect(after.scenarios[0]!.inspiration).toEqual(before.scenarios[0]!.inspiration)
    expect(screen.getAllByRole('link', { name: /Card node/ }).length).toBeGreaterThan(0); expect(screen.getByRole('link', { name: 'Open this constellation' }).getAttribute('href')).toContain('tier=1')
  })
  it('CL9→10 is SP-only; CL10 and locked scenarios cannot spend', async () => {
    mount(<Spend id="invented-ui-4" />); fireEvent.change(await screen.findByLabelText('Spend Legacy Universal CL Ticket'), { target: { value: '1' } }); await screen.findByText('CL 9 → 10'); await screen.findByText(/CL9\/10 increase baseline SP/)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm CL spend' })); await screen.findByRole('button', { name: 'Done' }); expect(screen.getByText('SP +80')).toBeTruthy()
    cleanup(); mount(<Spend id="invented-ui-4" />); await screen.findByText(/CL10 · Maxed/); expect(screen.queryByRole('button', { name: 'Confirm CL spend' })).toBeNull()
    cleanup(); mount(<Spend tier={2} />); await screen.findByText(/Unlock this racing scenario first/)
  })
  it('lost acknowledgement retries the original receipt/id even when the locally committed CL reached ten', async () => {
    const original = env.host.confirmMaterial.bind(env.host), ids: string[] = []; let lost = true
    vi.spyOn(env.host, 'confirmMaterial').mockImplementation(async (p, id) => { ids.push(id); const r = await original(p, id); if (lost) { lost = false; throw new Error('Acknowledgement lost') } return r })
    mount(<Spend id="invented-ui-4" />); fireEvent.change(await screen.findByLabelText('Spend Legacy Universal CL Ticket'), { target: { value: '1' } }); await screen.findByText('CL 9 → 10'); fireEvent.click(screen.getByRole('button', { name: 'Confirm CL spend' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Retry same CL spend' })); await screen.findByRole('button', { name: 'Done' }); expect(ids).toHaveLength(2); expect(ids[0]).toBe(ids[1]); expect((await env.host.account()).stocks['training:level-up-ticket']).toBe(1)
  })
  it('canonical rejection removes false CL power and presents recovery rather than the predicted success', async () => {
    const entities = new Map<string, PuzzleStoredEntity>()
    for (const kind of ['umas', 'items', 'constellationBank', 'puzzleOutfits', 'puzzlePresets', 'puzzleCheckpoints']) for (const row of await env.database.table(kind).toArray()) entities.set(`${kind}/${row.id}`, { kind, id: row.id, data: puzzleData(row.data), version: row.version, updatedAt: 1, deleted: false })
    const before = (await env.database.umas.get('invented-ui-0'))!.data, frozen = (await env.database.puzzleCheckpoints.toArray()).map(r => r.data.open?.input).filter(Boolean)
    mount(<Spend />); fireEvent.change(await screen.findByLabelText('Spend URA Finale · Front Constellation Ticket'), { target: { value: '1' } }); await screen.findByText('CL 1 → 2'); fireEvent.click(screen.getByRole('button', { name: 'Confirm CL spend' })); await screen.findByRole('button', { name: 'Done' })
    const host = env.host; if (!(host instanceof PersistentPuzzleHost)) throw new Error('Proof must use the real host')
    const ops = await host.coordinator.nextBatch(), stock = entities.get('items/constellation:ura-finale:front')!; stock.version++; stock.data.quantity = 0
    const canonical = resolvePuzzleOperations({ enabled: true, accountSeed: 'invented-ui-cutover', now: 20, entities, logs: new Map() }, ops)
    expect(canonical.responses[0]!.status).toBe('rejected'); await host.coordinator.adopt(ops, canonical.responses, 20)
    await screen.findByText('Spend not accepted · current CL 1/10'); expect(screen.queryByText('CL 1 → 2')).toBeNull()
    expect((await env.database.umas.get('invented-ui-0'))!.data.scenarios[0]!.presets).toEqual(before.scenarios[0]!.presets)
    expect((await env.database.puzzleCheckpoints.toArray()).map(r => r.data.open?.input).filter(Boolean)).toEqual(frozen)
  })
  it('real battle→repayment→global Items→exchange→CL uses no grant or secondary inventory', async () => {
    const a = await env.host.account(), party = a.parties[0]!, cp = a.checkpoints[0]!
    const view = await env.host.begin({ partyId: party.partyId, scenarioId: 'ura-finale', nodeId: 'pzn:ura-finale:o1a', darkVariant: null, partyRevision: party.revision, checkpointRevision: cp.revision }, 'invented-material-begin')
    if (view.kind !== 'battle') throw new Error('Expected synthetic battle')
    let state = view.state; while (state.outcome === 'active') state = (await env.host.append(state.input.battleId, state.input.ownerEpoch, state.actionCount, puzzleBotAction(state, 'competent'))).state
    expect(state.outcome).toBe('win'); const result = await env.host.commit({ battleId: state.input.battleId, ownerEpoch: state.input.ownerEpoch, expectedCount: state.actionCount, stateHash: puzzleBattleStateHash(state) }); view.lease.release()
    expect(result.receipt.materials.find(m => m.itemId === 'constellation:ura-finale:front')).toMatchObject({ gross: 1, debtPaid: 1, net: 0 })
    mount(<PuzzleItemsScreen />); await screen.findByText('Constellation Tickets'); expect((await env.host.account()).bank!.balances['constellation:ura-finale:front']).toBe(-6)
    cleanup(); mount(<PuzzleExchangeScreen />, `${env.root}/exchange?from=constellation:unity-cup:front`); await screen.findByText('Exchange preview'); fireEvent.change(screen.getByLabelText('Exchange batches'), { target: { value: '6' } }); await screen.findByText('Gross 12 → Repaid 6 → Items +6'); fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Confirm exchange' })); await screen.findByText('Exchange saved')
    cleanup(); mount(<Spend />); fireEvent.change(await screen.findByLabelText('Spend URA Finale · Front Constellation Ticket'), { target: { value: '1' } }); await screen.findByText('CL 1 → 2'); fireEvent.click(screen.getByRole('button', { name: 'Confirm CL spend' })); await screen.findByRole('button', { name: 'Done' })
    expect((await env.host.account()).stocks['constellation:ura-finale:front']).toBe(10); expect((await env.host.account()).umas[0]!.scenarios[0]!.trainingLevel).toBe(2)
    expect((await env.database.itemLedger.toArray()).every(r => r.data.reason === 'puzzle-material')).toBe(true)
    expect(puzzleData((await env.host.account()).umas[0]!)).toBeTruthy()
  }, 15000)
})
