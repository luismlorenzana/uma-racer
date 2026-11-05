// Training Yard (docs/game/08-training-yard.md, D384): its rules and bots, joined as the stage the registry holds.
import type { StageRules } from '../contract'
import { YARD_BOTS } from './bots'
import { initYard, reportYard, stepYard, yardDone, YARD_PLACEMENTS, YARD_VERSION, type YardState } from './rules'

export * from './rules'
export { YARD_BOTS } from './bots'

export const YARD_RULES: StageRules<YardState> = Object.freeze({
  kind: 'training-yard',
  version: YARD_VERSION,
  // A placement, and at most one hold before it.
  maxInputs: YARD_PLACEMENTS * 2,
  init: initYard,
  step: stepYard,
  done: yardDone,
  report: reportYard,
  bots: YARD_BOTS,
})
