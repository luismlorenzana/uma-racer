// The job sheet (docs/game/07-farm.md §3, §5, §10, §11; docs/game/02-check-ins-and-notifications.md §3, §6, §9;
// T140, D366), one screen for all ten buildings, opened over a building page or the map's side panel by its query, with
// everything preselected so one tap starts the job. Pure readings of the domain:
// 1. **Uma**: Free Umas only (`freeUmas`), never one working, in a session or Ready with a finished job, each with her
//    Farm Level and a suited mark (`suits`); Farm Level first, then suited (A03). Queue next names her and skips the step.
// 2. **What**: a site's ten raw grades; the Pantry's crafted items in family tabs in `FAMILY_RING` order; the Kitchen's
//    tabs by stat, Tonics, Duos, Feasts and Can cook now, each tab an icon. A grade above her Farm Level shows its lock.
// 3. **Preselected**: the first Free Uma by Farm Level (unless the link names her), and the item the plan wants
//    most that she can make, else the highest grade she can work; the size the check-in fits.
// 4. **How many** and its preview from the kind's own `plan`: how long it takes, the Farm EXP and every input against
//    free stock.
// 5. **Start** or **Queue**, run on the current state first, so a disabled button says why in the rule's own words, and
//    a shortfall links to the building that makes it.
import { buyFor, durationText, say, type Words } from '@racer/domain/check-in'
import {
  bestExpTenths, BUILDINGS, expFamilies, FAMILY_APTITUDE, familyAptitude, FARM_BUILDING_IDS, farmExpMultiplier, farmItemSeconds, makesHere,
  QUARTERS_PER_EXP, suits, TENTHS, type FarmAptitude, type FarmBuildingId,
} from '@racer/domain/farm'
import {
  craftedItem, DUOS, FAMILIES, FAMILY_RING, familyFor, FEASTS, gradeOpensAtFarmLevel, highestOpenGrade, isKitchenItem, isRetired, ITEM_GRADE_LIST,
  itemById, planetDish, rawItem, recipeOf, TONICS, type DishDef, type FamilyId, type ItemDef, type ItemId, type KitchenDef,
} from '@racer/domain/items'
import { freeUmas, planFrom, remainingFor, suggestFrom, targetsOf, type Plan, type Timing } from '@racer/domain/planner'
import { isRefusal } from '@racer/domain/state'
import {
  freeAt, holdsSlot, kindRules, largestCoverable, MAX_ITEMS_PER_ENTRY, queue, shortfall, slotHolder, slotsOf, speedAt, start, statusOf,
  stockOf, sumInputs, type FarmKind, type FarmRequest, type PlannedItem, type QueueInput, type SlotRef, type StartInput, type WorkState,
} from '@racer/domain/work'
import type { WorkView } from '../../../ui/work/view'
import { exchangeRow, farmKindOf, sheetQuery } from '../building/model'
import { farmWords } from '../words'

// --- The query (11 §7.1, T140) ----------------------------------------------------------------------------------------

