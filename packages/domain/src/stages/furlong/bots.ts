// Furlong Hand's bots (docs/game/09-furlong-hand.md §10, D385): what `sim:stages` plays to hold the grade bands.
// - **Novice:** the first legal card, always run; flips when stuck; always the rail; never redraws.
// - **Competent:** greedy on the chain: the card whose greedy chain (each next card the one leaving the most cards
//   playable) runs longest, a random one among equals. It runs to stay in her style's band and banks once running
//   would carry her ahead of it; the spurt it runs. The rail, unless a rival closes it, then the middle. It redraws a
//   spread whose best greedy chain is under two cards.
// - **Expert:** a short look-ahead: the card that starts the longest chain the spread holds (Partners not yet played
//   first among equals), the same band banking with a margin, banking the spurt's first cards while a long chain
//   follows for the Drive, the line by what it shows, and a redraw for a spread whose longest chain is under four.
// Pure: the bots read the state and their own dice, never the stage's seed, the pile or a spread still face down.
import type { BotLevel, StageBot, StageInput, StageRng } from '../contract'
import {
  bankInput, canRedraw, cardsLeft, COLUMNS, DRIVE_BASE, flipInput, isSpurt, LINE, lineInput, placings, playableColumns, railClosed,
  redrawInput, rivalGain, runInput, runYield, WILD, cardColour, type FurlongState,
} from './rules'

const pick = <T>(options: readonly T[], value: (option: T) => number, rng: StageRng): T => {
  let top = Number.NEGATIVE_INFINITY
  let ties: T[] = []
  for (const option of options) {
    const v = value(option)
    if (v > top) {
      top = v
      ties = [option]
    } else if (v === top) {
      ties.push(option)
    }
  }
  if (ties.length === 0) throw new RangeError('A bot has no move')
  return ties[ties.length === 1 ? 0 : rng.below(ties.length)]!
}

/** The state after playing column c (run; the chain's shape is the same banked). */
const after = (state: FurlongState, column: number): FurlongState => {
  const stack = state.columns[column]!
  const card = stack[stack.length - 1]!
  const colour = cardColour(state, card)
  return {
    ...state,
    columns: state.columns.map((col, i) => (i === column ? col.slice(0, -1) : col)),
    lead: card,
    leadWild: colour === WILD,
    blocked: state.blocked >= 0 && (colour === 2 || colour === 4 || colour === WILD) ? -1 : state.blocked,
  }
}

/** The longest chain the spread holds from here, without a flip (memoised on the columns' heights and the lead). */
export function longestChain(state: FurlongState): number {
  const memo = new Map<string, number>()
  const walk = (s: FurlongState): number => {
    const key = `${s.columns.map((c) => c.length).join(',')}:${s.lead}:${s.leadWild ? 1 : 0}:${s.blocked}`
    const known = memo.get(key)
    if (known !== undefined) return known
    let best = 0
    for (const column of playableColumns(s)) best = Math.max(best, 1 + walk(after(s, column)))
    memo.set(key, best)
    return best
  }
  return walk(state)
}

/**
 * The ground band that keeps her in her style's places at this leg's end, against the rivals' ground once their shown
 * moves play out (as if she leaves nothing): at least the floor to sit no further back than her band, under the ceiling
 * to sit no further forward.
 */
export function bandGround(state: FurlongState): { floor: number; ceiling: number } {
  const projected = state.rivalGround.map((g, r) => g + rivalGain(state, r, state.spread, 0)).sort((a, b) => b - a)
  const [lo, hi] = state.band
  const floor = hi - 1 < projected.length ? projected[hi - 1]! : Number.NEGATIVE_INFINITY
  const ceiling = lo >= 2 ? projected[lo - 2]! - 1 : Number.POSITIVE_INFINITY
  return { floor, ceiling }
}

const flipOrStuck = (state: FurlongState): StageInput => flipInput(state.moves)

// --- Novice ---------------------------------------------------------------------------------------------------------

const novice: StageBot<FurlongState> = (state) => {
  if (state.phase === 'line') return lineInput(state.moves, LINE.rail)
  const playable = playableColumns(state)
  return playable.length > 0 ? runInput(state.moves, playable[0]!) : flipOrStuck(state)
}

