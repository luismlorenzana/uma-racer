// The Stable's view model (docs/rework/11-hub-and-places.md §3.1, §5; docs/rework/04-tiers-and-promotion.md §6, §10;
// docs/rework/03-uma-progression.md §2, §12; Collection "Uma album", D176, D181): every outfit in the content as an album
// entry, Owned and Locked, the default order (lifetime level, then newest release, then name), each tile's "T2 · Lv 13",
// Ready from the readiness rules, the planner's targets and the Hall of Fame; the ticket note and when the Shard exchange
// shows; the roster line; and what an Uma is doing. Pure: the screens draw what this returns. The Uma picker (D181) and
// the profile's previous and next order read the same album.
import { placeById, type PlaceId } from '@racer/domain/hub'
import { clockTime, type OperationEnv } from '@racer/domain/check-in'
import { farmExpAtLevel, farmExpToNext, FARM_LEVEL_CAP, QUARTERS_PER_EXP } from '@racer/domain/farm'
import { advanceReadiness, lifetimeLevel, promotionReadiness, racingExpToNext, scenarioNumber, scenarioRow, TIER_REFUSALS, UMA_SHARDS_PER_TICKET } from '@racer/domain/tiers'
import { isRefusal, type Tier, type UmaState } from '@racer/domain/state'
import { deriveUmaPreset, loadoutSummary } from '@racer/domain/training'
import { endsAt, finishedCount, settle, statusOf, type WorkState } from '@racer/domain/work'
import type { RaceResultRow } from '@racer/domain/save'
import type { DistanceCategory, UmaTemplate } from '@racer/domain'
import {
  emptyStateHint, runAlbumQuery, type AlbumQuery, type AlbumResult, type AlbumRow, type FacetDef, type SortDef, type SortDirection,
} from '../../ui/album/query'

export type Content = OperationEnv['content']
export type StableTab = 'owned' | 'locked'
export const STABLE_TABS: readonly StableTab[] = ['owned', 'locked']
export const STABLE_ALBUM = 'stable'

export interface StableEntry {
  readonly id: string
  readonly template: UmaTemplate
  readonly name: string
  readonly outfit: string | null
  /** Her state; null while she is locked. */
  readonly uma: UmaState | null
  readonly owned: boolean
  /** "T2 · Lv 13": her tier and Racing Level, never the lifetime number (03 §2). Null while locked. */
  readonly level: string | null
  /** Lifetime level, for the order only (03 §2). */
  readonly lifetime: number | null
  /** Ready to advance (03 §5) or promote (04 §5), from the readiness rules. */
  readonly ready: 'advance' | 'promote' | null
  /** One of the planner's targets (02 §6). */
  readonly target: boolean
  /** Inducted into the Hall of Fame (04 §10): a gold frame. */
  readonly hallOfFame: boolean
  readonly isNew: boolean
  readonly scenario: string | null
}

const GRADE_RANK = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] as const
const strong = (grades: Readonly<Record<string, string>>): string[] =>
  Object.entries(grades).filter(([, grade]) => grade === 'S' || grade === 'A').map(([key]) => key)

const option = (value: string, label: string) => ({ value, label })

export const STABLE_FACETS: readonly FacetDef[] = [
  { key: 'tier', label: 'Tier', kind: 'enum', group: 'Uma', options: [option('1', 'Tier 1'), option('2', 'Tier 2'), option('3', 'Tier 3')] },
  { key: 'ready', label: 'Ready to advance or promote', kind: 'boolean', group: 'Uma' },
  { key: 'target', label: 'Planner target', kind: 'boolean', group: 'Uma' },
  { key: 'isNew', label: 'New', kind: 'boolean', group: 'Uma' },
  {
    key: 'distance', label: 'Distance A or better', kind: 'enum', group: 'Aptitude',
    options: [option('sprint', 'Sprint'), option('mile', 'Mile'), option('medium', 'Medium'), option('long', 'Long')],
  },
  { key: 'surface', label: 'Surface A or better', kind: 'enum', group: 'Aptitude', options: [option('turf', 'Turf'), option('dirt', 'Dirt')] },
  {
    key: 'strategy', label: 'Style A or better', kind: 'enum', group: 'Aptitude',
    options: [option('front', 'Front Runner'), option('pace', 'Pace Chaser'), option('late', 'Late Surger'), option('end', 'End Closer')],
  },
]