/** `?job=:itemId&uma=:umaId&count=:n&queue=1&slot=:n&back=<path>`: `job` present opens the sheet, empty for nothing chosen. */
export interface SheetQuery {
  readonly job: ItemId | null
  readonly uma: string | null
  readonly count: number | null
  readonly queue: boolean
  /** The free row's slot ("+"); the first free one otherwise. */
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

export const SHEET_KEYS = Object.freeze(['job', 'uma', 'count', 'queue', 'slot', 'back'] as const)

/** The search without the sheet's fields. */
export function withoutSheet(search: string): string {
  const params = new URLSearchParams(search)
  for (const key of SHEET_KEYS) params.delete(key)
  const rest = params.toString()
  return rest === '' ? '' : `?${rest}`
}

// --- What (07 §10) ----------------------------------------------------------------------------------------------------

/** The meals' tabs: one a stat (D374). */
const MEAL_STATS = ['speed', 'stamina', 'power', 'guts', 'wit'] as const
type MealStat = (typeof MEAL_STATS)[number]
const STAT_WORDS: Readonly<Record<string, string>> = { speed: 'Speed', stamina: 'Stamina', power: 'Power', guts: 'Guts', wit: 'Wit' }
export const TONICS_TAB = 'tonics'

export const CAN_COOK_NOW = 'can-cook-now'

/**
 * A tab's icon chip (D366): a stat's type icon, a mark for Tonics and Can cook now, or an item's icon (a Pantry
 * family's first crafted item, the first Duo and Feast).
 */
export type TabIcon =
  | { readonly kind: 'type'; readonly type: MealStat }
  | { readonly kind: 'mark'; readonly mark: 'star' | 'check' }
  | { readonly kind: 'item'; readonly item: ItemId }

export interface SheetTab {
  readonly id: string
  readonly label: string
  readonly icon: TabIcon
  readonly items: readonly ItemId[]
}

const grades = <T extends { readonly id: ItemId }>(make: (g: (typeof ITEM_GRADE_LIST)[number]) => T): ItemId[] => ITEM_GRADE_LIST.map((g) => make(g).id)

/** Whether a meal or tonic can be cooked now (07 §14): the free stock covers it once and `level` opens its grade. */
export function canCookNow(state: Pick<WorkState, 'items'>, dish: KitchenDef, level: number): boolean {
  return level >= gradeOpensAtFarmLevel(dish.grade) && shortfall(state.items, recipeOf(dish.id)?.inputs ?? []).length === 0
}

const statMeal = (stat: MealStat, g: (typeof ITEM_GRADE_LIST)[number]): DishDef => planetDish(familyFor(stat), g)

/** Everything the Kitchen cooks (D374): the stat meals, the tonics, the Duos and the Feasts. */
const ALL_DISHES: readonly KitchenDef[] = Object.freeze([
  ...MEAL_STATS.flatMap((stat) => ITEM_GRADE_LIST.map((g) => statMeal(stat, g))),
  ...TONICS,
  ...DUOS,
  ...FEASTS,
])

/**
 * The sheet's tabs (07 §10): one untitled list of a site's family's ten raw grades; the Pantry's crafted items by family
 * in `FAMILY_RING` order; the Kitchen's Speed · Stamina · Power · Guts · Wit · Tonics · Duos · Feasts · Can cook now.
 * `level` is the chosen Uma's Farm Level, or the highest of any Uma's (Can cook now).
 */
export function sheetTabs(building: FarmBuildingId, state: Pick<WorkState, 'items'>, level: number): readonly SheetTab[] {
  const family = BUILDINGS[building].family
  if (family !== null) return [{ id: family, label: FAMILIES[family].name, icon: { kind: 'item', item: rawItem(family, 1).id }, items: grades((g) => rawItem(family, g)) }]
  if (building === 'pantry') {
    return FAMILY_RING.map((f) => ({ id: f, label: FAMILIES[f].name, icon: { kind: 'item', item: craftedItem(f, 1).id }, items: grades((g) => craftedItem(f, g)) }))
  }
  return [
    ...MEAL_STATS.map((stat): SheetTab => ({ id: stat, label: STAT_WORDS[stat]!, icon: { kind: 'type', type: stat }, items: grades((g) => statMeal(stat, g)) })),
    { id: TONICS_TAB, label: farmWords('tab-tonics'), icon: { kind: 'mark', mark: 'star' }, items: TONICS.map((tonic) => tonic.id) },
    { id: 'duos', label: farmWords('tab-duos'), icon: { kind: 'item', item: DUOS[0]!.id }, items: DUOS.map((duo) => duo.id) },
    { id: 'feasts', label: farmWords('tab-feasts'), icon: { kind: 'item', item: FEASTS[0]!.id }, items: FEASTS.map((feast) => feast.id) },
    {
      id: CAN_COOK_NOW, label: farmWords('can-cook-now'), icon: { kind: 'mark', mark: 'check' },
      items: ALL_DISHES.filter((dish) => canCookNow(state, dish, level)).map((dish) => dish.id),
    },
  ]
}

/** The tab an item sits in (its family at the Pantry, its destination at the Kitchen), else the first. */
export function tabOf(tabs: readonly SheetTab[], item: ItemId | null): string {
  const found = item === null ? undefined : tabs.find((tab) => tab.id !== CAN_COOK_NOW && tab.items.includes(item))
  return (found ?? tabs[0]!).id
}

/**
 * What a meal or tonic is for (08 §2, §4.3–§4.5): a meal's stat, a Duo's two stats, the Sun nodes, or a tonic's nodes and
 * slots; a retired salad or soup stands in for a tonic (D374).
 */
export function destinationWords(def: ItemDef): string | null {
  if (def.kind === 'tonic') return farmWords('to-tonic')
  if (def.kind !== 'dish') return null
  if (isRetired(def)) return farmWords(def.dish === 'planet' && def.destination === 'skill' ? 'to-retired' : 'to-stand-in')
  if (def.dish === 'planet') return STAT_WORDS[def.destination] ?? def.destination
  if (def.dish === 'duo') return farmWords('to-duo', { a: STAT_WORDS[def.stats[0]] ?? def.stats[0], b: STAT_WORDS[def.stats[1]] ?? def.stats[1] })
  return farmWords('to-sun')
}

export interface SheetItem {
  readonly item: ItemId
  readonly name: string
  readonly grade: number
  /** Free stock. */
  readonly stock: number
  /** The "×N" badge: what the plan's lines still have to start of it; 0 hides it. */
  readonly needed: number
  /** The Farm Level that opens it, when `level` doesn't: the cell's "Lv16". */
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
      if (entry.kind !== 'unlock' || entry.dishId === null) continue
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
      wantedBy: isKitchenItem(def) ? wanters.get(item) ?? [] : [],
    }
  })
}

