// The reveal's route (docs/game/11-hub-and-places.md §6, §7.1; T138): `/collection/reveal/uma/:umaId`, with the Umas
// still to show as `?then=<id>,<id>` and how many there were as `?of=`, so Next reads "Next (2 of 5)" after a reload.

export interface RevealQueue {
  /** Who shows after her, in order. */
  readonly then: readonly string[]
  /** Her place among them, from 1, and how many in all. */
  readonly at: number
  readonly of: number
}

export function revealPath(ids: readonly string[], of = ids.length): string {
  const [first, ...then] = ids
  if (first === undefined) return '/town/stable?tab=owned'
  const path = `/collection/reveal/uma/${encodeURIComponent(first)}`
  if (then.length === 0) return path
  const search = new URLSearchParams({ then: then.join(','), of: String(of) })
  return `${path}?${search.toString()}`
}

export function readRevealQueue(search: string): RevealQueue {
  const params = new URLSearchParams(search)
  const then = (params.get('then') ?? '').split(',').map((id) => id.trim()).filter((id) => id.length > 0)
  const asked = Number(params.get('of'))
  const of = Number.isInteger(asked) && asked > then.length ? asked : then.length + 1
  return { then, at: of - then.length, of }
}
