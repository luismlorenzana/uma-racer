// Creates the game port lazily (T137). Until T136 lands it is the in-memory port over `rework/sim`'s synthetic seeds,
// picked by `?seed=`; T136 plugs its `useSave` store in here, one to one (see `game.ts`). Everything it loads, the port
// and the rules alike, stays out of the entry chunk.
import type { G2Game, G2Rules } from './game'

export interface G2Boot {
  readonly game: G2Game
  readonly rules: G2Rules
}

export async function bootGame(search: string): Promise<G2Boot> {
  const [{ createMemoryGame }, { seedFor }, { RULES }] = await Promise.all([import('../dev/memory'), import('../dev/seed'), import('./rules')])
  return { game: createMemoryGame(seedFor(search)), rules: RULES }
}