export const STABLE_SORTS: readonly SortDef[] = [
  { key: 'level', label: 'Level', defaultDirection: 'desc' },
  { key: 'release', label: 'Release', defaultDirection: 'desc' },
  { key: 'name', label: 'Name', defaultDirection: 'asc' },
  { key: 'tier', label: 'Tier', defaultDirection: 'desc' },
  { key: 'racing', label: 'Racing Level', defaultDirection: 'desc' },
  { key: 'farm', label: 'Farm Level', defaultDirection: 'desc' },
]

/** D181: lifetime level highest first, then release newest, then name. */
export const STABLE_TIE_BREAK: readonly { key: string; direction: SortDirection }[] = [
  { key: 'release', direction: 'desc' },
  { key: 'name', direction: 'asc' },
]

export const STABLE_DEFAULT_QUERY: AlbumQuery = { search: '', filters: {}, sort: 'level', direction: 'desc', group: null, view: 'icons', mode: null }

/** "T1 · URA Finale · Racing Lv 1 · Farm Lv 1" (03 §12). */
export function profileLine(uma: UmaState): string {
  return `T${uma.tier} · ${scenarioRow(scenarioNumber(uma)).name} · Racing Lv ${uma.racing.level} · Farm Lv ${uma.farm.level}`
}

/** "T2 · Lv 13": the tile's level, her tier and Racing Level. */
export const levelLabel = (uma: Pick<UmaState, 'tier' | 'racing'>): string => `T${uma.tier} · Lv ${uma.racing.level}`

/** Ready to advance or promote, by the rules' own readiness (03 §5, 04 §5). */
export function readiness(state: WorkState, uma: UmaState): 'advance' | 'promote' | null {
  if (!isRefusal(advanceReadiness(uma))) return 'advance'
  if (!isRefusal(promotionReadiness(state, uma.outfitId))) return 'promote'
  return null
}

export interface StableAlbum {
  readonly entries: ReadonlyMap<string, StableEntry>
  readonly rows: readonly AlbumRow[]
  readonly owned: number
  readonly locked: number
}

/** Every outfit in the content as the album's entries and rows. `seen` holds the ids whose NEW mark is gone. */
export function buildStableAlbum(state: WorkState, content: Content, seen: readonly string[]): StableAlbum {
  const seenIds = new Set(seen)
  const targets = new Set(state.profile.targets)
  const entries = new Map<string, StableEntry>()
  const rows: AlbumRow[] = []
  for (const template of content.umas.values()) {
    const uma = state.umas[template.id] ?? null
    const entry: StableEntry = {
      id: template.id,
      template,
      name: template.name,
      outfit: template.outfit,
      uma,
      owned: uma !== null,
      level: uma === null ? null : levelLabel(uma),
      lifetime: uma === null ? null : lifetimeLevel(uma.tier, uma.racing.level),
      ready: uma === null ? null : readiness(state, uma),
      target: targets.has(template.id),
      hallOfFame: uma?.hallOfFame != null,
      isNew: uma !== null && !seenIds.has(template.id),
      scenario: uma === null ? null : scenarioRow(scenarioNumber(uma)).name,
    }
    entries.set(entry.id, entry)
    rows.push({
      id: entry.id,
      search: [entry.name, entry.outfit ?? ''].join(' ').toLowerCase(),
      facets: {
        ownership: [entry.owned ? 'owned' : 'locked'],
        tier: uma === null ? null : [String(uma.tier)],
        ready: entry.ready !== null,
        target: entry.target,
        isNew: entry.isNew,
        distance: strong(template.aptitudes.distance),
        surface: strong(template.aptitudes.surface),
        strategy: strong(template.aptitudes.strategy),
      },
      sorts: {
        level: entry.lifetime,
        release: template.jpRelease,
        name: entry.name,
        tier: uma?.tier ?? null,
        racing: uma?.racing.level ?? null,
        farm: uma?.farm.level ?? null,
      },
    })
  }
  const owned = rows.filter((row) => (row.facets['ownership'] as string[])[0] === 'owned').length
  return { entries, rows, owned, locked: rows.length - owned }
}

