// What every Training screen reads the same way (docs/rework/05-training-hub.md §2, §3, §8; T139): an unlock's name and
// dish in words, where an unlock stands for her now (open, in her work, available with its stock, waiting on what it
// names, or in a later layer), the line a locked item shows with what it needs, and the session sheet's link. Pure:
// the states are the domain's `unlockStatus`, `dependenciesOf` and the work timeline, read, never restated.
import { clockTime, type OperationEnv, type Words } from '@racer/domain/check-in'
import { BUILDINGS, type FacilityId, type RoomId } from '@racer/domain/farm'
import { itemById, type ItemId } from '@racer/domain/items'
import { workAhead } from '@racer/domain/planner'
import { isRefusal, scenarioRow, type UmaState } from '@racer/domain/tiers'
import {
  dependenciesOf, facilityOf, isOpen, isRoomOf, roomsFor, unlockKey, unlockLabel, unlockStatus, type Unlock, type UnlockRef,
} from '@racer/domain/training'
import { itemEnds, SESSION_KIND, stockOf, type ItemStock, type WorkRow } from '@racer/domain/work'
import { showWords, type WordsContext } from '../../ui/work/words'
import { cardName } from '../../ui/words'
import { trainingWords } from './words'

export type Content = OperationEnv['content']

/** The four facilities' route ids, which are their building ids (11 §3.2). */
export const FACILITIES: readonly FacilityId[] = ['observatory', 'lineage-hall', 'gym', 'dojo']
export const isFacilityId = (id: string): id is FacilityId => (FACILITIES as readonly string[]).includes(id)

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

/** An unlock as a screen names it: "Node 7", "Slot B1", "A1's unique", "Speed grade 3", or a bond's card. */
export function unlockName(ref: UnlockRef, content: Content | null): string {
  return ref.kind === 'bond' ? cardName(content, ref.target) : capital(unlockLabel(ref))
}

/** "Cabbage Salad (grade 3)": a dish by name and grade, never by its catalogue key (T139, 08 §10). */
export function dishWords(dishId: ItemId): string {
  const def = itemById(dishId)
  if (def === undefined || def.kind === 'ticket') return dishId
  return trainingWords('dish', { name: def.name, grade: def.grade })
}

/** A rule's words for the screen: card ids by the Library's names, a lineage candidate by hers, the rest by `showWords`. */
export function ruleWords(words: Words, context: WordsContext, content: Content | null): string {
  const data = words.data
  if (data === undefined) return words.text
  const named: Record<string, string | number> = { ...data }
  for (const key of ['card', 'other'] as const) {
    const value = data[key]
    if (typeof value === 'string') named[key] = cardName(content, value)
  }
  const item = data['item']
  if (typeof item === 'string' && content?.cards.has(item)) named['item'] = cardName(content, item)
  const candidate = data['candidate']
  if (typeof candidate === 'string') named['candidate'] = context.umaName(candidate) || candidate
  return showWords({ text: words.text, data: named }, context)
}

// ---- Where an unlock stands -----------------------------------------------------------------------------------------

/** One unlock for her now, as every Training screen reads it (05 §8). */
export type ItemState =
  | { readonly kind: 'open' }
  /** In a started entry of hers, opening at `at`. */
  | { readonly kind: 'session'; readonly at: number }
  /** Finished in her work, not yet collected. */
  | { readonly kind: 'finished' }
  | { readonly kind: 'queued' }
  /** She can start it now; `stock` is its dish's free stock. */
  | { readonly kind: 'available'; readonly stock: number }
  /** It waits on these (`dependenciesOf`, less what's open or in her work). */
  | { readonly kind: 'waiting'; readonly needs: readonly UnlockRef[] }
  /** A later layer, or a card past her scenario: "Opens in scenario 3 · Trackblazer". */
  | { readonly kind: 'later'; readonly words: Words }

/** Where `ref` sits in her work: a started entry's item (with its end) or her queue. */
function inWork(row: WorkRow | undefined, ref: UnlockRef): { readonly at: number } | 'queued' | null {
  if (row === undefined) return null
  for (const entry of row.entries) {
    if (entry.request.kind !== SESSION_KIND) continue
    const k = entry.request.unlocks.findIndex((unlock) => unlock.kind === ref.kind && unlock.target === ref.target)
    if (k >= 0) return { at: itemEnds(entry.startedAt, entry.seconds, entry.acceleratedMs)[k]! }
  }
  const queued = row.queue.some((request) => request.kind === SESSION_KIND && request.unlocks.some((unlock) => unlock.kind === ref.kind && unlock.target === ref.target))
  return queued ? 'queued' : null
}

