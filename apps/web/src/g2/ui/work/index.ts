// The pieces every timed thing shares (docs/rework/07-farm.md §2, §8, §10; docs/rework/05-training-hub.md §2;
// docs/rework/02-check-ins-and-notifications.md §3, §9; T140's contract, used by T139 and T142): one slot's card, Speed
// Tickets, Recall, queue chips and the size picker, with their pure models and a tap runner.
export { SlotCard, type SlotCardProps, type SlotCardWhat } from './SlotCard'
export { SpeedUpControls, speedUpQuestion } from './SpeedUpControls'
export { RecallSheet, RecallPreviewLines, recallLines } from './RecallSheet'
export { QueueChips, QueueCount, requestWords } from './QueueChips'
export { SizeChips, type SizeChipsProps } from './SizeChips'
export { TapNoteLine } from './TapNote'
export { useTap, useWordsContext, type Tap, type TapNote } from './useTap'
export { useWorkView, workView, type WorkView } from './view'
export * from './model'
export * from './words'
