// The Card Library's view model (06 §2, §6, §10): a tier-1 scenario-1 Uma and synthetic cards of eras 1–5 give pills from
// `bondStatus` and `bondGrade`, the lens follows her, the card page's pay and bond cost lines for tiers 1–3, who is
// bonded where, and the Bond picker's rows, reasons and the Dojo session URL.
import { bondGrade, cardPay } from '@racer/domain/training'
import { hasBannedWord } from '@racer/domain/check-in'
import { describe, expect, it } from 'vitest'
import { account, umaIds } from '../../__fixtures__/testing-ops'
import { cardName as cardNameById } from '../../ui/words'
import {
  bondChoice, bondCosts, bondedTo, bondSessionPath, buildLibrary, cardName, cookPath, eraLabel, lensMode, lensOf, payWords, pendingBond, pillFor,
  PLAYABLE, raceBonusWords, umaLens,
} from './model'

const card = (acc: ReturnType<typeof account>, id: string) => acc.env.content.cards.get(id)!

describe('the lens and the pill (06 §6)', () => {
  it('follows her scenario, and shows her bond state: a grade on eras 1 and older, a lock past her scenario', () => {
    const acc = account('fresh')
    acc.run('unlock-uma', { outfitId: 'sim-uma-01' })
    const uma = acc.state.umas['sim-uma-01']!
    expect(umaLens(uma)).toBe(1)
    const album = buildLibrary(acc.state, acc.env.content, 7, uma, [])
    expect(album.lens).toBe(1)
    for (const era of [1, 2, 3, 4, 5]) {
      const pill = album.entries.get(`sim-card-speed-e${era}`)!.pill
      if (era === 1) expect(pill).toEqual({ kind: 'grade', grade: bondGrade(1, 1) })
      else expect(pill).toEqual({ kind: 'locked', words: `Opens in scenario ${era} · ${eraLabel(era).split(' · ')[1]}` })
    }
    // The grades a tier asks: 1, 3, 5, 7, 9 for eras 1–5 (06 §2).
    expect([1, 2, 3, 4, 5].map((era) => bondGrade(era, 1))).toEqual([1, 3, 5, 7, 9])
    expect(album.rows.find((row) => row.id === 'sim-card-wit-e1')!.facets['bondable']).toBe(true)
    expect(album.rows.find((row) => row.id === 'sim-card-wit-e2')!.facets['bondable']).toBe(false)
  })

  it('shows a bond mark once bonded, in session while her work holds the bond, and Umas bonded with no Uma chosen', () => {
    const acc = account('fresh')
    for (const id of umaIds(2)) acc.run('unlock-uma', { outfitId: id })
    acc.run('dev-grant', { items: { 'dish-sweets-1': 2 } })
    acc.run('start', { outfitId: 'sim-uma-01', slot: { building: 'dojo', room: 'speed', slot: 0 }, request: { kind: 'session', unlocks: [{ kind: 'bond', target: 'sim-card-speed-e1' }] } })
    const speed = card(acc, 'sim-card-speed-e1')
    expect(pillFor(acc.state, acc.state.umas['sim-uma-01']!, speed)).toEqual({ kind: 'pending' })
    expect(pendingBond(acc.state, speed, acc.at, 0)).toEqual([{ umaId: 'sim-uma-01', words: expect.stringMatching(/^In session · bonds \d\d:\d\d$/) }])
    const end = acc.state.work['sim-uma-01']!.entries[0]!
    const finished = end.startedAt + end.seconds[0]! * 1000
    acc.run('collect', { outfitId: 'sim-uma-01' }, finished)
    expect(pillFor(acc.state, acc.state.umas['sim-uma-01']!, speed)).toEqual({ kind: 'bonded' })
    expect(pillFor(acc.state, null, speed)).toEqual({ kind: 'count', n: 1 })
    expect(pillFor(acc.state, null, card(acc, 'sim-card-wit-e1'))).toEqual({ kind: 'none' })
  })

  it('keeps the lens as the album mode: All or a playable scenario (14 until the 15th ships)', () => {
    expect(PLAYABLE).toHaveLength(14)
    expect([lensMode('all'), lensMode(5)]).toEqual(['all', 's5'])
    expect([lensOf('s5'), lensOf('s15'), lensOf(null), lensOf('nonsense')]).toEqual([5, 'all', 'all', 'all'])
  })
})

