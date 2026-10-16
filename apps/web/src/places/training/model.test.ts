// The Training places' view models (docs/game/05-training-hub.md §3, §6, §7, §8; docs/game/06-cards-and-bonds.md
// §3; docs/game/11-hub-and-places.md §3.2; T139) on synthetic accounts built with the rework's own operations: slots by
// level and room, a session card's words and times, the Counter, Needs here, the session sheet's list, statuses, pre-pick
// and Start, each build view's states, and every template against 02 §9's banned words.
import { clockTime, durationText, fitSize, hasBannedWord } from '@racer/domain/check-in'
import { hubView } from '@racer/domain/hub'
import { nextUnlocks, sessionRequest, sessionSeconds, TRAINING_REFUSALS } from '@racer/domain/training'
import { workAhead } from '@racer/domain/planner'
import { speedAt, type WorkState } from '@racer/domain/work'
import { craftedItem } from '@racer/domain/items'
import { describe, expect, it } from 'vitest'
import { TRAINING_WORDS } from './words'
import { observatoryView, nodeChoices } from './observatory/model'
import { extraView } from './gym/model'
import { lineageView } from './lineage-hall/model'
import { dojoView, receiptLine, setWith } from './dojo/model'
import { currentUnlock, facilityView, unlockLine } from './facility/model'
import { prePick, sessionView, type SessionInput } from './session/model'
import { parseUnlocks, readSessionQuery } from './session/query'
import { deriveUmaPreset } from '@racer/domain/training'
import { slotCards } from '../../ui/work/model'
import {
  advanced, apply, CONTEXT, content, DEV_ENV, granted, trainingAccount, uma, viewAt, withLayers, withSetCard,
} from './__fixtures__/training'

const AT = trainingAccount(0).at

/** A tier-1, scenario-2 Uma with layer 1 done (05 §3). */
function scenarioTwo(): WorkState {
  const { state } = trainingAccount(2)
  return withLayers(advanced(state, uma(1), AT), uma(1), [1])
}

const sheet = (state: WorkState, input: Partial<SessionInput> & Pick<SessionInput, 'facility'>, now = AT) =>
  sessionView(viewAt(state, now), { umaId: uma(1), room: null, picks: null, query: { unlocks: [], slot: null }, ...input }, CONTEXT, content)

