import { useMemo, useState } from 'react'
import type { CardSave, UmaSave } from '@racer/domain'
import type { LoadedContent } from '../../content/runtime'
import {
  CARD_FACETS,
  CARD_SORTS,
  CARD_TIE_BREAK,
  EFFECT_LABELS,
  buildCardAlbumRows,
  cardSortValueLabel,
  type CardEntry,
} from '../../game/album/cards'
import { emptyStateHint, runAlbumQuery, type AlbumQuery } from '../../game/album/query'
import { BottomSheet } from '../BottomSheet'
import { ArtTile } from '../ArtTile'
import { Crest } from '../Crest'
import { AlbumChrome } from './AlbumChrome'
import { VirtualGrid } from './VirtualGrid'

/**
 * The deck editor picks cards through the album rather than a weaker parallel list
 * (docs/design/collection.md#card-album). Ownership and era eligibility are pre-applied.
 */
export function CardPickerSheet({
  open,
  onClose,
  content,
  cards,
  umas,
  tickets,
  tier,
  excludeIds,
  onPick,
}: {
  open: boolean
  onClose: () => void
  content: LoadedContent
  cards: Readonly<Record<string, CardSave>>
  umas: Readonly<Record<string, UmaSave>>
  tickets: number
  /** Cards from later eras cannot be equipped at this tier. */
  tier: number
  excludeIds: readonly string[]
  onPick: (entry: CardEntry) => void
}) {
  const [query, setQuery] = useState<AlbumQuery>({
    search: '',
    filters: {},
    sort: 'level',
    direction: 'desc',
    group: null,
    density: 'compact',
    mode: null,
  })
  const [parameter, setParameter] = useState<string | null>(null)

  const album = useMemo(() => buildCardAlbumRows({ content, cards, umas, tickets, seen: [] }), [cards, content, tickets, umas])
  // Only owned, era-eligible, not-already-in-this-deck cards are pickable, so the facets never
  // offer something the deck would reject.
  const rows = useMemo(() => album.rows.filter((row) => {
    const entry = album.entries.get(row.id)
    if (!entry || !entry.owned || excludeIds.includes(row.id)) return false
    return entry.template.era <= tier
  }), [album, excludeIds, tier])

  const effectiveQuery = query.sort === 'effect' && parameter ? { ...query, sort: parameter } : query
  const result = runAlbumQuery(rows, CARD_FACETS, effectiveQuery, CARD_TIE_BREAK)
  const entries = result.rows.flatMap((row) => album.entries.get(row.id) ?? [])
  const pickableFacets = CARD_FACETS.filter((facet) => !['ownership', 'equippableAt', 'isNew'].includes(facet.key))

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="max-h-[74vh] overflow-y-auto pb-2">
        <AlbumChrome
          title="Add a card"
          completion={<>{entries.length} eligible at tier {tier}</>}
          facets={pickableFacets}
          sorts={CARD_SORTS}
          presets={[]}
          query={query}
          counts={result.counts}
          total={result.total}
          parameter={parameter}
          views={[]}
          emptyHint={emptyStateHint(rows, pickableFacets, effectiveQuery)}
          countFor={(draft) => runAlbumQuery(rows, pickableFacets, draft).total}
          onQueryChange={setQuery}
          onParameterChange={setParameter}
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
                  overlay={<Crest>{entry.template.type.slice(0, 3).toUpperCase()}</Crest>}
                  footer={
                    <>
                      <p className="font-display truncate text-[12px] font-semibold">{entry.template.charName}</p>
                      <p className="truncate text-[10px] text-ink-on-dark-soft">Lv {entry.save?.level} · LB{entry.save?.limitBreak}</p>
                    </>
                  }
                />
                <p className="truncate px-0.5 pt-1 text-[10px] text-ink-faint">
                  {cardSortValueLabel(entry, query.sort, parameter)
                    ?? (entry.headline ? EFFECT_LABELS[entry.headline.effect] : 'No effects')}
                </p>
              </button>
            )}
          />
        </AlbumChrome>
      </div>
    </BottomSheet>
  )
}
