// Skill Points (docs/game/03-uma-progression.md §8, docs/game/05-training-hub.md §4, D133): the 40% baseline
// follows the open card nodes of her current tree, and a Friend or Group card on its fair share pays the other 60%. The shares are today's; the SP cap is T125's; N and the fair share are T129's.
import { SP_CARD_SHARE } from '../constellation'
import { BASELINE_SP_SHARE } from '../scenarios'
import { fairShare, treeCardNodesAt } from './trees/sizes'
import { spCapAt } from '../tiers/scaling'

/** Whole-percent forms of today's shares, so the rounding below happens once on integers. */
const BASELINE_PCT = Math.round(BASELINE_SP_SHARE * 100)
const CARD_PCT = Math.round(SP_CARD_SHARE * 100)

/** Baseline SP at scenario T with `opened` card nodes open: round(0.40 × spCap(T) × opened ÷ N). */
export function baselineSp(T: number, opened: number): number {
  const N = treeCardNodesAt(T)
  if (!Number.isInteger(opened) || opened < 0 || opened > N) throw new RangeError(`Open card nodes must be 0–${N}: ${opened}`)
  return Math.round((BASELINE_PCT * spCapAt(T) * opened) / (100 * N))
}

/** SP one current-era Friend or Group node pays at T: round(0.60 × spCap(T) ÷ ceil(N / 6)). */
export const reworkSpNodeValue = (T: number): number => Math.round((CARD_PCT * spCapAt(T)) / (100 * fairShare(treeCardNodesAt(T))))
