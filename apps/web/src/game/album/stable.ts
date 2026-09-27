// Stable album projection: rows, facets, sorts, presets and the character/outfit split
// (docs/design/collection.md#uma-album-stable).

import {
  activeScenario,
  type CardSave,
  DISTANCE_CATEGORIES,
  GRADES,
  SCENARIOS,
  STATS,
  STRATEGIES,
  SURFACES,
  tierOfLevel,
  type Aptitudes,
  type Grade,
  type PlayerProfile,
  type UmaSave,
  type UmaTemplate,
} from '@racer/domain'
import { getContentAsset, type ContentAsset, type LoadedContent } from '../../content/runtime'
import { joinUma, type UmaViewModel } from '../view'
import type { AlbumQuery, AlbumRow, FacetDef, SortDef } from './query'

export const STABLE_ALBUM_ID = 'stable'
export const STABLE_MODES = ['outfit', 'character'] as const
export type StableMode = (typeof STABLE_MODES)[number]

export interface StableEntry {
  id: string
  template: UmaTemplate
  save: UmaSave | null
  view: UmaViewModel | null
  asset: ContentAsset | null
  owned: boolean
  aptitudes: Aptitudes
  statTotal: number
  prestige: number
  badgeCount: number
  activeTitle: string | null
  journeyState: 'none' | 'active' | 'complete'
  readyToTrain: boolean
  isNew: boolean
  /** Character mode only: how many outfits of this character exist, and how many are owned. */
  outfitCount: number
  ownedOutfitCount: number
  redemptionLock: string | null
}

export interface StableAlbumInput {
  content: LoadedContent
  saves: Readonly<Record<string, UmaSave>>
  /** Owned card saves: stats are derived from the constellation, so the album needs them (D121). */
  cards: Readonly<Record<string, CardSave>>
  profile: PlayerProfile
  /** Latest race time per Uma id, for the "recently raced" sort. */
  lastRacedAt: Readonly<Record<string, number>>
  /** Flair summary per owned Uma, computed once by the screen rather than per row. */
  flair: Readonly<Record<string, UmaFlairFacts>>
  seen: readonly string[]
  mode: StableMode
}

export interface StableAlbum {
  rows: AlbumRow[]
  entries: Map<string, StableEntry>
  owned: number
  total: number
}

const gradeIndex = (grade: Grade): number => GRADES.indexOf(grade)
const strong = (grade: Grade): boolean => grade === 'S' || grade === 'A'

export interface UmaFlairFacts {
  prestige: number
  badgeCount: number
  activeTitle: string | null
}

const NO_FLAIR: UmaFlairFacts = { prestige: 0, badgeCount: 0, activeTitle: null }

function journeyState(save: UmaSave | null): StableEntry['journeyState'] {
  if (!save) return 'none'
  const journey = activeScenario(save).journey
  if (journey?.state === 'active') return journey.goals.every((goal) => goal.status === 'completed') ? 'complete' : 'active'
  return 'none'
}

function entryFor(input: StableAlbumInput, template: UmaTemplate, seen: ReadonlySet<string>): StableEntry {
  const save = input.saves[template.id] ?? null
  const joined = save ? joinUma(save, input.content, input.cards) : null
  const view = joined?.status === 'ready' ? joined.value : null
  const aptitudes = view?.derived.aptitudes ?? template.aptitudes
  const facts = input.flair[template.id] ?? NO_FLAIR
  return {
    id: template.id,
    template,
    save,
    view,
    asset: getContentAsset(input.content, 'uma-icons', template.id),
    owned: save !== null,
    aptitudes,
    statTotal: view ? STATS.reduce((sum, stat) => sum + view.derived.stats[stat], 0) : 0,
    prestige: facts.prestige,
    badgeCount: facts.badgeCount,
    activeTitle: facts.activeTitle,
    journeyState: journeyState(save),
    readyToTrain: view !== null && view.run.started && input.profile.tickets > 0,
    isNew: save !== null && !seen.has(template.id),
    outfitCount: 1,
    ownedOutfitCount: save ? 1 : 0,
    redemptionLock: save
      ? 'Uma outfit is already owned'
      : input.profile.umaCoupons < 1 ? 'Exchange five Uma Shards for a Select Coupon first' : null,
  }
}

/** Character mode keeps the best-owned outfit as the representative: highest level, then newest release. */
function pickRepresentative(entries: readonly StableEntry[]): StableEntry {
  return [...entries].sort((left, right) => {
    if (left.owned !== right.owned) return left.owned ? -1 : 1
    const level = (right.save?.level ?? 0) - (left.save?.level ?? 0)
    if (level !== 0) return level
    const release = right.template.jpRelease.localeCompare(left.template.jpRelease)
    return release !== 0 ? release : left.template.id.localeCompare(right.template.id)
  })[0]!
}

