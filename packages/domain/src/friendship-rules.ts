// Friendship Training's rules as data (M020, D146, D168; docs/design/minigames.md#friendship-training). Every number
// here is a tuning draft that `pnpm sim:training` holds to its clear-rate table.

import type { CardEffect } from './cards'
import type { SupportCardType } from './content'
import type { DistanceCategory, RaceGrade, StatKey, Surface } from './types'

export type FtCardType = SupportCardType

export const FT_HAND_SIZE = 7
export const FT_WEEK_TRAINS = 3
export const FT_RACE_TRAINS = 4
export const FT_REDRAWS = 2
export const FT_MAX_TRAIN = 5
export const FT_MAX_REDRAW = 5
export const FT_SKILL_SLOTS = 5
export const FT_BOND_GAUGE = 3
export const FT_WEEKS_PER_STAGE = 2
export const FT_DECK_COPIES = 2
export const FT_SET_OTHERS = 5
export const FT_OFFER_SIZE = 3

/** Stages by the star being earned: 1★ one stage, up to three for 4★ and 5★. */
export const FT_STAGES: Readonly<Record<number, number>> = { 1: 1, 2: 2, 3: 2, 4: 3, 5: 3 }
/** 3★ and 5★ repeat 2★'s and 4★'s length with harder targets. */
export const FT_EARNING_TARGET_MULT: Readonly<Record<number, number>> = { 1: 1, 2: 1, 3: 1.18, 4: 1, 5: 1.12 }
export const FT_STAGE_GRADES: readonly RaceGrade[] = ['g3', 'g2', 'g1']

/**
 * A standard facility's target in each stage's two weeks, and each stage's race. Each sits near the 4th percentile of
 * what the bot can score there, so an encounter is about 96% clearable and the run's chance falls with its length.
 * Stage two jumps because by then the main card has bonded and the deck has grown and taken a skill.
 */
export const FT_WEEK_TARGETS: readonly (readonly [number, number])[] = [[370, 390], [1390, 1460], [2400, 2600]]
export const FT_RACE_TARGETS: readonly number[] = [650, 1440, 2800]

/** Three facilities are offered each week: easy, standard and hard, for 2, 3 and 4 fans. */
export const FT_FACILITY_GRADES = [
  { target: 0.9, payout: 2 },
  { target: 1, payout: 3 },
  { target: 1.15, payout: 4 },
] as const
export const FT_RACE_PAYOUT = 5
export const FT_UNUSED_TRAIN_FANS = 2

export const FT_CARD_POINTS = { onType: 10, offType: 5, broad: 7 } as const
export const FT_STRENGTH_PER_STAR = 0.1
export const FT_UPGRADE_POINTS = 5

/** A Rainbow's mult grows by one per on-type card past three, up to this many. */
export const FT_RAINBOW_MAX_EXTRA = 2

export type FtFormationId = 'solo' | 'duo' | 'friendship' | 'trio' | 'rainbow' | 'full-team' | 'rainbow-team'

export const FT_FORMATIONS: Readonly<Record<FtFormationId, { name: string; points: number; mult: number }>> = {
  solo: { name: 'Solo', points: 5, mult: 1 },
  duo: { name: 'Duo', points: 10, mult: 2 },
  friendship: { name: 'Friendship', points: 15, mult: 2 },
  trio: { name: 'Trio', points: 30, mult: 3 },
  rainbow: { name: 'Rainbow', points: 30, mult: 3 },
  'full-team': { name: 'Full team', points: 40, mult: 4 },
  'rainbow-team': { name: 'Rainbow team', points: 60, mult: 6 },
}

/** The trait a card's strongest effect-profile weight gives it, and what it does. */
export const FT_TRAITS: Readonly<Record<CardEffect, { name: string; rule: string }>> = {
  friendshipBonus: { name: 'Friendship', rule: '+1 mult on its own facility' },
  trainingBonus: { name: 'Training', rule: '+6 points' },
  raceBonus: { name: 'Race', rule: '+50% card points in races' },
  specialtyPriority: { name: 'Specialty', rule: 'counts twice towards a Rainbow' },
  statBonus: { name: 'Stat', rule: '+4 points, +2 more on its own facility' },
  hintFrequency: { name: 'Hint', rule: 'draw a card after the train' },
  skillPointBonus: { name: 'Skill points', rule: '+1 fan when played' },
  initialStats: { name: 'Head start', rule: '+10 points on the first train' },
}
/** A bonded main card's signature plays its kinds at this strength. */
export const FT_SIGNATURE_MULT = 1.5

