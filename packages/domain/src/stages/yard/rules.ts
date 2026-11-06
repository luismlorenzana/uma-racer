// Training Yard's rules (docs/game/08-training-yard.md, D384; M036 "Training Yard"; 04 §1.2): a Triple Town–like merge
// on a 6×6 yard, 60 placements. Pieces are a stat colour and a tier (plain, bronze, silver, gold, rainbow); three or
// more touching pieces of one colour and tier merge one tier up on the cell just placed, and cascades resolve. Three
// rainbows clear for a Masterclass. Her deck's cards come as Partners (wild for Friend and Group) that lift a merge,
// and Fatigue drifts toward her biggest piece until it is boxed in as Rest, which clears it (and pays nothing, D391).
// Every piece set down pays its Sweat, and every merge pays drills of its colour by the tier it makes: the score, over
// the target, is `p`, and the colours scored are how the career's drills split. Integers only, the queue rolled once at
// `init`: pure.
import { STATS, type StatKey } from '../../types'
import type { StageConfig, StageInput, StageReport } from '../contract'
import { stageRng } from '../rng'

// --- The numbers (set by `sim:stages`, D384) ------------------------------------------------------------------------

/** Bump on any rule change: a journal on another version is refused. */
export const YARD_VERSION = 1
export const YARD_SIDE = 6
export const YARD_CELLS = YARD_SIDE * YARD_SIDE
/** A play is this many placements, or ends sooner on a full yard. */
export const YARD_PLACEMENTS = 60
/** The tiers' names, plain to rainbow. */
export const YARD_TIERS = Object.freeze(['plain', 'bronze', 'silver', 'gold', 'rainbow'] as const)
export type YardTier = (typeof YARD_TIERS)[number]
export const RAINBOW = YARD_TIERS.length - 1
export const GOLD = 3
/**
 * Drills by tier: a piece set down pays tier 0's (its Sweat), and a merge pays the tier it makes, a geometric ladder of
 * × 3 from bronze. Sweat lets a play that merges little still score (D384).
 */
export const YARD_LADDER: readonly number[] = Object.freeze([3, 4, 12, 36, 108])
/** Three rainbows clearing pay this, in their colour. */
export const MASTERCLASS_DRILLS = 324
/** The score of grade A: the competent bot's median (`sim:stages`). */
export const YARD_TARGET = 222
/** Pieces in the queue: 60 placements, the first in hand, one held, and two shown ahead. */
export const YARD_QUEUE = YARD_PLACEMENTS + 4
/** The share of the queue that is Fatigue, in percent, after the first few pieces. */
export const FATIGUE_PERCENT = 8
/** No Fatigue among the first pieces. */
export const FATIGUE_FREE = 4
/** A colour's weight is (100 + her growth %) × 2, × 3 instead for the season's focus. */
export const COLOUR_WEIGHT = Object.freeze({ base: 2, focus: 3 })
/** A Partner's weight is this × (100 + its Specialty Priority), on the colours' scale of 100s. */
export const PARTNER_RATE = 25
/** A Partner lifts its merge this many tiers more: `base`, or `bonded` at bond 80 or more. */
export const PARTNER_LIFT = Object.freeze({ base: 1, bonded: 2 })
export const PARTNER_BONDED_AT = 80
/** Specialty Priority's effect id (05 §1). */
export const SPECIALTY_PRIORITY = 19

// --- Cells and pieces -----------------------------------------------------------------------------------------------

/** A cell: 0 empty, 1–25 a piece (1 + colour × 5 + tier), 26 Fatigue, 27 Rest. */
export const EMPTY = 0
export const FATIGUE = 26
export const REST = 27
export const pieceCell = (colour: number, tier: number): number => 1 + colour * YARD_TIERS.length + tier
export const isPieceCell = (cell: number): boolean => cell >= 1 && cell <= 25
export const cellColour = (cell: number): number => Math.floor((cell - 1) / YARD_TIERS.length)
export const cellTier = (cell: number): number => (cell - 1) % YARD_TIERS.length

