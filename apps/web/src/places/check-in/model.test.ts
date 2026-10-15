// The check-in summary's readings (docs/rework/02-check-ins-and-notifications.md §3, §4, §5, §9; T142) on synthetic
// seeds: the header's `since`; the sections in the domain's order, empty ones absent, a check-in with nothing to fix
// only Collected and Repeat all; the totals line; suggestions' words and preselected links; each skip's fixes; Speed up
// all's counts and refusal; Best use; 02 §3's check-in-fits table, cell by cell, as size chips from base-minute items;
// and every template held to the banned words.
import { collectAll, DEFAULT_CHECK_INS, hasBannedWord, repeat, SUMMARY_SECTIONS, speedUpAllPlan } from '@racer/domain/check-in'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { seed, stubStorage } from '../../__fixtures__/testing'
import { sizeChipsView } from '../../ui/work/model'
import { workView } from '../../ui/work/view'
import { WORK_WORDS, type WordsContext } from '../../ui/work/words'
import { apply, farmAccount, HOUR, MINUTE, uma, withFarmLevel } from '../farm/__fixtures__/farm'
import { readCollapsed, readShownAt, SHOWN_AT_KEY, writeCollapsed, writeShownAt } from './device'
import {
  agoWords, bestUseLines, collectedView, freeLines, headerWords, nextWords, sectionOf, sessionLink, skipViews, speedOptions, suggestionLink,
  suggestionWords, summaryOf,
} from './model'
import { SUMMARY_WORDS } from './words'

beforeEach(stubStorage)
afterEach(() => vi.unstubAllGlobals())

const context = (env: ReturnType<typeof seed>['env']): WordsContext => ({ umaName: (id) => env.content.umas.get(id)?.name ?? '', utcOffsetMin: 0 })

/** A seed's check-in: Collect all, then Repeat all, at the seed's clock. */
function checkedIn(name: string) {
  const made = seed(name)
  const collected = collectAll(made.state, {}, made.at, made.env)
  const repeated = repeat(collected.state, { utcOffsetMin: 0 }, made.at, made.env)
  return { made, collected, repeated }
}

describe('the header (02 §4)', () => {
  it('reads "since 08:02 (5 h ago)", minutes under an hour, days past two, and no since the first time', () => {
    const now = 13 * HOUR + 2 * MINUTE
    expect(headerWords('Check-in', 8 * HOUR + 2 * MINUTE, now, 0)).toBe('Check-in · since 08:02 (5 h ago)')
    expect(agoWords(now - 20 * MINUTE, now)).toBe('20 min ago')
    expect(agoWords(now, now)).toBe('just now')
    expect(agoWords(now - 30 * HOUR, now)).toBe('30 h ago')
    expect(agoWords(now - 50 * HOUR, now)).toBe('2 days ago')
    expect(headerWords('Check-in', null, now, 0)).toBe('Check-in')
    // A clock moved back never shows a since in the future.
    expect(headerWords('Check-in', now + HOUR, now, 0)).toBe('Check-in · since 13:02 (just now)')
  })

  it("keeps this device's since and folded sections in uma-racer:g2: keys, forgiving a bad value", () => {
    expect(readShownAt()).toBeNull()
    writeShownAt(1_234)
    expect(readShownAt()).toBe(1_234)
    localStorage.setItem(SHOWN_AT_KEY, 'soon')
    expect(readShownAt()).toBeNull()
    writeCollapsed(new Set(['free', 'money']))
    expect([...readCollapsed()].sort()).toEqual(['free', 'money'])
    localStorage.setItem('uma-racer:g2:check-in:collapsed', '{')
    expect(readCollapsed().size).toBe(0)
  })
})

