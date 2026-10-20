// Racer's ids and content over the shared work model (SC5). Entries use the package's canonical `exp` field;
// save/parse accepts pre-SC5 `farmExp` entries without changing their frozen plans or clocks.
import type * as Core from '@luismlorenzana/uma-work'
import type { SupportCardTemplate, UmaTemplate } from '../content'
import type { ReworkState } from '../state/types'
import type { BuildingId, BuildingLevel, RoomId } from '../farm/buildings'

export interface SlotRef extends Core.SlotRef {
  readonly building: BuildingId
  readonly room?: RoomId
}
export type FarmKind = 'gather' | 'craft' | 'cook'
export const SESSION_KIND = 'session'
export type SessionKind = typeof SESSION_KIND
export type FarmRequest = Core.ItemRequest<FarmKind>
export type UnlockRef = Core.UnlockRef
export type SessionRequest = Core.UnlockRequest<SessionKind>
export type WorkRequest = FarmRequest | SessionRequest
export type WorkKind = WorkRequest['kind']
export type WorkOutput = Core.WorkOutput
export type Entry = Core.Entry<WorkRequest>
export interface LastWork extends Core.LastWork<WorkRequest> { readonly slot: SlotRef }
export interface DroppedQueue extends Core.DroppedQueue<WorkRequest> { readonly slot: SlotRef }
export interface WorkRow extends Core.WorkRow<WorkRequest> {
  readonly slot: SlotRef | null
  readonly last: LastWork | null
  readonly dropped: DroppedQueue | null
}
export type ItemStock = Core.ItemStock
export type BuildingLevels = Readonly<Record<BuildingId, { readonly level: BuildingLevel }>>
export interface WorkState extends ReworkState, Core.WorkState<WorkRequest> {
  readonly items: ItemStock
  readonly buildings: BuildingLevels
  readonly work: Readonly<Record<string, WorkRow>>
}
export interface WorkContent {
  readonly umas: ReadonlyMap<string, Pick<UmaTemplate, 'aptitudes'>>
  readonly cards?: ReadonlyMap<string, Pick<SupportCardTemplate, 'id' | 'type' | 'era'>>
}
export type ItemMovement = Core.ItemMovement
export interface QueueStart extends Core.QueueStart<WorkRequest> { readonly slot: SlotRef }
export interface SettleReport extends Core.SettleReport<WorkRequest> {
  readonly started: readonly QueueStart[]
  readonly dropped: readonly (DroppedQueue & { readonly outfitId: string })[]
}
export type Done<R, S> = Core.Done<R, S>