export const FT_SHOP_PRICES = { copy: 4, remove: 3, upgrade: 3, white: 6, gold: 8, reroll: 2 } as const
export type FtShopItem = keyof typeof FT_SHOP_PRICES

// ── Races ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const FAVOURED: Readonly<Record<Surface, Readonly<Record<DistanceCategory, readonly [StatKey, StatKey]>>>> = {
  turf: { sprint: ['speed', 'power'], mile: ['speed', 'wit'], medium: ['speed', 'stamina'], long: ['stamina', 'guts'] },
  dirt: { sprint: ['power', 'guts'], mile: ['speed', 'power'], medium: ['speed', 'power'], long: ['stamina', 'power'] },
}

/** The two stat types a course favours: they count as on-type in its race. */
export const ftFavouredTypes = (distance: DistanceCategory, surface: Surface): readonly [StatKey, StatKey] =>
  FAVOURED[surface][distance]

export type FtRivalRuleId =
  | 'front-runner' | 'heavy-going' | 'marked' | 'fast-pace' | 'crowded-field' | 'stamina-test' | 'traffic' | 'duel'

export const FT_RIVAL_RULES: Readonly<Record<FtRivalRuleId, { name: string; rule: string; perTrain: boolean }>> = {
  'front-runner': { name: 'Front-runner', rule: 'Your first train scores half.', perTrain: true },
  'heavy-going': { name: 'Heavy going', rule: 'Speed cards score half their card points.', perTrain: true },
  marked: { name: 'Marked', rule: "The main card's trait and signature are off.", perTrain: true },
  'fast-pace': { name: 'Fast pace', rule: 'One redraw fewer.', perTrain: false },
  'crowded-field': { name: 'Crowded field', rule: 'Hand size 6.', perTrain: false },
  'stamina-test': { name: 'Stamina test', rule: 'Trains of fewer than three cards score half.', perTrain: true },
  traffic: { name: 'Traffic', rule: 'Rainbow, Full team and Rainbow team get −1 mult.', perTrain: true },
  duel: { name: 'Duel', rule: 'The target is 25% higher, and you get a fifth train.', perTrain: false },
}
export const FT_RIVAL_RULE_IDS = Object.keys(FT_RIVAL_RULES) as FtRivalRuleId[]

// ── Skills ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export type FtSkillRuleId =
  | 'gate' | 'second-wind' | 'vision' | 'positioning' | 'kick' | 'corner' | 'straight' | 'spurt' | 'surge'
  | 'aptitude' | 'pressure' | 'form'

/** Each rule's white and gold values; `rule` reads them. */
export const FT_SKILL_RULES: Readonly<Record<FtSkillRuleId, { name: string; white: number; gold: number; rule: (value: number, gold: boolean, stat?: string) => string }>> = {
  gate: { name: 'Gate', white: 1.5, gold: 2, rule: (v) => `A race's first train scores × ${v}.` },
  'second-wind': { name: 'Second Wind', white: 1, gold: 2, rule: (v) => `+${v} redraw${v > 1 ? 's' : ''} each week and race.` },
  vision: { name: 'Vision', white: 1, gold: 1, rule: (_v, gold) => gold ? '+1 hand size and +1 redraw.' : '+1 hand size.' },
  positioning: { name: 'Positioning', white: 1, gold: 1, rule: (_v, gold) => gold ? '+1 train and +1 mult in races.' : '+1 train in races.' },
  kick: { name: 'Kick', white: 4, gold: 6, rule: (v) => `+${v} points per card trained.` },
  corner: { name: 'Corner', white: 1.5, gold: 2, rule: (v) => `The first train of each week and race scores × ${v}.` },
  straight: { name: 'Straight', white: 20, gold: 30, rule: (v) => `+${v} points on a train of four or more cards.` },
  spurt: { name: 'Spurt', white: 3, gold: 5, rule: (v) => `+${v} mult on the last train of a week or race.` },
  surge: { name: 'Surge', white: 2, gold: 3, rule: (v) => `+${v} mult on a train with a Speed card.` },
  aptitude: { name: 'Aptitude', white: 5, gold: 8, rule: (v, _g, stat) => `+${v} points per ${stat ?? 'matching'} card trained.` },
  pressure: { name: 'Pressure', white: 1, gold: 1, rule: (_v, gold) => gold ? 'The rival rule is off.' : "The rival rule's per-train effect lifts after your first train." },
  form: { name: 'Form', white: 10, gold: 15, rule: (v) => `+${v} points on every train.` },
}

