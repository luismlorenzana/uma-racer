// What every operation reads beyond the state, on this device (T134's `buildOperationEnv`; T136): built from today's
// content packs, the same four maps the API builds from its own, and cached per content version. `dev` is on only in
// dev builds, so `dev-grant` runs nowhere else on the device (M034).
import { buildOperationEnv, type OperationEnv } from '@racer/domain/save'
import type { LoadedContent } from '../content/runtime'

export type OperationContent = Pick<LoadedContent, 'manifest' | 'umas' | 'races' | 'cards' | 'skills'>

let cached: { readonly key: string; readonly env: OperationEnv } | null = null

export function operationEnv(content: OperationContent, dev: boolean = import.meta.env.DEV): OperationEnv {
  const key = `${content.manifest.version}:${dev}`
  if (cached?.key === key) return cached.env
  const built = buildOperationEnv({ umas: content.umas.items, races: content.races.items, cards: content.cards.items, skills: content.skills.items })
  const env: OperationEnv = dev ? { ...built, dev: true } : built
  cached = { key, env }
  return env
}
