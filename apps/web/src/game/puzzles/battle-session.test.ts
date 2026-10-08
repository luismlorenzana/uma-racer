import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { puzzleBotAction, puzzleBattleStateHash, puzzlePayloadHash, type PuzzleBattleTransition } from '@racer/domain'
import { createPuzzleUiProofEnvironment } from '../../screens/puzzles/PuzzleUiProofScreen'
import { PuzzleBattleSession } from './battle-session'
import { puzzleCombatSummary, puzzleResultEntrants } from './battle-presentation'
let seq = 0, env: Awaited<ReturnType<typeof createPuzzleUiProofEnvironment>>
beforeEach(async () => { env = await createPuzzleUiProofEnvironment(`puzzle-proof-t113-session-${++seq}`) })
afterEach(async () => { await env.database.delete(); vi.restoreAllMocks() })
async function start(localId = 'o1a') {
  const a = await env.host.account(), party = a.parties[0]!, c = a.checkpoints[0]!
  const v = await env.host.begin({ partyId: party.partyId, scenarioId: c.scenarioId, nodeId: `pzn:ura-finale:${localId}`,
    darkVariant: null, partyRevision: party.revision, checkpointRevision: c.revision }, `session-begin:${localId}`)
  if (v.kind !== 'battle') throw new Error('Expected battle')
  const session = new PuzzleBattleSession(env.host, v.open.input.battleId, () => {}); v.lease.release(); await session.restore(); return session
}
describe('real journal battle lifecycle', () => {
  it('durable append precedes animation; repeated action while saving/animating cannot append', async () => {
    const s = await start(); if (s.view?.kind !== 'battle') throw new Error()
    const action = puzzleBotAction(s.view.state, 'competent'); let unlock!: () => void
    const animation = new Promise<void>(r => { unlock = r })
    const run = s.act(action, async step => {
      expect((await env.database.puzzleJournals.get(s.battleId))?.stateHash).toBe(puzzleBattleStateHash(step.state))
      expect(s.phase).toBe('animating'); await animation
    })
    expect(s.phase).toBe('saving'); expect(await s.act(action, async () => {})).toBe(false)
    await vi.waitFor(() => expect(s.phase).toBe('animating')); expect(await s.act(action, async () => {})).toBe(false)
    unlock(); await run; expect(s.phase).toBe('ready')
    const restored = await env.host.loadBattle(s.battleId); if (restored.kind !== 'battle' || s.view.kind !== 'battle') throw new Error()
    expect(restored.stateHash).toBe(s.view.stateHash); expect(restored.actions).toHaveLength(1); restored.lease.release(); s.dispose()
  })
  it('append rejection restores authority and stays locked until explicit Retry', async () => {
    const s = await start(); if (s.view?.kind !== 'battle') throw new Error()
    const hash = s.view.stateHash, animate = vi.fn(async () => {})
    vi.spyOn(env.host, 'append').mockRejectedValueOnce(new Error('Invented conflict'))
    expect(await s.act(puzzleBotAction(s.view.state, 'competent'), animate)).toBe(false)
    expect(animate).not.toHaveBeenCalled(); expect(s.phase).toBe('error'); expect(s.view).toMatchObject({ stateHash: hash })
    expect(await env.database.puzzleJournals.get(s.battleId)).toMatchObject({ actions: [] })
    await s.restore(); expect(s.phase).toBe('ready'); s.dispose()
  })
  it('replays before unlocking after background during append', async () => {
    const s = await start(); if (s.view?.kind !== 'battle') throw new Error()
    let unlock!: () => void; const animation = new Promise<void>(r => { unlock = r }), load = vi.spyOn(env.host, 'loadBattle')
    const run = s.act(puzzleBotAction(s.view.state, 'competent'), async () => animation)
    await vi.waitFor(() => expect(s.phase).toBe('animating')); await s.restore(); unlock(); await run
    expect(load).toHaveBeenCalledOnce(); expect(s.phase).toBe('ready'); s.dispose()
  })
  it('terminal receipt survives reload with the same replay summary and no double rewards', async () => {
    // Deliberately overlevel only this invented account to exercise the win receipt, not balance.
    await env.database.puzzleOutfits.toCollection().modify(row => { if (Number(row.id.split('-').at(-1)) < 5) row.data.enrollment.level = 30 })
    const s = await start('c-fire'), steps: PuzzleBattleTransition[] = []
    while (s.view?.kind === 'battle') { await s.act(puzzleBotAction(s.view.state, 'competent'), async step => { steps.push(step) }) }
    expect(s.phase).toBe('result'); if (s.view?.kind !== 'result') throw new Error()
    const first = s.view
    expect(first.receipt.result.outcome).toBe('win')
    expect(first.receipt.materials).toEqual([{ itemId: 'constellation:ura-finale:front', gross: 12, debtPaid: 7, net: 5 }])
    expect(first.summary).toEqual(puzzleCombatSummary(steps))
    expect(puzzleResultEntrants(first.receipt)).toHaveLength(5)
    expect(puzzleResultEntrants(first.receipt).every(e => e.amount > 0)).toBe(true)
    await s.restore(); expect(s.view).toEqual(first); expect(await env.database.puzzleJournals.count()).toBe(0)
    expect(await env.database.puzzleArchives.count()).toBe(1); s.dispose()
  })
  it('queues a second restore during initial replay before unlocking', async () => {
    const s = await start(), realLoad = env.host.loadBattle.bind(env.host)
    let resume!: () => void
    const waiting = new Promise<void>(r => { resume = r })
    const load = vi.spyOn(env.host, 'loadBattle').mockImplementationOnce(async id => { await waiting; return realLoad(id) })
    const restoring = s.restore(); await s.restore(); expect(s.phase).toBe('restoring')
    resume(); await restoring
    expect(load).toHaveBeenCalledTimes(2); expect(s.phase).toBe('ready'); s.dispose()
  })
  it('releases a late recovery lease when navigation interrupts a rejected append', async () => {
    const s = await start(); if (s.view?.kind !== 'battle') throw new Error()
    const restored = await env.host.loadBattle(s.battleId); if (restored.kind !== 'battle') throw new Error()
    const release = vi.spyOn(restored.lease, 'release')
    let resume!: () => void
    const waiting = new Promise<void>(r => { resume = r })
    vi.spyOn(env.host, 'append').mockRejectedValueOnce(new Error('Invented conflict'))
    const load = vi.spyOn(env.host, 'loadBattle').mockImplementationOnce(async () => { await waiting; return restored })
    const acting = s.act(puzzleBotAction(s.view.state, 'competent'), async () => {})
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce()); s.dispose(); resume(); await acting
    expect(release).toHaveBeenCalledOnce()
  })
  it('abandon is saved once with zero entrant EXP/materials and no prior progression loss', async () => {
    const s = await start(), before = await env.host.account()
    await s.act({ type: 'abandon' }, async () => {})
    if (s.view?.kind !== 'result') throw new Error()
    expect(s.view.receipt.materials).toEqual([]); expect(puzzleResultEntrants(s.view.receipt).map(e => e.amount)).toEqual([0, 0, 0, 0, 0])
    expect((await env.host.account()).outfits.map(o => [o.enrollment.level, o.enrollment.exp])).toEqual(before.outfits.map(o => [o.enrollment.level, o.enrollment.exp]))
    await s.restore(); expect(s.phase).toBe('result'); s.dispose()
  })
  it('foreign journal is recovery, not a newly generated board; disposal cannot unlock an async restore', async () => {
    const a = await env.host.account(), id = a.checkpoints[1]!.open!.input.battleId
    const s = new PuzzleBattleSession(env.host, id, () => {}); await s.restore()
    expect(s.phase).toBe('recovery'); expect(s.view).toMatchObject({ code: 'foreign-owner' })
    expect(await env.database.puzzleJournals.count()).toBe(0); s.dispose()
    const load = vi.spyOn(env.host, 'loadBattle'); await s.restore(); expect(load).not.toHaveBeenCalled()
  })
  it('a stale epoch cannot submit or mint rewards; its old journal is retained in recovery archive', async () => {
    const s = await start(); if (s.view?.kind !== 'battle') throw new Error()
    const action = puzzleBotAction(s.view.state, 'competent'), seed = s.view.open.input.seed
    await env.database.puzzleCheckpoints.toCollection().modify(row => {
      if (row.data.open?.input.battleId !== s.battleId) return
      row.data.open.ownerEpoch++; row.data.open.input.ownerEpoch++; row.data.open.inputHash = puzzlePayloadHash(row.data.open.input)
    })
    expect(await s.act(action, async () => {})).toBe(false)
    expect(s.view).toMatchObject({ kind: 'recovery', code: 'displaced', open: { input: { seed } } })
    expect(await env.database.puzzleArchives.count()).toBe(1)
    expect(await env.database.puzzleResults.count()).toBe(0); await s.restore()
    expect(s.phase).toBe('recovery'); s.dispose()
  })
})
