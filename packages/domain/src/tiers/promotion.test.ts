// Promotion (docs/game/04-tiers-and-promotion.md §3–§5): what it needs, what it resets, what it keeps, what it pays.
import { describe, expect, it } from 'vitest'
import { CONTENT, COLT, SPRINTER, placeUma } from '../__fixtures__/tiers'
import { closeScenarioJourney } from '../scenario-goals'
import type { DistanceCategory, Stats } from '../types'
import { emptyBuild, isRefusal, type ReworkState, type Tier, type UmaState } from '../state/types'
import { freezeCareer } from './career'
import { canStartExpedition, promote, promotionReadiness, promotionTicketLedgerId, type PromotionPresetStats } from './promotion'
import { newAccount, unlockUma } from './roster'

/** A wider state, as later tasks add their parts: promotion must carry it untouched. */
type Account = ReworkState & { readonly warehouse: { readonly items: Readonly<Record<string, number>> } }

function account(): Account {
  let state: ReworkState = newAccount(0)
  for (const outfitId of [COLT.id, SPRINTER.id]) {
    const result = unlockUma(state, { outfitId }, 1, { content: CONTENT })
    if (isRefusal(result)) throw new Error(result.reason)
    state = result.state
  }
  return { ...state, profile: { ...state.profile, prizeMoney: 1234, umaShards: 3 }, warehouse: { items: { 'fruits-1': 6 } } }
}

const RUN = { expeditionId: 'europe', races: 11, wins: 8, completed: true }
/** Colt at her tier's last gate, career won, a full build in brief, and a completed run. */
function ready(tier: Tier = 1): Account {
  const state = account()
  const placed = placeUma(state.umas[COLT.id]!, { tier, scenario: tier === 3 ? 4 : 5, level: tier === 3 ? 40 : 50, careerWon: true })
  const presets = Object.fromEntries(Object.entries(placed.build.presets).map(([distance, preset]) =>
    [distance, { ...preset, cardSetIds: [`card-${distance}-1`, `card-${distance}-2`], lineage: { parent0: SPRINTER.id } }]))
  const colt: UmaState = {
    ...placed,
    farm: { level: 31, exp: 220 },
    build: { ...placed.build, constellationOpened: 28, bonds: ['card-a', 'card-b'], extraNodes: ['speed-01'], presets: presets as unknown as UmaState['build']['presets'] },
    expedition: { runs: [{ expeditionId: 'america', races: 5, wins: 3, completed: false }, RUN] },
    raceDefaults: { preferences: { strategy: 'pace', distance: 'long', surface: 'turf' }, selectedPreset: 'long' },
  }
  return { ...state, umas: { ...state.umas, [COLT.id]: colt } }
}

const statsOf = (n: number): Stats => ({ speed: n, stamina: n + 1, power: n + 2, guts: n + 3, wit: n + 4 })
const PRESETS: PromotionPresetStats = { sprint: { stats: statsOf(700), skillPoints: 2100 }, mile: { stats: statsOf(710), skillPoints: 2200 },
  medium: { stats: statsOf(720), skillPoints: 2300 }, long: { stats: statsOf(730), skillPoints: 2400 } }

describe('promotionReadiness', () => {
  it('needs a completed run, no work row, and tier 1 or 2', () => {
    const state = ready()
    expect(promotionReadiness(state, COLT.id)).toMatchObject({ ready: true })
    const noRun = { ...state, umas: { ...state.umas, [COLT.id]: { ...state.umas[COLT.id]!, expedition: { runs: [{ ...RUN, completed: false, wins: 7 }] } } } }
    expect(promotionReadiness(noRun, COLT.id)).toMatchObject({ refused: true, code: 'no-expedition' })
    expect(promotionReadiness({ ...state, work: { [COLT.id]: { kind: 'session' } } }, COLT.id)).toEqual({
      refused: true, code: 'busy', reason: '{uma} is still working.', data: { uma: COLT.id },
    })
    expect(promotionReadiness(ready(3), COLT.id)).toMatchObject({ refused: true, code: 'use-hall-of-fame' })
    expect(promotionReadiness(state, 'nobody')).toMatchObject({ refused: true, code: 'unknown-uma' })
  })
})

