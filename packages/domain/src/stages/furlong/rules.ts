// Furlong Hand's rules (docs/game/09-furlong-hand.md, D385; M036 "Furlong Hand"; 04 §2.2): a card race on her next
// objective's real course. Her support cards are the deck: stride cards in five stat colours valued 1–6, her six cards
// as Partners and her skills as Skill cards. Each leg deals a spread of four columns three deep and a draw pile of
// eight; she plays front cards that match the lead's colour or are one higher (6 → 1), running each for ground or
// banking it for Drive, and flips a draw card when stuck, for Breath. Once a spread she may redraw it free. Between
// spreads she picks a line. The field are real Umas whose next move is always shown; the spurt's spread multiplies her
// run cards by her Drive, and the finish order is her ground against theirs. Integers only; every deal and every
// rival's script rolled from the seed: pure.
import { INITIAL_STAT_SOURCE_IDS, STAT_BONUS_SOURCE_IDS } from '../../cards'
import { STATS, type Grade, type Strategy } from '../../types'
import type { StageCard, StageConfig, StageInput, StageReport, StageUnique } from '../contract'
import { stageRng } from '../rng'
import { gradeRank, type FurlongSetup, type FurlongSkill, type FurlongTerrain, type SkillTrigger } from './setup'

// --- The numbers (set by `sim:stages`, D385) ------------------------------------------------------------------------

/** Bump on any rule change: a journal on another version is refused. */
export const FURLONG_VERSION = 1
export const COLUMNS = 4
/** A leg's spread is four columns three deep; the spurt's four deep. */
export const DEPTH = 3
export const SPURT_DEPTH = 4
/** The draw pile: its first card opens the leg as the lead, the rest are flips. */
export const PILE = 8
export const VALUES = 6
/** A card of no colour: Friend and Group cards. It follows any lead, and any card follows it. */
export const WILD = -1

/** A length is this much ground (a typical run card is about a third of one). */
export const LENGTH = 125
/** A yield point is this much ground. */
export const POINT = 10
/** Every run card's base yield, in points, before her stat class, the terrain, the line and the deck. */
export const YIELD_BASE = 2
/** A Partner run yields this many points more. */
export const PARTNER_POINTS = 1
/** A Skill card that fires yields this many points more: a white's, and a gold's or her unique's. */
export const SKILL_POINTS = Object.freeze({ white: 2, gold: 4 })
/** Her stat class by its percentage of the typical trained Uma: under 85 −1, under 110 0, under 135 +1, else +2. */
export const CLASS_FLOORS: readonly number[] = Object.freeze([85, 110, 135])
/** A class is worth this many half points: stats move her yields, play decides. */
export const CLASS_HALVES = 1
/** Each point of a colour's Stat Bonus in the deck lifts its yields this many percent, beside Training Effectiveness. */
export const STAT_BONUS_PERCENT = 4

/** Breath: her start, its ceiling, and what her distance aptitude adds (S … G). */
export const BREATH_BASE = 13
export const BREATH_MAX = 15
export const DISTANCE_BREATH: readonly number[] = Object.freeze([2, 1, 0, -1, -2, -2, -3, -3])
/** At the spurt her Breath is at least this: her second wind, so no deal empties the spurt by itself. */
export const SECOND_WIND = 3
/** The deck's Initial stats add a Breath per this much, at most two. */
export const INITIAL_PER_BREATH = 40
export const INITIAL_BREATH_MAX = 2

/** Drive: in the spurt a run card yields × (DRIVE_BASE + Drive) / DRIVE_BASE; Drive counts to DRIVE_MAX. */
export const DRIVE_BASE = 12
export const DRIVE_MAX = 40
/** A chain this long pays a Drive (once a chain); a clean spread two; ending a leg in band one. */
export const CHAIN_AT = 4
export const CLEAN_DRIVE = 2
export const BAND_DRIVE = 1
/** The deck's Race Bonus adds a Drive at the spurt per this much. */
export const RACE_BONUS_PER_DRIVE = 10
/** The deck's Hint Frequency shows a front card of the next spread per this much, four at most. */
export const HINT_PER_PEEK = 60
/**
 * A Partner at this bond is a rainbow: played, it lights the next RAINBOW_CARDS cards of its chain, which yield
 * double when run (a flip breaks the chain). A rainbow lights once a spread.
 */
export const RAINBOW_BOND = 80
/** A kindred Partner is a rainbow from this bond. */
export const KINDRED_BOND = 60
export const RAINBOW_TIMES = 2
export const RAINBOW_CARDS = 2

/**
 * The field: its pace a leg and its spurt, by its strength (its mean stat, % of the typical trained Uma). Every style
 * gains alike over a race; their scripts shape where (front runners surge early, closers in the spurt).
 */
export const FIELD = Object.freeze({
  /** The strength the pace is set at. */
  reference: 75,
  pace: 340,
  pacePerPoint: 2,
  spurt: 1080,
  spurtPerPoint: 8,
  /** Its spurt grows with the legs before it, as her Drive does: × (spurtBase + legs × spurtPerLeg) / (spurtBase + 5 × spurtPerLeg). */
  spurtBase: 18,
  spurtPerLeg: 2,
  /** A surge or fade, a leg; in the spurt, twice that. */
  surge: 50,
  fade: 50,
  /** Each card she leaves in a spread lets every rival gain this. */
  left: 15,
  /** At a leg's end no rival is further ahead of her than this (ten lengths): the field never gets away. */
  slip: 1250,
  /**
   * The field's form on the day: its pace and spurt from +form to −form percent in even steps, one step a rival, dealt
   * to the rivals by the seed. Every field is as strong; only who is strong changes.
   */
  form: 24,
})
/** Where each style starts, in ground. */
export const STYLE_START: Readonly<Record<Strategy, number>> = Object.freeze({ front: 20, pace: 10, late: 0, end: -10 })
/** Each style's place band (1 leads … 9 trails). Aptitude S widens it a place each side; C or worse narrows it. */
export const STYLE_BAND: Readonly<Record<Strategy, readonly [number, number]>> = Object.freeze({
  front: [1, 2], pace: [2, 4], late: [4, 7], end: [6, 9],
})

