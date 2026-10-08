// @vitest-environment jsdom
import { createScenarioTraining, createUmaSave, scenarioAt, scenarioView, INSPIRATION_SLOTS, inspirationGoldKey, type UmaSave, type UmaTemplate } from '@racer/domain'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGame } from '../game/store'
import { PresetLoadButton } from './PresetLoadButton'

const loadPresetPage = vi.hoisted(() => vi.fn(async () => ({ skipped: 1 })))
vi.mock('../game/actions', () => ({ loadPresetPage }))

afterEach(cleanup)

// An invented Uma at Unity Cup whose URA Finale Medium preset has a card set, a parent and a skill.
const template = { id: 'invented', charaId: 'chara-invented', name: 'Invented', outfit: null, jpRelease: '2021-01-01', globalRelease: null,
  starter: true, baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'C', mile: 'A', medium: 'A', long: 'B' },
    strategy: { front: 'A', pace: 'B', late: 'C', end: 'D' } },
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [], imageSource: 'https://invalid.test/uma.png' } satisfies UmaTemplate
function save(trainingLevel: number): UmaSave {
  const inspiration = { slots: [...INSPIRATION_SLOTS], golds: INSPIRATION_SLOTS.flatMap((slot) => [inspirationGoldKey(slot, 0), inspirationGoldKey(slot, 1)]) }
  const ura = createScenarioTraining(1)
  const unity = createScenarioTraining(2)
  const build = { cardSetIds: ['card-a'], assignments: { parent0: { kind: 'lineage' as const, templateId: 'other' } }, activeExtraStats: [], loadoutSkillIds: ['w1'] }
  return { ...createUmaSave(template), activePreset: 'medium', unlockedTier: 2,
    scenarios: [{ ...ura, presets: { ...ura.presets, medium: build } }, { ...unity, trainingLevel, inspiration }] }
}

describe('preset page load button (D288)', () => {
  it('stays hidden until this page has nothing left to unlock', () => {
    const uma = save(7)
    render(<PresetLoadButton save={uma} run={scenarioAt(uma, 2)!} page="constellation" />)
    expect(screen.queryByRole('button')).toBeNull()
    cleanup()
    render(<PresetLoadButton save={uma} run={scenarioAt(uma, 2)!} page="inspiration" />)
    expect(screen.getByRole('button', { name: 'Load lineage from URA Finale' })).toBeTruthy()
  })

  it('confirms, then loads this preset from the scenario before and says what it skipped', async () => {
    const uma = save(10)
    const run = scenarioView(uma.scenarios[1]!, 'medium')
    render(<PresetLoadButton save={uma} run={run} page="skills" />)
    fireEvent.click(screen.getByRole('button', { name: 'Load skills from URA Finale' }))
    expect(screen.getByText("Load URA Finale's skills?")).toBeTruthy()
    expect(loadPresetPage).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Load from URA Finale' }))
    await waitFor(() => expect(loadPresetPage).toHaveBeenCalledWith('invented', 'skills', 2, 'medium'))
    await waitFor(() => expect(useGame.getState().toasts.at(-1)?.text).toBe('Loaded URA Finale · Medium skills · 1 skill skipped'))
  })
})
