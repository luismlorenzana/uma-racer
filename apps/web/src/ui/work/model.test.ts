// The shared work pieces' models (docs/rework/07-farm.md §2, §6, §8, §10; docs/rework/09-racing-rewards-and-exchange.md
// §5.1; docs/rework/02-check-ins-and-notifications.md §3, §9; T140): slot cards follow `totalSlots` at every level; 07
// §2's Potato job reads "3 / 10 made" with its times from `itemEnds` and `endsAt`; SpeedUpControls' four states; a
// Recall's preview equals the receipt `recall` gives; queue chips' ends and warnings; the size chips in `sizeChips`'
// words; and every template passes 02 §9's banned words.
import { chipWords, fill, fitWords, hasBannedWord, sizeChips } from '@racer/domain/rework/check-in'
import { FARM_BUILDING_IDS, farmItemSeconds, totalSlots, type BuildingLevel } from '@racer/domain/rework/farm'
import { endsAt, itemEnds, recall, type WorkState } from '@racer/domain/rework/work'
import { describe, expect, it } from 'vitest'
import { apply, farmAccount, HOUR, MINUTE, uma, withFarmLevel } from '../../places/farm/__fixtures__/farm'
import { recallLines } from './RecallSheet'
import { speedUpQuestion } from './SpeedUpControls'
import { queueChips, recallPreview, sizeChipsView, slotCards, speedUpModel } from './model'
import { workView } from './view'
import { WORK_WORDS, workWords } from './words'

const at = farmAccount(0).at

describe('slot cards (07 §6, §10)', () => {
  it("follow each building's totalSlots at Lv 1, 2 and 3, all free on a new account", () => {
    const { state } = farmAccount(0)
    for (const building of FARM_BUILDING_IDS) {
      for (const level of [1, 2, 3] as BuildingLevel[]) {
        const leveled: WorkState = { ...state, buildings: { ...state.buildings, [building]: { level } } }
        const cards = slotCards(leveled, building, at)
        expect(cards, `${building} Lv ${level}`).toHaveLength(totalSlots(building, level))
        expect(cards.every((card) => card.kind === 'free')).toBe(true)
        expect(cards.map((card) => card.slot.slot)).toEqual(cards.map((_, i) => i))
      }
    }
    expect(slotCards(state, 'kitchen', at)).toHaveLength(6)
    expect(slotCards({ ...state, buildings: { ...state.buildings, kitchen: { level: 2 } } }, 'kitchen', at)).toHaveLength(8)
  })

  it("reads 07 §2's Potato job: 3 / 10 made, the next output and the end from itemEnds and endsAt", () => {
    const { state, env } = farmAccount(1)
    const started = apply(withFarmLevel(state, uma(1), 7), 'start', {
      outfitId: uma(1), slot: { building: 'vegetable-garden', slot: 0 }, request: { kind: 'gather', item: 'potato', count: 10 },
    }, at).state
    const entry = started.work[uma(1)]!.entries[0]!
    const ends = itemEnds(entry.startedAt, entry.seconds, entry.acceleratedMs)
    expect(entry.seconds[0]).toBe(farmItemSeconds('gather', 2))
    const now = ends[2]! + MINUTE
    const view = workView(started, now, env)
    const [card] = slotCards(view.settled, 'vegetable-garden', now)
    expect(card).toMatchObject({ kind: 'held', outfitId: uma(1), made: 3, count: 10, waiting: 3, running: true, nextAt: ends[3], endsAt: endsAt(entry) })
    expect(workWords('made', { made: 3, count: 10 })).toBe('3 / 10 made')
    expect(slotCards(view.settled, 'vegetable-garden', now).slice(1).every((c) => c.kind === 'free')).toBe(true)
  })
})

describe("SpeedUpControls' four states (07 §8, 09 §5.1)", () => {
  const running = (tickets: number) => {
    const { state } = farmAccount(1)
    const withTickets = tickets > 0 ? apply(state, 'dev-grant', { items: { 'speed-ticket': tickets } }, at).state : state
    return apply(withTickets, 'start', { outfitId: uma(1), slot: { building: 'fields', slot: 0 }, request: { kind: 'gather', item: 'wheat', count: 2 } }, at).state
  }

  it('hidden on an empty slot and a finished entry', () => {
    const { state } = farmAccount(1)
    expect(speedUpModel(state, uma(1), at).state).toBe('hidden')
    expect(speedUpModel(running(5), uma(1), at + 10 * HOUR).state).toBe('hidden')
  })

  it('ready with −30m and Finish · N when she holds N tickets', () => {
    const model = speedUpModel(running(10), uma(1), at)
    expect(model).toMatchObject({ state: 'ready', finish: 8, have: 10, buy: 0 })
    expect(speedUpQuestion(model)).toBeNull()
  })

  it('buy: too few tickets reads "Buy 3 and finish · 90" and asks once; short of money it says why', () => {
    const model = speedUpModel(running(5), uma(1), at)
    expect(model).toMatchObject({ state: 'buy', finish: 8, have: 5, buy: 3, price: 90 })
    expect(workWords('buy-finish', { n: model.buy, price: model.price })).toBe('Buy 3 and finish · 90')
    expect(speedUpQuestion(model)).toBe('Buy 3 Speed Tickets for 90 Prize Money and finish now?')
    expect(model.buyRefusal).toEqual({ text: 'Need {n} more.', data: { n: 90 } })
    const rich = apply(running(5), 'dev-grant', { prizeMoney: 1_000 }, at).state
    expect(speedUpModel(rich, uma(1), at).buyRefusal).toBeNull()
  })

  it('waste: under 30 minutes left it shows the minutes the ticket wastes before it confirms', () => {
    const state = running(2)
    const end = endsAt(state.work[uma(1)]!.entries[0]!)
    const model = speedUpModel(state, uma(1), end - 12 * MINUTE)
    expect(model).toMatchObject({ state: 'waste', finish: 1, wastedMinutes: 18 })
    expect(speedUpQuestion(model)).toBe('18 of the ticket’s 30 minutes go unused. Finish now?')
  })
})