/** The rivals' moves, shown before each spread. */
export const RIVAL_MOVES = Object.freeze(['surge', 'hold', 'fade', 'rail'] as const)
export type RivalMove = (typeof RIVAL_MOVES)[number]
export const MOVE = Object.freeze({ surge: 0, hold: 1, fade: 2, rail: 3 })
/** Each style's odds of surge, hold, fade and closing the rail (percent), early, late and in the spurt. */
export const SCRIPT_ODDS: Readonly<Record<Strategy, readonly (readonly number[])[]>> = Object.freeze({
  front: [[35, 45, 15, 5], [15, 45, 35, 5], [15, 45, 35, 5]],
  pace: [[25, 55, 15, 5], [30, 50, 15, 5], [30, 45, 20, 5]],
  late: [[15, 55, 25, 5], [35, 45, 15, 5], [45, 40, 10, 5]],
  end: [[5, 50, 40, 5], [40, 45, 10, 5], [60, 35, 0, 5]],
})

/** The lines between spreads. */
export const LINES = Object.freeze(['rail', 'middle', 'outside'] as const)
export type Line = (typeof LINES)[number]
export const LINE = Object.freeze({ rail: 0, middle: 1, outside: 2 })
/** The outside costs this much Breath, and so does every flip. */
export const OUTSIDE_BREATH = 1
export const FLIP_BREATH = 1

/** The moves: run or bank column x's front card, flip a draw card, take line x, or redraw the spread. */
export const FURLONG_MOVE = Object.freeze({ run: 0, bank: 1, flip: 2, line: 3, redraw: 4 })

/** The Partners' values in deck order, so a deck's Partners chain into each other. */
export const PARTNER_VALUES: readonly number[] = Object.freeze([4, 2, 6, 3, 5, 1])
/** Skill cards dealt by her Wit class (−1 … +2). */
export const SKILL_CARDS: readonly number[] = Object.freeze([1, 2, 3, 4])

// --- The effect ids it reads (05 §1) --------------------------------------------------------------------------------

export const EFFECT_IDS = Object.freeze({
  friendship: 1, effectiveness: 8, raceBonus: 15, hintFrequency: 18, specialtyPriority: 19, spBonus: 30,
})

// --- Abilities: each card's unique effect, mapped ---------------------------------------------------------------------

/**
 * The ability library: each Partner's signature, from its card's unique effect (`abilityOf`). Eleven abilities; a
 * card with no unique has none.
 */
export const ABILITIES = Object.freeze([
  'kindred', 'second-wind', 'long-stride', 'fresh-legs', 'kick', 'scout', 'quick-start', 'study', 'team-play', 'rhythm', 'inside-line',
] as const)
export type Ability = (typeof ABILITIES)[number]

/** What each ability does, in a line. */
export const ABILITY_WORDS: Readonly<Record<Ability, string>> = Object.freeze({
  'kindred': 'a rainbow from bond 60, not 80',
  'second-wind': 'played, +1 Breath',
  'long-stride': 'run, +2 points',
  'fresh-legs': '+2 Breath at the start',
  'kick': 'played, +2 Drive',
  'scout': 'played, shows the next spread\'s front cards',
  'quick-start': 'dealt into the first spread\'s front row',
  'study': 'played the first time, +2 SP',
  'team-play': 'wild: plays on any lead, and any card follows it',
  'rhythm': 'its chain counts 2 more toward the chain\'s Drive',
  'inside-line': 'played, opens a blocked column',
})

/** The ability a boosted effect id maps to (05 §1's ids). */
export const ABILITY_BY_EFFECT: Readonly<Record<number, Ability>> = Object.freeze({
  1: 'kindred',
  2: 'second-wind', 25: 'second-wind', 28: 'second-wind', 31: 'second-wind',
  3: 'long-stride', 4: 'long-stride', 5: 'long-stride', 6: 'long-stride', 7: 'long-stride', 41: 'long-stride',
  8: 'rhythm',
  9: 'fresh-legs', 10: 'fresh-legs', 11: 'fresh-legs', 12: 'fresh-legs', 13: 'fresh-legs',
  14: 'team-play',
  15: 'kick', 16: 'kick',
  17: 'scout', 18: 'scout',
  19: 'quick-start',
  26: 'inside-line', 27: 'inside-line',
  30: 'study', 32: 'study',
})

/** Conditionals named by what they count rather than what they boost: the deck's make-up is team play. */
const ABILITY_BY_CONDITION: Readonly<Record<number, Ability>> = Object.freeze({ 103: 'team-play', 105: 'team-play', 120: 'team-play' })
/** Conditionals whose boosted effect is their `value`. */
const BOOSTS_VALUE = new Set([109, 110, 111, 113, 115, 117])

/**
 * A card's ability: the first term of its unique effect that maps. A plain term by its effect id; a conditional by what
 * it boosts (101 and 106 the effect in `params[0]`, 102 Training Effectiveness, 109–117 the effect in `value`, 121
 * Initial Friendship), except the deck make-up conditionals (103, 105, 120), which are team play. Null without a unique.
 */
export function abilityOf(unique: StageUnique | null | undefined): Ability | null {
  for (const term of unique?.effects ?? []) {
    const byCondition = ABILITY_BY_CONDITION[term.type]
    if (byCondition !== undefined) return byCondition
    const boosted = term.type < 100 ? term.type
      : term.type === 101 || term.type === 106 ? term.params[0] ?? 0
        : term.type === 102 ? EFFECT_IDS.effectiveness
          : BOOSTS_VALUE.has(term.type) ? term.value
            : term.type === 121 ? 14 : 0
    const ability = ABILITY_BY_EFFECT[boosted]
    if (ability !== undefined) return ability
  }
  return null
}

