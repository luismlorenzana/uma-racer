// The names the new game's screens give the domain's small vocabularies (T138): stats, distances, running styles and
// surfaces in the order today's screens list them. Words only: the rules live in the domain, and the `satisfies`
// checks keep these in step with its types.
import type { DistanceCategory, StatKey, Strategy, Surface } from '@racer/domain'

export const STAT_KEYS = ['speed', 'stamina', 'power', 'guts', 'wit'] as const satisfies readonly StatKey[]
export const STAT_LABEL = { speed: 'Speed', stamina: 'Stamina', power: 'Power', guts: 'Guts', wit: 'Wit' } as const satisfies Record<StatKey, string>
export const STAT_SHORT = { speed: 'Spe', stamina: 'Sta', power: 'Pow', guts: 'Gut', wit: 'Wit' } as const satisfies Record<StatKey, string>

export const DISTANCES = ['sprint', 'mile', 'medium', 'long'] as const satisfies readonly DistanceCategory[]
export const DISTANCE_LABEL = { sprint: 'Sprint', mile: 'Mile', medium: 'Medium', long: 'Long' } as const satisfies Record<DistanceCategory, string>

export const STYLES = ['front', 'pace', 'late', 'end'] as const satisfies readonly Strategy[]
export const STYLE_LABEL = { front: 'Front Runner', pace: 'Pace Chaser', late: 'Late Surger', end: 'End Closer' } as const satisfies Record<Strategy, string>

export const SURFACE_KEYS = ['turf', 'dirt'] as const satisfies readonly Surface[]
export const SURFACE_LABEL = { turf: 'Turf', dirt: 'Dirt' } as const satisfies Record<Surface, string>

/** "1,240". */
export const amount = (n: number): string => Math.round(n).toLocaleString('en-US')

/** A real duration as "4 h 48 m", "3 h" or "45 m" (05 §2: times on screen are real, × k). */
export function duration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} m`
  return m === 0 ? `${h} h` : `${h} h ${m} m`
}
