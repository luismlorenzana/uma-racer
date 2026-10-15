// Her own skills (D186): the part of today's derived Uma the rework's build reads (`ownSkillIds`).

import type { UmaTemplate } from './content'

/** An Uma's awakening skills: four, a white and a gold per pair, as in the original. */
export const MAX_AWAKENING_SKILLS = 4

/**
 * How many of her awakening skills are open in a scenario of this tier (D186): the first pair (a white and a gold) from
 * her first scenario, both pairs from her second on. Supersedes D39's one per completed scenario, which left her first
 * scenario with none of her own.
 */
export const awakeningSkillsOpen = (tier: number): number =>
  Math.max(0, Math.min(MAX_AWAKENING_SKILLS, 2 * Math.trunc(tier)))

/** Her own skills beyond her unique, in library order: open awakening skills, then innate, then her story events'. */
export function ownSkillIds(template: Pick<UmaTemplate, 'awakeningSkillIds' | 'innateSkillIds' | 'eventSkillIds'>, tier: number): string[] {
  return [
    ...template.awakeningSkillIds.slice(0, awakeningSkillsOpen(tier)),
    ...(template.innateSkillIds ?? []),
    ...(template.eventSkillIds ?? []),
  ]
}