// --- Cards ----------------------------------------------------------------------------------------------------------

export type CardKind = 'stride' | 'partner' | 'skill'

export interface FurlongCard {
  readonly kind: CardKind
  /** 0 Speed … 4 Wit, or WILD. */
  readonly colour: number
  /** 1–6. */
  readonly value: number
  /** A Partner's deck index, a Skill card's skill index, a stride card's deck slot (−1 for the base set). */
  readonly ref: number
}

export interface FurlongPartner {
  readonly cardId: string
  readonly colour: number
  /** A rainbow: bond 80 or more (60 with the kindred ability). */
  readonly rainbow: boolean
  readonly ability: Ability | null
  /** Its real Skill Point Bonus, paid as SP the first time it is played. */
  readonly sp: number
  /** Its real Specialty Priority: the chance, in percent, it is dealt into the first spread. */
  readonly priority: number
}

export interface FurlongRivalState {
  readonly umaId: string
  readonly strategy: Strategy
  readonly strength: number
  /** Its form on the day, in percent: the field's ladder from +FIELD.form to −FIELD.form. */
  readonly form: number
  /** Its move for each spread: the legs, then the spurt. */
  readonly script: readonly number[]
}

/** What a move did, for the view and the tests. */
export type FurlongEvent =
  | { readonly kind: 'line'; readonly line: number; readonly blocked: boolean; readonly breath: number }
  | { readonly kind: 'lead'; readonly card: number }
  | { readonly kind: 'run'; readonly card: number; readonly column: number; readonly ground: number; readonly fired: boolean }
  | { readonly kind: 'bank'; readonly card: number; readonly column: number }
  | { readonly kind: 'flip'; readonly card: number }
  | { readonly kind: 'redraw' }
  | { readonly kind: 'chain'; readonly drive: number }
  | { readonly kind: 'rainbow' }
  | { readonly kind: 'unblock' }
  | { readonly kind: 'ability'; readonly ability: Ability }
  | { readonly kind: 'leg-end'; readonly spread: number; readonly left: number; readonly clean: boolean; readonly inBand: boolean; readonly place: number }
  | { readonly kind: 'spurt'; readonly drive: number; readonly breath: number }
  | { readonly kind: 'finish'; readonly place: number; readonly margin: number }

export type FurlongPhase = 'line' | 'leg' | 'finished'

export interface FurlongState {
  // The race, fixed at init.
  readonly seed: number
  readonly cards: readonly FurlongCard[]
  readonly partners: readonly FurlongPartner[]
  readonly skills: FurlongSetup['skills']
  readonly legs: readonly FurlongTerrain[]
  readonly spurtTerrain: FurlongTerrain
  readonly rivals: readonly FurlongRivalState[]
  readonly strategy: Strategy
  readonly band: readonly [number, number]
  /** Her class in each colour, −1 … +2. */
  readonly classes: readonly number[]
  /** Each colour's Stat Bonus in the deck, and its yield percent: Training Effectiveness and Stat Bonus × 4. */
  readonly bonus: readonly number[]
  readonly effectiveness: readonly number[]
  /** Front cards of the next spread shown at a line choice. */
  readonly peek: number
  /** Drive the deck's Race Bonus adds at the spurt. */
  readonly spurtDrive: number

  // The play.
  readonly phase: FurlongPhase
  /** The spread under way or next: 0 … legs − 1 are the legs, `legs.length` the spurt. */
  readonly spread: number
  /** The spread's columns, each bottom to front (the front card is last). */
  readonly columns: readonly (readonly number[])[]
  /** The draw cards left, the next first. */
  readonly pile: readonly number[]
  /** The lead card, −1 before the spread opens. */
  readonly lead: number
  /** Whether the lead is wild (a wild card, or a team-play Partner). */
  readonly leadWild: boolean
  /** Cards played since the last flip, and whether this chain paid its Drive. */
  readonly chain: number
  readonly chainPaid: boolean
  /** Cards of this chain still lit by a rainbow: they yield double when run. */
  readonly rainbow: number
  /** A rainbow has lit this spread. */
  readonly rainbowLit: boolean
  /** The spread's free redraw (a new deal, before any card is played or flipped) is spent. */
  readonly redrawn: boolean
  readonly line: number
  /** The column shut by a closed rail, or −1. */
  readonly blocked: number
  /** The next spread's front cards she sees at this line choice (a scout ability shows all four). */
  readonly peeked: number
  /** A scout was played this spread: the next line choice shows every front card. */
  readonly scouting: boolean
  readonly breath: number
  readonly drive: number
  readonly ground: number
  readonly rivalGround: readonly number[]
  /** Her place now, 1–9. */
  readonly place: number
  /** Partners played, as bits by deck index. */
  readonly played: number
  readonly cleanSpreads: number
  readonly legsInBand: number
  /** Moves made: the next move's tick. */
  readonly moves: number
  readonly bonusSp: number
  readonly finish: { readonly place: number; readonly margin: number } | null
  readonly events: readonly FurlongEvent[]
}

// --- Setup ----------------------------------------------------------------------------------------------------------

const colourOf = (type: string): number => (STATS as readonly string[]).indexOf(type)

/** Her class in a colour from its percentage of the typical trained Uma. */
export const statClass = (pct: number): number => CLASS_FLOORS.filter((floor) => pct >= floor).length - 1