// --- Uma (07 §3, §5, §10) ---------------------------------------------------------------------------------------------

const APTITUDE_WORDS: Readonly<Record<FarmAptitude['key'], string>> = {
  sprint: 'Sprint', mile: 'Mile', medium: 'Medium', long: 'Long', front: 'Front Runner', pace: 'Pace Chaser', late: 'Late Surger', end: 'End Closer',
}

/** A Free Uma the sheet can start (D366): busy, Ready and in-session Umas are never listed. */
export interface SheetUma {
  readonly outfitId: string
  readonly name: string
  readonly farmLevel: number
  /** The highest grade she can work (`highestOpenGrade`). */
  readonly highestGrade: number
  /** Her best family's Farm EXP, in tenths, for the families that count; null when no family is known yet. */
  readonly tenths: number | null
  /** An S or A letter for what she'd make (`suits`): the strip's mark and the Farm Level tie-break. */
  readonly suited: boolean
  /** "Sprint A · Farm EXP ×1.6" (07 §3). */
  readonly aptitude: string | null
}

/** The families whose aptitude counts: the chosen item's (`expFamilies`), else a site's own. */
export function suitedFamilies(building: FarmBuildingId, item: ItemId | null): readonly FamilyId[] {
  const def = item === null ? undefined : itemById(item)
  if (def !== undefined) return expFamilies(def)
  const own = BUILDINGS[building].family
  return own === null ? [] : [own]
}

/** Her aptitude line for the best of `families` (07 §3), with its tenths. */
export function aptitudeLine(env: WorkView['env'], outfitId: string, families: readonly FamilyId[]): { readonly tenths: number; readonly words: string } | null {
  const template = env.content.umas.get(outfitId)
  if (template === undefined || families.length === 0) return null
  const tenths = bestExpTenths(env.content, outfitId, families)
  const best = families.find((family) => farmExpMultiplier(familyAptitude(template.aptitudes, family)) === tenths)!
  const letter = familyAptitude(template.aptitudes, best)
  return { tenths, words: farmWords('aptitude', { aptitude: APTITUDE_WORDS[FAMILY_APTITUDE[best].key], letter, multiplier: tenths / TENTHS }) }
}