/** A queue piece: 0–4 a plain piece of that colour, 10 + i her deck's card i as a Partner, 20 Fatigue. */
export const PARTNER_BASE = 10
export const FATIGUE_PIECE = 20
export const isPartnerPiece = (piece: number): boolean => piece >= PARTNER_BASE && piece < FATIGUE_PIECE

/** The moves: place the piece in hand at (x, y), or hold (swap the hand with the held piece), once a placement. */
export const YARD_MOVE = Object.freeze({ place: 0, hold: 1 })

export const cellAt = (x: number, y: number): number => y * YARD_SIDE + x
export const cellX = (cell: number): number => cell % YARD_SIDE
export const cellY = (cell: number): number => Math.floor(cell / YARD_SIDE)

/** Each cell's orthogonal neighbours, in the order north, west, east, south. */
export const ORTHOGONAL: readonly (readonly number[])[] = Object.freeze(Array.from({ length: YARD_CELLS }, (_, cell) => {
  const x = cellX(cell)
  const y = cellY(cell)
  const out: number[] = []
  if (y > 0) out.push(cell - YARD_SIDE)
  if (x > 0) out.push(cell - 1)
  if (x < YARD_SIDE - 1) out.push(cell + 1)
  if (y < YARD_SIDE - 1) out.push(cell + YARD_SIDE)
  return Object.freeze(out)
}))

/** Each cell's eight neighbours. */
export const AROUND: readonly (readonly number[])[] = Object.freeze(Array.from({ length: YARD_CELLS }, (_, cell) => {
  const out: number[] = []
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const x = cellX(cell) + dx
      const y = cellY(cell) + dy
      if ((dx !== 0 || dy !== 0) && x >= 0 && y >= 0 && x < YARD_SIDE && y < YARD_SIDE) out.push(cellAt(x, y))
    }
  }
  return Object.freeze(out)
}))

const distance = (a: number, b: number): number => Math.abs(cellX(a) - cellX(b)) + Math.abs(cellY(a) - cellY(b))

// --- The state ------------------------------------------------------------------------------------------------------

export interface YardPartner {
  readonly cardId: string
  /** Its colour (0–4), or −1 when wild (Friend and Group). */
  readonly colour: number
  /** Tiers it adds to a merge it joins. */
  readonly lift: number
}

/** What a move did, for the view's animation and the tests. */
export type YardEvent =
  | { readonly kind: 'place'; readonly cell: number; readonly piece: number }
  | { readonly kind: 'hold' }
  | { readonly kind: 'merge'; readonly cell: number; readonly colour: number; readonly tier: number; readonly from: readonly number[]; readonly drills: number; readonly lift: number }
  | { readonly kind: 'masterclass'; readonly colour: number; readonly cells: readonly number[]; readonly drills: number }
  | { readonly kind: 'move'; readonly from: number; readonly to: number }
  | { readonly kind: 'rest'; readonly cell: number }
  | { readonly kind: 'rest-clear'; readonly cells: readonly number[]; readonly fatigue: readonly number[] }

export interface YardState {
  readonly board: readonly number[]
  /** The whole queue, rolled at `init`. */
  readonly queue: readonly number[]
  /** Queue pieces drawn so far: the next two are `queue[drawn]` and `queue[drawn + 1]`. */
  readonly drawn: number
  readonly hand: number
  /** The held piece, or −1. */
  readonly hold: number
  /** Whether the hold was used since the last placement. */
  readonly held: boolean
  readonly placed: number
  /** Moves made: placements and holds. The next move's tick. */
  readonly moves: number
  readonly score: number
  /** Drills scored by colour. */
  readonly drills: readonly number[]
  /** Colours that made gold or better, as bits. */
  readonly golds: number
  readonly masterclasses: number
  readonly partnersPlaced: number
  /** Partners placed that joined a merge. */
  readonly partnersMerged: number
  readonly partners: readonly YardPartner[]
  /** The season's focus colour: where a wild Partner settles when it merges nothing. */
  readonly focus: number
  /** Each colour's queue weight. */
  readonly weights: readonly number[]
  /** What the last move did. */
  readonly events: readonly YardEvent[]
}

// --- Setup ----------------------------------------------------------------------------------------------------------

