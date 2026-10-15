// What every operation reads, built from the content packs (T134): the web and the API both call this, so the device's
// numbers and the server's come from the same maps. Pure: the packs come in, the maps go out.
import type { RaceTemplate, SkillTemplate, SupportCardTemplate, UmaTemplate } from '../content'
import type { OperationEnv } from '../check-in/once'

/** The four packs the operations read: Umas, races, support cards and skills. */
export interface OperationPacks {
  readonly umas: readonly UmaTemplate[]
  readonly races: readonly RaceTemplate[]
  readonly cards: readonly SupportCardTemplate[]
  readonly skills: readonly SkillTemplate[]
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
 * The env `OPERATIONS` reads, from the packs. A pack holding an id twice is a caller's bug and throws. `dev` stays off:
 * a caller that runs dev operations sets it itself (M034: dev builds, and the API with `DEV_OPERATIONS=true`).
 */
export function buildOperationEnv(packs: OperationPacks): OperationEnv {
  byId('race', packs.races)
  return {
    content: {
      umas: byId('Uma', packs.umas),
      races: [...packs.races],
      cards: byId('card', packs.cards),
      skills: byId('skill', packs.skills),
    },
  }
}
