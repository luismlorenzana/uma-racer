// Career fixtures (T154, D383): the invented content (`career/synthetic.ts`) as an operation env, a stand-in race
// engine that places her where a test says, and saves with an unlocked Uma and her career. Invented values only.
import { syntheticCards } from '../build/decks'
import { syntheticCareerUmas, syntheticCourses, syntheticRaces, syntheticSkills } from '../career/synthetic'
import type { RaceTemplate } from '../content'
import type { RaceEngine, RaceSetup } from '../race-attempt'
import { buildOperationEnv } from '../save/env'
import type { OperationEnv } from '../save/registry'
import { careerId, type CareerRecord } from '../save/records'
import type { SaveState } from '../save/state'
import { clock } from './g3'

export const UMAS = syntheticCareerUmas()
export const RACES = syntheticRaces()
export const CARDS = syntheticCards()
/** The invented content as the operations read it, without an engine. */
export const CONTENT_ENV: OperationEnv = buildOperationEnv({
  umas: UMAS, races: RACES, courses: syntheticCourses(), cards: CARDS, skills: syntheticSkills(), contentVersion: 'test-content',
})

/**
 * A stand-in engine: the runner `umaId` finishes where `place(setup)` says, everyone else behind or ahead in gate order.
 * It records every setup it ran.
 */
export function fakeEngine(umaId: string, place: (setup: RaceSetup) => number): RaceEngine & { readonly runs: RaceSetup[] } {
  const runs: RaceSetup[] = []
  return {
    version: 9,
    runs,
    simulate: (setup) => {
      runs.push(setup)
      const her = setup.runners.findIndex((runner) => runner.id === umaId)
      const placement = Math.min(setup.runners.length, Math.max(1, place(setup)))
      const others = setup.runners.map((_, i) => i).filter((i) => i !== her)
      const order = [...others.slice(0, placement - 1), her, ...others.slice(placement - 1)]
      return {
        results: order.map((runner, n) => ({ runner, placement: n + 1, finishTime: 120 + n * 0.25, marginLengths: n === 0 ? 0 : 0.5 })),
      }
    },
  }
}

/** The env with an engine that places her `placement`th (or by a rule). */
export const withEngine = (engine: RaceEngine): OperationEnv => ({ ...CONTENT_ENV, race: engine })

/** A save with her unlocked, every invented card unlocked, and (optionally) her career. */
export function careerSave(umaId: string, career?: CareerRecord): SaveState {
  return {
    account: { createdAt: clock('07:00'), umaTickets: 5, cardTickets: 5 },
    umas: { [umaId]: { unlockedAt: clock('07:00') } },
    cards: Object.fromEntries(CARDS.map((card) => [card.id, { unlockedAt: clock('07:00') }])),
    careers: career === undefined ? {} : { [careerId(umaId, career.T)]: career },
    bonds: {},
  }
}

/** A race of the invented content by id. */
export const race = (id: string): RaceTemplate => {
  const found = RACES.find((entry) => entry.id === id)
  if (found === undefined) throw new Error(`No race ${id}`)
  return found
}