function rowFor(entry: StableEntry, lastRacedAt: Readonly<Record<string, number>>): AlbumRow {
  const { template, save, aptitudes } = entry
  const strongIn = (values: Record<string, Grade>): string[] =>
    Object.entries(values).flatMap(([key, grade]) => (strong(grade) ? [key] : []))
  const bestSurface = Math.min(...SURFACES.map((surface) => gradeIndex(aptitudes.surface[surface])))
  const bestDistance = Math.min(...DISTANCE_CATEGORIES.map((distance) => gradeIndex(aptitudes.distance[distance])))
  const aptitudeSorts: Record<string, number> = {}
  for (const surface of SURFACES) aptitudeSorts[`aptitude:${surface}`] = gradeIndex(aptitudes.surface[surface])
  for (const distance of DISTANCE_CATEGORIES) aptitudeSorts[`aptitude:${distance}`] = gradeIndex(aptitudes.distance[distance])

  return {
    id: entry.id,
    search: `${template.name} ${template.outfit ?? ''}`.toLowerCase(),
    facets: {
      ownership: [entry.owned ? 'owned' : 'unowned'],
      tier: save ? [String(tierOfLevel(save.level))] : ['1'],
      surface: strongIn(aptitudes.surface),
      distance: strongIn(aptitudes.distance),
      strategy: strongIn(aptitudes.strategy),
      sex: [template.realHorseSex ?? 'unknown'],
      era: [String(Math.min(SCENARIOS.length, Math.max(1, entry.view?.tier ?? 1)))],
      level: save?.level ?? null,
      starter: template.starter,
      hasParents: (entry.view?.derived.lineage.length ?? 0) > 0,
      journey: [entry.journeyState],
      title: entry.activeTitle !== null,
      readyToTrain: entry.readyToTrain,
      readyToPromote: entry.view?.readyToAdvance === true,
      isNew: entry.isNew,
    },
    sorts: {
      release: template.jpRelease,
      level: save?.level ?? null,
      name: template.name.toLowerCase(),
      tier: save ? tierOfLevel(save.level) : null,
      trainingLevel: entry.view?.derived.trainingLevel ?? null,
      statTotal: save ? entry.statTotal : null,
      prestige: entry.prestige || null,
      badges: entry.badgeCount || null,
      raced: lastRacedAt[entry.id] ?? null,
      bestAptitude: Math.min(bestSurface, bestDistance),
      ...aptitudeSorts,
    },
  }
}

export function buildStableAlbum(input: StableAlbumInput): StableAlbum {
  const seen = new Set(input.seen)
  const all = input.content.umas.items.map((template) => entryFor(input, template, seen))
  const total = all.length
  const owned = all.filter((entry) => entry.owned).length

  if (input.mode === 'outfit') {
    return {
      rows: all.map((entry) => rowFor(entry, input.lastRacedAt)),
      entries: new Map(all.map((entry) => [entry.id, entry])),
      owned,
      total,
    }
  }

  // Character mode: one entry per character, owned meaning "owned in any outfit".
  const byCharacter = new Map<string, StableEntry[]>()
  for (const entry of all) {
    byCharacter.set(entry.template.charaId, [...(byCharacter.get(entry.template.charaId) ?? []), entry])
  }
  const characters = [...byCharacter.values()].map((group) => {
    const representative = pickRepresentative(group)
    const ownedOutfits = group.filter((entry) => entry.owned)
    return {
      ...representative,
      owned: ownedOutfits.length > 0,
      outfitCount: group.length,
      ownedOutfitCount: ownedOutfits.length,
      isNew: group.some((entry) => entry.isNew),
    }
  })
  return {
    rows: characters.map((entry) => rowFor(entry, input.lastRacedAt)),
    entries: new Map(characters.map((entry) => [entry.id, entry])),
    owned: characters.filter((entry) => entry.owned).length,
    total: characters.length,
  }
}

const titleCase = (value: string): string => `${value[0]!.toUpperCase()}${value.slice(1)}`

export const STABLE_FACETS: FacetDef[] = [
  {
    key: 'ownership', label: 'Ownership', kind: 'enum', group: 'Collection',
    options: [{ value: 'owned', label: 'Owned' }, { value: 'unowned', label: 'Unowned' }],
  },
  {
    key: 'tier', label: 'Scenario tier', kind: 'enum', group: 'Progress',
    options: SCENARIOS.map((scenario) => ({ value: String(scenario.tier), label: `T${scenario.tier} · ${scenario.name}` })),
  },
  {
    key: 'surface', label: 'Surface aptitude', kind: 'enum', group: 'Aptitude',
    options: SURFACES.map((surface) => ({ value: surface, label: `${titleCase(surface)} A+` })),
  },
  {
    key: 'distance', label: 'Distance aptitude', kind: 'enum', group: 'Aptitude',
    options: DISTANCE_CATEGORIES.map((distance) => ({ value: distance, label: `${titleCase(distance)} A+` })),
  },
  {
    key: 'strategy', label: 'Strategy aptitude', kind: 'enum', group: 'Aptitude',
    options: STRATEGIES.map((strategy) => ({ value: strategy, label: `${titleCase(strategy)} A+` })),
  },
  {
    key: 'sex', label: 'Real-horse sex', kind: 'enum', group: 'Identity',
    options: [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'unknown', label: 'Unknown' }],
  },
  { key: 'level', label: 'Uma level', kind: 'range', group: 'Progress' },
  { key: 'starter', label: 'Launch roster', kind: 'boolean', group: 'Identity' },
  { key: 'hasParents', label: 'Has parent snapshot', kind: 'boolean', group: 'Lineage' },
  {
    key: 'journey', label: 'Journey', kind: 'enum', group: 'Progress',
    options: [{ value: 'active', label: 'Goals active' }, { value: 'complete', label: 'Goals complete' }, { value: 'none', label: 'No journey' }],
  },
  { key: 'title', label: 'Holds a title', kind: 'boolean', group: 'Flair' },
  { key: 'readyToTrain', label: 'Ready to train', kind: 'boolean', group: 'Progress' },
  { key: 'readyToPromote', label: 'Ready to promote', kind: 'boolean', group: 'Progress' },
  { key: 'isNew', label: 'New to you', kind: 'boolean', group: 'Collection' },
]

