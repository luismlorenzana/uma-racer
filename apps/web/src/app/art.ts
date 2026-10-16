// uma-art's atlases for uma-kit (T147; docs/game/11-hub-and-places.md §10): the kit imports no images, so the game
// hands it the pinned release's `ui` marks (the account bar's currencies, tier crests), `tiles` and `buildings` (the
// Hub map) through `KitArtProvider`. The images load by URL when something draws them; the small JSON indexes ride in
// the entry.
import buildingsIndex from '@luismlorenzana/uma-art/buildings/atlas.json'
import buildingsUrl from '@luismlorenzana/uma-art/buildings/atlas.png?url'
import tilesIndex from '@luismlorenzana/uma-art/tiles/atlas.json'
import tilesUrl from '@luismlorenzana/uma-art/tiles/atlas.png?url'
import uiIndex from '@luismlorenzana/uma-art/ui/atlas.json'
import uiUrl from '@luismlorenzana/uma-art/ui/atlas.png?url'
import type { KitArt } from '@luismlorenzana/uma-kit/ui'

export const RACER_ART: KitArt = {
  ui: { url: uiUrl, index: uiIndex },
  tiles: { url: tilesUrl, index: tilesIndex },
  buildings: { url: buildingsUrl, index: buildingsIndex },
}
