// Bounded visual and accessible feedback for Rival Circuit (docs/design/ux.md#spark-match--rival-circuit).
import type {
  RivalPhaseIntent,
  RivalTurnIntent,
  SparkAttackTotal,
  SparkPresentationStep,
  SparkRivalResolution,
  SparkRivalState,
  Strategy,
} from '@racer/domain'
import { SPARK_ORB_GLYPHS } from '../../ui/minigames/spark-rival-presentation'

export const SPARK_EFFECT_CAPACITY = 24
export const SPARK_LABEL_CAPACITY = 8

const STRATEGY_NAME: Readonly<Record<Strategy, string>> = {
  front: 'Front',
  pace: 'Pace',
  late: 'Late',
  end: 'End',
}

export function sparkAttackLabel(attack: SparkAttackTotal): string {
  const glyph = attack.orb === 'spark' ? 'S' : SPARK_ORB_GLYPHS[attack.orb]
  const matchup = attack.matchup === 'advantaged' ? ' WEAK' : attack.matchup === 'resisted' ? ' RESIST' : ''
  return `${glyph} -${attack.appliedAmount}${matchup}`
}

export function sparkIntentAnnouncement(intent: RivalTurnIntent | RivalPhaseIntent, driveBefore: number, driveAfter: number, convertedCount?: number): string {
  switch (intent.type) {
    case 'pressure': return `Rival Pressure removed ${driveBefore - driveAfter} Drive`
    case 'guard': return `Rival Guard is active until you make ${intent.comboThreshold} combos`
    case 'convert': return `Rival converted ${convertedCount ?? `up to ${intent.maximum}`} ${intent.source} orbs into ${intent.target}`
    case 'delay': return `Rival Delay added ${intent.amount} to the Spark Shift requirement`
    case 'enrage': return 'Rival enraged; later Pressure is stronger'
    case 'change-style': return `Rival changed style to ${STRATEGY_NAME[intent.strategy]}`
  }
}

export function sparkResolutionAnnouncement(resolution: SparkRivalResolution, finalState: SparkRivalState): string {
  const terminal = resolution.steps.findLast((step) => step.type === 'run-end')
  if (terminal?.type === 'run-end') {
    if (terminal.outcome.reason === 'circuit-cleared') return `Circuit cleared. ${terminal.outcome.trainingExp} Training EXP earned.`
    const reason = terminal.outcome.reason === 'drive-depleted' ? 'Drive depleted' : 'Turn limit reached'
    return `${reason}. ${terminal.outcome.trainingExp} Training EXP banked.`
  }

  const shift = resolution.steps.find((step) => step.type === 'spark-shift')
  if (shift?.type === 'spark-shift') {
    return `Spark Shift converted ${shift.converted.length} orbs to ${STRATEGY_NAME[shift.strategy]}. The board is ready.`
  }

  const messages: string[] = []
  messages.push(resolution.combos === 0 ? 'No match' : `${resolution.combos} combo${resolution.combos === 1 ? '' : 's'}`)
  const damage = resolution.steps.reduce((sum, step) => step.type === 'attack' ? sum + step.attack.appliedAmount : sum, 0)
  if (damage > 0) messages.push(`${damage} Resolve damage`)
  const recovery = resolution.steps.find((step) => step.type === 'recovery')
  if (recovery?.type === 'recovery' && recovery.driveAfter > recovery.driveBefore) messages.push(`${recovery.driveAfter - recovery.driveBefore} Drive recovered`)
  const charge = resolution.steps.find((step) => step.type === 'charge')
  if (charge?.type === 'charge') messages.push(`${charge.amount} Spark charged`)
  const intent = resolution.steps.findLast((step): step is Extract<SparkPresentationStep, { type: 'rival-intent' }> => step.type === 'rival-intent')
  if (intent) messages.push(sparkIntentAnnouncement(intent.intent, intent.driveBefore, intent.driveAfter, intent.converted.length))
  const wave = resolution.steps.find((step) => step.type === 'wave-clear')
  if (wave?.type === 'wave-clear') messages.push(`Wave ${wave.wave} cleared`)
  else messages.push(`Rival has ${finalState.rival.resolve} Resolve; you have ${finalState.drive} Drive`)
  return `${messages.join('. ')}.`
}
