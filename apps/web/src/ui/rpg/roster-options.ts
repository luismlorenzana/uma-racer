// Roster order: enrolled outfits first, highest RPG level first, then by name (docs/design/uma-rpg.md#phone-presentation).
export function orderRpgRoster(ids: readonly string[], level: (id: string) => number | null, name: (id: string) => string): string[] {
  const rank = (id: string) => level(id) ?? -1
  return [...ids].sort((a, b) => rank(b) - rank(a) || name(a).localeCompare(name(b)) || a.localeCompare(b))
}

/** Party picker (D284): enrolled, owned Umas that no party holds yet, highest RPG level first, then by name. */
export function rpgPartyCandidates(enrolled: readonly string[], partySlots: readonly (readonly ({ outfitId: string } | null)[])[],
  level: (id: string) => number, name: (id: string) => string): string[] {
  const taken = new Set(partySlots.flatMap((slots) => slots.flatMap((slot) => slot ? [slot.outfitId] : [])))
  return orderRpgRoster(enrolled.filter((id) => !taken.has(id)), level, name)
}
