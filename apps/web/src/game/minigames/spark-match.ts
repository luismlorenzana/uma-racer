// Pure Spark Match engine (docs/design/minigames.md#spark-match--training-levels).

export const SPARK_BOARD_WIDTH = 7
export const SPARK_BOARD_HEIGHT = 8
export const SPARK_TILE_COUNT = 6
export const SPARK_TRAINEE_TILE = 5
export const SPARK_RUN_MOVES = 25

export type SparkTile = 0 | 1 | 2 | 3 | 4 | 5

export interface SparkBoard {
  cells: readonly SparkTile[]
  rngState: number
  reshuffles: number
}

export interface SparkMove {
  from: number
  to: number
}

export interface SparkMatchEvent {
  indices: readonly number[]
  tile: SparkTile
}

export interface SparkClearStep {
  before: readonly SparkTile[]
  cleared: readonly number[]
  after: readonly SparkTile[]
  matches: readonly SparkMatchEvent[]
  cascade: number
  multiplier: number
  rawPoints: number
}

export interface SparkSwapResult {
  accepted: boolean
  board: SparkBoard
  steps: readonly SparkClearStep[]
  score: number
  reshuffled: boolean
}

export interface SparkRunState {
  board: SparkBoard
  moves: number
  score: number
  status: 'playing' | 'complete'
}

export interface SparkRunMoveResult extends SparkSwapResult {
  state: SparkRunState
}

const BOARD_SIZE = SPARK_BOARD_WIDTH * SPARK_BOARD_HEIGHT
const UINT32_RANGE = 0x1_0000_0000

function seedState(seed: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0 || 0x9e3779b9
}

function nextUint(state: number): [number, number] {
  let next = state >>> 0 || 0x9e3779b9
  next ^= next << 13
  next ^= next >>> 17
  next ^= next << 5
  next >>>= 0
  return [next, next]
}

function nextInt(state: number, maximum: number): [number, number] {
  if (!Number.isSafeInteger(maximum) || maximum < 1) throw new Error('Spark Match RNG requires a positive maximum')
  const [value, next] = nextUint(state)
  return [Math.floor((value / UINT32_RANGE) * maximum), next]
}

function assertCells(cells: readonly SparkTile[]): void {
  if (cells.length !== BOARD_SIZE || cells.some((tile) => !Number.isSafeInteger(tile) || tile < 0 || tile >= SPARK_TILE_COUNT)) {
    throw new Error(`Spark Match board must contain ${BOARD_SIZE} valid tiles`)
  }
}

const rowOf = (index: number): number => Math.floor(index / SPARK_BOARD_WIDTH)
const columnOf = (index: number): number => index % SPARK_BOARD_WIDTH

export function sparkAdjacent(left: number, right: number): boolean {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right) || left < 0 || right < 0 || left >= BOARD_SIZE || right >= BOARD_SIZE) return false
  return Math.abs(rowOf(left) - rowOf(right)) + Math.abs(columnOf(left) - columnOf(right)) === 1
}

function swapped(cells: readonly SparkTile[], left: number, right: number): SparkTile[] {
  const next = [...cells]
  const tile = next[left]!
  next[left] = next[right]!
  next[right] = tile
  return next
}

export function sparkMatches(cells: readonly SparkTile[]): SparkMatchEvent[] {
  assertCells(cells)
  const matches: SparkMatchEvent[] = []
  for (let row = 0; row < SPARK_BOARD_HEIGHT; row += 1) {
    let start = 0
    while (start < SPARK_BOARD_WIDTH) {
      const first = row * SPARK_BOARD_WIDTH + start
      const tile = cells[first]!
      let end = start + 1
      while (end < SPARK_BOARD_WIDTH && cells[row * SPARK_BOARD_WIDTH + end] === tile) end += 1
      if (end - start >= 3) {
        matches.push({ tile, indices: Array.from({ length: end - start }, (_, offset) => first + offset) })
      }
      start = end
    }
  }
  for (let column = 0; column < SPARK_BOARD_WIDTH; column += 1) {
    let start = 0
    while (start < SPARK_BOARD_HEIGHT) {
      const first = start * SPARK_BOARD_WIDTH + column
      const tile = cells[first]!
      let end = start + 1
      while (end < SPARK_BOARD_HEIGHT && cells[end * SPARK_BOARD_WIDTH + column] === tile) end += 1
      if (end - start >= 3) {
        matches.push({ tile, indices: Array.from({ length: end - start }, (_, offset) => (start + offset) * SPARK_BOARD_WIDTH + column) })
      }
      start = end
    }
  }
  return matches
}

