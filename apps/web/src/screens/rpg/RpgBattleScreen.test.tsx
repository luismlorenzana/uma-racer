// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { createEncounter } from '@racer/domain'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RpgBattleHost, RpgBattleView } from '../../game/rpg-battle-host'
import { ProofBattleHost, proofCheckpoint, proofEncounter } from './proof-host'
import { RpgBattleStage } from './RpgBattleScreen'

vi.mock('motion/react', async (original) => ({ ...await original<typeof import('motion/react')>(), useReducedMotion: () => true }))
afterEach(cleanup)
const mount = (host: RpgBattleHost, props: Partial<Parameters<typeof RpgBattleStage>[0]> = {}) => render(
  <LazyMotion features={domAnimation} strict><MemoryRouter><RpgBattleStage host={host} checkpointId="proof" uid="proof"
    content={null} proof names={{ 'ally-0': 'Ember', 'ally-1': 'Rill', 'ally-2': 'Beacon', 'ally-3': 'Dawn', 'ally-4': 'Volt' }} {...props} /></MemoryRouter></LazyMotion>,
)
const ready = () => screen.findByRole('button', { name: 'Confirm attack' })

describe('mobile RPG battle screen', () => {
  it('uses the paged guide, traps focus, and restores focus after Escape', async () => {
    const host = new ProofBattleHost('practice', 'uma-rpg-screen-guide')
    await host.reset('proof')
    mount(host)
    await ready()
    const trigger = screen.getByRole('button', { name: 'Battle guide' })
    trigger.focus(); fireEvent.click(trigger)
    expect(await screen.findByRole('dialog', { name: 'Five outfits, one team' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('dialog', { name: 'Physical or magical' })).toBeTruthy()
    const last = screen.getByRole('button', { name: 'Next' })
    last.focus(); fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close the guide' }))
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(trigger)
    cleanup(); host.close()
  })
  it('names five readable actors/overlays and previews engine effects before confirming once', async () => {
    const host = new ProofBattleHost('practice', 'uma-rpg-screen-preview')
    await host.reset('proof')
    const submit = vi.spyOn(host, 'submitAction')
    mount(host)
    await ready()
    expect(screen.getByRole('button', { name: /Ember, Greatsword, Fire, HP/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Volt, Magic tome, Lightning, HP/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Skill' }))
    fireEvent.click(await screen.findByRole('button', { name: /Fire · Foundation/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Review projected action effect' }))
    expect(await screen.findByRole('dialog', { name: 'Projected action effect' })).toBeTruthy()
    expect(screen.getByText(/elemental rider/)).toBeTruthy()
    expect(screen.getByText(/Weakness · Enemy/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm skill' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm skill' }))
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('action 1'))
    expect((await host.resume('proof')).actionCount).toBe(1)
    cleanup(); host.close()
  })
  it('pointer cancellation does not submit and leaving/reloading restores the saved turn', async () => {
    const host = new ProofBattleHost('practice', 'uma-rpg-screen-resume')
    await host.reset('proof')
    const submit = vi.spyOn(host, 'submitAction')
    const first = mount(host)
    const confirm = await ready()
    fireEvent.pointerDown(confirm); fireEvent.pointerCancel(confirm)
    expect(submit).not.toHaveBeenCalled()
    fireEvent.click(confirm)
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('action 1'))
    const saved = await host.resume('proof')
    first.unmount()
    mount(host)
    await ready()
    expect(await host.resume('proof')).toEqual(saved)
    expect(screen.getByRole('status').textContent).toContain('action 1')
    cleanup(); host.close()
  })
  it('shows Pending rewards as not earned and only enables free retry after accepted loss', async () => {
    const host = new ProofBattleHost('loss', 'uma-rpg-screen-loss')
    await host.reset('proof')
    let view = await host.resume('proof')
    while (view.state?.outcome === 'active') {
      const state = view.state
      const actor = state.input.allies.find((ally) => state.units.some((unit) => unit.id === ally.id && unit.hp > 0) && !state.acted.includes(ally.id))!
      view = await host.submitAction('proof', view.actionCount, { kind: 'attack', actorId: actor.id, targetId: 'proof-captain' })
    }
    mount(host)
    expect(await screen.findByRole('heading', { name: 'Party defeated' })).toBeTruthy()
    expect(screen.getByText('Projected result · not yet earned')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Retry free/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Submit result / try sync' }))
    fireEvent.click(await screen.findByRole('button', { name: /Retry free/ }))
    await ready()
    expect((await host.resume('proof')).actionCount).toBe(0)
    cleanup(); host.close()
  })
  it.each(['conflict', 'frozen-content-unavailable', 'takeover-required', 'restart-journal'] as const)('makes %s recovery explicit and disables combat', async (kind) => {
    const state = createEncounter(proofEncounter('boss')).state
    const base = { checkpoint: proofCheckpoint, state, actionCount: 0, cues: [], lastAction: null, cueState: null, evidence: null }
    const view = (kind === 'conflict' || kind === 'frozen-content-unavailable'
      ? { ...base, kind, reason: 'synthetic reason' }
      : { ...base, kind: 'open', recovery: kind }) as RpgBattleView
    const host = { resume: vi.fn(async () => view) } as unknown as RpgBattleHost
    mount(host)
    expect(await screen.findByRole('link', { name: 'Return to RPG checkpoint' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Confirm attack' })).toBeNull()
    if (kind === 'takeover-required') {
      fireEvent.click(screen.getByRole('button', { name: 'Review takeover' }))
      expect(await screen.findByRole('dialog', { name: 'Take over this battle?' })).toBeTruthy()
      expect(screen.getByText(/former device stale/)).toBeTruthy()
    }
  })
})
