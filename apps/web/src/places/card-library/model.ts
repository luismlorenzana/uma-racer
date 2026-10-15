// The Card Library's view model (docs/rework/06-cards-and-bonds.md §1–§4, §6, §10; Collection "Card album", D238; T138):
// every SSR in the content, open (D329), through a lens (All or one playable scenario) and an optional Uma whose
// scenario the lens follows. A tile's pill is the Umas bonded in their current tier, or, with an Uma, her `bondStatus`:
// a bond mark, the grade she needs (`bondGrade`) or a lock. The card page's pay (`cardPay`), skills by node, bond cost
// per tier (`bondDishId`, `sessionSeconds`), who is bonded and where, and who could bond it now; the Bond picker's rows
// and reasons. Pure.
import { clockTime, fill, type OperationEnv } from '@racer/domain/rework/check-in'
import { itemById } from '@racer/domain/rework/items'
import { workAhead } from '@racer/domain/rework/planner'
import { isRefusal, scenarioNumber, scenarioPlayable, scenarioRow, type Tier, type UmaState } from '@racer/domain/rework/tiers'
import {
  bondDishId, bondGrade, bondStatus, cardFocus, cardNodeSkills, cardPay, dojoRoomOf, sessionSeconds, type BondStatus, type CardFocus,
  type CardPay,
} from '@racer/domain/rework/training'
import { endsAt, freeAt, itemEnds, speedAt, statusOf, type WorkRow, type WorkState } from '@racer/domain/rework/work'
import type { DistanceCategory, SupportCardTemplate } from '@racer/domain'
import type { AlbumQuery, AlbumRow, FacetDef, SortDef, SortDirection } from '../../ui/album/query'
import { DISTANCE_LABEL, duration, STAT_LABEL, STYLE_LABEL } from '../../ui/labels'

export type Content = OperationEnv['content']
export const LIBRARY_ALBUM = 'card-library'

/** The lens: every card, or one playable scenario's (06 §6: 14 until the 15th ships). */
export type Lens = 'all' | number

export const PLAYABLE: readonly number[] = Array.from({ length: 15 }, (_, i) => i + 1).filter(scenarioPlayable)

/** The lens as the album's `mode`: `all` or `s<T>`. */
export const lensMode = (lens: Lens): string => (lens === 'all' ? 'all' : `s${lens}`)
export const LENS_MODES: readonly string[] = ['all', ...PLAYABLE.map((T) => `s${T}`)]
export function lensOf(mode: string | null): Lens {
  const T = mode !== null && /^s\d+$/.test(mode) ? Number(mode.slice(1)) : NaN
  return PLAYABLE.includes(T) ? T : 'all'
}

/** The lens an Uma sets: her scenario (06 §6 "the lens follows her scenario"). */
export const umaLens = (uma: UmaState): number => scenarioNumber(uma)

export const TYPE_LABEL: Readonly<Record<SupportCardTemplate['type'], string>> = {
  ...STAT_LABEL, friend: 'Friend', group: 'Group',
}

/** A card's family colour for its grade pill (06 §6: "G5" on the family's colour). */
export const TYPE_COLOR: Readonly<Record<SupportCardTemplate['type'], string>> = {
  speed: 'var(--color-stat-speed)', stamina: 'var(--color-stat-stamina)', power: 'var(--color-stat-power)', guts: 'var(--color-stat-guts)',
  wit: 'var(--color-stat-wit)', friend: 'var(--g2-room-friend)', group: 'var(--g2-room-friend)',
}

export const cardName = (card: Pick<SupportCardTemplate, 'charName' | 'title'>): string => `${card.charName} [${card.title}]`

/** "Era 3 · Trackblazer". */
export const eraLabel = (era: number): string => `Era ${era} · ${scenarioRow(Math.min(era, 15)).name}`

// ---- Bond state ---------------------------------------------------------------------------------------------------

/** Her work ahead as unlock refs: her started entries' and her queue's (T128's `unlocksAhead`). */
export const pendingRefs = (state: WorkState, outfitId: string) => workAhead(state.work[outfitId] as WorkRow | undefined)

export type Pill =
  | { readonly kind: 'count'; readonly n: number }
  | { readonly kind: 'bonded' }
  | { readonly kind: 'pending' }
  | { readonly kind: 'grade'; readonly grade: number }
  | { readonly kind: 'locked'; readonly words: string }
  | { readonly kind: 'none' }

/** Her bond state for a card (06 §2): bonded, in her work ahead, available, or locked past her scenario. */
export function bondOf(state: WorkState, uma: UmaState, card: SupportCardTemplate): BondStatus {
  return bondStatus(uma.build, card, scenarioNumber(uma), pendingRefs(state, uma.outfitId))
}

