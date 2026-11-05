// The Stable's view model (docs/game/02-unlocks.md §2, docs/game/11-hub-and-places.md §3.1; D386): every Uma in the
// content as an album row, owned or locked, with what she's doing (a career in progress, a completed one); the album's
// facets (her A-or-better surfaces, distances and running styles) and sorts (newest release, name, latest unlock) for
// uma-kit's album engine; the tab the Stable opens on; her racing builds; and the place's words. Pure.
import type { AlbumQuery, AlbumRow, FacetDef, SortDef } from '@luismlorenzana/uma-kit/roster'
import type { Grade, UmaTemplate } from '@racer/domain'
import type { CareerRecord, RacingBuild, SaveState } from '@racer/domain/save'
import { scenarioForTier } from '@racer/domain'
import type { OwnershipTab } from '../../hub/nav'
import { DISTANCE_LABEL, DISTANCES, STYLE_LABEL, STYLES, SURFACE_KEYS, SURFACE_LABEL } from '../../ui/labels'

export const STABLE_WORDS = Object.freeze({
  /** The (i) lines. */
  'about-tickets': 'Each Uma Ticket unlocks one Uma, for good. Completing a career earns another.',
  'about-profile': 'Tap an owned Uma for her profile: her career and her racing builds.',
  tabs: 'Umas',
  owned: 'Owned',
  locked: 'Locked',
  'no-owned': 'No Umas yet. Each Uma Ticket unlocks one from the Locked tab.',
  'see-locked': 'Unlock your first Umas',
  'all-owned': 'Every Uma is in your Stable.',
  'in-career': 'In a career',
  'career-done': 'Career complete',
  /** The unlock sheet. */
  'unlock-title': 'Unlock {name}?',
  unlock: 'Unlock · 1 Uma Ticket',
  'tickets-move': 'Uma Tickets: {n} to {next}',
  'no-tickets': 'No Uma Tickets left. Completing a career earns one.',
  final: 'Unlocking is final.',
  aptitudes: 'Aptitudes',
  growth: 'Growth rates',
  welcome: '{name} joins your Stable',
  profile: 'Her profile',
  done: 'Done',
  failed: "Couldn't unlock. Try again.",
  /** Her profile. */
  'profile-locked': 'Locked',
  'racing-builds': 'Racing builds',
  'no-builds': 'Win the URA Finals and her build is frozen here as her racing build.',
  stats: 'Stats',
  skills: 'Skills',
  'no-skills': 'No skills bought.',
  career: 'Career',
  'open-career': 'Open her career',
  'start-career': 'Start career · URA Finale',
  'start-note': 'Twelve seasons and the URA Finals. Nothing is timed.',
  'start-failed': "That didn't work. Try again.",
  'finished-all': 'Her URA Finale career is complete. More scenarios come in later releases.',
  'unknown-uma': "That Uma isn't in this game's content.",
  template: 'Her template',
} as const)

export type StableWord = keyof typeof STABLE_WORDS

export const stableWords = (key: StableWord, data?: Readonly<Record<string, string | number>>): string =>
  STABLE_WORDS[key].replace(/\{(\w+)\}/g, (whole, name: string) => (data !== undefined && Object.hasOwn(data, name) ? String(data[name]) : whole))

/** One Uma in the album: the kit's row, her name and what she's doing. */
export interface StableRow extends AlbumRow {
  readonly name: string
  readonly owned: boolean
  /** A career of hers is in progress. */
  readonly inCareer: boolean
  /** She has completed a career (a racing build). */
  readonly finished: boolean
}

const good = (grade: Grade | undefined): boolean => grade === 'S' || grade === 'A'

/** The album's facets: what she runs at A or better. */
export const STABLE_FACETS: readonly FacetDef[] = Object.freeze([
  { key: 'surface', label: 'Surface', kind: 'enum', group: 'Aptitude A or better', options: SURFACE_KEYS.map((value) => ({ value, label: SURFACE_LABEL[value] })) },
  { key: 'distance', label: 'Distance', kind: 'enum', group: 'Aptitude A or better', options: DISTANCES.map((value) => ({ value, label: DISTANCE_LABEL[value] })) },
  { key: 'style', label: 'Running style', kind: 'enum', group: 'Aptitude A or better', options: STYLES.map((value) => ({ value, label: STYLE_LABEL[value] })) },
])

