// Invented skills and card names for the dev seeds (T138): `@racer/domain/sim`'s content has no skill templates and names its
// cards by id, so a profile's Skills tab had nothing to equip and the Card Library nothing to search. Each Uma gets her
// unique and two pairs of awakening skills (a white and a gold, the first pair open from her first scenario, D186), and
// each card two white hints and one gold, all with invented names and the race engine's plain Speed boost, so
// `set-loadout` prices and accepts them. Skills change no stat, so the seeds' rules read exactly as the sim's.
import type { SkillKind, SkillTemplate, SupportCardTemplate, UmaTemplate } from '@racer/domain'
import type { OperationEnv } from '@racer/domain/check-in'

/** Today's white and gold prices, near enough for a dev account (D188's shapes; the numbers are invented). */
const COST: Readonly<Record<SkillKind, number | null>> = { white: 160, gold: 360, unique: null, 'unique-upgraded': null, 'inherited-unique': 180 }

const WORDS = ['Corner', 'Straight', 'Final', 'Early', 'Late', 'Rail', 'Breeze', 'Spark', 'Steady', 'Swift', 'Bold', 'Calm'] as const
const ENDS = ['Glide', 'Push', 'Kick', 'Lead', 'Charge', 'Focus', 'Rhythm', 'Burst'] as const
const NAMES = ['Ada', 'Bea', 'Cleo', 'Dina', 'Eve', 'Fay', 'Gia', 'Hana', 'Iris', 'June', 'Kay', 'Lia', 'Mae', 'Nell', 'Ora'] as const
const TITLES: Readonly<Record<SupportCardTemplate['type'], string>> = {
  speed: 'Swift Start', stamina: 'Long Haul', power: 'Iron Will', guts: 'True Grit', wit: 'Clear Mind', friend: 'Good Company', group: 'Team Spirit',
}
const SURNAMES: Readonly<Record<SupportCardTemplate['type'], string>> = {
  speed: 'Swift', stamina: 'Hale', power: 'Stone', guts: 'Brave', wit: 'Sage', friend: 'Friend', group: 'Crew',
}

let named = 0
const nextName = (): string => `${WORDS[named % WORDS.length]} ${ENDS[Math.floor(named++ / WORDS.length) % ENDS.length]}`

function skill(id: string, kind: SkillKind, name: string): SkillTemplate {
  return {
    id, kind, name, description: `${name}: a burst of speed in the late race.`, costSp: COST[kind], iconId: null,
    conditions: [{ precondition: null, condition: 'phase>=2', baseTime: 24000, cooldown: null, effects: [{ type: 31, value: 2000 }] }],
    inheritedSkillId: null, normalSkillId: null,
  }
}

/** The content with invented skills, each Uma's awakening skills and each card's hints, gold and name. */
export function withSyntheticSkills(content: OperationEnv['content']): OperationEnv['content'] {
  named = 0
  const skills = new Map<string, SkillTemplate>()
  const umas = new Map<string, UmaTemplate>()
  for (const [id, template] of content.umas) {
    if (template.uniqueSkillId !== null) skills.set(template.uniqueSkillId, skill(template.uniqueSkillId, 'unique', `${template.name}'s Finale`))
    const awakening = ['w1', 'g1', 'w2', 'g2'].map((key) => `sim-${key}-${id}`)
    for (const skillId of awakening) skills.set(skillId, skill(skillId, skillId.includes('-g') ? 'gold' : 'white', nextName()))
    umas.set(id, { ...template, awakeningSkillIds: awakening })
  }
  const cards = new Map<string, SupportCardTemplate>()
  for (const [id, card] of content.cards) {
    const hints = [`sim-hint1-${id}`, `sim-hint2-${id}`]
    const gold = `sim-gold-${id}`
    for (const skillId of hints) skills.set(skillId, skill(skillId, 'white', nextName()))
    skills.set(gold, skill(gold, 'gold', nextName()))
    const charName = `${NAMES[(card.era - 1) % NAMES.length]} ${SURNAMES[card.type]}`
    cards.set(id, { ...card, charName, title: TITLES[card.type], hintSkillIds: hints, eventSkillIds: [gold] })
  }
  return { ...content, umas, cards, skills }
}