describe('the Recall preview (07 §2, §5)', () => {
  it("equals the receipt recall gives: Cook Carrot Salad × 3, recalled after one and a half salads", () => {
    const { state, env } = farmAccount(1)
    const stocked = apply(state, 'dev-grant', { items: { 'chopped-carrot': 12, 'wheat-flour': 3 } }, at).state
    const cooking = apply(stocked, 'start', { outfitId: uma(1), slot: { building: 'kitchen', slot: 0 }, request: { kind: 'cook', item: 'dish-vegetables-1', count: 3 } }, at).state
    expect(cooking.items).toEqual({})
    const entry = cooking.work[uma(1)]!.entries[0]!
    const now = at + Math.round(entry.seconds[0]! * 1.5) * 1000
    const preview = recallPreview(cooking, uma(1), now, env)
    const { receipt } = recall(cooking, { outfitId: uma(1) }, now, env)
    expect(preview).toEqual({
      outfitId: uma(1), paid: [{ item: 'dish-vegetables-1', qty: 1 }], unlocks: 0, returned: receipt.returned,
      lostMinutes: Math.round(receipt.lostMinutes), droppedQueue: receipt.droppedQueue.length, recalled: true,
    })
    expect(receipt.returned).toEqual([{ item: 'chopped-carrot', qty: 8 }, { item: 'wheat-flour', qty: 2 }])
    expect(recallLines(preview)).toEqual([
      '1 Carrot Salad collected',
      '8 Chopped Carrot and 2 Wheat Flour come back',
      `${Math.round(receipt.lostMinutes)} minutes of progress lost`,
    ])
  })

  it('says nothing is lost when only a finished job waits', () => {
    const { state, env } = farmAccount(1)
    const done = apply(state, 'start', { outfitId: uma(1), slot: { building: 'fields', slot: 0 }, request: { kind: 'gather', item: 'wheat', count: 1 } }, at).state
    expect(recallLines(recallPreview(done, uma(1), at + 5 * HOUR, env))).toEqual(['1 Wheat collected', 'Nothing is lost.'])
  })
})

describe('queue chips (02 §3)', () => {
  it("show each queued entry's projected end, and queueWarnings' mark where the stock won't cover it", () => {
    const { state, env } = farmAccount(1)
    let next = apply(state, 'dev-grant', { items: { wheat: 1 } }, at).state
    next = apply(next, 'start', { outfitId: uma(1), slot: { building: 'pantry', slot: 0 }, request: { kind: 'craft', item: 'wheat-flour', count: 1 } }, at).state
    next = apply(next, 'queue', { outfitId: uma(1), add: { request: { kind: 'craft', item: 'wheat-flour', count: 2 }, building: 'pantry' } }, at).state
    const view = workView(next, at, env)
    const first = next.work[uma(1)]!.entries[0]!
    const chips = queueChips(view.projection, view.warnings, uma(1))
    expect(chips).toHaveLength(1)
    expect(chips[0]).toMatchObject({ index: 0, endsAt: null })
    expect(chips[0]!.warning).toEqual({ text: 'Short {n} {item}.', data: { n: 2, item: 'wheat' } })

    const stocked = apply(next, 'dev-grant', { items: { wheat: 2 } }, at).state
    const covered = workView(stocked, at, env)
    const [chip] = queueChips(covered.projection, covered.warnings, uma(1))
    expect(chip!.warning).toBeNull()
    expect(chip!.endsAt).toBe(endsAt(first) + 2 * farmItemSeconds('craft', 1) * 1000)
  })
})

describe('size chips (02 §3)', () => {
  it("a chip per size the stock covers, each in chipWords' words, the marked one with fitWords", () => {
    const seconds = Array.from({ length: 10 }, () => farmItemSeconds('gather', 1))
    const times = [480, 780, 1350]
    const view = sizeChipsView(at, seconds, 10, times, 0)
    const domain = sizeChips(at, seconds, times, 0)
    expect(view.chips.map((chip) => chip.words)).toEqual(domain.chips.map((chip) => fill(chipWords(chip, 0))))
    expect(view.marked).toBe(domain.marked)
    expect(view.fit).toBe(fill(fitWords(domain, 0)))
    expect(view.fit).toBe('Fits 13:00')
    expect(view.chips[0]!.words).toBe('ends 09:48 · then free until 13:00')
    expect(sizeChipsView(at, seconds, 3, times, 0).chips).toHaveLength(3)
    expect(sizeChipsView(at, seconds, 0, times, 0).chips).toHaveLength(1)
    const night = sizeChipsView(at + 15 * HOUR, seconds, 10, times, 0)
    expect(night.fit).toBe('Overnight')
  })
})

describe('plain words (02 §9)', () => {
  it('no template of the shared pieces holds a banned word', () => {
    for (const [key, text] of Object.entries(WORK_WORDS)) expect(hasBannedWord(text), key).toBe(false)
  })
})
