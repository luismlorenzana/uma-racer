// The pieces every timed thing shares (docs/game/07-farm.md §2, §8, §10; docs/game/05-training-hub.md §2;
// docs/game/02-check-ins-and-notifications.md §3, §9; T140's contract, used by T139 and T142; D366's compact rows):
// one slot's row and its side-panel row, Speed Tickets, Recall, queue chips and the size picker, a building's stats
// chips and upgrade button, with their pure models and a tap runner; T142 adds the stopped queue's card and a list's tap
// runner.
export { SlotRow, PeekRow, FaceRing, farmWhat, repeatOne, type SlotRowProps, type SlotCardWhat } from './SlotRow'
export { SpeedUpControls, speedUpQuestion } from './SpeedUpControls'
export { RecallSheet, RecallPreviewLines, recallLines } from './RecallSheet'
export { QueueChips, QueueCount, QueueLine, queuedWords, requestMark, requestWords } from './QueueChips'
export { SizeChips, type SizeChipsProps } from './SizeChips'
export { StoppedQueueCard } from './StoppedQueueCard'
export { stoppedCardView, type StoppedCardView } from './stopped'
export { PlaceStats } from './PlaceStats'
export { UpgradeButton } from './Upgrade'
export { TapNoteLine } from './TapNote'
export { useTap, useTaps, useWordsContext, type Tap, type TapNote, type Taps } from './useTap'
export { useWorkView, workView, type WorkView } from './view'
export * from './model'
export * from './words'