/** The tile's bottom-right pill (06 §6). */
export function pillFor(state: WorkState, uma: UmaState | null, card: SupportCardTemplate): Pill {
  if (uma === null) {
    const n = Object.values(state.umas).filter((other) => other.build.bonds.includes(card.id)).length
    return n > 0 ? { kind: 'count', n } : { kind: 'none' }
  }
  const status = bondOf(state, uma, card)
  if (isRefusal(status)) return { kind: 'locked', words: fill({ text: status.reason, data: status.data }) }
  if (status.status === 'bonded') return { kind: 'bonded' }
  if (status.status === 'pending') return { kind: 'pending' }
  const grade = bondGrade(card.era, uma.tier)
  return grade === null ? { kind: 'none' } : { kind: 'grade', grade }
}

// ---- The album -----------------------------------------------------------------------------------------------------

export interface CardEntry {
  readonly card: SupportCardTemplate
  readonly name: string
  readonly focus: CardFocus
  /** What it pays in the lens; null in All. */
  readonly pay: CardPay | null
  readonly pill: Pill
  /** Umas bonded to it in their current tier. */
  readonly bonded: number
  readonly isNew: boolean
}

const option = (value: string, label: string) => ({ value, label })

export const LIBRARY_FACETS: readonly FacetDef[] = [
  { key: 'bondable', label: 'Bondable now', kind: 'boolean', group: 'Bond' },
  { key: 'bond', label: 'Her bond', kind: 'enum', group: 'Bond', options: [option('bonded', 'Bonded to her'), option('not-bonded', 'Not bonded')] },
  { key: 'bondedAny', label: 'Bonded to any Uma', kind: 'boolean', group: 'Bond' },
  { key: 'inSet', label: 'In a set', kind: 'boolean', group: 'Bond' },
  { key: 'type', label: 'Type', kind: 'enum', group: 'Card', options: Object.entries(TYPE_LABEL).map(([value, label]) => option(value, label)) },
  { key: 'style', label: 'Running style', kind: 'enum', group: 'Card', options: [...Object.entries(STYLE_LABEL).map(([value, label]) => option(value, label)), option('generalist', 'Generalist')] },
  { key: 'distance', label: 'Distance', kind: 'enum', group: 'Card', options: [...Object.entries(DISTANCE_LABEL).map(([value, label]) => option(value, label)), option('generalist', 'Generalist')] },
  { key: 'era', label: 'Era', kind: 'enum', group: 'Card', options: Array.from({ length: 15 }, (_, i) => option(String(i + 1), `Era ${i + 1}`)) },
  { key: 'raceBonus', label: 'Has Race Bonus', kind: 'boolean', group: 'Card' },
  { key: 'isNew', label: 'New', kind: 'boolean', group: 'Card' },
]

export const LIBRARY_SORTS: readonly SortDef[] = [
  { key: 'era', label: 'Era', defaultDirection: 'desc' },
  { key: 'type', label: 'Type', defaultDirection: 'asc' },
  { key: 'character', label: 'Character', defaultDirection: 'asc' },
  { key: 'name', label: 'Card name', defaultDirection: 'asc' },
  { key: 'pay', label: 'Per-node pay', defaultDirection: 'desc' },
  { key: 'raceBonus', label: 'Race Bonus', defaultDirection: 'desc' },
  { key: 'bonded', label: 'Umas bonded', defaultDirection: 'desc' },
]

/** Era and release newest first, then name (06 §6, Collection "Default sorts"). */
export const LIBRARY_TIE_BREAK: readonly { key: string; direction: SortDirection }[] = [
  { key: 'release', direction: 'desc' },
  { key: 'name', direction: 'asc' },
]

export const LIBRARY_DEFAULT_QUERY: AlbumQuery = { search: '', filters: {}, sort: 'era', direction: 'desc', group: null, view: 'icons', mode: 'all' }

const TYPE_ORDER = Object.keys(TYPE_LABEL)

export interface LibraryAlbum {
  readonly lens: Lens
  readonly entries: ReadonlyMap<string, CardEntry>
  readonly rows: readonly AlbumRow[]
}

/**
 * Every card through the lens and, when chosen, her bond state. With an Uma the lens is her scenario. `eligible` limits
 * the album to cards a caller offers (T139's pick mode).
 */
