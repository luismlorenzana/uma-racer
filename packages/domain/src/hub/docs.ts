// The Hub's live blocks (docs/game/architecture.md "The live manual"): game/11 §3's places as the registry holds them,
// and game/02's tickets and card effect words, rendered from the code so the pages can't drift. Registered in
// packages/domain/src/docs/render.ts. Pure: no I/O, and nothing from the private content packs.
import { INITIAL_CARD_TICKETS, INITIAL_UMA_TICKETS } from '../account/ops'
import { FINALE_REWARD, OBJECTIVE_CARD_TICKETS } from '../career/rewards'
import { EFFECT_WORDS } from './cards'
import { AWAITING_ART, HUB_PAGE_NAMES, PLACES, type Place } from './places'

const code = (value: string): string => `\`${value}\``

function table(head: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((row) => `| ${row.join(' | ')} |`)].join('\n')
}

function at(place: Place): string {
  return place.at === null ? '—' : `${place.at.x}, ${place.at.y}`
}

function placesTable(): string {
  const head = ['Page', 'Place', 'Id', 'Kind', 'Route', 'Counter', 'Frame', 'At (x, y)']
  const rows = PLACES.map((place) => [
    HUB_PAGE_NAMES[place.page],
    `${place.name}${place.direct ? ' (direct)' : ''}${place.hidden ? ' (hidden)' : ''}`,
    code(place.id),
    place.kind,
    code(place.route),
    place.counter === null ? '—' : code(place.counter),
    place.frame === null ? '—' : `${code(place.frame)}${AWAITING_ART.includes(place.frame) ? ' (**new**)' : ''}`,
    at(place),
  ])
  return table(head, rows)
}

function ticketsTable(): string {
  return table(['Ticket', 'A new account', 'Unlocks', 'Earned by'], [
    ['Uma Ticket', INITIAL_UMA_TICKETS, 'One Uma (the Stable)', `Completing the URA Finals: +${FINALE_REWARD.umaTickets}`],
    ['Card Ticket', INITIAL_CARD_TICKETS, 'One SSR support card (the Card Library)',
      `An objective's first win: +${OBJECTIVE_CARD_TICKETS}; completing the URA Finals: +${FINALE_REWARD.cardTickets}`],
  ])
}

function effectWordsTable(): string {
  return table(['Id', 'Effect', 'Reads as'], Object.entries(EFFECT_WORDS).map(([id, word]) => [id, word.name, word.unit === 'percent' ? '*n*%' : '+*n*']))
}

export const LIVE_BLOCKS = Object.freeze({
  'hub-places': placesTable,
  'unlock-tickets': ticketsTable,
  'card-effect-words': effectWordsTable,
})
