// Every rule failure of the tier rules, in plain words (docs/rework/02-check-ins-and-notifications.md §9). `{uma}` is
// her outfit, which the screen turns into her name; the other placeholders are numbers or names. One table, so T131's
// banned-word test reads every sentence the tier rules can show.
import { refuse, type Refusal } from '../state/types'

export const TIER_REFUSALS = {
  'unknown-uma': "That Uma isn't in your Stable.",
  'not-at-gate': '{uma} needs Racing Lv {level} first.',
  'career-open': '{uma} still has career goals to win.',
  'last-scenario': "{uma} is in her tier's last scenario. Her next step is the World Expedition.",
  'scenario-not-playable': '{scenario} is not in the game yet.',
  'no-expedition': '{uma} needs to complete her World Expedition first.',
  'run-complete': '{uma} already has her eight wins in this Expedition.',
  'busy': '{uma} is still working.',
  'use-hall-of-fame': 'Tier 3 ends in the Hall of Fame, not a promotion.',
  'use-promotion': "{uma} is in tier {tier}. Its Expedition leads to a promotion, not the Hall of Fame.",
  'owned': '{uma} is already in your Stable.',
  'no-ticket': 'You need an Uma Ticket to unlock {uma}.',
  'shards': 'You need {need} Uma Shards for an Uma Ticket. You have {have}.',
  'inducted': '{uma} is already in the Hall of Fame.',
} as const

export type TierRefusalCode = keyof typeof TIER_REFUSALS

export const tierRefusal = (code: TierRefusalCode, data?: Refusal['data']): Refusal => refuse(code, TIER_REFUSALS[code], data)
