// The loop simulation's win table, generated offline (T132's "The win table"): `pnpm sim:loop --
// --refresh-wins` races the engine for every scenario T, grade (G3, G2, G1) and build share (0, 50, 100% of her layer)
// and writes packages/domain/src/sim/win-table.ts. The domain can't import the race engine, and 200 races a cell
// would break CI's budget, so the table is committed and the loop only reads it. Synthetic only, seeded, no Math.random.
//
// The Uma is T133's: harness's rework build of the ladder's Medium set (STAYER_POWER, the stamina card one node past
// its fair share, Power to the cap, Extra Stats leaning on Stamina) on T128's `deriveBuild`, with every earlier layer
// of the tier open and the cell's share of this one. At 100% it is `REWORK_TYPICAL_SETS`' medium build exactly. Rivals
// are T125's fields at 03 §9's handicaps through harness's `rivalRunnersAt`, and she carries harness's `PLAYER_KIT`.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { INSPIRATION_SLOTS, STRATEGIES, type Aptitudes, type InspirationSlot, type Strategy, type UmaTemplate } from '../../packages/domain/src/index'
import { cardNodeId, treeCardNodesAt } from '../../packages/domain/src/training/trees/index'
import { layerPart, WIN_SHARES } from '../../packages/domain/src/sim/build'
import { WIN_GRADES, WIN_PLACES, type WinCell, type WinGrade, type WinTable } from '../../packages/domain/src/sim/places'
import { tierAndScenario, type Preset, type ScenarioOfTier, type UmaBuild } from '../../packages/domain/src/tiers/index'
import { deriveBuild, extraCapacity, LAYERS, layerUnlocks, type DerivedBuild, type TrainingContent } from '../../packages/domain/src/training/index'
import { simulateRace } from '../../packages/race/src/index'
import {
  PLAYER_KIT, REWORK_UMA, STAYER_POWER, allocateNodes, dealNodes, leanExtraNodes, reworkBuild, reworkCard, reworkCardCap, reworkFairShare,
  rivalRunnersAt, typicalCourse,
} from './harness'

export const WIN_TABLE_FILE = fileURLToPath(new URL('../../packages/domain/src/sim/win-table.ts', import.meta.url))
/** Every cell races the Medium set's distance: 2,000 m, 12 runners. */
const METERS = 2000
const FIELD = 12
/** Scenarios with content today: 14, until the 15th ships (04 §2). */
const SCENARIOS = 14
const ENGINE = 'v9 (simulateRace)'
const LEAN_STAT = 'stamina'

const A: Aptitudes = {
  surface: { turf: 'A', dirt: 'A' }, distance: { sprint: 'A', mile: 'A', medium: 'A', long: 'A' }, strategy: { front: 'A', pace: 'A', late: 'A', end: 'A' },
} as Aptitudes
/** One invented parent per Inspiration slot, as harness's rework build fills them (each her own character). */
const PARENTS = Object.fromEntries(INSPIRATION_SLOTS.map((slot, index) => [slot, {
  ...REWORK_UMA, id: `sim-parent-${index}`, charaId: `chara-sim-parent-${index}`, name: `Synthetic sim-parent-${index}`, aptitudes: A,
} satisfies UmaTemplate])) as Record<InspirationSlot, UmaTemplate>

/**
 * The Medium set's build at scenario T with `share` of her layer: harness's `reworkBuild` allocation and Extra Stats
 * lean, cut to the unlocks that share holds (every earlier layer, `layerPart` of this one). Active Extra Stats are the
 * lean's opened nodes, topped up with any other opened node, to the capacity.
 */
export function shareBuild(T: number, share: number): DerivedBuild {
  const at = tierAndScenario(T)
  const N = treeCardNodesAt(T)
  const deck = STAYER_POWER
  const options: { first: number[]; friend?: 'first' | 'last' } = { first: [3] }
  const cards = deck.map((type, index) => reworkCard(type, T, index))
  const ids = cards.map((card) => card.id)
  const queue = dealNodes(ids, allocateNodes(N, reworkFairShare(T), reworkCardCap(T), deck, 2, reworkFairShare(T) + 1, options), deck, options)
  const unlocks = [...LAYERS.filter((s) => s < at.scenario).flatMap((s) => layerUnlocks(s)), ...layerPart(at.scenario as ScenarioOfTier, share)]
  const targets = (...kinds: string[]) => unlocks.filter((entry) => kinds.includes(entry.kind)).map((entry) => entry.target)
  const slots = targets('slot') as InspirationSlot[]
  const extraNodes = targets('single', 'duo', 'sun')
  const lean = leanExtraNodes(at.scenario as ScenarioOfTier, LEAN_STAT).filter((id) => extraNodes.includes(id))
  const active = [...lean, ...extraNodes.filter((id) => !lean.includes(id))].slice(0, extraCapacity(at.scenario as ScenarioOfTier))
  const preset: Preset = {
    cardSetIds: ids,
    assignments: Object.fromEntries(queue.map((cardId, index) => [cardNodeId(index + 1), cardId])),
    lineage: Object.fromEntries(slots.map((slot) => [slot, PARENTS[slot].id])),
    activeExtraNodes: active,
    loadoutSkillIds: [],
  }
  const build: UmaBuild = {
    constellationOpened: targets('node').length,
    inspiration: { slots, uniques: targets('unique') as InspirationSlot[], golds: targets('gold') },
    extraNodes,
    bonds: ids,
    presets: { sprint: preset, mile: preset, medium: preset, long: preset },
  }
  const content: TrainingContent = {
    umas: new Map([REWORK_UMA, ...Object.values(PARENTS)].map((uma) => [uma.id, uma])),
    cards: new Map(cards.map((card) => [card.id, card])),
    skills: new Map(),
  }
  return deriveBuild({ at, build, preset: 'mile', template: REWORK_UMA, content, goalsWon: 2 })
}

