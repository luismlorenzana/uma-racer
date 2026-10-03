import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { applyAction, replay, type CombatAction } from '@racer/domain'
import { afterEach, describe, expect, it } from 'vitest'
import { ProofBattleHost, proofEncounter } from './proof-host'

const databaseName = 'uma-rpg-t094-test'
afterEach(async () => { await Dexie.delete(databaseName) })

describe('isolated T094 proof journal', () => {
  it('restores exact action index/hash with a fresh host and refuses a double submission', async () => {
    const host = new ProofBattleHost('practice', databaseName)
    const before = await host.resume('proof')
    const action: CombatAction = { kind: 'skill', actorId: 'ally-0', targetId: 'proof-scout', skill: proofEncounter('practice').allies[0]!.loadout[0]! }
    const next = await host.submitAction('proof', 0, action)
    expect(next.actionCount).toBe(1)
    expect(next.cues).toEqual(applyAction(before.state!, action).cues)
    await expect(host.submitAction('proof', 0, action)).rejects.toThrow(/stale/)
    host.close()
    const reloaded = new ProofBattleHost('practice', databaseName)
    expect(await reloaded.resume('proof')).toEqual(next)
    reloaded.close()
  })
  it('scripts weakness, heal, guard, phase, KO and victory using the same public host port', async () => {
    const host = new ProofBattleHost('boss', databaseName)
    let view = await host.resume('proof')
    const observed = new Set<string>()
    for (let index = 0; index < 80 && view.state?.outcome === 'active'; index++) {
      const state = view.state
      const actor = state.input.allies.find((ally) => state.units.some((unit) => unit.id === ally.id && unit.hp > 0) && !state.acted.includes(ally.id))!
      const action: CombatAction = actor.id === 'ally-2' && state.round === 1
        ? { kind: 'guard', actorId: actor.id, targetId: 'ally-0' }
        : actor.id === 'ally-3' && state.round === 2
          ? { kind: 'skill', actorId: actor.id, targetId: 'ally-0', skill: actor.loadout[1]! }
          : actor.id === 'ally-0'
            ? { kind: 'skill', actorId: actor.id, targetId: 'proof-captain', skill: actor.loadout[0]! }
            : { kind: 'attack', actorId: actor.id, targetId: 'proof-captain' }
      view = await host.submitAction('proof', view.actionCount, action)
      for (const cue of view.cues) { observed.add(cue.kind); if ('label' in cue && cue.label === 'Weakness') observed.add('weakness') }
    }
    expect(view.state?.outcome).toBe('victory')
    expect([...observed]).toEqual(expect.arrayContaining(['guard', 'heal', 'phase', 'ko', 'weakness', 'result']))
    expect(await host.complete('proof')).toMatchObject({ kind: 'accepted', outcome: 'win', evidence: null })
    expect((await host.complete('proof')).actionCount).toBe(view.actionCount)
    host.close()
  })
  it('accepts a loss with no rewards and retries the same frozen kit/seed', async () => {
    const host = new ProofBattleHost('loss', databaseName)
    let view = await host.resume('proof')
    const input = view.state!.input
    for (let index = 0; index < 50 && view.state?.outcome === 'active'; index++) {
      const state = view.state
      const actor = state.input.allies.find((ally) => state.units.some((unit) => unit.id === ally.id && unit.hp > 0) && !state.acted.includes(ally.id))!
      view = await host.submitAction('proof', view.actionCount, { kind: 'attack', actorId: actor.id, targetId: 'proof-captain' })
    }
    expect(view.state?.outcome).toBe('loss')
    expect(await host.complete('proof')).toMatchObject({ kind: 'accepted', outcome: 'loss', evidence: null })
    const retry = await host.enter('proof', 'proof', 'proof-node')
    expect(retry.actionCount).toBe(0)
    expect(retry.state?.input).toEqual(input)
    expect(replay(retry.state!.input, []).hash).toBe(replay(input, []).hash)
    host.close()
  })
})
