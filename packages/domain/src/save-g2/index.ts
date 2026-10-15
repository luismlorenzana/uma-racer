// `@racer/domain/save-g2`: the generation-2 save (docs/rework/13-removals-and-plan-changes.md §6; T134). One pure module
// owns it: what is stored, how it is checked, how it maps onto the rework's state, and what crosses the wire. It has no
// migrations, no legacy constants and no cutover rows. Not in play until T143: nothing in today's app imports it; T135's
// API module and T136's web save layer build on it, and T143 moves it to `@racer/domain/save`.
export * from './kinds'
export * from './rows'
export * from './parse'
export * from './inputs'
export * from './initial'
export * from './state'
export * from './commit'
export * from './wire'
export * from './env'
// The operation table's types, so a caller of `commitOperation` names them from one place.
export type { OperationEnv, OperationInput, OperationName, OperationReceipt } from '../rework/check-in/once'
