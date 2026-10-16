// The place registry's live block (docs/game/architecture.md#the-rework-modules "The live manual"): game/11 §3's
// places as the registry holds them, rendered from the code so the page can't drift. Registered in
// packages/domain/src/docs/render.ts. Pure: no I/O.
import { AWAITING_ART, HUB_PAGE_NAMES, PLACES, type Place } from './places'

const code = (value: string): string => `\`${value}\``

function at(place: Place): string {
  return place.at === null ? '—' : `${place.at.x}, ${place.at.y}`
}

function placesTable(): string {
  const head = ['Page', 'Place', 'Id', 'Kind', 'Route', 'Counter', 'Frame', 'Pips', 'At (x, y)']
  const rows = PLACES.map((place) => [
    HUB_PAGE_NAMES[place.page],
    `${place.name}${place.direct ? ' (direct)' : ''}${place.hidden ? ' (hidden)' : ''}`,
    code(place.id),
    place.kind,
    code(place.route),
    place.counter === null ? '—' : code(place.counter),
    place.frame === null ? '—' : `${code(place.frame)}${AWAITING_ART.includes(place.frame) ? ' (**new**)' : ''}`,
    place.pips ? 'yes' : '—',
    at(place),
  ])
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((row) => `| ${row.join(' | ')} |`)].join('\n')
}

export const LIVE_BLOCKS = Object.freeze({
  'hub-places': placesTable,
})
