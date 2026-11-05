// Skills (docs/game/05-the-build.md, D382; 05 §4): her library is her own skills plus every skill her tracks hinted.
// A hint level cuts a skill's cost, hints for one skill add up to level 5, a gold needs its white, and what a career
// spends is capped at the scenario's SP cap. SP comes from the wallet (stages, races), the tree, the deck's Initial
// SP and the hint rewards. Pure.
import type { SkillTemplate, SupportCardTemplate, UmaTemplate } from '../content'
import { ownSkillIds } from '../derived'
import { compileRaceSkill, raceSkillSupported, skillAimsAtOthers } from '../race-skills'
import { refuse, type Refusal } from '../save/registry'
import type { BondRecord, CareerRecord } from '../save/records'
import { tierOf } from '../tiers/map'
import { spCapAt } from '../tiers/scaling'
import { trackGifts, tracksOf } from './bond'
import { spEarned, type BuildView } from './derive'

/** The discount at hint levels 0–5: 10% for each of the first three, 5% for the next two (05 §2.4). */
export const HINT_DISCOUNTS: readonly number[] = Object.freeze([0, 0.1, 0.2, 0.3, 0.35, 0.4])
export const MAX_HINT_LEVEL = 5
/** Skills she can hold, as the racing build carries them. */
export const MAX_SKILLS = 64

/** A skill's SP cost at a hint level: round(costSp × (1 − discount)); null when it has no SP cost. */
export function skillCost(skill: Pick<SkillTemplate, 'costSp'>, hintLevel: number): number | null {
  if (skill.costSp === null || !Number.isFinite(skill.costSp) || skill.costSp <= 0) return null
  const level = Math.min(MAX_HINT_LEVEL, Math.max(0, Math.trunc(hintLevel)))
  return Math.round(skill.costSp * (1 - HINT_DISCOUNTS[level]!))
}

export type SkillSource = 'own' | 'hint'

export interface LibrarySkill {
  readonly skillId: string
  /** 0–5. */
  readonly hintLevel: number
  /** Her own (awakening, innate, story events), or brought by a card's hints. */
  readonly source: SkillSource
}

type SkillUma = Pick<UmaTemplate, 'uniqueSkillId' | 'awakeningSkillIds' | 'innateSkillIds' | 'eventSkillIds'>

/**
 * Her library for a career: her own skills (her unique is equipped on its own and isn't listed), then every skill her
 * tracks for the tier hinted, in the order they arrived; a hinted gold brings its white. Hint levels add up to 5.
 */
export function skillLibrary(
  career: Pick<CareerRecord, 'umaId' | 'T'>,
  uma: SkillUma,
  cards: ReadonlyMap<string, SupportCardTemplate>,
  bonds: Readonly<Record<string, BondRecord>>,
  skills: ReadonlyMap<string, Pick<SkillTemplate, 'normalSkillId'>>,
): LibrarySkill[] {
  const order: string[] = []
  const levels = new Map<string, number>()
  const source = new Map<string, SkillSource>()
  const add = (skillId: string, by: SkillSource, levelsAdded: number) => {
    if (skillId === uma.uniqueSkillId || !skills.has(skillId)) return
    if (!levels.has(skillId)) {
      order.push(skillId)
      levels.set(skillId, 0)
      source.set(skillId, by)
    }
    levels.set(skillId, Math.min(MAX_HINT_LEVEL, levels.get(skillId)! + levelsAdded))
  }
  for (const skillId of ownSkillIds(uma, career.T)) add(skillId, 'own', 0)
  for (const track of tracksOf(bonds, career.umaId, tierOf(career.T))) {
    const card = cards.get(track.cardId)
    if (card === undefined) continue
    for (const gift of trackGifts(track, card).skills) add(gift.skillId, 'hint', gift.levels)
  }
  for (const skillId of [...order]) {
    const lower = skills.get(skillId)?.normalSkillId
    if (lower) add(lower, source.get(skillId)!, 0)
  }
  return order.map((skillId) => ({ skillId, hintLevel: levels.get(skillId)!, source: source.get(skillId)! }))
}

export interface SkillPoints {
  /** Earned so far: the wallet, the tree, the deck's Initial SP and the hint rewards. */
  readonly earned: number
  readonly spent: number
  /** The scenario's SP cap on what a career spends. */
  readonly cap: number
  /** What she can spend now: min(cap, earned) − spent, never below 0. */
  readonly available: number
}

/** Her SP for the career. A deck change can leave her having spent more than she now earns; bought skills stay. */
export function skillPoints(career: CareerRecord, view: BuildView): SkillPoints {
  const earned = spEarned(career, view)
  const cap = spCapAt(career.T)
  return { earned, spent: career.spSpent, cap, available: Math.max(0, Math.min(cap, earned) - career.spSpent) }
}

export interface SkillBought {
  readonly career: CareerRecord
  readonly cost: number
}

/** Buys a skill from her library at its hinted cost. */
export function buySkill(
  career: CareerRecord,
  view: BuildView,
  uma: SkillUma,
  skills: ReadonlyMap<string, SkillTemplate>,
  skillId: string,
): SkillBought | Refusal {
  const skill = skills.get(skillId)
  if (skill === undefined) return refuse('unknown-skill', 'That skill isn\'t in the game.')
  if (skillId === uma.uniqueSkillId) return refuse('unique', 'Her unique is equipped on its own.')
  if (skill.kind !== 'white' && skill.kind !== 'gold') return refuse('not-buyable', `${skill.name} can't be bought.`)
  if (career.skills.includes(skillId)) return refuse('already-bought', `She already has ${skill.name}.`)
  const entry = skillLibrary(career, uma, view.cards, view.bonds, skills).find((item) => item.skillId === skillId)
  if (entry === undefined) return refuse('not-in-library', `${skill.name} isn't in her library: a card's hints bring it.`)
  const lower = skill.normalSkillId === null ? undefined : skills.get(skill.normalSkillId)
  if (lower !== undefined && !career.skills.includes(lower.id)) return refuse('needs-lower', `Buy ${lower.name} first: ${skill.name} builds on it.`)
  const cost = skillCost(skill, entry.hintLevel)
  if (cost === null) return refuse('no-cost', `${skill.name} has no SP cost, so it can't be bought.`)
  if (skillAimsAtOthers(skill) || !raceSkillSupported(compileRaceSkill(skill))) {
    return refuse('does-nothing', `${skill.name} does nothing in this game's races.`)
  }
  if (career.skills.length >= MAX_SKILLS) return refuse('too-many-skills', `She can hold ${MAX_SKILLS} skills.`)
  const points = skillPoints(career, view)
  if (career.spSpent + cost > points.cap) {
    return refuse('over-sp-cap', `That passes this scenario's SP cap of ${points.cap.toLocaleString('en-US')}.`, { cap: points.cap, cost })
  }
  if (cost > points.available) return refuse('not-enough-sp', `${skill.name} costs ${cost} SP; she has ${points.available}.`, { cost, have: points.available })
  return { career: { ...career, skills: [...career.skills, skillId], spSpent: career.spSpent + cost }, cost }
}
