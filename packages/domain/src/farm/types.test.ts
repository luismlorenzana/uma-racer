import { describe, expect, it } from 'vitest'
import { MAX_FARM_WORKERS } from './constants'
import { createInitialFarmState } from './rules'
import { reconcileFarmEvidence } from './reconciliation'
import {
  TRAINING_LEVEL_UP_TICKET_ID,
  parseFarmCropDefinition,
  parseFarmHarvestMovement,
  parseFarmState,
  parseItemLedgerEntry,
  type FarmPlot,
  type FarmState,
} from './types'

const HOURS_12 = 12 * 60 * 60 * 1_000
const MINUTE = 60_000

const growingState = (): FarmState => ({
  ...createInitialFarmState(),
  plots: [{
    id: 'plot-1',
    templateId: 'outfit-a',
    lastCropId: 'produce:t1:speed',
    attempt: 2,
    cycle: { id: 'farm:plot-1:2', cropId: 'produce:t1:stamina', plantedAt: 1_000, readyAt: 1_000 + HOURS_12 },
  }],
  workers: { 'outfit-a': { level: 5, exp: 6 } },
})

const withPlot = (state: FarmState, plot: FarmPlot): unknown => ({ ...state, plots: [...state.plots, plot] })
const firstPlot = (state: FarmState, change: (plot: FarmPlot) => unknown): unknown =>
  ({ ...state, plots: [change(state.plots[0]!)] })

describe('Farm parsers', () => {
  it('round trips initial and growing states into independent canonical values', () => {
    const initial = createInitialFarmState()
    expect(initial.plots).toEqual([])
    expect(parseFarmState(initial)).toEqual(initial)
    const growing = growingState()
    const parsed = parseFarmState(growing)
    expect(parsed).toEqual(growing)
    expect(parsed).not.toBe(growing)
    expect(parsed?.plots).not.toBe(growing.plots)
  })

  it('stores plots sparsely, in order, once each, and never an empty never-planted plot (D234)', () => {
    const state = growingState()
    const idle: FarmPlot = { id: 'plot-2', templateId: 'outfit-b', lastCropId: null, attempt: 0, cycle: null }
    expect(parseFarmState(withPlot(state, idle))).not.toBeNull()
    expect(parseFarmState(withPlot(state, { ...idle, templateId: null, attempt: 3 }))).not.toBeNull()
    expect(parseFarmState(withPlot(state, { ...idle, templateId: null }))).toBeNull()
    expect(parseFarmState({ ...state, plots: [idle, state.plots[0]] })).toBeNull()
    expect(parseFarmState({ ...state, plots: [...state.plots, state.plots[0]] })).toBeNull()
    expect(parseFarmState(withPlot(state, { ...idle, templateId: 'outfit-a' }))).toBeNull()
    // Farm Level 5 opens plots 1–2; plot 3 needs 11, so nothing may be stored there yet.
    expect(parseFarmState(withPlot(state, { ...idle, id: 'plot-3' }))).toBeNull()
    expect(parseFarmState(withPlot(state, { ...idle, id: 'plot-19' as FarmPlot['id'] }))).toBeNull()
  })

  it('rejects unknown keys, unsafe ids, timestamps, counters, growth times, and progress', () => {
    const state = growingState()
    expect(parseFarmState({ ...state, surprise: true })).toBeNull()
    expect(parseFarmState({ ...state, schemaVersion: 1 })).toBeNull()
    expect(parseFarmState(firstPlot(state, (plot) => ({ ...plot, templateId: 'unsafe/id' })))).toBeNull()
    expect(parseFarmState(firstPlot(state, (plot) => ({ ...plot, cycle: { ...plot.cycle!, plantedAt: 1.5 } })))).toBeNull()
    expect(parseFarmState(firstPlot(state, (plot) => ({ ...plot, attempt: -1 })))).toBeNull()
    expect(parseFarmState(firstPlot(state, (plot) => ({ ...plot, cycle: { ...plot.cycle!, readyAt: plot.cycle!.readyAt + 1 } })))).toBeNull()
    // Any time on the 10h → 7h 30m ladder, or D234's 12h → 8h, is valid; anything off both is not.
    const lasting = (minutes: number) => parseFarmState(firstPlot(state, (plot) => ({
      ...plot, cycle: { ...plot.cycle!, readyAt: plot.cycle!.plantedAt + minutes * MINUTE },
    })))
    expect([600, 525, 450, 720, 480].map((minutes) => lasting(minutes) !== null)).toEqual([true, true, true, true, true])
    expect([435, 456, 610, 744].map((minutes) => lasting(minutes))).toEqual([null, null, null, null])
    expect(parseFarmState({ ...state, workers: { 'outfit-a': { level: 5, exp: 24 } } })).toBeNull()
    expect(parseFarmState({ ...state, workers: { 'outfit-a': { level: 50_000, exp: 23 } } })).not.toBeNull()
    expect(parseFarmState({ ...state, workers: { 'outfit-a': { level: 100_000, exp: 0 } } })).toBeNull()
    expect(parseFarmState({ ...state, workers: Object.fromEntries(Array.from(
      { length: MAX_FARM_WORKERS + 1 }, (_, index) => [`worker-${index}`, { level: 1, exp: 0 }],
    )) })).toBeNull()
  })

  it('parses exact crop and harvest movement shapes only', () => {
    const crop = {
      id: 'produce:t1:speed', name: 'Synthetic Root', stat: 'speed', scenarioTier: 1, outfitLevelRequired: 1, yield: 1, farmingExp: 12,
    }
    expect(parseFarmCropDefinition(crop)).toEqual(crop)
    expect(parseFarmCropDefinition({ ...crop, id: 'produce:t2:speed' })).toBeNull()
    expect(parseFarmCropDefinition({ ...crop, outfitLevelRequired: 2 })).toBeNull()
    expect(parseFarmCropDefinition({ ...crop, extra: true })).toBeNull()
    const movement = {
      id: 'farm:plot-9:2', itemId: 'produce:t1:speed', delta: 1, reason: 'farm-harvest', createdAt: 20,
      source: { kind: 'farm-harvest', plotId: 'plot-9', cycleId: 'farm:plot-9:2', templateId: 'outfit-a', farmingExp: 12 },
    }
    expect(parseFarmHarvestMovement(movement)).toEqual(movement)
    expect(parseFarmHarvestMovement({ ...movement, delta: 2 })).toBeNull()
    expect(parseFarmHarvestMovement({ ...movement, source: { ...movement.source, plotId: 'plot-0' } })).toBeNull()
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