/** The rows of one tab. */
export const tabRows = (album: StableAlbum, tab: StableTab): AlbumRow[] =>
  album.rows.filter((row) => (row.facets['ownership'] as string[])[0] === tab)

export interface StableQuery {
  readonly result: AlbumResult
  readonly entries: readonly StableEntry[]
  readonly emptyHint: ReturnType<typeof emptyStateHint>
}

/** One tab under the album's query, in its order. */
export function queryStable(album: StableAlbum, tab: StableTab, query: AlbumQuery): StableQuery {
  const rows = tabRows(album, tab)
  const result = runAlbumQuery(rows, STABLE_FACETS, query, STABLE_TIE_BREAK)
  return { result, entries: result.rows.map((row) => album.entries.get(row.id)!), emptyHint: emptyStateHint(rows, STABLE_FACETS, query) }
}

/** The tab the Stable opens on: the asked one, else Owned, or Locked while nothing is owned (11 §2.4). */
export const openingTab = (asked: string | null, owned: number): StableTab =>
  asked === 'owned' || asked === 'locked' ? asked : owned === 0 ? 'locked' : 'owned'

// ---- Uma Tickets and Shards (04 §6) ---------------------------------------------------------------------------------

export interface TicketNote {
  /** "2 · 3/5": tickets in hand, and the Shards toward the next, held at 5/5 once a ticket can be made (11 §2.1). */
  readonly text: string
  readonly tickets: number
  readonly shards: number
  /** The Exchange button shows only when five Shards make a ticket. */
  readonly canExchange: boolean
}

export function ticketNote(profile: WorkState['profile']): TicketNote {
  const shown = Math.min(profile.umaShards, UMA_SHARDS_PER_TICKET)
  return {
    text: `${profile.umaTickets} · ${shown}/${UMA_SHARDS_PER_TICKET}`,
    tickets: profile.umaTickets,
    shards: profile.umaShards,
    canExchange: profile.umaShards >= UMA_SHARDS_PER_TICKET,
  }
}

/** Why Unlock is off: `no-ticket`'s words with her name, and the Shards line; null while a ticket is in hand. */
export function unlockBlocked(profile: WorkState['profile'], name: string): { readonly reason: string; readonly shards: string } | null {
  if (profile.umaTickets >= 1) return null
  return {
    reason: TIER_REFUSALS['no-ticket'].replace('{uma}', name),
    shards: `Uma Shards ${Math.min(profile.umaShards, UMA_SHARDS_PER_TICKET)}/${UMA_SHARDS_PER_TICKET}`,
  }
}

// ---- The roster at a glance (11 §3.1's Peek) ------------------------------------------------------------------------

/** "23 Umas · T1 21 · T2 2": Umas owned, then each tier that has any. */
export function rosterLine(state: Pick<WorkState, 'umas'>): string {
  const umas = Object.values(state.umas)
  const byTier = ([1, 2, 3] as Tier[]).map((tier) => [tier, umas.filter((uma) => uma.tier === tier).length] as const).filter(([, n]) => n > 0)
  return [`${umas.length} Uma${umas.length === 1 ? '' : 's'}`, ...byTier.map(([tier, n]) => `T${tier} ${n}`)].join(' · ')
}

/** Umas ready to advance or promote, in D181's order. */
export function readyUmas(state: WorkState, content: Content): readonly { readonly uma: UmaState; readonly ready: 'advance' | 'promote' }[] {
  const album = buildStableAlbum(state, content, Object.keys(state.umas))
  return queryStable(album, 'owned', STABLE_DEFAULT_QUERY).entries
    .flatMap((entry) => (entry.ready === null || entry.uma === null ? [] : [{ uma: entry.uma, ready: entry.ready }]))
}

// ---- What she's doing (11 §5) ---------------------------------------------------------------------------------------