/** The album's sorts: newest release first by default. */
export const STABLE_SORTS: readonly SortDef[] = Object.freeze([
  { key: 'release', label: 'Release', defaultDirection: 'desc' },
  { key: 'name', label: 'Name', defaultDirection: 'asc' },
  { key: 'unlocked', label: 'Unlocked', defaultDirection: 'desc' },
])

export const STABLE_QUERY: AlbumQuery = Object.freeze({
  search: '', filters: {}, sort: 'release', direction: 'desc', group: null, view: 'icons', mode: null,
})

export const STABLE_SCHEMA = Object.freeze({ fallback: STABLE_QUERY, facets: STABLE_FACETS, sorts: STABLE_SORTS })

/** Her careers, by Uma: any in progress, and any completed. */
function careersByUma(careers: Readonly<Record<string, CareerRecord>>): Map<string, { running: boolean; finished: boolean }> {
  const out = new Map<string, { running: boolean; finished: boolean }>()
  for (const career of Object.values(careers)) {
    const was = out.get(career.umaId) ?? { running: false, finished: false }
    out.set(career.umaId, { running: was.running || career.completedAt === null, finished: was.finished || career.completedAt !== null })
  }
  return out
}

/** Every Uma in the content, as album rows. */
export function stableRows(umas: Iterable<UmaTemplate>, state: Pick<SaveState, 'umas' | 'careers'>): StableRow[] {
  const careers = careersByUma(state.careers)
  return [...umas].map((uma) => {
    const unlock = state.umas[uma.id]
    const career = careers.get(uma.id)
    const apt = uma.aptitudes
    return {
      id: uma.id,
      name: uma.name,
      search: `${uma.name} ${uma.outfit ?? ''}`.toLowerCase(),
      facets: {
        surface: SURFACE_KEYS.filter((key) => good(apt.surface?.[key])),
        distance: DISTANCES.filter((key) => good(apt.distance?.[key])),
        style: STYLES.filter((key) => good(apt.strategy?.[key])),
      },
      sorts: { release: uma.jpRelease, name: uma.name, unlocked: unlock?.unlockedAt ?? null },
      owned: unlock !== undefined,
      inCareer: career?.running ?? false,
      finished: career?.finished ?? false,
    }
  })
}

/** The tab asked for, else Owned once she owns any Uma, else Locked (a new account picks its first Umas there). */
export function stableTab(asked: string | null, ownedCount: number): OwnershipTab {
  if (asked === 'owned' || asked === 'locked') return asked
  return ownedCount > 0 ? 'owned' : 'locked'
}

/** One completed career's frozen build, for her profile. */
export interface ProfileBuild {
  readonly careerId: string
  readonly scenario: string
  readonly completedAt: number
  readonly build: RacingBuild
}

/** Her racing builds, one per completed career, in scenario order. */
export function racingBuilds(umaId: string, careers: Readonly<Record<string, CareerRecord>>): ProfileBuild[] {
  return Object.entries(careers)
    .filter(([, career]) => career.umaId === umaId && career.completedAt !== null && career.racingBuild !== null)
    .sort(([, a], [, b]) => a.T - b.T)
    .map(([careerId, career]) => ({
      careerId,
      scenario: scenarioForTier(career.T)?.name ?? `Scenario ${career.T}`,
      completedAt: career.completedAt!,
      build: career.racingBuild!,
    }))
}

/** Her career in progress, if any (one at a time). */
export function runningCareer(umaId: string, careers: Readonly<Record<string, CareerRecord>>): { readonly id: string; readonly career: CareerRecord } | null {
  const found = Object.entries(careers).find(([, career]) => career.umaId === umaId && career.completedAt === null)
  return found === undefined ? null : { id: found[0], career: found[1] }
}