describe('the sections (02 §4)', () => {
  it("come in the domain's order with the empty ones absent", () => {
    const { made, collected, repeated } = checkedIn('stopped')
    const summary = summaryOf(repeated.state, made.env, made.at, 0, made.at - 5 * HOUR, collected.receipt, repeated.receipt)
    const kinds = summary.sections.map((section) => section.kind)
    expect(kinds).toEqual(SUMMARY_SECTIONS.filter((kind) => kinds.includes(kind)))
    expect(kinds).toEqual(['collected', 'free', 'queue-stopped', 'couldnt-repeat', 'next', 'money'])
  })

  it('a check-in with nothing to fix is just Collected and Repeat all', () => {
    const { state: account, at, env } = farmAccount(1)
    const started = apply(account, 'start', { outfitId: uma(1), slot: { building: 'fields', slot: 0 }, request: { kind: 'gather', item: 'wheat', count: 1 } }, at).state
    const later = at + 3 * HOUR
    const collected = collectAll(started, {}, later, env)
    const summary = summaryOf(collected.state, env, later, 0, at, collected.receipt, null)
    // Fresh accounts have no Prize Money and nothing runs, so the Free line is the only other thing: she is the repeat.
    expect(summary.sections.map((section) => section.kind)).toEqual(['collected', 'free'])
    expect(summary.repeatAll).toBe(1)
    const view = collectedView(sectionOf(summary, 'collected')!, env, context(env))
    expect(view.totals).toBe('1 item · 0 dishes · 0 unlocks')
  })

  it('Collected reads the totals, each notable line with its link, and the queues that moved on', () => {
    const { made, collected, repeated } = checkedIn('stopped')
    const summary = summaryOf(repeated.state, made.env, made.at, 0, made.at - 5 * HOUR, collected.receipt, repeated.receipt)
    const view = collectedView(sectionOf(summary, 'collected')!, made.env, context(made.env))
    const { totals } = collected.receipt
    expect(view.totals).toBe(`${totals.items} items · ${totals.dishes} dishes · ${totals.unlocks} unlocks`)
    expect(view.notes.length).toBeGreaterThan(0)
    expect(view.notes.find((note) => note.words.includes('Farm Lv'))?.words).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+: Farm Lv \d+ → \d+/)
    expect(view.notes.every((note) => note.to === `/town/stable/outfit/${note.outfitId}`)).toBe(true)
    expect(view.notes.some((note) => /Observatory node \d/.test(note.words))).toBe(true)
  })

  it('Next reads the next finish and when all is done', () => {
    const made = seed('quiet')
    const summary = summaryOf(made.state, made.env, made.at, 0, null, null, null)
    expect(nextWords(sectionOf(summary, 'next')!, 0)).toMatch(/^Next: \d\d:\d\d [A-Z][\w ]+ ×\d+ · all done by \d\d:\d\d$/)
  })
})

describe('Free and its suggestions (02 §4, §6)', () => {
  it("words each line as 02 §4 does and opens its sheet preselected: T140's job sheet or T139's session sheet", () => {
    const { made, collected } = checkedIn('busy')
    const summary = summaryOf(collected.state, made.env, made.at, 0, null, collected.receipt, null)
    const settled = workView(collected.state, made.at, made.env).settled
    const lines = freeLines(sectionOf(summary, 'free')!, settled, '/farm?sheet=check-in', 0)
    const job = lines.find((line) => line.suggestion?.kind === 'job')!
    const session = lines.find((line) => line.suggestion?.kind === 'session')!
    expect(job.words).toMatch(/^(Gather|Craft|Cook) [\w &]+ G\d+ ×\d+ → \d\d:\d\d$/)
    expect(session.words).toMatch(/^(Observatory|Lineage Hall|Gym|Dojo) ×\d+ → \d\d:\d\d$/)
    const s = job.suggestion!
    expect(job.to).toBe(`/farm/${s.slot.building}?job=${s.item}&uma=${s.outfitId}&count=${s.size}&slot=${s.slot.slot}&back=%2Ffarm%3Fsheet%3Dcheck-in`)
    expect(suggestionLink(session.suggestion!, '/farm')).toMatch(/^\/training\/(observatory|lineage-hall|gym|dojo)\?session=sim-uma-\d+(&room=\w+)?&unlocks=[\w-]+%3A[\w-]+(%2C[\w-]+%3A[\w-]+)*&back=%2Ffarm$/)
    expect(lines.every((line) => line.canRepeat === (settled.work[line.outfitId]?.last != null))).toBe(true)
  })

  it('a Free Uma with nothing to suggest says so, and links to her Needs', () => {
    const { made, collected } = checkedIn('stopped')
    const summary = summaryOf(collected.state, made.env, made.at, 0, null, collected.receipt, null)
    const settled = workView(collected.state, made.at, made.env).settled
    const idle = freeLines(sectionOf(summary, 'free')!, settled, '/farm', 0).find((line) => line.suggestion === null)
    expect(idle).toMatchObject({ words: SUMMARY_WORDS['free-idle'], to: `/town/stable/outfit/${idle!.outfitId}/needs` })
  })

  it('a session link carries the room and the unlocks in order', () => {
    expect(sessionLink('gym', 'sim-uma-03', 'speed', [{ kind: 'single', target: 'speed-01' }, { kind: 'single', target: 'speed-02' }], '/farm'))
      .toBe('/training/gym?session=sim-uma-03&room=speed&unlocks=single%3Aspeed-01%2Csingle%3Aspeed-02&back=%2Ffarm')
    expect(sessionLink('dojo', 'sim-uma-03', null, [], null)).toBe('/training/dojo?session=sim-uma-03')
  })
})

