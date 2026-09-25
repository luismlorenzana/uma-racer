// Deterministic Bond Recall rules (docs/design/minigames.md#bond-recall--card-stars).

export const BOND_FLIP_BACK_MS = 700

export interface BondRecallConfig {
  stars: number
  pairs: number
  columns: number
  rows: number
  mismatchLimit: number
}

export interface BondTile {
  id: string
  pairId: string
  cardId: string
}

export type BondRecallStatus = 'playing' | 'resolving' | 'won' | 'lost'

export interface BondRecallState {
  config: BondRecallConfig
  tiles: readonly BondTile[]
  revealed: readonly number[]
  matched: readonly number[]
  mismatches: number
  status: BondRecallStatus
}

export type BondFlipResult = 'first' | 'match' | 'mismatch' | 'ignored'

export interface BondFlip {
  state: BondRecallState
  accepted: boolean
  result: BondFlipResult
}

/** One board per star being earned, 1★ to 5★, growing with the card (T061). */
const CONFIGS: readonly BondRecallConfig[] = [
  { stars: 0, pairs: 6, columns: 3, rows: 4, mismatchLimit: 10 },
  { stars: 1, pairs: 8, columns: 4, rows: 4, mismatchLimit: 12 },
  { stars: 2, pairs: 9, columns: 3, rows: 6, mismatchLimit: 13 },
  { stars: 3, pairs: 10, columns: 4, rows: 5, mismatchLimit: 14 },
  { stars: 4, pairs: 12, columns: 4, rows: 6, mismatchLimit: 16 },
]

function fnv1a(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function seededRandom(seed: string): () => number {
  let state = fnv1a(seed) || 0x9e3779b9
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0x1_0000_0000
  }
}

function unique(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const id of ids) {
    if (id.length === 0 || seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result
}

export function bondRecallConfig(stars: number): BondRecallConfig {
  if (!Number.isInteger(stars) || stars < 0 || stars >= CONFIGS.length) {
    throw new Error('Bond Recall requires a card from 0★ through 4★')
  }
  return { ...CONFIGS[stars]! }
}

/** Active-set order is meaningful; owned-card filler is stable by id. */
export function selectBondFaces(
  activeCardIds: readonly string[],
  ownedCardIds: readonly string[],
  pairCount: number,
): string[] {
  if (!Number.isSafeInteger(pairCount) || pairCount <= 0) throw new Error('Bond Recall requires at least one pair')
  const active = unique(activeCardIds)
  const activeSet = new Set(active)
  const filler = unique(ownedCardIds).filter((id) => !activeSet.has(id)).sort((left, right) => left.localeCompare(right))
  const pool = [...active, ...filler]
  if (pool.length === 0) throw new Error('Bond Recall requires at least one owned card face')
  return Array.from({ length: pairCount }, (_, index) => pool[index % pool.length]!)
}

export function createBondLayout(
  seed: string,
  stars: number,
  activeCardIds: readonly string[],
  ownedCardIds: readonly string[],
): BondTile[] {
  const config = bondRecallConfig(stars)
  const faces = selectBondFaces(activeCardIds, ownedCardIds, config.pairs)
  const tiles = faces.flatMap((cardId, pairIndex) => [0, 1].map((copy) => ({
    id: `pair-${pairIndex}:${copy}`,
    pairId: `pair-${pairIndex}`,
    cardId,
  })))
  const random = seededRandom(`bond-recall:${seed}:lb${stars}`)
  for (let index = tiles.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const held = tiles[index]!
    tiles[index] = tiles[swapIndex]!
    tiles[swapIndex] = held
  }
  return tiles
}

export function startBondRecall(
  seed: string,
  stars: number,
  activeCardIds: readonly string[],
  ownedCardIds: readonly string[],
): BondRecallState {
  return {
    config: bondRecallConfig(stars),
    tiles: createBondLayout(seed, stars, activeCardIds, ownedCardIds),
    revealed: [],
    matched: [],
    mismatches: 0,
    status: 'playing',
  }
}

export function flipBondTile(state: BondRecallState, index: number): BondFlip {
  if (
    state.status !== 'playing' ||
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index >= state.tiles.length ||
    state.revealed.includes(index) ||
    state.matched.includes(index)
  ) {
    return { state, accepted: false, result: 'ignored' }
  }
  if (state.revealed.length === 0) {
    return { state: { ...state, revealed: [index] }, accepted: true, result: 'first' }
  }
  const first = state.revealed[0]!
  const revealed = [first, index]
  if (state.tiles[first]!.pairId === state.tiles[index]!.pairId) {
    const matched = [...state.matched, first, index].sort((left, right) => left - right)
    return {
      state: {
        ...state,
        revealed: [],
        matched,
        status: matched.length === state.tiles.length ? 'won' : 'playing',
      },
      accepted: true,
      result: 'match',
    }
  }
  const mismatches = state.mismatches + 1
  return {
    state: {
      ...state,
      revealed,
      mismatches,
      status: mismatches >= state.config.mismatchLimit ? 'lost' : 'resolving',
    },
    accepted: true,
    result: 'mismatch',
  }
}

export function hideBondMismatch(state: BondRecallState): BondRecallState {
  if (state.status !== 'resolving') return state
  return { ...state, revealed: [], status: 'playing' }
}

export function bondMismatchesRemaining(state: BondRecallState): number {
  return Math.max(0, state.config.mismatchLimit - state.mismatches)
}
