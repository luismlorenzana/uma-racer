// The rework's Farm catalogue (docs/rework/08-item-catalogue-and-recipes.md §1, §3, §4.3, §4.4, §9, §10): 80 raw and
// 80 crafted ingredients, 80 planet dishes, 8 Duos, 4 Feasts and the Speed Ticket, 253 definitions in all. Ids and
// names are uma-rpg's farming half as uma-art 2.4.0 draws it (D330), written here as data: generated once from the art
// package's indexes, then frozen. Nothing reads the art package at run time; `art.test.ts` keeps the two in step.
import type { StatKey } from '../../types'
import { FAMILIES, FAMILY_IDS, type Destination, type FamilyId } from './families'

/** Grades per family (08 §1). */
export const ITEM_GRADES = 10
/** An item's grade, 1–10. Not today's `Grade`, which is the aptitude letter. */
export type ItemGrade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
/** Grades 1–10 in order. */
export const ITEM_GRADE_LIST: readonly ItemGrade[] = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const)
export const isItemGrade = (n: number): n is ItemGrade => Number.isInteger(n) && n >= 1 && n <= ITEM_GRADES

/** Duos come at grades 3 (scenario 2) and 5 (scenario 3) (08 §4.3). */
export const DUO_GRADES = Object.freeze([3, 5] as const)
export type DuoGrade = (typeof DUO_GRADES)[number]
/** One Feast per scenario from scenario 2 (08 §4.4). */
export const FEAST_GRADES = Object.freeze([4, 6, 8, 10] as const)
export type FeastGrade = (typeof FEAST_GRADES)[number]
/** The Speed Ticket's item id (08 §9). */
export const SPEED_TICKET_ID = 'speed-ticket'

/** A catalogue id: uma-art's frame id, or a Duo's own id, or `speed-ticket`. Never derived from a display name. */
export type ItemId = string

/** Where an item is drawn: a frame of uma-art's `items` or `dishes` atlas. */
export interface ItemArt {
  readonly atlas: 'items' | 'dishes'
  readonly frame: string
}

interface ItemBase {
  readonly id: ItemId
  readonly name: string
}

/** A raw ingredient, gathered at its family's site. */
export interface RawItemDef extends ItemBase {
  readonly kind: 'raw'
  readonly family: FamilyId
  readonly grade: ItemGrade
  /** uma-art's flag: false for raw. */
  readonly refined: false
  /** Its crafted form's id. */
  readonly pair: ItemId
  readonly art: ItemArt
}

/** A crafted ingredient ("refined" in uma-art), made at the Pantry from its raw pair. */
export interface CraftedItemDef extends ItemBase {
  readonly kind: 'crafted'
  readonly family: FamilyId
  readonly grade: ItemGrade
  readonly refined: true
  /** Its raw form's id. */
  readonly pair: ItemId
  readonly art: ItemArt
}

/** A family's dish at one grade, which goes to the family's destination. */
export interface PlanetDishDef extends ItemBase {
  readonly kind: 'dish'
  readonly dish: 'planet'
  readonly family: FamilyId
  readonly grade: ItemGrade
  readonly destination: Destination
  readonly art: ItemArt
}

/** A stat-to-stat Duo for the Gym's Duo nodes (08 §4.3). */
export interface DuoDishDef extends ItemBase {
  readonly kind: 'dish'
  readonly dish: 'duo'
  readonly grade: DuoGrade
  /** Its two families, in the order of `stats`. */
  readonly families: readonly [FamilyId, FamilyId]
  /** Its two stats in the stat row's order (Stamina – Wit – Power – Speed – Guts). */
  readonly stats: readonly [StatKey, StatKey]
  readonly art: ItemArt
}

/** A Feast for the Gym's Sun nodes (08 §4.4). */
export interface FeastDishDef extends ItemBase {
  readonly kind: 'dish'
  readonly dish: 'feast'
  readonly grade: FeastGrade
  readonly destination: 'sun'
  readonly art: ItemArt
}

/** The Speed Ticket: an item in the Warehouse with no uma-art frame (08 §9). */
export interface TicketDef extends ItemBase {
  readonly kind: 'ticket'
  readonly art: null
}