describe('the card page (06 §6)', () => {
  it('names a card with its title in brackets, and by name alone when it has no title', () => {
    expect(cardName({ charName: 'Synthetic Support', title: 'Profile Notes' })).toBe('Synthetic Support [Profile Notes]')
    expect(cardName({ charName: 'Synthetic Support', title: '' })).toBe('Synthetic Support')
    expect(cardName({ charName: 'Synthetic Support', title: '  ' })).toBe('Synthetic Support')
    const acc = account('fresh')
    const untitled = { ...card(acc, 'sim-card-speed-e1'), title: '' }
    const content = { ...acc.env.content, cards: new Map([[untitled.id, untitled]]) }
    // Every screen that names a card by id says the same.
    expect(cardNameById(content, untitled.id)).toBe(untitled.charName)
  })

  it('says what it pays: the split per node, SP for Friend and Group, and the full Race Bonus', () => {
    const acc = account('fresh')
    const speed = cardPay(card(acc, 'sim-card-speed-e1'), 1)
    expect(payWords(speed)).toBe(`Speed +${Math.round(speed.perNode.speed)} · Power +${Math.round(speed.perNode.power)} a node`)
    const friend = cardPay(card(acc, 'sim-card-friend-e1'), 1)
    expect(payWords(friend)).toBe(`+${Math.round(friend.spPerNode)} SP a node`)
    expect(raceBonusWords(0.049)).toBe('+4.9% Racing EXP')
  })

  it('costs a bond its family dish at the grade of its era, per tier, in real time (× k), equal tiers joined', () => {
    const acc = account('fresh')
    expect(bondCosts(card(acc, 'sim-card-wit-e3'))).toEqual([
      { tiers: 'Tier 1', dish: 'Ginger Curry', time: '4 h 48 m' },
      { tiers: 'Tiers 2–3', dish: 'Basil Curry', time: '3 h 36 m' },
    ])
    expect(bondCosts(card(acc, 'sim-card-friend-e7'))).toEqual([
      { tiers: 'Tier 1', dish: null, time: null },
      { tiers: 'Tier 2', dish: 'Barley Bread', time: '4 h 12 m' },
      { tiers: 'Tier 3', dish: 'Wheat Bread', time: '3 h 36 m' },
    ])
    expect(bondCosts(card(acc, 'sim-card-speed-e1'))).toEqual([{ tiers: 'Tiers 1–3', dish: 'Honeycomb Cake', time: '3 h 36 m' }])
  })

  it('names who is bonded, her tier and scenario, the presets and nodes holding it, and who could bond it now', () => {
    const acc = account('busy')
    const bonded = Object.values(acc.state.umas).find((uma) => uma.build.bonds.length > 0)
    const cardId = bonded?.build.bonds[0] ?? 'sim-card-speed-e1'
    const who = bondedTo(acc.state, card(acc, cardId))
    if (bonded !== undefined) expect(who.bonded.map((row) => row.umaId)).toContain(bonded.outfitId)
    expect(who.bonded.every((row) => /^T\d · /.test(row.at))).toBe(true)
    expect(who.could.length + who.bonded.length).toBeLessThanOrEqual(Object.keys(acc.state.umas).length)
  })
})

describe('Bond (06 §6, §10)', () => {
  it("offers each Uma's dish, stock and time; refuses one bonded or past the era; and goes on to T139's Dojo session", () => {
    const acc = account('fresh')
    for (const id of umaIds(3)) acc.run('unlock-uma', { outfitId: id })
    acc.run('dev-grant', { items: { 'dish-sweets-1': 1 } })
    const speed = card(acc, 'sim-card-speed-e1')
    const free = bondChoice(acc.state, acc.state.umas['sim-uma-01']!, speed, acc.at, acc.env, 0)
    expect(free).toMatchObject({ reason: null, dishId: 'dish-sweets-1', stock: 1, line: 'Honeycomb Cake · 1 in Warehouse · 3 h 36 m', canQueue: false })
    const later = bondChoice(acc.state, acc.state.umas['sim-uma-01']!, card(acc, 'sim-card-speed-e3'), acc.at, acc.env, 0)
    expect(later.reason).toBe('Opens in scenario 3 · Trackblazer')
    // Busy in the Speed room: "Busy until …", with Queue there.
    acc.run('start', { outfitId: 'sim-uma-02', slot: { building: 'dojo', room: 'speed', slot: 0 }, request: { kind: 'session', unlocks: [{ kind: 'bond', target: 'sim-card-speed-e1' }] } })
    const busy = bondChoice(acc.state, acc.state.umas['sim-uma-02']!, card(acc, 'sim-card-speed-e1'), acc.at, acc.env, 0)
    expect(busy.reason).toBe('Already bonding')
    acc.run('dev-grant', { items: { 'dish-sweets-1': 1 } })
    const other = bondChoice(acc.state, acc.state.umas['sim-uma-02']!, { ...speed, id: 'sim-card-power-e1', type: 'power' }, acc.at, acc.env, 0)
    expect(other.reason).toMatch(/^Busy until \d\d:\d\d$/)
    expect(other.canQueue).toBe(false)
    const sameRoom = bondChoice(acc.state, acc.state.umas['sim-uma-02']!, { ...speed, id: 'sim-card-speed-e1b' }, acc.at, acc.env, 0)
    expect(sameRoom.canQueue).toBe(true)
    // No dish: "0 in Warehouse", and Cook opens the Kitchen's job sheet.
    expect(bondChoice(acc.state, acc.state.umas['sim-uma-03']!, card(acc, 'sim-card-wit-e1'), acc.at, acc.env, 0).line).toBe('Basil Curry · 0 in Warehouse · 3 h 36 m')
    const back = '/town/card-library/card/sim-card-speed-e1'
    expect(bondSessionPath('sim-uma-01', speed, back)).toBe(`/training/dojo?session=sim-uma-01&room=speed&unlocks=bond%3Asim-card-speed-e1&back=${encodeURIComponent(back)}`)
    expect(cookPath('dish-herbs-spices-1', back)).toBe(`/farm/kitchen?job=dish-herbs-spices-1&back=${encodeURIComponent(back)}`)
    for (const text of ['Already bonded', 'Already bonding', free.line!]) expect(hasBannedWord(text), text).toBe(false)
  })
})
