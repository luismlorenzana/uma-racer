// The run's labels, ported from today's `screens/race/labels.ts`: running styles, grades and a skill's effects.
import type { RaceSkillEffectKind, Strategy } from '@racer/domain'

export const STRATEGY_LABEL: Readonly<Record<Strategy, string>> = {
  front: 'Front Runner',
  pace: 'Pace Chaser',
  late: 'Late Surger',
  end: 'End Closer',
}

/** What a skill did, from its effects: the race feed's line under her skill. */
export function effectLabel(effects: readonly RaceSkillEffectKind[]): string {
  const labels: string[] = []
  if (effects.includes('recovery')) labels.push('Stamina recovery')
  if (effects.some((effect) => effect === 'current-speed' || effect === 'current-speed-natural' || effect === 'target-speed')) labels.push('Speed boost')
  if (effects.includes('acceleration')) labels.push('Acceleration')
  if (effects.some((effect) => effect.startsWith('passive-'))) labels.push('Stat boost')
  if (effects.includes('start-delay')) labels.push('Quick start')
  return labels.join(' · ') || 'Activated'
}
