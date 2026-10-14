// The Farm's and the facilities' live blocks (docs/tasks/M033-rework-rules.md "The live manual"): rework/07's job
// times (§2), aptitudes and multipliers (§3), the grade ladder of Farm Levels (§4), slots (§6) and upgrades (§7), and
// rework/05 §7's facility slots and prices, rendered from the code so the pages can't drift. Registered in
// packages/domain/src/docs/rework.ts. Pure: no I/O.
import type { Grade } from '../../types'
import { ITEM_GRADES, ITEM_GRADE_LIST } from '../items/catalogue'
import { FAMILIES, type Destination, type FamilyId } from '../items/families'
import { gradeOpensAtFarmLevel } from '../items/grades'
import {
  COOK_BASE_MINUTES, COOK_MINUTES_PER_GRADE, cookBaseMinutes, CRAFT_SHARE_OF_GATHER, craftBaseMinutes, GATHER_BASE_MINUTES, GATHER_MINUTES_PER_GRADE,
  gatherBaseMinutes,
} from '../items/work'
import {
  BUILDINGS, buildingSpeed, DOJO_FAMILIES, FACILITY_IDS, FARM_BUILDING_IDS, MAX_BUILDING_LEVEL, SLOTS, STAT_FAMILIES, totalSlots, UPGRADES,
  upgradeFamilies, type BuildingId, type BuildingLevel, type UpgradeStep,
} from './buildings'
import { FAMILY_APTITUDE, FARM_EXP_TENTHS, FARM_LEVEL_CAP, farmExpAtLevel, farmExpToNext, TENTHS, type FarmAptitude } from './level'

type Cell = string | number
/** A Markdown table; an empty cell renders as `| |`, as the hand-written pages have it. */
function table(head: readonly Cell[], rows: readonly (readonly Cell[])[]): string {
  const line = (cells: readonly Cell[]) => `|${cells.map((c) => (c === '' ? ' ' : ` ${String(c).replace(/\|/g, '\\|')} `)).join('|')}|`
  return [line(head), `|${head.map(() => '---').join('|')}|`, ...rows.map(line)].join('\n')
}
const num = (n: number): string => n.toLocaleString('en-US')
const bold = (s: Cell): string => `**${s}**`
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const word = (n: number): string => WORDS[n] ?? num(n)
const levelList = (): BuildingLevel[] => Array.from({ length: MAX_BUILDING_LEVEL }, (_, i) => (i + 1) as BuildingLevel)
const speedNote = (): string => `speed ×${buildingSpeed(MAX_BUILDING_LEVEL)}`

// --- 07 §2 ----------------------------------------------------------------------------------------------------------

const FRACTION_WORDS: Readonly<Record<number, string>> = { 0.25: 'a quarter', 0.5: 'half' }

function jobTimes(): string {
  const sites = FARM_BUILDING_IDS.filter((id) => BUILDINGS[id].job === 'gather').length
  const top = ITEM_GRADES as 10
  return table(['Job', 'Minutes per output', 'Grade 1', `Grade ${top}`], [
    [`Gather one raw item (${word(sites)} sites)`, `${GATHER_BASE_MINUTES} + ${GATHER_MINUTES_PER_GRADE}(*g*−1)`, num(gatherBaseMinutes(1)), num(gatherBaseMinutes(top))],
    [`Craft one item (${BUILDINGS.pantry.name})`, `${FRACTION_WORDS[CRAFT_SHARE_OF_GATHER] ?? `×${CRAFT_SHARE_OF_GATHER}`} of gathering`,
      num(craftBaseMinutes(1)), num(craftBaseMinutes(top))],
    [`Cook one dish (${BUILDINGS.kitchen.name}, every kind)`, `${COOK_BASE_MINUTES} + ${COOK_MINUTES_PER_GRADE}(*g*−1)`, num(cookBaseMinutes(1)), num(cookBaseMinutes(top))],
  ])
}

// --- 07 §3 ----------------------------------------------------------------------------------------------------------

const DESTINATION_LABEL: Readonly<Record<Destination, string>> = {
  speed: 'Speed', stamina: 'Stamina', power: 'Power', guts: 'Guts', wit: 'Wit', skill: 'Skill: Friend and Group',
  constellation: 'Constellation', inspiration: 'Inspiration',
}
const APTITUDE_LABEL: Readonly<Record<FarmAptitude['key'], string>> = {
  sprint: 'Sprint', mile: 'Mile', medium: 'Medium', long: 'Long', front: 'Front Runner', pace: 'Pace Chaser', late: 'Late Surger', end: 'End Closer',
}
/** Why each pair (07 §3): the page's reasons, kept beside the table they explain. */
const WHY: Readonly<Record<FamilyId, string>> = {
  sweets: 'Speed for the shortest races',
  fish: "Power for the mile's push",
  'herbs-spices': 'Wit for the tactical middle distances',
  fruits: 'Stamina for the long races',
  'nuts-seeds': 'Guts to come from the back',
  grains: 'Runs with the pack, like a team card',
  vegetables: 'Leads the way, as the tree grows out from its root',
  mushrooms: 'Grows in the shade and comes late, like a lineage',
}