export type IngredientDef = RawItemDef | CraftedItemDef
export type DishDef = PlanetDishDef | DuoDishDef | FeastDishDef
/** One definition per item (08 §10), a union on `kind`. */
export type ItemDef = IngredientDef | DishDef | TicketDef

// --- Data -----------------------------------------------------------------------------------------------------------

/** Per family, grades 1–10: raw id and name, crafted id and name, planet dish id and name. */
type FamilyRow = readonly [rawId: string, rawName: string, craftedId: string, craftedName: string, dishId: string, dishName: string]

const FAMILY_ROWS: Readonly<Record<FamilyId, readonly FamilyRow[]>> = {
  sweets: [
    ['honeycomb', 'Honeycomb', 'honey', 'Honey', 'dish-sweets-1', 'Honeycomb Cake'],
    ['sugarcane', 'Sugarcane', 'cane-sugar', 'Cane Sugar', 'dish-sweets-2', 'Sugarcane Cake'],
    ['sugar-beet', 'Sugar Beet', 'beet-sugar', 'Beet Sugar', 'dish-sweets-3', 'Sugar Beet Cake'],
    ['maple-sap', 'Maple Sap', 'maple-syrup', 'Maple Syrup', 'dish-sweets-4', 'Maple Sap Cake'],
    ['cacao-pod', 'Cacao Pod', 'chocolate', 'Chocolate', 'dish-sweets-5', 'Cacao Pod Cake'],
    ['vanilla-pod', 'Vanilla Pod', 'vanilla-extract', 'Vanilla Extract', 'dish-sweets-6', 'Vanilla Pod Cake'],
    ['agave-heart', 'Agave Heart', 'agave-syrup', 'Agave Syrup', 'dish-sweets-7', 'Agave Heart Cake'],
    ['palm-sap', 'Palm Sap', 'palm-sugar', 'Palm Sugar', 'dish-sweets-8', 'Palm Sap Cake'],
    ['fairy-honeycomb', 'Fairy Honeycomb', 'fairy-honey', 'Fairy Honey', 'dish-sweets-9', 'Fairy Honeycomb Cake'],
    ['ambrosia-blossom', 'Ambrosia Blossom', 'ambrosia', 'Ambrosia', 'dish-sweets-10', 'Ambrosia Blossom Cake'],
  ],
  fruits: [
    ['apple', 'Apple', 'apple-preserve', 'Apple Preserve', 'dish-fruits-1', 'Apple Tart'],
    ['pear', 'Pear', 'pear-preserve', 'Pear Preserve', 'dish-fruits-2', 'Pear Tart'],
    ['peach', 'Peach', 'peach-preserve', 'Peach Preserve', 'dish-fruits-3', 'Peach Tart'],
    ['plum', 'Plum', 'plum-preserve', 'Plum Preserve', 'dish-fruits-4', 'Plum Tart'],
    ['orange', 'Orange', 'orange-marmalade', 'Orange Marmalade', 'dish-fruits-5', 'Orange Tart'],
    ['grape', 'Grape', 'grape-jelly', 'Grape Jelly', 'dish-fruits-6', 'Grape Tart'],
    ['mango', 'Mango', 'mango-pulp', 'Mango Pulp', 'dish-fruits-7', 'Mango Tart'],
    ['pomegranate', 'Pomegranate', 'pomegranate-molasses', 'Pomegranate Molasses', 'dish-fruits-8', 'Pomegranate Tart'],
    ['starpeach', 'Starpeach', 'starpeach-nectar', 'Starpeach Nectar', 'dish-fruits-9', 'Starpeach Tart'],
    ['golden-apple', 'Golden Apple', 'golden-apple-preserve', 'Golden Apple Preserve', 'dish-fruits-10', 'Golden Apple Tart'],
  ],
  fish: [
    ['carp', 'Carp', 'carp-fillet', 'Carp Fillet', 'dish-fish-1', 'Carp Grill'],
    ['trout', 'Trout', 'trout-fillet', 'Trout Fillet', 'dish-fish-2', 'Trout Grill'],
    ['sardine', 'Sardine', 'sardine-fillet', 'Sardine Fillet', 'dish-fish-3', 'Sardine Grill'],
    ['mackerel', 'Mackerel', 'mackerel-fillet', 'Mackerel Fillet', 'dish-fish-4', 'Mackerel Grill'],
    ['salmon', 'Salmon', 'salmon-fillet', 'Salmon Fillet', 'dish-fish-5', 'Salmon Grill'],
    ['sea-bream', 'Sea Bream', 'sea-bream-fillet', 'Sea Bream Fillet', 'dish-fish-6', 'Sea Bream Grill'],
    ['eel', 'Eel', 'eel-fillet', 'Eel Fillet', 'dish-fish-7', 'Eel Grill'],
    ['tuna', 'Tuna', 'tuna-fillet', 'Tuna Fillet', 'dish-fish-8', 'Tuna Grill'],
    ['silverfin', 'Silverfin', 'silverfin-fillet', 'Silverfin Fillet', 'dish-fish-9', 'Silverfin Grill'],
    ['rainbow-koi', 'Rainbow Koi', 'rainbow-koi-fillet', 'Rainbow Koi Fillet', 'dish-fish-10', 'Rainbow Koi Grill'],
  ],
  'nuts-seeds': [
    ['peanut', 'Peanut', 'peanut-butter', 'Peanut Butter', 'dish-nuts-seeds-1', 'Peanut Cookies'],
    ['sunflower-seed', 'Sunflower Seed', 'sunflower-oil', 'Sunflower Oil', 'dish-nuts-seeds-2', 'Sunflower Seed Cookies'],
    ['sesame', 'Sesame', 'sesame-paste', 'Sesame Paste', 'dish-nuts-seeds-3', 'Sesame Cookies'],
    ['walnut', 'Walnut', 'walnut-paste', 'Walnut Paste', 'dish-nuts-seeds-4', 'Walnut Cookies'],
    ['chestnut', 'Chestnut', 'chestnut-paste', 'Chestnut Paste', 'dish-nuts-seeds-5', 'Chestnut Cookies'],
    ['almond', 'Almond', 'almond-paste', 'Almond Paste', 'dish-nuts-seeds-6', 'Almond Cookies'],
    ['pistachio', 'Pistachio', 'pistachio-paste', 'Pistachio Paste', 'dish-nuts-seeds-7', 'Pistachio Cookies'],
    ['macadamia', 'Macadamia', 'macadamia-butter', 'Macadamia Butter', 'dish-nuts-seeds-8', 'Macadamia Cookies'],
    ['thundernut', 'Thundernut', 'thundernut-oil', 'Thundernut Oil', 'dish-nuts-seeds-9', 'Thundernut Cookies'],
    ['worldseed', 'Worldseed', 'worldseed-oil', 'Worldseed Oil', 'dish-nuts-seeds-10', 'Worldseed Cookies'],
  ],
  'herbs-spices': [
    ['basil', 'Basil', 'dried-basil', 'Dried Basil', 'dish-herbs-spices-1', 'Basil Curry'],
    ['mint', 'Mint', 'dried-mint', 'Dried Mint', 'dish-herbs-spices-2', 'Mint Curry'],
    ['rosemary', 'Rosemary', 'dried-rosemary', 'Dried Rosemary', 'dish-herbs-spices-3', 'Rosemary Curry'],
    ['thyme', 'Thyme', 'dried-thyme', 'Dried Thyme', 'dish-herbs-spices-4', 'Thyme Curry'],
    ['ginger', 'Ginger', 'ground-ginger', 'Ground Ginger', 'dish-herbs-spices-5', 'Ginger Curry'],
    ['peppercorn', 'Peppercorn', 'ground-pepper', 'Ground Pepper', 'dish-herbs-spices-6', 'Peppercorn Curry'],
    ['cinnamon', 'Cinnamon', 'ground-cinnamon', 'Ground Cinnamon', 'dish-herbs-spices-7', 'Cinnamon Curry'],
    ['saffron', 'Saffron', 'saffron-threads', 'Saffron Threads', 'dish-herbs-spices-8', 'Saffron Curry'],
    ['mandrake', 'Mandrake', 'mandrake-powder', 'Mandrake Powder', 'dish-herbs-spices-9', 'Mandrake Curry'],
    ['phoenix-pepper', 'Phoenix Pepper', 'phoenix-spice', 'Phoenix Spice', 'dish-herbs-spices-10', 'Phoenix Pepper Curry'],
  ],
  grains: [
    ['wheat', 'Wheat', 'wheat-flour', 'Wheat Flour', 'dish-grains-1', 'Wheat Bread'],
    ['oats', 'Oats', 'rolled-oats', 'Rolled Oats', 'dish-grains-2', 'Oats Bread'],
    ['barley', 'Barley', 'pearl-barley', 'Pearl Barley', 'dish-grains-3', 'Barley Bread'],
    ['rice', 'Rice', 'polished-rice', 'Polished Rice', 'dish-grains-4', 'Rice Bread'],
    ['corn', 'Corn', 'cornmeal', 'Cornmeal', 'dish-grains-5', 'Corn Bread'],
    ['rye', 'Rye', 'rye-flour', 'Rye Flour', 'dish-grains-6', 'Rye Bread'],
    ['buckwheat', 'Buckwheat', 'buckwheat-flour', 'Buckwheat Flour', 'dish-grains-7', 'Buckwheat Bread'],
    ['wild-rice', 'Wild Rice', 'hulled-wild-rice', 'Hulled Wild Rice', 'dish-grains-8', 'Wild Rice Bread'],
    ['moonrice', 'Moonrice', 'moonrice-flour', 'Moonrice Flour', 'dish-grains-9', 'Moonrice Bread'],
    ['sunwheat', 'Sunwheat', 'sunwheat-flour', 'Sunwheat Flour', 'dish-grains-10', 'Sunwheat Bread'],
  ],
  vegetables: [
    ['carrot', 'Carrot', 'chopped-carrot', 'Chopped Carrot', 'dish-vegetables-1', 'Carrot Salad'],
    ['potato', 'Potato', 'diced-potato', 'Diced Potato', 'dish-vegetables-2', 'Potato Salad'],
    ['cabbage', 'Cabbage', 'shredded-cabbage', 'Shredded Cabbage', 'dish-vegetables-3', 'Cabbage Salad'],
    ['onion', 'Onion', 'diced-onion', 'Diced Onion', 'dish-vegetables-4', 'Onion Salad'],
    ['tomato', 'Tomato', 'tomato-puree', 'Tomato Purée', 'dish-vegetables-5', 'Tomato Salad'],
    ['bell-pepper', 'Bell Pepper', 'sliced-bell-pepper', 'Sliced Bell Pepper', 'dish-vegetables-6', 'Bell Pepper Salad'],
    ['eggplant', 'Eggplant', 'sliced-eggplant', 'Sliced Eggplant', 'dish-vegetables-7', 'Eggplant Salad'],
    ['asparagus', 'Asparagus', 'trimmed-asparagus', 'Trimmed Asparagus', 'dish-vegetables-8', 'Asparagus Salad'],
    ['golden-carrot', 'Golden Carrot', 'golden-carrot-puree', 'Golden Carrot Purée', 'dish-vegetables-9', 'Golden Carrot Salad'],
    ['emperor-pumpkin', 'Emperor Pumpkin', 'pumpkin-puree', 'Pumpkin Purée', 'dish-vegetables-10', 'Emperor Pumpkin Salad'],
  ],
  mushrooms: [
    ['button-mushroom', 'Button Mushroom', 'dried-button-mushroom', 'Dried Button Mushroom', 'dish-mushrooms-1', 'Button Mushroom Soup'],
    ['shiitake', 'Shiitake', 'dried-shiitake', 'Dried Shiitake', 'dish-mushrooms-2', 'Shiitake Soup'],
    ['oyster-mushroom', 'Oyster Mushroom', 'dried-oyster-mushroom', 'Dried Oyster Mushroom', 'dish-mushrooms-3', 'Oyster Mushroom Soup'],
    ['enoki', 'Enoki', 'dried-enoki', 'Dried Enoki', 'dish-mushrooms-4', 'Enoki Soup'],
    ['chanterelle', 'Chanterelle', 'dried-chanterelle', 'Dried Chanterelle', 'dish-mushrooms-5', 'Chanterelle Soup'],
    ['porcini', 'Porcini', 'dried-porcini', 'Dried Porcini', 'dish-mushrooms-6', 'Porcini Soup'],
    ['morel', 'Morel', 'dried-morel', 'Dried Morel', 'dish-mushrooms-7', 'Morel Soup'],
    ['truffle', 'Truffle', 'shaved-truffle', 'Shaved Truffle', 'dish-mushrooms-8', 'Truffle Soup'],
    ['glowcap', 'Glowcap', 'glowcap-powder', 'Glowcap Powder', 'dish-mushrooms-9', 'Glowcap Soup'],
    ['king-reishi', 'King Reishi', 'reishi-powder', 'Reishi Powder', 'dish-mushrooms-10', 'King Reishi Soup'],
  ],
}