export type Doing =
  | { readonly kind: 'free' }
  | {
    readonly kind: 'working' | 'ready'
    readonly place: PlaceId
    /** Items or unlocks finished in her current entry, and how many it has. */
    readonly done: number
    readonly of: number
    /** When her current entry ends. */
    readonly endsAt: number
    /** Requests queued behind it. */
    readonly queued: number
  }

/** Her work at `now`, on a settled state: Free, Working with her current entry's count and end, or Ready. */
export function doingOf(state: WorkState, outfitId: string, now: number): Doing {
  const row = state.work[outfitId]
  const status = statusOf(row, now)
  if (row === undefined || status === 'free' || row.slot === null) return { kind: 'free' }
  const entry = row.entries[row.entries.length - 1]!
  return {
    kind: status,
    place: row.slot.building as PlaceId,
    done: Math.min(entry.seconds.length, finishedCount(entry, now)),
    of: entry.seconds.length,
    endsAt: endsAt(entry),
    queued: row.queue.length,
  }
}

/** "Kitchen · 2 of 4 · 16:40", "Kitchen · Ready", or "Free". */
export function doingWords(doing: Doing, utcOffsetMin: number): string {
  if (doing.kind === 'free') return 'Free'
  const place = placeById(doing.place)?.name ?? doing.place
  if (doing.kind === 'ready') return `${place} · Ready`
  const queued = doing.queued > 0 ? ` · +${doing.queued} queued` : ''
  return `${place} · ${doing.done} of ${doing.of} · ${clockTime(doing.endsAt, utcOffsetMin)}${queued}`
}

/** `doingOf` after the queues due by `now` have started. */
export const doingNow = (state: WorkState, outfitId: string, now: number, env: OperationEnv): Doing =>
  doingOf(settle(state, now, env).state, outfitId, now)

// ---- Her EXP bars (03 §2, 07 §4) ------------------------------------------------------------------------------------

export interface ExpBar {
  readonly exp: number
  /** What the bar fills toward; null where EXP stops (her tier's last gate, Farm Lv 50). */
  readonly toNext: number | null
  readonly fill: number
}

export function racingBar(uma: UmaState): ExpBar {
  const toNext = racingExpToNext(uma)
  return { exp: uma.racing.exp, toNext, fill: toNext === null ? 1 : Math.min(1, uma.racing.exp / toNext) }
}

export function farmBar(uma: UmaState): ExpBar {
  if (uma.farm.level >= FARM_LEVEL_CAP) return { exp: 0, toNext: null, fill: 1 }
  const into = Math.floor(uma.farm.exp / QUARTERS_PER_EXP) - farmExpAtLevel(uma.farm.level)
  const toNext = farmExpToNext(uma.farm.level)
  return { exp: into, toNext, fill: Math.min(1, Math.max(0, into / toNext)) }
}

/** The aptitude grades in rank order, for a compact line ("Mile A · Pace A"). */
export const gradeRank = (grade: string): number => GRADE_RANK.indexOf(grade as (typeof GRADE_RANK)[number])

// ---- The profile: Skills (03 §6, D188, D196) --------------------------------------------------------------------------

export interface SkillRow {
  readonly skillId: string
  readonly name: string
  readonly gold: boolean
  /** Her own unique: always equipped, free, first. */
  readonly unique: boolean
  readonly equipped: boolean
  /** What equipping it would add to the loadout's SP; null where no Equip shows. */
  readonly adds: number | null
}

export interface SkillsView {
  readonly preset: DistanceCategory
  /** "SP 340 / 600": what the loadout costs against her SP in this preset. */
  readonly cost: number
  readonly skillPoints: number
  /** Her unique, then the equipped skills in equip order. */
  readonly equipped: readonly SkillRow[]
  /** The rest of her library, in its order. */
  readonly library: readonly SkillRow[]
  /** The equipped skills `set-loadout` takes (her unique left out), in order. */
  readonly loadout: readonly string[]
}