/** Her unlock `entry` now: the domain's `unlockStatus` with her work ahead, and the timeline for what she's working on. */
export function itemState(uma: UmaState, row: WorkRow | undefined, entry: Unlock, now: number, items: ItemStock): ItemState {
  if (isOpen(uma.build, entry)) return { kind: 'open' }
  const work = inWork(row, entry)
  if (work === 'queued') return { kind: 'queued' }
  if (work !== null) return work.at <= now ? { kind: 'finished' } : { kind: 'session', at: work.at }
  const ahead = workAhead(row)
  const status = unlockStatus(uma.build, uma, entry, ahead)
  if (!isRefusal(status)) {
    return status.status === 'available' ? { kind: 'available', stock: stockOf(items, entry.dishId) } : { kind: 'open' }
  }
  if (status.code === 'needs-first') {
    const made = new Set(ahead.map(unlockKey))
    return { kind: 'waiting', needs: dependenciesOf(entry).filter((dep) => !isOpen(uma.build, dep) && !made.has(unlockKey(dep))) }
  }
  return { kind: 'later', words: { text: status.reason, ...(status.data === undefined ? {} : { data: status.data }) } }
}

/** "Power grade 3 and Speed grade 3". */
export function namesList(names: readonly string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * What a locked item shows (05 §8): "Needs: Cabbage Salad (grade 3) at the Observatory · 2 in stock", "Opens after
 * node 14" for a node further on, "Needs: … · Power grade 3 and Speed grade 3 first", "Opens in scenario 3 ·
 * Trackblazer", "In session · opens 04:45", "Finished · Collect". Null once open.
 */
export function itemWords(state: ItemState, entry: Unlock, context: WordsContext, content: Content | null): string | null {
  const place = BUILDINGS[facilityOf(entry.kind)].name
  const dish = dishWords(entry.dishId)
  switch (state.kind) {
    case 'open': return null
    case 'session': return trainingWords('in-session', { time: clockTime(state.at, context.utcOffsetMin) })
    case 'finished': return trainingWords('finished')
    case 'queued': return trainingWords('queued')
    case 'available': return trainingWords('needs-dish', { dish, place, blocker: trainingWords('in-stock', { n: state.stock }) })
    case 'waiting': {
      const needs = namesList(state.needs.map((ref) => unlockLabel(ref)))
      if (entry.kind === 'node') return trainingWords('opens-after', { needs })
      return trainingWords('needs-dish', { dish, place, blocker: trainingWords('first', { needs }) })
    }
    case 'later': return ruleWords(state.words, context, content)
  }
}

/** The room an unlock's Unlock opens: the first `roomsFor` lists, or none where the facility has no rooms (T139). */
export const roomOfUnlock = (entry: Unlock): RoomId | null => roomsFor(entry)[0] ?? null

/** "T1 · URA Finale". */
export const tierLine = (uma: Pick<UmaState, 'tier' | 'scenario'>): string => {
  const row = scenarioRow(5 * (uma.tier - 1) + uma.scenario)
  return trainingWords('tier-line', { tier: uma.tier, name: row.name })
}

// ---- The session sheet's link (11 §7.1, T139) ------------------------------------------------------------------------

export interface SessionLink {
  /** Her outfit; empty or null when the sheet picks her. */
  readonly uma?: string | null
  readonly room?: RoomId | null
  /** What arrives picked: `kind:target`. */
  readonly unlocks?: readonly UnlockRef[]
  /** Where Start returns: an in-app path. */
  readonly back?: string | null
  /** Open on Add to queue: her running session here takes it (T138's Queue). */
  readonly queue?: boolean
  /** The slot card's slot. */
  readonly slot?: number | null
}

/** `/training/:facility?session=:umaId&room=:room&unlocks=<kind>:<target>,…&back=<path>[&queue=1][&slot=n]`. */
export function sessionPath(facility: FacilityId, link: SessionLink = {}): string {
  const params = new URLSearchParams()
  params.set('session', link.uma ?? '')
  if (link.room != null && isRoomOf(facility, link.room)) params.set('room', link.room)
  if (link.unlocks !== undefined && link.unlocks.length > 0) params.set('unlocks', link.unlocks.map((ref) => `${ref.kind}:${ref.target}`).join(','))
  if (link.back) params.set('back', link.back)
  if (link.queue) params.set('queue', '1')
  if (link.slot != null) params.set('slot', String(link.slot))
  return `/training/${facility}?${params.toString()}`
}

/** An unlock's **Unlock**: the sheet with her and that item, at the room it goes to, returning to `back` (05 §12). */
export const unlockPath = (umaId: string, entry: Unlock, back: string): string =>
  sessionPath(facilityOf(entry.kind), { uma: umaId, room: roomOfUnlock(entry), unlocks: [entry], back })
