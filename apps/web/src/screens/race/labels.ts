import type { RaceGrade, RaceSkillEffectKind, Strategy } from '@racer/domain'

export const STRATEGY_LABEL: Record<Strategy, string> = {
  front: 'Front Runner',
  pace: 'Pace Chaser',
  late: 'Late Surger',
  end: 'End Closer',
}

export const GRADE_LABEL: Record<RaceGrade, string> = {
  debut: 'Debut',
  maiden: 'Maiden',
  'pre-op': 'Pre-OP',
  op: 'OP',
  g3: 'G3',
  g2: 'G2',
  g1: 'G1',
}

export const GRADE_STYLE: Record<RaceGrade, string> = {
  g1: 'from-[#4f7cff] to-[#2a4fd6]',
  g2: 'from-[#ff6f91] to-[#d63a63]',
  g3: 'from-[#3ecf8e] to-[#1f9a64]',
  op: 'from-[#36b5a9] to-[#218b81]',
  'pre-op': 'from-[#56b991] to-[#328468]',
  maiden: 'from-[#a7a2d9] to-[#716ca9]',
  debut: 'from-[#9aa7b8] to-[#6b7a8f]',
}

/** What a skill did, from its effects: the race feed's line under a player skill, and the results' activations. */
export function effectLabel(effects: readonly RaceSkillEffectKind[]) {
  const labels: string[] = []
  if (effects.includes('recovery')) labels.push('Stamina recovery')
  if (effects.some((effect) => effect === 'current-speed' || effect === 'current-speed-natural' || effect === 'target-speed')) labels.push('Speed boost')
  if (effects.includes('acceleration')) labels.push('Acceleration')
  if (effects.some((effect) => effect.startsWith('passive-'))) labels.push('Stat boost')
  if (effects.includes('start-delay')) labels.push('Quick start')
  return labels.join(' · ') || 'Activated'
}