function aptitudes(): string {
  return table(['Family', 'Aptitude that suits it', 'Why the pair'], (Object.keys(FAMILY_APTITUDE) as FamilyId[]).map((family) => [
    `${FAMILIES[family].name} (${DESTINATION_LABEL[FAMILIES[family].destination]})`, APTITUDE_LABEL[FAMILY_APTITUDE[family].key], WHY[family],
  ]))
}

/** The letters that suit a family: the owner's "4–5 levels a day when suited" (D336). */
const SUITED: readonly Grade[] = ['S', 'A']
/** "Working without a break" (07 §3): a whole day of listed minutes. */
const MINUTES_A_DAY = 24 * 60

function multipliers(): string {
  const bands: { letters: Grade[]; tenths: number }[] = []
  for (const [letter, tenths] of Object.entries(FARM_EXP_TENTHS) as [Grade, number][]) {
    const band = bands.find((b) => b.tenths === tenths)
    if (band) band.letters.push(letter)
    else bands.push({ letters: [letter], tenths })
  }
  const perDay = (tenths: number, level: number) => ((MINUTES_A_DAY * tenths) / TENTHS / farmExpToNext(level)).toFixed(1)
  const last = FARM_LEVEL_CAP - 1
  const mark = (letters: readonly Grade[], text: string) => (letters.some((l) => SUITED.includes(l)) ? bold(text) : text)
  return table(['Her aptitude for the family', ...bands.map((b) => b.letters.join(', '))], [
    ['Farm EXP ×', ...bands.map((b) => mark(b.letters, (b.tenths / TENTHS).toFixed(1)))],
    [`Levels a day, working without a break, at Lv 1 → Lv ${last}`, ...bands.map((b) => `${perDay(b.tenths, 1)} → ${perDay(b.tenths, last)}`)],
  ])
}

// --- 07 §4 ----------------------------------------------------------------------------------------------------------

function levelGrades(): string {
  return table(['Grade', 'Farm Lv', 'EXP'], [
    ...ITEM_GRADE_LIST.map((g) => [g, gradeOpensAtFarmLevel(g), num(farmExpAtLevel(gradeOpensAtFarmLevel(g)))]),
    [`(Lv ${FARM_LEVEL_CAP})`, FARM_LEVEL_CAP, num(farmExpAtLevel(FARM_LEVEL_CAP))],
  ])
}

// --- 07 §6 ----------------------------------------------------------------------------------------------------------

const sameSlots = (a: BuildingId, b: BuildingId): boolean => SLOTS[a].every((n, i) => n === SLOTS[b][i])

function farmSlots(): string {
  const sites = FARM_BUILDING_IDS.filter((id) => BUILDINGS[id].job === 'gather')
  const common = sites.reduce((best, id) => (sites.filter((s) => sameSlots(s, id)).length > sites.filter((s) => sameSlots(s, best)).length ? id : best))
  const others = sites.filter((id) => sameSlots(id, common))
  const solo = FARM_BUILDING_IDS.filter((id) => !others.includes(id)).reverse()
  const cells = (id: BuildingId) => levelList().map((lv) => (lv === MAX_BUILDING_LEVEL ? `${totalSlots(id, lv)}, ${speedNote()}` : totalSlots(id, lv)))
  const sum = (lv: BuildingLevel) => FARM_BUILDING_IDS.reduce((total, id) => total + totalSlots(id, lv), 0)
  const top = sum(MAX_BUILDING_LEVEL)
  return table(['Building', ...levelList().map((lv) => `Lv ${lv}`)], [
    ...solo.map((id) => [bold(BUILDINGS[id].name), ...cells(id)]),
    [bold(`Each of the other ${word(others.length)} sites`), ...cells(common)],
    [bold(`All ${word(FARM_BUILDING_IDS.length)}`), ...levelList().map((lv) =>
      (lv === MAX_BUILDING_LEVEL ? `${top} (${num(top * buildingSpeed(MAX_BUILDING_LEVEL))} slot-equivalents)` : bold(sum(lv))))],
  ])
}

// --- 07 §7 ----------------------------------------------------------------------------------------------------------

const sameUpgrades = (a: BuildingId, b: BuildingId): boolean =>
  UPGRADES[a].every((s, i) => s.prizeMoney === UPGRADES[b][i]!.prizeMoney && s.each === UPGRADES[b][i]!.each && s.grade === UPGRADES[b][i]!.grade)