describe("Couldn't repeat's fixes (02 §4, §5)", () => {
  it('turns every skip into its fixes at the stock now: make, pick another, pick cards, queue stopped, suggestion', () => {
    const { made, collected, repeated } = checkedIn('stopped')
    const summary = summaryOf(repeated.state, made.env, made.at, 0, null, collected.receipt, repeated.receipt)
    const settled = workView(repeated.state, made.at, made.env).settled
    const skips = skipViews(sectionOf(summary, 'couldnt-repeat')!, settled, made.at, 0, '/farm')
    const kinds = new Set(skips.flatMap((skip) => skip.fixes.map((fix) => fix.kind)))
    expect([...kinds].sort()).toEqual(['pick-another', 'pick-cards', 'queue-stopped', 'suggestion'])
    const cards = skips.flatMap((skip) => skip.fixes).find((fix) => fix.kind === 'pick-cards')
    expect(cards).toMatchObject({ to: expect.stringMatching(/^\/training\/dojo\?session=sim-uma-\d+(&room=[\w-]+)?&back=%2Ffarm$/) })
    const another = skips.flatMap((skip) => skip.fixes).find((fix) => fix.kind === 'pick-another')
    expect(another).toMatchObject({ to: expect.stringMatching(/^\/(farm|training)\/[\w-]+$/) })
  })

  it("prices a buy fix at buyFor's prices and finds Make them's Uma with makeThem", () => {
    const { state: account, at, env } = farmAccount(2)
    // Her last craft found no Carrot: Repeat skips her with a buy and a make.
    let state = apply(withFarmLevel(account, uma(2), 3), 'dev-grant', { items: { carrot: 1 }, prizeMoney: 500 }, at).state
    state = apply(state, 'start', { outfitId: uma(1), slot: { building: 'pantry', slot: 0 }, request: { kind: 'craft', item: 'chopped-carrot', count: 1 } }, at).state
    const later = at + HOUR
    const collected = collectAll(state, {}, later, env)
    const repeated = repeat(collected.state, { utcOffsetMin: 0 }, later, env)
    const summary = summaryOf(repeated.state, env, later, 0, null, collected.receipt, repeated.receipt)
    const settled = workView(repeated.state, later, env).settled
    const [skip] = skipViews(sectionOf(summary, 'couldnt-repeat')!, settled, later, 0, '/farm')
    expect(skip!.words).toEqual({ text: 'Short {n} {item}.', data: { n: 1, item: 'carrot' } })
    expect(skip!.fixes.map((fix) => fix.kind)).toEqual(['buy', 'make', 'pick-another'])
    expect(skip!.fixes[0]).toMatchObject({ kind: 'buy', n: 1, items: '1 Carrot', lines: [{ sku: 'carrot', qty: 1 }] })
    expect(skip!.fixes[1]).toMatchObject({ kind: 'make', place: 'Vegetable Garden', n: 1, suggestion: { outfitId: uma(2), request: { kind: 'gather', item: 'carrot', count: 1 } } })
  })
})

describe('Speed up all and Best use (02 §4)', () => {
  it("offers 1 h, 2 h and the next check-in, each with speedUpAllPlan's count, and the refusal when tickets run short", () => {
    const made = seed('stopped')
    const options = speedOptions(made.state, made.env, made.at, 0)
    expect(options.map((option) => option.label)).toEqual(['1 h', '2 h', 'to 22:30'])
    for (const option of options) {
      const plan = speedUpAllPlan(made.state, { all: true, span: option.span, utcOffsetMin: 0 }, made.at, made.env)
      expect(option.tickets).toBe(plan.entries.reduce((sum, entry) => sum + entry.tickets, 0))
    }
    expect(options.map((option) => option.refusal === null)).toEqual([true, true, false])
    expect(options[2]).toMatchObject({ short: true, refusal: { text: 'Needs {n} Speed Tickets.', data: { n: options[2]!.tickets } } })
  })

  it('lists up to three running entries that unblock the targets most', () => {
    const made = seed('busy')
    const lines = bestUseLines(workView(made.state, made.at, made.env), context(made.env))
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.length).toBeLessThanOrEqual(3)
    expect(lines[0]!.words).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+: [\w ]+ · [^→]+ → \d\d:\d\d$/)
  })
})

