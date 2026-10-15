// Every rule failure of the Training Hub and the build, in plain words (docs/game/02-check-ins-and-notifications.md
// §9, docs/game/05-training-hub.md §8). `{uma}` and `{card}` are ids the screen turns into names; `{unlock}`, `{needs}`
// and `{node}` are labels (`unlockLabel`); the rest are numbers or names. One table, so T131's banned-word test reads
// every sentence these rules can show.
import { refuse, type Refusal } from '../state/types'

export const TRAINING_REFUSALS = {
  'later-layer': 'Opens in scenario {scenario} · {name}',
  'already-open': 'Already open: {unlock}.',
  'needs-first': 'Needs {needs} first.',
  'wrong-room': 'Not trained in this room: {unlock}.',
  'mixed-facility': 'A session stays at one facility.',
  'session-size': 'A session takes 1 to {max} unlocks.',
  'duplicate': 'Already listed: {item}.',
  'card-era': 'Opens in scenario {scenario} · {name}',
  'already-bonded': '{card} is already bonded to {uma}.',
  'not-bonded': "{card} isn't bonded to {uma} yet.",
  'not-in-set': "{card} isn't in this set.",
  'duplicate-character': "This set already has {card}'s character.",
  'set-size': 'A set holds up to {max} cards.',
  'node-cap': '{card} already holds {cap} nodes, its most.',
  'node-locked': "{node} isn't open yet.",
  'slot-not-open': "That Inspiration slot isn't open yet.",
  'lineage': "{candidate} can't sit there: {why}.",
  'over-capacity': 'Only {capacity} Extra Stats can be on at once.',
  'over-sp': 'That loadout needs {cost} SP. She has {sp}.',
  'skill-unavailable': "{skill} isn't one she can learn now.",
} as const

export type TrainingRefusalCode = keyof typeof TRAINING_REFUSALS

export const trainingRefusal = (code: TrainingRefusalCode, data?: Refusal['data']): Refusal => refuse(code, TRAINING_REFUSALS[code], data)

/** The plain reasons `lineageSlotEligibility` and ownership give for a lineage pick, for the `lineage` refusal's `{why}`. */
export const LINEAGE_WHY = {
  herself: "that's her",
  repeat: 'only the same grandparent outfit on the opposite side may repeat',
  notOwned: "she isn't in your Stable",
} as const