/** Her place band by style, widened by an S aptitude and narrowed by C or worse. */
export function styleBand(strategy: Strategy, aptitude: Grade): [number, number] {
  const [lo, hi] = STYLE_BAND[strategy]
  const rank = gradeRank(aptitude)
  if (rank === 0) return [Math.max(1, lo - 1), Math.min(COLUMNS * 2 + 1, hi + 1)]
  if (rank >= 3) return lo === 1 ? [lo, Math.max(lo, hi - 1)] : [Math.min(hi, lo + 1), hi]
  return [lo, hi]
}

const effect = (card: StageCard, id: number): number => Math.max(0, Math.round(card.effects[id] ?? 0))

/** Her six cards as Partners: colour by type (wild for Friend and Group), rainbow at bond 80, ability by unique. */
export function furlongPartners(config: Pick<StageConfig, 'deck' | 'bonds'>): FurlongPartner[] {
  return config.deck.map((card) => {
    const ability = abilityOf(card.unique)
    return {
      cardId: card.id,
      colour: colourOf(card.type),
      rainbow: (config.bonds[card.id] ?? 0) >= (ability === 'kindred' ? KINDRED_BOND : RAINBOW_BOND),
      ability,
      sp: effect(card, EFFECT_IDS.spBonus),
      priority: Math.min(100, effect(card, EFFECT_IDS.specialtyPriority)),
    }
  })
}

/** Each colour's Stat Bonus and yield percent from the deck (a Friend or Group card's Training Effectiveness: every colour, half). */
export function deckBonuses(deck: readonly StageCard[]): { bonus: number[]; effectiveness: number[] } {
  // Stat Bonus by colour, and each colour's yield percent: its Training Effectiveness and its Stat Bonus × 4.
  const statBonus = [0, 0, 0, 0, 0]
  const effectiveness = [0, 0, 0, 0, 0]
  for (const card of deck) {
    const colour = colourOf(card.type)
    STATS.forEach((stat, c) => { statBonus[c]! += effect(card, STAT_BONUS_SOURCE_IDS[stat]) })
    const te = effect(card, EFFECT_IDS.effectiveness)
    if (colour >= 0) effectiveness[colour]! += te
    else for (let c = 0; c < STATS.length; c += 1) effectiveness[c]! += Math.floor(te / 2)
  }
  return { bonus: statBonus, effectiveness: effectiveness.map((te, c) => te + STAT_BONUS_PERCENT * statBonus[c]!) }
}

/** The race's cards: 15 base stride cards, three a deck slot, her Partners, and her Skill cards by Wit. */
export function furlongDeck(partners: readonly FurlongPartner[], skills: readonly Pick<FurlongSkill, 'colour'>[]): FurlongCard[] {
  const cards: FurlongCard[] = []
  for (let colour = 0; colour < STATS.length; colour += 1) {
    for (let k = 0; k < 3; k += 1) cards.push({ kind: 'stride', colour, value: ((colour + 2 * k) % VALUES) + 1, ref: -1 })
  }
  for (let slot = 0; slot < PARTNER_VALUES.length; slot += 1) {
    // An empty slot (practice without a deck) deals plain stride cards in turn.
    const colour = slot < partners.length ? partners[slot]!.colour : slot % STATS.length
    for (let k = 0; k < 3; k += 1) cards.push({ kind: 'stride', colour, value: ((slot + 2 * k) % VALUES) + 1, ref: slot })
  }
  partners.forEach((partner, i) => cards.push({ kind: 'partner', colour: partner.ability === 'team-play' ? WILD : partner.colour, value: PARTNER_VALUES[i]!, ref: i }))
  skills.forEach((skill, j) => cards.push({ kind: 'skill', colour: skill.colour, value: ((j * 5 + 2) % VALUES) + 1, ref: j }))
  return cards
}

/** The field's forms, best first: +form to −form in even steps over its rivals (whole percents). */
export function fieldForms(count: number): number[] {
  if (count <= 1) return Array.from({ length: count }, () => 0)
  return Array.from({ length: count }, (_, i) => FIELD.form - Math.round((2 * FIELD.form * i) / (count - 1)))
}

/**
 * The rivals' forms (the field's, dealt by the seed) and scripts: one move a spread, by style, early (the first half
 * of the legs), late, and the spurt.
 */
export function rivalScripts(setup: Pick<FurlongSetup, 'rivals' | 'legs'>, seed: number): FurlongRivalState[] {
  const rng = stageRng((seed ^ 0x51ed270b) >>> 0)
  const spreads = setup.legs.length + 1
  const forms = fieldForms(setup.rivals.length)
  for (let i = forms.length - 1; i > 0; i -= 1) {
    const j = rng.below(i + 1)
    ;[forms[i], forms[j]] = [forms[j]!, forms[i]!]
  }
  return setup.rivals.map((rival, r) => ({
    ...rival,
    form: forms[r]!,
    script: Array.from({ length: spreads }, (_, s) => {
      const odds = SCRIPT_ODDS[rival.strategy][s === setup.legs.length ? 2 : s * 2 < setup.legs.length ? 0 : 1]!
      let roll = rng.below(100)
      let move = 0
      while (move < odds.length - 1 && roll >= odds[move]!) roll -= odds[move++]!
      return move
    }),
  }))
}

/** Later spreads deal this many of the Partners she hasn't played yet into the spread, so none hangs on the deal. */
export const UNPLAYED_DEALT = 1

/**
 * A spread's deal from the seed: its columns and its pile. The first spread takes Partners by Specialty Priority (and a
 * quick start into its front row); each later one takes a Partner she hasn't played yet, wherever it falls. A redraw
 * is the spread's second deal (`round` 1).
 */