/** The Partners her deck brings: colour by type (Friend and Group wild), lift by bond. */
export function yardPartners(config: Pick<StageConfig, 'deck' | 'bonds'>): YardPartner[] {
  return config.deck.map((card) => ({
    cardId: card.id,
    colour: (STATS as readonly string[]).indexOf(card.type),
    lift: (config.bonds[card.id] ?? 0) >= PARTNER_BONDED_AT ? PARTNER_LIFT.bonded : PARTNER_LIFT.base,
  }))
}

/** Her colours' queue weights: (100 + growth %) × 2, × 3 for the season's focus. */
export function yardColourWeights(config: Pick<StageConfig, 'uma' | 'seasonFocus'>): number[] {
  const focus = STATS.indexOf(config.seasonFocus ?? STATS[0])
  return STATS.map((stat, colour) => (100 + Math.max(0, Math.round(config.uma.growth[stat]))) * 100 *
    (colour === focus ? COLOUR_WEIGHT.focus : COLOUR_WEIGHT.base))
}

/** Each deck card's queue weight: `PARTNER_RATE` × (100 + its real Specialty Priority). */
export const yardPartnerWeights = (config: Pick<StageConfig, 'deck'>): number[] =>
  config.deck.map((card) => PARTNER_RATE * (100 + Math.max(0, Math.round(card.effects[SPECIALTY_PRIORITY] ?? 0))))

/** The queue: seeded, Fatigue at its rate after the first few, then a colour or a Partner by weight. */
export function yardQueue(config: StageConfig): number[] {
  const rng = stageRng(config.seed)
  const weights = [...yardColourWeights(config), ...yardPartnerWeights(config)]
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  const queue: number[] = []
  for (let n = 0; n < YARD_QUEUE; n += 1) {
    const fatigue = rng.below(100) < FATIGUE_PERCENT
    let roll = rng.below(total)
    let pick = 0
    while (roll >= weights[pick]!) roll -= weights[pick++]!
    queue.push(fatigue && n >= FATIGUE_FREE ? FATIGUE_PIECE : pick < STATS.length ? pick : PARTNER_BASE + pick - STATS.length)
  }
  return queue
}

export function initYard(config: StageConfig): YardState {
  if (config.kind !== 'training-yard') throw new RangeError(`Training Yard can't play a ${config.kind} config`)
  const queue = yardQueue(config)
  return {
    board: Array.from({ length: YARD_CELLS }, () => EMPTY),
    queue, drawn: 1, hand: queue[0]!, hold: -1, held: false, placed: 0, moves: 0, score: 0, drills: [0, 0, 0, 0, 0], golds: 0,
    masterclasses: 0, partnersPlaced: 0, partnersMerged: 0, partners: yardPartners(config),
    focus: STATS.indexOf(config.seasonFocus ?? STATS[0]), weights: yardColourWeights(config), events: [],
  }
}

// --- Merges ---------------------------------------------------------------------------------------------------------

/** The cells holding `board[cell]`'s value that touch it, itself first. */
export function groupOf(board: readonly number[], cell: number): number[] {
  const value = board[cell]!
  const seen = new Uint8Array(YARD_CELLS)
  const group = [cell]
  seen[cell] = 1
  for (let i = 0; i < group.length; i += 1) {
    for (const next of ORTHOGONAL[group[i]!]!) {
      if (seen[next] === 0 && board[next] === value) {
        seen[next] = 1
        group.push(next)
      }
    }
  }
  return group
}

interface Tally {
  score: number
  drills: number[]
  golds: number
  masterclasses: number
  readonly events: YardEvent[]
}

/** Merges the group at `cell` while it holds three or more, lifting the first merge `lift` tiers more. */
function resolveMerges(board: number[], cell: number, lift: number, tally: Tally): boolean {
  let merged = false
  let extra = lift
  for (;;) {
    const value = board[cell]!
    if (!isPieceCell(value)) return merged
    const group = groupOf(board, cell)
    if (group.length < 3) return merged
    merged = true
    const colour = cellColour(value)
    const tier = cellTier(value)
    if (tier === RAINBOW) {
      for (const each of group) board[each] = EMPTY
      tally.score += MASTERCLASS_DRILLS
      tally.drills[colour]! += MASTERCLASS_DRILLS
      tally.masterclasses += 1
      tally.events.push({ kind: 'masterclass', colour, cells: group, drills: MASTERCLASS_DRILLS })
      return merged
    }
    const made = Math.min(RAINBOW, tier + 1 + extra)
    for (const each of group) if (each !== cell) board[each] = EMPTY
    board[cell] = pieceCell(colour, made)
    const drills = YARD_LADDER[made]!
    tally.score += drills
    tally.drills[colour]! += drills
    if (made >= GOLD) tally.golds |= 1 << colour
    tally.events.push({ kind: 'merge', cell, colour, tier: made, from: group.slice(1), drills, lift: extra })
    extra = 0
  }
}