/** One Uma as the strip shows her, for what she'd make here. */
function sheetUma(view: WorkView, building: FarmBuildingId, outfitId: string, item: ItemId | null): SheetUma {
  const { settled, env } = view
  const uma = settled.umas[outfitId]!
  const families = suitedFamilies(building, item)
  const aptitude = aptitudeLine(env, outfitId, families)
  return {
    outfitId,
    name: env.content.umas.get(outfitId)?.name ?? outfitId,
    farmLevel: uma.farm.level,
    highestGrade: highestOpenGrade(uma.farm.level),
    tenths: aptitude?.tenths ?? null,
    suited: env.content.umas.has(outfitId) && suits(env.content, outfitId, families),
    aptitude: aptitude?.words ?? null,
  }
}

/**
 * The strip (07 §10, A03): **Free Umas only**, Farm Level highest first, then suited for `item` (or the site's family),
 * then newest release and name. An Uma working anywhere, in a session or Ready with a finished job still holding its slot is left
 * out: she can't start here without a Collect or a Recall first.
 */
export function freeRows(view: WorkView, building: FarmBuildingId, item: ItemId | null): SheetUma[] {
  return freeUmas(view.settled)
    .map((uma) => sheetUma(view, building, uma.outfitId, item))
    .sort((a, b) => b.farmLevel - a.farmLevel
      || Number(b.suited) - Number(a.suited)
      || (view.env.content.umas.get(b.outfitId)?.jpRelease ?? '').localeCompare(view.env.content.umas.get(a.outfitId)?.jpRelease ?? '')
      || a.name.localeCompare(b.name)
      || a.outfitId.localeCompare(b.outfitId))
}

/** The Uma a queue entry is for (Queue next names her): shown, never picked. */
export const queuedUma = (view: WorkView, building: FarmBuildingId, outfitId: string, item: ItemId | null): SheetUma | null =>
  view.settled.umas[outfitId] === undefined ? null : sheetUma(view, building, outfitId, item)

// --- Preselection (D366) ----------------------------------------------------------------------------------------------

export interface Preselection {
  readonly uma: string | null
  readonly item: ItemId | null
  /** Null lets the size chips mark the size the check-in fits. */
  readonly count: number | null
}

/** Items this building makes, every tab together, Can cook now left out. */
const itemsHere = (building: FarmBuildingId, state: Pick<WorkState, 'items'>): ItemId[] =>
  [...new Set(sheetTabs(building, state, 1).filter((tab) => tab.id !== CAN_COOK_NOW).flatMap((tab) => tab.items))]

/** How many of `item` the free stock covers once each: unbounded for gathering. */
const covers = (state: Pick<WorkState, 'items'>, item: ItemId): number =>
  (recipeOf(item)?.inputs ?? []).reduce((n, { item: input, qty }) => Math.min(n, Math.floor(stockOf(state.items, input) / qty)), Number.POSITIVE_INFINITY)

/**
 * What she'd make here (D366): the item the plan wants most (`needed`) that her Farm Level opens and the stock covers
 * once; else the highest grade she can work and make; else, at a site, the highest grade she can gather. Ties go to the
 * lower grade, then the catalogue's order.
 */
export function bestItem(state: Pick<WorkState, 'items'>, building: FarmBuildingId, farmLevel: number, needed: ReadonlyMap<ItemId, number>): ItemId | null {
  const all = itemsHere(building, state).map((item) => ({ item, def: itemById(item)! })).filter(({ def }) => def.kind !== 'ticket')
  const grade = (def: ItemDef) => (def.kind === 'ticket' ? 1 : def.grade)
  const makeable = all.filter(({ item, def }) => farmLevel >= gradeOpensAtFarmLevel(grade(def)) && covers(state, item) >= 1)
  const wanted = makeable.filter(({ item }) => (needed.get(item) ?? 0) > 0)
    .sort((a, b) => (needed.get(b.item) ?? 0) - (needed.get(a.item) ?? 0) || grade(a.def) - grade(b.def))
  if (wanted[0] !== undefined) return wanted[0].item
  const top = [...makeable].sort((a, b) => grade(b.def) - grade(a.def))[0]
  return top?.item ?? null
}