export function dealSpread(state: Pick<FurlongState, 'seed' | 'cards' | 'partners' | 'legs' | 'played'>, spread: number, round = 0): { columns: number[][]; pile: number[] } {
  const rng = stageRng((state.seed ^ Math.imul(spread + 1, 0x9e3779b1) ^ Math.imul(round, 0x85ebca6b)) >>> 0)
  const order = state.cards.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = rng.below(i + 1)
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  const depth = spread === state.legs.length ? SPURT_DEPTH : DEPTH
  const size = depth * COLUMNS
  if (spread === 0) {
    // Fronts first, then the rows behind: where a Partner with priority goes.
    const slots = [...Array.from({ length: COLUMNS }, (_, c) => c * depth + depth - 1), ...Array.from({ length: size }, (_, i) => i).filter((i) => i % depth !== depth - 1)]
    const isPartner = (i: number) => state.cards[order[i]!]!.kind === 'partner'
    state.partners.forEach((partner, p) => {
      const lucky = partner.ability === 'quick-start' || rng.below(100) < partner.priority
      const at = order.findIndex((card) => state.cards[card]!.kind === 'partner' && state.cards[card]!.ref === p)
      if (!lucky || at < 0) return
      const front = partner.ability === 'quick-start'
      if (at < size && (!front || at % depth === depth - 1)) return
      const slot = slots.find((i) => !isPartner(i) && (!front || i % depth === depth - 1))
      if (slot === undefined) return
      ;[order[at], order[slot]] = [order[slot]!, order[at]!]
    })
  } else {
    let dealt = 0
    state.partners.forEach((_, p) => {
      if ((state.played & (1 << p)) !== 0 || dealt >= UNPLAYED_DEALT) return
      const at = order.findIndex((card) => state.cards[card]!.kind === 'partner' && state.cards[card]!.ref === p)
      if (at < 0) return
      dealt += 1
      if (at < size) return
      const open = Array.from({ length: size }, (_, i) => i).filter((i) => state.cards[order[i]!]!.kind !== 'partner')
      if (open.length === 0) return
      const slot = open[rng.below(open.length)]!
      ;[order[at], order[slot]] = [order[slot]!, order[at]!]
    })
  }
  return {
    columns: Array.from({ length: COLUMNS }, (_, c) => order.slice(c * depth, (c + 1) * depth)),
    pile: order.slice(size, size + PILE),
  }
}

export function initFurlong(config: StageConfig): FurlongState {
  if (config.kind !== 'furlong-hand') throw new RangeError(`Furlong Hand can't play a ${config.kind} config`)
  const setup = config.furlong
  if (setup === undefined) throw new RangeError('A Furlong Hand config needs its race')
  const classes = setup.her.stats.map(statClass)
  const partners = furlongPartners(config)
  const { bonus, effectiveness } = deckBonuses(config.deck)
  const sum = (id: number) => config.deck.reduce((total, card) => total + effect(card, id), 0)
  const initials = config.deck.reduce((total, card) => total + STATS.reduce((s, stat) => s + effect(card, INITIAL_STAT_SOURCE_IDS[stat]), 0), 0)
  const fresh = partners.filter((partner) => partner.ability === 'fresh-legs').length * 2
  const breath = Math.max(1, Math.min(BREATH_MAX, BREATH_BASE + classes[1]! + DISTANCE_BREATH[gradeRank(setup.her.distance)]! +
    Math.min(INITIAL_BREATH_MAX, Math.floor(initials / INITIAL_PER_BREATH)) + fresh))
  const skills = setup.skills.slice(0, SKILL_CARDS[classes[4]! + 1]!)
  const cards = furlongDeck(partners, skills)
  const rivals = rivalScripts(setup, config.seed)
  const start = stageRng((config.seed ^ 0x6c078965) >>> 0)
  const rivalGround = rivals.map((rival) => STYLE_START[rival.strategy] + start.below(LENGTH))
  const ground = STYLE_START[setup.her.strategy] + LENGTH / 2
  const base = {
    seed: config.seed, cards, partners, skills, legs: setup.legs, spurtTerrain: setup.spurt, rivals,
    strategy: setup.her.strategy, band: styleBand(setup.her.strategy, setup.her.style), classes, bonus, effectiveness,
    peek: Math.min(COLUMNS, Math.floor(sum(EFFECT_IDS.hintFrequency) / HINT_PER_PEEK) + (classes[4]! >= 1 ? 1 : 0)),
    spurtDrive: Math.floor(sum(EFFECT_IDS.raceBonus) / RACE_BONUS_PER_DRIVE),
  }
  const deal = dealSpread({ ...base, played: 0 }, 0)
  return {
    ...base,
    phase: 'line', spread: 0, columns: deal.columns, pile: deal.pile, lead: -1, leadWild: false, chain: 0, chainPaid: false, rainbow: 0,
    rainbowLit: false, redrawn: false, line: LINE.middle, blocked: -1, peeked: base.peek, scouting: false, breath, drive: 0, ground, rivalGround, place: 0, played: 0,
    cleanSpreads: 0, legsInBand: 0, moves: 0, bonusSp: 0, finish: null, events: [],
  }
}

// --- Reading the play -----------------------------------------------------------------------------------------------

/** The terrain of a spread: a leg's, or the spurt's. */
export const terrainAt = (state: Pick<FurlongState, 'legs' | 'spurtTerrain'>, spread: number): FurlongTerrain =>
  spread < state.legs.length ? state.legs[spread]! : state.spurtTerrain

export const isSpurt = (state: Pick<FurlongState, 'legs' | 'spread'>): boolean => state.spread === state.legs.length

/** A card's colour: 0 Speed … 4 Wit, or WILD. */
export const cardColour = (state: Pick<FurlongState, 'cards'>, card: number): number => state.cards[card]!.colour

/** Whether a card plays on the lead: its colour, or exactly one higher (6 → 1); wild either way. */
export function follows(state: FurlongState, card: number): boolean {
  if (state.lead < 0) return false
  const colour = cardColour(state, card)
  if (colour === WILD || state.leadWild) return true
  const lead = state.cards[state.lead]!
  return colour === cardColour(state, state.lead) || state.cards[card]!.value === (lead.value % VALUES) + 1
}