export function buildLibrary(state: WorkState, content: Content, lens: Lens, uma: UmaState | null, seen: readonly string[], eligible?: (cardId: string) => boolean): LibraryAlbum {
  const at: Lens = uma === null ? lens : umaLens(uma)
  const seenIds = new Set(seen)
  const sets = new Set(Object.values(state.umas).flatMap((other) => Object.values(other.build.presets).flatMap((preset) => preset.cardSetIds)))
  const entries = new Map<string, CardEntry>()
  const rows: AlbumRow[] = []
  for (const card of content.cards.values()) {
    if (eligible !== undefined && !eligible(card.id)) continue
    const focus = cardFocus(card, content.skills)
    const pay = at === 'all' ? null : cardPay(card, at)
    const bonded = Object.values(state.umas).filter((other) => other.build.bonds.includes(card.id)).length
    const pill = pillFor(state, uma, card)
    const entry: CardEntry = { card, name: cardName(card), focus, pay, pill, bonded, isNew: !seenIds.has(card.id) }
    entries.set(card.id, entry)
    const skills = [...card.hintSkillIds, ...card.eventSkillIds].map((id) => content.skills.get(id)?.name ?? '')
    rows.push({
      id: card.id,
      search: [card.charName, card.title, ...skills].join(' ').toLowerCase(),
      facets: {
        bondable: pill.kind === 'grade',
        bond: uma === null ? null : [pill.kind === 'bonded' ? 'bonded' : 'not-bonded'],
        bondedAny: bonded > 0,
        inSet: sets.has(card.id),
        type: [card.type],
        style: [focus.style],
        distance: [focus.distance],
        era: [String(card.era)],
        raceBonus: (card.effectProfile.raceBonus ?? 0) > 0,
        isNew: entry.isNew,
      },
      sorts: {
        era: card.era,
        release: card.jpRelease,
        type: TYPE_ORDER.indexOf(card.type),
        character: card.charName,
        name: card.title,
        pay: pay === null ? null : pay.spPerNode > 0 ? pay.spPerNode : pay.perNodeTotal,
        raceBonus: pay?.raceBonus ?? cardPay(card, card.era).raceBonus,
        bonded,
      },
    })
  }
  return { lens: at, entries, rows }
}

// ---- The card page ------------------------------------------------------------------------------------------------

/** "Speed +84 · Power +36 a node", or "+600 SP a node" for Friend and Group. */
export function payWords(pay: CardPay): string {
  if (pay.spPerNode > 0) return `+${Math.round(pay.spPerNode)} SP a node`
  return pay.split.map(([stat]) => `${STAT_LABEL[stat]} +${Math.round(pay.perNode[stat])}`).join(' · ') + ' a node'
}

/** "+4.9% Racing EXP" (06 §4). */
export const raceBonusWords = (raceBonus: number): string => `+${(raceBonus * 100).toFixed(1)}% Racing EXP`

export interface BondCost {
  /** "Tier 1" or "Tiers 2–3". */
  readonly tiers: string
  readonly dish: string | null
  /** Real time at speed 1 (× k), "3 h 36 m". */
  readonly time: string | null
}

/** The dish and session time a bond takes in each tier, equal tiers joined (06 §2, §6 "Bond cost"). */
export function bondCosts(card: SupportCardTemplate): readonly BondCost[] {
  const each = ([1, 2, 3] as Tier[]).map((tier) => {
    const dishId = bondDishId(card, tier)
    const grade = bondGrade(card.era, tier)
    return { tier, dish: dishId === null ? null : itemById(dishId)?.name ?? dishId, time: grade === null ? null : duration(sessionSeconds(grade)) }
  })
  const out: { tiers: number[]; dish: string | null; time: string | null }[] = []
  for (const cost of each) {
    const last = out.at(-1)
    if (last !== undefined && last.dish === cost.dish && last.time === cost.time) last.tiers.push(cost.tier)
    else out.push({ tiers: [cost.tier], dish: cost.dish, time: cost.time })
  }
  return out.map((cost) => ({
    tiers: cost.tiers.length === 1 ? `Tier ${cost.tiers[0]}` : `Tiers ${cost.tiers[0]}–${cost.tiers.at(-1)}`,
    dish: cost.dish,
    time: cost.time,
  }))
}

export interface BondedRow {
  readonly umaId: string
  /** "T1 · URA Finale". */
  readonly at: string
  /** Each preset holding it, with the nodes it fills: "Mile · n1, n4". */
  readonly presets: readonly string[]
}

/** Who is bonded to it in her current tier, where it sits, and who could bond it now (06 §6 "Bonded to"). */
export function bondedTo(state: WorkState, card: SupportCardTemplate): { readonly bonded: readonly BondedRow[]; readonly could: readonly string[] } {
  const bonded: BondedRow[] = []
  const could: string[] = []
  for (const uma of Object.values(state.umas)) {
    if (uma.build.bonds.includes(card.id)) {
      const presets = (Object.entries(uma.build.presets) as [DistanceCategory, UmaState['build']['presets'][DistanceCategory]][])
        .filter(([, preset]) => preset.cardSetIds.includes(card.id))
        .map(([distance, preset]) => {
          const nodes = Object.entries(preset.assignments).filter(([, cardId]) => cardId === card.id).map(([node]) => node)
          return `${DISTANCE_LABEL[distance]}${nodes.length > 0 ? ` · ${nodes.join(', ')}` : ''}`
        })
      bonded.push({ umaId: uma.outfitId, at: `T${uma.tier} · ${scenarioRow(scenarioNumber(uma)).name}`, presets })
    } else {
      const status = bondOf(state, uma, card)
      if (!isRefusal(status) && status.status === 'available') could.push(uma.outfitId)
    }
  }
  return { bonded, could }
}

