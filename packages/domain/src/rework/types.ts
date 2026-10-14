// Shared shapes for the rework's rules (docs/tasks/M033-rework-rules.md). T125 completes the state skeleton here
// (docs/rework/13-removals-and-plan-changes.md §6); each later task adds its own part.
import type { InspirationSlot } from '../inspiration'
import type { RacePreferences, ScenarioJourney } from '../save'
import { DISTANCE_CATEGORIES, type DistanceCategory, type Stats } from '../types'

/** A refused operation: a stable code and plain words the screen shows, with `{name}` placeholders filled from data. */
export interface Refusal {
  readonly refused: true
  readonly code: string
  /** Plain words, never protocol names (docs/rework/02-check-ins-and-notifications.md §9). */
  readonly reason: string
  readonly data?: Readonly<Record<string, string | number>>
}

export const refuse = (code: string, reason: string, data?: Refusal['data']): Refusal =>
  data ? { refused: true, code, reason, data } : { refused: true, code, reason }

export const isRefusal = (value: unknown): value is Refusal =>
  typeof value === 'object' && value !== null && (value as { refused?: unknown }).refused === true

/** Tier 1–3 (D327). */
export type Tier = 1 | 2 | 3
/** Scenario 1–5 of a tier. */
export type ScenarioOfTier = 1 | 2 | 3 | 4 | 5

/** Where an Uma is: scenario *s* of tier *t* is the game's scenario T = 5(t − 1) + s. */
export interface ScenarioAt {
  readonly tier: Tier
  readonly scenario: ScenarioOfTier
}

// ---- The state skeleton (13 §6) -----------------------------------------------------------------------------------
// Plain readonly state, one part per save kind, so phase 3's generation-2 save maps onto it one to one. T125 names the
// profile, the Umas, the work rows (only to see that one exists) and the ledger. Other tasks add their own parts (the
// Warehouse, buildings) beside these, and T125's operations carry every part they don't name through untouched, which
// is how the account carries at promotion (04 §4).

/** What one operation gives back: the new state and its receipt, or a refusal. `S` keeps a caller's wider state. */
export type OpResult<R, S extends ReworkState = ReworkState> = { readonly state: S; readonly receipt: R } | Refusal

/** The account: `profile/main` (13 §6). T130 and T131 add their fields. */
export interface AccountProfile {
  readonly generation: 2
  readonly createdAt: number
  readonly umaTickets: number
  readonly umaShards: number
  readonly prizeMoney: number
  readonly featuredUmaId: string | null
}

/** What a ledger row moves. Other tasks widen it with their own resources. */
export type LedgerResource = 'uma-tickets' | 'uma-shards'
/** Why a ledger row moved it. Other tasks widen it with their own reasons. */
export type LedgerReason = 'initial-uma-tickets' | 'unlock-uma' | 'uma-gate-shard' | 'uma-shard-exchange' | 'promotion-uma-ticket'

/** One append-only ledger row. Its id makes a payment once-only (04 §3, §6). */
export interface LedgerEntry {
  readonly id: string
  readonly resource: LedgerResource
  readonly delta: number
  readonly reason: LedgerReason
  /** When it was written, milliseconds since the epoch. */
  readonly at: number
}

/**
 * One distance preset (03 §6, 05 §9): who is in the card set, which card fills each open node, who sits in each open
 * Inspiration slot, which bought Extra Stats nodes are on, and the equipped skills. T128 owns its rules.
 */
export interface Preset {
  readonly cardSetIds: readonly string[]
  /** Node id (`n1` … `n28`) → card id. */
  readonly assignments: Readonly<Record<string, string>>
  /** Inspiration slot → the Uma template sitting in it. */
  readonly lineage: Readonly<Partial<Record<InspirationSlot, string>>>
  /** Active Extra Stats node ids, up to the scenario's capacity. */
  readonly activeExtraNodes: readonly string[]
  readonly loadoutSkillIds: readonly string[]
}

/**
 * Her one build for the tier (03 §6, 05 §9): what her four presets share, and the presets. Everything here resets at
 * promotion (04 §4). T128 completes it in place.
 */
