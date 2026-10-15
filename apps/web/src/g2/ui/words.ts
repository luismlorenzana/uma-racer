// Names the Town Hall's screens give ids (T138), beside T140's `ui/work/words` (`showWords`, `itemName`, `placeName`):
// an Uma by her template's name and a card as the Library names it, "Kitasan Black [Fire at My Heels]".
import type { G2Snapshot } from '../app/game'

type Content = NonNullable<G2Snapshot['env']>['content']

/** An Uma's display name, or her id while the content lacks her. */
export const umaName = (content: Content | null | undefined, outfitId: string): string => content?.umas.get(outfitId)?.name ?? outfitId

/** A card's name as the Library shows it: "Kitasan Black [Fire at My Heels]". */
export function cardName(content: Content | null | undefined, cardId: string): string {
  const card = content?.cards.get(cardId)
  return card === undefined ? cardId : `${card.charName} [${card.title}]`
}