function eventPoints(event: SparkMatchEvent): number {
  const base = event.indices.length === 3 ? 30 : event.indices.length === 4 ? 60 : 120
  return event.tile === SPARK_TRAINEE_TILE ? base * 2 : base
}

export function scoreSparkChain(steps: readonly Pick<SparkClearStep, 'matches' | 'cascade'>[]): number {
  const total = steps.reduce((running, step) => {
    const raw = step.matches.reduce((matchTotal, match) => matchTotal + eventPoints(match), 0)
    const withMatches = running + raw
    return step.cascade > 0 ? withMatches * 1.2 : withMatches
  }, 0)
  return Math.round(total)
}

function generateMatchFreeBoard(state: number): { cells: SparkTile[]; rngState: number } {
  const cells: SparkTile[] = []
  let rngState = state
  for (let index = 0; index < BOARD_SIZE; index += 1) {
    const [offset, next] = nextInt(rngState, SPARK_TILE_COUNT)
    rngState = next
    let placed = false
    for (let candidateOffset = 0; candidateOffset < SPARK_TILE_COUNT; candidateOffset += 1) {
      const tile = ((offset + candidateOffset) % SPARK_TILE_COUNT) as SparkTile
      const column = columnOf(index)
      const horizontalMatch = column >= 2 && cells[index - 1] === tile && cells[index - 2] === tile
      const verticalMatch = index >= SPARK_BOARD_WIDTH * 2 &&
        cells[index - SPARK_BOARD_WIDTH] === tile && cells[index - SPARK_BOARD_WIDTH * 2] === tile
      if (!horizontalMatch && !verticalMatch) {
        cells.push(tile)
        placed = true
        break
      }
    }
    if (!placed) throw new Error('Spark Match could not place a valid tile')
  }
  return { cells, rngState }
}

export function legalSparkMoves(board: Pick<SparkBoard, 'cells'>): SparkMove[] {
  assertCells(board.cells)
  const moves: SparkMove[] = []
  for (let index = 0; index < BOARD_SIZE; index += 1) {
    const column = columnOf(index)
    const candidates = [
      ...(column + 1 < SPARK_BOARD_WIDTH ? [index + 1] : []),
      ...(index + SPARK_BOARD_WIDTH < BOARD_SIZE ? [index + SPARK_BOARD_WIDTH] : []),
    ]
    for (const target of candidates) {
      if (sparkMatches(swapped(board.cells, index, target)).length > 0) moves.push({ from: index, to: target })
    }
  }
  return moves
}

function freshPlayableBoard(state: number): { cells: SparkTile[]; rngState: number } {
  let rngState = state
  for (let attempt = 0; attempt < 1_024; attempt += 1) {
    const generated = generateMatchFreeBoard(rngState)
    rngState = generated.rngState
    if (legalSparkMoves(generated).length > 0) return generated
  }
  throw new Error('Spark Match could not generate a playable board')
}

export function createSparkBoard(seed: string): SparkBoard {
  if (!seed) throw new Error('Spark Match requires a seed')
  const generated = freshPlayableBoard(seedState(seed))
  return { cells: generated.cells, rngState: generated.rngState, reshuffles: 0 }
}

function shuffleCells(cells: readonly SparkTile[], state: number): { cells: SparkTile[]; rngState: number } {
  const next = [...cells]
  let rngState = state
  for (let index = next.length - 1; index > 0; index -= 1) {
    const [target, advanced] = nextInt(rngState, index + 1)
    rngState = advanced
    const tile = next[index]!
    next[index] = next[target]!
    next[target] = tile
  }
  return { cells: next, rngState }
}

