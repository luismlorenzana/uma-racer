// The rework's live blocks (docs/tasks/M033-rework-rules.md): each area under packages/domain/src/rework renders its
// tables into the rework pages. An area exports `LIVE_BLOCKS: Record<key, () => string>` from its `docs.ts`, and one
// import plus one argument below joins it. A key used twice fails at load, so two areas can't fight over a block.
import { LIVE_BLOCKS as CONSTELLATION_BLOCKS } from '../rework/constellation/docs'

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

export const REWORK_BLOCKS: LiveBlocks = joinBlocks(CONSTELLATION_BLOCKS)
