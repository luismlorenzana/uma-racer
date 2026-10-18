// The Stable's view model (docs/game/11-hub-and-places.md §3.1, §5; 04 §6; 03 §2, §12; D181) on synthetic accounts
// moved by the rules' own operations: counts, the default order, the tier filter, "T2 · Lv 13", Ready from the
// readiness rules, when Exchange shows, the roster line, and what an Uma is doing for a job, a session and Free.
import { advanceReadiness, lifetimeLevel } from '@racer/domain/tiers'
import { isRefusal } from '@racer/domain/state'
import { describe, expect, it } from 'vitest'
import { account, umaIds } from '../../__fixtures__/testing-ops'
import {
  buildStableAlbum, doingOf, doingWords, levelLabel, openingTab, profileLine, queryStable, readyUmas, rosterLine, skillsView, STABLE_DEFAULT_QUERY,
  ticketNote, unlockBlocked,
} from './model'

const MINUTE = 60_000

describe('the album', () => {
  it('holds every outfit in the content, Owned and Locked, and opens on Locked while nothing is owned (11 §2.4)', () => {
    const fresh = account('fresh')
    const album = buildStableAlbum(fresh.state, fresh.env.content, [])
    expect(album.owned).toBe(0)
    expect(album.locked).toBe(fresh.env.content.umas.size)
    expect(openingTab(null, album.owned)).toBe('locked')
    for (const id of umaIds(3)) fresh.run('unlock-uma', { outfitId: id })
    const three = buildStableAlbum(fresh.state, fresh.env.content, [])
    expect([three.owned, three.locked]).toEqual([3, fresh.env.content.umas.size - 3])
    expect(openingTab(null, three.owned)).toBe('owned')
    expect(openingTab('locked', three.owned)).toBe('locked')
  })

  it('orders Owned by lifetime level highest first, then newest release, then name (D181)', () => {
    const acc = account('fresh')
    for (const id of umaIds(4)) acc.run('unlock-uma', { outfitId: id })
    // Two Umas at their gates (Racing Lv 10) and one promoted to tier 2 lead; ties fall to the name.
    acc.run('dev-grant', { gate: 'sim-uma-03' })
    acc.run('dev-grant', { gate: 'sim-uma-04' })
    const promoted = { ...acc.state.umas['sim-uma-02']!, tier: 2 as const, racing: { level: 3, exp: 0 } }
    acc.state = { ...acc.state, umas: { ...acc.state.umas, 'sim-uma-02': promoted } }
    const { entries } = queryStable(buildStableAlbum(acc.state, acc.env.content, []), 'owned', STABLE_DEFAULT_QUERY)
    expect(entries.map((entry) => entry.id)).toEqual(['sim-uma-02', 'sim-uma-03', 'sim-uma-04', 'sim-uma-01'])
    expect(entries.map((entry) => entry.lifetime)).toEqual([lifetimeLevel(2, 3), 10, 10, 1])
    // The tile reads her tier and Racing Level, never the lifetime number.
    expect(entries.map((entry) => entry.level)).toEqual(['T2 · Lv 3', 'T1 · Lv 10', 'T1 · Lv 10', 'T1 · Lv 1'])
    expect(levelLabel({ tier: 2, racing: { level: 13, exp: 0 } })).toBe('T2 · Lv 13')
    const tierTwo = queryStable(buildStableAlbum(acc.state, acc.env.content, []), 'owned', { ...STABLE_DEFAULT_QUERY, filters: { tier: ['2'] } })
    expect(tierTwo.entries.map((entry) => entry.id)).toEqual(['sim-uma-02'])
  })

  it('marks Ready from advanceReadiness and promotionReadiness, the targets, NEW until seen, and the Hall of Fame', () => {
    const acc = account('fresh')
    for (const id of umaIds(3)) acc.run('unlock-uma', { outfitId: id })
    acc.run('dev-grant', { gate: 'sim-uma-01' })
    acc.run('set-targets', { outfitIds: ['sim-uma-02'] })
    const inducted = { ...acc.state.umas['sim-uma-03']!, hallOfFame: { inductedAt: acc.at } }
    acc.state = { ...acc.state, umas: { ...acc.state.umas, 'sim-uma-03': inducted } }
    const album = buildStableAlbum(acc.state, acc.env.content, ['sim-uma-02'])
    const entry = (id: string) => album.entries.get(id)!
    expect(isRefusal(advanceReadiness(acc.state.umas['sim-uma-01']!))).toBe(false)
    expect(entry('sim-uma-01').ready).toBe('advance')
    expect(entry('sim-uma-02').ready).toBeNull()
    expect(entry('sim-uma-02').target).toBe(true)
    expect([entry('sim-uma-01').isNew, entry('sim-uma-02').isNew]).toEqual([true, false])
    expect(entry('sim-uma-03').hallOfFame).toBe(true)
    expect(entry('sim-uma-04').owned).toBe(false)
    expect(readyUmas(acc.state, acc.env.content).map(({ uma, ready }) => [uma.outfitId, ready])).toEqual([['sim-uma-01', 'advance']])
  })
})

