// Versioned contextual guide for the production-and-cooking Farm (docs/design/farm-kitchen-rework.md §13).
import { FARM_KITCHEN_ENERGY_GRANT, FARM_KITCHEN_EXP_PER_JOB, FARM_KITCHEN_JOB_MS, FARM_KITCHEN_STATIONS_PER_DISTRICT } from '@racer/domain/farm/kitchen'
import type { ReactNode } from 'react'
import { PagedGuide, type PagedGuidePage } from '../../ui/PagedGuide'
import { createGuideMemory } from '../../ui/minigames/guide-memory'
import { RpgModalFocus } from '../../ui/rpg/RpgModalFocus'

export type FarmGuidePage = 'crew' | 'flavours' | 'production' | 'recipes' | 'extra' | 'energy' | 'sync'
export const farmKitchenGuideMemory = (isolated: boolean) => createGuideMemory(isolated ? 'farm-kitchen-proof-guide-v1' : 'uma-racer:farm-kitchen-guide-v1')
const hours = FARM_KITCHEN_JOB_MS / 3_600_000
function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-white/15 bg-stage-soft p-5 text-[15px] leading-6 text-ink-on-dark-soft">{children}</div>
}
export const farmKitchenGuidePages: readonly PagedGuidePage<FarmGuidePage>[] = [
  { id: 'crew', title: 'One global Farm crew', body: <Card>Every owned outfit has her own Farm Level. Assign her to any of the five districts; all {5 * FARM_KITCHEN_STATIONS_PER_DISTRICT} stations are open, and an idle worker can move without losing her level.</Card> },
  { id: 'flavours', title: 'Scenario flavours, shared Items', body: <Card>Each scenario has its own equal Speed, Stamina, Power, Guts and Wit ingredients. Farm levels open flavours; everything claimed enters the one global Items bag.</Card> },
  { id: 'production', title: 'Raw to processed to meals', body: <Card>Garden, Orchard and Barnyard make raw goods. Workshop processes exact scenario goods. Kitchen meals may substitute same-stat ingredients from the same five-scenario block. Every job lasts {hours} hours and pays {FARM_KITCHEN_EXP_PER_JOB} Farm EXP when claimed.</Card> },
  { id: 'recipes', title: 'Plan batches deliberately', body: <Card>Choose one concrete ingredient per slot and a batch before Start. Cookbook receipts record meals already prepared; pin up to three wishes and the planner shares stock instead of promising it twice.</Card> },
  { id: 'extra', title: 'Meals build Extra Stats', body: <Card>One matching meal buys a named node permanently for one outfit’s five-scenario block. Switch bought nodes on freely in each scenario and distance build. A Sun meal asks for every stat; its node adds four to each. Pending builds are previews until synced.</Card> },
  { id: 'energy', title: 'Energy helps one job', body: <Card>One Farm Energy removes up to 30 minutes from one running job. The detail sheet names any wasted minutes first. Owner playtesting can deliberately Grant {FARM_KITCHEN_ENERGY_GRANT} Energy.</Card> },
  { id: 'sync', title: 'Pending work stays honest', body: <Card>Predicted stock is shown separately from canonical spendable stock. A pending or rejected command keeps its exact choices for Retry and recovery; reopening never rerolls a job or replays a celebration.</Card> },
]

export function FarmKitchenGuide({ open, startAt, isolated, close }: { open: boolean; startAt: FarmGuidePage; isolated: boolean; close: () => void }) {
  if (!open) return null
  return <RpgModalFocus onClose={close}><PagedGuide open pages={farmKitchenGuidePages} startAt={startAt} titleId="farm-kitchen-guide" finishLabel="Open the Farm" onClose={() => {
    farmKitchenGuideMemory(isolated).remember(); close()
  }} /></RpgModalFocus>
}
