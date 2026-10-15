// The device's operation env (T136): T134's `buildOperationEnv` from today's four packs, cached per content version,
// with `dev` only in dev builds (M034).
import { SIM_CARDS, SIM_RACES, SIM_UMAS } from '@racer/domain/sim'
import { describe, expect, it } from 'vitest'
import { operationEnv, type OperationContent } from './env'

const registry = <T extends { readonly id: string }>(items: readonly T[]) => ({ items, byId: new Map(items.map((item) => [item.id, item])) })

function content(version: string): OperationContent {
  return {
    manifest: { version } as OperationContent['manifest'],
    umas: registry(SIM_UMAS),
    races: registry(SIM_RACES),
    cards: registry(SIM_CARDS),
    skills: registry([]),
  }
}

describe('operationEnv', () => {
  it("builds the operations' maps from the packs, once per content version", () => {
    const first = operationEnv(content('v1'), false)
    expect(first.content.umas.get(SIM_UMAS[0]!.id)).toBe(SIM_UMAS[0])
    expect(first.content.races).toEqual(SIM_RACES)
    expect(first.dev).toBeUndefined()
    expect(operationEnv(content('v1'), false)).toBe(first)
    expect(operationEnv(content('v2'), false)).not.toBe(first)
  })

  it('runs dev operations only in dev builds', () => {
    expect(operationEnv(content('v3'), true).dev).toBe(true)
    expect(operationEnv(content('v3'), false).dev).toBeUndefined()
  })
})
