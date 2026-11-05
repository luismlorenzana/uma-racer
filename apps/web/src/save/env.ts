// What every operation reads beyond the state, on this device (the domain's `buildOperationEnv`; T136, T152): built from
// the content packs, the same maps the API builds from its own, and cached per content version. The content version is
// the platform release's and the racer overlay's, `${manifest}:${overlay}`, exactly as the API's
// (`apps/api/src/save/operation-content.ts`), so race seeds agree on both sides. `dev` is on only in dev builds, so
// `dev-grant` runs nowhere else on the device.
import { buildOperationEnv, type OperationEnv } from '@racer/domain/save'
import { simulateRace } from '@racer/race'
import type { LoadedContent } from '../content/view'

export type OperationContent = Pick<LoadedContent, 'manifest' | 'overlay' | 'umas' | 'races' | 'courses' | 'cards' | 'skills'>

/** The env's content version: the release manifest's and the racer overlay's, joined as the API joins them. */
export const contentVersionOf = (content: Pick<OperationContent, 'manifest' | 'overlay'>): string =>
  `${content.manifest.version}:${content.overlay.version}`

/** The race engine career races run on, the API's own (D383): engine v9's `simulateRace`. */
export const RACE_ENGINE: NonNullable<OperationEnv['race']> = Object.freeze({ version: 9, simulate: simulateRace })

let cached: { readonly key: string; readonly env: OperationEnv } | null = null

export function operationEnv(content: OperationContent, dev: boolean = import.meta.env.DEV): OperationEnv {
  const contentVersion = contentVersionOf(content)
  const key = `${contentVersion}:${dev}`
  if (cached?.key === key) return cached.env
  const built = buildOperationEnv({
    umas: content.umas.items, races: content.races.items, courses: content.courses.items, cards: content.cards.items,
    skills: content.skills.items, contentVersion, race: RACE_ENGINE,
  })
  const env: OperationEnv = dev ? { ...built, dev: true } : built
  cached = { key, env }
  return env
}