describe('facility pages (05 §7, §8)', () => {
  it('read their slots by level and room: the Observatory 2 at Lv 1 and 3 at Lv 2, the Gym ten in five rooms at Lv 2', () => {
    const { state } = trainingAccount(1)
    expect(facilityView(viewAt(state, AT), 'observatory', CONTEXT)).toMatchObject({ level: 1, slots: 2, used: 0, speed: 1 })
    const paid = granted(state, AT, { [craftedItem('vegetables', 1).id]: 4 }, 1_200)
    const up = apply(paid, 'upgrade', { building: 'observatory' }, AT).state
    expect(facilityView(viewAt(up, AT), 'observatory', CONTEXT).slots).toBe(3)
    const gym = facilityView(viewAt({ ...state, buildings: { ...state.buildings, gym: { level: 2 } } }, AT), 'gym', CONTEXT)
    expect(gym.slots).toBe(10)
    expect(gym.rooms.map((room) => [room.name, room.cards.length])).toEqual([['Stamina', 2], ['Wit', 2], ['Power', 2], ['Speed', 2], ['Guts', 2]])
    expect(facilityView(viewAt(state, AT), 'dojo', CONTEXT).rooms.map((room) => room.room)).toEqual(['speed', 'stamina', 'power', 'guts', 'wit', 'friend-group'])
  })

  it("names a three-node session's current unlock and its dish, with its finish times from sessionSeconds", () => {
    const { state } = trainingAccount(1)
    const stocked = granted(state, AT, { 'dish-vegetables-1': 3 })
    const unlocks = nextUnlocks(stocked.umas[uma(1)]!.build, stocked.umas[uma(1)]!, 'observatory', null, 3)
    const started = apply(stocked, 'start', { outfitId: uma(1), slot: { building: 'observatory', slot: 0 }, request: sessionRequest(unlocks) }, AT).state
    const [card] = slotCards(started, 'observatory', AT)
    if (card?.kind !== 'held') throw new Error('held')
    const one = sessionSeconds(1) * 1000
    expect(card).toMatchObject({ made: 0, count: 3, nextAt: AT + one, endsAt: AT + 3 * one })
    const current = currentUnlock(started.work[uma(1)], card)!
    expect(unlockLine(current.ref, current.dishId, content)).toBe('Node 1 · Carrot Salad')
    expect(clockTime(card.endsAt, 0)).toBe(clockTime(AT + 3 * one, 0))
    expect(started.items['dish-vegetables-1'] ?? 0).toBe(0)
    // Two finishes later the card names node 3, 2 of 3 made.
    const later = AT + 2 * one + 60_000
    const [after] = slotCards(started, 'observatory', later)
    if (after?.kind !== 'held') throw new Error('held')
    expect(after.made).toBe(2)
    expect(unlockLine(currentUnlock(started.work[uma(1)], after)!.ref, 'dish-vegetables-1', content)).toBe('Node 3 · Carrot Salad')
  })

  it("counts the Umas whose session here is Ready, as the hub's Counter does", () => {
    const { state } = trainingAccount(2)
    const stocked = granted(state, AT, { 'dish-vegetables-1': 2 })
    let next = stocked
    for (const [i, id] of [uma(1), uma(2)].entries()) {
      const her = next.umas[id]!
      next = apply(next, 'start', { outfitId: id, slot: { building: 'observatory', slot: i }, request: sessionRequest(nextUnlocks(her.build, her, 'observatory', null, 1)) }, AT).state
    }
    const later = AT + sessionSeconds(1) * 1000 + 1
    const model = facilityView(viewAt(next, later), 'observatory', CONTEXT)
    expect(model.ready).toBe(2)
    expect(hubView(next, later, DEV_ENV).counts['observatory']).toBe(2)
  })

  it('writes Needs here in 02 §6\'s words, with Start when she can and the Kitchen for a short dish', () => {
    const { state } = trainingAccount(1)
    const stocked = granted(state, AT, { 'dish-vegetables-1': 2 })
    const [line] = facilityView(viewAt(stocked, AT), 'observatory', CONTEXT).lines
    expect(line!.words).toBe(`${CONTEXT.umaName(uma(1))} · 12 nodes · 2 in stock, 10 short`)
    expect(line!.start).toBe(`/training/observatory?session=${uma(1)}&back=%2Ftraining%2Fobservatory`)
    expect(line!.cook!.to).toBe('/farm/kitchen?job=dish-vegetables-1&back=%2Ftraining%2Fobservatory')
    const dojo = facilityView(viewAt(stocked, AT), 'dojo', CONTEXT).lines
    expect(dojo.map((entry) => entry.words)).toEqual([`${CONTEXT.umaName(uma(1))} · 6 bonds: pick cards`])
  })
})