export const ftSkillValue = (rule: FtSkillRuleId, gold: boolean): number =>
  gold ? FT_SKILL_RULES[rule].gold : FT_SKILL_RULES[rule].white

// ── Scenario twists (T064) ─────────────────────────────────────────────────────────────────────────────────────────

export type FtTwistId =
  | 'foundation' | 'team-spirit' | 'climax' | 'performance' | 'fragments' | 'expedition' | 'genres' | 'cooking'
  | 'research' | 'legends' | 'construction' | 'soak' | 'shared-light' | 'orders'

/** One twist per scenario, in tier order, each carrying its buff's theme (D165, D168). */
export const FT_TWISTS: readonly { id: FtTwistId; name: string; rule: string }[] = [
  { id: 'foundation', name: 'Foundation', rule: 'The base game.' },
  { id: 'team-spirit', name: 'Team Spirit', rule: 'A train with five different characters adds +1 mult.' },
  { id: 'climax', name: 'Climax', rule: 'Each race won adds +1 mult to every later train.' },
  { id: 'performance', name: 'Performance', rule: 'Each train earns a note for every stat type in it. With all five, the next train scores × 2.' },
  { id: 'fragments', name: 'Fragments', rule: 'Each train earns a fragment, two with a card at 4★ or more. At eight, the next train scores × 1.5.' },
  { id: 'expedition', name: 'Expedition', rule: "Winning a race takes its first favoured type with you: it is on-type for the rest of the run." },
  { id: 'genres', name: 'Genres', rule: 'The same facility in consecutive weeks adds +1 mult per week of the streak.' },
  { id: 'cooking', name: 'Cooking', rule: "Each week's facility gives its ingredient. Three of a kind cook a dish: × 1.2 for the next three trains." },
  { id: 'research', name: 'Research', rule: 'Each cleared week upgrades its facility: +10% there per level.' },
  { id: 'legends', name: 'Legends', rule: 'One other card of the set plays as if at 5★.' },
  { id: 'construction', name: 'Construction', rule: 'Before the first week, build two facilities. They pay +5 points per card.' },
  { id: 'soak', name: 'Soak', rule: "After each race, the next stage's weeks get +1 redraw." },
  { id: 'shared-light', name: 'Shared Light', rule: 'The two facility types trained least get +1 mult.' },
  { id: 'orders', name: 'Orders', rule: 'Each week posts a formation. Filling it pays 3 fans.' },
]

export const ftTwist = (tier: number) => FT_TWISTS[Math.min(FT_TWISTS.length, Math.max(1, Math.trunc(tier))) - 1]!

export const FT_TWIST_VALUES = {
  teamSpiritMult: 1,
  performanceFactor: 2,
  fragmentsNeeded: 8,
  fragmentsStars: 4,
  fragmentsFactor: 1.5,
  cookingNeeded: 3,
  cookingFactor: 1.2,
  cookingTrains: 3,
  researchPerLevel: 0.1,
  constructionPoints: 5,
  constructionBuilds: 2,
  ordersFans: 3,
  legendsStars: 5,
} as const
/** Formations an Orders week can post. */
export const FT_ORDER_FORMATIONS: readonly FtFormationId[] = ['duo', 'friendship', 'trio', 'rainbow', 'full-team']
