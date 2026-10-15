// The Scenario Gate's view models (T141 "Scenario Gate"; docs/game/03-uma-progression.md §4, §5, §10.8;
// docs/game/04-tiers-and-promotion.md §9; 10 "Entry"): every Uma's career, the Advance sheet and the Promote sheet.
// "After" comes from running the operation itself on a copy of the state (`advance-scenario`, `promote`), so the sheet
// shows exactly what the tap will do; the layer and the buff come from rework/training's tables.
import { careerComplete, goalRaceIds, scenarioJourneySummary, CAREER_STAGE_LABELS, careerStage, DISTANCE_CATEGORIES, STATS, type DistanceCategory, type RaceTemplate, type Stats } from '@racer/domain'
import { OPERATIONS, type OperationEnv } from '@racer/domain/check-in'
import { advanceReadiness, canStartExpedition, capProfileAt, gateLevel, lifetimeLevel, promotionReadiness, scenarioNumber, scenarioRow, spCapAt, PROMOTION_UMA_TICKETS } from '@racer/domain/tiers'
import { isRefusal, type ScenarioOfTier, type UmaState } from '@racer/domain/state'
import {
  BONDS_BY_SCENARIO, LAYER_SIZES, bondsThrough, deriveUmaPreset, isOpen, layerUnlocks, promotionPresetStats, reworkBuff,
  type UnlockKind,
} from '@racer/domain/training'
import type { WorkState } from '@racer/domain/work'
import type { RaceResultRow } from '@racer/domain/save'
import { holdLevel } from './view'
import { racingWords } from './words'

// ---- Careers (03 §4) ----------------------------------------------------------------------------------------------

export interface GoalRace {
  readonly raceId: string
  readonly name: string
  readonly won: boolean
  /** The set's name for a set leg. */
  readonly set: string | null
}

export interface CareerRow {
  readonly umaId: string
  readonly name: string
  readonly tier: number
  readonly scenario: number
  readonly scenarioName: string
  readonly level: number
  readonly lifetime: number
  /** "Trials · 1 of 2", or "Career complete". */
  readonly stage: string
  readonly goals: readonly GoalRace[]
  readonly won: number
  readonly total: number
  /** The Racing Level her career holds her at while she sits on it, or null. */
  readonly held: number | null
  readonly atGate: boolean
  /** `advanceReadiness` is ready: the Gate's counter. */
  readonly ready: boolean
}

function goalRaces(uma: UmaState, raceName: (id: string) => string): GoalRace[] {
  return uma.career.goals.flatMap((goal): GoalRace[] => {
    if (goal.series) return goal.series.legs.map((leg) => ({ raceId: leg.raceId, name: raceName(leg.raceId), won: leg.status === 'completed', set: goal.series!.tag }))
    return goalRaceIds(goal).slice(0, 1).map((raceId) => ({ raceId, name: raceName(raceId), won: goal.status === 'completed', set: null }))
  })
}

export function careerRow(uma: UmaState, name: (umaId: string) => string, raceName: (id: string) => string): CareerRow {
  const summary = scenarioJourneySummary(uma.career)
  const stage = careerStage(uma.career)
  const goals = goalRaces(uma, raceName)
  const stageGoals = stage === null ? [] : uma.career.goals.filter((goal) => goal.slot === stage)
  const held = holdLevel(uma)
  return {
    umaId: uma.outfitId,
    name: name(uma.outfitId),
    tier: uma.tier,
    scenario: uma.scenario,
    scenarioName: scenarioRow(scenarioNumber(uma)).name,
    level: uma.racing.level,
    lifetime: lifetimeLevel(uma.tier, uma.racing.level),
    stage: careerComplete(uma.career) || stage === null
      ? racingWords('career-complete')
      : racingWords('career-stage', { stage: CAREER_STAGE_LABELS[stage], won: stageGoals.filter((goal) => goal.status === 'completed').length, total: stageGoals.length }),
    goals,
    won: summary.completed,
    total: uma.career.goals.length,
    held: held !== null && uma.racing.level >= held ? held : null,
    atGate: uma.racing.level >= gateLevel(uma.scenario),
    ready: !isRefusal(advanceReadiness(uma)),
  }
}

