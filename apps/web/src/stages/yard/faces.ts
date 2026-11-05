// Whose face each colour wears in Training Yard (docs/game/08-training-yard.md §5): her own on the season's focus
// colour, and four rivals' on the others, picked from the game's Umas by the play's seed. Cosmetic: the rules never
// read it, and a game with fewer Umas reuses hers.
import { STATS } from '@racer/domain'
import { stageRng, type StageConfig } from '@racer/domain/stages'

export function yardFaces(config: Pick<StageConfig, 'uma' | 'seasonFocus' | 'seed'>, umaIds: readonly string[]): string[] {
  const rivals = umaIds.filter((id) => id !== config.uma.id).sort()
  const rng = stageRng((config.seed ^ 0x6a09e667) >>> 0)
  const picks: string[] = []
  while (picks.length < STATS.length - 1 && rivals.length > 0) picks.push(rivals.splice(rng.below(rivals.length), 1)[0]!)
  const focus = STATS.indexOf(config.seasonFocus ?? STATS[0])
  let next = 0
  return STATS.map((_, colour) => (colour === focus ? config.uma.id : picks[next++] ?? config.uma.id))
}