describe("size chips (02 §3's check-in-fits table, cell by cell)", () => {
  const doc = readFileSync(fileURLToPath(new URL('../../../../../docs/rework/02-check-ins-and-notifications.md', import.meta.url)), 'utf8')
  const block = doc.slice(doc.indexOf('<!-- live:check-in-fits -->'), doc.indexOf('<!-- /live -->', doc.indexOf('<!-- live:check-in-fits -->')))
  const rows = block.split('\n').filter((line) => /^\| (Gather|Craft|Cook|Session) \(/.test(line))

  it('renders each cell as the marked chips from base-minute items, queued behind a ×10 from its end', () => {
    expect(rows).toHaveLength(4)
    for (const row of rows) {
      const [label, ...cells] = row.split('|').slice(1, -1).map((cell) => cell.trim())
      const minutes = Number(/\(([\d.]+) min each\)/.exec(label!)![1])
      const seconds = Array.from({ length: 10 }, () => minutes * 60)
      DEFAULT_CHECK_INS.forEach((from, i) => {
        const sizes: number[] = []
        let start = from * MINUTE
        let end = start
        do {
          const view = sizeChipsView(start, seconds, 10, DEFAULT_CHECK_INS, 0)
          sizes.push(view.marked)
          const marked = view.chips[view.marked - 1]!
          end = marked.endsAt
          start = end
        } while (sizes.at(-1) === 10 && sizes.length <= 3)
        const chain = sizes.length === 1 ? `×${sizes[0]}` : sizes.length === 2 ? `×${sizes[0]} then ×${sizes[1]} queued` : `${sizes.map((n) => `×${n}`).join(', ')} queued`
        const at = new Date(end).toISOString().slice(11, 16)
        expect(`${chain}, ends ${at}`, `${label} from ${i}`).toBe(cells[i])
      })
    }
  })

  it('marks Fits 13:00 in the morning, Overnight after 22:30, and fits the one after when ×1 overruns', () => {
    const gather = Array.from({ length: 10 }, () => 90 * 60)
    expect(sizeChipsView(9 * HOUR, gather, 10, DEFAULT_CHECK_INS, 0).fit).toBe('Fits 13:00')
    expect(sizeChipsView(23 * HOUR, gather, 10, DEFAULT_CHECK_INS, 0).fit).toBe('Overnight')
    const cook = Array.from({ length: 10 }, () => 240 * 60)
    const late = sizeChipsView(12 * HOUR, cook, 10, DEFAULT_CHECK_INS, 0)
    expect(late.fit).toBe('Fits 22:30')
    expect(late.chips[0]!.words).toBe('ends 16:00 · then free until 22:30')
  })
})

describe('plain words (02 §9)', () => {
  it('no template of the summary, its fixes or the stopped card holds a banned word, filled or not', () => {
    for (const [key, text] of Object.entries(SUMMARY_WORDS)) expect(hasBannedWord(text), key).toBe(false)
    for (const [key, text] of Object.entries(WORK_WORDS)) expect(hasBannedWord(text), key).toBe(false)
    const filled = Object.values(SUMMARY_WORDS).map((text) => text.replace(/\{(\w+)\}/g, (_, key: string) => (key === 'uma' || key === 'name' ? 'Amber Sprint' : key === 'time' || key === 'done' ? '08:02' : '3')))
    for (const text of filled) expect(hasBannedWord(text), text).toBe(false)
  })

  it('words a suggestion without a code or an id', () => {
    const { made, collected } = checkedIn('busy')
    const summary = summaryOf(collected.state, made.env, made.at, 0, null, collected.receipt, null)
    for (const { suggestion } of sectionOf(summary, 'free')!.umas) {
      if (suggestion !== null) expect(hasBannedWord(suggestionWords(suggestion, 0).replace(/\d+/g, '3')), suggestionWords(suggestion, 0)).toBe(false)
    }
  })
})

describe('the stopped seed (T142)', () => {
  it("drops three queues by its clock, and seedAt moves a seed's clock within its own day", async () => {
    const { seedAt } = await import('../../dev/seed')
    const made = seed('stopped')
    const settled = workView(made.state, made.at, made.env).settled
    expect(Object.values(settled.work).filter((row) => row.dropped !== null).map((row) => row.outfitId).sort()).toEqual(['sim-uma-02', 'sim-uma-20', 'sim-uma-23'])
    expect(new Date(seedAt(made, '09:00').at).toISOString().slice(11, 16)).toBe('09:00')
    expect(seedAt(made, '09:00').at - made.at).toBe(-(4 * HOUR + 5 * MINUTE))
    expect(seedAt(made, '25:00')).toBe(made)
    expect(seedAt(made, null)).toBe(made)
  })
})