export interface UmaBuild {
  /** Card nodes open, 0–28: a count, since the unlock order is fixed (05 §4). */
  readonly constellationOpened: number
  readonly inspiration: {
    readonly slots: readonly InspirationSlot[]
    /** Slots whose inherited unique is open (D336). */
    readonly uniques: readonly InspirationSlot[]
    /** `slot:gold1` / `slot:gold2` keys. */
    readonly golds: readonly string[]
  }
  /** Extra Stats node ids bought, oldest first (05 §6). */
  readonly extraNodes: readonly string[]
  /** Card ids bonded to her in this tier (06). */
  readonly bonds: readonly string[]
  readonly presets: Readonly<Record<DistanceCategory, Preset>>
}

/**
 * The build she starts a tier with: nothing open, nothing bonded, four empty presets whose loadouts hold only her own
 * unique skill (04 §4: "the loadout falls to her unique").
 */
export function emptyBuild(uniqueSkillId: string | null): UmaBuild {
  const preset = (): Preset => ({
    cardSetIds: [],
    assignments: {},
    lineage: {},
    activeExtraNodes: [],
    loadoutSkillIds: uniqueSkillId === null ? [] : [uniqueSkillId],
  })
  return {
    constellationOpened: 0,
    inspiration: { slots: [], uniques: [], golds: [] },
    extraNodes: [],
    bonds: [],
    presets: Object.fromEntries(DISTANCE_CATEGORIES.map((distance) => [distance, preset()])) as Record<DistanceCategory, Preset>,
  }
}

/** One run of a World Expedition, as 04 §3's history summarises it. Phase 9 adds the pool, families and fields. */
export interface ExpeditionRun {
  readonly expeditionId: string
  readonly races: number
  readonly wins: number
  readonly completed: boolean
}

/** One preset in a tier-history entry: its derived stats and SP (from the caller, T128) and its card set. */
export interface TierHistoryPreset {
  readonly stats: Stats
  readonly skillPoints: number
  readonly cardSetIds: readonly string[]
}

/** One tier she left (04 §3): when, how far she raced, her final build in brief and every Expedition run. */
export interface TierHistoryEntry {
  readonly tier: Tier
  readonly promotedAt: number
  readonly finalRacingLevel: number
  readonly presets: Readonly<Record<DistanceCategory, TierHistoryPreset>>
  readonly bonds: readonly string[]
  readonly runs: readonly ExpeditionRun[]
}

/** One Uma: `umas/{outfitId}` (13 §6, 03 §7). */
export interface UmaState extends ScenarioAt {
  readonly outfitId: string
  /** Racing Level 1–50 of her tier; `exp` is EXP into the level, or what a hold or the gate banks (03 §2). */
  readonly racing: { readonly level: number; readonly exp: number }
  /** Farm Level 1–50 of her tier and Farm EXP, in T127's units (07). */
  readonly farm: { readonly level: number; readonly exp: number }
  /** This scenario's career, frozen when she arrived (03 §4). */
  readonly career: ScenarioJourney
  /** Every career she left, closed, oldest first: history that survives promotion. */
  readonly closedCareers: readonly ScenarioJourney[]
  readonly build: UmaBuild
  readonly expedition: { readonly runs: readonly ExpeditionRun[] }
  readonly tierHistory: readonly TierHistoryEntry[]
  /** Kept at promotion (04 §4). */
  readonly raceDefaults: { readonly preferences: RacePreferences | null; readonly selectedPreset: DistanceCategory }
  readonly hallOfFame: { readonly inductedAt: number } | null
}

/**
 * The account's state. `work` is `work/{outfitId}`: T127 narrows it to its work row, and T125 only asks whether a row
 * exists (promotion needs her free, 04 §5).
 */
export interface ReworkState {
  readonly profile: AccountProfile
  readonly umas: Readonly<Record<string, UmaState>>
  readonly work: Readonly<Record<string, unknown>>
  readonly ledger: readonly LedgerEntry[]
}