export const STABLE_SORTS: SortDef[] = [
  { key: 'level', label: 'Uma level', defaultDirection: 'desc' },
  { key: 'release', label: 'Release date', defaultDirection: 'desc' },
  { key: 'name', label: 'Name', defaultDirection: 'asc' },
  { key: 'tier', label: 'Scenario tier', defaultDirection: 'desc' },
  { key: 'trainingLevel', label: 'Training Level', defaultDirection: 'desc' },
  { key: 'statTotal', label: 'Total stats', defaultDirection: 'desc' },
  { key: 'prestige', label: 'Prestige', defaultDirection: 'desc' },
  { key: 'badges', label: 'Badges earned', defaultDirection: 'desc' },
  { key: 'raced', label: 'Recently raced', defaultDirection: 'desc' },
  {
    key: 'bestAptitude', label: 'Best aptitude for…', defaultDirection: 'asc',
    parameter: {
      label: 'Aptitude',
      options: [
        ...SURFACES.map((surface) => ({ value: `aptitude:${surface}`, label: titleCase(surface) })),
        ...DISTANCE_CATEGORIES.map((distance) => ({ value: `aptitude:${distance}`, label: titleCase(distance) })),
      ],
    },
  },
]

/** Highest level first, as every Uma list is (D181), then newest release, then name (docs/design/collection.md#default-sorts). */
export const STABLE_DEFAULT_QUERY: AlbumQuery = {
  search: '',
  filters: { ownership: ['owned'] },
  sort: 'level',
  direction: 'desc',
  group: null,
  view: 'icons',
  mode: 'outfit',
}

export const STABLE_TIE_BREAK = [
  { key: 'level', direction: 'desc' as const },
  { key: 'release', direction: 'desc' as const },
  { key: 'name', direction: 'asc' as const },
]

/** Bumped when the Stable's default sort changes, so a device's stored sort takes the new default once (D181). */
export const STABLE_PREFS_REV = 2

export interface AlbumPreset {
  key: string
  label: string
  apply: (query: AlbumQuery) => AlbumQuery
}

/** Presets set the query; they are not saved views and never overwrite one. */
export const STABLE_PRESETS: AlbumPreset[] = [
  {
    key: 'trainable', label: 'Trainable now',
    apply: (query) => ({ ...query, filters: { ownership: ['owned'], readyToTrain: true } }),
  },
  {
    key: 'promote', label: 'Ready to promote',
    apply: (query) => ({ ...query, filters: { ownership: ['owned'], readyToPromote: true } }),
  },
  {
    key: 'new', label: 'New to you',
    apply: (query) => ({ ...query, filters: { ownership: ['owned'], isNew: true } }),
  },
  {
    key: 'unowned', label: 'Unowned',
    apply: (query) => ({ ...query, filters: { ownership: ['unowned'] } }),
  },
  {
    key: 'launch', label: 'Launch roster',
    apply: (query) => ({ ...query, filters: { starter: true } }),
  },
]

/** The value the active sort is about, shown on the tile so sorting is never invisible. */
export function sortValueLabel(entry: StableEntry, sort: string, parameter: string | null): string | null {
  switch (sort) {
    case 'release': return entry.template.jpRelease
    case 'statTotal': return entry.save ? `${entry.statTotal} total` : null
    case 'prestige': return entry.prestige > 0 ? `${entry.prestige} Prestige` : null
    case 'badges': return entry.badgeCount > 0 ? `${entry.badgeCount} badges` : null
    case 'trainingLevel': return entry.view ? `TL ${entry.view.derived.trainingLevel}` : null
    case 'tier': return entry.view ? `Tier ${entry.view.tier}` : null
    case 'raced': return null
    case 'bestAptitude': {
      if (!parameter) return null
      const key = parameter.replace('aptitude:', '')
      const grade = (entry.aptitudes.surface as Record<string, Grade>)[key]
        ?? (entry.aptitudes.distance as Record<string, Grade>)[key]
      return grade ? `${titleCase(key)} ${grade}` : null
    }
    default: return null
  }
}
