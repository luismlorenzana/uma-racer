import { describe, expect, it } from 'vitest'
import { FARM_GROWTH_MS, FARM_PLOT_IDS, MAX_FARM_WORKERS } from './constants'
import { createInitialFarmState } from './rules'
import { reconcileFarmEvidence } from './reconciliation'
import {
  TRAINING_LEVEL_UP_TICKET_ID,
  parseFarmCropDefinition,
  parseFarmHarvestMovement,
  parseFarmState,
  parseItemLedgerEntry,
  type FarmState,
} from './types'

const growingState = (): FarmState => ({
  ...createInitialFarmState(),
  plots: FARM_PLOT_IDS.map((id, index) => index === 0 ? {
    id,
    templateId: 'outfit-a',
    lastCropId: 'produce:t1:speed',
    attempt: 2,
    cycle: {
      id: 'farm:plot-1:2',
      cropId: 'produce:t1:stamina',
      plantedAt: 1_000,
      readyAt: 1_000 + FARM_GROWTH_MS,
    },
  } : { id, templateId: null, lastCropId: null, attempt: 0, cycle: null }),
  workers: { 'outfit-a': { level: 2, exp: 12 } },
})

describe('Farm parsers', () => {
  it('round trips initial and growing states into independent canonical values', () => {
    const initial = createInitialFarmState()
    expect(parseFarmState(initial)).toEqual(initial)
    const growing = growingState()
    const parsed = parseFarmState(growing)
    expect(parsed).toEqual(growing)
    expect(parsed).not.toBe(growing)
    expect(parsed?.plots).not.toBe(growing.plots)
  })

  it('rejects unknown keys, bad plots, duplicate outfits, timestamps, counters, and progress', () => {
    const state = growingState()
    expect(parseFarmState({ ...state, surprise: true })).toBeNull()
    expect(parseFarmState({ ...state, plots: state.plots.slice(0, -1) })).toBeNull()
    expect(parseFarmState({ ...state, plots: [...state.plots, state.plots[0]] })).toBeNull()
    expect(parseFarmState({ ...state, plots: state.plots.map((plot, index) => index === 1
      ? { ...plot, templateId: 'outfit-a' }
      : plot) })).toBeNull()
    expect(parseFarmState({ ...state, plots: state.plots.map((plot, index) => index === 0
      ? { ...plot, templateId: 'unsafe/id' }
      : plot) })).toBeNull()
    expect(parseFarmState({ ...state, plots: state.plots.map((plot, index) => index === 0
      ? { ...plot, cycle: { ...plot.cycle!, plantedAt: 1.5 } }
      : plot) })).toBeNull()
    expect(parseFarmState({ ...state, plots: state.plots.map((plot, index) => index === 0
      ? { ...plot, attempt: -1 }
      : plot) })).toBeNull()
    expect(parseFarmState({ ...state, plots: state.plots.map((plot, index) => index === 0
      ? { ...plot, cycle: { ...plot.cycle!, plantedAt: -1, readyAt: FARM_GROWTH_MS - 1 } }
      : plot) })).toBeNull()
    expect(parseFarmState({ ...state, plots: state.plots.map((plot, index) => index === 0
      ? { ...plot, cycle: { ...plot.cycle!, readyAt: plot.cycle!.readyAt + 1 } }
      : plot) })).toBeNull()
    expect(parseFarmState({ ...state, workers: { 'outfit-a': { level: 21, exp: 0 } } })).toBeNull()
    expect(parseFarmState({ ...state, workers: { 'outfit-a': { level: 2, exp: 48 } } })).toBeNull()
    expect(parseFarmState({ ...state, workers: { 'outfit-a': { level: 20, exp: 0 } } })).not.toBeNull()
    expect(parseFarmState({ ...state, workers: { 'outfit-a': { level: 20, exp: 1 } } })).toBeNull()
    expect(parseFarmState({ ...state, workers: Object.fromEntries(Array.from(
      { length: MAX_FARM_WORKERS + 1 }, (_, index) => [`worker-${index}`, { level: 1, exp: 0 }],
    )) })).toBeNull()
  })

  it('parses exact crop and harvest movement shapes only', () => {
    const crop = {
      id: 'produce:t1:speed', name: 'Synthetic Root', stat: 'speed', scenarioTier: 1,
      outfitLevelRequired: 1, farmLevelRequired: 1, growthHours: 12, yield: 1, farmingExp: 12,
    }
    expect(parseFarmCropDefinition(crop)).toEqual(crop)
    expect(parseFarmCropDefinition({ ...crop, id: 'produce:t2:speed' })).toBeNull()
    expect(parseFarmCropDefinition({ ...crop, extra: true })).toBeNull()
    const movement = {
      id: 'farm:plot-1:2', itemId: 'produce:t1:speed', delta: 1, reason: 'farm-harvest', createdAt: 20,
      source: { kind: 'farm-harvest', plotId: 'plot-1', cycleId: 'farm:plot-1:2', templateId: 'outfit-a', farmingExp: 12 },
    }
    expect(parseFarmHarvestMovement(movement)).toEqual(movement)
    expect(parseFarmHarvestMovement({ ...movement, delta: 2 })).toBeNull()
  })

  it('parses Training Level-Up Ticket grants and spends, and counts them into the stack (D212, D213)', () => {
    const levelUp = { kind: 'level-up', umaId: 'u1', tier: 2, fromLevel: 9, fromExp: 800 }
    const grants = [
      { id: 'exp-bank:spark:u1:2:3', source: { kind: 'spark-run', runId: 'spark:u1:2:3' }, delta: 1 },
      { id: 'exp-bank:settle:40', source: { kind: 'bank-settle' }, delta: 49 },
      { id: 'exp-bank:level-up:u1:2:9.800', source: levelUp, delta: 1 },
    ].map((entry) => ({ ...entry, itemId: TRAINING_LEVEL_UP_TICKET_ID, reason: 'exp-bank', createdAt: 40 }))
    for (const grant of grants) expect(parseItemLedgerEntry(grant)).toEqual(grant)
    const spend = { id: 'level-up:u1:2:9.800', itemId: TRAINING_LEVEL_UP_TICKET_ID, delta: -1, reason: 'training-level-up', source: levelUp, createdAt: 50 }
    expect(parseItemLedgerEntry(spend)).toEqual(spend)

    expect(parseItemLedgerEntry({ ...grants[0], delta: 0 })).toBeNull()
    expect(parseItemLedgerEntry({ ...grants[0], itemId: 'produce:t1:speed' })).toBeNull()
    expect(parseItemLedgerEntry({ ...grants[1], source: { kind: 'bank-settle', extra: 1 } })).toBeNull()
    expect(parseItemLedgerEntry({ ...spend, delta: 1 })).toBeNull()
    expect(parseItemLedgerEntry({ ...spend, source: { ...levelUp, fromLevel: 10 } })).toBeNull()

    const reconciled = reconcileFarmEvidence(createInitialFarmState(), [], [...grants, spend] as never)
    expect(reconciled.stacks).toEqual([{ itemId: TRAINING_LEVEL_UP_TICKET_ID, quantity: 50, updatedAt: 50 }])
  })
})