/** The four stat Duos: the stat-family neighbours on the ring (08 §2), in the stat row's order. Guts–Stamina has none. */
export const DUO_PAIRS = Object.freeze(['stamina-wit', 'wit-power', 'power-speed', 'speed-guts'] as const)
export type DuoPair = (typeof DUO_PAIRS)[number]

type DuoRow = readonly [
  id: string, grade: DuoGrade, stats: readonly [StatKey, StatKey], families: readonly [FamilyId, FamilyId], frame: string, name: string,
]

/** 08 §4.3, in its order. Grade 3 is drawn with uma-art's grade-3 frame, grade 5 with its grade-7 Deluxe frame. */
const DUO_ROWS: readonly DuoRow[] = [
  ['duo-stamina-wit-3', 3, ['stamina', 'wit'], ['fruits', 'herbs-spices'], 'duo-mp-matk-3', 'Fruit & Herb Platter'],
  ['duo-stamina-wit-5', 5, ['stamina', 'wit'], ['fruits', 'herbs-spices'], 'duo-mp-matk-7', 'Fruit & Herb Platter Deluxe'],
  ['duo-wit-power-3', 3, ['wit', 'power'], ['herbs-spices', 'fish'], 'duo-matk-atk-3', 'Herb & Fish Platter'],
  ['duo-wit-power-5', 5, ['wit', 'power'], ['herbs-spices', 'fish'], 'duo-matk-atk-7', 'Herb & Fish Platter Deluxe'],
  ['duo-power-speed-3', 3, ['power', 'speed'], ['fish', 'sweets'], 'duo-atk-speed-3', 'Fish & Honey Platter'],
  ['duo-power-speed-5', 5, ['power', 'speed'], ['fish', 'sweets'], 'duo-atk-speed-7', 'Fish & Honey Platter Deluxe'],
  ['duo-speed-guts-3', 3, ['speed', 'guts'], ['sweets', 'nuts-seeds'], 'duo-speed-limit-3', 'Honey & Nut Platter'],
  ['duo-speed-guts-5', 5, ['speed', 'guts'], ['sweets', 'nuts-seeds'], 'duo-speed-limit-7', 'Honey & Nut Platter Deluxe'],
]