function farmCost(id: BuildingId, step: UpgradeStep, toLevel: 2 | 3): string {
  const families = upgradeFamilies(id)
  const whose = families.length === 1 && BUILDINGS[id].family !== null ? 'of its family'
    : toLevel === 2 ? `of each of the ${word(families.length)} families` : 'of each family'
  return `${num(step.prizeMoney)} PM + ${step.each} crafted grade ${step.grade} ${whose}`
}

/** "one more slot; two for the Kitchen": what Lv 2 adds, from the slot table. */
function lv2Adds(ids: readonly BuildingId[]): string {
  const added = (id: BuildingId) => totalSlots(id, 2) - totalSlots(id, 1)
  const usual = added(ids[0]!)
  const exceptions = ids.filter((id) => added(id) !== usual).map((id) => `${word(added(id))} for the ${BUILDINGS[id].name}`)
  return [`${word(usual)} more slot${usual === 1 ? '' : 's'}`, ...exceptions].join('; ')
}

function farmUpgrades(): string {
  const sites = FARM_BUILDING_IDS.filter((id) => BUILDINGS[id].job === 'gather')
  const grouped = sites.every((id) => sameUpgrades(id, sites[0]!))
  const rows: [string, BuildingId][] = [
    ...(grouped ? [['Each site', sites[0]!] as [string, BuildingId]] : sites.map((id) => [BUILDINGS[id].name, id] as [string, BuildingId])),
    ...FARM_BUILDING_IDS.filter((id) => !sites.includes(id)).map((id) => [BUILDINGS[id].name, id] as [string, BuildingId]),
  ]
  const total = (i: 0 | 1) => FARM_BUILDING_IDS.reduce((sum, id) => sum + UPGRADES[id][i].prizeMoney, 0)
  return table(['Building', `To Lv 2 (${lv2Adds(FARM_BUILDING_IDS)})`, `To Lv 3 (${speedNote()})`], [
    ...rows.map(([label, id]) => [label, farmCost(id, UPGRADES[id][0], 2), farmCost(id, UPGRADES[id][1], 3)]),
    [bold(`All ${word(FARM_BUILDING_IDS.length)}`), bold(`${num(total(0))} PM`), bold(`${num(total(1))} PM`)],
  ])
}

// --- 05 §7 ----------------------------------------------------------------------------------------------------------

function facilityCost(id: BuildingId, step: UpgradeStep): string {
  const families = upgradeFamilies(id)
  const what = families.length === 1 ? `${step.each} ${FAMILIES[families[0]!].name} crafted`
    : families === STAT_FAMILIES ? `${step.each} crafted of each stat family`
      : families === DOJO_FAMILIES ? `${step.each} crafted of each of its ${word(families.length)} families`
        : `${step.each} crafted of each of ${word(families.length)} families`
  return `${num(step.prizeMoney)} PM + ${what}, grade ${step.grade}`
}

function facilities(): string {
  const slotCell = (id: BuildingId, lv: BuildingLevel) => {
    const rooms = BUILDINGS[id].rooms.length, per = SLOTS[id][lv - 1]!
    const base = rooms === 0 ? `${per} slots` : lv === MAX_BUILDING_LEVEL ? `${rooms} × ${per}` : `${rooms} rooms × ${per}`
    return lv === MAX_BUILDING_LEVEL ? `${base}, ${speedNote()}` : base
  }
  const total = (i: 0 | 1) => FACILITY_IDS.reduce((sum, id) => sum + UPGRADES[id][i].prizeMoney, 0)
  return table(['Facility', ...levelList().map((lv) => `Lv ${lv}`), 'To Lv 2', 'To Lv 3'], [
    ...FACILITY_IDS.map((id) => [BUILDINGS[id].name, ...levelList().map((lv) => slotCell(id, lv)), facilityCost(id, UPGRADES[id][0]), facilityCost(id, UPGRADES[id][1])]),
    [bold(`All ${word(FACILITY_IDS.length)}`), ...levelList().map(() => ''), bold(`${num(total(0))} PM`), bold(`${num(total(1))} PM`)],
  ])
}

/** Keys are `[a-z-]+`, the docs check's pattern. */
export const LIVE_BLOCKS: Readonly<Record<string, () => string>> = Object.freeze({
  'farm-job-times': jobTimes,
  'farm-aptitudes': aptitudes,
  'farm-exp-multipliers': multipliers,
  'farm-level-grades': levelGrades,
  'farm-slots': farmSlots,
  'farm-upgrades': farmUpgrades,
  'facility-slots-upgrades': facilities,
})
