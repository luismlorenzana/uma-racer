// The Racing places' view models (T141 "Tests"): the strip's order, the purse bar in each band and across the 4,500
// edge, the featured board and its counter, the pre-race prize per band, the result's lines (featured, tired, spent,
// Shard, hold), Next Uma, the Advance sheet's "after" against the operation's, the Map's placeholder rows, the
// leaving flair (Graduate, Promoted), and 02 §9's banned words over every template. Synthetic seeds only.
import { hasBannedWord, OPERATIONS } from '@racer/domain/check-in'
import { PURSE_BANDS, WIN_PRIZE, type RacePrize } from '@racer/domain/economy'
import { canStartExpedition } from '@racer/domain/tiers'
import { isRefusal, type UmaState } from '@racer/domain/state'
import { describe, expect, it } from 'vitest'
import { seed } from '../../__fixtures__/testing'
import { devRaceContent } from './content'
import { completionDeck, leaveFlair } from './flair'
import { advanceSheet, mapRows, promoteSheet } from './gate'
import {
  expLine, featuredView, finishLines, holdLine, localDayAt, nextUma, prizeLines, prizePreview, purseBar, stripOrder,
} from './view'
import { RACING_WORDS } from './words'

const busy = () => seed('busy')
const day = () => localDayAt(busy().at, busy().utcOffsetMin)
const name = (umaId: string) => busy().env.content.umas.get(umaId)?.name ?? umaId
const purse = (gross: number) => ({ day: day(), gross, featuredPaid: [] as string[] })
const prize = (over: Partial<RacePrize>): RacePrize => ({ gross: 300, paid: 300, band: 'full', dayGross: 300, expedition: false, featuredBonus: 0, ...over })

describe('the purse bar (09 §3.5)', () => {
  const [full, tired] = PURSE_BANDS
  it('reads each band in its own words, the numbers from the rules', () => {
    expect(purseBar(purse(3_450), day()).words).toBe(`Today's purse · 3,450 of ${full!.upTo!.toLocaleString('en-US')} at full prize`)
    expect(purseBar(purse(6_420), day()).words).toBe(`Tired purse · a quarter until ${tired!.upTo!.toLocaleString('en-US')}`)
    expect(purseBar(purse(13_100), day()).words).toBe('Spent purse · a twentieth until midnight')
  })

  it('holds 4,500 itself full and tips one past it into tired', () => {
    expect(purseBar(purse(full!.upTo!), day())).toMatchObject({ band: 'full', fill: 1 })
    expect(purseBar(purse(full!.upTo! + 1), day()).band).toBe('tired')
  })

  it('reads a later day as an empty purse, and explains the bands in two lines', () => {
    const bar = purseBar({ day: '2000-01-01', gross: 13_100, featuredPaid: [] }, day())
    expect(bar).toMatchObject({ band: 'full', fill: 0 })
    expect(bar.about).toEqual([
      "The day's first 4,500 of prizes pay in full, then a quarter to 12,000, then a twentieth.",
      'Featured bonuses and Racing EXP are never reduced. The purse starts again at midnight.',
    ])
  })
})

describe('the pre-race prize at the current band (09 §3.5)', () => {
  it('reads a full win, a tired one and a spent one', () => {
    expect(prizePreview(purse(0), day(), 'g1')).toBe(`G1 win · ${WIN_PRIZE.g1}`)
    expect(prizePreview(purse(6_420), day(), 'g1')).toBe('G1 win · 75, tired purse')
    expect(prizePreview(purse(13_100), day(), 'g1')).toBe('G1 win · 15, spent purse')
  })
})

describe("today's featured (09 §4)", () => {
  it('draws the same board on every device, ribbons each open bonus, and counts what is still open', () => {
    const content = devRaceContent(busy().env)
    const profile = { purse: purse(0) }
    const view = featuredView(profile, day(), content.races.items)
    expect(view).toEqual(featuredView(profile, day(), content.races.items))
    expect(view.cards.map((card) => card.race.grade)).toEqual(['g1', expect.stringMatching(/^g[23]$/)])
    expect(view.open).toBe(view.cards.length)
    const paid = featuredView({ purse: { ...purse(0), featuredPaid: [view.board[0]!] } }, day(), content.races.items)
    expect(paid.cards[0]).toMatchObject({ paid: true, bonus: WIN_PRIZE.g1 })
    expect(paid.open).toBe(view.open - 1)
  })
})

