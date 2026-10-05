// Roster order: enrolled outfits first, then by name (docs/design/uma-rpg.md#phone-presentation).
export function orderRpgRoster(ids: readonly string[], enrolled: ReadonlySet<string>, name: (id: string) => string): string[] {
  return [...ids].sort((a, b) => Number(enrolled.has(b)) - Number(enrolled.has(a)) || name(a).localeCompare(name(b)) || a.localeCompare(b))
}
