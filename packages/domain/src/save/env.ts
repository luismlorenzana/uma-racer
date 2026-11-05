// What every operation reads, built from the content packs: the web and the API both call this, so the device's numbers
// and the server's come from the same maps. Pure: the packs come in, the maps go out.
import type { CourseTemplate, RaceTemplate, SkillTemplate, SupportCardTemplate, UmaTemplate } from '../content'
import type { RaceEngine } from '../race-attempt'
import type { OperationEnv } from './registry'

/** The packs the operations read: Umas, races, courses, support cards and skills, and the release they came from. */
export interface OperationPacks {
  readonly umas: readonly UmaTemplate[]
  readonly races: readonly RaceTemplate[]
  readonly courses: readonly CourseTemplate[]
  readonly cards: readonly SupportCardTemplate[]
  readonly skills: readonly SkillTemplate[]
  readonly contentVersion: string
  /** The race engine career races run on (D383): the device and the API each hand in `@racer/race`'s. */
  readonly race?: RaceEngine
}

function byId<T extends { readonly id: string }>(what: string, items: readonly T[]): ReadonlyMap<string, T> {
  const map = new Map<string, T>()
  for (const item of items) {
    if (map.has(item.id)) throw new RangeError(`The ${what} pack holds ${item.id} twice`)
    map.set(item.id, item)
  }
  return map
}

/**
 * The env the operations read, from the packs. A pack holding an id twice is a caller's bug and throws. `dev` stays
 * off: a caller that runs dev operations sets it itself (the API with `DEV_OPERATIONS=true`).
 */
export function buildOperationEnv(packs: OperationPacks): OperationEnv {
  byId('race', packs.races)
  return {
    content: {
      umas: byId('Uma', packs.umas),
      races: [...packs.races],
      courses: byId('course', packs.courses),
      cards: byId('card', packs.cards),
      skills: byId('skill', packs.skills),
    },
    contentVersion: packs.contentVersion,
    ...(packs.race === undefined ? {} : { race: packs.race }),
  }
}
