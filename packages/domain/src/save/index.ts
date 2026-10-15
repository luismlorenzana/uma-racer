// `@racer/domain/save`: the generation-2 save (docs/rework/13-removals-and-plan-changes.md §6; T134). One pure module
// owns it: what is stored, how it is checked, how it maps onto the rework's state, and what crosses the wire. It has no
// migrations, no legacy constants and no cutover rows. The API's save module (T135) and the web's save layer (T136)
// build on it.
export * from './kinds'
export * from './rows'
export * from './parse'
export * from './inputs'
export * from './initial'
export * from './state'
export * from './commit'
export * from './wire'
export * from './env'
// The ids of the device's own rows (T136): a badge row and a flair event are named as the parsers check them.
export { badgeStateId } from '../badges'
export { flairEventId } from '../flair'
// The operation table's types, so a caller of `commitOperation` names them from one place.
export type { OperationEnv, OperationInput, OperationName, OperationReceipt } from '../check-in/once'