/** 08 §4.4. */
const FEAST_ROWS: readonly (readonly [id: string, grade: FeastGrade, name: string])[] = [
  ['feast-4', 4, 'Spring Feast'],
  ['feast-6', 6, 'Summer Feast'],
  ['feast-8', 8, 'Harvest Feast'],
  ['feast-10', 10, 'Grand Feast'],
]

// --- Definitions ----------------------------------------------------------------------------------------------------

const art = (atlas: ItemArt['atlas'], frame: string): ItemArt => Object.freeze({ atlas, frame })
const gradeAt = (index: number): ItemGrade => ITEM_GRADE_LIST[index]!

const RAW = {} as Record<FamilyId, readonly RawItemDef[]>
const CRAFTED = {} as Record<FamilyId, readonly CraftedItemDef[]>
const PLANET = {} as Record<FamilyId, readonly PlanetDishDef[]>
for (const family of FAMILY_IDS) {
  const rows = FAMILY_ROWS[family]
  if (rows.length !== ITEM_GRADES) throw new Error(`${family} has ${rows.length} grades, not ${ITEM_GRADES}`)
  RAW[family] = Object.freeze(rows.map(([id, name, pair], i): RawItemDef =>
    Object.freeze({ kind: 'raw', id, name, family, grade: gradeAt(i), refined: false, pair, art: art('items', id) })))
  CRAFTED[family] = Object.freeze(rows.map(([pair, , id, name], i): CraftedItemDef =>
    Object.freeze({ kind: 'crafted', id, name, family, grade: gradeAt(i), refined: true, pair, art: art('items', id) })))
  PLANET[family] = Object.freeze(rows.map(([, , , , id, name], i): PlanetDishDef =>
    Object.freeze({
      kind: 'dish', dish: 'planet', id, name, family, grade: gradeAt(i), destination: FAMILIES[family].destination, art: art('dishes', id),
    })))
}