/** The columns whose front card she can play now. */
export function playableColumns(state: FurlongState): number[] {
  if (state.phase !== 'leg') return []
  const out: number[] = []
  for (let c = 0; c < COLUMNS; c += 1) {
    const column = state.columns[c]!
    if (column.length > 0 && c !== state.blocked && follows(state, column[column.length - 1]!)) out.push(c)
  }
  return out
}

/** Whether a Skill card fires on this spread: its trigger is the terrain, the spurt, or anywhere. */
export function fires(state: Pick<FurlongState, 'legs' | 'spurtTerrain' | 'spread'>, trigger: SkillTrigger): boolean {
  if (trigger === 'any') return true
  if (trigger === 'spurt') return state.spread === state.legs.length
  return terrainAt(state, state.spread) === trigger
}

/**
 * A colour's yield on this spread, in half points: base, the deck's Stat Bonus, the terrain (Speed on a straight,
 * Power on a corner or climb), Guts in the spurt, the line, and her class at half a point a class.
 */
export function colourHalves(state: FurlongState, colour: number): number {
  const terrain = terrainAt(state, state.spread)
  const favoured = terrain === 'straight' ? 0 : 2
  let points = YIELD_BASE
  if (colour === favoured) points += 1
  if (isSpurt(state) && colour === 3) points += 1
  if (state.line === LINE.rail && colour === favoured) points += 1
  if (state.line === LINE.outside && colour === 0) points += 1
  return 2 * points + CLASS_HALVES * state.classes[colour]!
}

/** What a card would yield run now, in ground: its points × Training Effectiveness, a rainbow, Breath, and Drive. */
export function runYield(state: FurlongState, card: number, rainbow = state.rainbow > 0): { ground: number; fired: boolean; colour: number } {
  const c = state.cards[card]!
  let colour = cardColour(state, card)
  if (colour === WILD) {
    colour = 0
    for (let k = 1; k < STATS.length; k += 1) if (colourHalves(state, k) > colourHalves(state, colour)) colour = k
  }
  let points = 0
  let fired = false
  if (c.kind === 'partner') {
    points += PARTNER_POINTS
    if (state.partners[c.ref]!.ability === 'long-stride') points += 2
  }
  if (c.kind === 'skill') {
    const skill = state.skills[c.ref]!
    fired = fires(state, skill.trigger)
    if (fired) points += skill.gold ? SKILL_POINTS.gold : SKILL_POINTS.white
  }
  const halves = Math.max(2, colourHalves(state, colour) + 2 * points)
  let base = Math.floor((halves * POINT * (100 + state.effectiveness[colour]!)) / 200)
  if (state.breath === 0 && (colour === 0 || colour === 2)) base = Math.floor(base / 2)
  let ground = isSpurt(state) ? Math.floor((base * (DRIVE_BASE + Math.min(DRIVE_MAX, state.drive))) / DRIVE_BASE) : base
  // A lit card's yield doubles: its stride once more, outside the spurt's Drive.
  if (rainbow) ground += base * (RAINBOW_TIMES - 1)
  return { ground, fired, colour }
}

/** Every runner's place: hers and each rival's (1 leads), by ground; she takes a tie, rivals in field order. */
export function placings(ground: number, rivalGround: readonly number[]): { her: number; rivals: number[] } {
  const rivals = rivalGround.map((g, i) => 1 + rivalGround.filter((o, j) => o > g || (o === g && j < i)).length + (ground >= g ? 1 : 0))
  return { her: 1 + rivalGround.filter((g) => g > ground).length, rivals }
}

/** A rival's gain over a spread: the field's pace for its strength, its move, and the cards she left. */
export function rivalGain(state: Pick<FurlongState, 'rivals' | 'legs'>, rival: number, spread: number, left: number): number {
  const r = state.rivals[rival]!
  const move = r.script[spread]!
  const swing = move === MOVE.surge ? FIELD.surge : move === MOVE.fade ? -FIELD.fade : 0
  if (spread === state.legs.length) {
    const legs = FIELD.spurtBase + state.legs.length * FIELD.spurtPerLeg
    const spurt = Math.floor(((FIELD.spurt + (r.strength - FIELD.reference) * FIELD.spurtPerPoint) * legs) / (FIELD.spurtBase + 5 * FIELD.spurtPerLeg))
    return Math.floor((spurt * (100 + r.form)) / 100) + 2 * swing + left * FIELD.left
  }
  return Math.floor(((FIELD.pace + (r.strength - FIELD.reference) * FIELD.pacePerPoint) * (100 + r.form)) / 100) + swing + left * FIELD.left
}

/** Whether a rival closes the rail on this spread. */
export const railClosed = (state: Pick<FurlongState, 'rivals'>, spread: number): boolean =>
  state.rivals.some((rival) => rival.script[spread] === MOVE.rail)

export const inBand = (state: Pick<FurlongState, 'band'>, place: number): boolean => place >= state.band[0] && place <= state.band[1]

export const cardsLeft = (state: Pick<FurlongState, 'columns'>): number => state.columns.reduce((sum, column) => sum + column.length, 0)

// --- Moves ----------------------------------------------------------------------------------------------------------

export const furlongDone = (state: FurlongState): boolean => state.phase === 'finished'

interface Tally {
  breath: number
  drive: number
  bonusSp: number
  played: number
  events: FurlongEvent[]
}