export function ensurePlayableSparkBoard(board: SparkBoard): { board: SparkBoard; reshuffled: boolean } {
  assertCells(board.cells)
  if (sparkMatches(board.cells).length === 0 && legalSparkMoves(board).length > 0) return { board, reshuffled: false }
  let rngState = board.rngState
  for (let attempt = 0; attempt < 2_048; attempt += 1) {
    const shuffled = shuffleCells(board.cells, rngState)
    rngState = shuffled.rngState
    if (sparkMatches(shuffled.cells).length === 0 && legalSparkMoves(shuffled).length > 0) {
      return {
        board: { cells: shuffled.cells, rngState, reshuffles: board.reshuffles + 1 },
        reshuffled: true,
      }
    }
  }
  const generated = freshPlayableBoard(rngState)
  return {
    board: { cells: generated.cells, rngState: generated.rngState, reshuffles: board.reshuffles + 1 },
    reshuffled: true,
  }
}

function collapse(cells: readonly SparkTile[], cleared: ReadonlySet<number>, state: number): { cells: SparkTile[]; rngState: number } {
  const next = Array<SparkTile>(BOARD_SIZE)
  let rngState = state
  for (let column = 0; column < SPARK_BOARD_WIDTH; column += 1) {
    const survivors: SparkTile[] = []
    for (let row = SPARK_BOARD_HEIGHT - 1; row >= 0; row -= 1) {
      const index = row * SPARK_BOARD_WIDTH + column
      if (!cleared.has(index)) survivors.push(cells[index]!)
    }
    let survivor = 0
    for (let row = SPARK_BOARD_HEIGHT - 1; row >= 0; row -= 1) {
      const index = row * SPARK_BOARD_WIDTH + column
      if (survivor < survivors.length) {
        next[index] = survivors[survivor++]!
      } else {
        const [tile, advanced] = nextInt(rngState, SPARK_TILE_COUNT)
        rngState = advanced
        next[index] = tile as SparkTile
      }
    }
  }
  return { cells: next, rngState }
}

export function applySparkSwap(board: SparkBoard, from: number, to: number): SparkSwapResult {
  assertCells(board.cells)
  if (!sparkAdjacent(from, to)) return { accepted: false, board, steps: [], score: 0, reshuffled: false }
  let cells = swapped(board.cells, from, to)
  if (sparkMatches(cells).length === 0) return { accepted: false, board, steps: [], score: 0, reshuffled: false }
  let rngState = board.rngState
  const steps: SparkClearStep[] = []
  for (let cascade = 0; cascade < 64; cascade += 1) {
    const matches = sparkMatches(cells)
    if (matches.length === 0) break
    const cleared = [...new Set(matches.flatMap((match) => match.indices))].sort((left, right) => left - right)
    const collapsed = collapse(cells, new Set(cleared), rngState)
    steps.push({
      before: [...cells],
      cleared,
      after: collapsed.cells,
      matches,
      cascade,
      multiplier: 1.2 ** cascade,
      rawPoints: matches.reduce((sum, match) => sum + eventPoints(match), 0),
    })
    cells = collapsed.cells
    rngState = collapsed.rngState
  }
  if (sparkMatches(cells).length > 0) throw new Error('Spark Match cascade exceeded its safety bound')
  const playable = ensurePlayableSparkBoard({ cells, rngState, reshuffles: board.reshuffles })
  return {
    accepted: true,
    board: playable.board,
    steps,
    score: scoreSparkChain(steps),
    reshuffled: playable.reshuffled,
  }
}

export function startSparkRun(seed: string): SparkRunState {
  return { board: createSparkBoard(seed), moves: 0, score: 0, status: 'playing' }
}

export function playSparkMove(state: SparkRunState, from: number, to: number): SparkRunMoveResult {
  if (state.status === 'complete') return { accepted: false, board: state.board, steps: [], score: 0, reshuffled: false, state }
  const swap = applySparkSwap(state.board, from, to)
  if (!swap.accepted) return { ...swap, state }
  const moves = state.moves + 1
  return {
    ...swap,
    state: {
      board: swap.board,
      moves,
      score: state.score + swap.score,
      status: moves === SPARK_RUN_MOVES ? 'complete' : 'playing',
    },
  }
}

// Short names form the public reducer-shaped contract used by task T049 and external renderers.
export const createBoard = createSparkBoard
export const legalMoves = legalSparkMoves
export const applySwap = applySparkSwap