describe('Uma Tickets and Shards (04 §6)', () => {
  it('reads "2 · 3/5", holds the Shards at 5/5, and shows Exchange only from five Shards', () => {
    const profile = account('fresh').state.profile
    expect(ticketNote({ ...profile, umaTickets: 2, umaShards: 3 })).toMatchObject({ text: '2 · 3/5', canExchange: false })
    expect(ticketNote({ ...profile, umaTickets: 0, umaShards: 7 })).toMatchObject({ text: '0 · 5/5', canExchange: true })
  })

  it("says why Unlock is off with no ticket, in no-ticket's words, with the Shards line", () => {
    const profile = account('fresh').state.profile
    expect(unlockBlocked(profile, 'Amber Sprint')).toBeNull()
    expect(unlockBlocked({ ...profile, umaTickets: 0, umaShards: 3 }, 'Amber Sprint')).toEqual({
      reason: 'You need an Uma Ticket to unlock Amber Sprint.', shards: 'Uma Shards 3/5',
    })
  })
})

describe('the roster and an Uma at a glance', () => {
  it('reads "3 Umas · T1 2 · T2 1" and the profile line of 03 §12', () => {
    const acc = account('fresh')
    for (const id of umaIds(3)) acc.run('unlock-uma', { outfitId: id })
    expect(profileLine(acc.state.umas['sim-uma-01']!)).toBe('T1 · URA Finale · Racing Lv 1 · Farm Lv 1')
    const promoted = { ...acc.state.umas['sim-uma-02']!, tier: 2 as const }
    expect(rosterLine({ umas: { ...acc.state.umas, 'sim-uma-02': promoted } })).toBe('3 Umas · T1 2 · T2 1')
    expect(rosterLine({ umas: {} })).toBe('0 Umas')
  })

  it("says what she's doing: a job's place, count and time left, a session's, Ready, or Free (11 §5, D366)", () => {
    const acc = account('fresh')
    for (const id of umaIds(2)) acc.run('unlock-uma', { outfitId: id })
    acc.run('dev-grant', { items: { 'tonic-1': 2 } })
    expect(doingWords(doingOf(acc.state, 'sim-uma-01', acc.at), acc.at)).toBe('Free')
    const job = acc.run('start', { outfitId: 'sim-uma-01', slot: { building: 'vegetable-garden', slot: 0 }, request: { kind: 'gather', item: 'carrot', count: 4 } })
    const session = acc.run('start', {
      outfitId: 'sim-uma-02', slot: { building: 'observatory', slot: 0 }, request: { kind: 'session', unlocks: [{ kind: 'node', target: 'n1' }, { kind: 'node', target: 'n2' }] },
    })
    const gather = 162 * MINUTE
    const later = acc.at + 2 * gather + MINUTE
    // Two of four Carrots made, a minute past the second: the last two have 5h 23m left.
    expect(doingWords(doingOf(acc.state, 'sim-uma-01', later), later)).toBe('Vegetable Garden · 2 of 4 · 5h 23m')
    expect(job.endsAt - later).toBe(2 * gather - MINUTE)
    // Two nodes of 5h 24m each.
    expect(doingWords(doingOf(acc.state, 'sim-uma-02', acc.at), acc.at)).toBe(`Observatory · 0 of 2 · 10h 48m`)
    expect(session.endsAt - acc.at).toBe(2 * 324 * MINUTE)
    expect(doingWords(doingOf(acc.state, 'sim-uma-01', job.endsAt), job.endsAt)).toBe('Vegetable Garden · Ready')
  })
})

describe('the Skills tab (03 §6)', () => {
  it("lists her unique first, the rest of her library with what each adds, and prices the loadout against her SP", () => {
    const acc = account('busy')
    const uma = acc.state.umas['sim-uma-08']!
    const view = skillsView(uma, uma.raceDefaults.selectedPreset, acc.env.content)
    expect(view.equipped[0]).toMatchObject({ unique: true, name: "Harbor Light's Finale" })
    expect(view.cost).toBe(0)
    expect(view.skillPoints).toBeGreaterThan(160)
    const white = view.library.find((skill) => !skill.gold)!
    expect(white.adds).toBe(160)
    acc.run('set-loadout', { umaId: uma.outfitId, preset: uma.raceDefaults.selectedPreset, skillIds: [white.skillId] })
    const after = skillsView(acc.state.umas['sim-uma-08']!, uma.raceDefaults.selectedPreset, acc.env.content)
    expect(after.cost).toBe(160)
    expect(after.equipped.map((skill) => skill.skillId)).toEqual([view.equipped[0]!.skillId, white.skillId])
  })
})