/** The spread ends: the field moves, she is placed, and the next spread is dealt (or the race is run in). */
function endSpread(state: FurlongState, tally: Tally): FurlongState {
  const left = cardsLeft(state)
  const clean = left === 0
  let { breath, drive } = tally
  if (clean) drive += CLEAN_DRIVE
  const spurt = isSpurt(state)
  const ground = state.ground
  let rivalGround = state.rivalGround.map((g, r) => g + rivalGain(state, r, state.spread, left))
  if (!spurt) rivalGround = rivalGround.map((g) => Math.min(g, ground + FIELD.slip))
  const { her } = placings(ground, rivalGround)
  const cleanSpreads = state.cleanSpreads + (clean ? 1 : 0)
  if (spurt) {
    const best = Math.max(...rivalGround, Number.NEGATIVE_INFINITY)
    const margin = her === 1 ? ground - (Number.isFinite(best) ? best : ground) : 0
    tally.events.push({ kind: 'leg-end', spread: state.spread, left, clean, inBand: true, place: her }, { kind: 'finish', place: her, margin })
    return {
      ...state, phase: 'finished', rivalGround, place: her, breath, drive, cleanSpreads, finish: { place: her, margin },
      bonusSp: tally.bonusSp, played: tally.played, events: tally.events,
    }
  }
  const band = inBand(state, her)
  if (band) drive += BAND_DRIVE
  else breath = Math.max(0, breath - 1)
  tally.events.push({ kind: 'leg-end', spread: state.spread, left, clean, inBand: band, place: her })
  const next = state.spread + 1
  const deal = dealSpread({ ...state, played: tally.played }, next)
  if (next === state.legs.length) {
    // The final turn: the deck's Race Bonus adds Drive, and she finds her second wind.
    drive += state.spurtDrive
    const wind = Math.max(0, SECOND_WIND - breath)
    breath += wind
    tally.events.push({ kind: 'spurt', drive: state.spurtDrive, breath: wind })
  }
  return {
    ...state, phase: 'line', spread: next, columns: deal.columns, pile: deal.pile, lead: -1, leadWild: false, chain: 0, chainPaid: false,
    rainbow: 0, rainbowLit: false, redrawn: false, blocked: -1, rivalGround, place: her, breath, drive: Math.min(DRIVE_MAX, drive), cleanSpreads,
    legsInBand: state.legsInBand + (band ? 1 : 0), peeked: state.scouting ? COLUMNS : state.peek, scouting: false,
    bonusSp: tally.bonusSp, played: tally.played, events: tally.events,
  }
}

/** After a play or a flip: the spread ends when it is clear, or when the pile is out and nothing plays. */
function settleSpread(state: FurlongState, tally: Tally): FurlongState {
  const next: FurlongState = { ...state, breath: tally.breath, drive: Math.min(DRIVE_MAX, tally.drive), bonusSp: tally.bonusSp, played: tally.played, events: tally.events }
  if (cardsLeft(next) === 0 || (next.pile.length === 0 && playableColumns(next).length === 0)) return endSpread(next, tally)
  return next
}

const tallyOf = (state: FurlongState): Tally => ({ breath: state.breath, drive: state.drive, bonusSp: state.bonusSp, played: state.played, events: [] })

function takeLine(state: FurlongState, line: number): FurlongState | null {
  if (state.phase !== 'line' || !Number.isSafeInteger(line) || line < 0 || line >= LINES.length) return null
  const tally = tallyOf(state)
  const closed = line === LINE.rail && railClosed(state, state.spread)
  if (line === LINE.outside) tally.breath = Math.max(0, tally.breath - OUTSIDE_BREATH)
  tally.events.push({ kind: 'line', line, blocked: closed, breath: line === LINE.outside ? OUTSIDE_BREATH : 0 })
  const lead = state.pile[0]!
  tally.events.push({ kind: 'lead', card: lead })
  const opened: FurlongState = {
    ...state, phase: 'leg', line, blocked: closed ? 0 : -1, lead, leadWild: cardColour(state, lead) === WILD, pile: state.pile.slice(1),
    chain: 0, chainPaid: false, rainbow: 0, redrawn: false, peeked: 0, moves: state.moves + 1,
  }
  return settleSpread(opened, tally)
}

function flip(state: FurlongState): FurlongState | null {
  if (state.phase !== 'leg' || state.pile.length === 0) return null
  const tally = tallyOf(state)
  tally.breath = Math.max(0, tally.breath - FLIP_BREATH)
  const lead = state.pile[0]!
  tally.events.push({ kind: 'flip', card: lead })
  const flipped: FurlongState = {
    ...state, lead, leadWild: cardColour(state, lead) === WILD, pile: state.pile.slice(1), chain: 0, chainPaid: false, rainbow: 0,
    moves: state.moves + 1,
  }
  return settleSpread(flipped, tally)
}

/** Whether the spread can still be redrawn: once a spread, before any of its cards is played or flipped. */
export const canRedraw = (state: FurlongState): boolean =>
  state.phase === 'leg' && !state.redrawn && state.pile.length === PILE - 1 &&
  cardsLeft(state) === (isSpurt(state) ? SPURT_DEPTH : DEPTH) * COLUMNS

/** The free redraw: the spread dealt again (its second deal), and a new lead turned. */
function redraw(state: FurlongState): FurlongState | null {
  if (!canRedraw(state)) return null
  const tally = tallyOf(state)
  const deal = dealSpread(state, state.spread, 1)
  const lead = deal.pile[0]!
  tally.events.push({ kind: 'redraw' }, { kind: 'lead', card: lead })
  const dealt: FurlongState = {
    ...state, columns: deal.columns, pile: deal.pile.slice(1), lead, leadWild: cardColour(state, lead) === WILD, chain: 0, chainPaid: false,
    rainbow: 0, redrawn: true, moves: state.moves + 1,
  }
  return settleSpread(dealt, tally)
}