/** Every Uma's career: ready to advance first, then D181's order by lifetime level, then name. */
export function careerRows(state: Pick<WorkState, 'umas'>, name: (umaId: string) => string, raceName: (id: string) => string): CareerRow[] {
  return Object.values(state.umas).map((uma) => careerRow(uma, name, raceName))
    .sort((a, b) => Number(b.ready) - Number(a.ready) || b.lifetime - a.lifetime || a.name.localeCompare(b.name) || (a.umaId < b.umaId ? -1 : 1))
}

// ---- The Advance sheet (03 §5) -------------------------------------------------------------------------------------

export interface PresetDelta {
  readonly preset: DistanceCategory
  readonly before: { readonly stats: Stats; readonly skillPoints: number; readonly caps: Stats; readonly spCap: number }
  readonly after: { readonly stats: Stats; readonly skillPoints: number; readonly caps: Stats; readonly spCap: number }
}

export interface AdvanceSheet {
  readonly umaId: string
  readonly from: { readonly T: number; readonly name: string }
  readonly to: { readonly T: number; readonly name: string }
  readonly levelFrom: number
  readonly levelTo: number
  readonly presets: readonly PresetDelta[]
  /** The new layer as counts: "4 constellation nodes · 4 Inspiration golds …". */
  readonly layer: readonly string[]
  /** Earlier layers not finished: "Layer 1: 23 of 27. The rest stay open." */
  readonly unfinished: readonly string[]
  readonly buff: { readonly name: string; readonly rule: string }
  /** Her new career's races by name, in goal order. */
  readonly career: readonly GoalRace[]
  /** The Uma after the advance, from the operation on a copy. */
  readonly after: UmaState
}

const LAYER_WORDS: readonly [readonly UnlockKind[], Parameters<typeof racingWords>[0]][] = [
  [['node'], 'layer-nodes'],
  [['slot'], 'layer-slots'],
  [['unique'], 'layer-uniques'],
  [['gold'], 'layer-golds'],
  [['single', 'duo', 'sun'], 'layer-extra'],
]

/** A layer's fixed unlocks as counts, then its bonds (06 §2's pacing count). */
export function layerCounts(s: ScenarioOfTier): string[] {
  const unlocks = layerUnlocks(s)
  const lines = LAYER_WORDS.flatMap(([kinds, word]) => {
    const n = unlocks.filter((entry) => kinds.includes(entry.kind)).length
    return n > 0 ? [racingWords(word, { n })] : []
  })
  return [...lines, racingWords('layer-bonds', { n: BONDS_BY_SCENARIO[s - 1]! })]
}

/** Layers 1 … s not finished: each one's open unlocks of its size, bonds counted in order across layers. */
export function unfinishedLayers(uma: UmaState): string[] {
  const lines: string[] = []
  for (let layer = 1; layer <= uma.scenario; layer += 1) {
    const s = layer as ScenarioOfTier
    const fixed = layerUnlocks(s).filter((entry) => isOpen(uma.build, entry)).length
    const bonds = Math.max(0, Math.min(BONDS_BY_SCENARIO[s - 1]!, uma.build.bonds.length - (s === 1 ? 0 : bondsThrough((s - 1) as ScenarioOfTier))))
    const total = LAYER_SIZES[s - 1]!.total
    if (fixed + bonds < total) lines.push(racingWords('unfinished', { layer, open: fixed + bonds, total }))
  }
  return lines
}

/** The Advance sheet, or null when she can't advance now. "After" is `advance-scenario` run on a copy of the state. */
export function advanceSheet(state: WorkState, umaId: string, env: OperationEnv, now: number, raceName: (id: string) => string): AdvanceSheet | null {
  const uma = state.umas[umaId]
  if (!uma || isRefusal(advanceReadiness(uma, env.catalogue))) return null
  const advanced = OPERATIONS['advance-scenario'](state, { umaId }, now, env)
  if (isRefusal(advanced)) return null
  const after = advanced.state.umas[umaId]!
  const fromT = scenarioNumber(uma)
  const toT = scenarioNumber(after)
  const side = (who: UmaState, T: number, preset: DistanceCategory) => {
    const derived = deriveUmaPreset(who, preset, env.content)
    return { stats: { ...derived.stats }, skillPoints: derived.skillPoints, caps: capProfileAt(T), spCap: spCapAt(T) }
  }
  return {
    umaId,
    from: { T: fromT, name: scenarioRow(fromT).name },
    to: { T: toT, name: scenarioRow(toT).name },
    levelFrom: uma.racing.level,
    levelTo: after.racing.level,
    presets: DISTANCE_CATEGORIES.map((preset) => ({ preset, before: side(uma, fromT, preset), after: side(after, toT, preset) })),
    layer: layerCounts(after.scenario),
    unfinished: unfinishedLayers(uma),
    buff: { name: reworkBuff(toT).name, rule: reworkBuff(toT).rule },
    career: goalRaces(after, raceName),
    after,
  }
}

