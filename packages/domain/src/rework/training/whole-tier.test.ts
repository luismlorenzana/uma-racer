// Cross-task acceptance #1 (docs/game/architecture.md#the-rework-modules): one synthetic Uma goes from tier 1, scenario 1 to
// promotion by operations only, against a synthetic Warehouse of exactly the 107 dishes the layers call for. Every
// unlock starts in its own scenario and a later layer's start is refused; each takes one dish of the right family and
// grade, so the Warehouse ends empty. Racing Level reaches 50 by winning her careers' races, the stand-in Expedition is
// completed as the tier rules' tests do (phase 9 owns its real rules), and promotion resets her build and bonds while
// the account's goods carry. Every session runs on T127's work engine: `start` reserves its dishes, `collect` pays.
import { describe, expect, it } from 'vitest'
import { COLT, RACES } from '../../__fixtures__/rework-tiers'
import { DECK, ENV, TIER_AND_TRAINING, TRAINING_CONTENT, slotAt, workAccount } from '../../__fixtures__/rework-training'
import { careerComplete } from '../../scenario-goals'
import type { ScenarioJourney } from '../../save'
import { recordExpeditionRace } from '../tiers/expedition'
import { gateLevel } from '../tiers/map'
import { promote } from '../tiers/promotion'
import { applyRaceFinish } from '../tiers/racing'
import { emptyBuild, isRefusal, type OpResult, type ReworkState, type ScenarioOfTier } from '../types'
import { advanceScenario, setCardSet } from './build'
import { promotionPresetStats, deriveUmaPreset } from './derive'
import { dojoRoomOf } from './bonds'
import { nextUnlocks, layerDone } from './order'
import { GYM_ROOMS, type FacilityId, type RoomId } from '../farm/buildings'
import { collect, start } from '../work/operations'
import type { WorkState } from '../work/types'
import { sessionRequest } from './sessions'
import { layerUnlocks, unlockLabel, type UnlockRef } from './unlocks'

/** 05 §3's layer tables and 06 §2's deck, written out from the pages: the dishes a tier of training takes. */
function warehouseOf107(): Record<string, number> {
  const dishes: Record<string, number> = {}
  const add = (id: string, n = 1) => { dishes[id] = (dishes[id] ?? 0) + n }
  // Observatory: 6 + 6 nodes at grades 1–2, then 2 + 2 a scenario.
  for (const [g, n] of [[1, 6], [2, 6], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2]] as const) add(`dish-vegetables-${g}`, n)
  // Lineage Hall: 2 + 2, 4 + 2, 2 + 2, 3 + 3, 2 + 2.
  for (const [g, n] of [[1, 2], [2, 2], [3, 4], [4, 2], [5, 2], [6, 2], [7, 3], [8, 3], [9, 2], [10, 2]] as const) add(`dish-mushrooms-${g}`, n)
  // Gym: a single per stat at 1, 3, 5, 7, 9; the four Duos at 3 and 5; the four Feasts.
  for (const family of ['sweets', 'fruits', 'fish', 'nuts-seeds', 'herbs-spices']) for (const g of [1, 3, 5, 7, 9]) add(`dish-${family}-${g}`)
  for (const pair of ['stamina-wit', 'wit-power', 'power-speed', 'speed-guts']) for (const g of [3, 5]) add(`duo-${pair}-${g}`)
  for (const g of [4, 6, 8, 10]) add(`feast-${g}`)
  // Dojo: the deck's 18 bonds, each card of its scenario's era, so grade 2s − 1.
  for (const family of ['sweets', 'fruits', 'fish', 'nuts-seeds', 'herbs-spices', 'grains']) add(`dish-${family}-1`)
  for (const g of [3, 7]) for (const family of ['sweets', 'fruits', 'fish']) add(`dish-${family}-${g}`)
  for (const g of [5, 9]) for (const family of ['nuts-seeds', 'herbs-spices', 'grains']) add(`dish-${family}-${g}`)
  return dishes
}

function ok<R, S extends ReworkState>(result: OpResult<R, S>): { state: S; receipt: R } {
  if (isRefusal(result)) throw new Error(`${result.code}: ${result.reason} ${JSON.stringify(result.data)}`)
  return result
}

/** Her next race: the first open goal's race, or its set's first open leg; any G1 once her career is won. */
function nextGoalRace(career: ScenarioJourney): string | null {
  for (const goal of career.goals) {
    if (goal.status !== 'active') continue
    if (goal.series) return goal.series.legs.find((leg) => leg.status === 'active')?.raceId ?? null
    return goal.raceId
  }
  return null
}

