// The item rules' live blocks in docs/rework/08-item-catalogue-and-recipes.md (M033): the catalogue counts (§1), the
// grade ladder and each family's table (§3), the side rotation, Duos and Feasts (§4.2–§4.4) and the work values (§8),
// rendered from the code so the page can't drift. §8's third is the Exchange's `SELL_DIVISOR` (T130, D331), unrounded:
// 09 §6 owns the rounding. Joined into `docs/render.ts` through `docs/rework.ts`. Pure.
import { SELL_DIVISOR } from '../exchange/selling'
import {
  craftedItem, DUO_GRADES, DUO_PAIRS, DUOS, FEAST_GRADES, FEASTS, ITEM_GRADE_LIST, ITEM_GRADES, itemById, ITEMS, planetDish,
  rawItem, SPEED_TICKET_ID, type DishDef, type ItemDef, type ItemGrade, type ItemId,
} from './catalogue'
import { FAMILIES, FAMILY_IDS, type FamilyId } from './families'
import { gradeOpensAtFarmLevel } from './grades'
import { dishSide, recipeOf, sideFamily, sideGrade } from './recipes'
import { cookBaseMinutes, craftBaseMinutes, gatherBaseMinutes, workValueBaseMinutes, workValueSeconds } from './work'

type Cell = string | number
/** A Markdown table; an empty cell renders as `| |`, and pipes in cells are escaped. */
function table(head: readonly string[], rows: readonly (readonly Cell[])[]): string {
  const row = (cells: readonly Cell[]) =>
    `|${cells.map((v) => String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ')).map((v) => (v === '' ? ' ' : ` ${v} `)).join('|')}|`
  return [row(head), `|${head.map(() => '---').join('|')}|`, ...rows.map(row)].join('\n')
}
const num = (n: number) => n.toLocaleString('en-US')
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const code = (id: string) => `\`${id}\``
const nameOf = (id: ItemId) => itemById(id)!.name
/** The work in an item in base minutes (null only for the ticket, which no table lists). */
const baseMinutes = (id: ItemId) => workValueBaseMinutes(id)!
/** Real minutes of work in an item: whole seconds ÷ 60. */
const realMinutes = (id: ItemId) => workValueSeconds(id)! / 60

/** The §4.2 matrix's short family names. */
const SHORT_NAME: Readonly<Record<FamilyId, string>> = {
  sweets: 'Sweets', fruits: 'Fruits', fish: 'Fish', 'nuts-seeds': 'Nuts', 'herbs-spices': 'Herbs', grains: 'Grains',
  vegetables: 'Vegetables', mushrooms: 'Mushrooms',
}

const feastAt = (g: ItemGrade) => FEASTS.find((feast) => feast.grade === g)
/** Every family's dishes cost the same at a grade (tested), so one family stands for the column. */
const anyPlanet = (g: ItemGrade) => planetDish(FAMILY_IDS[0], g)

// --- §1 -------------------------------------------------------------------------------------------------------------

function catalogue(): string {
  const count = (kind: ItemDef['kind'], dish?: DishDef['dish']) =>
    ITEMS.filter((item) => item.kind === kind && (dish === undefined || (item.kind === 'dish' && item.dish === dish))).length
  const families = `${FAMILY_IDS.length} families × ${ITEM_GRADES} grades`
  const first = FAMILY_IDS[0]
  return table(['Kind', 'Count', 'Ids'], [
    ['Raw ingredients', `${count('raw')} (${families})`, `uma-art \`items\` frames with \`refined: false\`, e.g. ${code(rawItem(first, 1).id)}`],
    ['Crafted ingredients', count('crafted'), `uma-art \`items\` frames with \`refined: true\`, e.g. ${code(craftedItem(first, 1).id)}`],
    ['Planet dishes', `${count('dish', 'planet')} (${families})`, 'uma-art `dishes`: `dish-<family>-<grade>`'],
    ['Duo dishes', `${count('dish', 'duo')} (${DUO_PAIRS.length} stat Duos × grades ${DUO_GRADES.join(' and ')})`,
      '`duo-<stat>-<stat>-<grade>`, drawn with uma-art `duo-…` frames (§4.3)'],
    ['Feasts', `${count('dish', 'feast')} (grades ${FEAST_GRADES.join(', ')})`,
      `uma-art ${code(FEASTS[0]!.id)} … ${code(FEASTS[FEASTS.length - 1]!.id)}`],
    ['Speed Ticket', count('ticket'), `${code(SPEED_TICKET_ID)} (§9)`],
    ['**Total**', `**${ITEMS.length} definitions**`, ''],
  ])
}

