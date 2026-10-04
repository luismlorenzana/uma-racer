import { useMemo, useState } from 'react'
import type { CardSave, UmaSave } from '@racer/domain'
import type { LoadedContent } from '../../content/runtime'
import {
  CARD_SCENARIO_FACETS,
  CARD_SCENARIO_QUERY,
  CARD_SCENARIO_SORTS,
  CARD_TIE_BREAK,
  buildCardAlbumRows,
  cardSortValueLabel,
  cardSplitLabel,
  type CardEntry,
} from '../../game/album/cards'
import { emptyStateHint, runAlbumQuery, type AlbumQuery } from '../../game/album/query'
import { ArtTile } from '../ArtTile'
import { Stars } from '../Stars'
import { BottomSheet } from '../BottomSheet'
import { TypeIcon } from '../TypeIcon'
import { CardDistanceIcon, CardStyleIcon } from '../CardFocusBadges'
import { AlbumChrome } from './AlbumChrome'
import { VirtualGrid } from './VirtualGrid'

/**
 * The card set picks cards through the album's scenario lens rather than a weaker parallel list
 * (docs/design/collection.md#card-album): owned, era-eligible, and already ranked by bond in this scenario.
 */
export function CardPickerSheet({
  open,
  onClose,
  content,
  cards,
  umas,
  tier,
  excludeIds,
  title = 'Add a card',
  onPick,
}: {
  open: boolean
  onClose: () => void
  content: LoadedContent
  cards: Readonly<Record<string, CardSave>>
  umas: Readonly<Record<string, UmaSave>>
  /** The scenario being filled: its era gate and node pay; stars are global. */
  tier: number
  excludeIds: readonly string[]
  title?: string
  onPick: (entry: CardEntry) => void
}) {
  const [query, setQuery] = useState<AlbumQuery>(CARD_SCENARIO_QUERY)

  const album = useMemo(() => buildCardAlbumRows({ content, cards, umas, seen: [], lens: tier }), [cards, content, tier, umas])
  // Only owned cards not already in this set are pickable, so the facets never offer something the set would reject.
  const rows = useMemo(() => album.rows.filter((row) => album.entries.get(row.id)?.owned && !excludeIds.includes(row.id)), [album, excludeIds])
  const facets = CARD_SCENARIO_FACETS.filter((facet) => facet.key !== 'ownership' && facet.key !== 'isNew')
  const result = runAlbumQuery(rows, facets, query, CARD_TIE_BREAK)
  const entries = result.rows.flatMap((row) => album.entries.get(row.id) ?? [])

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="max-h-[74vh] overflow-y-auto pb-2">
        <AlbumChrome
          title={title}
          completion={<>{entries.length} owned card{entries.length === 1 ? '' : 's'} eligible here</>}
          facets={facets}
          sorts={CARD_SCENARIO_SORTS}
          presets={[]}
          query={query}
          counts={result.counts}
          total={result.total}
          parameter={null}
          views={[]}
          emptyHint={emptyStateHint(rows, facets, query)}
          countFor={(draft) => runAlbumQuery(rows, facets, draft).total}
          onQueryChange={setQuery}
          onParameterChange={() => undefined}
          onSaveView={() => undefined}
          onDeleteView={() => undefined}
        >
          <VirtualGrid
            items={entries}
            columns={3}
            rowHeight={150}
            keyOf={(entry) => entry.id}
            renderItem={(entry) => (
              <button type="button" onClick={() => onPick(entry)} className="block w-full min-w-0 text-left">
                <ArtTile
                  asset={entry.asset}
                  alt={`${entry.template.charName} support card`}
                  // The album's four corners (D238): distance, running style, then type and stars along the bottom.
                  overlay={<CardDistanceIcon focus={entry.focus} size={20} />}
                  corner={<CardStyleIcon focus={entry.focus} size={20} />}
                  footer={
                    <>
                      <p className="font-display truncate text-[12px] font-semibold">{entry.template.charName}</p>
                      <div className="mt-0.5 flex items-center justify-between gap-1">
                        <TypeIcon type={entry.template.type} size={16} className="drop-shadow" />
                        <Stars value={entry.bond ?? 0} compact />
                      </div>
                    </>
                  }
                />
                <p className="truncate px-0.5 pt-1 text-[10px] text-ink-faint">
                  {cardSortValueLabel(entry, query.sort) ?? cardSplitLabel(entry.template)}
                </p>
              </button>
            )}
          />
        </AlbumChrome>
      </div>
    </BottomSheet>
  )
}
