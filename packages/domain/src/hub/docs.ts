// The place registry's live block (docs/game/architecture.md#the-rework-modules "The live manual"): rework/11 §3's
// places as the registry holds them, rendered from the code so the page can't drift. Registered in
// packages/domain/src/docs/rework.ts. Pure: no I/O.
import { HUB_PAGE_NAMES, PLACES, type Place } from './places'

const code = (value: string): string => `\`${value}\``

function cell(place: Place): string {
  return place.cell === null ? '—' : `${place.cell.row}, ${place.cell.col}`
}

function placesTable(): string {
  const head = ['Page', 'Place', 'Id', 'Kind', 'Route', 'Counter', 'Frame', 'Pips', 'Cell']
  const rows = PLACES.map((place) => [
    HUB_PAGE_NAMES[place.page],
    `${place.name}${place.direct ? ' (direct)' : ''}${place.hidden ? ' (hidden)' : ''}`,
    code(place.id),
    place.kind,
    code(place.route),
    place.counter === null ? '—' : code(place.counter),
    place.frame === null ? (place.hidden ? '—' : '**new**') : code(place.frame),
    place.pips ? 'yes' : '—',
    cell(place),
  ])
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((row) => `| ${row.join(' | ')} |`)].join('\n')
}

export const LIVE_BLOCKS = Object.freeze({
  'hub-places': placesTable,
})