// --- §3 -------------------------------------------------------------------------------------------------------------

function ladder(): string {
  return table(['*g*', 'Farm Lv', 'Gather (min)', 'Craft (min)', 'Work in one crafted item', 'Cook (min)',
    'Planet or Duo dish, whole chain', 'Feast, whole chain'],
  ITEM_GRADE_LIST.map((g) => {
    const feast = feastAt(g)
    return [g, gradeOpensAtFarmLevel(g), num(gatherBaseMinutes(g)), num(craftBaseMinutes(g)), num(baseMinutes(craftedItem(FAMILY_IDS[0], g).id)),
      num(cookBaseMinutes(g)), num(baseMinutes(anyPlanet(g).id)), feast ? num(baseMinutes(feast.id)) : '']
  }))
}

function familyItems(family: FamilyId): string {
  return table(['*g*', 'Raw', 'Crafted', 'Planet dish', 'Its side (crafted)'], ITEM_GRADE_LIST.map((g) => {
    const raw = rawItem(family, g), crafted = craftedItem(family, g), dish = planetDish(family, g)
    const side = itemById(dishSide(dish.id)!)!
    if (side.kind !== 'crafted') throw new Error(`${dish.id}'s side is not crafted`)
    return [g, `${raw.name} ${code(raw.id)}`, `${crafted.name} ${code(crafted.id)}`, `${dish.name} ${code(dish.id)}`,
      `${side.name} (${FAMILIES[side.family].name} ${side.grade})`]
  }))
}

// --- §4 -------------------------------------------------------------------------------------------------------------

function sides(): string {
  return table(['*g* (side *g*)', ...FAMILY_IDS.map((family) => FAMILIES[family].name)],
    ITEM_GRADE_LIST.map((g) => [`${g} (${sideGrade(g)})`, ...FAMILY_IDS.map((family) => SHORT_NAME[sideFamily(family, g)])]))
}

const inputs = (id: ItemId) => recipeOf(id)!.inputs

function duos(): string {
  return table(['Id', 'Stats', 'Recipe', 'uma-art frame', 'Name'], DUOS.map((duo) => [
    code(duo.id),
    duo.stats.map(cap).join(' + '),
    inputs(duo.id).map(({ item, qty }) => `${qty} ${nameOf(item)}`).join(' + '),
    code(duo.art.frame),
    duo.name,
  ]))
}

function feasts(): string {
  return table(['Id', 'Name', 'Grade', 'Recipe'], FEASTS.map((feast) => {
    const side = dishSide(feast.id)!
    const own = inputs(feast.id).filter(({ item }) => item !== side).map(({ item, qty }) => (qty === 1 ? nameOf(item) : `${qty} ${nameOf(item)}`))
    return [code(feast.id), feast.name, feast.grade, `${own.join(', ')} + ${nameOf(side)}`]
  }))
}

// --- §8 -------------------------------------------------------------------------------------------------------------

function workValues(): string {
  return table(['*g*', 'Raw', 'Crafted', 'Planet or Duo dish', 'Feast', 'A third: raw / crafted / dish'], ITEM_GRADE_LIST.map((g) => {
    const raw = realMinutes(rawItem(FAMILY_IDS[0], g).id), crafted = realMinutes(craftedItem(FAMILY_IDS[0], g).id)
    const dish = realMinutes(anyPlanet(g).id), feast = feastAt(g)
    const third = [raw, crafted, dish].map((value) => num(value / SELL_DIVISOR)).join(' / ')
    return [g, num(raw), num(crafted), num(dish), feast ? num(realMinutes(feast.id)) : '',
      feast ? `${third} (Feast ${num(realMinutes(feast.id) / SELL_DIVISOR)})` : third]
  }))
}

/** Keys are `[a-z-]+`, the docs check's pattern. */
export const LIVE_BLOCKS: Readonly<Record<string, () => string>> = Object.freeze({
  'item-catalogue': catalogue,
  'item-ladder': ladder,
  ...Object.fromEntries(FAMILY_IDS.map((family) => [`items-${family}`, () => familyItems(family)])),
  'dish-sides': sides,
  'duo-recipes': duos,
  'feast-recipes': feasts,
  'work-values': workValues,
})