/** The stats shown before and after, in order. */
export const SHEET_STATS = STATS

// ---- The Promote sheet (04 §9) -------------------------------------------------------------------------------------

export interface PromoteWork {
  readonly place: string | null
  readonly running: boolean
  readonly ready: boolean
  readonly queued: number
  /** The running entry's start, for −30m's Speed Ticket. */
  readonly startedAt: number | null
  readonly endsAt: number | null
}

export interface PromoteSheet {
  readonly umaId: string
  readonly from: number
  readonly to: number
  /** Where she arrives: the next tier's first scenario. */
  readonly arrive: string
  readonly races: number
  readonly wins: number
  readonly g1Wins: number
  readonly expeditionWins: number
  readonly ticket: number
  /** `promotionReadiness`: Promote is enabled only while she is free. */
  readonly ready: boolean
  readonly free: boolean
}

/** Whether she holds a completed run: the only way to the Promote sheet before phase 9 (the dev proof). */
export const holdsCompletedRun = (uma: UmaState): boolean => uma.expedition.runs.some((run) => run.completed)

export function promoteSheet(state: WorkState, umaId: string, rows: readonly RaceResultRow[], races: ReadonlyMap<string, RaceTemplate>): PromoteSheet | null {
  const uma = state.umas[umaId]
  if (!uma || !holdsCompletedRun(uma) || uma.tier === 3) return null
  const readiness = promotionReadiness(state, umaId)
  const here = rows.filter((row) => row.tier === uma.tier)
  const won = here.filter((row) => row.run.field.find((runner) => runner.isPlayer)?.placement === 1)
  const to = (uma.tier + 1) as 2 | 3
  return {
    umaId,
    from: uma.tier,
    to,
    arrive: racingWords('promote-arrive', { scenario: scenarioRow(scenarioNumber({ tier: to, scenario: 1 })).name }),
    races: here.length,
    wins: won.length,
    g1Wins: won.filter((row) => races.get(row.raceId)?.grade === 'g1').length,
    expeditionWins: Math.max(0, ...uma.expedition.runs.filter((run) => run.completed).map((run) => run.wins)),
    ticket: PROMOTION_UMA_TICKETS,
    ready: !isRefusal(readiness),
    free: isRefusal(readiness) ? readiness.code !== 'busy' : true,
  }
}

/** `promote`'s input: the presets' stats and SP as she leaves, from the Training Hub's derivation (D340). */
export const promoteInput = (uma: UmaState, env: OperationEnv) => ({ umaId: uma.outfitId, presets: promotionPresetStats(uma, env.content) })

// ---- The Expedition Map, a placeholder (10 "Entry") ----------------------------------------------------------------

export interface MapRow {
  readonly umaId: string
  readonly name: string
  readonly lifetime: number
  /** `canStartExpedition`: ready for her World Expedition. */
  readonly ready: boolean
  /** Her distance to entry: "Scenario 4 · Racing Lv 37" — her tier's last scenario and gate. */
  readonly distance: string
  /** She holds a completed run (the dev proof): Promote opens from here. */
  readonly complete: boolean
}

export function mapRows(state: Pick<WorkState, 'umas'>, name: (umaId: string) => string, env: Pick<OperationEnv, 'catalogue'>): MapRow[] {
  return Object.values(state.umas).map((uma): MapRow => {
    return {
      umaId: uma.outfitId,
      name: name(uma.outfitId),
      lifetime: lifetimeLevel(uma.tier, uma.racing.level),
      ready: canStartExpedition(uma, env.catalogue),
      distance: racingWords('map-distance', { scenario: uma.scenario, level: uma.racing.level }),
      complete: holdsCompletedRun(uma),
    }
  }).sort((a, b) => Number(b.complete) - Number(a.complete) || Number(b.ready) - Number(a.ready) || b.lifetime - a.lifetime || a.name.localeCompare(b.name))
}