describe('the Uma strip (11 §9.2)', () => {
  it('leads with open goals, then lifetime level, then name; finished careers last; work in one chip', () => {
    const state = busy().state
    const umas = Object.values(state.umas)
    const done: UmaState = { ...umas[3]!, racing: { level: 9, exp: 0 }, career: { ...umas[3]!.career, goals: umas[3]!.career.goals.map((goal) => ({ ...goal, status: 'completed' as const })) } }
    const high: UmaState = { ...umas[7]!, racing: { level: 8, exp: 0 } }
    const strip = stripOrder({ ...state, umas: { ...state.umas, [done.outfitId]: done, [high.outfitId]: high } }, name, busy().at, busy().utcOffsetMin)
    expect(strip[0]!.umaId).toBe(high.outfitId)
    expect(strip.at(-1)!.umaId).toBe(done.outfitId)
    expect(strip.at(-1)!.open).toBe(false)
    const rest = strip.slice(1, -1)
    expect(rest.map((tile) => tile.name)).toEqual([...rest.map((tile) => tile.name)].sort((a, b) => a.localeCompare(b)))
    expect(strip.filter((tile) => tile.work !== null).every((tile) => /^.+ · (\d\d:\d\d|Ready)$/.test(tile.work!))).toBe(true)
    expect(strip.some((tile) => tile.work !== null)).toBe(true)
  })

  it('offers the next Uma after hers, round to the first', () => {
    const strip = stripOrder(busy().state, name, busy().at, busy().utcOffsetMin)
    expect(nextUma(strip, strip[0]!.umaId)).toBe(strip[1]!.umaId)
    expect(nextUma(strip, strip.at(-1)!.umaId)).toBe(strip[0]!.umaId)
  })
})

describe('the result (09 §7)', () => {
  it('names Race Bonus on Racing EXP, and a place without it', () => {
    expect(expLine({ expGained: 180 }, 'g1', 1, 0.2)).toBe('+180 · G1 win ×1.2')
    expect(expLine({ expGained: 45 }, 'g1', 2, 0.2)).toBe('+45 · G1 2nd ×1.2')
    expect(expLine({ expGained: 150 }, 'g1', 1, 0)).toBe('+150 · G1 win')
  })

  it('shows only the Prize Money lines that applied', () => {
    expect(prizeLines(prize({}), 'g1', 1)).toEqual({ total: 300, main: '+300 · 1st in a G1', lines: [] })
    expect(prizeLines(prize({ featuredBonus: 300 }), 'g1', 1)).toEqual({ total: 600, main: '+300 · 1st in a G1', lines: ['Featured bonus +300'] })
    expect(prizeLines(prize({ paid: 75, band: 'tired', dayGross: 6_420 }), 'g1', 1).lines).toEqual(['Tired purse: paid a quarter (6,420 of 12,000)'])
    expect(prizeLines(prize({ paid: 15, band: 'spent', dayGross: 13_100 }), 'g1', 1).lines).toEqual(['Spent purse: paid a twentieth (13,100 today)'])
    expect(prizeLines(prize({ gross: 120, paid: 120, dayGross: 120 }), 'g1', 2).main).toBe('+120 · 2nd in a G1')
  })

  it("says the gate's Shard and a level-up from the receipt, and the hold from her as she stands", () => {
    const finish = { umaId: 'x', completedGoalIds: [], expGained: 150, levelsGained: [10], reachedGate: 10, shardsPaid: 1 }
    const lines = finishLines({ finish, raceBonus: 0 } as never, 'g1', 1)
    expect(lines).toMatchObject({ levels: ['Racing Lv 10!'], shard: 'Gate reached · +1 Uma Shard' })
    expect(finishLines({ finish: { ...finish, shardsPaid: 0 }, raceBonus: 0 } as never, 'g1', 1).shard).toBeNull()
    const uma = Object.values(busy().state.umas)[0]!
    expect(holdLine({ ...uma, racing: { level: 2, exp: 99 } })).toBe('Held at Lv 2 · win the Maiden')
    expect(holdLine({ ...uma, racing: { level: 1, exp: 0 } })).toBeNull()
  })
})

