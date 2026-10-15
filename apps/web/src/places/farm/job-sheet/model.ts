// The job sheet (docs/rework/07-farm.md §3, §5, §10, §11; docs/rework/02-check-ins-and-notifications.md §3, §6, §9;
// T140), one for all ten buildings, opened over a building page by its query. Pure readings of the domain:
// 1. **Uma**: Free first; once an item is chosen, the best suited (`bestExpTenths` over `expFamilies`); then Farm Level,
//    highest first. A session greys her; her running job here offers Add to queue; one elsewhere, Recall and start here.
// 2. **What**: a site's ten raw grades; the Pantry's crafted items in family tabs in `FAMILY_RING` order; the Kitchen's
//    eleven tabs by destination, Duos, Feasts and Can cook now. A grade above her Farm Level shows its lock.
// 3. **How many** and its preview from the kind's own `plan`: minutes per output, the end, the Farm EXP and every input
//    against free stock.
// 4. **Start**, **Add to queue** or **Recall and start here**: each run on the current state first, so a disabled
//    button says why in the rule's own words, and a shortfall links to the building that makes it.
import { buyFor, say, type OperationEnv, type Words } from '@racer/domain/check-in'
import {
  bestExpTenths, BUILDINGS, expFamilies, FAMILY_APTITUDE, familyAptitude, FARM_BUILDING_IDS, farmExpMultiplier, farmItemSeconds, makesHere,
  QUARTERS_PER_EXP, TENTHS, type FarmAptitude, type FarmBuildingId,
} from '@racer/domain/farm'
import {
  craftedItem, DUOS, FAMILIES, FAMILY_RING, familyFor, FEASTS, gradeOpensAtFarmLevel, highestOpenGrade, ITEM_GRADE_LIST, itemById, planetDish,
  rawItem, recipeOf, type Destination, type DishDef, type FamilyId, type ItemDef, type ItemId,
} from '@racer/domain/items'
import { planFrom, remainingFor, targetsOf, type Plan } from '@racer/domain/planner'
import { isRefusal } from '@racer/domain/tiers'
import {
  freeAt, holdsSlot, kindRules, largestCoverable, MAX_ITEMS_PER_ENTRY, MAX_QUEUE, queue, recall, shortfall, slotHolder, slotsOf, speedAt,
  start, statusOf, stockOf, sumInputs, SESSION_KIND, WORK_REFUSALS, type FarmKind, type FarmRequest, type PlannedItem, type QueueInput,
  type SlotRef, type StartInput, type WorkState,
} from '@racer/domain/work'
import type { WorkView } from '../../../ui/work/view'
import { placeName } from '../../../ui/work/words'
import { exchangeRow, farmKindOf, sheetQuery } from '../building/model'
import { farmWords } from '../words'

// --- The query (11 §7.1, T140) ----------------------------------------------------------------------------------------

/** `?job=:itemId&uma=:umaId&count=:n&queue=1&slot=:n&back=<path>`: `job` present opens the sheet, empty for nothing chosen. */
export interface SheetQuery {
  readonly job: ItemId | null
  readonly uma: string | null
  readonly count: number | null
  readonly queue: boolean
  /** The slot card's slot (Start a job, + Queue); the first free one otherwise. */
  readonly slot: number | null
  /** Where Start returns: an in-app path only. */
  readonly back: string | null
}

