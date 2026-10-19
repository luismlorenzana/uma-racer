// Synthetic content and accounts for the Training Hub's tests (packages/domain/src/training): every card, skill
// and Uma is invented. Sessions run on T127's real work engine (`work`), with the `session` kind registered.
import { CARD_EFFECTS, type CardEffect } from '../cards'
import type { SkillKind, SkillTemplate, SupportCardTemplate, SupportCardType, UmaTemplate } from '../content'
import type { FacilityId, RoomId } from '../farm/buildings'
import { newAccount, unlockUma } from '../tiers/roster'
import type { TrainingContent } from '../training/derive'
import { isRefusal, type ReworkState } from '../state/types'
import type { WorkEnv } from '../work/kinds'
import { newWorkState } from '../work/state'
import type { SlotRef, WorkState } from '../work/types'
import { CONTENT as TIER_CONTENT, COLT, SPRINTER, DIRT_PARENT_A, DIRT_PARENT_B, DIRT_PARENT_C, template } from './tiers'

// ---- Skills ----------------------------------------------------------------------------------------------------------

/** A skill the race engine supports (a Speed boost from phase 2), with its SP cost. */
export const skill = (id: string, kind: SkillKind, extra: Partial<SkillTemplate> = {}): SkillTemplate => ({
  id, kind, name: id, description: '', costSp: kind === 'unique' ? null : 200, iconId: null,
  conditions: [{ precondition: null, condition: 'phase>=2', baseTime: 24000, cooldown: null, effects: [{ type: 31, value: 2000 }] }],
  inheritedSkillId: null, normalSkillId: null, ...extra,
})

// ---- Umas ------------------------------------------------------------------------------------------------------------

/** A parent with two whites and two golds in awakening order, and a unique with an inherited form. */
function parent(id: string, extra: Partial<UmaTemplate> = {}): UmaTemplate {
  return template(id, COLT.aptitudes, { awakeningSkillIds: [`w1-${id}`, `g1-${id}`, `w2-${id}`, `g2-${id}`], uniqueSkillId: `u-${id}`, ...extra })
}
export const MOM = parent('mom')
export const DAD = parent('dad')
export const GRAN = parent('gran')
export const GRAMPS = parent('gramps')
/** A second outfit of Mom's character. */
export const MOM_ALT = parent('mom-alt', { charaId: MOM.charaId })
/** An Uma nobody owns, for Legends. */
export const STRANGER = parent('stranger')
/** A grown Uma: growth on Speed and Stamina, to show growth multiplies card points only. */
export const GROWER = template('grower', COLT.aptitudes, {
  growthRates: { speed: 0.2, stamina: 0.1, power: 0, guts: 0, wit: 0 }, uniqueSkillId: 'u-grower', eventSkillIds: ['expensive'], innateSkillIds: ['no-effect'],
})

const PARENTS = [MOM, DAD, GRAN, GRAMPS, MOM_ALT, STRANGER]
const UMAS: readonly UmaTemplate[] = [COLT, SPRINTER, DIRT_PARENT_A, DIRT_PARENT_B, DIRT_PARENT_C, GROWER, ...PARENTS]

// ---- Cards -----------------------------------------------------------------------------------------------------------

const PROFILE = (raceBonus: number) => Object.fromEntries(CARD_EFFECTS.map((key) => [key, key === 'raceBonus' ? raceBonus : 0])) as Record<CardEffect, number>

/** An invented SSR: its own character, two white hints and one gold event skill. */
export function card(type: SupportCardType, era: number, suffix = '', extra: Partial<SupportCardTemplate> = {}): SupportCardTemplate {
  const id = `${type}-e${era}${suffix}`
  return {
    id, charaId: `chara-${id}`, charName: `Invented ${id}`, title: id, type, jpRelease: '2000-01-01', era, obtain: 'free', starter: true,
    hintSkillIds: [`hint1-${id}`, `hint2-${id}`], eventSkillIds: [`gold-${id}`], effectProfile: PROFILE(1), uniqueEffect: null,
    ...extra,
  }
}