/**
 * The sheet's preselection (D366), so most starts are one tap:
 * - Queue next names her and her current job's item; the link's count, else the fitted size.
 * - A link naming an Uma keeps her. An item link keeps its item and count, with the first Free Uma whose level opens it.
 * - Otherwise the first row by Farm Level; use the planner's suggested item and size only when they're for her at this
 *   building, else `bestItem` for her, sized to the check-in. The planner never overrides the level-first Uma (A03).
 */
export function preselect(view: WorkView, building: FarmBuildingId, query: SheetQuery, planned: Plan, timing: Timing): Preselection {
  const asked = query.job !== null && itemById(query.job) !== undefined ? query.job : null
  if (query.queue && query.uma !== null) return { uma: query.uma, item: asked, count: query.count }
  const rows = freeRows(view, building, asked)
  if (rows.length === 0) return { uma: null, item: asked, count: query.count }
  const named = query.uma === null ? undefined : rows.find((row) => row.outfitId === query.uma)
  if (asked !== null) {
    const def = itemById(asked)!
    const opens = def.kind === 'ticket' ? 1 : gradeOpensAtFarmLevel(def.grade)
    const uma = named ?? rows.find((row) => row.farmLevel >= opens) ?? rows[0]!
    return { uma: uma.outfitId, item: asked, count: query.count }
  }
  if (named !== undefined) return { uma: named.outfitId, item: bestItem(view.settled, building, named.farmLevel, neededByItem(planned)), count: query.count }
  const { suggestions } = suggestFrom(view.settled, planned, {}, timing)
  const best = rows[0]!
  const suggested = suggestions.find((s) => s.kind === 'job' && s.slot.building === building && s.item !== null && s.outfitId === best.outfitId)
  const item = suggested?.item ?? bestItem(view.settled, building, best.farmLevel, neededByItem(planned))
  // The Pantry/Kitchen gain their aptitude tie-break once an item is chosen. All top-level Umas open the same grades;
  // keep that item's first row selected too, not a former first row from when its family was still unknown.
  const first = freeRows(view, building, item)[0]!
  return { uma: first.outfitId, item, count: query.count ?? (suggested?.outfitId === first.outfitId ? suggested.size : null) }
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
  /** How long the chosen size takes (D366): Start's "3h 36m". */
  readonly ms: number
  readonly endsAt: number
  /** Whole Farm EXP; null without an Uma whose Farm Level opens it. */
  readonly farmExp: number | null
  readonly inputs: readonly SheetInput[]
}

/** The action the sheet's button takes: a start for a Free Uma, or her next queued job. */
export type SheetMode = 'start' | 'queue'

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
  const ms = seconds.slice(0, n).reduce((sum, s) => sum + s, 0) * 1000
  return {
    kind,
    start: begin,
    itemSeconds: seconds,
    max,
    request: { kind, item, count: n },
    minutesEach: seconds[0]! / 60,
    ms,
    endsAt: begin + ms,
    farmExp: plan === null ? null : Math.round(plan.slice(0, n).reduce((sum, one) => sum + one.farmExp, 0) / QUARTERS_PER_EXP),
    inputs,
  }
}

// --- Start and Queue (07 §5, §10) -------------------------------------------------------------------------------------

/** The slot a start takes: the "+" row's when it is free (or hers), else hers here, else the first free one in `slotsOf` order. */
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

