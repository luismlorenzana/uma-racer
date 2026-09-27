// Every list of owned Umas starts with the highest Uma Level (D181), then her name, so the same Uma is never in a
// different place from one screen to the next.

import type { UmaSave } from '@racer/domain'
import type { LoadedContent } from '../content/runtime'

/** Highest Uma Level first, then name, then id; an Uma without a save (a catalog entry) sorts after every owned one. */
export function byUmaLevel(
  saves: Readonly<Record<string, UmaSave>>,
  content: LoadedContent | null,
): (left: string, right: string) => number {
  const name = (id: string) => content?.umas.byId.get(id)?.name ?? id
  const level = (id: string) => saves[id]?.level ?? -1
  return (left, right) => level(right) - level(left) || name(left).localeCompare(name(right)) || left.localeCompare(right)
}

/** Owned Uma ids (or the given ids) in the shared order. */
export function umaIdsByLevel(
  saves: Readonly<Record<string, UmaSave>>,
  content: LoadedContent | null,
  ids: readonly string[] = Object.keys(saves),
): string[] {
  return [...ids].sort(byUmaLevel(saves, content))
}
