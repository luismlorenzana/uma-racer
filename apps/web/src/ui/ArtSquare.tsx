// An Uma's or a card's square tile art (docs/design/ux.md "Art tiers", "Icon overlays"; T138): today's ArtTile
// over the private content's icon atlas, with an Uma's bust or a card's art once it loads. Without content (the dev
// mount) it is ArtTile's labelled placeholder. The four corners carry what the album puts there.
import type { ReactNode } from 'react'
import { getContentAsset } from '../content/view'
import { ArtTile } from './ArtTile'
import { useG2Content } from '../app/content'

interface Corners {
  readonly dimmed?: boolean
  readonly overlay?: ReactNode
  readonly corner?: ReactNode
  readonly badge?: ReactNode
  readonly bottomLeft?: ReactNode
  readonly footer?: ReactNode
  readonly tight?: boolean
  readonly className?: string
}

/** The card's icon, its four corners as D238 lays them out. */
export function CardSquare({ cardId, name, ...corners }: Corners & { cardId: string; name: string }) {
  const content = useG2Content()
  return <ArtTile asset={content === null ? null : getContentAsset(content, 'card-icons', cardId)} alt={name} {...corners} />
}
