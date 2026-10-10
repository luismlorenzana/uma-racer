// Startup-safe selector contract and local edit lock (Farm implementation §8).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { farmRaceLocked, farmStatKey, farmStatsFor, LEGACY_FARM_STATS, lockFarmRace } from './farm-stats'

describe('small canonical Farm stat bridge', () => {
  it('keeps its startup dependency on the domain type-only', () => {
    const source = readFileSync('src/game/farm-stats.ts', 'utf8')
    expect(source).not.toMatch(/^import (?!type\b)/m)
    expect(source).not.toContain('import(')
    // Extra's production screen must not import the DEV witness's race engine either.
    expect(readFileSync('src/screens/farm/FarmExtraStatsScreen.tsx', 'utf8')).not.toContain('../../game/racing')
  })
  it('selects a canonical build or an independent zero vector, never silently legacy on recovery', () => {
    const vector = { speed: 20, stamina: 0, power: 0, guts: 0, wit: 0 }
    const state = { mode: 'active' as const, generation: 'invented', vectors: { [farmStatKey('invented', 1, 'long')]: vector } }
    expect(farmStatsFor(LEGACY_FARM_STATS, 'invented', 1, 'long')).toBeUndefined()
    expect(farmStatsFor(state, 'invented', 1, 'long')).toEqual(vector)
    expect(farmStatsFor(state, 'invented', 1, 'sprint')?.speed).toBe(0)
    expect(farmStatsFor(state, 'invented', 6, 'long')?.speed).toBe(0)
    expect(() => farmStatsFor({ mode: 'recovery', error: 'Keep this save' }, 'invented', 1, 'long')).toThrow('Keep this save')
  })
  it('does not expose mutable store/default vectors', () => {
    const state = { mode: 'active' as const, generation: 'invented', vectors: {} }
    const result = farmStatsFor(state, 'invented', 1, 'long')!
    result.speed = 999
    expect(farmStatsFor(state, 'invented', 1, 'long')?.speed).toBe(0)
  })
  it('reference-counts race locks and tolerates repeat cleanup without unlocking another race', () => {
    const first = lockFarmRace('invented-lock', 1), second = lockFarmRace('invented-lock', 1)
    expect(farmRaceLocked('invented-lock', 1)).toBe(true)
    expect(farmRaceLocked('invented-lock', 2)).toBe(false)
    first(); first()
    expect(farmRaceLocked('invented-lock', 1)).toBe(true)
    second()
    expect(farmRaceLocked('invented-lock', 1)).toBe(false)
  })
})