function play(state: FurlongState, column: number, run: boolean): FurlongState | null {
  if (state.phase !== 'leg' || !Number.isSafeInteger(column) || column < 0 || column >= COLUMNS) return null
  if (!playableColumns(state).includes(column)) return null
  const stack = state.columns[column]!
  const card = stack[stack.length - 1]!
  const c = state.cards[card]!
  const tally = tallyOf(state)
  const partner = c.kind === 'partner' ? state.partners[c.ref]! : null
  const lights = (partner?.rainbow ?? false) && !state.rainbowLit
  const lit = state.rainbow > 0
  const rainbow = lights ? RAINBOW_CARDS : Math.max(0, state.rainbow - 1)
  let ground = state.ground
  let blocked = state.blocked
  if (run) {
    const { ground: gain, fired } = runYield(state, card, lit)
    ground += gain
    tally.events.push({ kind: 'run', card, column, ground: gain, fired })
    if (fired && c.kind === 'skill') {
      const skill = state.skills[c.ref]!
      if (skill.colour === 1) tally.breath = Math.min(BREATH_MAX, tally.breath + 2)
      if (skill.colour === 2) tally.drive += 1
    }
  } else {
    tally.drive += 1
    tally.events.push({ kind: 'bank', card, column })
  }
  if (partner !== null) {
    if (lights) tally.events.push({ kind: 'rainbow' })
    const first = (tally.played & (1 << c.ref)) === 0
    tally.played |= 1 << c.ref
    if (first) tally.bonusSp += partner.sp
    switch (partner.ability) {
      case 'second-wind': tally.breath = Math.min(BREATH_MAX, tally.breath + 1); break
      case 'kick': tally.drive += 2; break
      case 'study': if (first) tally.bonusSp += 2; break
      case 'inside-line': if (blocked >= 0) { blocked = -1; tally.events.push({ kind: 'unblock' }) } break
      default: break
    }
    if (partner.ability !== null) tally.events.push({ kind: 'ability', ability: partner.ability })
  }
  const colour = cardColour(state, card)
  if (blocked >= 0 && (colour === 2 || colour === 4 || colour === WILD)) {
    blocked = -1
    tally.events.push({ kind: 'unblock' })
  }
  const chain = state.chain + 1 + (partner?.ability === 'rhythm' ? 2 : 0)
  let chainPaid = state.chainPaid
  if (!chainPaid && chain >= CHAIN_AT) {
    chainPaid = true
    tally.drive += 1
    tally.events.push({ kind: 'chain', drive: 1 })
  }
  const columns = state.columns.map((col, i) => (i === column ? col.slice(0, -1) : col))
  const next: FurlongState = {
    ...state, columns, lead: card, leadWild: colour === WILD, chain, chainPaid, rainbow, rainbowLit: state.rainbowLit || lights, ground, blocked,
    moves: state.moves + 1,
    scouting: state.scouting || partner?.ability === 'scout',
  }
  return settleSpread(next, tally)
}

export function stepFurlong(state: FurlongState, input: StageInput): FurlongState | null {
  if (furlongDone(state)) return null
  const hasY = input.y !== undefined
  switch (input.code) {
    case FURLONG_MOVE.run: return hasY ? null : play(state, input.x ?? -1, true)
    case FURLONG_MOVE.bank: return hasY ? null : play(state, input.x ?? -1, false)
    case FURLONG_MOVE.flip: return input.x === undefined && !hasY ? flip(state) : null
    case FURLONG_MOVE.line: return hasY ? null : takeLine(state, input.x ?? -1)
    case FURLONG_MOVE.redraw: return input.x === undefined && !hasY ? redraw(state) : null
    default: return null
  }
}

// --- The report -----------------------------------------------------------------------------------------------------

/** `p` by place: a win is 1 (plus a hundredth a length clear, under S's 1.2), 2nd–3rd B, 4th–5th C, then D. */
export const PLACE_P: readonly number[] = Object.freeze([1, 0.875, 0.75, 0.625, 0.5, 0.375, 0.25, 0.125, 0])
/** A win this many lengths clear is the first task. */
export const CLEAR_LENGTHS = 2
/** Clean spreads the second task asks for. */
export const CLEAN_TASK = 2

export const marginLengths = (state: Pick<FurlongState, 'finish'>): number => (state.finish === null ? 0 : state.finish.margin / LENGTH)

/** The four tasks: won 2 lengths clear, two clean spreads, every Partner played, every leg in band. */
export function furlongTasks(state: FurlongState): [boolean, boolean, boolean, boolean] {
  const all = (1 << state.partners.length) - 1
  return [
    state.finish !== null && state.finish.place === 1 && state.finish.margin >= CLEAR_LENGTHS * LENGTH,
    state.cleanSpreads >= CLEAN_TASK,
    state.partners.length > 0 && (state.played & all) === all,
    state.legsInBand === state.legs.length,
  ]
}

export function reportFurlong(state: FurlongState): StageReport {
  const place = state.finish?.place ?? state.rivals.length + 1
  const clear = state.finish !== null && place === 1 ? Math.min(19, Math.floor(state.finish.margin / LENGTH)) / 100 : 0
  return {
    p: (PLACE_P[place - 1] ?? 0) + clear,
    tasks: furlongTasks(state),
    score: place,
    bonusSp: state.bonusSp,
  }
}

/** The moves as inputs. */
export const runInput = (tick: number, column: number): StageInput => ({ tick, code: FURLONG_MOVE.run, x: column })
export const bankInput = (tick: number, column: number): StageInput => ({ tick, code: FURLONG_MOVE.bank, x: column })
export const flipInput = (tick: number): StageInput => ({ tick, code: FURLONG_MOVE.flip })
export const lineInput = (tick: number, line: number): StageInput => ({ tick, code: FURLONG_MOVE.line, x: line })
export const redrawInput = (tick: number): StageInput => ({ tick, code: FURLONG_MOVE.redraw })