describe('promote', () => {
  it("resets exactly 04 §4's left column and keeps the middle", () => {
    const state = ready()
    const before = state.umas[COLT.id]!
    const result = promote(state, { umaId: COLT.id, presets: PRESETS }, 5000, { content: CONTENT })
    if (isRefusal(result)) throw new Error(result.reason)
    const after = result.state.umas[COLT.id]!
    // Left column: back to the start of the next tier.
    expect(after).toMatchObject({ tier: 2, scenario: 1, racing: { level: 1, exp: 0 }, farm: { level: 1, exp: 0 }, expedition: { runs: [] } })
    expect(after.build).toEqual(emptyBuild('unique-colt'))
    expect(after.career).toEqual(freezeCareer(after, 6, CONTENT))
    expect(after.career).toMatchObject({ tier: 6, state: 'active' })
    // Middle column: records, history and race defaults stay hers.
    expect(after.outfitId).toBe(COLT.id)
    expect(after.raceDefaults).toBe(before.raceDefaults)
    expect(after.closedCareers).toEqual([...before.closedCareers, closeScenarioJourney(before.career, 5000)])
    expect(after.tierHistory).toHaveLength(1)
    expect(after.hallOfFame).toBeNull()
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort())
  })

  it('carries every other part of the state untouched', () => {
    const state = ready()
    const result = promote(state, { umaId: COLT.id, presets: PRESETS }, 5000, { content: CONTENT })
    if (isRefusal(result)) throw new Error(result.reason)
    expect(result.state.warehouse).toBe(state.warehouse)
    expect(result.state.work).toBe(state.work)
    expect(result.state.umas[SPRINTER.id]).toBe(state.umas[SPRINTER.id])
    expect(result.state.profile).toEqual({ ...state.profile, umaTickets: state.profile.umaTickets + 1 })
    expect(result.state.ledger.slice(0, -1)).toEqual(state.ledger)
  })

  it("writes the caller's stats, her card sets, bonds and every run into her history", () => {
    const state = ready()
    const result = promote(state, { umaId: COLT.id, presets: PRESETS }, 5000, { content: CONTENT })
    if (isRefusal(result)) throw new Error(result.reason)
    const entry = result.state.umas[COLT.id]!.tierHistory[0]!
    expect(entry).toEqual({
      tier: 1, promotedAt: 5000, finalRacingLevel: 50, bonds: ['card-a', 'card-b'],
      runs: [{ expeditionId: 'america', races: 5, wins: 3, completed: false }, RUN],
      presets: Object.fromEntries((['sprint', 'mile', 'medium', 'long'] as DistanceCategory[]).map((distance) =>
        [distance, { ...PRESETS[distance], cardSetIds: [`card-${distance}-1`, `card-${distance}-2`] }])),
    })
    expect(result.receipt).toMatchObject({ umaId: COLT.id, from: 1, to: 2, ticketsPaid: 1, awards: ['promoted-tier-2'], history: entry })
    expect(() => promote(state, { umaId: COLT.id, presets: { ...PRESETS, long: undefined } as never }, 1, { content: CONTENT })).toThrow(RangeError)
  })

  it("pays one ticket under its id, once, and names tier 3's award from tier 2", () => {
    const state = ready()
    const paid = promote(state, { umaId: COLT.id, presets: PRESETS }, 5000, { content: CONTENT })
    if (isRefusal(paid)) throw new Error(paid.reason)
    expect(paid.state.ledger.at(-1)).toEqual({ id: 'promotion-uma-ticket:colt:1', resource: 'uma-tickets', delta: 1, reason: 'promotion-uma-ticket', at: 5000 })
    const alreadyPaid = { ...state, ledger: [...state.ledger, { id: promotionTicketLedgerId(COLT.id, 1), resource: 'uma-tickets' as const, delta: 1, reason: 'promotion-uma-ticket' as const, at: 1 }] }
    const second = promote(alreadyPaid, { umaId: COLT.id, presets: PRESETS }, 5000, { content: CONTENT })
    if (isRefusal(second)) throw new Error(second.reason)
    expect(second.receipt.ticketsPaid).toBe(0)
    expect(second.state.profile.umaTickets).toBe(alreadyPaid.profile.umaTickets)
    expect(second.state.ledger).toBe(alreadyPaid.ledger)
    const fromTwo = promote(ready(2), { umaId: COLT.id, presets: PRESETS }, 1, { content: CONTENT })
    if (isRefusal(fromTwo)) throw new Error(fromTwo.reason)
    expect(fromTwo.receipt).toMatchObject({ from: 2, to: 3, awards: ['promoted-tier-3'] })
    expect(fromTwo.state.umas[COLT.id]!.career.tier).toBe(11)
    expect(fromTwo.state.ledger.at(-1)!.id).toBe('promotion-uma-ticket:colt:2')
  })

  it('refuses without a completed run, with a work row, and in tier 3', () => {
    const state = ready()
    expect(promote({ ...state, work: { [COLT.id]: {} } }, { umaId: COLT.id, presets: PRESETS }, 1, { content: CONTENT })).toMatchObject({ code: 'busy' })
    expect(promote(ready(3), { umaId: COLT.id, presets: PRESETS }, 1, { content: CONTENT })).toMatchObject({ code: 'use-hall-of-fame' })
    expect(promote(account(), { umaId: COLT.id, presets: PRESETS }, 1, { content: CONTENT })).toMatchObject({ code: 'no-expedition' })
  })
})

describe('canStartExpedition', () => {
  it("needs the tier's last scenario, its last gate and a complete career", () => {
    const uma = (where: Parameters<typeof placeUma>[1]) => placeUma(account().umas[COLT.id]!, where)
    expect(canStartExpedition(uma({ tier: 1, scenario: 5, level: 50, careerWon: true }))).toBe(true)
    expect(canStartExpedition(uma({ tier: 1, scenario: 5, level: 49, careerWon: true }))).toBe(false)
    expect(canStartExpedition(uma({ tier: 1, scenario: 5, level: 50 }))).toBe(false)
    expect(canStartExpedition(uma({ tier: 1, scenario: 4, level: 40, careerWon: true }))).toBe(false)
    expect(canStartExpedition(uma({ tier: 3, scenario: 4, level: 40, careerWon: true }))).toBe(true)
  })
})
