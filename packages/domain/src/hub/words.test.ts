// The Hub's words hold 02 §9's rule (no operation, receipt, version, id… and no status numbers), and `hub/` is pure:
// no clock but the given `now`, no dice, no I/O (docs/game/architecture.md#the-rework-modules "Pure").
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { codeOnly } from '../__fixtures__/code-only'
import { hasBannedWord } from '../rework/check-in/words'
import { BUILDING_IDS } from '../rework/farm/buildings'
import { HUB_PAGE_NAMES, PLACES, type PlaceCounter } from './places'
import type { HubBuilding, HubView } from './view'
import { counterWords, HUB_WORDS, hubWords, pillWords, slotWords, tileLabel, umaTicketChip } from './words'

const COUNTERS: readonly PlaceCounter[] = ['uma-tickets', 'finished-here', 'ready-to-advance', 'featured-open', 'promotable', 'new-flair']

const building = (slots: number, busy: number, ready: number, queued: number): HubBuilding =>
  ({ slots, busy, ready, free: slots - busy - ready, queued, pips: [], more: 0 })

function view(ready: number, free: number): HubView {
  const buildings = Object.fromEntries(BUILDING_IDS.map((id) => [id, building(8, 6, 2, 1)])) as HubView['buildings']
  return {
    ready, free, readySlots: [], needsATap: ready + free, tabs: { farm: 0, training: 0 }, buildings, counts: {}, featured: null, umas: 3,
    wallet: { prizeMoney: 0, speedTickets: 0, umaTickets: 2, shards: 3, shardsPerTicket: 5, ticketReady: false },
  }
}

describe('the Hub words', () => {
  it("never use 02 §9's banned words in names, blurbs, counters, labels or copy", () => {
    const strings = [
      ...Object.values(HUB_PAGE_NAMES),
      ...PLACES.flatMap((place) => [place.name, place.blurb]),
      ...COUNTERS.flatMap((counter) => [0, 1, 3].map((n) => counterWords(counter, n))),
      ...Object.values(HUB_WORDS),
      ...PLACES.flatMap((place) => [tileLabel(place, view(2, 1), 3), tileLabel(place, null)]),
      pillWords(view(4, 1))!.text, pillWords(view(0, 3))!.text,
    ]
    for (const text of strings) expect(hasBannedWord(text), text).toBe(false)
    expect(strings.length).toBeGreaterThan(100)
  })

  it('reads a tile as one line (§4)', () => {
    expect(slotWords(building(8, 6, 2, 1))).toBe('6 of 8 slots busy, 2 ready, 1 queued')
    expect(slotWords(building(1, 1, 0, 0))).toBe('1 of 1 slot busy')
    expect(tileLabel(PLACES.find((place) => place.id === 'kitchen')!, view(2, 1))).toBe('Kitchen. 6 of 8 slots busy, 2 ready, 1 queued.')
    expect(counterWords('uma-tickets', 1)).toBe('1 Uma Ticket')
    expect(counterWords('featured-open', 3)).toBe('3 featured races open')
  })

  it('reads the pill as Collect all, else Check-in, else nothing (§2.3)', () => {
    expect(pillWords(view(14, 2))).toEqual({ collect: true, text: 'Collect all · 14 ready' })
    expect(pillWords(view(0, 3))).toEqual({ collect: false, text: 'Check-in · 3 free' })
    expect(pillWords(view(0, 0))).toBeNull()
    expect(pillWords(null)).toBeNull()
    expect(hubWords('enter', { place: 'Kitchen' })).toBe('Enter Kitchen')
    expect(umaTicketChip(view(0, 0).wallet)).toBe('2 · 3/5')
  })
})

describe('purity', () => {
  it('reads no clock, rolls no dice and does no I/O in hub/', () => {
    const dir = fileURLToPath(new URL('.', import.meta.url))
    const sources = readdirSync(dir).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts')).map((file) => join(dir, file))
    expect(sources.length).toBeGreaterThanOrEqual(5)
    for (const file of sources) {
      const code = codeOnly(readFileSync(file, 'utf8'))
      for (const banned of [/Date\.now/, /new Date\b/, /Math\.random/, /from 'node:/, /\brequire\(/, /\bfetch\(/, /localStorage/, /indexedDB/, /\bwindow\./, /\bdocument\./, /\bprocess\./, /\bconsole\./]) {
        expect(banned.test(code), `${file} uses ${banned}`).toBe(false)
      }
    }
  })

  it("keeps the registry's imports from the rules type-only, so the shell's entry chunk stays small", () => {
    const source = readFileSync(fileURLToPath(new URL('./places.ts', import.meta.url)), 'utf8')
    for (const [line] of source.matchAll(/^import .*$/gm)) expect(line, line).toMatch(/^import type /)
  })
})
