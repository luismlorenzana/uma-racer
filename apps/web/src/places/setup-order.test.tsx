// @vitest-environment jsdom
// A03's real routes over invented in-memory accounts: level-first sessions/lineage, context sorts one tap away,
// unavailable Umas last with their reasons, and Racing's optional Open goals filter (never a race restriction).
import { layerUnlocks } from '@racer/domain/training'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderG2, stubStorage } from '../__fixtures__/testing'
import { createMemoryGame } from '../dev/memory'
import { apply, farmAccount, farmSeed, uma } from './farm/__fixtures__/farm'
import { withCommitted } from './training/__fixtures__/training'

beforeEach(stubStorage)
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function account() {
  const { state, env, at } = farmAccount(5)
  const names = ['Low', 'Zulu', 'Alpha', 'Busy', 'Beta']
  const releases = ['2030-01-01', '2020-01-01', '2010-01-01', '2040-01-01', '2020-01-01']
  const umas = new Map([...env.content.umas].map(([id, template]) => {
    const i = [1, 2, 3, 4, 5].map(uma).indexOf(id)
    return [id, i < 0 ? template : {
      ...template, name: names[i]!, jpRelease: releases[i]!,
      // Another outfit of the child: she cannot fill the child's parent slot.
      ...(i === 3 ? { charaId: env.content.umas.get(uma(1))!.charaId } : {}),
    }]
  }))
  const content = { ...env.content, umas }
  let edited = { ...state, umas: Object.fromEntries(Object.values(state.umas).map((one, i) => [one.outfitId, {
    ...one, racing: { level: [2, 8, 8, 9, 8][i]!, exp: 0 },
  }])) }
  edited = withCommitted(edited, uma(2), layerUnlocks(1).filter(one => one.kind === 'node').slice(0, 2))
  edited = withCommitted(edited, uma(3), layerUnlocks(1).filter(one => one.kind === 'node').slice(0, 4))
  edited = withCommitted(edited, uma(1), layerUnlocks(1).filter(one => one.kind === 'slot'))
  const working = apply(edited, 'start', {
    outfitId: uma(4), slot: { building: 'fields', slot: 0 }, request: { kind: 'gather', item: 'wheat', count: 1 },
  }, at).state
  return farmSeed(working, at, { env: { ...env, content } })
}

