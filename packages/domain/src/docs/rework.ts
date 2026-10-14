// The rework's live blocks (docs/tasks/M033-rework-rules.md): each area under packages/domain/src/rework renders its
// tables into the rework pages. An area exports `LIVE_BLOCKS: Record<key, () => string>` from its `docs.ts`, and one
// import plus one argument below joins it. A key used twice fails at load, so two areas can't fight over a block.
import { LIVE_BLOCKS as EXCHANGE_BLOCKS } from '../rework/exchange/docs'
import { LIVE_BLOCKS as FARM_BLOCKS } from '../rework/farm/docs'
import { LIVE_BLOCKS as ITEM_BLOCKS } from '../rework/items/docs'
import { LIVE_BLOCKS as TIER_BLOCKS } from '../rework/tiers/docs'
import { LIVE_BLOCKS as CONSTELLATION_BLOCKS } from '../rework/constellation/docs'
import { LIVE_BLOCKS as TRAINING_BLOCKS } from '../rework/training/docs'
import { LIVE_BLOCKS as BUILDS_BLOCKS } from '../rework/builds/docs'

export type LiveBlocks = Readonly<Record<string, () => string>>

export function joinBlocks(...tables: readonly LiveBlocks[]): LiveBlocks {
  const joined: Record<string, () => string> = {}
  for (const table of tables) {
    for (const [key, render] of Object.entries(table)) {
      if (key in joined) throw new Error(`Live block "${key}" is rendered twice`)
      joined[key] = render
    }
  }
  return joined
}

export const REWORK_BLOCKS: LiveBlocks = joinBlocks(TIER_BLOCKS, ITEM_BLOCKS, CONSTELLATION_BLOCKS, EXCHANGE_BLOCKS, FARM_BLOCKS, TRAINING_BLOCKS, BUILDS_BLOCKS)