// --- Competent ------------------------------------------------------------------------------------------------------

const followers = (state: FurlongState, column: number): number => playableColumns(after(state, column)).length

/** The chain a greedy hand gets after playing column c: each next card the one leaving the most cards playable. */
export function greedyChain(state: FurlongState, column: number): number {
  let s = after(state, column)
  let length = 1
  for (;;) {
    const next = playableColumns(s)
    if (next.length === 0) return length
    let best = next[0]!
    for (const c of next) if (followers(s, c) > followers(s, best)) best = c
    s = after(s, best)
    length += 1
  }
}

/** Run it, unless running carries her past her band's ceiling (the spurt always runs). */
function shouldBank(state: FurlongState, card: number, margin: number): boolean {
  if (isSpurt(state)) return false
  const { ceiling } = bandGround(state)
  return state.ground + runYield(state, card).ground + margin > ceiling
}

/** The competent bot redraws a spread whose best greedy chain from the lead is shorter than this. */
export const COMPETENT_REDRAW = 2
/** The expert redraws a spread whose longest chain from the lead is shorter than this. */
export const EXPERT_REDRAW = 4

const competent: StageBot<FurlongState> = (state, rng) => {
  if (state.phase === 'line') return lineInput(state.moves, railClosed(state, state.spread) ? LINE.middle : LINE.rail)
  if (canRedraw(state)) {
    const best = playableColumns(state).reduce((top, c) => Math.max(top, greedyChain(state, c)), 0)
    if (best < COMPETENT_REDRAW) return redrawInput(state.moves)
  }
  const playable = playableColumns(state)
  if (playable.length === 0) return flipOrStuck(state)
  const column = pick(playable, (c) => greedyChain(state, c), rng)
  const stack = state.columns[column]!
  return shouldBank(state, stack[stack.length - 1]!, 0) ? bankInput(state.moves, column) : runInput(state.moves, column)
}

// --- Expert ---------------------------------------------------------------------------------------------------------

/** Spurt cards worth banking for: a bank's Drive lifts each run card after it by a tenth. */
const SPURT_BANK_CHAIN = 7

const expertLine = (state: FurlongState): number => {
  if (!railClosed(state, state.spread)) return LINE.rail
  // A closed rail shuts a column until a Power or Wit card plays: the outside instead while Breath allows.
  return state.breath >= 3 ? LINE.outside : LINE.middle
}

const expert: StageBot<FurlongState> = (state, rng) => {
  if (state.phase === 'line') return lineInput(state.moves, expertLine(state))
  if (canRedraw(state) && longestChain(state) < EXPERT_REDRAW) return redrawInput(state.moves)
  const playable = playableColumns(state)
  if (playable.length === 0) return flipOrStuck(state)
  const unplayedPartner = (column: number): number => {
    const stack = state.columns[column]!
    const card = state.cards[stack[stack.length - 1]!]!
    return card.kind === 'partner' && (state.played & (1 << card.ref)) === 0 ? 1 : 0
  }
  const column = pick(playable, (c) => 4 * (1 + longestChain(after(state, c))) + 6 * unplayedPartner(c) + followers(state, c) / COLUMNS, rng)
  const stack = state.columns[column]!
  const card = stack[stack.length - 1]!
  if (isSpurt(state)) {
    const ahead = longestChain(after(state, column))
    // Bank while enough run cards follow that a tenth more on each outweighs this card's own run.
    const run = runYield(state, card).ground
    const each = Math.floor(run / Math.max(1, DRIVE_BASE + state.drive))
    return ahead >= SPURT_BANK_CHAIN && each * ahead > run ? bankInput(state.moves, column) : runInput(state.moves, column)
  }
  return shouldBank(state, card, Math.floor(cardsLeft(state) / 3)) ? bankInput(state.moves, column) : runInput(state.moves, column)
}

/** Every bot's place now, for the tests: her place if the leg ended with the rivals' shown moves. */
export const projectedPlace = (state: FurlongState): number =>
  placings(state.ground, state.rivalGround.map((g, r) => g + rivalGain(state, r, state.spread, cardsLeft(state)))).her

export const FURLONG_BOTS: Readonly<Record<BotLevel, StageBot<FurlongState>>> = Object.freeze({ novice, competent, expert })