describe('the session sheet (05 §8)', () => {
  it('reads its query: an in-app back, this facility\'s unlocks only, a room of its own, Queue and the slot', () => {
    const query = readSessionQuery(new URLSearchParams('session=sim-uma-01&room=power&unlocks=single:power-03,node:n1,bond:x&back=/training/gym/sim-uma-01&queue=1&slot=1'), 'gym')
    expect(query).toEqual({ uma: 'sim-uma-01', room: 'power', unlocks: [{ kind: 'single', target: 'power-03' }], back: '/training/gym/sim-uma-01', queue: true, slot: 1 })
    expect(readSessionQuery(new URLSearchParams('session=&back=https://example.test'), 'observatory')).toMatchObject({ uma: null, back: null, room: null })
    expect(readSessionQuery(new URLSearchParams(''), 'dojo')).toBeNull()
    expect(parseUnlocks('gold:parent0:gold1,node:n99', 'lineage-hall')).toEqual([{ kind: 'gold', target: 'parent0:gold1' }])
  })

  it('lists n13–n16 with their dishes and n17 locked for a scenario-2 Uma, and picking n13 frees n14', () => {
    const state = granted(scenarioTwo(), AT, { 'dish-vegetables-3': 2, 'dish-vegetables-4': 2 })
    const view = sheet(state, { facility: 'observatory', picks: [] })
    const rows = view.items.map((item) => [item.ref.target, item.dishId, item.state])
    expect(rows.slice(0, 5)).toEqual([
      ['n13', 'dish-vegetables-3', 'available'],
      ['n14', 'dish-vegetables-3', 'waiting'],
      ['n15', 'dish-vegetables-4', 'waiting'],
      ['n16', 'dish-vegetables-4', 'waiting'],
      ['n17', 'dish-vegetables-5', 'later'],
    ])
    expect(view.items[1]!.words).toBe('Needs node 13 first.')
    expect(view.items[4]!.words).toBe('Opens in scenario 3 · Trackblazer')
    const picked = sheet(state, { facility: 'observatory', picks: [{ kind: 'node', target: 'n13' }] })
    expect(picked.items.map((item) => item.state).slice(0, 3)).toEqual(['available', 'available', 'waiting'])
    expect(picked.items[0]!.picked).toBe(true)
    expect(picked.items[1]).toMatchObject({ stock: 1, pickable: true, picked: false })
  })

  it("lists the Power room: Power grade 3, then its Duos and the Spring Feast's Sun, each needing what comes first", () => {
    const state = scenarioTwo()
    const view = sheet(state, { facility: 'gym', room: 'power', picks: [] })
    const now = view.items.filter((item) => item.state !== 'later')
    expect(now.map((item) => [item.name, item.state])).toEqual([
      ['Power grade 3', 'available'],
      ['Wit–Power Duo grade 3', 'waiting'],
      ['Power–Speed Duo grade 3', 'waiting'],
      ['Spring Feast Sun', 'waiting'],
    ])
    for (const item of now.slice(1)) expect(item.words).toMatch(/^Needs .+ first\.$/)
    expect(view.items.filter((item) => item.state === 'later').every((item) => item.words === 'Opens in scenario 3 · Trackblazer')).toBe(true)
  })

  it('pre-picks fitSize of the next items, capped by stock; with no dish in stock, Start is off and says why', () => {
    const { state } = trainingAccount(1)
    const stocked = granted(state, AT, { 'dish-vegetables-1': 6, 'dish-vegetables-2': 4 })
    const her = stocked.umas[uma(1)]!
    const chain = nextUnlocks(her.build, her, 'observatory', null, 10)
    const fit = fitSize(AT, chain.map((entry) => sessionSeconds(entry.grade, speedAt(stocked, 'observatory'))), stocked.profile.checkIns, 0)
    const view = sheet(stocked, { facility: 'observatory' })
    expect(view.picks.length).toBe(fit)
    expect(prePick(viewAt(stocked, AT), her, 'observatory', null, AT, 0)).toHaveLength(fit)
    expect(view.action).toMatchObject({ mode: 'start', refusal: null })
    expect(view.confirm.dishes).toEqual([{ item: 'dish-vegetables-1', qty: fit }])

    const empty = sheet(state, { facility: 'observatory' })
    expect(empty.picks).toEqual([])
    expect(empty.items[0]).toMatchObject({ state: 'available', stock: 0, pickable: false })
    expect(empty.action).toEqual({ mode: 'blocked', words: 'Pick an unlock.' })
    // A named unlock arrives picked even with no dish, and Start then reads the shortfall in the rule's words.
    const named = sheet(state, { facility: 'observatory', query: { unlocks: [{ kind: 'node', target: 'n1' }], slot: null } })
    expect(named.action).toMatchObject({ mode: 'start', refusal: { text: 'Short {n} {item}.', data: { n: 1, item: 'dish-vegetables-1' } } })
  })

  it('takes the slot card\'s slot, else the first free one, and says when the next frees; a busy Uma here queues', () => {
    const { state } = trainingAccount(3)
    const stocked = granted(state, AT, { 'dish-vegetables-1': 6 })
    const asked = sheet(stocked, { facility: 'observatory', query: { unlocks: [], slot: 1 } })
    expect(asked.action.mode === 'start' && asked.action.input.slot).toEqual({ building: 'observatory', slot: 1 })
    let full = stocked
    for (const [i, id] of [uma(2), uma(3)].entries()) {
      const her = full.umas[id]!
      full = apply(full, 'start', { outfitId: id, slot: { building: 'observatory', slot: i }, request: sessionRequest(nextUnlocks(her.build, her, 'observatory', null, 1)) }, AT).state
    }
    const blocked = sheet(full, { facility: 'observatory' })
    expect(blocked.action).toEqual({ mode: 'blocked', words: `Every slot here is taken. The next one frees in ${durationText(sessionSeconds(1) * 1000)}.` })
    const queued = sessionView(viewAt(full, AT), { facility: 'observatory', umaId: uma(2), room: null, picks: null, query: { unlocks: [], slot: null } }, CONTEXT, content)
    expect(queued.mode).toBe('queue')
    expect(queued.start).toBe(AT + sessionSeconds(1) * 1000)
    expect(queued.items[0]).toMatchObject({ state: 'pending', words: `In session · opens in ${durationText(sessionSeconds(1) * 1000)}` })
    expect(workAhead(full.work[uma(2)])).toHaveLength(1)
  })

  it("lists the Dojo's picked bonds with each card's own dish, and refuses a card past her scenario in its words", () => {
    const { state } = trainingAccount(1)
    const view = sheet(state, { facility: 'dojo', room: 'speed', query: { unlocks: [{ kind: 'bond', target: 'sim-card-speed-e1' }, { kind: 'bond', target: 'sim-card-speed-e3' }], slot: null } })
    expect(view.items.map((item) => [item.dishId, item.state, item.picked])).toEqual([
      ['dish-sweets-1', 'available', true],
      ['dish-sweets-5', 'later', false],
    ])
    expect(view.items[1]!.words).toBe('Opens in scenario 3 · Trackblazer')
  })
})

