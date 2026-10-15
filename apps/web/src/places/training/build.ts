// What every build view shares (docs/rework/05-training-hub.md §8; docs/rework/03-uma-progression.md §6, §8;
// docs/rework/11-hub-and-places.md §3.2, §6; T139): her header (her bust and name, "T1 · URA Finale", the preset the view
// edits, that preset's five stats and SP from `deriveUmaPreset`, and the Collect chip for her session's finished,
// uncollected unlocks), and the preset the view opens on. The preset switch is view-only (`?preset=`), opening on her
// selected preset (`raceDefaults.selectedPreset`): her profile selects one, and every training screen edits the one it
// shows. Pure.
import type { DistanceCategory } from '@racer/domain'
import type { UmaState } from '@racer/domain/rework/tiers'
import { deriveUmaPreset, type DerivedBuild } from '@racer/domain/rework/training'
import { finishedCount, SESSION_KIND, type WorkState } from '@racer/domain/rework/work'
import { DISTANCES } from '../../ui/labels'
import { tierLine, type Content } from './common'

/** The view's preset: `?preset=` when it names one, else her selected preset (03 §6). */
export function viewPreset(value: string | null, uma: Pick<UmaState, 'raceDefaults'>): DistanceCategory {
  return (DISTANCES as readonly string[]).includes(value ?? '') ? (value as DistanceCategory) : uma.raceDefaults.selectedPreset
}

/** Her session's finished unlocks not yet collected: the Collect chip's "2 unlocks finished" (05 §2). */
export function finishedUnlocks(settled: WorkState, outfitId: string, now: number): number {
  const row = settled.work[outfitId]
  if (row === undefined) return 0
  return row.entries
    .filter((entry) => entry.request.kind === SESSION_KIND)
    .reduce((sum, entry) => sum + Math.max(0, finishedCount(entry, now) - entry.collected), 0)
}

export interface BuildHeaderView {
  readonly uma: UmaState
  readonly tierLine: string
  readonly preset: DistanceCategory
  readonly derived: DerivedBuild
  readonly collect: number
}

export function buildHeader(settled: WorkState, uma: UmaState, preset: DistanceCategory, now: number, content: Content): BuildHeaderView {
  return {
    uma,
    tierLine: tierLine(uma),
    preset,
    derived: deriveUmaPreset(uma, preset, content),
    collect: finishedUnlocks(settled, uma.outfitId, now),
  }
}
