// Furlong Hand (docs/game/09-furlong-hand.md, D385): its setup, rules and bots, joined as the stage the registry holds.
import type { StageRules } from '../contract'
import { FURLONG_BOTS } from './bots'
import { COLUMNS, DEPTH, furlongDone, FURLONG_VERSION, initFurlong, PILE, reportFurlong, SPURT_DEPTH, stepFurlong, type FurlongState } from './rules'
import { LEGS_BY_DISTANCE } from './setup'

export * from './setup'
export * from './rules'
export { COMPETENT_REDRAW, EXPERT_REDRAW, FURLONG_BOTS, bandGround, greedyChain, longestChain, projectedPlace } from './bots'

/** The most moves a race can take: a line, a redraw, every card and every flip of each spread. */
const MOST_LEGS = Math.max(...Object.values(LEGS_BY_DISTANCE))
export const FURLONG_MAX_INPUTS = MOST_LEGS * (COLUMNS * DEPTH + PILE + 1) + COLUMNS * SPURT_DEPTH + PILE + 1

export const FURLONG_RULES: StageRules<FurlongState> = Object.freeze({
  kind: 'furlong-hand',
  version: FURLONG_VERSION,
  maxInputs: FURLONG_MAX_INPUTS,
  init: initFurlong,
  step: stepFurlong,
  done: furlongDone,
  report: reportFurlong,
  bots: FURLONG_BOTS,
})
