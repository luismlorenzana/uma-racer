import { getContentAsset, type LoadedContent } from '../../content/runtime'
import { AtlasSprite } from '../../ui/AtlasSprite'
import { SparkIcon } from '../../ui/icons'

/** A card's face: its full illustration, or its icon and name on a stage where no illustration is published. */
export function CardArt({ content, cardId, art }: { content: LoadedContent; cardId: string; art: string | null }) {
  if (art) return <img src={art} alt="" aria-hidden draggable={false} className="h-full w-full object-cover" />
  const template = content.cards.byId.get(cardId)
  return (
    <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-b from-stage-soft to-stage p-1">
      <AtlasSprite
        asset={getContentAsset(content, 'card-icons', cardId)}
        decorative
        className="w-4/5 rounded-[18%]"
        fallback={<span className="font-display flex text-lg font-black text-accent">{template?.charName.slice(0, 1) ?? <SparkIcon size={20} />}</span>}
      />
      <span className="w-full truncate text-center text-[9px] leading-tight font-semibold text-ink-on-dark">{template?.charName}</span>
    </span>
  )
}
