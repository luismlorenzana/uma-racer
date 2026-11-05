// Stage fixtures (D384): Training Yard configs on the invented cards and Umas, and yards drawn as text so a rule test
// reads like the board it sets up. Invented values only.
import { syntheticCards } from '../build/decks'
import type { SupportCardTemplate } from '../content'
import { buildStageConfig } from '../stages/config'
import type { StageConfig } from '../stages/contract'
import {
  EMPTY, FATIGUE, initYard, pieceCell, REST, YARD_CELLS, YARD_SIDE, type YardState,
} from '../stages/yard/rules'
import type { StatKey, Stats } from '../types'

export const CARDS = syntheticCards()
export const cardOf = (id: string): SupportCardTemplate => {
  const found = CARDS.find((card) => card.id === id)
  if (found === undefined) throw new Error(`No card ${id}`)
  return found
}

/** A deck of one card per stat type and a Friend, at quality 2. */
export const DECK_IDS = ['sim-speed-2', 'sim-stamina-2', 'sim-power-2', 'sim-guts-2', 'sim-wit-2', 'sim-friend-2']

const GROWTH: Stats = { speed: 0.1, stamina: 0, power: 0.1, guts: 0, wit: 0.1 }

export interface YardConfigOptions {
  readonly seed?: number
  readonly deck?: readonly string[]
  /** Bonds by card id; every other card at 50. */
  readonly bonds?: Readonly<Record<string, number>>
  readonly focus?: StatKey
  readonly growth?: Stats
  readonly practice?: boolean
}

export function yardConfig(options: YardConfigOptions = {}): StageConfig {
  return buildStageConfig({
    kind: 'training-yard', seed: options.seed ?? 12345, T: 1, practice: options.practice ?? false,
    uma: { id: 'sim-uma-1', growthRates: options.growth ?? GROWTH },
    deck: (options.deck ?? DECK_IDS).map((id) => ({ card: cardOf(id), bond: options.bonds?.[id] ?? 50 })),
    focus: options.focus ?? 'speed',
  })
}

const COLOURS = 'stpgw'

/**
 * A board from six rows of six tokens: `.` empty, `F` Fatigue, `R` Rest, or a colour letter (s speed, t stamina,
 * p power, g guts, w wit) and a tier digit, `s0` to `w4`.
 */
export function drawBoard(rows: readonly string[]): number[] {
  if (rows.length !== YARD_SIDE) throw new Error('A yard has six rows')
  const board: number[] = []
  for (const row of rows) {
    const tokens = row.trim().split(/\s+/)
    if (tokens.length !== YARD_SIDE) throw new Error(`A row has six cells: ${row}`)
    for (const token of tokens) {
      if (token === '.') board.push(EMPTY)
      else if (token === 'F') board.push(FATIGUE)
      else if (token === 'R') board.push(REST)
      else board.push(pieceCell(COLOURS.indexOf(token[0]!), Number(token[1])))
    }
  }
  if (board.length !== YARD_CELLS) throw new Error('A yard has 36 cells')
  return board
}

/** The board back as rows of tokens. */
export function showBoard(board: readonly number[]): string[] {
  const token = (cell: number): string => {
    if (cell === EMPTY) return '.'
    if (cell === FATIGUE) return 'F'
    if (cell === REST) return 'R'
    return `${COLOURS[Math.floor((cell - 1) / 5)]}${(cell - 1) % 5}`
  }
  return Array.from({ length: YARD_SIDE }, (_, y) => board.slice(y * YARD_SIDE, (y + 1) * YARD_SIDE).map(token).join(' '))
}

/** A Yard with this board and this piece in hand (a queue piece code), the rest from `options`' config. */
export function yardWith(rows: readonly string[], hand: number, options: YardConfigOptions = {}): YardState {
  return { ...initYard(yardConfig(options)), board: drawBoard(rows), hand }
}