/** The 8 Duos in 08 §4.3's order. */
export const DUOS: readonly DuoDishDef[] = Object.freeze(DUO_ROWS.map(([id, grade, stats, families, frame, name]): DuoDishDef =>
  Object.freeze({ kind: 'dish', dish: 'duo', id, name, grade, families: Object.freeze([...families]) as DuoDishDef['families'],
    stats: Object.freeze([...stats]) as DuoDishDef['stats'], art: art('dishes', frame) })))

/** The 4 Feasts by grade. */
export const FEASTS: readonly FeastDishDef[] = Object.freeze(FEAST_ROWS.map(([id, grade, name]): FeastDishDef =>
  Object.freeze({ kind: 'dish', dish: 'feast', id, name, grade, destination: 'sun', art: art('dishes', id) })))

/** uma-art draws no ticket; its new icon is on rework/11's art list. */
export const SPEED_TICKET: TicketDef = Object.freeze({ kind: 'ticket', id: SPEED_TICKET_ID, name: 'Speed Ticket', art: null })

/**
 * Every definition: per family in `FAMILY_IDS` order its raw items 1–10 then its crafted 1–10, then the planet dishes
 * by family and grade, the Duos, the Feasts, and the Speed Ticket last.
 */
export const ITEMS: readonly ItemDef[] = Object.freeze([
  ...FAMILY_IDS.flatMap((family) => [...RAW[family], ...CRAFTED[family]]),
  ...FAMILY_IDS.flatMap((family) => PLANET[family]),
  ...DUOS,
  ...FEASTS,
  SPEED_TICKET,
])