const TYPES: readonly SupportCardType[] = ['speed', 'stamina', 'power', 'guts', 'wit', 'friend', 'group']
/** Every type at every era 1–15, plus a second card of each type at eras 1 and 6, and one sharing a character. */
export const CARDS: readonly SupportCardTemplate[] = [
  ...TYPES.flatMap((type) => Array.from({ length: 15 }, (_, i) => card(type, i + 1))),
  ...TYPES.flatMap((type) => [card(type, 1, 'b'), card(type, 6, 'b')]),
  card('wit', 1, '-twin', { charaId: 'chara-speed-e1' }),
]
export const cardOf = (id: string): SupportCardTemplate => {
  const found = CARDS.find((entry) => entry.id === id)
  if (!found) throw new Error(`No fixture card ${id}`)
  return found
}

/**
 * The representative deck (T132): scenario 1 one card of each of six types, scenarios 2 and 4 a Speed, Stamina and
 * Power card, scenarios 3 and 5 a Guts, Wit and Friend card, each of the scenario's own era in tier 1.
 */
export const DECK: readonly (readonly SupportCardTemplate[])[] = [
  ['speed', 'stamina', 'power', 'guts', 'wit', 'friend'].map((type) => cardOf(`${type}-e1`)),
  ['speed', 'stamina', 'power'].map((type) => cardOf(`${type}-e2`)),
  ['guts', 'wit', 'friend'].map((type) => cardOf(`${type}-e3`)),
  ['speed', 'stamina', 'power'].map((type) => cardOf(`${type}-e4`)),
  ['guts', 'wit', 'friend'].map((type) => cardOf(`${type}-e5`)),
]

const SKILLS: readonly SkillTemplate[] = [
  ...UMAS.flatMap((uma) => [
    ...(uma.uniqueSkillId ? [skill(uma.uniqueSkillId, 'unique', { inheritedSkillId: `i-${uma.id}` }), skill(`i-${uma.id}`, 'inherited-unique')] : []),
    ...uma.awakeningSkillIds.map((id) => skill(id, id.startsWith('g') ? 'gold' : 'white')),
  ]),
  ...CARDS.flatMap((entry) => [...entry.hintSkillIds.map((id) => skill(id, 'white')), skill(entry.eventSkillIds[0]!, 'gold')]),
  skill('expensive', 'white', { costSp: 5000 }),
  skill('no-effect', 'white', { conditions: [{ precondition: null, condition: 'phase>=2', baseTime: 24000, cooldown: null, effects: [{ type: 31, value: 2000, target: 2 }] }] }),
]

export const TRAINING_CONTENT: TrainingContent = {
  umas: new Map(UMAS.map((uma) => [uma.id, uma])),
  cards: new Map(CARDS.map((entry) => [entry.id, entry])),
  skills: new Map(SKILLS.map((entry) => [entry.id, entry])),
}

/** T125's tier content with every Uma, card and skill above, so careers, lineage, bonds and work read one catalogue. */
export const TIER_AND_TRAINING = { ...TIER_CONTENT, ...TRAINING_CONTENT }

// ---- Accounts on the work engine ------------------------------------------------------------------------------------

/** What the training rules, the work engine and the tier rules read, in one: every Uma, card, skill and race above. */
export const ENV: WorkEnv = { content: TIER_AND_TRAINING }

/** An account on T127's engine: these Umas unlocked, every building at Lv 1, and this Warehouse. */
export function workAccount(outfitIds: readonly string[], items: Readonly<Record<string, number>> = {}): WorkState {
  let state: ReworkState = newAccount(0)
  for (const outfitId of outfitIds) {
    const result = unlockUma(state, { outfitId }, 1, { content: TIER_AND_TRAINING })
    if (isRefusal(result)) throw new Error(result.reason)
    state = result.state
  }
  const work = newWorkState(state)
  return { ...work, items: { ...work.items, ...items } }
}

/** A facility's first slot: `{ building, room?, slot: 0 }`. */
export const slotAt = (building: FacilityId, room?: RoomId): SlotRef => (room === undefined ? { building, slot: 0 } : { building, room, slot: 0 })