/** The selected preset's library and loadout (03 §6): `deriveUmaPreset`'s library, priced by `loadoutSummary`. */
export function skillsView(uma: UmaState, preset: DistanceCategory, content: Content): SkillsView {
  const derived = deriveUmaPreset(uma, preset, content)
  const template = content.umas.get(uma.outfitId)
  const unique = template?.uniqueSkillId ?? null
  const summary = loadoutSummary(uma, preset, content)
  const loadout = summary.entries.map((entry) => entry.skillId)
  const row = (skillId: string, equipped: boolean, adds: number | null): SkillRow => {
    const skill = content.skills.get(skillId)
    return { skillId, name: skill?.name ?? skillId, gold: skill?.kind === 'gold', unique: skillId === unique, equipped, adds }
  }
  const equipped = [
    ...(unique !== null && derived.library.some((skill) => skill.skillId === unique) ? [row(unique, true, null)] : []),
    ...loadout.map((id) => row(id, true, null)),
  ]
  const library = derived.library
    .filter((skill) => skill.skillId !== unique && !loadout.includes(skill.skillId))
    .map((skill) => {
      const equippable = !summary.unequippable.includes(skill.skillId)
      return row(skill.skillId, false, equippable ? loadoutSummary(uma, preset, content, [...loadout, skill.skillId]).cost - summary.cost : null)
    })
  return { preset, cost: summary.cost, skillPoints: summary.skillPoints, equipped, library, loadout }
}

/** The loadout with `skillId` moved `by` places (−1 up, +1 down), for `set-loadout`'s order. */
export function moved(loadout: readonly string[], skillId: string, by: -1 | 1): readonly string[] {
  const at = loadout.indexOf(skillId)
  const to = at + by
  if (at < 0 || to < 0 || to >= loadout.length) return loadout
  const next = [...loadout]
  next.splice(at, 1)
  next.splice(to, 0, skillId)
  return next
}

// ---- The profile: her career and races (03 §4, 09 §9) ---------------------------------------------------------------

const STAGE_LABEL: Readonly<Record<string, string>> = { maiden: 'Maiden', trials: 'Trials', main: 'Main' }

export interface CareerGoalRow {
  readonly id: string
  readonly stage: string
  readonly race: string
  readonly status: 'active' | 'completed' | 'missed'
}

export interface CareerView {
  /** "Trials" while a goal there is open, or "Complete". */
  readonly stage: string
  readonly won: number
  readonly goals: readonly CareerGoalRow[]
  /** Careers she has finished before this one, this tier and earlier. */
  readonly closed: number
}

export function careerOf(uma: UmaState, content: Content): CareerView {
  const raceName = (raceId: string | null): string => (raceId === null ? '' : content.races.find((race) => race.id === raceId)?.name ?? raceId)
  const goals = uma.career.goals.map((goal): CareerGoalRow => ({
    id: goal.id,
    stage: STAGE_LABEL[goal.slot] ?? goal.slot,
    race: goal.series === null ? raceName(goal.raceId) : goal.series.legs.map((leg) => raceName(leg.raceId)).join(' · '),
    status: goal.status,
  }))
  const open = goals.find((goal) => goal.status === 'active')
  return {
    stage: uma.career.state === 'completed' || open === undefined ? 'Complete' : open.stage,
    won: goals.filter((goal) => goal.status === 'completed').length,
    goals,
    closed: uma.closedCareers.length,
  }
}

export interface ResultRow {
  readonly id: string
  readonly race: string
  readonly place: number | null
  readonly paid: number
  readonly at: number
}

/** Her latest results from the `raceResults` log, newest first. */
export function latestResults(results: readonly RaceResultRow[] | undefined, umaId: string, content: Content, limit = 5): readonly ResultRow[] {
  return (results ?? []).filter((row) => row.umaId === umaId).slice(-limit).reverse().map((row) => ({
    id: row.opId,
    race: content.races.find((race) => race.id === row.raceId)?.name ?? row.raceId,
    place: row.run.field.find((runner) => runner.isPlayer)?.placement ?? null,
    paid: row.commit.prize.paid + row.commit.prize.featuredBonus,
    at: row.at,
  }))
}

/** 1st, 2nd, 3rd, 4th … */
export const ordinal = (n: number): string => {
  const tens = n % 100
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${suffix}`
}