describe('the Advance sheet (03 §5)', () => {
  it("is the operation's own after, run on a copy: the move, the level, the presets, the layer and the career", () => {
    const gate = seed('gate')
    const umaId = Object.values(gate.state.umas).find((uma) => uma.racing.level === 10)!.outfitId
    const sheet = advanceSheet(gate.state, umaId, gate.env, gate.at, (id) => id)!
    const applied = OPERATIONS['advance-scenario'](gate.state, { umaId }, gate.at, gate.env)
    if (isRefusal(applied)) throw new Error(applied.code)
    expect(sheet.after).toEqual(applied.state.umas[umaId])
    expect([sheet.from.T, sheet.to.T, sheet.levelFrom, sheet.levelTo]).toEqual([1, 2, 10, 11])
    expect(sheet.presets).toHaveLength(4)
    expect(sheet.layer).toEqual(['4 constellation nodes', '2 Inspiration slots', '4 Inspiration golds', '10 Extra Stats nodes', '3 bonds'])
    expect(sheet.unfinished[0]).toMatch(/^Layer 1: \d+ of 27\. The rest stay open\.$/)
    expect(sheet.career).toHaveLength(6)
    expect(sheet.buff.name).toBe('Team Spirit')
    expect(advanceSheet(gate.state, 'sim-uma-01', gate.env, gate.at, (id) => id)).toBeNull()
  })
})

describe('leaving a scenario (04 §9)', () => {
  it('earns Graduate at the advance and Promoted · Tier 2 at the promotion, from her completion facts', () => {
    const promote = seed('promote')
    const content = devRaceContent(promote.env)
    const umaId = Object.values(promote.state.umas).find((uma) => uma.expedition.runs.some((run) => run.completed) && Object.keys(promote.state.work).every((id) => id !== uma.outfitId || (promote.state.work[id]!.entries.length === 0)))!.outfitId
    const sheet = promoteSheet(promote.state, umaId, [], content.races.byId)!
    expect(sheet).toMatchObject({ from: 1, to: 2, ticket: 1, ready: true, free: true, expeditionWins: 8 })
    const input = { umaId, presets: Object.fromEntries((['sprint', 'mile', 'medium', 'long'] as const).map((d) => [d, { stats: { speed: 1, stamina: 1, power: 1, guts: 1, wit: 1 }, skillPoints: 0 }])) }
    const done = OPERATIONS.promote(promote.state, input as never, promote.at, promote.env)
    if (isRefusal(done)) throw new Error(done.code)
    const change = leaveFlair({ state: done.state, records: promote.records ?? { raceResults: {}, badges: {}, flairEvents: {} }, content, env: promote.env, now: promote.at },
      promote.state.umas[umaId]!, done.state.umas[umaId]!, 'promote-op-0001')
    const keys = change.events.map((event) => event.data.awardKey)
    expect(keys).toEqual(expect.arrayContaining(['badge:promoted:2', 'badge:scenario:5:graduate']))
    expect(keys.some((key) => key.startsWith('trainer:promotions'))).toBe(true)
  })
})

describe("a completion's deck (Era Loyalist over every race's set)", () => {
  it('keeps six cards and the verdict: any card of another era stays in', () => {
    const era = (id: string) => Number(id.slice(1))
    expect(completionDeck(['e2', 'e2', 'e2'].map((id, i) => `${id}${i}`), (id) => Number(id[1]), 2)).toHaveLength(3)
    const many = ['a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h1']
    const kept = completionDeck(many, (id) => era(id.slice(0)), 2)
    expect(kept).toHaveLength(6)
    expect(kept).toContain('h1')
    expect(completionDeck(many.slice(0, 7), (id) => era(id), 2).every((id) => era(id) === 2)).toBe(true)
  })
})

describe('the Expedition Map, a placeholder (10 "Entry")', () => {
  it("lists each Uma's distance to entry; one who could start is ready; one with a completed run opens Promote", () => {
    const promote = seed('promote')
    const rows = mapRows(promote.state, name, promote.env)
    expect(rows.filter((row) => row.complete)).toHaveLength(2)
    expect(rows.find((row) => !row.complete)!.distance).toMatch(/^Scenario \d · Racing Lv \d+$/)
    const ready = Object.values(promote.state.umas).find((uma) => uma.expedition.runs.length > 0)!
    const waiting: UmaState = { ...ready, expedition: { runs: [] } }
    expect(canStartExpedition(waiting)).toBe(true)
    expect(mapRows({ umas: { [waiting.outfitId]: waiting } }, name, promote.env)[0]).toMatchObject({ ready: true, complete: false })
  })
})

describe("02 §9's plain words", () => {
  it('holds every template of the Racing page free of banned words and bare numbers', () => {
    for (const [key, text] of Object.entries(RACING_WORDS)) expect(hasBannedWord(text), `${key}: ${text}`).toBe(false)
  })
})