/** Whether a slot here holds a finished job: Collect here would free it, and its Uma. */
export function readyHere(view: WorkView, building: FarmBuildingId): boolean {
  return Object.values(view.settled.work).some((row) => holdsSlot(row) && row.slot!.building === building && statusOf(row, view.now) === 'ready')
}

/** Why no slot is free: one is ready to collect, or how long until the next job here ends (D366: a duration). */
export function noSlotWords(view: WorkView, building: FarmBuildingId): string {
  const { settled, now, env } = view
  const holders = Object.values(settled.work).filter((row) => holdsSlot(row) && row.slot!.building === building)
  if (holders.some((row) => statusOf(row, now) === 'ready')) return farmWords('no-slot-ready')
  const ends = holders.map((row) => freeAt(settled, row.outfitId, now, env)).filter((at): at is number => at !== null)
  return farmWords('no-slot', { time: durationText(Math.min(...ends) - now) })
}

export type SheetAction =
  | { readonly mode: 'start'; readonly input: StartInput; readonly refusal: Words | null }
  | { readonly mode: 'queue'; readonly input: QueueInput; readonly refusal: Words | null }
  /** Nothing to run yet: no Umas, no Free Uma, nothing chosen, or no free slot. */
  | { readonly mode: 'blocked'; readonly words: string }

const refusalOf = (result: unknown): Words | null => (isRefusal(result) ? say(result.reason, result.data) : null)

/** What the button does, each operation run on the current state first so a refusal reads in its own words. */
export function sheetAction(view: WorkView, building: FarmBuildingId, uma: string | null, mode: SheetMode, item: ItemId | null, count: number, slotAsked: number | null): SheetAction {
  const { settled, now, env } = view
  if (Object.keys(settled.umas).length === 0) return { mode: 'blocked', words: farmWords('no-umas') }
  if (uma === null) return { mode: 'blocked', words: farmWords('no-free-uma') }
  if (item === null) return { mode: 'blocked', words: farmWords('pick-item') }
  const request: FarmRequest = { kind: farmKindOf(building), item, count }
  if (mode === 'queue') {
    const input: QueueInput = { outfitId: uma, add: { request, building } }
    return { mode, input, refusal: refusalOf(queue(settled, input, now, env)) }
  }
  const slot = chooseSlot(settled, building, uma, slotAsked)
  if (slot === null) return { mode: 'blocked', words: noSlotWords(view, building) }
  const input: StartInput = { outfitId: uma, slot, request }
  return { mode, input, refusal: refusalOf(start(settled, input, now, env)) }
}

/** Where a short input is made and, for a stocked raw item, the Exchange's row with its price (07 §11). */
export interface ShortfallLink {
  readonly item: ItemId
  readonly short: number
  readonly make: { readonly building: FarmBuildingId; readonly to: string } | null
  readonly buy: { readonly price: number; readonly to: string } | null
}

const FARM_KIND_OF: Readonly<Record<'raw' | 'crafted' | 'dish' | 'tonic', FarmKind>> = { raw: 'gather', crafted: 'craft', dish: 'cook', tonic: 'cook' }

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

/** The Exchange's row for a raw item above her Farm Level, when it stocks the grade (07 §10's gated target line). */
export function gatedOffer(settled: WorkState, item: ItemId): { readonly price: number; readonly to: string } | null {
  const def = itemById(item)
  if (def?.kind !== 'raw') return null
  const offer = buyFor(settled, [{ item, qty: 1 }])
  return offer === null ? null : { price: offer.items[0]!.unitPrice, to: exchangeRow(def.family, def.grade) }
}

/** The plan the sheet's badges read: the profile's targets, or automatic. */
export const sheetPlan = (view: WorkView): Plan => planFrom(view.projection, targetsOf(view.settled), {})

/** When the sheet's suggestions start and the check-ins their sizes fit. */
export const sheetTiming = (view: WorkView, utcOffsetMin: number): Timing => ({ now: view.now, times: view.settled.profile.checkIns, utcOffsetMin })
