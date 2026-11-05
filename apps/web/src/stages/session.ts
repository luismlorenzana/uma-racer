// The host's plain helpers (docs/game/07-stages.md §4, D384): which journal a play keeps, its config from the save, its
// seed, and its result, from the device's own settle (practice) or the operation's receipt (a career play).
import type { OperationEnv, SaveState } from '@racer/domain/save'
import {
  careerStageConfig, isReplayFailure, practiceStageConfig, settle, type AnyStageRules, type Journal, type SettleStageReceipt, type StageAward,
  type StageConfig, type StageGrade, type StageKind,
} from '@racer/domain/stages'
import type { RacerReceipt } from '../app/game'

export { journalId, type StageMode } from './ids'

/** A play's seed: 32 random bits from the phone (the rules roll everything from it). */
export function newSeed(): number {
  const bits = new Uint32Array(1)
  globalThis.crypto.getRandomValues(bits)
  return bits[0]!
}

/**
 * A play's config from the save as it stands: her career's (deck, bonds, the season's focus or her race), or outside a
 * career an Uma alone (the first unlocked one the content holds, else the content's first). Words when there is none.
 */
export function stageConfigFor(kind: StageKind, careerId: string | null, practice: boolean, seed: number, state: SaveState, env: OperationEnv): StageConfig | string {
  if (careerId !== null) {
    const career = state.careers[careerId]
    if (career === undefined) return 'That career doesn\'t exist.'
    const config = careerStageConfig(career, state.bonds, env.content, kind, seed, practice)
    return typeof config === 'object' && 'refused' in config ? config.reason : config
  }
  const unlocked = Object.keys(state.umas).sort().map((id) => env.content.umas.get(id)).find((uma) => uma !== undefined)
  const uma = unlocked ?? env.content.umas.values().next().value
  if (uma === undefined) return 'There is no Uma to practise with yet.'
  const config = practiceStageConfig(uma, kind, seed, env.content)
  return 'refused' in config ? config.reason : config
}

/** The same play with another seed: what a resumed journal is checked against, so a changed deck starts afresh. */
export const sameSetup = (a: StageConfig, b: StageConfig): boolean =>
  JSON.stringify({ ...a, seed: 0 }) === JSON.stringify({ ...b, seed: 0 })

/** What the result card shows. */
export interface StageResult {
  readonly grade: StageGrade
  readonly p: number
  readonly score: number
  readonly tasks: readonly boolean[]
  readonly pay: StageAward
  readonly practice: boolean
}

/** A finished practice, settled on the device by the same function the server runs; null when it doesn't settle. */
export function settlePractice(journal: Journal, rules: AnyStageRules): StageResult | null {
  const settled = settle(journal, rules)
  if (isReplayFailure(settled)) return null
  return { grade: settled.grade, p: settled.report.p, score: settled.report.score, tasks: settled.report.tasks, pay: settled.pay, practice: true }
}

export const resultOf = (receipt: SettleStageReceipt): StageResult =>
  ({ grade: receipt.grade, p: receipt.p, score: receipt.score, tasks: receipt.tasks, pay: receipt.pay, practice: receipt.practice })

const isSettleReceipt = (value: unknown): value is SettleStageReceipt =>
  typeof value === 'object' && value !== null && typeof (value as SettleStageReceipt).seed === 'number' && typeof (value as SettleStageReceipt).grade === 'string'

/** A play this phone already settled (it closed before its journal was cleared): its receipt, or null. */
export function settledBefore(receipts: Readonly<Record<string, RacerReceipt>>, careerId: string, kind: StageKind, seed: number): SettleStageReceipt | null {
  for (const { local, server } of Object.values(receipts)) {
    const receipt = server ?? local
    if (isSettleReceipt(receipt) && receipt.careerId === careerId && receipt.kind === kind && receipt.seed === seed && !receipt.practice) return receipt
  }
  return null
}