/** At 100% the share build is harness's typical Medium build, stat for stat: the generator checks it before racing. */
export function assertFullShareIsTypical(T: number): void {
  const typical = reworkBuild(T, STAYER_POWER, 2, reworkFairShare(T) + 1, LEAN_STAT, { first: [3] }).stats
  const mine = shareBuild(T, 1).stats
  if (JSON.stringify(typical) !== JSON.stringify(mine)) throw new Error(`T${T}: the 100% build ${JSON.stringify(mine)} isn't the typical ${JSON.stringify(typical)}`)
}

/** One cell: `races` races at each running style; it keeps the style that wins most (then places 2nd most). */
function cell(T: number, grade: WinGrade, share: number, races: number, seed: number): WinCell {
  const { stats } = shareBuild(T, share)
  let best: { places: number[]; strategy: Strategy } | null = null
  for (const strategy of STRATEGIES) {
    const places = WIN_PLACES.map(() => 0)
    for (let race = 0; race < races; race += 1) {
      const gate = race % FIELD
      const raceSeed = (seed + 1_000_003 * T + 7919 * race + 104_729 * WIN_GRADES.indexOf(grade)) >>> 0
      const player = { id: 'player', label: String(gate + 1), stats, strategy, gate, aptitude: { distance: 'A', surface: 'A', strategy: 'A' } as const, skills: PLAYER_KIT }
      const timeline = simulateRace({
        course: typicalCourse(METERS),
        seed: raceSeed,
        runners: [...rivalRunnersAt(T, grade, METERS, FIELD, gate, raceSeed), player].sort((a, b) => a.gate - b.gate),
      })
      const place = timeline.results.findIndex((result) => result.id === 'player') + 1
      places[Math.min(place, WIN_PLACES.length) - 1]! += 1
    }
    if (best === null || places[0]! > best.places[0]! || (places[0] === best.places[0] && places[1]! > best.places[1]!)) best = { places, strategy }
  }
  return best!
}

export function generateWinTable(races: number, seed: number, log: (line: string) => void = () => {}): WinTable {
  const cells: Record<string, Record<WinGrade, WinCell[]>> = {}
  for (let T = 1; T <= SCENARIOS; T += 1) {
    assertFullShareIsTypical(T)
    const row = {} as Record<WinGrade, WinCell[]>
    for (const grade of WIN_GRADES) {
      row[grade] = WIN_SHARES.map((share) => cell(T, grade, share, races, seed))
      log(`T${String(T).padStart(2)} ${grade}: ${row[grade].map((c) => `${String(Math.round((100 * c.places[0]!) / races)).padStart(3)}% win (${c.strategy})`).join(' · ')}`)
    }
    cells[String(T)] = row
  }
  return { seed, racesPerCell: races, engine: ENGINE, course: `typicalCourse(${METERS}), ${FIELD} runners`, cells }
}

/** The generated module: a header naming how it was made, then the counts. */
export function winTableSource(table: WinTable): string {
  const cellLine = (c: WinCell) => `{ places: [${c.places.join(', ')}], strategy: '${c.strategy}' }`
  const rows = Object.entries(table.cells).map(([T, grades]) =>
    `    '${T}': {\n${WIN_GRADES.map((grade) => `      ${grade}: [${grades[grade].map(cellLine).join(', ')}],`).join('\n')}\n    },`)
  return [
    '// GENERATED by `pnpm sim:loop -- --refresh-wins` (scripts/sim/loop-wins.ts); do not edit by hand.',
    `// Seed ${table.seed}, ${table.racesPerCell} races a cell at each of the four running styles (a cell keeps the one that wins most),`,
    `// engine ${table.engine}, ${table.course}. The Uma is T133's rework build of the ladder's Medium set (harness's`,
    "// `reworkBuild`) with every earlier layer and 0, 50 or 100% of this one open, carrying harness's PLAYER_KIT, against",
    "// T125's rival fields at 03 §9's handicaps (harness's `rivalRunnersAt`). Places: 1st–5th, then 6th and below.",
    "import type { WinTable } from './places'",
    '',
    'export const WIN_TABLE: WinTable = {',
    `  seed: ${table.seed},`,
    `  racesPerCell: ${table.racesPerCell},`,
    `  engine: '${table.engine}',`,
    `  course: '${table.course}',`,
    '  cells: {',
    ...rows,
    '  },',
    '}',
    '',
  ].join('\n')
}

export const writeWinTable = (table: WinTable): void => writeFileSync(WIN_TABLE_FILE, winTableSource(table))