/** A piece set down at `cell`: it pays its Sweat, tier 0's drills, in its colour. */
function sweat(board: number[], cell: number, colour: number, tier: number, tally: Tally): void {
  board[cell] = pieceCell(colour, tier)
  tally.score += YARD_LADDER[0]!
  tally.drills[colour]! += YARD_LADDER[0]!
}

/** The colour and tier a Partner takes at `cell`: the highest tier it can merge, then the biggest group, else none. */
export function partnerFit(board: readonly number[], cell: number, partner: YardPartner): { colour: number; tier: number } | null {
  const work = [...board]
  const colours = partner.colour >= 0 ? [partner.colour] : [0, 1, 2, 3, 4]
  for (let tier = RAINBOW; tier >= 0; tier -= 1) {
    let best: { colour: number; size: number } | null = null
    for (const colour of colours) {
      work[cell] = pieceCell(colour, tier)
      const size = groupOf(work, cell).length
      if (size >= 3 && (best === null || size > best.size)) best = { colour, size }
    }
    if (best !== null) return { colour: best.colour, tier }
  }
  return null
}

// --- Fatigue and Rest -----------------------------------------------------------------------------------------------

/** The highest-tier piece on the board, the first in reading order on a tie; −1 when there is none. */
export function fatigueTarget(board: readonly number[]): number {
  let target = -1
  let best = -1
  for (let cell = 0; cell < YARD_CELLS; cell += 1) {
    const value = board[cell]!
    if (isPieceCell(value) && cellTier(value) > best) {
      best = cellTier(value)
      target = cell
    }
  }
  return target
}

const boxedIn = (board: readonly number[], cell: number): boolean => ORTHOGONAL[cell]!.every((next) => board[next] !== EMPTY)

/**
 * After a placement: each Fatigue but the one just placed steps one cell toward the highest-tier piece (north, west,
 * east, south, the first empty cell closer to it), in reading order; every Fatigue boxed in becomes Rest; and three or
 * more touching Rests clear, with every Fatigue in the eight cells around them.
 */
function fatiguePhase(board: number[], placed: number, tally: Tally): void {
  const target = fatigueTarget(board)
  if (target >= 0) {
    const movers: number[] = []
    for (let cell = 0; cell < YARD_CELLS; cell += 1) if (board[cell] === FATIGUE && cell !== placed) movers.push(cell)
    for (const from of movers) {
      const away = distance(from, target)
      const to = ORTHOGONAL[from]!.find((next) => board[next] === EMPTY && distance(next, target) < away)
      if (to === undefined) continue
      board[to] = FATIGUE
      board[from] = EMPTY
      tally.events.push({ kind: 'move', from, to })
    }
  }
  for (let cell = 0; cell < YARD_CELLS; cell += 1) {
    if (board[cell] === FATIGUE && boxedIn(board, cell)) {
      board[cell] = REST
      tally.events.push({ kind: 'rest', cell })
    }
  }
  const seen = new Uint8Array(YARD_CELLS)
  for (let cell = 0; cell < YARD_CELLS; cell += 1) {
    if (board[cell] !== REST || seen[cell] === 1) continue
    const group = groupOf(board, cell)
    for (const each of group) seen[each] = 1
    if (group.length < 3) continue
    for (const each of group) board[each] = EMPTY
    const fatigue: number[] = []
    for (const each of group) {
      for (const near of AROUND[each]!) {
        if (board[near] === FATIGUE) {
          board[near] = EMPTY
          fatigue.push(near)
        }
      }
    }
    tally.events.push({ kind: 'rest-clear', cells: group, fatigue })
  }
}