const pickerTiles = () => [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button[aria-label]')]
  .filter(button => /^(Low|Zulu|Alpha|Busy|Beta)(\.|$)/.test(button.getAttribute('aria-label') ?? ''))
const pickerNames = () => pickerTiles().map(button => button.getAttribute('aria-label')!.split('.')[0])
const selectedRaceUma = () => document.querySelector('[data-g2="race-uma-control"]')?.getAttribute('data-uma')
async function racingOrder() {
  fireEvent.click(await screen.findByRole('button', { name: 'Who races' }))
  const dialog = await screen.findByRole('dialog', { name: 'Who races' })
  const names = pickerNames()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Who races' })).toBeNull())
  return names
}

describe('level-first setup (A03)', () => {
  it('opens work on Free first and Farm Level, keeps busy reasons and Recall options; Left here stays available', async () => {
    const game = createMemoryGame(account(), () => 0)
    renderG2('/training/observatory?session=', game)
    await screen.findByRole('dialog', { name: 'Who trains at the Observatory?' })
    await screen.findByRole('button', { name: 'Sort: Farm Level' })
    expect(pickerNames()).toEqual(['Beta', 'Zulu', 'Alpha', 'Low', 'Busy'])
    expect(pickerTiles().at(-1)!.textContent).toMatch(/Busy.*left/)
    expect(pickerTiles().at(-1)!.textContent).toContain('Options')
    fireEvent.click(screen.getByRole('button', { name: 'Sort: Farm Level' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Left here' }))
    await screen.findByRole('button', { name: 'Sort: Left here' })
    expect(pickerNames()[0]).toBe('Low')
    expect(pickerNames().at(-1)).toBe('Busy')
    // Actionable busy Umas can be chosen for Recall, but this still hasn't recalled or spent anything.
    expect(Object.keys(game.getSnapshot().receipts)).toHaveLength(0)
  })

  it('opens a lineage slot on level, not Adds, retaining the reason on an unavailable high-level outfit', async () => {
    const game = createMemoryGame(account(), () => 0)
    renderG2(`/training/lineage-hall/${uma(1)}`, game)
    fireEvent.click(await screen.findByRole('button', { name: 'Fill slot A' }))
    await screen.findByRole('dialog', { name: 'Who sits in A?' })
    await screen.findByRole('button', { name: 'Sort: Level' })
    expect(pickerNames()).toEqual(['Beta', 'Zulu', 'Alpha', 'Busy'])
    expect(pickerTiles().at(-1)!.disabled).toBe(true)
    expect(pickerTiles().at(-1)!.getAttribute('aria-label')).toContain("can't sit there: that's her")
    fireEvent.click(screen.getByRole('button', { name: 'Sort: Level' }))
    fireEvent.click(await screen.findByRole('button', { name: 'What she adds' }))
    await screen.findByRole('button', { name: 'Sort: What she adds' })
    expect(Object.keys(game.getSnapshot().receipts)).toHaveLength(0)
  })

  it('Racing keeps a complete high-level career first, with Open goals an explicit reversible filter', async () => {
    const source = account(), done = source.state.umas[uma(4)]!
    const state = { ...source.state, umas: { ...source.state.umas, [done.outfitId]: {
      ...done, career: { ...done.career, goals: done.career.goals.map(goal => ({ ...goal, status: 'completed' as const })) },
    } } }
    const game = createMemoryGame({ ...source, state }, () => 0)
    const { where } = renderG2(`/racing/racecourse?uma=${uma(4)}&race=sim-g1-mile-a`, game)
    const chip = await screen.findByRole('button', { name: 'Open goals' })
    expect(chip.getAttribute('aria-pressed')).toBe('false')
    expect(selectedRaceUma()).toBe(uma(4))
    expect(await racingOrder()).toEqual(['Busy', 'Beta', 'Zulu', 'Alpha', 'Low'])
    fireEvent.click(chip)
    await waitFor(() => expect(where()).toContain('goals=open'))
    expect(where()).not.toContain('race=')
    expect(selectedRaceUma()).toBe(uma(5))
    expect(await racingOrder()).toEqual(['Beta', 'Zulu', 'Alpha', 'Low'])
    const restore = where()
    cleanup(); const resumed = renderG2(restore, game)
    const reopened = await screen.findByRole('button', { name: 'Open goals' })
    expect(reopened.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(reopened)
    expect(await racingOrder()).toHaveLength(5)
    expect(resumed.where()).not.toContain('goals=')
    expect(Object.keys(game.getSnapshot().receipts)).toHaveLength(0)
  })

  it('keeps an explicit lower-level race target, and gives an empty Open goals filter its way out', async () => {
    const source = account()
    const game = createMemoryGame(source, () => 0)
    renderG2(`/racing/racecourse?uma=${uma(1)}`, game)
    await screen.findByRole('button', { name: 'Who races' })
    expect(selectedRaceUma()).toBe(uma(1))
    cleanup()
    const complete = { ...source.state, umas: Object.fromEntries(Object.values(source.state.umas).map(one => [one.outfitId, {
      ...one, career: { ...one.career, goals: one.career.goals.map(goal => ({ ...goal, status: 'completed' as const })) },
    }])) }
    renderG2('/racing/racecourse?goals=open', createMemoryGame({ ...source, state: complete }, () => 0))
    await screen.findByText('Every career is complete. Turn off Open goals to race with any Uma.')
    expect(screen.queryByText('No Uma races yet. Unlock one at the Stable.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open goals' }))
    expect(await screen.findByRole('button', { name: 'Who races' })).toBeTruthy()
    expect(await racingOrder()).toHaveLength(5)
  })
})
