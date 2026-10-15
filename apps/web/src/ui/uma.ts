// An Uma's display name and initial, from the game's content (the port's `env`), for faces that fall back to text.
import { useGame } from '../app/game'

export const initialOf = (name: string): string => name.trim().charAt(0).toUpperCase() || '?'

/** Her template's name, or '' while the game loads or when the content lacks her. */
export function useUmaName(outfitId: string | null): string {
  return useGame((snapshot) => (outfitId === null ? '' : snapshot.env?.content.umas.get(outfitId)?.name ?? ''))
}