describe('build views (05 §4–§6, §8; 06 §3)', () => {
  it("reads each tree node's state, the next node's dish and stock, and its Unlock", () => {
    const { state } = trainingAccount(1)
    const stocked = granted(state, AT, { 'dish-vegetables-1': 3 })
    const opened = stocked
    const her = opened.umas[uma(1)]!
    const two = nextUnlocks(her.build, her, 'observatory', null, 2)
    const started = apply(opened, 'start', { outfitId: uma(1), slot: { building: 'observatory', slot: 0 }, request: sessionRequest(two) }, AT).state
    const at = AT + sessionSeconds(1) * 1000 + 1
    const now = viewAt(started, at).settled
    const me = now.umas[uma(1)]!
    const preset = me.raceDefaults.selectedPreset
    const view = observatoryView(now, me, preset, deriveUmaPreset(me, preset, content), at, CONTEXT, content)!
    const byId = new Map(view.nodes.map((node) => [node.id, node]))
    expect(byId.get('n1')).toMatchObject({ state: 'finished', words: 'Finished · Collect' })
    expect(byId.get('n2')).toMatchObject({ state: 'session', words: `In session · opens in ${durationText(AT + 2 * sessionSeconds(1) * 1000 - at)}` })
    expect(byId.get('n3')).toMatchObject({ state: 'available', words: 'Needs: Carrot Salad (grade 1) at the Observatory · 1 in stock' })
    expect(byId.get('n3')!.unlock).not.toBeNull()
    expect(byId.get('n4')).toMatchObject({ state: 'waiting', words: 'Opens after node 3' })
    expect(byId.get('n13')).toMatchObject({ state: 'later', words: 'Opens in scenario 2 · Unity Cup', x: null })
    expect(view.nodes.filter((node) => node.x !== null)).toHaveLength(12)
  })

  it("shows an open node's card and what it pays, and refuses a card over its cap in words", () => {
    const { state } = trainingAccount(1)
    const preset = state.umas[uma(1)]!.raceDefaults.selectedPreset
    const { state: withCard, cardId } = withSetCard(withLayers(state, uma(1), [1]), uma(1), 'speed', 1, preset, AT)
    const me = withCard.umas[uma(1)]!
    const derived = deriveUmaPreset(me, preset, content)
    const view = observatoryView(withCard, me, preset, derived, AT, CONTEXT, content)!
    const n1 = view.nodes.find((node) => node.id === 'n1')!
    expect(n1).toMatchObject({ state: 'open', cardId: null })
    // The set's card already holds its cap after the fill? Assign it to its cap, then a fourth node is refused.
    const capped = apply(withCard, 'set-assignments', { umaId: uma(1), preset, assignments: { n1: cardId, n2: cardId, n3: cardId } }, AT).state
    const choices = nodeChoices(capped, capped.umas[uma(1)]!, preset, 'n4', AT, CONTEXT, content)
    expect(choices.map((choice) => choice.cardId)).toEqual([cardId, null])
    expect(choices[0]!.refusal).toBe(`${content.cards.get(cardId)!.charName} [${content.cards.get(cardId)!.title}] already holds 3 nodes, its most.`)
    const paid = observatoryView(capped, capped.umas[uma(1)]!, preset, deriveUmaPreset(capped.umas[uma(1)]!, preset, content), AT, CONTEXT, content)!
    expect(paid.nodes.find((node) => node.id === 'n1')!.skills).toEqual([`sim-gold-${cardId}`, `sim-hint1-${cardId}`])
  })

  it("draws 05 §6's 37 Extra Stats cells by column and the capacity line", () => {
    const state = scenarioTwo()
    const me = state.umas[uma(1)]!
    const preset = me.raceDefaults.selectedPreset
    const view = extraView(state, me, preset, deriveUmaPreset(me, preset, content), AT, CONTEXT, content)
    expect(view.cells).toHaveLength(37)
    expect(view.layers.map((layer) => [layer.singles.length, layer.duos.length, layer.sun?.id ?? null])).toEqual([
      [5, 0, null], [5, 4, 'sun-4'], [5, 4, 'sun-6'], [5, 0, 'sun-8'], [5, 0, 'sun-10'],
    ])
    expect(view.layers[0]!.singles.map((cell) => [cell.column, cell.value, cell.state])).toEqual([
      [0, '+40', 'open'], [1, '+40', 'open'], [2, '+40', 'open'], [3, '+40', 'open'], [4, '+40', 'open'],
    ])
    expect(view.layers[1]!.duos.map((cell) => [cell.name, cell.column, cell.value])).toEqual([
      ['Stamina–Wit Duo grade 3', 0.5, '+20 ×2'], ['Wit–Power Duo grade 3', 1.5, '+20 ×2'], ['Power–Speed Duo grade 3', 2.5, '+20 ×2'], ['Speed–Guts Duo grade 3', 3.5, '+20 ×2'],
    ])
    expect(view.layers[1]!.sun).toMatchObject({ column: 5, value: '+8 ×5', state: 'waiting' })
    expect(view.layers[1]!.title).toBe('Scenario 2 · grades 3–4')
    expect([view.on, view.capacity]).toEqual([5, 9])
    expect(TRAINING_WORDS.capacity).toBe('{on} of {capacity} on')
    // Over capacity is the rule's own refusal.
    expect(TRAINING_REFUSALS['over-capacity']).toBe('Only {capacity} Extra Stats can be on at once.')
  })

  it('reads lineage slots locked, open and filled, and warns when a gold position pays nothing', () => {
    const { state } = trainingAccount(3)
    const opened = withLayers(state, uma(1), [1])
    const preset = opened.umas[uma(1)]!.raceDefaults.selectedPreset
    const filled = apply(opened, 'set-lineage', { umaId: uma(1), preset, lineage: { parent0: uma(2) } }, AT).state
    const me = filled.umas[uma(1)]!
    const slots = lineageView(filled, me, preset, AT, CONTEXT, content)
    expect(slots.map((slot) => [slot.letter, slot.item.state, slot.filler])).toEqual([
      ['A', 'open', uma(2)], ['B', 'open', null], ['A1', 'later', null], ['A2', 'later', null], ['B1', 'later', null], ['B2', 'later', null],
    ])
    expect(slots[0]!.golds.map((gold) => [gold.index, gold.item.state, gold.skill !== null, gold.warning])).toEqual([[0, 'later', true, null], [1, 'later', true, null]])
    expect(slots[2]!.item.words).toBe('Opens in scenario 2 · Unity Cup')
    // Her filler with one natural gold: gold 2 warns (05 §3).
    const oneGold = { ...content, umas: new Map(content.umas).set(uma(2), { ...content.umas.get(uma(2))!, awakeningSkillIds: [`sim-w1-${uma(2)}`, `sim-g1-${uma(2)}`] }) }
    const warned = lineageView(filled, me, preset, AT, CONTEXT, oneGold)
    expect(warned[0]!.golds[1]!.warning).toBe('This parent has one natural gold; gold 2 pays nothing until a parent with two fills slot A.')
    expect(warned[0]!.golds[0]!.warning).toBeNull()
  })

  it("shows the card set's six slots, the bonds line, and the set's refusals and hand-over in words", () => {
    const { state } = trainingAccount(1)
    const preset = state.umas[uma(1)]!.raceDefaults.selectedPreset
    const { state: one, cardId } = withSetCard(state, uma(1), 'speed', 1, preset, AT)
    const me = one.umas[uma(1)]!
    const view = dojoView(me, preset, content)
    expect(view.line).toBe('1 bond this tier · 1 of 6 by scenario 1')
    expect(view.set).toHaveLength(6)
    expect(view.set[0]).toMatchObject({ cardId, older: false })
    expect(view.set.slice(1).every((slot) => slot.cardId === null)).toBe(true)
    // An unbonded card is refused in the rule's words, with names for ids.
    expect(() => apply(one, 'set-card-set', { umaId: uma(1), preset, cardSetIds: setWith(me.build.presets[preset].cardSetIds, 1, 'sim-card-wit-e1') }, AT)).toThrow(/isn't bonded/)
    expect(receiptLine({ handedOver: { [cardId]: 'sim-card-wit-e1' }, emptied: ['n5', 'n6'] }, content))
      .toBe(`${content.cards.get('sim-card-wit-e1')!.charName} [${content.cards.get('sim-card-wit-e1')!.title}] took ${content.cards.get(cardId)!.charName} [${content.cards.get(cardId)!.title}]'s nodes. 2 nodes emptied.`)
    // An older card's era falls behind in scenario 2: dimmed, "Newer cards available" (06 §3).
    const later = advanced(one, uma(1), AT)
    expect(dojoView(later.umas[uma(1)]!, preset, content).set[0]!.older).toBe(true)
  })
})

describe('copy', () => {
  it('holds no banned word in any template (02 §9)', () => {
    for (const [key, text] of Object.entries(TRAINING_WORDS)) expect(hasBannedWord(text), `${key}: ${text}`).toBe(false)
  })
})