/** Every skill its nodes pay, golds first, by name and node (06 §6 "Skills"). */
export const cardSkills = (card: SupportCardTemplate, content: Content) =>
  cardNodeSkills(card, content.skills).map((skill) => ({ ...skill, name: content.skills.get(skill.skillId)?.name ?? skill.skillId }))

/** A bond in progress: "In session · bonds 01:30", or queued behind her running work. */
export function pendingBond(state: WorkState, card: SupportCardTemplate, now: number, utcOffsetMin: number): readonly { readonly umaId: string; readonly words: string }[] {
  const out: { umaId: string; words: string }[] = []
  for (const row of Object.values(state.work)) {
    let found = false
    for (const entry of row.entries) {
      if (entry.request.kind !== 'session') continue
      const k = entry.request.unlocks.findIndex((unlock) => unlock.kind === 'bond' && unlock.target === card.id)
      if (k < 0) continue
      const end = itemEnds(entry.startedAt, entry.seconds, entry.acceleratedMs)[k]!
      out.push({ umaId: row.outfitId, words: end > now ? `In session · bonds ${clockTime(end, utcOffsetMin)}` : 'Bond ready to collect' })
      found = true
    }
    if (!found && row.queue.some((request) => request.kind === 'session' && request.unlocks.some((unlock) => unlock.kind === 'bond' && unlock.target === card.id))) {
      out.push({ umaId: row.outfitId, words: 'Queued to bond' })
    }
  }
  return out
}

// ---- Bond: the Uma picker's rows (06 §6 "Bonding from the card page", §10) ---------------------------------------

export interface BondChoice {
  readonly umaId: string
  /** Why she can't bond it now; null when she can. */
  readonly reason: string | null
  /** The dish, its stock and the time: "Wheat Bread · 2 in Warehouse · 3 h 36 m". */
  readonly line: string | null
  readonly dishId: string | null
  readonly stock: number
  /** Her running session is in the card's Dojo room, so Queue can add the bond behind it. */
  readonly canQueue: boolean
}

export function bondChoice(state: WorkState, uma: UmaState, card: SupportCardTemplate, now: number, env: OperationEnv, utcOffsetMin: number): BondChoice {
  const status = bondOf(state, uma, card)
  const dishId = bondDishId(card, uma.tier)
  const grade = bondGrade(card.era, uma.tier)
  const stock = dishId === null ? 0 : state.items[dishId] ?? 0
  const line = dishId === null || grade === null ? null
    : `${itemById(dishId)?.name ?? dishId} · ${stock} in Warehouse · ${duration(sessionSeconds(grade, speedAt(state, 'dojo')))}`
  const room = dojoRoomOf(card.type)
  const row = state.work[uma.outfitId]
  const running = row?.entries.at(-1)
  const canQueue = row !== undefined && row.slot?.building === 'dojo' && row.slot.room === room && running !== undefined && endsAt(running) > now && row.queue.length < 3
  const base = { umaId: uma.outfitId, line, dishId, stock, canQueue: false }
  if (isRefusal(status)) {
    return { ...base, reason: fill({ text: status.reason, data: status.data }) }
  }
  if (status.status === 'bonded') return { ...base, reason: 'Already bonded' }
  if (status.status === 'pending') return { ...base, reason: 'Already bonding' }
  if (statusOf(row, now) === 'working') {
    const until = freeAt(state, uma.outfitId, now, env)
    return { ...base, canQueue, reason: until === null ? 'Busy' : `Busy until ${clockTime(until, utcOffsetMin)}` }
  }
  return { ...base, reason: null }
}

/** T139's session URL for a bond (06 §6): her, the card type's Dojo room, this card, and the way back. */
export function bondSessionPath(umaId: string, card: SupportCardTemplate, back: string, queue = false): string {
  const search = new URLSearchParams({ session: umaId, room: dojoRoomOf(card.type), unlocks: `bond:${card.id}`, back })
  if (queue) search.set('queue', '1')
  return `/training/dojo?${search.toString()}`
}

/** The Kitchen's job sheet for a dish she lacks (06 §10 "0 in Warehouse · Cook"; T140's). */
export const cookPath = (dishId: string, back: string): string =>
  `/farm/kitchen?${new URLSearchParams({ job: dishId, back }).toString()}`