describe('a whole tier, unlocked by the rules (M033 cross-task acceptance #1)', () => {
  it('takes 107 unlocks with exactly 107 dishes, each layer in its own scenario, to Racing Level 50 and promotion', () => {
    const dishes = warehouseOf107()
    expect(Object.values(dishes).reduce((sum, n) => sum + n, 0)).toBe(107)
    let state: WorkState = workAccount([COLT.id], { ...dishes, 'speed-ticket': 3 })
    state = { ...state, profile: { ...state.profile, prizeMoney: 4321 } }
    const profileBefore = state.profile
    let now = 10_000
    let unlocked = 0
    const uma = () => state.umas[COLT.id]!

    const begin = (facility: FacilityId, room: RoomId | null, unlocks: readonly UnlockRef[]) =>
      start(state, { outfitId: COLT.id, slot: slotAt(facility, room ?? undefined), request: sessionRequest(unlocks) }, now, ENV)
    const session = (facility: FacilityId, room: RoomId | null, unlocks: readonly UnlockRef[]) => {
      const started = ok(begin(facility, room, unlocks))
      const collected = collect(started.state, { outfitId: COLT.id }, started.receipt.endsAt, ENV)
      expect(collected.receipt.outputs.map((output) => 'unlock' in output && output.unlock.target)).toEqual(unlocks.map((entry) => entry.target))
      expect(collected.receipt.freed).toBe(true)
      state = collected.state
      unlocked += unlocks.length
      now = started.receipt.endsAt + 1
    }
    const drain = (facility: FacilityId, room: RoomId | null) => {
      for (let guard = 0; guard < 10; guard += 1) {
        const next = nextUnlocks(uma().build, uma(), facility, room, 10)
        if (next.length === 0) return
        session(facility, room, next)
      }
      throw new Error(`${facility} never ran dry`)
    }
    const raceToGate = () => {
      for (let guard = 0; guard < 400; guard += 1) {
        const her = uma()
        if (her.racing.level >= gateLevel(her.scenario) && careerComplete(her.career)) return
        const raceId = nextGoalRace(her.career) ?? 'x'
        const grade = RACES.find((race) => race.id === raceId)?.grade ?? 'g1'
        const raceBonus = deriveUmaPreset(her, her.raceDefaults.selectedPreset, TRAINING_CONTENT).raceBonus
        state = ok(applyRaceFinish(state, { umaId: COLT.id, raceId, resultId: `r${guard}`, grade, placement: 1, raceBonus }, now)).state
        now += 1
      }
      throw new Error('never reached the gate')
    }

    for (let s = 1 as ScenarioOfTier; s <= 5; s = (s + 1) as ScenarioOfTier) {
      expect(uma().scenario).toBe(s)
      // The next layer can't start yet: its first node, unique or single is refused with the scenario that opens it.
      if (s < 5) {
        const ahead = layerUnlocks((s + 1) as ScenarioOfTier)[0]!
        expect(begin('observatory', null, [ahead])).toMatchObject({ refused: true, code: 'later-layer', data: { unlock: unlockLabel(ahead), scenario: s + 1 } })
      }
      // The Dojo first, so the new nodes fill with set cards: the deck's bonds, one session per card type's room.
      const bonds = DECK[s - 1]!.map((card) => ({ entry: { kind: 'bond', target: card.id } as const, room: dojoRoomOf(card.type) }))
      for (const room of [...new Set(bonds.map((bond) => bond.room))]) session('dojo', room, bonds.filter((bond) => bond.room === room).map((bond) => bond.entry))
      if (s === 1) state = ok(setCardSet(state, { umaId: COLT.id, preset: uma().raceDefaults.selectedPreset, cardSetIds: uma().build.bonds }, now, { content: TRAINING_CONTENT })).state
      drain('observatory', null)
      drain('lineage-hall', null)
      for (const room of GYM_ROOMS) drain('gym', room)
      expect(layerDone(uma().build, s)).toBe(true)
      raceToGate()
      if (s < 5) state = ok(advanceScenario(state, { umaId: COLT.id }, now, { content: TIER_AND_TRAINING })).state
    }

    const her = uma()
    expect(unlocked).toBe(107)
    expect(her.racing.level).toBe(50)
    expect(her.build.constellationOpened).toBe(28)
    expect(her.build.extraNodes).toHaveLength(37)
    expect(her.build.bonds).toHaveLength(18)
    expect(Object.entries(state.items).filter(([id, count]) => id !== 'speed-ticket' && count !== 0)).toEqual([])
    // The selected preset filled its tree with its six cards as the nodes opened, each up to the cap.
    expect(Object.keys(her.build.presets[her.raceDefaults.selectedPreset].assignments)).toHaveLength(28)

    for (let race = 0; race < 8; race += 1) state = ok(recordExpeditionRace(state, { umaId: COLT.id, expeditionId: 'europe', won: true }, now + race)).state
    const leaving = uma()
    const stats = promotionPresetStats(leaving, TRAINING_CONTENT)
    const promoted = ok(promote(state, { umaId: COLT.id, presets: stats }, now + 10, { content: TIER_AND_TRAINING }))
    state = promoted.state
    const after = uma()
    expect(after).toMatchObject({ tier: 2, scenario: 1, racing: { level: 1, exp: 0 } })
    expect(after.build).toEqual(emptyBuild(COLT.uniqueSkillId))
    expect(promoted.receipt.history.bonds).toEqual(leaving.build.bonds)
    expect(promoted.receipt.history.presets[leaving.raceDefaults.selectedPreset].stats).toEqual(stats[leaving.raceDefaults.selectedPreset].stats)
    // The account carries: the Warehouse (the ticket left), Prize Money, and one more Uma Ticket.
    expect(state.items['speed-ticket']).toBe(3)
    expect(state.buildings).toEqual(workAccount([]).buildings)
    expect(state.profile).toEqual({ ...profileBefore, umaTickets: profileBefore.umaTickets + 1, umaShards: profileBefore.umaShards + 5 })
  })
})