// --- Moves ----------------------------------------------------------------------------------------------------------

export const yardDone = (state: YardState): boolean => state.placed >= YARD_PLACEMENTS || !state.board.includes(EMPTY)

function hold(state: YardState): YardState | null {
  if (state.held) return null
  const empty = state.hold < 0
  return {
    ...state,
    hand: empty ? state.queue[state.drawn]! : state.hold,
    hold: state.hand,
    drawn: empty ? state.drawn + 1 : state.drawn,
    held: true,
    moves: state.moves + 1,
    events: [{ kind: 'hold' }],
  }
}

function place(state: YardState, cell: number): YardState | null {
  if (state.board[cell] !== EMPTY) return null
  const board = [...state.board]
  const tally: Tally = {
    score: state.score, drills: [...state.drills], golds: state.golds, masterclasses: state.masterclasses,
    events: [{ kind: 'place', cell, piece: state.hand }],
  }
  const piece = state.hand
  let partnersPlaced = state.partnersPlaced
  let partnersMerged = state.partnersMerged
  if (piece === FATIGUE_PIECE) {
    board[cell] = FATIGUE
  } else if (isPartnerPiece(piece)) {
    const partner = state.partners[piece - PARTNER_BASE]!
    const fit = partnerFit(board, cell, partner)
    partnersPlaced += 1
    if (fit === null) {
      sweat(board, cell, partner.colour >= 0 ? partner.colour : state.focus, 0, tally)
    } else {
      sweat(board, cell, fit.colour, fit.tier, tally)
      resolveMerges(board, cell, partner.lift, tally)
      partnersMerged += 1
    }
  } else {
    sweat(board, cell, piece, 0, tally)
    resolveMerges(board, cell, 0, tally)
  }
  fatiguePhase(board, piece === FATIGUE_PIECE ? cell : -1, tally)
  return {
    ...state,
    board,
    hand: state.queue[state.drawn]!,
    drawn: state.drawn + 1,
    held: false,
    placed: state.placed + 1,
    moves: state.moves + 1,
    score: tally.score, drills: tally.drills, golds: tally.golds, masterclasses: tally.masterclasses,
    partnersPlaced, partnersMerged,
    events: tally.events,
  }
}

const isCoord = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) < YARD_SIDE

export function stepYard(state: YardState, input: StageInput): YardState | null {
  if (yardDone(state)) return null
  if (input.code === YARD_MOVE.hold) return input.x === undefined && input.y === undefined ? hold(state) : null
  if (input.code === YARD_MOVE.place) return isCoord(input.x) && isCoord(input.y) ? place(state, cellAt(input.x, input.y)) : null
  return null
}

const bits = (n: number): number => {
  let count = 0
  for (let rest = n; rest > 0; rest >>= 1) count += rest & 1
  return count
}

/** The three bonus tasks, in order: gold in two colours, no Fatigue left, every Partner placed joined a merge. */
export function yardTasks(state: YardState): [boolean, boolean, boolean] {
  return [
    bits(state.golds) >= 2,
    !state.board.includes(FATIGUE),
    state.partnersPlaced > 0 && state.partnersMerged === state.partnersPlaced,
  ]
}

export function reportYard(state: YardState): StageReport {
  const split = state.score > 0 ? state.drills : state.weights
  return {
    p: state.score / YARD_TARGET,
    tasks: yardTasks(state),
    score: state.score,
    drills: Object.fromEntries(STATS.map((stat, colour) => [stat, split[colour]!])) as Record<StatKey, number>,
  }
}

/** The moves as inputs. */
export const placeInput = (tick: number, cell: number): StageInput => ({ tick, code: YARD_MOVE.place, x: cellX(cell), y: cellY(cell) })
export const holdInput = (tick: number): StageInput => ({ tick, code: YARD_MOVE.hold })

/** The cells a piece can go. */
export const emptyCells = (board: readonly number[]): number[] => {
  const out: number[] = []
  for (let cell = 0; cell < YARD_CELLS; cell += 1) if (board[cell] === EMPTY) out.push(cell)
  return out
}