const BY_ID = new Map<ItemId, ItemDef>()
for (const item of ITEMS) {
  if (BY_ID.has(item.id)) throw new Error(`Item id ${item.id} is defined twice`)
  BY_ID.set(item.id, item)
}

// --- Lookups --------------------------------------------------------------------------------------------------------

/** The definition of `id`, or undefined for an id the catalogue doesn't hold. */
export const itemById = (id: ItemId): ItemDef | undefined => BY_ID.get(id)

export const isDish = (item: ItemDef): item is DishDef => item.kind === 'dish'
export const isIngredient = (item: ItemDef): item is IngredientDef => item.kind === 'raw' || item.kind === 'crafted'

function atGrade<T extends { readonly grade: number }>(list: readonly T[], g: number, what: string): T {
  const found = isItemGrade(g) ? list.find((item) => item.grade === g) : undefined
  if (found === undefined) throw new RangeError(`No ${what} at grade ${g}`)
  return found
}

export const rawItem = (family: FamilyId, g: ItemGrade): RawItemDef => atGrade(RAW[family], g, `raw ${family}`)
export const craftedItem = (family: FamilyId, g: ItemGrade): CraftedItemDef => atGrade(CRAFTED[family], g, `crafted ${family}`)
export const planetDish = (family: FamilyId, g: ItemGrade): PlanetDishDef => atGrade(PLANET[family], g, `${family} dish`)
export const duoDish = (pair: DuoPair, g: DuoGrade): DuoDishDef =>
  atGrade(DUOS.filter((duo) => duoPairOf(duo) === pair), g, `${pair} Duo`)
export const feastDish = (g: FeastGrade): FeastDishDef => atGrade(FEASTS, g, 'Feast')

/** A Duo's stat pair, e.g. `stamina-wit`. */
export const duoPairOf = (duo: DuoDishDef): DuoPair => `${duo.stats[0]}-${duo.stats[1]}` as DuoPair
