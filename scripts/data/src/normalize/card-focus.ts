// Authored card-focus corrections onto the cards pack, and the private review report (docs/game/06-cards-and-bonds.md §5,
// D201). The override lives in the gitignored content/overrides/card-focus.json; nothing here is checked-in content.

import {
  cardFocus,
  cardSkills,
  derivedCardFocus,
  parseCardFocusOverride,
  skillRestrictions,
  type CardFocus,
  type SkillTemplate,
  type SupportCardTemplate,
} from '@racer/domain'

export interface CardFocusResult {
  items: SupportCardTemplate[]
  warnings: string[]
  /** Aggregate counts only: how many cards each focus value covers, and how many the override corrected. */
  coverage: {
    style: Record<string, number>
    distance: Record<string, number>
    both: number
    neither: number
    overridden: number
  }
}

/**
 * Validates the whole override (known card ids, known values, a note on every entry) before writing any `focus` field,
 * so a typo stops the import instead of shipping a silently wrong tag.
 */
export function applyCardFocusOverride(
  cards: readonly SupportCardTemplate[],
  skills: readonly SkillTemplate[],
  raw: unknown | null,
): CardFocusResult {
  const warnings: string[] = []
  const overrides = new Map<string, ReturnType<typeof parseCardFocusOverride>>()
  if (raw === null) {
    warnings.push('Card focus override is missing; every card uses its derived focus')
  } else {
    if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Card focus override must map card ids to entries')
    const known = new Set(cards.map((card) => card.id))
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!known.has(id)) throw new Error(`Card focus override names an unknown card: ${id}`)
      const entry = parseCardFocusOverride(value)
      if (!entry) throw new Error(`Card focus override for ${id} needs a known style or distance and a note`)
      overrides.set(id, entry)
    }
  }

  const skillsById = new Map(skills.map((skill) => [skill.id, skill]))
  const items = cards.map((card): SupportCardTemplate => {
    const entry = overrides.get(card.id)
    if (!entry) {
      const { focus: _stale, ...rest } = card
      return rest
    }
    return {
      ...card,
      focus: { ...(entry.style ? { style: entry.style } : {}), ...(entry.distance ? { distance: entry.distance } : {}) },
    }
  })

  const style: Record<string, number> = {}
  const distance: Record<string, number> = {}
  let both = 0
  let neither = 0
  for (const card of items) {
    const focus = cardFocus(card, skillsById)
    style[focus.style] = (style[focus.style] ?? 0) + 1
    distance[focus.distance] = (distance[focus.distance] ?? 0) + 1
    if (focus.style !== 'generalist' && focus.distance !== 'generalist') both += 1
    if (focus.style === 'generalist' && focus.distance === 'generalist') neither += 1
  }
  return { items, warnings, coverage: { style, distance, both, neither, overridden: overrides.size } }
}

const STYLE_NAMES: Record<number, string> = { 1: 'Front', 2: 'Pace', 3: 'Late', 4: 'End' }
const DISTANCE_NAMES: Record<number, string> = { 1: 'Sprint', 2: 'Mile', 3: 'Medium', 4: 'Long' }

/**
 * A private Markdown review of every card's derived and final focus, with each skill's restriction, for Claude's override
 * pass (D201). It names cards and skills, so it is written only under the gitignored content/review/.
 */
export function cardFocusReport(cards: readonly SupportCardTemplate[], skills: readonly SkillTemplate[]): string {
  const skillsById = new Map(skills.map((skill) => [skill.id, skill]))
  const lines = ['# Card focus review (private)', '', '| Card | Type | Derived | Final | Skills (style/distance restriction; G = gold) |', '|---|---|---|---|---|']
  const label = (focus: CardFocus) => `${focus.style} · ${focus.distance}`
  for (const card of [...cards].sort((left, right) => left.id.localeCompare(right.id))) {
    const golds = new Set(card.eventSkillIds)
    const skillCells = cardSkills(card, skillsById).map((skill) => {
      const tags = [
        skillRestrictions(skill, 'running_style').map((code) => STYLE_NAMES[code]).join('+'),
        skillRestrictions(skill, 'distance_type').map((code) => DISTANCE_NAMES[code]).join('+'),
      ].filter(Boolean).join('/')
      return `${golds.has(skill.id) && skill.kind === 'gold' ? 'G ' : ''}${skill.name}${tags ? ` [${tags}]` : ''}`
    })
    lines.push(`| ${card.id} ${card.charName} | ${card.type} | ${label(derivedCardFocus(card, skillsById))} | ${label(cardFocus(card, skillsById))} | ${skillCells.join('; ')} |`)
  }
  return `${lines.join('\n')}\n`
}