/** An in-app path (`/town/warehouse?…`), never another origin or a scheme. */
export function inAppPath(value: string | null): string | null {
  if (value === null || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /^\/[^/?#]*:/.test(value)) return null
  return value
}

const whole = (value: string | null, min: number, max: number): number | null => {
  if (value === null || !/^\d+$/.test(value)) return null
  const n = Number(value)
  return n >= min && n <= max ? n : null
}

/** The sheet's query, or null when the page has none. */
export function readSheetQuery(params: URLSearchParams): SheetQuery | null {
  if (!params.has('job')) return null
  const job = params.get('job')
  return {
    job: job !== null && job !== '' ? job : null,
    uma: params.get('uma') || null,
    count: whole(params.get('count'), 1, MAX_ITEMS_PER_ENTRY),
    queue: params.get('queue') === '1',
    slot: whole(params.get('slot'), 0, 99),
    back: inAppPath(params.get('back')),
  }
}

/** The building page's search without the sheet's fields. */
export function withoutSheet(search: string): string {
  const params = new URLSearchParams(search)
  for (const key of ['job', 'uma', 'count', 'queue', 'slot', 'back']) params.delete(key)
  const rest = params.toString()
  return rest === '' ? '' : `?${rest}`
}

// --- What (07 §10) ----------------------------------------------------------------------------------------------------

const KITCHEN_DESTINATIONS: readonly Destination[] = ['speed', 'stamina', 'power', 'guts', 'wit', 'skill', 'constellation', 'inspiration']
const DESTINATION_WORDS: Readonly<Record<Destination, string>> = {
  speed: 'Speed', stamina: 'Stamina', power: 'Power', guts: 'Guts', wit: 'Wit', skill: farmWords('tab-skill'), constellation: 'Constellation',
  inspiration: 'Inspiration',
}
const STAT_WORDS: Readonly<Record<string, string>> = { speed: 'Speed', stamina: 'Stamina', power: 'Power', guts: 'Guts', wit: 'Wit' }

export const CAN_COOK_NOW = 'can-cook-now'

export interface SheetTab {
  readonly id: string
  readonly label: string
  readonly items: readonly ItemId[]
}

const grades = <T extends { readonly id: ItemId }>(make: (g: (typeof ITEM_GRADE_LIST)[number]) => T): ItemId[] => ITEM_GRADE_LIST.map((g) => make(g).id)

/** Whether a dish can be cooked now (Decided here): the free stock covers it once and `level` opens its grade. */
export function canCookNow(state: Pick<WorkState, 'items'>, dish: DishDef, level: number): boolean {
  return level >= gradeOpensAtFarmLevel(dish.grade) && shortfall(state.items, recipeOf(dish.id)?.inputs ?? []).length === 0
}

const ALL_DISHES: readonly DishDef[] = Object.freeze([
  ...KITCHEN_DESTINATIONS.flatMap((destination) => ITEM_GRADE_LIST.map((g) => planetDish(familyFor(destination), g))),
  ...DUOS,
  ...FEASTS,
])

/**
 * The sheet's tabs (07 §10): one untitled list of a site's family's ten raw grades; the Pantry's crafted items by family
 * in `FAMILY_RING` order; the Kitchen's Speed · Stamina · Power · Guts · Wit · Skill bonds · Constellation · Inspiration
 * · Duos · Feasts · Can cook now. `level` is the chosen Uma's Farm Level, or the highest of any Uma's (Can cook now).
 */
export function sheetTabs(building: FarmBuildingId, state: Pick<WorkState, 'items'>, level: number): readonly SheetTab[] {
  const family = BUILDINGS[building].family
  if (family !== null) return [{ id: family, label: FAMILIES[family].name, items: grades((g) => rawItem(family, g)) }]
  if (building === 'pantry') {
    return FAMILY_RING.map((f) => ({ id: f, label: FAMILIES[f].name, items: grades((g) => craftedItem(f, g)) }))
  }
  return [
    ...KITCHEN_DESTINATIONS.map((destination) => ({
      id: destination, label: DESTINATION_WORDS[destination], items: grades((g) => planetDish(familyFor(destination), g)),
    })),
    { id: 'duos', label: farmWords('tab-duos'), items: DUOS.map((duo) => duo.id) },
    { id: 'feasts', label: farmWords('tab-feasts'), items: FEASTS.map((feast) => feast.id) },
    { id: CAN_COOK_NOW, label: farmWords('can-cook-now'), items: ALL_DISHES.filter((dish) => canCookNow(state, dish, level)).map((dish) => dish.id) },
  ]
}

/** The tab an item sits in (its family at the Pantry, its destination at the Kitchen), else the first. */
export function tabOf(tabs: readonly SheetTab[], item: ItemId | null): string {
  const found = item === null ? undefined : tabs.find((tab) => tab.id !== CAN_COOK_NOW && tab.items.includes(item))
  return (found ?? tabs[0]!).id
}

/** What a dish is for (08 §2, §4.3, §4.4): its destination, a Duo's two stats, or the Sun nodes. */
export function destinationWords(def: ItemDef): string | null {
  if (def.kind !== 'dish') return null
  if (def.dish === 'planet') return DESTINATION_WORDS[def.destination]
  if (def.dish === 'duo') return farmWords('to-duo', { a: STAT_WORDS[def.stats[0]] ?? def.stats[0], b: STAT_WORDS[def.stats[1]] ?? def.stats[1] })
  return farmWords('to-sun')
}

export interface SheetItem {
  readonly item: ItemId
  readonly name: string
  readonly grade: number
  /** Free stock. */
  readonly stock: number
  /** **Needed × N**: what the plan's lines still have to start of it; 0 hides it. */
  readonly needed: number
  /** The Farm Level that opens it, when `level` doesn't: "Farm Lv 16". */
  readonly locked: number | null
  /** A dish's destination. */
  readonly destination: string | null
  /** A dish's Umas whose open unlocks want it, targets first. */
  readonly wantedBy: readonly string[]
}

/** Who wants each dish (07 §10): every Uma's open unlocks (`remainingFor`), the targets first, then by outfit. */
export function dishWanters(state: WorkState): ReadonlyMap<ItemId, readonly string[]> {
  const targets = targetsOf(state)
  const order = [...targets, ...Object.keys(state.umas).sort().filter((id) => !targets.includes(id))]
  const wanted = new Map<ItemId, string[]>()
  for (const outfitId of order) {
    for (const entry of remainingFor(state, outfitId)) {
      if (entry.kind !== 'unlock') continue
      const list = wanted.get(entry.dishId) ?? []
      if (!list.includes(outfitId)) list.push(outfitId)
      wanted.set(entry.dishId, list)
    }
  }
  return wanted
}

/** Each plan line's still-to-start count by item. */
export function neededByItem(planned: Plan): ReadonlyMap<ItemId, number> {
  const needed = new Map<ItemId, number>()
  for (const line of [...planned.dishes, ...planned.crafted, ...planned.raw]) needed.set(line.item, (needed.get(line.item) ?? 0) + line.short)
  return needed
}

export function sheetItems(tab: SheetTab, state: WorkState, level: number, needed: ReadonlyMap<ItemId, number>, wanters: ReadonlyMap<ItemId, readonly string[]>): SheetItem[] {
  return tab.items.map((item): SheetItem => {
    const def = itemById(item)!
    const grade = def.kind === 'ticket' ? 1 : def.grade
    const opens = def.kind === 'ticket' ? 1 : gradeOpensAtFarmLevel(def.grade)
    return {
      item,
      name: def.name,
      grade,
      stock: stockOf(state.items, item),
      needed: needed.get(item) ?? 0,
      locked: level >= opens ? null : opens,
      destination: destinationWords(def),
      wantedBy: def.kind === 'dish' ? wanters.get(item) ?? [] : [],
    }
  })
}

// --- Uma (07 §3, §5, §10) ---------------------------------------------------------------------------------------------

const APTITUDE_WORDS: Readonly<Record<FarmAptitude['key'], string>> = {
  sprint: 'Sprint', mile: 'Mile', medium: 'Medium', long: 'Long', front: 'Front Runner', pace: 'Pace Chaser', late: 'Late Surger', end: 'End Closer',
}

export type UmaStatus = 'free' | 'ready' | 'here' | 'elsewhere' | 'session'

export interface UmaRow {
  readonly outfitId: string
  readonly name: string
  readonly farmLevel: number
  /** The highest grade she can work (`highestOpenGrade`). */
  readonly highestGrade: number
  readonly tier: number
  /** Her best family's Farm EXP, in tenths, for the families that count; null when no family is known yet. */
  readonly tenths: number | null
  /** "Sprint A · Farm EXP ×1.6" (07 §3). */
  readonly aptitude: string | null
  readonly status: UmaStatus
  /** When her work ends (`freeAt`), for "in a session until 14:20". */
  readonly until: number | null
  /** Where she works now. */
  readonly place: FarmBuildingId | string | null
  /** False when the sheet can't use her: in a session, or her queue here is full. */
  readonly pickable: boolean
}

/** The families whose aptitude counts: the chosen item's (`expFamilies`), else a site's own. */
export function suitedFamilies(building: FarmBuildingId, item: ItemId | null): readonly FamilyId[] {
  const def = item === null ? undefined : itemById(item)
  if (def !== undefined) return expFamilies(def)
  const own = BUILDINGS[building].family
  return own === null ? [] : [own]
}

/** Her aptitude line for the best of `families` (07 §3), with its tenths. */
export function aptitudeLine(env: OperationEnv, outfitId: string, families: readonly FamilyId[]): { readonly tenths: number; readonly words: string } | null {
  const template = env.content.umas.get(outfitId)
  if (template === undefined || families.length === 0) return null
  const tenths = bestExpTenths(env.content, outfitId, families)
  const best = families.find((family) => farmExpMultiplier(familyAptitude(template.aptitudes, family)) === tenths)!
  const letter = familyAptitude(template.aptitudes, best)
  return { tenths, words: farmWords('aptitude', { aptitude: APTITUDE_WORDS[FAMILY_APTITUDE[best].key], letter, multiplier: tenths / TENTHS }) }
}

/** Every owned Uma for the sheet (07 §10): Free first, then suited for `item`, then Farm Level, highest first. */
export function umaRows(view: WorkView, building: FarmBuildingId, item: ItemId | null): UmaRow[] {
  const { settled, now, env } = view
  const families = suitedFamilies(building, item)
  const rows = Object.values(settled.umas).map((uma): UmaRow => {
    const row = settled.work[uma.outfitId]
    const work = statusOf(row, now)
    const last = row?.entries[row.entries.length - 1]
    const isSession = last?.request.kind === SESSION_KIND
    const status: UmaStatus = work === 'free' ? 'free' : work === 'ready' ? 'ready'
      : isSession ? 'session' : row!.slot!.building === building ? 'here' : 'elsewhere'
    const aptitude = aptitudeLine(env, uma.outfitId, families)
    return {
      outfitId: uma.outfitId,
      name: env.content.umas.get(uma.outfitId)?.name ?? uma.outfitId,
      farmLevel: uma.farm.level,
      highestGrade: highestOpenGrade(uma.farm.level),
      tier: uma.tier,
      tenths: aptitude?.tenths ?? null,
      aptitude: aptitude?.words ?? null,
      status,
      until: work === 'working' ? freeAt(settled, uma.outfitId, now, env) : null,
      place: row?.slot?.building ?? null,
      pickable: status !== 'session' && !(status === 'here' && row!.queue.length >= MAX_QUEUE),
    }
  })
  // Free first (07 §10), then Ready (a start collects her first), then busy Umas the sheet can still take, then the rest.
  const group = (row: UmaRow) => (row.status === 'free' ? 0 : row.status === 'ready' ? 1 : row.pickable ? 2 : 3)
  return rows.sort((a, b) => group(a) - group(b)
    || (item !== null ? (b.tenths ?? 0) - (a.tenths ?? 0) : 0)
    || b.farmLevel - a.farmLevel
    || a.name.localeCompare(b.name)
    || (a.outfitId < b.outfitId ? -1 : 1))
}

/** A row's state line: "in a session until 14:20", "Kitchen until 14:20", "Ready · collected first", "Three are already queued." */
export function umaNote(row: UmaRow, time: (at: number) => string): string | null {
  switch (row.status) {
    case 'free': return null
    case 'ready': return farmWords('ready-first')
    case 'session': return row.until === null ? null : farmWords('in-session', { time: time(row.until) })
    case 'here': return row.pickable ? farmWords('queue-here') : WORK_REFUSALS['queue-full']
    case 'elsewhere': return row.until === null ? null : farmWords('working', { place: placeName(String(row.place)), time: time(row.until) })
  }
}

// --- How many and the preview (07 §10, 02 §3) -------------------------------------------------------------------------

export interface SheetInput {
  readonly item: ItemId
  readonly need: number
  readonly have: number
  readonly short: number
}

export interface SheetPreview {
  readonly kind: FarmKind
  /** When the first item would start: now, or her chain's end for a queued entry (`freeAt`). */
  readonly start: number
  /** Ten items' seconds at today's speed, for the size chips. */
  readonly itemSeconds: readonly number[]
  /** What the free stock covers (`largestCoverable`), at least 1 so ×1 can name its shortfall. */
  readonly max: number
  readonly request: FarmRequest
  /** Real minutes per output at today's speed. */
  readonly minutesEach: number
  readonly endsAt: number
  /** Whole Farm EXP; null without an Uma whose Farm Level opens it. */
  readonly farmExp: number | null
  readonly inputs: readonly SheetInput[]
}

/** The action the sheet's button takes. */
export type SheetMode = 'start' | 'queue' | 'recall-start'

export const modeOf = (row: UmaRow | undefined): SheetMode => (row?.status === 'here' ? 'queue' : row?.status === 'elsewhere' ? 'recall-start' : 'start')

/** The kind's own plan of `count` (07 §10): what Start would freeze into the entry. */
function planned(view: WorkView, building: FarmBuildingId, outfitId: string | null, item: ItemId, mode: SheetMode, slot: SlotRef): readonly PlannedItem[] | null {
  if (outfitId === null) return null
  const { settled, now, env } = view
  const kind = farmKindOf(building)
  const rules = kindRules(env, kind)
  const row = settled.work[outfitId]
  const earlier = mode === 'queue' && row !== undefined ? [...row.entries.map((entry) => entry.request), ...row.queue] : []
  const plan = rules?.plan(settled, outfitId, { kind, item, count: MAX_ITEMS_PER_ENTRY }, now, { slot, speed: speedAt(settled, building), earlier, env })
  return plan === undefined || isRefusal(plan) ? null : plan
}

export function sheetPreview(view: WorkView, building: FarmBuildingId, outfitId: string | null, item: ItemId, count: number | null, mode: SheetMode, slot: SlotRef): SheetPreview | null {
  const def = itemById(item)
  const kind = farmKindOf(building)
  if (def === undefined || def.kind === 'ticket' || !makesHere(kind, def, building)) return null
  const { settled, now, env } = view
  const plan = planned(view, building, outfitId, item, mode, slot)
  const seconds = plan?.map((one) => one.seconds) ?? Array.from({ length: MAX_ITEMS_PER_ENTRY }, () => farmItemSeconds(kind, def.grade, speedAt(settled, building)))
  const inputsEach = plan?.map((one) => one.inputs) ?? Array.from({ length: MAX_ITEMS_PER_ENTRY }, () => recipeOf(item)?.inputs ?? [])
  const items: readonly PlannedItem[] = plan ?? inputsEach.map((inputs, i) => ({ seconds: seconds[i]!, inputs, output: { item }, farmExp: 0 }))
  const max = Math.max(1, largestCoverable(settled.items, items))
  const n = Math.min(Math.max(1, count ?? 1), MAX_ITEMS_PER_ENTRY)
  const begin = mode === 'queue' && outfitId !== null ? freeAt(settled, outfitId, now, env) ?? now : now
  const inputs = sumInputs(inputsEach.slice(0, n)).map(({ item: input, qty }) => {
    const have = stockOf(settled.items, input)
    return { item: input, need: qty, have, short: Math.max(0, qty - have) }
  })
  return {
    kind,
    start: begin,
    itemSeconds: seconds,
    max,
    request: { kind, item, count: n },
    minutesEach: seconds[0]! / 60,
    endsAt: begin + seconds.slice(0, n).reduce((sum, s) => sum + s, 0) * 1000,
    farmExp: plan === null ? null : Math.round(plan.slice(0, n).reduce((sum, one) => sum + one.farmExp, 0) / QUARTERS_PER_EXP),
    inputs,
  }
}

// --- Start, Add to queue, Recall and start here (07 §5, §10) ----------------------------------------------------------

/** The slot a start takes: the card's when it is free (or hers), else hers here, else the first free one in `slotsOf` order. */
export function chooseSlot(settled: WorkState, building: FarmBuildingId, outfitId: string | null, asked: number | null): SlotRef | null {
  const slots = slotsOf(settled, building)
  const usable = (slot: SlotRef) => {
    const holder = slotHolder(settled, slot)
    return holder === undefined || holder === outfitId
  }
  const card = asked === null ? undefined : slots.find((slot) => slot.slot === asked)
  if (card !== undefined && usable(card)) return card
  const mine = outfitId === null ? undefined : slots.find((slot) => slotHolder(settled, slot) === outfitId)
  return mine ?? slots.find((slot) => slotHolder(settled, slot) === undefined) ?? null
}

/** Why no slot is free: one is ready to collect, or when the next job here ends. */
export function noSlotWords(view: WorkView, building: FarmBuildingId, time: (at: number) => string): string {
  const { settled, now, env } = view
  const holders = Object.values(settled.work).filter((row) => holdsSlot(row) && row.slot!.building === building)
  if (holders.some((row) => statusOf(row, now) === 'ready')) return farmWords('no-slot-ready')
  const ends = holders.map((row) => freeAt(settled, row.outfitId, now, env)).filter((at): at is number => at !== null)
  return farmWords('no-slot', { time: time(Math.min(...ends)) })
}

export type SheetAction =
  | { readonly mode: 'start'; readonly input: StartInput; readonly refusal: Words | null }
  | { readonly mode: 'queue'; readonly input: QueueInput; readonly refusal: Words | null }
  | { readonly mode: 'recall-start'; readonly input: StartInput; readonly refusal: Words | null }
  /** Nothing to run yet: pick an Uma or an item, no Umas, or no free slot. */
  | { readonly mode: 'blocked'; readonly words: string }

const refusalOf = (result: unknown): Words | null => (isRefusal(result) ? say(result.reason, result.data) : null)

/** What the button does, each operation run on the current state first so a refusal reads in its own words. */
export function sheetAction(view: WorkView, building: FarmBuildingId, row: UmaRow | undefined, item: ItemId | null, count: number, slotAsked: number | null, time: (at: number) => string): SheetAction {
  const { settled, now, env } = view
  if (Object.keys(settled.umas).length === 0) return { mode: 'blocked', words: farmWords('no-umas') }
  if (row === undefined) return { mode: 'blocked', words: farmWords('pick-uma') }
  if (item === null) return { mode: 'blocked', words: farmWords('pick-item') }
  const request: FarmRequest = { kind: farmKindOf(building), item, count }
  const mode = modeOf(row)
  if (mode === 'queue') {
    const input: QueueInput = { outfitId: row.outfitId, add: { request, building } }
    return { mode, input, refusal: refusalOf(queue(settled, input, now, env)) }
  }
  const slot = chooseSlot(settled, building, row.outfitId, slotAsked)
  if (slot === null) return { mode: 'blocked', words: noSlotWords(view, building, time) }
  const input: StartInput = { outfitId: row.outfitId, slot, request }
  if (mode === 'recall-start') {
    const recalled = recall(settled, { outfitId: row.outfitId }, now, env).state
    return { mode, input, refusal: refusalOf(start(recalled, input, now, env)) }
  }
  return { mode, input, refusal: refusalOf(start(settled, input, now, env)) }
}

/** Where a short input is made and, for a stocked raw item, the Exchange's row with its price (07 §11). */
export interface ShortfallLink {
  readonly item: ItemId
  readonly short: number
  readonly make: { readonly building: FarmBuildingId; readonly to: string } | null
  readonly buy: { readonly price: number; readonly to: string } | null
}

const FARM_KIND_OF: Readonly<Record<'raw' | 'crafted' | 'dish', FarmKind>> = { raw: 'gather', crafted: 'craft', dish: 'cook' }

export function shortfallLinks(settled: WorkState, inputs: readonly SheetInput[], back: string): ShortfallLink[] {
  return inputs.filter((input) => input.short > 0).map((input): ShortfallLink => {
    const def = itemById(input.item)
    const kind = def === undefined || def.kind === 'ticket' ? null : FARM_KIND_OF[def.kind]
    const maker = kind === null ? undefined : FARM_BUILDING_IDS.find((building) => makesHere(kind, def!, building))
    const offer = def?.kind === 'raw' ? buyFor(settled, [{ item: input.item, qty: input.short }]) : null
    return {
      item: input.item,
      short: input.short,
      make: maker === undefined ? null : {
        building: maker,
        to: `/farm/${maker}${sheetQuery({ job: input.item, count: Math.min(input.short, MAX_ITEMS_PER_ENTRY), back })}`,
      },
      buy: offer === null || def?.kind !== 'raw' ? null : { price: offer.items[0]!.unitPrice, to: exchangeRow(def.family, def.grade) },
    }
  })
}

/** The plan the sheet's badges read: the profile's targets, or automatic. */
export const sheetPlan = (view: WorkView): Plan => planFrom(view.projection, targetsOf(view.settled), {})
